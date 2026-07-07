import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    await requireAuth();

    const [
      totalTickets,
      byStatus,
      byExceptionType,
      pendingApproval,
      recentSyncLogs,
    ] = await Promise.all([
      prisma.exceptionTicket.count(),
      prisma.exceptionTicket.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.exceptionTicket.groupBy({
        by: ["exceptionType"],
        _count: { id: true },
      }),
      prisma.exceptionTicket.count({
        where: { status: { in: ["pending_approval", "approval_l1", "approval_l2"] } },
      }),
      prisma.syncLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      totalTickets,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      byExceptionType: byExceptionType.map((e) => ({ exceptionType: e.exceptionType, count: e._count.id })),
      pendingApproval,
      recentSyncLogs,
    });
  } catch (error) {
    return NextResponse.json({ error: "获取仪表盘统计数据失败" }, { status: 500 });
  }
}
