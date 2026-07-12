-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "statementDayOfMonth" INTEGER;

-- AlterTable
ALTER TABLE "AccountType" ADD COLUMN     "hasStatementCycle" BOOLEAN NOT NULL DEFAULT false;
