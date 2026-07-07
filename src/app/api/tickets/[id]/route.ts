import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const ticket = await prisma.exceptionTicket.findUnique({
      where: { id },
      include: {
        waybillSnapshot: true,
        reporter: true,
        currentApprover: true,
        approvalRecords: { include: { approver: true }, orderBy: { createdAt: "desc" } },
        compensationRecords: true,
        inventoryRecords: true,
        scanRecords: { include: { operator: true } },
      },
    });
    if (!ticket) {
      return NextResponse.json({ error: "工单不存在" }, { status: 404 });
    }
    return NextResponse.json({ ticket });
  } catch (error) {
    return NextResponse.json({ error: "获取工单详情失败" }, { status: 500 });
  }
}
