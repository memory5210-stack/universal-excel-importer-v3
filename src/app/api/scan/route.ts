import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { verifyWaybillExists, verifySkuBelongsToWaybill, getWaybillDetail } from "@/lib/v2-api-client";
import { generateTicketNo, TICKET_STATUS, TICKET_SOURCE, QC_RESULT, BATCH_STATUS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { waybillNo, skuCode, description } = await request.json();

    if (!waybillNo || !skuCode) {
      return NextResponse.json({ error: "运单号和SKU编码不能为空" }, { status: 400 });
    }

    const verifyResult = await verifyWaybillExists(waybillNo);
    if (!verifyResult.success) {
      return NextResponse.json({ error: `运单验证失败: ${verifyResult.error}` }, { status: 400 });
    }

    const skuVerify = await verifySkuBelongsToWaybill(waybillNo, skuCode);
    if (!skuVerify.success || !skuVerify.data?.valid) {
      return NextResponse.json({ error: "SKU不属于该运单" }, { status: 400 });
    }

    const activeRules = await prisma.qcRule.findMany({ where: { active: true } });

    let qcResult: string = QC_RESULT.PASS;
    let matchedRule: any = null;
    let qcDescription = description || "品控扫描通过";

    for (const rule of activeRules) {
      const condition = JSON.parse(rule.triggerCondition);
      if (rule.exceptionSubType === "qty_mismatch" && condition.thresholdPercent) {
        qcResult = QC_RESULT.EXCEPTION;
        matchedRule = rule;
        qcDescription = `数量差异检测触发: 阈值${condition.thresholdPercent}%`;
        break;
      }
      if (rule.exceptionSubType === "appearance_damage" && condition.minSeverity) {
        qcResult = QC_RESULT.EXCEPTION;
        matchedRule = rule;
        qcDescription = `外观破损检测触发: 严重度>=${condition.minSeverity}`;
        break;
      }
      if (rule.exceptionSubType === "label_error" && condition.barcodeMismatch) {
        qcResult = QC_RESULT.EXCEPTION;
        matchedRule = rule;
        qcDescription = "标签错误检测触发: 条码不匹配";
        break;
      }
      if (rule.exceptionSubType === "batch_abnormal" && condition.expiredDateCheck) {
        qcResult = QC_RESULT.EXCEPTION;
        matchedRule = rule;
        qcDescription = "批次异常检测触发: 过期日期检查";
        break;
      }
    }

    const latestScan = await prisma.scanRecord.findFirst({
      where: { waybillNo, batchStatus: { in: ["scanning", "qc_hold"] } },
      orderBy: { createdAt: "desc" },
    });

    let batchLocked = false;
    let batchStatus: string = BATCH_STATUS.SCANNING;
    let ticketId: string | null = null;
    let skipTicketCreation = false;

    if (latestScan && latestScan.batchStatus === "qc_hold" && latestScan.batchLocked) {
      const existingUnclosed = latestScan.ticketId
        ? await prisma.exceptionTicket.findFirst({
            where: { id: latestScan.ticketId, status: { in: ["pending_approval", "approval_l1", "approval_l2", "executing"] } },
          })
        : null;
      if (existingUnclosed) {
        skipTicketCreation = true;
      }
    }

    if (skipTicketCreation) {
      const scanRecord = await prisma.scanRecord.create({
        data: {
          waybillNo,
          skuCode,
          operatorId: user.id,
          qcResult: QC_RESULT.EXCEPTION,
          qcDescription: description || "同批次存在未关闭品控工单，仅追加扫描记录",
          batchLocked: true,
          batchStatus: BATCH_STATUS.QC_HOLD,
          ticketId: latestScan!.ticketId,
        },
      });
      return NextResponse.json({
        scanRecord,
        qcResult: QC_RESULT.EXCEPTION,
        batchStatus: BATCH_STATUS.QC_HOLD,
        batchLocked: true,
        warning: "该批次存在未关闭的品控工单，已追加扫描记录",
      });
    }

    if (qcResult === QC_RESULT.EXCEPTION) {
      batchStatus = BATCH_STATUS.QC_HOLD;
      batchLocked = true;

      let waybillSnapshot = await prisma.waybillSnapshot.findUnique({ where: { waybillNo } });
      if (!waybillSnapshot) {
        const detailResult = await getWaybillDetail(waybillNo);
        if (detailResult.success && detailResult.data) {
          const data = detailResult.data;
          waybillSnapshot = await prisma.waybillSnapshot.create({
            data: {
              waybillNo: data.waybillNo,
              senderInfo: JSON.stringify({ name: data.senderName, address: data.senderAddress }),
              receiverInfo: JSON.stringify({ name: data.receiverName, address: data.receiverAddress }),
              totalAmount: data.totalAmount,
              skuSummary: JSON.stringify(data.skuList),
              syncSource: "realtime",
              syncedAt: new Date(),
            },
          });
        }
      }

      const severity = matchedRule?.severityLevel || "medium";
      const ticket = await prisma.exceptionTicket.create({
        data: {
          ticketNo: generateTicketNo(),
          ticketSource: TICKET_SOURCE.SCAN_AUTO,
          exceptionType: matchedRule?.exceptionSubType || "batch_abnormal",
          severity,
          description: `品控扫描异常: ${qcDescription}`,
          status: matchedRule?.autoApprovalLevel === "l2" ? TICKET_STATUS.APPROVAL_L2 : TICKET_STATUS.PENDING_APPROVAL,
          amount: 0,
          waybillSnapshotId: waybillSnapshot?.id || null,
          reporterId: user.id,
        },
      });
      ticketId = ticket.id;
    } else {
      batchStatus = BATCH_STATUS.NORMAL_OUTBOUND;
      qcDescription = description || "品控扫描通过";
    }

    const scanRecord = await prisma.scanRecord.create({
      data: {
        waybillNo,
        skuCode,
        operatorId: user.id,
        qcResult,
        qcDescription,
        batchLocked,
        batchStatus,
        qcRuleId: matchedRule?.id || null,
        qcRuleDetail: matchedRule ? JSON.stringify(matchedRule) : null,
        ticketId,
      },
    });

    return NextResponse.json({
      scanRecord,
      qcResult,
      batchStatus,
      batchLocked,
      ticketId,
    });
  } catch (error) {
    return NextResponse.json({ error: "创建扫描记录失败" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
    const waybillNo = searchParams.get("waybillNo");
    const skuCode = searchParams.get("skuCode");
    const batchStatus = searchParams.get("batchStatus");
    const qcResult = searchParams.get("qcResult");

    const where: any = {};
    if (waybillNo) where.waybillNo = { contains: waybillNo };
    if (skuCode) where.skuCode = { contains: skuCode };
    if (batchStatus) where.batchStatus = batchStatus;
    if (qcResult) where.qcResult = qcResult;

    const [total, records] = await Promise.all([
      prisma.scanRecord.count({ where }),
      prisma.scanRecord.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
        include: { operator: true, ticket: true, qcRule: true },
      }),
    ]);

    return NextResponse.json({ records, total, page, pageSize });
  } catch (error) {
    return NextResponse.json({ error: "获取扫描记录失败" }, { status: 500 });
  }
}
