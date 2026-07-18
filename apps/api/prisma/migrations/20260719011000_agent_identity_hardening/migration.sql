CREATE TABLE "agent_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "token_jti" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "agent_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_enrollments_token_jti_key" ON "agent_enrollments"("token_jti");
CREATE INDEX "agent_enrollments_tenant_id_idx" ON "agent_enrollments"("tenant_id");
CREATE INDEX "agent_enrollments_tenant_id_revoked_at_idx" ON "agent_enrollments"("tenant_id", "revoked_at");

ALTER TABLE "agent_enrollments"
  ADD CONSTRAINT "agent_enrollments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agents" ADD COLUMN "enrollment_id" UUID;
CREATE UNIQUE INDEX "agents_enrollment_id_key" ON "agents"("enrollment_id");
ALTER TABLE "agents"
  ADD CONSTRAINT "agents_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "agent_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_enrollments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_agent_enrollments ON "agent_enrollments";
CREATE POLICY tenant_isolation_agent_enrollments ON "agent_enrollments"
  FOR ALL
  USING (app_rls_bypass() OR tenant_id = app_current_tenant())
  WITH CHECK (app_rls_bypass() OR tenant_id = app_current_tenant());
