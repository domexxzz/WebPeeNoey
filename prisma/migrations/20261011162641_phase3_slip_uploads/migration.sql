-- CreateTable
CREATE TABLE "SlipUpload" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlipUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlipUpload_hash_key" ON "SlipUpload"("hash");

-- CreateIndex
CREATE INDEX "SlipUpload_orderId_idx" ON "SlipUpload"("orderId");

-- AddForeignKey
ALTER TABLE "SlipUpload" ADD CONSTRAINT "SlipUpload_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
