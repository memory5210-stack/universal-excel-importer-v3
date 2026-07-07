"use client"

import { useState, useEffect, useCallback } from "react"
import { PageLoading } from "@/components/common/Loading"

interface SyncLog {
  id: string
  requestId: string
  apiName: string
  requestParams: string
  responseStatus: number | null
  isSuccess: boolean
  errorMessage: string | null
  durationMs: number | null
  createdAt: string
}

export default function MonitoringPage() {
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [loading, setLoading] = useState(true)
  const [apiNameFilter, setApiNameFilter] = useState("")
  const [dateRange, setDateRange] = useState("today")
  const [stats, setStats] = useState({ todayTotal: 0, todaySuccess: 0, todayFail: 0, lastSyncTime: "" })

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (apiNameFilter) params.set("apiName", apiNameFilter)
      if (dateRange) params.set("dateRange", dateRange)

      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/sync-logs?${params.toString()}`),
        fetch("/api/sync-logs/stats"),
      ])
      if (logsRes.ok) {
        const data = await logsRes.json()
        setLogs(data.logs || [])
      }
      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch {}
    finally { setLoading(false) }
  }, [apiNameFilter, dateRange])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const successRate = stats.todayTotal > 0 ? Math.round((stats.todaySuccess / stats.todayTotal) * 100) : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">接口监控</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">V2 API 同步状态监控</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">最近同步时间</div>
          <div className="text-sm font-semibold">
            {stats.lastSyncTime ? new Date(stats.lastSyncTime).toLocaleString("zh-CN") : "暂无"}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">今日同步次数</div>
          <div className="text-lg font-bold">{stats.todayTotal}</div>
        </div>
        <div className="stat-card">
          <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">今日成功率</div>
          <div className={`text-lg font-bold ${successRate >= 90 ? "text-[var(--color-accent-green)]" : successRate >= 50 ? "text-[var(--color-accent-yellow)]" : "text-[var(--color-accent-red)]"}`}>
            {stats.todayTotal > 0 ? `${successRate}%` : "-"}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-1">今日失败</div>
          <div className="text-lg font-bold" style={{ color: "var(--color-accent-red)" }}>{stats.todayFail}</div>
        </div>
      </div>

      <div className="content-card mb-4">
        <div className="p-4 flex flex-wrap gap-3 items-end">
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">API名称</label>
            <input
              className="input-field text-sm"
              placeholder="筛选API名称"
              value={apiNameFilter}
              onChange={(e) => setApiNameFilter(e.target.value)}
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">时间范围</label>
            <select className="select-field text-sm" value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="today">今天</option>
              <option value="7d">最近7天</option>
              <option value="30d">最近30天</option>
              <option value="all">全部</option>
            </select>
          </div>
          <button className="btn-primary text-sm py-2" onClick={fetchLogs}>查询</button>
        </div>
      </div>

      <div className="content-card overflow-hidden">
        {loading ? (
          <PageLoading />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Request ID</th>
                  <th className="table-header">API名称</th>
                  <th className="table-header">请求参数</th>
                  <th className="table-header">状态码</th>
                  <th className="table-header">结果</th>
                  <th className="table-header">耗时</th>
                  <th className="table-header">错误信息</th>
                  <th className="table-header">时间</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: SyncLog) => (
                  <tr key={log.id} className="table-row" style={{ background: log.isSuccess ? undefined : "#FEF2F2" }}>
                    <td className="table-cell font-mono text-xs">{log.requestId.slice(0, 16)}...</td>
                    <td className="table-cell font-medium text-xs">{log.apiName}</td>
                    <td className="table-cell text-xs font-mono max-w-[120px] truncate">{log.requestParams}</td>
                    <td className="table-cell text-xs">{log.responseStatus || "-"}</td>
                    <td className="table-cell">
                      <span className={`status-badge ${log.isSuccess ? "completed" : "rejected"}`}>
                        {log.isSuccess ? "成功" : "失败"}
                      </span>
                    </td>
                    <td className="table-cell text-xs">{log.durationMs ? `${log.durationMs}ms` : "-"}</td>
                    <td className="table-cell text-xs max-w-[150px] truncate" style={{ color: "var(--color-accent-red)" }}>
                      {log.errorMessage || "-"}
                    </td>
                    <td className="table-cell text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString("zh-CN")}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="table-cell text-center text-[var(--color-text-secondary)] py-12">暂无同步日志</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
