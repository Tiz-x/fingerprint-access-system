-- CreateTable
CREATE TABLE "AdminAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "details" TEXT
);

-- CreateIndex
CREATE INDEX "AdminAudit_timestamp_idx" ON "AdminAudit"("timestamp");
