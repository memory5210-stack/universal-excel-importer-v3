"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push("/")
        router.refresh()
      } else {
        setError(data.error || "登录失败")
      }
    } catch {
      setError("网络错误，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: "var(--color-primary)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">运单异常品控管理系统</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">V3 · 请登录以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6">
          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm text-[var(--color-accent-red)]" style={{ background: "#FEF2F2" }}>
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">用户名</label>
            <input
              type="text"
              className="input-field"
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">密码</label>
            <input
              type="password"
              className="input-field"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
            {loading ? "登录中..." : "登 录"}
          </button>

          <div className="mt-4 p-3 rounded-lg text-xs" style={{ background: "var(--color-primary-light)", color: "var(--color-text-secondary)" }}>
            <div className="font-medium mb-1" style={{ color: "var(--color-primary-dark)" }}>测试账号</div>
            <div>管理员: admin / 123456</div>
            <div>品控主管: qc / 123456</div>
            <div>一级审批: approver1 / 123456</div>
            <div>操作员: reporter / 123456</div>
          </div>
        </form>
      </div>
    </div>
  )
}
