-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "actorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "telegramLinkedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "summary" JSONB,
    "error" TEXT,
    "alertedAt" TIMESTAMP(3),

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramLinkToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRun_job_startedAt_idx" ON "JobRun"("job", "startedAt");

-- CreateIndex
CREATE INDEX "JobRun_status_startedAt_idx" ON "JobRun"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramLinkToken_tokenHash_key" ON "TelegramLinkToken"("tokenHash");

-- CreateIndex
CREATE INDEX "TelegramLinkToken_userId_idx" ON "TelegramLinkToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");

-- AddForeignKey
ALTER TABLE "TelegramLinkToken" ADD CONSTRAINT "TelegramLinkToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

