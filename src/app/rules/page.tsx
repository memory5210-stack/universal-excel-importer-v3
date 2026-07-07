"use client"

import { useState, useEffect, useCallback } from "react"
import { PageLoading } from "@/components/common/Loading"
import { useToast } from "@/components/common/Toast"

const severityLabels: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "严重",
}

interface QcRule {
  id: string
  ruleName: string
  exceptionSubType: string
  triggerCondition: string
  severityLevel: string
  autoCreateTicket: boolean
  autoApprovalLevel: string | null
  active: boolean
}

interface ConfigRule {
  id: string
  ruleKey: string
  ruleValue: string
  description: string | null
}

export default function RulesPage() {
  const { showToast } = useToast()
  const [qcRules, setQcRules] = useState<QcRule[]>([])
  const [configRules, setConfigRules] = useState<ConfigRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const [qcRes, cfgRes] = await Promise.all([
        fetch("/api/rules"),
        fetch("/api/config"),
      ])
      if (qcRes.ok) {
        const qcData = await qcRes.json()
        setQcRules(qcData.rules || [])
      }
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json()
        setConfigRules(cfgData.rules || [])
      }
    } catch { showToast("加载失败", "error") }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { fetchRules() }, [fetchRules])

  async function toggleRuleActive(ruleId: string, currentActive: boolean) {
    setSaving(ruleId)
    try {
      const res = await fetch(`/api/rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      })
      if (res.ok) {
        showToast(currentActive ? "规则已停用" : "规则已启用", "success")
        fetchRules()
      } else {
        const data = await res.json()
        showToast(data.error || "操作失败", "error")
      }
    } catch { showToast("网络错误", "error") }
    finally { setSaving(null) }
  }

  async function saveConfigRule(ruleId: string, value: string) {
    setSaving(ruleId)
    try {
      const res = await fetch(`/api/config/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleValue: value }),
      })
      if (res.ok) {
        showToast("配置已更新", "success")
        fetchRules()
      } else {
        const data = await res.json()
        showToast(data.error || "操作失败", "error")
      }
    } catch { showToast("网络错误", "error") }
    finally { setSaving(null) }
  }

  function parseCondition(conditionStr: string): string {
    try {
      const c = JSON.parse(conditionStr)
      return Object.entries(c).map(([k, v]) => `${k}: ${v}`).join(", ")
    } catch {
      return conditionStr
    }
  }

  if (loading) return <PageLoading />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">规则配置</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">品控规则与系统参数配置</p>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-base font-semibold mb-4">品控规则 (QC Rules)</h2>
        <div className="grid grid-cols-2 gap-4">
          {qcRules.map((rule) => (
            <div key={rule.id} className="content-card">
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold">{rule.ruleName}</h3>
                    <span className="tag blue text-xs mt-1 inline-block">{rule.exceptionSubType}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={rule.active}
                      onChange={() => toggleRuleActive(rule.id, rule.active)}
                      disabled={saving === rule.id}
                    />
                    <div className="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" style={{ background: rule.active ? "var(--color-primary)" : "#CBD5E1" }} />
                  </label>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">触发条件</span>
                    <span>{parseCondition(rule.triggerCondition)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">严重级别</span>
                    <span className={`tag ${rule.severityLevel === "high" || rule.severityLevel === "critical" ? "red" : rule.severityLevel === "medium" ? "yellow" : "green"}`}>
                      {severityLabels[rule.severityLevel] || rule.severityLevel}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">自动创建工单</span>
                    <span style={{ color: rule.autoCreateTicket ? "var(--color-accent-green)" : "var(--color-text-secondary)" }}>
                      {rule.autoCreateTicket ? "是" : "否"}
                    </span>
                  </div>
                  {rule.autoApprovalLevel && (
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-secondary)]">自动审批级别</span>
                      <span className="tag purple">{rule.autoApprovalLevel === "l1" ? "一级" : "二级"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold mb-4">系统参数配置</h2>
        <div className="grid grid-cols-2 gap-4">
          {configRules.map((cfg) => (
            <div key={cfg.id} className="content-card">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold mb-1">{cfg.description || cfg.ruleKey}</h3>
                    <div className="text-xs text-[var(--color-text-secondary)] mb-3">{cfg.ruleKey}</div>
                    <ConfigRuleEditor
                      rule={cfg}
                      onSave={saveConfigRule}
                      saving={saving === cfg.id}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConfigRuleEditor({ rule, onSave, saving }: { rule: ConfigRule; onSave: (id: string, value: string) => void; saving: boolean }) {
  const [value, setValue] = useState(rule.ruleValue)

  return (
    <div className="flex gap-2">
      <input
        className="input-field text-sm flex-1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        className="btn-primary text-xs py-1.5 px-3"
        disabled={saving || value === rule.ruleValue}
        onClick={() => onSave(rule.id, value)}
      >
        {saving ? "保存中..." : "更新"}
      </button>
    </div>
  )
}
