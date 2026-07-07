import { prisma } from "./prisma";
import { generateRequestId } from "./constants";

const V2_API_BASE = process.env.V2_API_BASE || "https://v2-api.example.com";
const V2_API_KEY = process.env.V2_API_KEY || "demo-key";
const REQUEST_TIMEOUT = Number(process.env.V2_API_TIMEOUT) || 10000;
const MAX_RETRIES = 2;

interface V2ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface SyncLogEntry {
  requestId: string;
  apiName: string;
  requestParams: string;
  responseStatus: number | null;
  isSuccess: boolean;
  errorMessage: string | null;
  durationMs: number;
}

async function logSync(entry: SyncLogEntry): Promise<void> {
  try {
    await prisma.syncLog.create({
      data: {
        requestId: entry.requestId,
        apiName: entry.apiName,
        requestParams: entry.requestParams,
        responseStatus: entry.responseStatus,
        isSuccess: entry.isSuccess,
        errorMessage: entry.errorMessage,
        durationMs: entry.durationMs,
      },
    });
  } catch {
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

async function callV2Api<T>(
  apiName: string,
  endpoint: string,
  params: Record<string, string> = {}
): Promise<V2ApiResponse<T>> {
  const requestId = generateRequestId();
  const startTime = Date.now();

  const url = new URL(`${V2_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([k, v]: [string, unknown]) => url.searchParams.set(k, v as string));

  let lastError: string | null = null;
  let responseStatus: number | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url.toString(),
        {
          headers: {
            "X-API-Key": V2_API_KEY,
            "X-Request-ID": requestId,
          },
        },
        REQUEST_TIMEOUT
      );
      responseStatus = response.status;

      if (!response.ok) {
        const text = await response.text();
        lastError = `V2 API ${response.status}: ${text.slice(0, 200)}`;
        if (response.status < 500) break;
        continue;
      }

      const data = await response.json();
      await logSync({
        requestId,
        apiName,
        requestParams: JSON.stringify(params),
        responseStatus,
        isSuccess: true,
        errorMessage: null,
        durationMs: Date.now() - startTime,
      });
      return { success: true, data: data as T };
    } catch (err: any) {
      lastError = err.name === "AbortError" ? `Timeout after ${REQUEST_TIMEOUT}ms` : err.message;
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  await logSync({
    requestId,
    apiName,
    requestParams: JSON.stringify(params),
    responseStatus,
    isSuccess: false,
    errorMessage: lastError,
    durationMs: Date.now() - startTime,
  });
  return { success: false, error: lastError || "Unknown error" };
}

export interface V2WaybillInfo {
  waybillNo: string;
  senderName: string;
  senderAddress: string;
  receiverName: string;
  receiverAddress: string;
  totalAmount: number;
  skuList: Array<{
    skuCode: string;
    skuName: string;
    quantity: number;
  }>;
  status: string;
  updatedAt: string;
}

export async function verifyWaybillExists(waybillNo: string): Promise<V2ApiResponse<V2WaybillInfo>> {
  return callV2Api<V2WaybillInfo>("verifyWaybill", "/api/v2/waybills/verify", { waybillNo });
}

export async function getWaybillDetail(waybillNo: string): Promise<V2ApiResponse<V2WaybillInfo>> {
  return callV2Api<V2WaybillInfo>("getWaybillDetail", "/api/v2/waybills/detail", { waybillNo });
}

export async function verifySkuBelongsToWaybill(waybillNo: string, skuCode: string): Promise<V2ApiResponse<{ valid: boolean }>> {
  return callV2Api<{ valid: boolean }>("verifySku", "/api/v2/waybills/verify-sku", { waybillNo, skuCode });
}

export async function syncWaybillList(page: number = 1, pageSize: number = 50): Promise<V2ApiResponse<{ list: V2WaybillInfo[]; total: number }>> {
  return callV2Api<{ list: V2WaybillInfo[]; total: number }>("syncWaybillList", "/api/v2/waybills/list", {
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
}

export function getV2ApiBase(): string {
  return V2_API_BASE;
}
