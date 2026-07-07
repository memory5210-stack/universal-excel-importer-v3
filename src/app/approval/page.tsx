"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PageLoading } from "@/components/common/Loading"
import { useToast } from "@/components/common/Toast"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"

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

const tabs = [
  { key: "pending", label: "待我审批" },
  { key: "done", label: "我已审批" },
  { key: "all", label: "全部" },
]

interface TicketItem {
  id: string
  ticketNo: string
  exceptionType: string
  status: string
  amount: number
  description: string
  createdAt: string
  updatedAt: string
  reporter: { name: string }
}

export default function ApprovalPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [tab, setTab] = useState("pending")
  const [tickets, setTickets] = useState<TicketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionTicket, setActionTicket] = useState<{ id: string; action: "approved" | "rejected" } | null>(null)
  const [comment, setComment] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/approval?tab=${tab}`)
      const data = await res.json()
      if (res.ok) {
        setTickets(data.tickets || [])
      }
    } catch {
      showToast("加载失败", "error")
    } finally {
      setLoading(false)
    }
  }, [tab, showToast])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  async function handleApproval() {
    if (!actionTicket) return
    setSubmitting(true)
    const currentTicket = tickets.find((t) => t.id === actionTicket.id)
    const approvalLevel = currentTicket?.status === "approval_l2" ? "l2" : "l1"
    const updatedAt = currentTicket?.updatedAt ?? null
    try {
      const res = await fetch(`/api/tickets/${actionTicket.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionTicket.action,
          comment,
          approvalLevel,
          updatedAt,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.transition?.message || (actionTicket.action === "approved" ? "审批通过" : "已驳回"), "success")
        setActionTicket(null)
        setComment("")
        fetchTickets()
      } else {
        showToast(data.error || "操作失败", "error")
      }
    } catch {
      showToast("网络错误", "error")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">审批管理</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">审批异常工单</p>
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b border-[var(--color-border)]">
        {tabs.map((t: { key: string; label: string }) => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoading />
      ) : (
        <div className="space-y-3">
          {tickets.map((t: TicketItem) => (
            <div key={t.id} className="content-card">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-sm font-semibold">{t.ticketNo}</span>
                      <span className={`status-badge ${t.status}`}>{statusLabels[t.status]}</span>
                      <span className="tag blue">{exceptionTypeLabels[t.exceptionType] || t.exceptionType}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                      <span>上报人: {t.reporter.name}</span>
                      <span>金额: ¥{t.amount.toFixed(2)}</span>
                      <span>{new Date(t.createdAt).toLocaleString("zh-CN")}</span>
                    </div>
                    <div className="mt-2 text-sm text-[var(--color-text-secondary)] line-clamp-2">{t.description}</div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      className="btn-primary text-xs py-1.5 px-3"
                      onClick={() => setActionTicket({ id: t.id, action: "approved" })}
                    >
                      通过
                    </button>
                    <button
                      className="btn-danger text-xs py-1.5 px-3"
                      onClick={() => setActionTicket({ id: t.id, action: "rejected" })}
                    >
                      驳回
                    </button>
                    <button
                      className="btn-secondary text-xs py-1.5 px-3"
                      onClick={() => router.push(`/tickets/${t.id}`)}
                    >
                      详情
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {tickets.length === 0 && (
            <div className="text-center py-16 text-[var(--color-text-secondary)] text-sm">暂无待审批工单</div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!actionTicket}
        title={actionTicket?.action === "approved" ? "确认审批通过" : "确认驳回"}
        message={
          <div>
            <p className="mb-3">{actionTicket?.action === "approved" ? "确认通过此工单？" : "确认驳回此工单？"}</p>
            <textarea
              className="input-field text-sm"
              placeholder="审批意见（可选）"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        }
        confirmText={actionTicket?.action === "approved" ? "通过" : "驳回"}
        variant={actionTicket?.action === "approved" ? "primary" : "danger"}
        onConfirm={handleApproval}
        onCancel={() => { setActionTicket(null); setComment("") }}
      />
    </div>
  )
}
