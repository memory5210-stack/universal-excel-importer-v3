import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const direction = searchParams.get("direction");
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));

    const where: any = {};
    if (direction) where.direction = direction;
    if (status) where.status = status;

    const [total, records] = await Promise.all([
      prisma.compensationRecord.count({ where }),
      prisma.compensationRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: {
          ticket: { select: { ticketNo: true } },
          approvalRecord: { select: { approver: { select: { name: true } }, createdAt: true } },
        },
      }),
    ]);

    const formattedRecords = records.map((r) => ({
      id: r.id,
      ticketNo: r.ticket?.ticketNo || "-",
      amount: r.amount,
      direction: r.direction,
      status: r.status,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ records: formattedRecords, total, page, pageSize });
  } catch {
    return NextResponse.json({ error: "获取赔付记录失败" }, { status: 500 });
  }
}
