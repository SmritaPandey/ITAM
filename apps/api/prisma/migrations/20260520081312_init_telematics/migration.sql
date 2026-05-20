-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TenantPlan" AS ENUM ('STARTER', 'PROFESSIONAL', 'ENTERPRISE', 'ON_PREMISE');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED', 'PENDING');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('DISCOVERED', 'ACTIVE', 'IN_MAINTENANCE', 'IN_STORAGE', 'RESERVED', 'RETIRED', 'DISPOSED', 'LOST', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "DiscoverySource" AS ENUM ('AGENT', 'SNMP', 'WMI', 'SSH', 'NETWORK_SCAN', 'CLOUD_AWS', 'CLOUD_AZURE', 'CLOUD_GCP', 'ACTIVE_DIRECTORY', 'MANUAL', 'CSV_IMPORT', 'API', 'ONVIF');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('DEPENDS_ON', 'COMPONENT_OF', 'CONNECTED_TO', 'RUNS_ON', 'USED_BY', 'BACKUP_OF');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('INCIDENT', 'PROBLEM', 'CHANGE', 'SERVICE_REQUEST', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'OPEN', 'IN_PROGRESS', 'PENDING', 'ON_HOLD', 'RESOLVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('PING_SWEEP', 'ARP_SCAN', 'PORT_SCAN', 'TCP_PORT_SCAN', 'SNMP_DISCOVERY', 'FULL_SCAN');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('PER_SEAT', 'PER_DEVICE', 'SITE', 'ENTERPRISE', 'SUBSCRIPTION', 'CONCURRENT', 'OPEN_SOURCE');

-- CreateEnum
CREATE TYPE "LicenseModel" AS ENUM ('PERPETUAL', 'ANNUAL', 'MONTHLY', 'USAGE_BASED', 'FREEMIUM');

-- CreateEnum
CREATE TYPE "RuleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DRAFT');

