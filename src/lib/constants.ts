import { v4 as uuidv4 } from "uuid";

export const TICKET_SOURCE = {
  SCAN_AUTO: "scan_auto",
  MANUAL_REPORT: "manual_report",
} as const;

export const TICKET_STATUS = {
  PENDING_APPROVAL: "pending_approval",
  APPROVAL_L1: "approval_l1",
  APPROVAL_L2: "approval_l2",
  EXECUTING: "executing",
  COMPLETED: "completed",
  REJECTED: "rejected",
  AUTO_REJECTED: "auto_rejected",
} as const;

export const BATCH_STATUS = {
  SCANNING: "scanning",
  QC_HOLD: "qc_hold",
  NORMAL_OUTBOUND: "normal_outbound",
  QUICK_RELEASE: "quick_release",
} as const;

export const QC_RESULT = {
  PASS: "pass",
  EXCEPTION: "exception",
} as const;

export const COMPENSATION_DIRECTION = {
  TO_CUSTOMER: "to_customer",
  FROM_SUPPLIER: "from_supplier",
} as const;

export const USER_ROLE = {
  ADMIN: "admin",
  QC_SUPERVISOR: "qc_supervisor",
  APPROVER_L1: "approver_l1",
  APPROVER_L2: "approver_l2",
  REPORTER: "reporter",
} as const;

export const LOGISTICS_EXCEPTION_TYPES = {
  LOST_DELIVERY: "lost_delivery",
  DAMAGED: "damaged",
  REFUSED: "refused",
  TIMEOUT: "timeout",
  WRONG_ADDRESS: "wrong_address",
} as const;

export const QC_EXCEPTION_TYPES = {
  QTY_MISMATCH: "qty_mismatch",
  APPEARANCE_DAMAGE: "appearance_damage",
  SPEC_MISMATCH: "spec_mismatch",
  LABEL_ERROR: "label_error",
  BATCH_ABNORMAL: "batch_abnormal",
} as const;

export const EXCEPTION_ACTION_MAP: Record<string, string[]> = {
  lost_delivery: ["compensate", "re_ship"],
  damaged: ["compensate", "return"],
  refused: ["return", "restock"],
  timeout: ["re_ship"],
  wrong_address: ["re_ship"],
  qty_mismatch: ["return_to_supplier", "compensate_from_supplier"],
  appearance_damage: ["return_to_supplier", "compensate_from_supplier"],
  spec_mismatch: ["return_to_supplier", "re_procure"],
  label_error: ["quick_release", "re_label"],
  batch_abnormal: ["qc_hold", "return_to_supplier"],
};

export function generateTicketNo(): string {
  const date = new Date();
  const y = date.getFullYear().toString().slice(-2);
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const d = date.getDate().toString().padStart(2, "0");
  const seq = uuidv4().slice(0, 8).toUpperCase();
  return `EX${y}${m}${d}-${seq}`;
}

export function generateRequestId(): string {
  return `req-${uuidv4().slice(0, 12)}`;
}

export const DEFAULT_CONFIG = {
  APPROVAL_AMOUNT_THRESHOLD_L1: 500,
  APPROVAL_AMOUNT_THRESHOLD_L2: 5000,
  APPROVAL_TIMEOUT_MINUTES: 120,
  QC_HOLD_TIMEOUT_MINUTES: 30,
  MAX_REJECT_COUNT: 3,
  QC_QTY_MISMATCH_THRESHOLD_PERCENT: 5,
  QC_DAMAGE_SEVERITY_THRESHOLD: 2,
};
