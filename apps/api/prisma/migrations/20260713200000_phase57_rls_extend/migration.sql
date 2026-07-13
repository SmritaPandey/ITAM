-- Extend tenant RLS to more enterprise tables (Phase 7)
-- Policies are idempotent via DROP IF EXISTS + CREATE

DO $$ BEGIN
  ALTER TABLE "agents" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patches" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_vulnerabilities" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "change_requests" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "software_catalog" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patch_deploy_policies" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "cab_meetings" ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS agents_tenant_isolation ON "agents";
  CREATE POLICY agents_tenant_isolation ON "agents"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS patches_tenant_isolation ON "patches";
  CREATE POLICY patches_tenant_isolation ON "patches"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS asset_vulns_tenant_isolation ON "asset_vulnerabilities";
  CREATE POLICY asset_vulns_tenant_isolation ON "asset_vulnerabilities"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS change_requests_tenant_isolation ON "change_requests";
  CREATE POLICY change_requests_tenant_isolation ON "change_requests"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS audit_logs_tenant_isolation ON "audit_logs";
  CREATE POLICY audit_logs_tenant_isolation ON "audit_logs"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS software_catalog_tenant_isolation ON "software_catalog";
  CREATE POLICY software_catalog_tenant_isolation ON "software_catalog"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS patch_policies_tenant_isolation ON "patch_deploy_policies";
  CREATE POLICY patch_policies_tenant_isolation ON "patch_deploy_policies"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS cab_meetings_tenant_isolation ON "cab_meetings";
  CREATE POLICY cab_meetings_tenant_isolation ON "cab_meetings"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
