"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/common/Toast"
import { ConfirmDialog } from "@/components/common/ConfirmDialog"

interface Props {
  ticketId: string
  status: string
  amount: number
  isEligibleApprover: boolean
}

export function TicketDetailClient({ ticketId, status, amount, isEligibleApprover }: Props) {
  const router = useRouter()
  const { showToast } = useToast()
  const [action, setAction] = useState<"approved" | "rejected" | null>(null)
  const [comment, setComment] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleApproval() {
    if (!action) return
    setSubmitting(true)
    try {
      const res = await fetch("/api/approval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, action, comment }),
      })
      const data = await res.json()
      if (res.ok) {
        showToast(data.message || "操作成功", "success")
        router.refresh()
      } else {
        showToast(data.error || "操作失败", "error")
      }
    } catch {
      showToast("网络错误", "error")
    } finally {
      setSubmitting(false)
      setShowConfirm(false)
      setAction(null)
      setComment("")
    }
  }

  const showApprovalActions = isEligibleApprover && (status === "pending_approval" || status === "approval_l1" || status === "approval_l2")

  return (
    <>
      <div className="flex gap-2">
        {showApprovalActions && (
          <>
            <button
              className="btn-primary text-sm"
              onClick={() => { setAction("approved"); setShowConfirm(true) }}
              disabled={submitting}
            >
              审批通过
            </button>
            <button
              className="btn-danger text-sm"
              onClick={() => { setAction("rejected"); setShowConfirm(true) }}
              disabled={submitting}
            >
              驳回
            </button>
          </>
        )}
      </div>

      <ConfirmDialog
        open={showConfirm}
        title={action === "approved" ? "确认审批通过" : "确认驳回"}
        message={
          <div>
            <p className="mb-3">{action === "approved" ? "确认通过此工单的审批申请？" : "确认驳回此工单？"}</p>
            <textarea
              className="input-field text-sm"
              placeholder="审批意见（可选）"
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
        }
        confirmText={action === "approved" ? "通过" : "驳回"}
        variant={action === "approved" ? "primary" : "danger"}
        onConfirm={handleApproval}
        onCancel={() => { setShowConfirm(false); setAction(null) }}
      />
    </>
  )
}
