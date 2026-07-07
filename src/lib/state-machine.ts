import { prisma } from "./prisma";
import { DEFAULT_CONFIG } from "./constants";

export async function getConfig(key: string): Promise<string | null> {
  const rule = await prisma.configRule.findUnique({ where: { ruleKey: key } });
  return rule?.ruleValue ?? null;
}

export async function getConfigNumber(key: string, defaultValue: number): Promise<number> {
  const val = await getConfig(key);
  if (!val) return defaultValue;
  const parsed = JSON.parse(val);
  return typeof parsed === "number" ? parsed : defaultValue;
}

async function getThresholds() {
  return {
    l1Max: await getConfigNumber("approval_amount_threshold_l1", DEFAULT_CONFIG.APPROVAL_AMOUNT_THRESHOLD_L1),
    l2Min: await getConfigNumber("approval_amount_threshold_l2", DEFAULT_CONFIG.APPROVAL_AMOUNT_THRESHOLD_L2),
    approvalTimeout: await getConfigNumber("approval_timeout_minutes", DEFAULT_CONFIG.APPROVAL_TIMEOUT_MINUTES),
    qcHoldTimeout: await getConfigNumber("qc_hold_timeout_minutes", DEFAULT_CONFIG.QC_HOLD_TIMEOUT_MINUTES),
    maxRejectCount: await getConfigNumber("max_reject_count", DEFAULT_CONFIG.MAX_REJECT_COUNT),
  };
}

export function determineApprovalLevel(amount: number, thresholds: { l1Max: number; l2Min: number }): "l1" | "l2" {
  if (amount >= thresholds.l2Min) return "l2";
  return "l1";
}

export async function transitionTicketOnApproval(
  ticketId: string,
  action: "approved" | "rejected",
  approverId: string,
  approvalLevel: string,
  comment?: string
) {
  const ticket = await prisma.exceptionTicket.findUnique({
    where: { id: ticketId },
    include: { approvalRecords: { orderBy: { createdAt: "desc" } } },
  });
  if (!ticket) throw new Error("Ticket not found");

  const thresholds = await getThresholds();

  if (action === "approved") {
    if (approvalLevel === "l1") {
      if (ticket.amount >= thresholds.l2Min) {
        await prisma.exceptionTicket.update({
          where: { id: ticketId },
          data: { status: "approval_l2" },
        });
        return { newStatus: "approval_l2", message: "已通过一级审批，进入二级审批" };
      }
      await prisma.exceptionTicket.update({
        where: { id: ticketId },
        data: { status: "executing" },
      });
      return { newStatus: "executing", message: "审批通过，进入执行阶段" };
    }
    if (approvalLevel === "l2") {
      await prisma.exceptionTicket.update({
        where: { id: ticketId },
        data: { status: "executing" },
      });
      return { newStatus: "executing", message: "二级审批通过，进入执行阶段" };
    }
  }

  if (action === "rejected") {
    if (ticket.rejectCount + 1 >= thresholds.maxRejectCount) {
      await prisma.exceptionTicket.update({
        where: { id: ticketId },
        data: { status: "auto_rejected", rejectCount: { increment: 1 } },
      });
      return { newStatus: "auto_rejected", message: `已达最大驳回次数(${thresholds.maxRejectCount})，工单自动关闭` };
    }
    await prisma.exceptionTicket.update({
      where: { id: ticketId },
      data: { status: "pending_approval", rejectCount: { increment: 1 } },
    });
    return { newStatus: "pending_approval", message: "审批驳回，可重新提交" };
  }

  return { newStatus: ticket.status, message: "无变更" };
}

