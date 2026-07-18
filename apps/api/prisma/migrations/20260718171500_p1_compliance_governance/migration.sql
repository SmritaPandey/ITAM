CREATE TABLE "ai_interaction_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "endpoint" TEXT NOT NULL,
    "prompt_hash" TEXT NOT NULL,
    "prompt_chars" INTEGER NOT NULL,
    "response_chars" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "tools_used" JSONB NOT NULL DEFAULT '[]',
    "latency_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_interaction_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_interaction_logs_tenant_id_created_at_idx"
    ON "ai_interaction_logs"("tenant_id", "created_at");
CREATE INDEX "ai_interaction_logs_user_id_idx"
    ON "ai_interaction_logs"("user_id");

CREATE TABLE "data_subject_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subject_email" TEXT NOT NULL,
    "details" TEXT,
    "resolution" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "data_subject_requests_tenant_id_created_at_idx"
    ON "data_subject_requests"("tenant_id", "created_at");
CREATE INDEX "data_subject_requests_tenant_id_status_idx"
    ON "data_subject_requests"("tenant_id", "status");