-- CreateEnum
CREATE TYPE "MonitoredDeviceType" AS ENUM ('CAMERA', 'NETWORK_DEVICE', 'VIRTUAL_MACHINE');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "plan" "TenantPlan" NOT NULL DEFAULT 'STARTER',
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "logo_url" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "zip_code" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "is_hq" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "site_id" UUID,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parent_id" UUID,
    "cost_center" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "department_id" UUID,
    "site_id" UUID,
    "role_id" UUID NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verify_token" TEXT,
    "email_verify_expiry" TIMESTAMP(3),
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "oauth_provider" TEXT,
    "oauth_provider_id" TEXT,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" UUID,
    "actor_ip" TEXT,
    "actor_agent" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "resource_name" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
    "module" TEXT NOT NULL,
    "hash" TEXT,
    "prev_hash" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_types" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" UUID,
    "icon" TEXT,
    "color" TEXT,
    "is_it_asset" BOOLEAN NOT NULL DEFAULT true,
    "custom_fields_schema" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_type_id" UUID NOT NULL,
    "asset_tag" TEXT,
    "name" TEXT NOT NULL,
    "serial_number" TEXT,
    "barcode" TEXT,
    "category" TEXT,
    "sub_category" TEXT,
    "manufacturer" TEXT,
    "model" TEXT,
    "site_id" UUID,
    "department_id" UUID,
    "floor" TEXT,
    "room" TEXT,
    "rack" TEXT,
    "position" TEXT,
    "assigned_to_id" UUID,
    "managed_by_id" UUID,
    "status" "AssetStatus" NOT NULL DEFAULT 'DISCOVERED',
    "procurement_date" TIMESTAMP(3),
    "deployment_date" TIMESTAMP(3),
    "warranty_expiry" TIMESTAMP(3),
    "eol_date" TIMESTAMP(3),
    "disposal_date" TIMESTAMP(3),
    "purchase_price" DECIMAL(12,2),
    "current_value" DECIMAL(12,2),
    "salvage_value" DECIMAL(12,2),
    "useful_life_months" INTEGER,
    "depreciation_method" TEXT,
    "po_number" TEXT,
    "invoice_number" TEXT,
    "lease_start_date" TIMESTAMP(3),
    "lease_end_date" TIMESTAMP(3),
    "lease_vendor" TEXT,
    "monthly_lease_cost" DECIMAL(12,2),
    "lease_contract_id" UUID,
    "vendor_id" UUID,
    "ip_address" TEXT,
    "mac_address" TEXT,
    "hostname" TEXT,
    "fqdn" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "custom_fields" JSONB NOT NULL DEFAULT '{}',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "discovery_source" "DiscoverySource",
    "last_scanned_at" TIMESTAMP(3),
    "agent_id" TEXT,
    "parent_asset_id" UUID,
    "notes" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_relationships" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_asset_id" UUID NOT NULL,
    "target_asset_id" UUID NOT NULL,
    "relationship_type" "RelationshipType" NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "description" TEXT,
    "performed_by" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware_details" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "cpu_model" TEXT,
    "cpu_cores" INTEGER,
    "cpu_speed_ghz" DOUBLE PRECISION,
    "ram_total_gb" DOUBLE PRECISION,
    "ram_type" TEXT,
    "disk_total_gb" DOUBLE PRECISION,
    "disk_type" TEXT,
    "disk_health" TEXT,
    "gpu_model" TEXT,
    "gpu_vram_gb" DOUBLE PRECISION,
    "bios_version" TEXT,
    "bios_vendor" TEXT,
    "tpm_version" TEXT,
    "tpm_enabled" BOOLEAN,
    "form_factor" TEXT,

    CONSTRAINT "hardware_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "os_details" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "os_name" TEXT,
    "os_version" TEXT,
    "os_build" TEXT,
    "os_architecture" TEXT,
    "install_date" TIMESTAMP(3),
    "last_boot" TIMESTAMP(3),
    "uptime_days" INTEGER,

    CONSTRAINT "os_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_postures" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "av_installed" BOOLEAN,
    "av_name" TEXT,
    "av_version" TEXT,
    "av_definitions_date" TIMESTAMP(3),
    "av_realtime_protection" BOOLEAN,
    "firewall_enabled" BOOLEAN,
    "encryption_enabled" BOOLEAN,
    "encryption_type" TEXT,
    "encryption_percent" INTEGER,
    "compliance_score" INTEGER,
    "last_assessed_at" TIMESTAMP(3),

    CONSTRAINT "security_postures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "software_catalog" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "publisher" TEXT,
    "category" TEXT,
    "is_blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "latest_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "software_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "software_installations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "software_id" UUID NOT NULL,
    "version" TEXT,
    "install_date" TIMESTAMP(3),
    "install_path" TEXT,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "software_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "type" "TicketType" NOT NULL DEFAULT 'INCIDENT',
    "category" TEXT,
    "sub_category" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "requester_id" UUID NOT NULL,
    "assigned_to_id" UUID,
    "assigned_group" TEXT,
    "response_due_at" TIMESTAMP(3),
    "resolution_due_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "satisfaction_score" INTEGER,
    "parent_ticket_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "work_order_number" TEXT NOT NULL,
    "ticket_id" UUID,
    "asset_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'MAINTENANCE',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "assigned_to_id" UUID,
    "scheduled_start" TIMESTAMP(3),
    "scheduled_end" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "labor_hours" DOUBLE PRECISION,
    "material_cost" DOUBLE PRECISION,
    "notes" TEXT,
    "completed_by_id" UUID,
    "verified_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comments" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_assets" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,

    CONSTRAINT "ticket_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_jobs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT,
    "scan_type" "ScanType" NOT NULL DEFAULT 'PING_SWEEP',
    "subnet" TEXT NOT NULL,
    "port_range" TEXT,
    "status" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "devices_found" INTEGER NOT NULL DEFAULT 0,
    "new_devices" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "triggered_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovered_devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scan_job_id" UUID NOT NULL,
    "ip_address" TEXT NOT NULL,
    "mac_address" TEXT,
    "hostname" TEXT,
    "open_ports" TEXT,
    "os_guess" TEXT,
    "os_info" TEXT,
    "services" TEXT,
    "manufacturer" TEXT,
    "device_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "enrichment_data" JSONB,
    "enrichment_status" TEXT NOT NULL DEFAULT 'BASIC',
    "approved_asset_id" UUID,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seen_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovered_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "software_name" TEXT NOT NULL,
    "vendor" TEXT,
    "version" TEXT,
    "license_key" TEXT,
    "license_type" "LicenseType" NOT NULL DEFAULT 'PER_SEAT',
    "license_model" "LicenseModel" NOT NULL DEFAULT 'ANNUAL',
    "total_seats" INTEGER NOT NULL DEFAULT 1,
    "used_seats" INTEGER NOT NULL DEFAULT 0,
    "purchase_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "renewal_cost" DECIMAL(12,2),
    "purchase_cost" DECIMAL(12,2),
    "po_number" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "actual_usage" INTEGER,
    "last_measured_at" TIMESTAMP(3),
    "compliance_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_assignments" (
    "id" UUID NOT NULL,
    "license_id" UUID NOT NULL,
    "user_id" UUID,
    "asset_id" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "license_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "module" TEXT,
    "resource_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_module" TEXT NOT NULL,
    "trigger_event" TEXT NOT NULL,
    "condition" TEXT,
    "action_module" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "action_config" JSONB NOT NULL DEFAULT '{}',
    "status" "RuleStatus" NOT NULL DEFAULT 'DRAFT',
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TIMESTAMP(3),
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 0,
    "last_triggered_at" TIMESTAMP(3),
    "chained_rule_id" UUID,
    "dedup_key" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "input" JSONB,
    "output" JSONB,
    "error_msg" TEXT,
    "duration" INTEGER,
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitored_devices" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "type" "MonitoredDeviceType" NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "ip_address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "config" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "last_seen" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitored_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patches" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patch_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "category" TEXT NOT NULL DEFAULT 'Security',
    "affected_assets" INTEGER NOT NULL DEFAULT 0,
    "deployed_date" TIMESTAMP(3),
    "notes" TEXT,
    "last_scan_at" TIMESTAMP(3),
    "scan_source" TEXT,
    "scan_output" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patch_deployments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "patch_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "output" TEXT,
    "deployed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patch_deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "hostname" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "agent_version" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "mac_address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "last_heartbeat" TIMESTAMP(3),
    "asset_id" UUID,
    "system_info" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_credentials" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "encrypted_data" TEXT NOT NULL,
    "scope" JSONB NOT NULL DEFAULT '{}',
    "last_used_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scan_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_scans" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "subnet" TEXT NOT NULL,
    "scan_type" TEXT NOT NULL DEFAULT 'PING_SWEEP',
    "credential_id" UUID,
    "schedule" TEXT NOT NULL,
    "scan_window" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "response_hours" INTEGER NOT NULL,
    "resolution_hours" INTEGER NOT NULL,
    "escalation_hours" INTEGER,
    "business_hours_only" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_reports" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "report_type" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'CSV',
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filters" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "script_library" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "script_content" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'BASH',
    "category" TEXT NOT NULL DEFAULT 'REMEDIATION',
    "approval_status" TEXT NOT NULL DEFAULT 'PENDING',
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "timeout_seconds" INTEGER NOT NULL DEFAULT 300,
    "run_count" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "script_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "config_text" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "config_hash" TEXT NOT NULL,
    "changes_summary" TEXT,
    "backed_up_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "backed_up_by_id" UUID,
    "is_baseline" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "network_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_results" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scan_type" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration" DOUBLE PRECISION,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "rawOutput" TEXT,
    "results" JSONB NOT NULL DEFAULT '[]',
    "triggered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "category" TEXT,
    "rating" INTEGER DEFAULT 0,
    "sla_score" DOUBLE PRECISION,
    "contact_person" TEXT,
    "tax_id" TEXT,
    "payment_terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "contract_number" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "value" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "renewal_alert_days" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "terms" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "vendor_id" UUID NOT NULL,
    "po_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requested_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "shipping_address" TEXT,
    "expected_delivery" TIMESTAMP(3),
    "received_date" TIMESTAMP(3),
    "notes" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "asset_type_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "received_qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_checkouts" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "checked_out_by_id" UUID NOT NULL,
    "checked_out_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_return" TIMESTAMP(3),
    "actual_return" TIMESTAMP(3),
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CHECKED_OUT',

    CONSTRAINT "asset_checkouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_requests" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "change_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'NORMAL',
    "category" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "risk" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requested_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "implemented_by_id" UUID,
    "scheduled_start" TIMESTAMP(3),
    "scheduled_end" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_end" TIMESTAMP(3),
    "impact_analysis" TEXT,
    "rollback_plan" TEXT,
    "test_plan" TEXT,
    "affected_assets" JSONB NOT NULL DEFAULT '[]',
    "affected_services" JSONB NOT NULL DEFAULT '[]',
    "related_tickets" JSONB NOT NULL DEFAULT '[]',
    "closure_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problems" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "problem_number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "category" TEXT,
    "root_cause" TEXT,
    "workaround" TEXT,
    "resolution" TEXT,
    "affected_assets" JSONB NOT NULL DEFAULT '[]',
    "related_tickets" JSONB NOT NULL DEFAULT '[]',
    "related_changes" JSONB NOT NULL DEFAULT '[]',
    "assigned_to_id" UUID,
    "identified_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "is_known_error" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_attestations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "campaign_name" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "response" TEXT,
    "notes" TEXT,

    CONSTRAINT "asset_attestations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_channels" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "events" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endpoint_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "action" TEXT NOT NULL DEFAULT 'ALERT_ONLY',
    "match_pattern" JSONB NOT NULL DEFAULT '{}',
    "scope" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "endpoint_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endpoint_changes" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "policy_id" UUID,
    "category" TEXT NOT NULL,
    "change_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "summary" TEXT NOT NULL,
    "previous_value" JSONB,
    "new_value" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "hostname" TEXT,
    "ip_address" TEXT,
    "platform" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endpoint_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_baselines" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "snapshot" JSONB NOT NULL DEFAULT '{}',
    "snapshot_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_baselines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_metrics_history" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_metrics_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_submissions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "reply" TEXT,
    "replied_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "user_agent" TEXT,
    "tenant_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "plan" "TenantPlan" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "mrr" DECIMAL(10,2),
    "billing_cycle" TEXT DEFAULT 'MONTHLY',
    "discount_percent" DECIMAL(5,2) DEFAULT 0,
    "discount_note" TEXT,
    "custom_price" DECIMAL(10,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "method" TEXT,
    "reference_id" TEXT,
    "invoice_number" TEXT,
    "notes" TEXT,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3),
    "distance_km" DOUBLE PRECISION NOT NULL,
    "max_speed" DOUBLE PRECISION NOT NULL,
    "avg_speed" DOUBLE PRECISION NOT NULL,
    "start_location" TEXT,
    "end_location" TEXT,
    "route_coords" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_telemetries" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL,
    "fuel_level" DOUBLE PRECISION,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_telemetries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "sites_tenant_id_idx" ON "sites"("tenant_id");

-- CreateIndex
CREATE INDEX "departments_tenant_id_idx" ON "departments"("tenant_id");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE INDEX "roles_tenant_id_idx" ON "roles"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_tenant_id_name_key" ON "roles"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "api_keys_tenant_id_idx" ON "api_keys"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_timestamp_idx" ON "audit_logs"("tenant_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_action_idx" ON "audit_logs"("tenant_id", "action");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_resource_type_resource_id_idx" ON "audit_logs"("tenant_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "asset_types_tenant_id_idx" ON "asset_types"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_tenant_id_name_key" ON "asset_types"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "assets_tenant_id_idx" ON "assets"("tenant_id");

-- CreateIndex
CREATE INDEX "assets_tenant_id_status_idx" ON "assets"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "assets_tenant_id_asset_type_id_idx" ON "assets"("tenant_id", "asset_type_id");

-- CreateIndex
CREATE INDEX "assets_tenant_id_ip_address_idx" ON "assets"("tenant_id", "ip_address");

-- CreateIndex
CREATE INDEX "assets_tenant_id_mac_address_idx" ON "assets"("tenant_id", "mac_address");

-- CreateIndex
CREATE INDEX "assets_tenant_id_serial_number_idx" ON "assets"("tenant_id", "serial_number");

-- CreateIndex
CREATE INDEX "assets_tenant_id_hostname_idx" ON "assets"("tenant_id", "hostname");

-- CreateIndex
CREATE UNIQUE INDEX "assets_tenant_id_asset_tag_key" ON "assets"("tenant_id", "asset_tag");

-- CreateIndex
CREATE INDEX "asset_relationships_tenant_id_idx" ON "asset_relationships"("tenant_id");

-- CreateIndex
CREATE INDEX "asset_history_tenant_id_asset_id_idx" ON "asset_history"("tenant_id", "asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_details_asset_id_key" ON "hardware_details"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "os_details_asset_id_key" ON "os_details"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "security_postures_asset_id_key" ON "security_postures"("asset_id");

-- CreateIndex
CREATE INDEX "software_catalog_tenant_id_idx" ON "software_catalog"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "software_catalog_tenant_id_name_publisher_key" ON "software_catalog"("tenant_id", "name", "publisher");

-- CreateIndex
CREATE INDEX "software_installations_tenant_id_asset_id_idx" ON "software_installations"("tenant_id", "asset_id");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_status_idx" ON "tickets"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_assigned_to_id_idx" ON "tickets"("tenant_id", "assigned_to_id");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_requester_id_idx" ON "tickets"("tenant_id", "requester_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_tenant_id_ticket_number_key" ON "tickets"("tenant_id", "ticket_number");

-- CreateIndex
CREATE INDEX "work_orders_tenant_id_status_idx" ON "work_orders"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_tenant_id_work_order_number_key" ON "work_orders"("tenant_id", "work_order_number");

-- CreateIndex
CREATE INDEX "ticket_comments_ticket_id_idx" ON "ticket_comments"("ticket_id");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_assets_ticket_id_asset_id_key" ON "ticket_assets"("ticket_id", "asset_id");

-- CreateIndex
CREATE INDEX "scan_jobs_tenant_id_idx" ON "scan_jobs"("tenant_id");

-- CreateIndex
CREATE INDEX "discovered_devices_tenant_id_idx" ON "discovered_devices"("tenant_id");

-- CreateIndex
CREATE INDEX "discovered_devices_scan_job_id_idx" ON "discovered_devices"("scan_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "discovered_devices_tenant_id_ip_address_key" ON "discovered_devices"("tenant_id", "ip_address");

-- CreateIndex
CREATE INDEX "licenses_tenant_id_idx" ON "licenses"("tenant_id");

-- CreateIndex
CREATE INDEX "license_assignments_license_id_idx" ON "license_assignments"("license_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_idx" ON "notifications"("tenant_id");

-- CreateIndex
CREATE INDEX "automation_rules_tenant_id_idx" ON "automation_rules"("tenant_id");

-- CreateIndex
CREATE INDEX "automation_executions_rule_id_idx" ON "automation_executions"("rule_id");

-- CreateIndex
CREATE INDEX "monitored_devices_tenant_id_type_idx" ON "monitored_devices"("tenant_id", "type");

-- CreateIndex
CREATE INDEX "patches_tenant_id_idx" ON "patches"("tenant_id");

-- CreateIndex
CREATE INDEX "patches_tenant_id_status_idx" ON "patches"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "patch_deployments_tenant_id_idx" ON "patch_deployments"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "patch_deployments_patch_id_asset_id_key" ON "patch_deployments"("patch_id", "asset_id");

-- CreateIndex
CREATE INDEX "agents_tenant_id_idx" ON "agents"("tenant_id");

-- CreateIndex
CREATE INDEX "scan_credentials_tenant_id_idx" ON "scan_credentials"("tenant_id");

-- CreateIndex
CREATE INDEX "scheduled_scans_tenant_id_idx" ON "scheduled_scans"("tenant_id");

-- CreateIndex
CREATE INDEX "knowledge_articles_tenant_id_idx" ON "knowledge_articles"("tenant_id");

-- CreateIndex
CREATE INDEX "sla_policies_tenant_id_idx" ON "sla_policies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_tenant_id_priority_key" ON "sla_policies"("tenant_id", "priority");

-- CreateIndex
CREATE INDEX "scheduled_reports_tenant_id_idx" ON "scheduled_reports"("tenant_id");

-- CreateIndex
CREATE INDEX "script_library_tenant_id_idx" ON "script_library"("tenant_id");

-- CreateIndex
CREATE INDEX "network_configs_tenant_id_device_id_idx" ON "network_configs"("tenant_id", "device_id");

-- CreateIndex
CREATE INDEX "scan_results_tenant_id_scan_type_idx" ON "scan_results"("tenant_id", "scan_type");

-- CreateIndex
CREATE INDEX "scan_results_tenant_id_status_idx" ON "scan_results"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "vendors_tenant_id_idx" ON "vendors"("tenant_id");

-- CreateIndex
CREATE INDEX "contracts_tenant_id_idx" ON "contracts"("tenant_id");

-- CreateIndex
CREATE INDEX "contracts_tenant_id_status_idx" ON "contracts"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_idx" ON "purchase_orders"("tenant_id");

-- CreateIndex
CREATE INDEX "purchase_orders_tenant_id_status_idx" ON "purchase_orders"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_tenant_id_po_number_key" ON "purchase_orders"("tenant_id", "po_number");

-- CreateIndex
CREATE INDEX "purchase_order_items_po_id_idx" ON "purchase_order_items"("po_id");

-- CreateIndex
CREATE INDEX "asset_checkouts_tenant_id_idx" ON "asset_checkouts"("tenant_id");

-- CreateIndex
CREATE INDEX "asset_checkouts_tenant_id_status_idx" ON "asset_checkouts"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "change_requests_tenant_id_status_idx" ON "change_requests"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "change_requests_tenant_id_change_number_key" ON "change_requests"("tenant_id", "change_number");

-- CreateIndex
CREATE INDEX "problems_tenant_id_status_idx" ON "problems"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "problems_tenant_id_is_known_error_idx" ON "problems"("tenant_id", "is_known_error");

-- CreateIndex
CREATE UNIQUE INDEX "problems_tenant_id_problem_number_key" ON "problems"("tenant_id", "problem_number");

-- CreateIndex
CREATE INDEX "asset_attestations_tenant_id_idx" ON "asset_attestations"("tenant_id");

-- CreateIndex
CREATE INDEX "asset_attestations_tenant_id_response_idx" ON "asset_attestations"("tenant_id", "response");

-- CreateIndex
CREATE INDEX "notification_channels_tenant_id_idx" ON "notification_channels"("tenant_id");

-- CreateIndex
CREATE INDEX "endpoint_policies_tenant_id_idx" ON "endpoint_policies"("tenant_id");

-- CreateIndex
CREATE INDEX "endpoint_policies_tenant_id_category_idx" ON "endpoint_policies"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "endpoint_changes_tenant_id_idx" ON "endpoint_changes"("tenant_id");

-- CreateIndex
CREATE INDEX "endpoint_changes_tenant_id_status_idx" ON "endpoint_changes"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "endpoint_changes_tenant_id_agent_id_idx" ON "endpoint_changes"("tenant_id", "agent_id");

-- CreateIndex
CREATE INDEX "endpoint_changes_tenant_id_severity_idx" ON "endpoint_changes"("tenant_id", "severity");

-- CreateIndex
CREATE UNIQUE INDEX "agent_baselines_agent_id_key" ON "agent_baselines"("agent_id");

-- CreateIndex
CREATE INDEX "agent_baselines_tenant_id_idx" ON "agent_baselines"("tenant_id");

-- CreateIndex
CREATE INDEX "device_metrics_history_device_id_collected_at_idx" ON "device_metrics_history"("device_id", "collected_at");

-- CreateIndex
CREATE INDEX "device_metrics_history_tenant_id_idx" ON "device_metrics_history"("tenant_id");

-- CreateIndex
CREATE INDEX "contact_submissions_status_idx" ON "contact_submissions"("status");

-- CreateIndex
CREATE INDEX "contact_submissions_email_idx" ON "contact_submissions"("email");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenant_id_key" ON "subscriptions"("tenant_id");

-- CreateIndex
CREATE INDEX "payments_subscription_id_idx" ON "payments"("subscription_id");

-- CreateIndex
CREATE INDEX "trips_tenant_id_asset_id_idx" ON "trips"("tenant_id", "asset_id");

-- CreateIndex
CREATE INDEX "gps_telemetries_tenant_id_asset_id_idx" ON "gps_telemetries"("tenant_id", "asset_id");

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_types" ADD CONSTRAINT "asset_types_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_types" ADD CONSTRAINT "asset_types_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "asset_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_type_id_fkey" FOREIGN KEY ("asset_type_id") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_managed_by_id_fkey" FOREIGN KEY ("managed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_parent_asset_id_fkey" FOREIGN KEY ("parent_asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_source_asset_id_fkey" FOREIGN KEY ("source_asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_relationships" ADD CONSTRAINT "asset_relationships_target_asset_id_fkey" FOREIGN KEY ("target_asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_history" ADD CONSTRAINT "asset_history_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_details" ADD CONSTRAINT "hardware_details_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "os_details" ADD CONSTRAINT "os_details_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "security_postures" ADD CONSTRAINT "security_postures_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_installations" ADD CONSTRAINT "software_installations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "software_installations" ADD CONSTRAINT "software_installations_software_id_fkey" FOREIGN KEY ("software_id") REFERENCES "software_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_parent_ticket_id_fkey" FOREIGN KEY ("parent_ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assets" ADD CONSTRAINT "ticket_assets_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assets" ADD CONSTRAINT "ticket_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovered_devices" ADD CONSTRAINT "discovered_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovered_devices" ADD CONSTRAINT "discovered_devices_scan_job_id_fkey" FOREIGN KEY ("scan_job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licenses" ADD CONSTRAINT "licenses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_assignments" ADD CONSTRAINT "license_assignments_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitored_devices" ADD CONSTRAINT "monitored_devices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patches" ADD CONSTRAINT "patches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patch_deployments" ADD CONSTRAINT "patch_deployments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patch_deployments" ADD CONSTRAINT "patch_deployments_patch_id_fkey" FOREIGN KEY ("patch_id") REFERENCES "patches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patch_deployments" ADD CONSTRAINT "patch_deployments_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_credentials" ADD CONSTRAINT "scan_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_scans" ADD CONSTRAINT "scheduled_scans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "script_library" ADD CONSTRAINT "script_library_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_configs" ADD CONSTRAINT "network_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_checkouts" ADD CONSTRAINT "asset_checkouts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_checkouts" ADD CONSTRAINT "asset_checkouts_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_requests" ADD CONSTRAINT "change_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attestations" ADD CONSTRAINT "asset_attestations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_attestations" ADD CONSTRAINT "asset_attestations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endpoint_policies" ADD CONSTRAINT "endpoint_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endpoint_changes" ADD CONSTRAINT "endpoint_changes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endpoint_changes" ADD CONSTRAINT "endpoint_changes_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endpoint_changes" ADD CONSTRAINT "endpoint_changes_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "endpoint_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_baselines" ADD CONSTRAINT "agent_baselines_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_baselines" ADD CONSTRAINT "agent_baselines_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_metrics_history" ADD CONSTRAINT "device_metrics_history_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_metrics_history" ADD CONSTRAINT "device_metrics_history_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "monitored_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_telemetries" ADD CONSTRAINT "gps_telemetries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_telemetries" ADD CONSTRAINT "gps_telemetries_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
