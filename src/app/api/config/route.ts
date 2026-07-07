import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  try {
    await requireRole("admin", "qc_supervisor");
    const configs = await prisma.configRule.findMany({
      orderBy: { ruleKey: "asc" },
    });
    return NextResponse.json({ configs });
  } catch (error) {
    return NextResponse.json({ error: "获取配置列表失败" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole("admin", "qc_supervisor");
    const { id, ruleValue } = await request.json();

    if (!id || ruleValue === undefined) {
      return NextResponse.json({ error: "配置ID和值不能为空" }, { status: 400 });
    }

    const existing = await prisma.configRule.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "配置不存在" }, { status: 404 });
    }

    const config = await prisma.configRule.update({
      where: { id },
      data: { ruleValue: typeof ruleValue === "string" ? ruleValue : JSON.stringify(ruleValue) },
    });

    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json({ error: "更新配置失败" }, { status: 500 });
  }
}