export async function processExecution(ticketId: string) {
  const ticket = await prisma.exceptionTicket.findUnique({
    where: { id: ticketId },
    include: { waybillSnapshot: true },
  });
  if (!ticket || ticket.status !== "executing") return;

  const actions = getActionsForExceptionType(ticket.exceptionType);

  if (actions.includes("compensate") || actions.includes("compensate_from_supplier")) {
    const lastApproval = await prisma.approvalRecord.findFirst({
      where: { ticketId, action: "approved" },
      orderBy: { createdAt: "desc" },
    });
    const direction = ticket.ticketSource === "scan_auto" ? "from_supplier" : "to_customer";
    await prisma.compensationRecord.create({
      data: {
        ticketId,
        approvalRecordId: lastApproval?.id ?? null,
        amount: ticket.amount,
        direction,
        status: "pending",
        description: `审批通过自动生成赔付记录`,
      },
    });
  }

  if (actions.includes("return") || actions.includes("return_to_supplier") || actions.includes("restock")) {
    if (ticket.waybillSnapshot) {
      const skuSummary = JSON.parse(ticket.waybillSnapshot.skuSummary || "[]") as Array<{ skuCode: string; quantity: number }>;
      for (const sku of skuSummary) {
        await prisma.inventoryRecord.create({
          data: {
            ticketId,
            skuCode: sku.skuCode,
            changeType: "inbound",
            quantity: sku.quantity,
            description: `执行联动-退货入库`,
          },
        });
      }
    }
  }

  if (actions.includes("re_ship") || actions.includes("re_procure")) {
    if (ticket.waybillSnapshot) {
      const skuSummary = JSON.parse(ticket.waybillSnapshot.skuSummary || "[]") as Array<{ skuCode: string; quantity: number }>;
      for (const sku of skuSummary) {
        await prisma.inventoryRecord.create({
          data: {
            ticketId,
            skuCode: sku.skuCode,
            changeType: "outbound",
            quantity: sku.quantity,
            description: `执行联动-重新发货/采购`,
          },
        });
      }
    }
  }

  await prisma.exceptionTicket.update({
    where: { id: ticketId },
    data: { status: "completed" },
  });

  await unlockBatchForTicket(ticketId);
}

function getActionsForExceptionType(exceptionType: string): string[] {
  const { EXCEPTION_ACTION_MAP } = require("./constants");
  return EXCEPTION_ACTION_MAP[exceptionType] || [];
}

async function unlockBatchForTicket(ticketId: string) {
  await prisma.scanRecord.updateMany({
    where: { ticketId },
    data: {
      batchStatus: "normal_outbound",
      batchLocked: false,
    },
  });
}

export async function checkAndHandleTimeout() {
  const thresholds = await getThresholds();
  const now = new Date();

  const timeoutMinutes: Record<string, number> = {
    pending_approval: thresholds.approvalTimeout,
    approval_l1: thresholds.approvalTimeout,
    approval_l2: thresholds.approvalTimeout,
  };

  for (const [status, timeout] of Object.entries(timeoutMinutes)) {
    const cutoff = new Date(now.getTime() - timeout * 60 * 1000);
    const expiredTickets = await prisma.exceptionTicket.findMany({
      where: {
        status,
        updatedAt: { lt: cutoff },
      },
    });

    for (const ticket of expiredTickets) {
      if (status === "approval_l2") {
        await prisma.exceptionTicket.update({
          where: { id: ticket.id },
          data: { status: "auto_rejected" },
        });
      } else {
        await prisma.exceptionTicket.update({
          where: { id: ticket.id },
          data: { status: "approval_l2" },
        });
      }
    }
  }

  const qcHoldCutoff = new Date(now.getTime() - thresholds.qcHoldTimeout * 60 * 1000);
  const expiredQcHolds = await prisma.scanRecord.findMany({
    where: {
      batchStatus: "qc_hold",
      holdExpiresAt: { lt: now },
      ticketId: null,
    },
  });

  for (const record of expiredQcHolds) {
    // Force upgrade to L2 approval by creating a ticket
    await prisma.scanRecord.update({
      where: { id: record.id },
      data: { batchStatus: "qc_hold" },
    });
  }
}
