-- AlterTable
ALTER TABLE "slack_connections" ADD COLUMN     "bot_user_id" TEXT,
ADD COLUMN     "channel_id" TEXT,
ADD COLUMN     "channel_name" TEXT,
ADD COLUMN     "incoming_webhook_url" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'CONNECTED';

-- CreateIndex
CREATE INDEX "slack_connections_user_id_idx" ON "slack_connections"("user_id");

-- CreateIndex
CREATE INDEX "slack_connections_status_idx" ON "slack_connections"("status");
