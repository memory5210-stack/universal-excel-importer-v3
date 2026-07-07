import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateTicketNo, TICKET_STATUS, TICKET_SOURCE } from "@/lib/constants";
import { verifyWaybillExists, getWaybillDetail } from "@/lib/v2-api-client";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const status = searchParams.get("status") || undefined;
    const exceptionType = searchParams.get("exceptionType") || undefined;
    const waybillNo = searchParams.get("waybillNo") || undefined;
    const ticketSource = searchParams.get("ticketSource") || undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (exceptionType) where.exceptionType = exceptionType;
    if (ticketSource) where.ticketSource = ticketSource;
    if (waybillNo) {
      where.waybillSnapshot = { waybillNo };
    }

    const [tickets, total] = await Promise.all([
      prisma.exceptionTicket.findMany({
        where,
        include: {
          waybillSnapshot: true,
          reporter: { select: { id: true, name: true } },
          currentApprover: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.exceptionTicket.count({ where }),
    ]);

    return NextResponse.json({ tickets, total, page, pageSize });
  } catch (error) {
    return NextResponse.json({ error: "获取工单列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { waybillNo, exceptionType, description, amount } = await request.json();

    if (!waybillNo || !exceptionType || !description) {
      return NextResponse.json({ error: "运单号、异常类型和描述不能为空" }, { status: 400 });
    }

    const verifyResult = await verifyWaybillExists(waybillNo);
    if (!verifyResult.success) {
      return NextResponse.json({ error: `运单验证失败: ${verifyResult.error}` }, { status: 400 });
    }

    let waybillSnapshot = await prisma.waybillSnapshot.findUnique({ where: { waybillNo } });
    if (!waybillSnapshot) {
      const detailResult = await getWaybillDetail(waybillNo);
      if (!detailResult.success || !detailResult.data) {
        return NextResponse.json({ error: "获取运单详情失败" }, { status: 400 });
      }
      const data = detailResult.data;
      waybillSnapshot = await prisma.waybillSnapshot.create({
        data: {
          waybillNo: data.waybillNo,
          senderInfo: JSON.stringify({ name: data.senderName, address: data.senderAddress }),
          receiverInfo: JSON.stringify({ name: data.receiverName, address: data.receiverAddress }),
          totalAmount: data.totalAmount,
          skuSummary: JSON.stringify(data.skuList),
          syncSource: "realtime",
          syncedAt: new Date(),
        },
      });
    }

    const existingTicket = await prisma.exceptionTicket.findFirst({
      where: {
        waybillSnapshotId: waybillSnapshot.id,
        exceptionType,
        status: { notIn: ["completed", "auto_rejected"] },
      },
    });
    if (existingTicket) {
      return NextResponse.json({ error: "该运单存在相同类型的未关闭工单", existingTicketId: existingTicket.id }, { status: 409 });
    }

    const ticket = await prisma.exceptionTicket.create({
      data: {
        ticketNo: generateTicketNo(),
        ticketSource: TICKET_SOURCE.MANUAL_REPORT,
        exceptionType,
        severity: "medium",
        description,
        status: TICKET_STATUS.PENDING_APPROVAL,
        amount: amount || 0,
        waybillSnapshotId: waybillSnapshot.id,
        reporterId: user.id,
      },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "创建工单失败" }, { status: 500 });
  }
}
