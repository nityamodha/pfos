-- CreateEnum
CREATE TYPE "AutomationSourceKind" AS ENUM ('GMAIL');

-- CreateEnum
CREATE TYPE "EmailProcessingStatus" AS ENUM ('PENDING', 'PROCESSED', 'IGNORED', 'ERROR');

-- CreateEnum
CREATE TYPE "TransactionProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'NEEDS_REVIEW');

-- CreateTable
CREATE TABLE "AutomationSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AutomationSourceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawFinancialEmail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "threadId" TEXT,
    "from" TEXT,
    "subject" TEXT,
    "snippet" TEXT,
    "bodyHash" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "processingStatus" "EmailProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RawFinancialEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawEmailId" TEXT,
    "status" "TransactionProposalStatus" NOT NULL DEFAULT 'PENDING',
    "kind" "TxnKind" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "note" TEXT,
    "categoryId" TEXT,
    "fromAccountId" TEXT,
    "toAccountId" TEXT,
    "merchantName" TEXT,
    "referenceText" TEXT,
    "confidence" DECIMAL(5,4),
    "extractionNotes" TEXT,
    "extractedPayload" JSONB,
    "approvedTransactionId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceId" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "matchJson" JSONB NOT NULL,
    "actionJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationSource_userId_idx" ON "AutomationSource"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationSource_userId_kind_externalAccountId_key" ON "AutomationSource"("userId", "kind", "externalAccountId");

-- CreateIndex
CREATE INDEX "RawFinancialEmail_userId_receivedAt_idx" ON "RawFinancialEmail"("userId", "receivedAt");

-- CreateIndex
CREATE INDEX "RawFinancialEmail_sourceId_processingStatus_idx" ON "RawFinancialEmail"("sourceId", "processingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "RawFinancialEmail_sourceId_externalMessageId_key" ON "RawFinancialEmail"("sourceId", "externalMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionProposal_approvedTransactionId_key" ON "TransactionProposal"("approvedTransactionId");

-- CreateIndex
CREATE INDEX "TransactionProposal_userId_status_date_idx" ON "TransactionProposal"("userId", "status", "date");

-- CreateIndex
CREATE INDEX "TransactionProposal_rawEmailId_idx" ON "TransactionProposal"("rawEmailId");

-- CreateIndex
CREATE INDEX "TransactionProposal_categoryId_idx" ON "TransactionProposal"("categoryId");

-- CreateIndex
CREATE INDEX "TransactionProposal_fromAccountId_idx" ON "TransactionProposal"("fromAccountId");

-- CreateIndex
CREATE INDEX "TransactionProposal_toAccountId_idx" ON "TransactionProposal"("toAccountId");

-- CreateIndex
CREATE INDEX "AutomationRule_userId_isActive_priority_idx" ON "AutomationRule"("userId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "AutomationRule_sourceId_idx" ON "AutomationRule"("sourceId");

-- AddForeignKey
ALTER TABLE "AutomationSource" ADD CONSTRAINT "AutomationSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawFinancialEmail" ADD CONSTRAINT "RawFinancialEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawFinancialEmail" ADD CONSTRAINT "RawFinancialEmail_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AutomationSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionProposal" ADD CONSTRAINT "TransactionProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionProposal" ADD CONSTRAINT "TransactionProposal_rawEmailId_fkey" FOREIGN KEY ("rawEmailId") REFERENCES "RawFinancialEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionProposal" ADD CONSTRAINT "TransactionProposal_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionProposal" ADD CONSTRAINT "TransactionProposal_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionProposal" ADD CONSTRAINT "TransactionProposal_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionProposal" ADD CONSTRAINT "TransactionProposal_approvedTransactionId_fkey" FOREIGN KEY ("approvedTransactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "AutomationSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
