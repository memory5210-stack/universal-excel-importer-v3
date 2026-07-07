import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { BATCH_STATUS } from "@/lib/constants";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("qc_supervisor");
    const { id } = await params;
    const { reason } = await request.json();

    if (!reason) {
      return NextResponse.json({ error: "快速放行原因不能为空" }, { status: 400 });
    }

    const scanRecord = await prisma.scanRecord.findUnique({
      where: { id },
      include: { ticket: true },
    });
    if (!scanRecord) {
      return NextResponse.json({ error: "扫描记录不存在" }, { status: 404 });
    }

    const updated = await prisma.scanRecord.update({
      where: { id },
      data: {
        batchStatus: BATCH_STATUS.QUICK_RELEASE,
        batchLocked: false,
      },
    });

    if (scanRecord.ticketId) {
      await prisma.approvalRecord.create({
        data: {
          ticketId: scanRecord.ticketId,
          approverId: user.id,
          approvalLevel: "l1",
          action: "quick_release",
          comment: `QC主管快速放行: ${reason}`,
        },
      });
    }

    if (scanRecord.ticketId) {
      const ticket = await prisma.exceptionTicket.findUnique({
        where: { id: scanRecord.ticketId },
      });
      if (ticket && ticket.status !== "completed" && ticket.status !== "rejected" && ticket.status !== "auto_rejected") {
        await prisma.exceptionTicket.update({
          where: { id: scanRecord.ticketId },
          data: { status: "completed" },
        });
      }
      await prisma.scanRecord.updateMany({
        where: { ticketId: scanRecord.ticketId },
        data: { batchStatus: BATCH_STATUS.QUICK_RELEASE, batchLocked: false },
      });
    }

    return NextResponse.json({ scanRecord: updated });
  } catch (error) {
    return NextResponse.json({ error: "快速放行操作失败" }, { status: 500 });
  }
}
