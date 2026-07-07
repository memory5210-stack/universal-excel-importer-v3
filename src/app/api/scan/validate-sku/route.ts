import { NextRequest, NextResponse } from "next/server";
import { verifySkuBelongsToWaybill } from "@/lib/v2-api-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const waybillNo = searchParams.get("waybillNo");
    const skuCode = searchParams.get("skuCode");
    if (!waybillNo || !skuCode) {
      return NextResponse.json({ valid: false, error: "waybillNo and skuCode are required" }, { status: 400 });
    }
    const result = await verifySkuBelongsToWaybill(waybillNo, skuCode);
    return NextResponse.json({ valid: result.success && result.data?.valid === true });
  } catch {
    return NextResponse.json({ valid: false, error: "Validation failed" }, { status: 500 });
  }
}
