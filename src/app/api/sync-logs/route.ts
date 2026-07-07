import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const isSuccess = searchParams.get("isSuccess");

    const where: any = {};
    if (isSuccess === "true") where.isSuccess = true;
    else if (isSuccess === "false") where.isSuccess = false;

    const [total, logs] = await Promise.all([
      prisma.syncLog.count({ where }),
      prisma.syncLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ logs, total, page, pageSize });
  } catch (error) {
    return NextResponse.json({ error: "获取同步日志失败" }, { status: 500 });
  }
}
