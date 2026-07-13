-- Site floor plans
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "floor_plan_url" TEXT;

-- Asset RFID + floor pins
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "rfid_tag" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "floor_pin_x" DOUBLE PRECISION;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "floor_pin_y" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "assets_tenant_id_rfid_tag_idx" ON "assets"("tenant_id", "rfid_tag");

-- Ticket CSAT / escalation
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "csat_comment" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "csat_at" TIMESTAMP(3);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "escalated_at" TIMESTAMP(3);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "escalation_level" INTEGER NOT NULL DEFAULT 0;

-- Patch rings
ALTER TABLE "patches" ADD COLUMN IF NOT EXISTS "deploy_ring" TEXT NOT NULL DEFAULT 'ALL';
ALTER TABLE "patches" ADD COLUMN IF NOT EXISTS "catalog_item_id" UUID;

-- Change SSDLC / CAB
ALTER TABLE "change_requests" ADD COLUMN IF NOT EXISTS "ssdlc_gates" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "change_requests" ADD COLUMN IF NOT EXISTS "uat_evidence" TEXT;
ALTER TABLE "change_requests" ADD COLUMN IF NOT EXISTS "vapt_evidence" TEXT;
ALTER TABLE "change_requests" ADD COLUMN IF NOT EXISTS "cab_meeting_id" UUID;

-- EAM
CREATE TABLE IF NOT EXISTS "maintenance_schedules" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "asset_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "schedule_type" TEXT NOT NULL DEFAULT 'CALENDAR',
  "cron_expression" TEXT,
  "interval_days" INTEGER,
  "condition_metric" TEXT,
  "condition_threshold" DOUBLE PRECISION,
  "next_due_at" TIMESTAMP(3),
  "last_completed_at" TIMESTAMP(3),
  "auto_create_wo" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "maintenance_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "maintenance_schedules_tenant_id_idx" ON "maintenance_schedules"("tenant_id");
CREATE INDEX IF NOT EXISTS "maintenance_schedules_tenant_id_next_due_at_idx" ON "maintenance_schedules"("tenant_id", "next_due_at");

CREATE TABLE IF NOT EXISTS "spare_parts" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
  "min_stock" INTEGER NOT NULL DEFAULT 0,
  "unit_cost" DECIMAL(12,2),
  "location" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "spare_parts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "spare_parts_tenant_id_sku_key" ON "spare_parts"("tenant_id", "sku");
CREATE INDEX IF NOT EXISTS "spare_parts_tenant_id_idx" ON "spare_parts"("tenant_id");

CREATE TABLE IF NOT EXISTS "spare_part_transactions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "spare_part_id" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "work_order_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "spare_part_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "spare_part_transactions_tenant_id_idx" ON "spare_part_transactions"("tenant_id");
CREATE INDEX IF NOT EXISTS "spare_part_transactions_spare_part_id_idx" ON "spare_part_transactions"("spare_part_id");

CREATE TABLE IF NOT EXISTS "consumables" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
  "reorder_point" INTEGER NOT NULL DEFAULT 0,
  "reorder_qty" INTEGER NOT NULL DEFAULT 0,
  "unit_cost" DECIMAL(12,2),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "consumables_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "consumables_tenant_id_sku_key" ON "consumables"("tenant_id", "sku");
CREATE INDEX IF NOT EXISTS "consumables_tenant_id_idx" ON "consumables"("tenant_id");

-- Business services
CREATE TABLE IF NOT EXISTS "business_services" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "criticality" TEXT NOT NULL DEFAULT 'MEDIUM',
  "owner_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'HEALTHY',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_services_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "business_services_tenant_id_idx" ON "business_services"("tenant_id");

