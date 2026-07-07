-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WaybillSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waybillNo" TEXT NOT NULL,
    "senderInfo" TEXT NOT NULL,
    "receiverInfo" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "skuSummary" TEXT NOT NULL,
    "syncSource" TEXT NOT NULL,
    "syncedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestId" TEXT NOT NULL,
    "apiName" TEXT NOT NULL,
    "requestParams" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "isSuccess" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ExceptionTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketNo" TEXT NOT NULL,
    "ticketSource" TEXT NOT NULL,
    "exceptionType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rejectCount" INTEGER NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL DEFAULT 0,
    "waybillSnapshotId" TEXT,
    "reporterId" TEXT NOT NULL,
    "currentApproverId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExceptionTicket_waybillSnapshotId_fkey" FOREIGN KEY ("waybillSnapshotId") REFERENCES "WaybillSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ExceptionTicket_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExceptionTicket_currentApproverId_fkey" FOREIGN KEY ("currentApproverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScanRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "waybillNo" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "scanTime" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operatorId" TEXT NOT NULL,
    "qcResult" TEXT NOT NULL,
    "qcDescription" TEXT,
    "batchLocked" BOOLEAN NOT NULL DEFAULT false,
    "qcRuleId" TEXT,
    "qcRuleDetail" TEXT,
    "ticketId" TEXT,
    "batchStatus" TEXT NOT NULL,
    "holdExpiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScanRecord_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScanRecord_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ExceptionTicket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ScanRecord_qcRuleId_fkey" FOREIGN KEY ("qcRuleId") REFERENCES "QcRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QcRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleName" TEXT NOT NULL,
    "exceptionSubType" TEXT NOT NULL,
    "triggerCondition" TEXT NOT NULL,
    "severityLevel" TEXT NOT NULL,
    "autoCreateTicket" BOOLEAN NOT NULL DEFAULT true,
    "autoApprovalLevel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ApprovalRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "approvalLevel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApprovalRecord_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ExceptionTicket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApprovalRecord_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompensationRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "approvalRecordId" TEXT,
    "amount" REAL NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompensationRecord_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ExceptionTicket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CompensationRecord_approvalRecordId_fkey" FOREIGN KEY ("approvalRecordId") REFERENCES "ApprovalRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "skuCode" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryRecord_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ExceptionTicket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConfigRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleKey" TEXT NOT NULL,
    "ruleValue" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "WaybillSnapshot_waybillNo_key" ON "WaybillSnapshot"("waybillNo");

-- CreateIndex
CREATE UNIQUE INDEX "SyncLog_requestId_key" ON "SyncLog"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "ExceptionTicket_ticketNo_key" ON "ExceptionTicket"("ticketNo");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigRule_ruleKey_key" ON "ConfigRule"("ruleKey");
