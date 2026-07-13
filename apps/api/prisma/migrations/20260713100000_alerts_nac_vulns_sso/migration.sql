-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "channels" JSONB NOT NULL DEFAULT '["in_app"]',
    "cooldown_minutes" INTEGER NOT NULL DEFAULT 15,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alert_events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_id" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by" UUID,
    "acknowledged_at" TIMESTAMP(3),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nac_vlan_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vlan_id" INTEGER NOT NULL,
    "vlan_name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "action" TEXT NOT NULL DEFAULT 'ASSIGN',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nac_vlan_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nac_network_segments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "vlan_id" INTEGER NOT NULL,
    "subnet" TEXT NOT NULL,
    "security_zone" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nac_network_segments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nac_radius_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "server_address" TEXT NOT NULL DEFAULT '',
    "port" INTEGER NOT NULL DEFAULT 1812,
    "shared_secret" TEXT NOT NULL DEFAULT '',
    "auth_protocol" TEXT NOT NULL DEFAULT 'EAP-TLS',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nac_radius_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vulnerabilities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "cve_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cvss_score" DOUBLE PRECISION,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "published_at" TIMESTAMP(3),
    "modified_at" TIMESTAMP(3),
    "cpe_matches" JSONB NOT NULL DEFAULT '[]',
    "references" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vulnerabilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "asset_vulnerabilities" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "vulnerability_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matched_software" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_vulnerabilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mqtt_broker_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "broker_url" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "topics" JSONB NOT NULL DEFAULT '["devices/+/telemetry"]',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mqtt_broker_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sso_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "entity_id" TEXT,
    "sso_url" TEXT,
    "certificate" TEXT,
    "client_id" TEXT,
    "client_secret" TEXT,
    "issuer" TEXT,
    "metadata_url" TEXT,
    "group_role_map" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cloud_connectors" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "encrypted_creds" TEXT NOT NULL,
    "regions" JSONB NOT NULL DEFAULT '[]',
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cloud_connectors_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "alert_rules_tenant_id_idx" ON "alert_rules"("tenant_id");
CREATE INDEX "alert_events_tenant_id_created_at_idx" ON "alert_events"("tenant_id", "created_at");
CREATE INDEX "alert_events_tenant_id_acknowledged_idx" ON "alert_events"("tenant_id", "acknowledged");
CREATE INDEX "alert_events_tenant_id_severity_idx" ON "alert_events"("tenant_id", "severity");
CREATE INDEX "nac_vlan_policies_tenant_id_idx" ON "nac_vlan_policies"("tenant_id");
CREATE INDEX "nac_network_segments_tenant_id_idx" ON "nac_network_segments"("tenant_id");
CREATE UNIQUE INDEX "nac_radius_configs_tenant_id_key" ON "nac_radius_configs"("tenant_id");
CREATE UNIQUE INDEX "vulnerabilities_cve_id_key" ON "vulnerabilities"("cve_id");
CREATE INDEX "vulnerabilities_severity_idx" ON "vulnerabilities"("severity");
CREATE INDEX "vulnerabilities_cvss_score_idx" ON "vulnerabilities"("cvss_score");
CREATE UNIQUE INDEX "asset_vulnerabilities_asset_id_vulnerability_id_key" ON "asset_vulnerabilities"("asset_id", "vulnerability_id");
CREATE INDEX "asset_vulnerabilities_tenant_id_status_idx" ON "asset_vulnerabilities"("tenant_id", "status");
CREATE INDEX "asset_vulnerabilities_asset_id_idx" ON "asset_vulnerabilities"("asset_id");
CREATE INDEX "mqtt_broker_configs_tenant_id_idx" ON "mqtt_broker_configs"("tenant_id");
CREATE UNIQUE INDEX "sso_configs_tenant_id_provider_key" ON "sso_configs"("tenant_id", "provider");
CREATE INDEX "sso_configs_tenant_id_idx" ON "sso_configs"("tenant_id");
CREATE INDEX "cloud_connectors_tenant_id_idx" ON "cloud_connectors"("tenant_id");

-- FKs
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nac_vlan_policies" ADD CONSTRAINT "nac_vlan_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nac_network_segments" ADD CONSTRAINT "nac_network_segments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nac_radius_configs" ADD CONSTRAINT "nac_radius_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vulnerabilities" ADD CONSTRAINT "vulnerabilities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_vulnerabilities" ADD CONSTRAINT "asset_vulnerabilities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_vulnerabilities" ADD CONSTRAINT "asset_vulnerabilities_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_vulnerabilities" ADD CONSTRAINT "asset_vulnerabilities_vulnerability_id_fkey" FOREIGN KEY ("vulnerability_id") REFERENCES "vulnerabilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mqtt_broker_configs" ADD CONSTRAINT "mqtt_broker_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sso_configs" ADD CONSTRAINT "sso_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cloud_connectors" ADD CONSTRAINT "cloud_connectors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
