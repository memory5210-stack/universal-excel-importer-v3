import { NextRequest, NextResponse } from "next/server";
import { verifyWaybillExists } from "@/lib/v2-api-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const waybillNo = searchParams.get("waybillNo");
    if (!waybillNo) {
      return NextResponse.json({ exists: false, error: "waybillNo is required" }, { status: 400 });
    }
    const result = await verifyWaybillExists(waybillNo);
    return NextResponse.json({ exists: result.success, data: result.data });
  } catch {
    return NextResponse.json({ exists: false, error: "Validation failed" }, { status: 500 });
  }
}
