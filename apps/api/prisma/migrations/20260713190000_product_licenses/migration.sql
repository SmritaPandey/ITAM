-- Product licensing (QS Assets entitlement) + on-prem instance entitlement

CREATE TYPE "ProductLicenseStatus" AS ENUM ('ISSUED', 'ACTIVE', 'REVOKED', 'EXPIRED');

CREATE TABLE "product_licenses" (
    "id" UUID NOT NULL,
    "license_key" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "plan" "TenantPlan" NOT NULL DEFAULT 'ON_PREMISE',
    "max_assets" INTEGER NOT NULL DEFAULT -1,
    "max_users" INTEGER NOT NULL DEFAULT -1,
    "allowed_modules" JSONB NOT NULL DEFAULT '[]',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "ProductLicenseStatus" NOT NULL DEFAULT 'ISSUED',
    "deployment_fingerprint" TEXT,
    "activated_at" TIMESTAMP(3),
    "created_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_licenses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_licenses_license_key_key" ON "product_licenses"("license_key");
CREATE INDEX "product_licenses_status_idx" ON "product_licenses"("status");
CREATE INDEX "product_licenses_customer_name_idx" ON "product_licenses"("customer_name");

CREATE TABLE "instance_entitlements" (
    "id" UUID NOT NULL,
    "install_id" TEXT NOT NULL,
    "license_key" TEXT,
    "payload" JSONB NOT NULL,
    "signed_blob" TEXT NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "plan" "TenantPlan" NOT NULL DEFAULT 'ON_PREMISE',
    "max_assets" INTEGER NOT NULL DEFAULT -1,
    "max_users" INTEGER NOT NULL DEFAULT -1,
    "allowed_modules" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instance_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "instance_entitlements_install_id_key" ON "instance_entitlements"("install_id");
