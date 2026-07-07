import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const status = searchParams.get("status");

    let statusFilter: string[];
    if (user.role === "approver_l1") {
      statusFilter = ["pending_approval", "approval_l1"];
    } else if (user.role === "approver_l2") {
      statusFilter = ["approval_l2"];
    } else {
      statusFilter = [];
    }

    if (status) {
      statusFilter = statusFilter.filter((s) => s === status);
    }

    const where: any = {};
    if (statusFilter.length > 0) {
      where.status = { in: statusFilter };
    }

    const [total, tickets] = await Promise.all([
      prisma.exceptionTicket.count({ where }),
      prisma.exceptionTicket.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: "desc" },
        include: {
          waybillSnapshot: true,
          reporter: true,
          currentApprover: true,
        },
      }),
    ]);

    return NextResponse.json({ tickets, total, page, pageSize });
  } catch (error) {
    return NextResponse.json({ error: "获取审批列表失败" }, { status: 500 });
  }
}
