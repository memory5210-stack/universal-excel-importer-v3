"use client"

import { useState, type ReactNode } from "react"

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string | ReactNode
  confirmText?: string
  cancelText?: string
  variant?: "primary" | "danger"
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmText = "确认", cancelText = "取消", variant = "primary", onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl border border-[var(--color-border)] w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-2">{title}</h3>
        <div className="text-sm text-[var(--color-text-secondary)] mb-6">{message}</div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary text-sm py-2 px-4" onClick={onCancel}>{cancelText}</button>
          <button className={variant === "danger" ? "btn-danger text-sm py-2 px-4" : "btn-primary text-sm py-2 px-4"} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
