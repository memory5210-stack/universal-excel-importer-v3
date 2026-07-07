"use client"

import { useState, useEffect, useCallback } from "react"
import { PageLoading } from "@/components/common/Loading"

const directionLabels: Record<string, string> = {
  to_customer: "客户赔付",
  from_supplier: "供应商追偿",
}

const statusLabels: Record<string, string> = {
  pending: "待处理",
  completed: "已完成",
}

interface Compensation {
  id: string
  ticketNo: string
  amount: number
  direction: string
  status: string
  description: string | null
  createdAt: string
}

export default function CompensationPage() {
  const [records, setRecords] = useState<Compensation[]>([])
  const [loading, setLoading] = useState(true)
  const [direction, setDirection] = useState("")
  const [status, setStatus] = useState("")

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (direction) params.set("direction", direction)
      if (status) params.set("status", status)
      const res = await fetch(`/api/compensation?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setRecords(data.records || [])
      }
    } catch {}
    finally { setLoading(false) }
  }, [direction, status])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">赔付记录</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">查看和管理赔付/追偿记录</p>
        </div>
      </div>

      <div className="content-card mb-4">
        <div className="p-4 flex gap-3">
          <div className="min-w-[150px]">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">赔付方向</label>
            <select className="select-field text-sm" value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="">全部方向</option>
              <option value="to_customer">客户赔付</option>
              <option value="from_supplier">供应商追偿</option>
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">状态</label>
            <select className="select-field text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部状态</option>
              <option value="pending">待处理</option>
              <option value="completed">已完成</option>
            </select>
          </div>
          <button className="btn-primary text-sm py-2 self-end" onClick={fetchRecords}>查询</button>
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
                  <th className="table-header">工单号</th>
                  <th className="table-header">赔付方向</th>
                  <th className="table-header">金额</th>
                  <th className="table-header">状态</th>
                  <th className="table-header">描述</th>
                  <th className="table-header">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell font-mono text-xs font-medium">{r.ticketNo}</td>
                    <td className="table-cell">
                      <span className={`tag ${r.direction === "to_customer" ? "red" : "blue"}`}>
                        {directionLabels[r.direction] || r.direction}
                      </span>
                    </td>
                    <td className="table-cell font-medium">¥{r.amount.toFixed(2)}</td>
                    <td className="table-cell">
                      <span className={`status-badge ${r.status === "completed" ? "completed" : "pending_approval"}`}>
                        {statusLabels[r.status] || r.status}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-[var(--color-text-secondary)]">{r.description || "-"}</td>
                    <td className="table-cell text-xs text-[var(--color-text-secondary)]">
                      {new Date(r.createdAt).toLocaleString("zh-CN")}
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-cell text-center text-[var(--color-text-secondary)] py-12">暂无赔付记录</td>
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
