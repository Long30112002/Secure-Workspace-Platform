/*
  Warnings:

  - You are about to drop the column `sessionId` on the `AuditLog` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_sessionId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "sessionId";
