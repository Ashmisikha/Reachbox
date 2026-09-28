-- AlterEnum
ALTER TYPE "EmailStatus" ADD VALUE IF NOT EXISTS 'SUPPRESSED';

-- AlterTable
ALTER TABLE "email_messages" ADD COLUMN IF NOT EXISTS "step_id" UUID,
ADD COLUMN IF NOT EXISTS "is_permanent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_templates" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "campaign_events" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "campaign_steps" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "delay_days" INTEGER NOT NULL DEFAULT 0,
    "delay_hours" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "suppressions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppressions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_templates_user_id_idx" ON "email_templates"("user_id");
CREATE INDEX IF NOT EXISTS "email_templates_user_id_name_idx" ON "email_templates"("user_id", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "campaign_events_campaign_id_created_at_idx" ON "campaign_events"("campaign_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "campaign_steps_campaign_id_step_order_key" ON "campaign_steps"("campaign_id", "step_order");
CREATE INDEX IF NOT EXISTS "campaign_steps_campaign_id_idx" ON "campaign_steps"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "suppressions_user_id_email_key" ON "suppressions"("user_id", "email");
CREATE INDEX IF NOT EXISTS "suppressions_user_id_idx" ON "suppressions"("user_id");
CREATE INDEX IF NOT EXISTS "suppressions_user_id_email_idx" ON "suppressions"("user_id", "email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "email_messages_step_id_idx" ON "email_messages"("step_id");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "campaign_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "campaign_events" ADD CONSTRAINT "campaign_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "campaign_steps" ADD CONSTRAINT "campaign_steps_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "suppressions" ADD CONSTRAINT "suppressions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
