-- EAM MaintenanceWorkOrder (PM auto work-orders)
CREATE TABLE IF NOT EXISTS "maintenance_work_orders" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "schedule_id" UUID,
  "asset_id" UUID NOT NULL,
  "work_order_number" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assigned_to_id" UUID,
  "due_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "maintenance_work_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_work_orders_tenant_id_work_order_number_key"
  ON "maintenance_work_orders"("tenant_id", "work_order_number");
CREATE INDEX IF NOT EXISTS "maintenance_work_orders_tenant_id_status_idx"
  ON "maintenance_work_orders"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "maintenance_work_orders_tenant_id_asset_id_idx"
  ON "maintenance_work_orders"("tenant_id", "asset_id");

DO $$ BEGIN
  ALTER TABLE "maintenance_work_orders"
    ADD CONSTRAINT "maintenance_work_orders_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "maintenance_work_orders"
    ADD CONSTRAINT "maintenance_work_orders_schedule_id_fkey"
    FOREIGN KEY ("schedule_id") REFERENCES "maintenance_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "maintenance_work_orders"
    ADD CONSTRAINT "maintenance_work_orders_asset_id_fkey"
    FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
