import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { transitionTicketOnApproval, processExecution } from "@/lib/state-machine";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("approver_l1", "approver_l2");
    const { id } = await params;
    const { action, comment, approvalLevel, updatedAt } = await request.json();

    if (!action || !approvalLevel) {
      return NextResponse.json({ error: "审批动作和审批级别不能为空" }, { status: 400 });
    }
    if (!["approved", "rejected"].includes(action)) {
      return NextResponse.json({ error: "无效的审批动作" }, { status: 400 });
    }
    if (!["l1", "l2"].includes(approvalLevel)) {
      return NextResponse.json({ error: "无效的审批级别" }, { status: 400 });
    }

    const ticket = await prisma.exceptionTicket.findUnique({ where: { id } });
    if (!ticket) {
      return NextResponse.json({ error: "工单不存在" }, { status: 404 });
    }

    if (ticket.reporterId === user.id) {
      return NextResponse.json({ error: "不能审批自己创建的工单" }, { status: 403 });
    }

    if (updatedAt && new Date(updatedAt).getTime() !== ticket.updatedAt.getTime()) {
      return NextResponse.json({ error: "工单已被其他操作修改，请刷新后重试" }, { status: 409 });
    }

    const transition = await transitionTicketOnApproval(id, action, user.id, approvalLevel, comment);

    const record = await prisma.approvalRecord.create({
      data: {
        ticketId: id,
        approverId: user.id,
        approvalLevel,
        action,
        comment,
      },
    });

    if (action === "approved" && transition.newStatus === "executing") {
      await processExecution(id);
    }

    const updatedTicket = await prisma.exceptionTicket.findUnique({
      where: { id },
      include: {
        waybillSnapshot: true,
        reporter: true,
        currentApprover: true,
        approvalRecords: {
          include: { approver: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json({ ticket: updatedTicket, transition, approvalRecord: record });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "审批操作失败" }, { status: 500 });
  }
}
