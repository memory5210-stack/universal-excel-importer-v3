"use client"

import { useState } from "react"
import { useToast } from "@/components/common/Toast"

interface ScanResult {
  scanRecord: {
    id: string
    waybillNo: string
    skuCode: string
    qcResult: string
    qcDescription: string | null
    batchLocked: boolean
    batchStatus: string
    holdExpiresAt: string | null
    qcRuleDetail: string | null
  }
  ticket: {
    id: string
    ticketNo: string
    exceptionType: string
    status: string
  } | null
  isDuplicateBatch: boolean
}

export default function ScanPage() {
  const { showToast } = useToast()
  const [waybillNo, setWaybillNo] = useState("")
  const [skuCode, setSkuCode] = useState("")
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [waybillValid, setWaybillValid] = useState<boolean | null>(null)
  const [skuValid, setSkuValid] = useState<boolean | null>(null)
  const [validating, setValidating] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)

  async function validateWaybill() {
    if (!waybillNo.trim()) return
    setValidating(true)
    setWaybillValid(null)
    try {
      const res = await fetch(`/api/scan/validate?waybillNo=${encodeURIComponent(waybillNo)}`)
      const data = await res.json()
      setWaybillValid(res.ok ? data.exists : false)
    } catch {
      setWaybillValid(false)
    } finally {
      setValidating(false)
    }
  }

  async function validateSku() {
    if (!waybillNo.trim() || !skuCode.trim()) return
    setValidating(true)
    setSkuValid(null)
    try {
      const res = await fetch(`/api/scan/validate-sku?waybillNo=${encodeURIComponent(waybillNo)}&skuCode=${encodeURIComponent(skuCode)}`)
      const data = await res.json()
      setSkuValid(res.ok ? data.valid : false)
    } catch {
      setSkuValid(false)
    } finally {
      setValidating(false)
    }
  }

  async function handleScan() {
    if (!waybillNo.trim() || !skuCode.trim()) {
      showToast("请填写运单号和SKU编号", "error")
      return
    }
    setScanning(true)
    setResult(null)
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waybillNo: waybillNo.trim(), skuCode: skuCode.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        showToast("扫描完成", "success")
      } else {
        showToast(data.error || "扫描失败", "error")
      }
    } catch {
      showToast("网络错误", "error")
    } finally {
      setScanning(false)
    }
  }

  async function loadHistory() {
    try {
      const res = await fetch("/api/scan/history")
      const data = await res.json()
      if (res.ok) {
        setHistory(data.records || [])
      }
    } catch {}
    setShowHistory(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">扫描录入</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">扫码进行品控检查</p>
        </div>
        <button className="btn-secondary text-sm" onClick={loadHistory}>
          查看扫描历史
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="content-card p-5">
          <h3 className="text-sm font-semibold mb-4">扫描操作</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">运单号</label>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="请输入或扫描运单号"
                  value={waybillNo}
                  onChange={(e) => { setWaybillNo(e.target.value); setWaybillValid(null); setSkuValid(null); setResult(null) }}
                  onBlur={validateWaybill}
                />
                {validating && <div className="flex items-center"><svg className="animate-spin h-5 w-5" style={{ color: "var(--color-primary)" }} viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>}
                {!validating && waybillValid === true && (
                  <div className="flex items-center text-[var(--color-accent-green)]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </div>
                )}
                {!validating && waybillValid === false && (
                  <div className="flex items-center text-[var(--color-accent-red)]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">SKU编号</label>
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="请输入SKU编号"
                  value={skuCode}
                  onChange={(e) => { setSkuCode(e.target.value); setSkuValid(null) }}
                  onBlur={validateSku}
                />
                {!validating && skuValid === true && (
                  <div className="flex items-center text-[var(--color-accent-green)]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  </div>
                )}
                {!validating && skuValid === false && (
                  <div className="flex items-center text-[var(--color-accent-red)]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  </div>
                )}
              </div>
            </div>

            <button className="btn-primary w-full py-2.5" onClick={handleScan} disabled={scanning || !waybillNo || !skuCode}>
              {scanning ? "扫描中..." : "扫描录入"}
            </button>
          </div>
        </div>

        <div className="content-card p-5">
          <h3 className="text-sm font-semibold mb-4">扫描结果</h3>
          {result ? (
            <div className="space-y-3">
              <div className={`p-4 rounded-lg ${result.scanRecord.qcResult === "pass" ? "bg-[#D1FAE5]" : "bg-[#FEE2E2]"}`}>
                <div className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: result.scanRecord.qcResult === "pass" ? "var(--color-accent-green)" : "var(--color-accent-red)" }}>
                  {result.scanRecord.qcResult === "pass" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  )}
                  {result.scanRecord.qcResult === "pass" ? "品控通过" : "品控异常"}
                </div>
                <div className="text-xs">{result.scanRecord.qcDescription || "-"}</div>
              </div>

              {result.isDuplicateBatch && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#FEF3C7", color: "#92400E" }}>
                  该批次已存在未关闭品控工单
                </div>
              )}

              {result.scanRecord.qcRuleDetail && (
                <div>
                  <span className="text-xs font-medium text-[var(--color-text-secondary)] block mb-1.5">匹配的品控规则</span>
                  <div className="text-xs p-3 rounded-lg bg-[var(--color-primary-light)]">
                    {result.scanRecord.qcRuleDetail}
                  </div>
                </div>
              )}

              {result.ticket && (
                <div className="p-3 rounded-lg" style={{ background: "var(--color-primary-light)" }}>
                  <div className="text-xs text-[var(--color-text-secondary)] mb-1">自动创建工单</div>
                  <div className="text-sm font-medium">{result.ticket.ticketNo}</div>
                  <div className="text-xs mt-1">
                    <span className={`status-badge ${result.ticket.status}`}>{result.ticket.status}</span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-[var(--color-border)]">
                <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
                  <span>批次状态</span>
                  <span className="tag gray">{result.scanRecord.batchStatus}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-secondary)]">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-3 opacity-50">
                <path d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
              </svg>
              <div className="text-sm">扫描后显示结果</div>
            </div>
          )}
        </div>
      </div>

      {showHistory && (
        <div className="content-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-semibold">扫描历史</h3>
            <button className="text-xs" style={{ color: "var(--color-primary)" }} onClick={() => setShowHistory(false)}>收起</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">运单号</th>
                  <th className="table-header">SKU编号</th>
                  <th className="table-header">结果</th>
                  <th className="table-header">批次状态</th>
                  <th className="table-header">描述</th>
                  <th className="table-header">时间</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r: any) => (
                  <tr key={r.id} className="table-row">
                    <td className="table-cell font-mono text-xs">{r.waybillNo}</td>
                    <td className="table-cell font-mono text-xs">{r.skuCode}</td>
                    <td className="table-cell">
                      <span className={`status-badge ${r.qcResult === "pass" ? "completed" : "rejected"}`}>
                        {r.qcResult === "pass" ? "通过" : "异常"}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="tag gray">{r.batchStatus}</span>
                    </td>
                    <td className="table-cell text-xs text-[var(--color-text-secondary)]">{r.qcDescription || "-"}</td>
                    <td className="table-cell text-xs text-[var(--color-text-secondary)]">{new Date(r.scanTime).toLocaleString("zh-CN")}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-cell text-center text-[var(--color-text-secondary)] py-8">暂无记录</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