CREATE TABLE IF NOT EXISTS "business_service_assets" (
  "id" UUID NOT NULL,
  "business_service_id" UUID NOT NULL,
  "asset_id" UUID NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'SUPPORTS',
  CONSTRAINT "business_service_assets_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "business_service_assets_business_service_id_asset_id_key" ON "business_service_assets"("business_service_id", "asset_id");

-- NetFlow / Syslog
CREATE TABLE IF NOT EXISTS "flow_records" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "exporter_ip" TEXT NOT NULL,
  "src_ip" TEXT NOT NULL,
  "dst_ip" TEXT NOT NULL,
  "src_port" INTEGER NOT NULL,
  "dst_port" INTEGER NOT NULL,
  "protocol" INTEGER NOT NULL,
  "bytes" BIGINT NOT NULL DEFAULT 0,
  "packets" BIGINT NOT NULL DEFAULT 0,
  "sampled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "flow_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "flow_records_tenant_id_sampled_at_idx" ON "flow_records"("tenant_id", "sampled_at");
CREATE INDEX IF NOT EXISTS "flow_records_tenant_id_bytes_idx" ON "flow_records"("tenant_id", "bytes");

CREATE TABLE IF NOT EXISTS "flow_rollups" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "window_start" TIMESTAMP(3) NOT NULL,
  "talker_ip" TEXT NOT NULL,
  "bytes_in" BIGINT NOT NULL DEFAULT 0,
  "bytes_out" BIGINT NOT NULL DEFAULT 0,
  "packets" BIGINT NOT NULL DEFAULT 0,
  "flows" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "flow_rollups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "flow_rollups_tenant_id_window_start_talker_ip_key" ON "flow_rollups"("tenant_id", "window_start", "talker_ip");
CREATE INDEX IF NOT EXISTS "flow_rollups_tenant_id_window_start_idx" ON "flow_rollups"("tenant_id", "window_start");

CREATE TABLE IF NOT EXISTS "syslog_events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID,
  "source_ip" TEXT NOT NULL,
  "facility" INTEGER,
  "severity" INTEGER,
  "message" TEXT NOT NULL,
  "ticket_id" UUID,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "syslog_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "syslog_events_tenant_id_received_at_idx" ON "syslog_events"("tenant_id", "received_at");
CREATE INDEX IF NOT EXISTS "syslog_events_source_ip_idx" ON "syslog_events"("source_ip");

-- CAB / Approvals / Email
CREATE TABLE IF NOT EXISTS "change_approvals" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "change_request_id" UUID NOT NULL,
  "approver_id" UUID NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "comment" TEXT,
  "decided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "change_approvals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "change_approvals_tenant_id_idx" ON "change_approvals"("tenant_id");
CREATE INDEX IF NOT EXISTS "change_approvals_change_request_id_idx" ON "change_approvals"("change_request_id");

CREATE TABLE IF NOT EXISTS "cab_meetings" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "location" TEXT,
  "agenda" JSONB NOT NULL DEFAULT '[]',
  "minutes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cab_meetings_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "cab_meetings_tenant_id_scheduled_at_idx" ON "cab_meetings"("tenant_id", "scheduled_at");

CREATE TABLE IF NOT EXISTS "email_ingest_configs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "host" TEXT NOT NULL,
  "port" INTEGER NOT NULL DEFAULT 993,
  "username" TEXT NOT NULL,
  "encrypted_pass" TEXT NOT NULL,
  "folder" TEXT NOT NULL DEFAULT 'INBOX',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_polled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_ingest_configs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "email_ingest_configs_tenant_id_idx" ON "email_ingest_configs"("tenant_id");

CREATE TABLE IF NOT EXISTS "patch_catalog_items" (
  "id" UUID NOT NULL,
  "tenant_id" UUID,
  "source" TEXT NOT NULL,
  "package_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT,
  "publisher" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patch_catalog_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "patch_catalog_items_source_package_id_version_key" ON "patch_catalog_items"("source", "package_id", "version");
CREATE INDEX IF NOT EXISTS "patch_catalog_items_tenant_id_idx" ON "patch_catalog_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "patch_catalog_items_name_idx" ON "patch_catalog_items"("name");

CREATE TABLE IF NOT EXISTS "patch_deploy_policies" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "pilot_asset_ids" JSONB NOT NULL DEFAULT '[]',
  "staged_asset_ids" JSONB NOT NULL DEFAULT '[]',
  "schedule_cron" TEXT,
  "auto_promote" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "patch_deploy_policies_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "patch_deploy_policies_tenant_id_idx" ON "patch_deploy_policies"("tenant_id");

CREATE TABLE IF NOT EXISTS "search_index_jobs" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "entity" TEXT NOT NULL,
  "entity_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "search_index_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "search_index_jobs_tenant_id_status_idx" ON "search_index_jobs"("tenant_id", "status");

-- FKs (idempotent via DO blocks)
DO $$ BEGIN
  ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "maintenance_schedules" ADD CONSTRAINT "maintenance_schedules_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "spare_parts" ADD CONSTRAINT "spare_parts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "spare_part_transactions" ADD CONSTRAINT "spare_part_transactions_spare_part_id_fkey" FOREIGN KEY ("spare_part_id") REFERENCES "spare_parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "consumables" ADD CONSTRAINT "consumables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_services" ADD CONSTRAINT "business_services_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_service_assets" ADD CONSTRAINT "business_service_assets_business_service_id_fkey" FOREIGN KEY ("business_service_id") REFERENCES "business_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "business_service_assets" ADD CONSTRAINT "business_service_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "flow_records" ADD CONSTRAINT "flow_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "flow_rollups" ADD CONSTRAINT "flow_rollups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "syslog_events" ADD CONSTRAINT "syslog_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "change_approvals" ADD CONSTRAINT "change_approvals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "change_approvals" ADD CONSTRAINT "change_approvals_change_request_id_fkey" FOREIGN KEY ("change_request_id") REFERENCES "change_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "cab_meetings" ADD CONSTRAINT "cab_meetings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "email_ingest_configs" ADD CONSTRAINT "email_ingest_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "patch_catalog_items" ADD CONSTRAINT "patch_catalog_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "patch_deploy_policies" ADD CONSTRAINT "patch_deploy_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "search_index_jobs" ADD CONSTRAINT "search_index_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Postgres RLS scaffolding (tenant isolation)
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "licenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alert_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "business_services" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "flow_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "maintenance_schedules" ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY assets_tenant_isolation ON "assets"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY tickets_tenant_isolation ON "tickets"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY users_tenant_isolation ON "users"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY licenses_tenant_isolation ON "licenses"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY alert_events_tenant_isolation ON "alert_events"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY business_services_tenant_isolation ON "business_services"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY flow_records_tenant_isolation ON "flow_records"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY maintenance_schedules_tenant_isolation ON "maintenance_schedules"
    USING (tenant_id::text = current_setting('app.current_tenant', true));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Bypass for migration/superuser roles; app connects as table owner so FORCE not set.
-- Application sets: SELECT set_config('app.current_tenant', '<uuid>', true);
