import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth"
import { notFound } from "next/navigation"
import { TicketDetailClient } from "./TicketDetailClient"

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

const severityLabels: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "严重",
}

const severityColors: Record<string, string> = {
  low: "green",
  medium: "yellow",
  high: "red",
  critical: "red",
}

const ticketSourceLabels: Record<string, string> = {
  scan_auto: "扫描自动",
  manual_report: "手动上报",
}

const changeTypeLabels: Record<string, string> = {
  outbound: "出库",
  inbound: "入库",
  return: "退货",
  write_off: "核销",
}

const compensationDirectionLabels: Record<string, string> = {
  to_customer: "客户赔付",
  from_supplier: "供应商追偿",
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth()
  const { id } = await params

  const ticket = await prisma.exceptionTicket.findUnique({
    where: { id },
    include: {
      waybillSnapshot: true,
      reporter: true,
      currentApprover: true,
      approvalRecords: {
        include: { approver: true },
        orderBy: { createdAt: "desc" },
      },
      compensationRecords: true,
      inventoryRecords: true,
      scanRecords: {
        include: { operator: true },
        orderBy: { scanTime: "desc" },
      },
    },
  })

  if (!ticket) notFound()

  const waybillSnapshot = ticket.waybillSnapshot
  const skuSummary = waybillSnapshot ? JSON.parse(waybillSnapshot.skuSummary || "[]") as Array<{ skuCode: string; skuName: string; quantity: number }> : []

  const isEligibleApprover =
    (ticket.status === "pending_approval" || ticket.status === "approval_l1") &&
    (user.role === "approver_l1" || user.role === "admin") ||
    (ticket.status === "approval_l2" && (user.role === "approver_l2" || user.role === "admin"))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--color-text)]">{ticket.ticketNo}</h1>
            <span className={`status-badge ${ticket.status}`}>{statusLabels[ticket.status]}</span>
            <span className="tag gray">{ticketSourceLabels[ticket.ticketSource]}</span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            上报人: {ticket.reporter.name} | {new Date(ticket.createdAt).toLocaleString("zh-CN")}
          </p>
        </div>
        <TicketDetailClient ticketId={ticket.id} status={ticket.status} amount={ticket.amount} isEligibleApprover={isEligibleApprover} />
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="detail-section col-span-2">
          <div className="detail-section-header">运单信息</div>
          <div className="p-5 space-y-3">
            {waybillSnapshot ? (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-[var(--color-text-secondary)]">运单号</span>
                    <div className="text-sm font-mono font-medium">{waybillSnapshot.waybillNo}</div>
                  </div>
                  <div className="text-xs px-3 py-1.5 rounded-lg" style={{ background: waybillSnapshot.syncSource === "realtime" ? "#DBEAFE" : "#F1F5F9", color: waybillSnapshot.syncSource === "realtime" ? "#1E40AF" : "#475569" }}>
                    {waybillSnapshot.syncSource === "realtime" ? "实时获取自V2" : "本地缓存"}
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-secondary)]">
                  同步时间: {new Date(waybillSnapshot.syncedAt).toLocaleString("zh-CN")}
                </div>
                <div className="border-t border-[var(--color-border)] pt-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-[var(--color-text-secondary)] block mb-1">寄件人</span>
                      <div>{waybillSnapshot.senderInfo ? JSON.parse(waybillSnapshot.senderInfo).name : "-"}</div>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--color-text-secondary)] block mb-1">收件人</span>
                      <div>{waybillSnapshot.receiverInfo ? JSON.parse(waybillSnapshot.receiverInfo).name : "-"}</div>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--color-text-secondary)] block mb-1">寄件地址</span>
                      <div className="text-xs">{waybillSnapshot.senderInfo ? JSON.parse(waybillSnapshot.senderInfo).address : "-"}</div>
                    </div>
                    <div>
                      <span className="text-xs text-[var(--color-text-secondary)] block mb-1">收件地址</span>
                      <div className="text-xs">{waybillSnapshot.receiverInfo ? JSON.parse(waybillSnapshot.receiverInfo).address : "-"}</div>
                    </div>
                  </div>
                </div>
                <div className="border-t border-[var(--color-border)] pt-3">
                  <span className="text-xs text-[var(--color-text-secondary)] block mb-2">商品清单</span>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="py-1.5 text-left font-medium text-[var(--color-text-secondary)]">SKU编码</th>
                        <th className="py-1.5 text-left font-medium text-[var(--color-text-secondary)]">SKU名称</th>
                        <th className="py-1.5 text-right font-medium text-[var(--color-text-secondary)]">数量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skuSummary.map((sku: any, i: number) => (
                        <tr key={i} className="border-b border-[var(--color-border)]">
                          <td className="py-1.5 font-mono">{sku.skuCode}</td>
                          <td className="py-1.5">{sku.skuName}</td>
                          <td className="py-1.5 text-right">{sku.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-[var(--color-border)] pt-3 flex justify-between">
                  <span className="text-sm text-[var(--color-text-secondary)]">运单总金额</span>
                  <span className="text-sm font-bold">¥{waybillSnapshot.totalAmount.toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-[var(--color-text-secondary)]">未关联运单数据</div>
            )}
          </div>
        </div>

        <div className="detail-section">
          <div className="detail-section-header">异常详情</div>
          <div className="p-5 space-y-3">
            <div>
              <span className="text-xs text-[var(--color-text-secondary)] block mb-1">异常类型</span>
              <span className="tag blue">{exceptionTypeLabels[ticket.exceptionType] || ticket.exceptionType}</span>
            </div>
            <div>
              <span className="text-xs text-[var(--color-text-secondary)] block mb-1">严重程度</span>
              <span className={`tag ${severityColors[ticket.severity] || "gray"}`}>{severityLabels[ticket.severity] || ticket.severity}</span>
            </div>
            <div>
              <span className="text-xs text-[var(--color-text-secondary)] block mb-1">涉及金额</span>
              <div className="text-base font-bold">¥{ticket.amount.toFixed(2)}</div>
            </div>
            <div className="border-t border-[var(--color-border)] pt-3">
              <span className="text-xs text-[var(--color-text-secondary)] block mb-1">异常描述</span>
              <div className="text-sm">{ticket.description}</div>
            </div>
            {ticket.rejectCount > 0 && (
              <div className="border-t border-[var(--color-border)] pt-3">
                <span className="text-xs text-[var(--color-text-secondary)] block mb-1">驳回次数</span>
                <div className="text-sm font-medium" style={{ color: "var(--color-accent-red)" }}>{ticket.rejectCount} 次</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {ticket.approvalRecords.length > 0 && (
        <div className="detail-section mb-6">
          <div className="detail-section-header">审批记录</div>
          <div className="divide-y divide-[var(--color-border)]">
            {ticket.approvalRecords.map((record) => (
              <div key={record.id} className="p-4 flex items-start gap-4">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: record.action === "approved" ? "var(--color-accent-green)" : "var(--color-accent-red)" }}>
                  {record.action === "approved" ? "通" : "驳"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{record.approver.name}</span>
                    <span className={`tag ${record.approvalLevel === "l1" ? "blue" : "purple"}`}>
                      {record.approvalLevel === "l1" ? "一级审批" : "二级审批"}
                    </span>
                    <span className={`tag ${record.action === "approved" ? "green" : "red"}`}>
                      {record.action === "approved" ? "通过" : "驳回"}
                    </span>
                  </div>
                  {record.comment && <div className="text-sm text-[var(--color-text-secondary)]">{record.comment}</div>}
                  <div className="text-xs text-[var(--color-text-secondary)] mt-1">{new Date(record.createdAt).toLocaleString("zh-CN")}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ticket.compensationRecords.length > 0 && (
        <div className="detail-section mb-6">
          <div className="detail-section-header">赔付记录</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">赔付方向</th>
                  <th className="table-header">金额</th>
                  <th className="table-header">状态</th>
                  <th className="table-header">描述</th>
                  <th className="table-header">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {ticket.compensationRecords.map((cr) => (
                  <tr key={cr.id} className="table-row">
                    <td className="table-cell">
                      <span className={`tag ${cr.direction === "to_customer" ? "red" : "blue"}`}>
                        {compensationDirectionLabels[cr.direction] || cr.direction}
                      </span>
                    </td>
                    <td className="table-cell font-medium">¥{cr.amount.toFixed(2)}</td>
                    <td className="table-cell">
                      <span className={`status-badge ${cr.status === "completed" ? "completed" : "pending_approval"}`}>
                        {cr.status === "completed" ? "已完成" : "待处理"}
                      </span>
                    </td>
                    <td className="table-cell text-xs text-[var(--color-text-secondary)]">{cr.description || "-"}</td>
                    <td className="table-cell text-xs text-[var(--color-text-secondary)]">{new Date(cr.createdAt).toLocaleString("zh-CN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ticket.inventoryRecords.length > 0 && (
        <div className="detail-section mb-6">
          <div className="detail-section-header">库存变动记录</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">SKU编码</th>
                  <th className="table-header">变动类型</th>
                  <th className="table-header">数量</th>
                  <th className="table-header">描述</th>
                  <th className="table-header">时间</th>
                </tr>
              </thead>
              <tbody>
                {ticket.inventoryRecords.map((ir) => (
                  <tr key={ir.id} className="table-row">
                    <td className="table-cell font-mono text-xs">{ir.skuCode}</td>
                    <td className="table-cell">
                      <span className={`tag ${ir.changeType === "inbound" ? "green" : ir.changeType === "outbound" ? "blue" : ir.changeType === "return" ? "yellow" : "gray"}`}>
                        {changeTypeLabels[ir.changeType] || ir.changeType}
                      </span>
                    </td>
                    <td className="table-cell">{ir.quantity}</td>
                    <td className="table-cell text-xs text-[var(--color-text-secondary)]">{ir.description || "-"}</td>
                    <td className="table-cell text-xs text-[var(--color-text-secondary)]">{new Date(ir.createdAt).toLocaleString("zh-CN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ticket.scanRecords.length > 0 && (
        <div className="detail-section mb-6">
          <div className="detail-section-header">扫描记录</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">运单号</th>
                  <th className="table-header">SKU编码</th>
                  <th className="table-header">品控结果</th>
                  <th className="table-header">批次状态</th>
                  <th className="table-header">操作人</th>
                  <th className="table-header">扫描时间</th>
                </tr>
              </thead>
              <tbody>
                {ticket.scanRecords.map((sr) => (
                  <tr key={sr.id} className="table-row">
                    <td className="table-cell font-mono text-xs">{sr.waybillNo}</td>
                    <td className="table-cell font-mono text-xs">{sr.skuCode}</td>
                    <td className="table-cell">
                      <span className={`status-badge ${sr.qcResult === "pass" ? "completed" : "rejected"}`}>
                        {sr.qcResult === "pass" ? "通过" : "异常"}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="tag gray">{sr.batchStatus}</span>
                    </td>
                    <td className="table-cell">{sr.operator.name}</td>
                    <td className="table-cell text-xs text-[var(--color-text-secondary)]">{new Date(sr.scanTime).toLocaleString("zh-CN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
