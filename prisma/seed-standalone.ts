import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./dev.db",
});

const prisma = new PrismaClient({ adapter });

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + "v3-salt");
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("Database already seeded.");
    return;
  }

  const password = await hashPassword("123456");

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

  const [{ id: reporterId }, { id: approver1Id }, { id: approver2Id }] = await Promise.all([
    prisma.user.findUnique({ where: { username: "reporter" }, select: { id: true } }),
    prisma.user.findUnique({ where: { username: "approver1" }, select: { id: true } }),
    prisma.user.findUnique({ where: { username: "approver2" }, select: { id: true } }),
  ]);

  if (!reporterId || !approver1Id || !approver2Id) {
    throw new Error("Users not found");
  }

  const exceptionTypes = ["lost_delivery", "damaged", "refused", "timeout", "wrong_address", "qty_mismatch", "appearance_damage", "label_error"];
  const statuses = ["pending_approval", "approval_l1", "approval_l2", "executing", "completed", "rejected"];
  const sources = ["manual_report", "scan_auto"];

  const batchSize = 50;
  for (let batch = 0; batch < 200; batch += batchSize) {
    const records = [];
    for (let i = batch; i < Math.min(batch + batchSize, 200); i++) {
      const wb = waybills[i % waybills.length];
      const type = exceptionTypes[i % exceptionTypes.length];
      const source = sources[i % sources.length];
      const status = statuses[i % statuses.length];

      records.push({
        ticketNo: `EX${String(250707)}-${String(i + 1).padStart(4, "0")}`,
        ticketSource: source,
        exceptionType: type,
        severity: ["low", "medium", "high"][i % 3],
        description: `测试工单 #${i + 1} - ${type}`,
        status,
        amount: Math.floor(Math.random() * 8000) + 50,
        waybillSnapshotId: wb.id,
        reporterId,
        currentApproverId: status === "approval_l1" || status === "approval_l2" ? approver1Id : null,
      });
    }
    await prisma.exceptionTicket.createMany({ data: records });
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

  console.log("Database seeded successfully!");
  console.log("Users: admin/123456, qc/123456, approver1/123456, approver2/123456, reporter/123456");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
