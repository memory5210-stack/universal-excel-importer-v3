import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { DEFAULT_CONFIG } from "./constants";

export async function seedDatabase() {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  const password = await hashPassword("123456");

  const admin = await prisma.user.create({
    data: { username: "admin", password, name: "系统管理员", role: "admin" },
  });
  const qcSupervisor = await prisma.user.create({
    data: { username: "qc", password, name: "张三(品控主管)", role: "qc_supervisor" },
  });
  const approver1 = await prisma.user.create({
    data: { username: "approver1", password, name: "李四(一级审批)", role: "approver_l1" },
  });
  const approver2 = await prisma.user.create({
    data: { username: "approver2", password, name: "王五(二级审批)", role: "approver_l2" },
  });
  const reporter = await prisma.user.create({
    data: { username: "reporter", password, name: "赵六(操作员)", role: "reporter" },
  });

  const waybills = [];
  for (let i = 1; i <= 20; i++) {
    const wb = await prisma.waybillSnapshot.create({
      data: {
        waybillNo: `WB${String(i).padStart(8, "0")}`,
        senderInfo: JSON.stringify({ name: `寄件人${i}`, phone: `1380013800${i}`, address: `北京市朝阳区${i}号` }),
        receiverInfo: JSON.stringify({ name: `收件人${i}`, phone: `1390013900${i}`, address: `上海市浦东新区${i}号` }),
        totalAmount: Math.floor(Math.random() * 10000) + 100,
        skuSummary: JSON.stringify([
          { skuCode: `SKU-${i}-A`, skuName: `商品A-${i}`, quantity: Math.floor(Math.random() * 10) + 1 },
          { skuCode: `SKU-${i}-B`, skuName: `商品B-${i}`, quantity: Math.floor(Math.random() * 5) + 1 },
        ]),
        syncSource: "batch",
        syncedAt: new Date(),
      },
    });
    waybills.push(wb);
  }

  const exceptionTypes = ["lost_delivery", "damaged", "refused", "timeout", "wrong_address", "qty_mismatch", "appearance_damage", "label_error"];
  const statuses = ["pending_approval", "approval_l1", "approval_l2", "executing", "completed", "rejected"];
  const sources = ["manual_report", "scan_auto"];

  for (let i = 0; i < 200; i++) {
    const wb = waybills[i % waybills.length];
    const type = exceptionTypes[i % exceptionTypes.length];
    const source = sources[i % sources.length];
    const status = statuses[i % statuses.length];
    const isScanAuto = source === "scan_auto";

    const ticket = await prisma.exceptionTicket.create({
      data: {
        ticketNo: `EX${String(250706)}-${String(i + 1).padStart(4, "0")}`,
        ticketSource: source,
        exceptionType: type,
        severity: ["low", "medium", "high"][i % 3],
        description: `${type === "lost_delivery" ? "货物丢失" : type === "damaged" ? "货物破损" : type === "refused" ? "客户拒收" : type === "timeout" ? "超时未签收" : type === "wrong_address" ? "地址错误" : type === "qty_mismatch" ? "数量不符" : type === "appearance_damage" ? "外观破损" : "标签错误"} - 测试工单 #${i + 1}`,
        status,
        amount: Math.floor(Math.random() * 8000) + 50,
        waybillSnapshotId: wb.id,
        reporterId: reporter.id,
        currentApproverId: status === "approval_l1" ? approver1.id : status === "approval_l2" ? approver2.id : null,
      },
    });

    if (status === "completed" || status === "rejected") {
      await prisma.approvalRecord.create({
        data: {
          ticketId: ticket.id,
          approverId: approver1.id,
          approvalLevel: "l1",
          action: status === "completed" ? "approved" : "rejected",
          comment: status === "completed" ? "核实无误，审批通过" : "信息不完整，驳回",
          createdAt: new Date(Date.now() - 86400000),
        },
      });

      if (ticket.amount >= 500 && status === "completed") {
        await prisma.approvalRecord.create({
          data: {
            ticketId: ticket.id,
            approverId: approver2.id,
            approvalLevel: "l2",
            action: "approved",
            comment: "二级审批通过",
            createdAt: new Date(Date.now() - 43200000),
          },
        });
      }

      if (status === "completed") {
        await prisma.compensationRecord.create({
          data: {
            ticketId: ticket.id,
            amount: ticket.amount,
            direction: isScanAuto ? "from_supplier" : "to_customer",
            status: "completed",
            description: `自动生成-${isScanAuto ? "供应商追偿" : "客户赔付"}`,
          },
        });
      }
    }

    if (isScanAuto && (status === "executing" || status === "completed")) {
      await prisma.scanRecord.create({
        data: {
          waybillNo: wb.waybillNo,
          skuCode: `SKU-${(i % 20) + 1}-A`,
          operatorId: reporter.id,
          qcResult: "exception",
          qcDescription: `${type} - 品控扫描异常`,
          batchLocked: status !== "completed",
          batchStatus: status === "completed" ? "normal_outbound" : "qc_hold",
          ticketId: ticket.id,
          holdExpiresAt: status !== "completed" ? new Date(Date.now() + 30 * 60000) : null,
        },
      });
    }
  }

  await prisma.configRule.createMany({
    data: [
      { ruleKey: "approval_amount_threshold_l1", ruleValue: DEFAULT_CONFIG.APPROVAL_AMOUNT_THRESHOLD_L1.toString(), description: "一级审批金额上限" },
      { ruleKey: "approval_amount_threshold_l2", ruleValue: DEFAULT_CONFIG.APPROVAL_AMOUNT_THRESHOLD_L2.toString(), description: "二级审批金额下限" },
      { ruleKey: "approval_timeout_minutes", ruleValue: DEFAULT_CONFIG.APPROVAL_TIMEOUT_MINUTES.toString(), description: "审批超时时长(分钟)" },
      { ruleKey: "qc_hold_timeout_minutes", ruleValue: DEFAULT_CONFIG.QC_HOLD_TIMEOUT_MINUTES.toString(), description: "品控暂扣超时时长(分钟)" },
      { ruleKey: "max_reject_count", ruleValue: DEFAULT_CONFIG.MAX_REJECT_COUNT.toString(), description: "最大驳回次数" },
    ],
  });

  await prisma.qcRule.createMany({
    data: [
      { ruleName: "数量差异检测", exceptionSubType: "qty_mismatch", triggerCondition: JSON.stringify({ thresholdPercent: 5, operator: "gt" }), severityLevel: "medium", autoCreateTicket: true },
      { ruleName: "外观破损检测", exceptionSubType: "appearance_damage", triggerCondition: JSON.stringify({ minSeverity: 2, operator: "gte" }), severityLevel: "high", autoCreateTicket: true, autoApprovalLevel: "l2" },
      { ruleName: "规格不符检测", exceptionSubType: "spec_mismatch", triggerCondition: JSON.stringify({ deviationRange: "gt_10mm" }), severityLevel: "medium", autoCreateTicket: true },
      { ruleName: "标签错误检测", exceptionSubType: "label_error", triggerCondition: JSON.stringify({ barcodeMismatch: true }), severityLevel: "low", autoCreateTicket: true },
      { ruleName: "批次异常检测", exceptionSubType: "batch_abnormal", triggerCondition: JSON.stringify({ expiredDateCheck: true }), severityLevel: "high", autoCreateTicket: true, autoApprovalLevel: "l2" },
    ],
  });
}
