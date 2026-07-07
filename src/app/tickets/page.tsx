"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { PageLoading } from "@/components/common/Loading"

const statusLabels: Record<string, string> = {
  pending_approval: "待审批",
  approval_l1: "一级审批中",
  approval_l2: "二级审批中",
  executing: "执行中",
  completed: "已完成",
  rejected: "已驳回",
  auto_rejected: "自动驳回",
}

const exceptionTypeLabels: Record<string, string> = {
  lost_delivery: "货物丢失",
  damaged: "货物破损",
  refused: "客户拒收",
  timeout: "超时未签收",
  wrong_address: "地址错误",
  qty_mismatch: "数量不符",
  appearance_damage: "外观破损",
  spec_mismatch: "规格不符",
  label_error: "标签错误",
  batch_abnormal: "批次异常",
}

const ticketSourceLabels: Record<string, string> = {
  scan_auto: "扫描自动",
  manual_report: "手动上报",
}

interface Ticket {
  id: string
  ticketNo: string
  ticketSource: string
  exceptionType: string
  severity: string
  description: string
  status: string
  amount: number
  createdAt: string
  reporter: { name: string }
  waybillSnapshot: { waybillNo: string } | null
}

export default function TicketsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const pageSize = 20

  const [filters, setFilters] = useState({
    status: searchParams.get("status") || "",
    exceptionType: searchParams.get("exceptionType") || "",
    waybillNo: searchParams.get("waybillNo") || "",
    ticketSource: searchParams.get("ticketSource") || "",
  })

  const totalPages = Math.ceil(total / pageSize)

  const fetchTickets = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", p.toString())
      params.set("pageSize", pageSize.toString())
      if (filters.status) params.set("status", filters.status)
      if (filters.exceptionType) params.set("exceptionType", filters.exceptionType)
      if (filters.waybillNo) params.set("waybillNo", filters.waybillNo)
      if (filters.ticketSource) params.set("ticketSource", filters.ticketSource)

      const res = await fetch(`/api/tickets?${params.toString()}`)
      const data = await res.json()
      if (res.ok) {
        setTickets(data.tickets)
        setTotal(data.total)
      }
    } catch (err) {
      console.error("Failed to fetch tickets", err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchTickets(page)
  }, [page, fetchTickets])

  function handleFilterChange(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  function handleRowClick(id: string) {
    router.push(`/tickets/${id}`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">异常工单</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">共 {total} 条记录</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-secondary)]">数据类型: 本地缓存</span>
        </div>
      </div>

      <div className="content-card mb-4">
        <div className="p-4 flex flex-wrap gap-3 items-end">
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">工单状态</label>
            <select className="select-field text-sm" value={filters.status} onChange={(e) => handleFilterChange("status", e.target.value)}>
              <option value="">全部状态</option>
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">异常类型</label>
            <select className="select-field text-sm" value={filters.exceptionType} onChange={(e) => handleFilterChange("exceptionType", e.target.value)}>
              <option value="">全部类型</option>
              {Object.entries(exceptionTypeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">运单号</label>
            <input className="input-field text-sm" placeholder="搜索运单号" value={filters.waybillNo} onChange={(e) => handleFilterChange("waybillNo", e.target.value)} />
          </div>
          <div className="min-w-[130px]">
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">来源</label>
            <select className="select-field text-sm" value={filters.ticketSource} onChange={(e) => handleFilterChange("ticketSource", e.target.value)}>
              <option value="">全部来源</option>
              {Object.entries(ticketSourceLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary text-sm py-2" onClick={() => fetchTickets(1)}>查询</button>
        </div>
      </div>

      <div className="content-card overflow-hidden">
        {loading ? (
          <PageLoading />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">工单号</th>
                    <th className="table-header">异常类型</th>
                    <th className="table-header">运单号</th>
                    <th className="table-header">金额</th>
                    <th className="table-header">状态</th>
                    <th className="table-header">来源</th>
                    <th className="table-header">上报人</th>
                    <th className="table-header">上报时间</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id} className="table-row cursor-pointer" onClick={() => handleRowClick(t.id)}>
                      <td className="table-cell font-mono text-xs font-medium">{t.ticketNo}</td>
                      <td className="table-cell">
                        <span className="tag blue">{exceptionTypeLabels[t.exceptionType] || t.exceptionType}</span>
                      </td>
                      <td className="table-cell font-mono text-xs">{t.waybillSnapshot?.waybillNo || "-"}</td>
                      <td className="table-cell">¥{t.amount.toFixed(2)}</td>
                      <td className="table-cell">
                        <span className={`status-badge ${t.status}`}>{statusLabels[t.status] || t.status}</span>
                      </td>
                      <td className="table-cell">
                        <span className="tag gray">{ticketSourceLabels[t.ticketSource] || t.ticketSource}</span>
                      </td>
                      <td className="table-cell">{t.reporter.name}</td>
                      <td className="table-cell text-xs text-[var(--color-text-secondary)]">
                        {new Date(t.createdAt).toLocaleString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="table-cell text-center text-[var(--color-text-secondary)] py-12">暂无工单数据</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  共 {total} 条，第 {page}/{totalPages} 页
                </span>
                <div className="flex gap-1">
                  <button className="pagination-btn" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 7) {
                      pageNum = i + 1
                    } else if (page <= 4) {
                      pageNum = i + 1
                    } else if (page >= totalPages - 3) {
                      pageNum = totalPages - 6 + i
                    } else {
                      pageNum = page - 3 + i
                    }
                    return (
                      <button key={pageNum} className={`pagination-btn ${pageNum === page ? "active" : ""}`} onClick={() => setPage(pageNum)}>
                        {pageNum}
                      </button>
                    )
                  })}
                  <button className="pagination-btn" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
