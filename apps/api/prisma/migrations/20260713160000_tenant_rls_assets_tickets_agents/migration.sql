-- Tenant RLS scaffolding (Phase 1 platform foundation)
-- App sets: SET LOCAL app.current_tenant = '<tenant uuid>';
-- Use PrismaService.withTenant() / setCurrentTenant() so policies apply.
-- Bypass for migrations/admin: SET LOCAL app.rls_bypass = 'on';
-- Superusers and table owners bypass RLS unless FORCE ROW LEVEL SECURITY.

-- Helper: current tenant from session GUC (empty => no rows for forced policies)
CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid AS $$
DECLARE
  raw text;
BEGIN
  raw := nullif(current_setting('app.current_tenant', true), '');
  IF raw IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN raw::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean AS $$
BEGIN
  RETURN coalesce(current_setting('app.rls_bypass', true), '') = 'on';
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE;

-- assets
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
-- No FORCE: owner role bypasses RLS (local Docker). Add FORCE when app uses a non-owner role.
DROP POLICY IF EXISTS tenant_isolation_assets ON assets;
CREATE POLICY tenant_isolation_assets ON assets
  FOR ALL
  USING (app_rls_bypass() OR tenant_id = app_current_tenant())
  WITH CHECK (app_rls_bypass() OR tenant_id = app_current_tenant());

-- tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_tickets ON tickets;
CREATE POLICY tenant_isolation_tickets ON tickets
  FOR ALL
  USING (app_rls_bypass() OR tenant_id = app_current_tenant())
  WITH CHECK (app_rls_bypass() OR tenant_id = app_current_tenant());

-- agents
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_agents ON agents;
CREATE POLICY tenant_isolation_agents ON agents
  FOR ALL
  USING (app_rls_bypass() OR tenant_id = app_current_tenant())
  WITH CHECK (app_rls_bypass() OR tenant_id = app_current_tenant());

COMMENT ON FUNCTION app_current_tenant() IS 'Reads app.current_tenant GUC set by PrismaService.withTenant';
COMMENT ON POLICY tenant_isolation_assets ON assets IS 'Tenant RLS — expand to more tables in later phases';
