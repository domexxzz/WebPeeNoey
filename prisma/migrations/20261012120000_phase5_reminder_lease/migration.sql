-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "expiryReminderClaimedAt" TIMESTAMP(3),
ADD COLUMN     "expiryReminderSentAt" TIMESTAMP(3);

