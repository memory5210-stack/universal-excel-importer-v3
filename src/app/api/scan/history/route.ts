import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50")));

    const [total, records] = await Promise.all([
      prisma.scanRecord.count(),
      prisma.scanRecord.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { scanTime: "desc" },
        include: { operator: true, ticket: true, qcRule: true },
      }),
    ]);

    return NextResponse.json({ records, total, page, pageSize });
  } catch {
    return NextResponse.json({ error: "获取扫描历史失败" }, { status: 500 });
  }
}
