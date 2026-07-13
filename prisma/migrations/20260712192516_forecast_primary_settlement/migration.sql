-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "settlementAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_settlementAccountId_fkey" FOREIGN KEY ("settlementAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
