import { prisma } from "./prisma";
import { DEFAULT_CONFIG } from "./constants";

export async function seedDatabase() {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  const users = await Promise.all([
    prisma.user.create({ data: { username: "admin", password: "admin123", name: "管理员", role: "admin" } }),

    prisma.user.create({ data: { username: "approver1", password: "approver123", name: "审批员一", role: "approver_l1" } }),

    prisma.user.create({ data: { username: "approver2", password: "approver123", name: "审批员二", role: "approver_l2" } }),

    prisma.user.create({ data: { username: "qc_operator", password: "qc123", name: "品控员", role: "qc_operator" } }),

    prisma.user.create({ data: { username: "warehouse", password: "wh123", name: "仓管员", role: "warehouse" } }),
  ]);

  await prisma.qcRule.createMany({
    data: [
      { id: "1", ruleName: "包装破损检查", exceptionSubType: "package_damage", triggerCondition: "scan_inbound", severityLevel: "critical", autoCreateTicket: true, active: true },
      { id: "2", ruleName: "数量差异检查", exceptionSubType: "quantity_mismatch", triggerCondition: "scan_inbound", severityLevel: "major", autoCreateTicket: true, active: true },
      { id: "3", ruleName: "SKU合规检查", exceptionSubType: "sku_mismatch", triggerCondition: "scan_inbound", severityLevel: "critical", autoCreateTicket: true, active: true },
      { id: "4", ruleName: "批次标识检查", exceptionSubType: "batch_error", triggerCondition: "outbound", severityLevel: "minor", autoCreateTicket: false, active: true },
      { id: "5", ruleName: "时效检查", exceptionSubType: "timeout", triggerCondition: "scan_inbound", severityLevel: "major", autoCreateTicket: true, active: true },
    ],
  });

  await prisma.configRule.createMany({
    data: Object.entries(DEFAULT_CONFIG).map(([key, value]) => ({
      ruleKey: key,
      ruleValue: String(value),
      description: `${key} 配置`,
    })),
  });

  return users;
}
