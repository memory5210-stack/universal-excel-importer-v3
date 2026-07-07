import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import Link from "next/link"
export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const user = await requireAuth()

  const [totalTickets, pendingApproval, completed, rejected, recentSyncLogs, ticketStatusCounts] = await Promise.all([
    prisma.exceptionTicket.count(),
    prisma.exceptionTicket.count({ where: { status: { in: ["pending_approval", "approval_l1", "approval_l2"] } } }),
    prisma.exceptionTicket.count({ where: { status: "completed" } }),
    prisma.exceptionTicket.count({ where: { status: { in: ["rejected", "auto_rejected"] } } }),
    prisma.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.exceptionTicket.groupBy({ by: ["status"], _count: true }),
  ])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todaySyncSuccess = await prisma.syncLog.count({
    where: { createdAt: { gte: today }, isSuccess: true },
  })
  const todaySyncTotal = await prisma.syncLog.count({
    where: { createdAt: { gte: today } },
  })

  const stats = [
    { label: "总工单数", value: totalTickets, color: "var(--color-primary)", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
    { label: "待审批", value: pendingApproval, color: "var(--color-accent-yellow)", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
    { label: "已完成", value: completed, color: "var(--color-accent-green)", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
    { label: "已驳回", value: rejected, color: "var(--color-accent-red)", icon: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" },
  ]

  const statusLabels: Record<string, string> = {
    pending_approval: "待审批",
    approval_l1: "一级审批中",
    approval_l2: "二级审批中",
    executing: "执行中",
    completed: "已完成",
    rejected: "已驳回",
    auto_rejected: "自动驳回",
  }

  const statusColors: Record<string, string> = {
    pending_approval: "var(--color-accent-yellow)",
    approval_l1: "var(--color-accent-yellow)",
    approval_l2: "var(--color-accent-yellow)",
    executing: "var(--color-accent-blue)",
    completed: "var(--color-accent-green)",
    rejected: "var(--color-accent-red)",
    auto_rejected: "var(--color-accent-red)",
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">仪表盘</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">欢迎回来，{user.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/tickets?status=pending_approval" className="btn-primary text-sm">
            待审批工单
          </Link>
          <Link href="/scan" className="btn-secondary text-sm">
            扫描录入
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide">{s.label}</span>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d={s.icon} />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="content-card p-5">
          <h3 className="text-sm font-semibold mb-4">工单状态分布</h3>
          <div className="space-y-2.5">
            {ticketStatusCounts.map((t) => (
              <div key={t.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: statusColors[t.status] || "var(--color-text-secondary)" }} />
                  <span className="text-sm text-[var(--color-text)]">{statusLabels[t.status] || t.status}</span>
                </div>
                <span className="text-sm font-semibold">{t._count}</span>
              </div>
            ))}
            {ticketStatusCounts.length === 0 && (
              <div className="text-sm text-[var(--color-text-secondary)]">暂无数据</div>
            )}
          </div>
        </div>

        <div className="content-card p-5">
          <h3 className="text-sm font-semibold mb-4">快速操作</h3>
          <div className="space-y-2.5">
            <Link href="/tickets?source=manual" className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-primary-light)] transition-colors border border-[var(--color-border)]">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--color-primary-light)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4v16m8-8H4"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium">新建异常工单</div>
                <div className="text-xs text-[var(--color-text-secondary)]">手动上报运单异常</div>
              </div>
            </Link>
            <Link href="/scan" className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-primary-light)] transition-colors border border-[var(--color-border)]">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--color-primary-light)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium">扫描录入</div>
                <div className="text-xs text-[var(--color-text-secondary)]">扫码进行品控检查</div>
              </div>
            </Link>
            <Link href="/approval" className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--color-primary-light)] transition-colors border border-[var(--color-border)]">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--color-primary-light)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium">审批工单</div>
                <div className="text-xs text-[var(--color-text-secondary)]">审批待处理的异常工单</div>
              </div>
            </Link>
          </div>
        </div>

        <div className="content-card p-5">
          <h3 className="text-sm font-semibold mb-4">同步数据概览</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">今日同步成功率</span>
              <span className="text-sm font-semibold" style={{ color: todaySyncTotal > 0 && todaySyncSuccess / todaySyncTotal >= 0.9 ? "var(--color-accent-green)" : "var(--color-accent-red)" }}>
                {todaySyncTotal > 0 ? `${Math.round((todaySyncSuccess / todaySyncTotal) * 100)}%` : "无数据"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">今日同步次数</span>
              <span className="text-sm font-semibold">{todaySyncTotal}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">最近同步</span>
              <span className="text-sm text-[var(--color-text-secondary)]">
                {recentSyncLogs[0] ? new Date(recentSyncLogs[0].createdAt).toLocaleString("zh-CN") : "暂无"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold">最近同步日志</h3>
          <Link href="/monitoring" className="text-xs" style={{ color: "var(--color-primary)" }}>查看全部</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Request ID</th>
                <th className="table-header">API 名称</th>
                <th className="table-header">状态</th>
                <th className="table-header">耗时</th>
                <th className="table-header">时间</th>
              </tr>
            </thead>
            <tbody>
              {recentSyncLogs.map((log) => (
                <tr key={log.id} className="table-row">
                  <td className="table-cell font-mono text-xs">{log.requestId.slice(0, 16)}...</td>
                  <td className="table-cell">{log.apiName}</td>
                  <td className="table-cell">
                    <span className={`status-badge ${log.isSuccess ? "completed" : "rejected"}`}>
                      {log.isSuccess ? "成功" : "失败"}
                    </span>
                  </td>
                  <td className="table-cell">{log.durationMs ? `${log.durationMs}ms` : "-"}</td>
                  <td className="table-cell text-xs text-[var(--color-text-secondary)]">
                    {new Date(log.createdAt).toLocaleString("zh-CN")}
                  </td>
                </tr>
              ))}
              {recentSyncLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-cell text-center text-[var(--color-text-secondary)] py-8">暂无数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
