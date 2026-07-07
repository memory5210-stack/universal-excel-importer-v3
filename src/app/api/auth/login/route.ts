import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, createSession, destroySession, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function autoSeed() {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  const password = await sha256("123456" + "v3-salt");

  await prisma.user.createMany({
    data: [
      { username: "admin", password, name: "系统管理员", role: "admin" },
      { username: "qc", password, name: "张三(品控主管)", role: "qc_supervisor" },
      { username: "approver1", password, name: "李四(一级审批)", role: "approver_l1" },
      { username: "approver2", password, name: "王五(二级审批)", role: "approver_l2" },
      { username: "reporter", password, name: "赵六(操作员)", role: "reporter" },
    ],
  });

  const waybills = [];
  for (let i = 1; i <= 20; i++) {
    const wb = await prisma.waybillSnapshot.create({
      data: {
        waybillNo: `WB${String(i).padStart(8, "0")}`,
        senderInfo: JSON.stringify({ name: `寄件人${i}`, phone: `1380013800${i}`, address: `北京市朝阳区${i}号` }),
        receiverInfo: JSON.stringify({ name: `收件人${i}`, phone: `1390013900${i}`, address: `上海市浦东新区${i}号` }),
        totalAmount: Math.floor(Math.random() * 10000) + 100,
        skuSummary: JSON.stringify([
          { skuCode: `SKU-${i}-A`, skuName: `商品A-${i}`, quantity: Math.floor(Math.random() * 10) + 1 },
          { skuCode: `SKU-${i}-B`, skuName: `商品B-${i}`, quantity: Math.floor(Math.random() * 5) + 1 },
        ]),
        syncSource: "batch",
        syncedAt: new Date(),
      },
    });
    waybills.push(wb);
  }

  const reporter = await prisma.user.findUnique({ where: { username: "reporter" }, select: { id: true } });
  const approver1 = await prisma.user.findUnique({ where: { username: "approver1" }, select: { id: true } });
  const approver2 = await prisma.user.findUnique({ where: { username: "approver2" }, select: { id: true } });

  if (reporter && approver1 && approver2) {
    const exceptionTypes = ["lost_delivery", "damaged", "refused", "timeout", "wrong_address", "qty_mismatch", "appearance_damage", "label_error"];
    const statuses = ["pending_approval", "approval_l1", "approval_l2", "executing", "completed", "rejected"];
    const sources = ["manual_report", "scan_auto"];

    for (let batch = 0; batch < 200; batch += 50) {
      const records = [];
      for (let i = batch; i < Math.min(batch + 50, 200); i++) {
        const wb = waybills[i % waybills.length];
        records.push({
          ticketNo: `EX${String(250707)}-${String(i + 1).padStart(4, "0")}`,
          ticketSource: sources[i % sources.length],
          exceptionType: exceptionTypes[i % exceptionTypes.length],
          severity: ["low", "medium", "high"][i % 3],
          description: `测试工单 #${i + 1}`,
          status: statuses[i % statuses.length],
          amount: Math.floor(Math.random() * 8000) + 50,
          waybillSnapshotId: wb.id,
          reporterId: reporter.id,
          currentApproverId: statuses[i % statuses.length] === "approval_l1" || statuses[i % statuses.length] === "approval_l2" ? approver1.id : null,
        });
      }
      await prisma.exceptionTicket.createMany({ data: records });
    }
  }

  await prisma.configRule.createMany({
    data: [
      { ruleKey: "approval_amount_threshold_l1", ruleValue: "500", description: "一级审批金额上限" },
      { ruleKey: "approval_amount_threshold_l2", ruleValue: "5000", description: "二级审批金额下限" },
      { ruleKey: "approval_timeout_minutes", ruleValue: "120", description: "审批超时时长(分钟)" },
      { ruleKey: "qc_hold_timeout_minutes", ruleValue: "30", description: "品控暂扣超时时长(分钟)" },
      { ruleKey: "max_reject_count", ruleValue: "3", description: "最大驳回次数" },
    ],
  });

  await prisma.qcRule.createMany({
    data: [
      { ruleName: "数量差异检测", exceptionSubType: "qty_mismatch", triggerCondition: JSON.stringify({ thresholdPercent: 5, operator: "gt" }), severityLevel: "medium", autoCreateTicket: true },
      { ruleName: "外观破损检测", exceptionSubType: "appearance_damage", triggerCondition: JSON.stringify({ minSeverity: 2, operator: "gte" }), severityLevel: "high", autoCreateTicket: true, autoApprovalLevel: "l2" },
      { ruleName: "规格不符检测", exceptionSubType: "spec_mismatch", triggerCondition: JSON.stringify({ deviationRange: "gt_10mm" }), severityLevel: "medium", autoCreateTicket: true },
      { ruleName: "标签错误检测", exceptionSubType: "label_error", triggerCondition: JSON.stringify({ barcodeMismatch: true }), severityLevel: "low", autoCreateTicket: true },
      { ruleName: "批次异常检测", exceptionSubType: "batch_abnormal", triggerCondition: JSON.stringify({ expiredDateCheck: true }), severityLevel: "high", autoCreateTicket: true, autoApprovalLevel: "l2" },
    ],
  });
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ error: "用户名和密码不能为空" }, { status: 400 });
    }

    await autoSeed();

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
