"use client"

import { useRouter } from "next/navigation"
import { useToast } from "@/components/common/Toast"
import type { SessionUser } from "@/lib/auth"

const roleLabels: Record<string, string> = {
  admin: "系统管理员",
  qc_supervisor: "品控主管",
  approver_l1: "一级审批",
  approver_l2: "二级审批",
  reporter: "操作员",
}

export function Header({ user }: { user: SessionUser }) {
  const router = useRouter()
  const { showToast } = useToast()

  async function handleLogout() {
    try {
      const res = await fetch("/api/auth/login", { method: "DELETE" })
      if (res.ok) {
        router.push("/login")
        router.refresh()
      } else {
        showToast("退出登录失败", "error")
      }
    } catch {
      showToast("网络错误", "error")
    }
  }

  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 bg-white border-b" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-[var(--color-text-secondary)]">
          欢迎回来
        </h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-secondary)]">{user.name}</span>
          <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: "var(--color-primary-light)", color: "var(--color-primary-dark)" }}>
            {roleLabels[user.role] || user.role}
          </span>
        </div>
        <button onClick={handleLogout} className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent-red)] transition-colors">
          退出登录
        </button>
      </div>
    </header>
  )
}
