import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    await requireRole("admin", "qc_supervisor");
    const rules = await prisma.qcRule.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ rules });
  } catch (error) {
    return NextResponse.json({ error: "获取品控规则列表失败" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "qc_supervisor");
    const body = await request.json();
    const { ruleName, exceptionSubType, triggerCondition, severityLevel, autoCreateTicket, autoApprovalLevel, active } = body;

    if (!ruleName || !exceptionSubType || !triggerCondition) {
      return NextResponse.json({ error: "规则名称、异常子类型和触发条件不能为空" }, { status: 400 });
    }

    const rule = await prisma.qcRule.create({
      data: {
        ruleName,
        exceptionSubType,
        triggerCondition: typeof triggerCondition === "string" ? triggerCondition : JSON.stringify(triggerCondition),
        severityLevel: severityLevel || "medium",
        autoCreateTicket: autoCreateTicket ?? true,
        autoApprovalLevel: autoApprovalLevel || null,
        active: active ?? true,
      },
    });

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "创建品控规则失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole("admin", "qc_supervisor");
    const body = await request.json();
    const { id, ruleName, exceptionSubType, triggerCondition, severityLevel, autoCreateTicket, autoApprovalLevel, active } = body;

    if (!id) {
      return NextResponse.json({ error: "规则ID不能为空" }, { status: 400 });
    }

    const existing = await prisma.qcRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "规则不存在" }, { status: 404 });
    }

    const rule = await prisma.qcRule.update({
      where: { id },
      data: {
        ...(ruleName !== undefined && { ruleName }),
        ...(exceptionSubType !== undefined && { exceptionSubType }),
        ...(triggerCondition !== undefined && { triggerCondition: typeof triggerCondition === "string" ? triggerCondition : JSON.stringify(triggerCondition) }),
        ...(severityLevel !== undefined && { severityLevel }),
        ...(autoCreateTicket !== undefined && { autoCreateTicket }),
        ...(autoApprovalLevel !== undefined && { autoApprovalLevel }),
        ...(active !== undefined && { active }),
      },
    });

    return NextResponse.json({ rule });
  } catch (error) {
    return NextResponse.json({ error: "更新品控规则失败" }, { status: 500 });
  }
}
