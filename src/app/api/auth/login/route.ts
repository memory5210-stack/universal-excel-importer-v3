import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSession, destroySession, requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }
    const user = await authenticateUser(username, password);
    if (!user) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }
    await createSession(user);
    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await requireAuth();
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "退出登录失败" }, { status: 500 });
  }
}
