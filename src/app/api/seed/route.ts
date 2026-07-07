import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { seedDatabase } from "@/lib/seed";

export async function POST() {
  try {
    await requireRole("admin");
    await seedDatabase();
    return NextResponse.json({ success: true, message: "数据库初始化完成" });
  } catch (error) {
    return NextResponse.json({ error: "数据库初始化失败" }, { status: 500 });
  }
}
