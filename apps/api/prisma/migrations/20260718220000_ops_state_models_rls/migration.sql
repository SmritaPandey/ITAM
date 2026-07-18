-- Durable operational state + RLS coverage for new/recent tenant tables

CREATE TABLE IF NOT EXISTS "geofences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'circle',
  "center_lat" DOUBLE PRECISION,
  "center_lng" DOUBLE PRECISION,
  "radius_meters" DOUBLE PRECISION,
  "coordinates" JSONB NOT NULL DEFAULT '[]',
  "meta" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "geofences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "geofences_tenant_id_idx" ON "geofences"("tenant_id");
ALTER TABLE "geofences" ADD CONSTRAINT "geofences_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "geofence_vehicle_states" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "geofence_id" UUID NOT NULL,
  "vehicle_id" UUID NOT NULL,
  "is_inside" BOOLEAN NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "geofence_vehicle_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "geofence_vehicle_states_geofence_id_vehicle_id_key"
  ON "geofence_vehicle_states"("geofence_id", "vehicle_id");
CREATE INDEX IF NOT EXISTS "geofence_vehicle_states_tenant_id_idx" ON "geofence_vehicle_states"("tenant_id");
CREATE INDEX IF NOT EXISTS "geofence_vehicle_states_vehicle_id_idx" ON "geofence_vehicle_states"("vehicle_id");
ALTER TABLE "geofence_vehicle_states" ADD CONSTRAINT "geofence_vehicle_states_geofence_id_fkey"
  FOREIGN KEY ("geofence_id") REFERENCES "geofences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "nac_quarantines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "agent_id" UUID NOT NULL,
  "reason" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cleared_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nac_quarantines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "nac_quarantines_tenant_id_active_idx" ON "nac_quarantines"("tenant_id", "active");
CREATE INDEX IF NOT EXISTS "nac_quarantines_agent_id_active_idx" ON "nac_quarantines"("agent_id", "active");
ALTER TABLE "nac_quarantines" ADD CONSTRAINT "nac_quarantines_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nac_quarantines" ADD CONSTRAINT "nac_quarantines_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "software_policy_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "agent_id" UUID NOT NULL,
  "blacklist" JSONB NOT NULL DEFAULT '[]',
  "whitelist" JSONB NOT NULL DEFAULT '[]',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "software_policy_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "software_policy_snapshots_tenant_id_agent_id_key"
  ON "software_policy_snapshots"("tenant_id", "agent_id");
CREATE INDEX IF NOT EXISTS "software_policy_snapshots_tenant_id_idx" ON "software_policy_snapshots"("tenant_id");
ALTER TABLE "software_policy_snapshots" ADD CONSTRAINT "software_policy_snapshots_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "software_policy_snapshots" ADD CONSTRAINT "software_policy_snapshots_agent_id_fkey"
  FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill geofences from Tenant.settings.geofences when present
DO $$
DECLARE
  r RECORD;
  fence JSONB;
  fence_id UUID;
  ftype TEXT;
BEGIN
  FOR r IN SELECT id, settings FROM tenants WHERE settings ? 'geofences' LOOP
    FOR fence IN SELECT * FROM jsonb_array_elements(COALESCE(r.settings->'geofences', '[]'::jsonb)) LOOP
      fence_id := gen_random_uuid();
      ftype := COALESCE(fence->>'type', 'circle');
      INSERT INTO geofences (id, tenant_id, name, type, center_lat, center_lng, radius_meters, coordinates, meta, created_at, updated_at)
      VALUES (
        fence_id,
        r.id,
        COALESCE(fence->>'name', 'Geofence'),
        ftype,
        NULLIF(fence->'center'->>'lat', '')::double precision,
        NULLIF(fence->'center'->>'lng', '')::double precision,
        NULLIF(fence->>'radius', '')::double precision,
        COALESCE(fence->'coordinates', '[]'::jsonb),
        jsonb_build_object('legacyId', fence->>'id'),
        COALESCE((fence->>'createdAt')::timestamptz, NOW()),
        NOW()
      );
    END LOOP;
  END LOOP;
END $$;

-- RLS for new + previously uncovered tenant tables
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'geofences',
    'geofence_vehicle_states',
    'nac_quarantines',
    'software_policy_snapshots',
    'ai_interaction_logs',
    'data_subject_requests',
    'search_index_jobs',
    'email_ingest_configs',
    'nac_vlan_policies',
    'nac_network_segments',
    'nac_radius_configs',
    'spare_parts',
    'consumables',
    'maintenance_work_orders',
    'gps_telemetries',
    'trips'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%s ON %I', t, t);
      EXECUTE format(
        'CREATE POLICY tenant_isolation_%s ON %I FOR ALL USING (app_rls_bypass() OR tenant_id = app_current_tenant()) WITH CHECK (app_rls_bypass() OR tenant_id = app_current_tenant())',
        t, t
      );
    END IF;
  END LOOP;
END $$;
