import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { isOnPrem, getLicenseServerUrl, isPublicSignupDisabled } from '../../common/deployment-mode';
import { MODULE_CATALOG, ModuleKey, getResolvedModules } from '../../common/utils/modules';
import {
  EntitlementClaims,
  SignedLicenseFile,
  encodeLicenseBlob,
  encodeLicenseChallenge,
  generateLicenseKey,
  LicenseChallenge,
  parseLicenseChallenge,
  parseLicenseInput,
  signEntitlement,
  verifySignedLicense,
} from './license-crypto';
import { TenantPlan } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PLAN_LIMITS } from '../../common/constants/plan-limits';

export interface EffectiveEntitlement {
  valid: boolean;
  expired: boolean;
  missing: boolean;
  readOnly: boolean;
  plan: TenantPlan;
  maxAssets: number;
  maxUsers: number;
  allowedModules: string[] | null;
  expiresAt: Date | null;
  licenseKey: string | null;
  customerName: string | null;
  status: string;
  deploymentMode: 'saas' | 'onprem';
  message?: string;
}

@Injectable()
export class ProductLicenseService implements OnModuleInit {
  private readonly logger = new Logger(ProductLicenseService.name);
  private installId: string | null = null;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    if (isOnPrem()) {
      await this.ensureInstallId();
      await this.bootstrapOnPremIfNeeded();
      await this.refreshEntitlementStatus();
    }
  }

  // ─── Install identity ─────────────────────────────────────────

  async ensureInstallId(): Promise<string> {
    const existing = await this.prisma.instanceEntitlement.findFirst({
      orderBy: { activatedAt: 'asc' },
    });
    if (existing) {
      this.installId = existing.installId;
      return existing.installId;
    }
    const installId = process.env.INSTALL_ID?.trim() || `inst-${randomUUID()}`;
    await this.prisma.instanceEntitlement.create({
      data: {
        installId,
        status: 'PENDING',
        signedBlob: null,
        activatedAt: null,
      },
    });
    this.installId = installId;
    return installId;
  }

  getInstallIdSync(): string {
    return this.installId || process.env.INSTALL_ID || 'unknown';
  }

  // ─── On-prem first boot ───────────────────────────────────────

  async bootstrapOnPremIfNeeded() {
    const tenantCount = await this.prisma.tenant.count();
    if (tenantCount > 0) return;

    const orgName = process.env.ONPREM_ORG_NAME || 'Enterprise Organization';
    const ownerEmail = (process.env.OWNER_EMAIL || 'owner@localhost').toLowerCase();
    const ownerPassword = process.env.OWNER_PASSWORD;
    const adminEmail = (process.env.TENANT_ADMIN_EMAIL || 'admin@localhost').toLowerCase();
    const adminPassword = process.env.TENANT_ADMIN_PASSWORD;

    if (!ownerPassword || !adminPassword) {
      this.logger.error(
        'On-prem first boot refused: OWNER_PASSWORD and TENANT_ADMIN_PASSWORD must be set (no default passwords).',
      );
      return;
    }
    if (
      ownerPassword === 'ChangeMe@123' ||
      adminPassword === 'ChangeMe@123' ||
      ownerPassword.length < 12 ||
      adminPassword.length < 12
    ) {
      this.logger.error(
        'On-prem first boot refused: passwords must be at least 12 characters and must not use weak defaults.',
      );
      return;
    }

    this.logger.log(`On-prem first boot: creating primary tenant "${orgName}"`);

    const slug = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 40) || 'enterprise';

    await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: orgName,
          slug,
          plan: 'ON_PREMISE',
          status: 'ACTIVE',
          settings: {
            deploymentMode: 'onprem',
            maxAssets: PLAN_LIMITS.ON_PREMISE.maxAssets === Infinity ? -1 : PLAN_LIMITS.ON_PREMISE.maxAssets,
            maxUsers: PLAN_LIMITS.ON_PREMISE.maxUsers === Infinity ? -1 : PLAN_LIMITS.ON_PREMISE.maxUsers,
          },
        },
      });

      await tx.site.create({
        data: { tenantId: tenant.id, name: 'Headquarters', isHq: true },
      });
      await tx.department.create({
        data: { tenantId: tenant.id, name: 'IT Department' },
      });

      const ownerRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Platform Owner',
          description: 'NeurQ / vendor support SuperAdmin',
          permissions: ['*'],
          isSystem: true,
        },
      });
      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Tenant Admin',
          description: 'Full administrative access',
          permissions: ['*'],
          isSystem: true,
        },
      });
      await tx.role.createMany({
        data: [
          {
            tenantId: tenant.id,
            name: 'IT Admin',
            description: 'IT operations',
            permissions: ['assets:read', 'assets:write', 'tickets:read', 'tickets:write', 'scanning:execute'],
            isSystem: true,
          },
          {
            tenantId: tenant.id,
            name: 'Staff',
            description: 'Staff',
            permissions: ['assets:read', 'tickets:read', 'tickets:write'],
            isSystem: true,
          },
          {
            tenantId: tenant.id,
            name: 'Employee',
            description: 'Employee',
            permissions: ['assets:read', 'tickets:read', 'tickets:write'],
            isSystem: true,
          },
        ],
      });

      const ownerHash = await bcrypt.hash(ownerPassword, 12);
      const adminHash = await bcrypt.hash(adminPassword, 12);

      await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: ownerEmail,
          passwordHash: ownerHash,
          firstName: 'Platform',
          lastName: 'Owner',
          roleId: ownerRole.id,
          status: 'ACTIVE',
          isSuperAdmin: true,
          emailVerified: true,
        },
      });

      if (adminEmail !== ownerEmail) {
        await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: adminEmail,
            passwordHash: adminHash,
            firstName: 'Tenant',
            lastName: 'Admin',
            roleId: adminRole.id,
            status: 'ACTIVE',
            isSuperAdmin: false,
            emailVerified: true,
          },
        });
      }

      await tx.assetType.createMany({
        data: [
          { tenantId: tenant.id, name: 'Laptop', isItAsset: true, icon: 'laptop', color: '#6366f1' },
          { tenantId: tenant.id, name: 'Desktop', isItAsset: true, icon: 'monitor', color: '#3b82f6' },
          { tenantId: tenant.id, name: 'Server', isItAsset: true, icon: 'server', color: '#8b5cf6' },
          { tenantId: tenant.id, name: 'Network Device', isItAsset: true, icon: 'router', color: '#0ea5e9' },
          { tenantId: tenant.id, name: 'Printer', isItAsset: true, icon: 'printer', color: '#a855f7' },
          { tenantId: tenant.id, name: 'Furniture', isItAsset: false, icon: 'armchair', color: '#f97316' },
          { tenantId: tenant.id, name: 'Vehicle', isItAsset: false, icon: 'car', color: '#10b981' },
        ],
      });

      await tx.slaPolicy.createMany({
        data: [
          { tenantId: tenant.id, name: 'Critical SLA', priority: 'CRITICAL', responseHours: 1, resolutionHours: 4, escalationHours: 2, isDefault: true },
          { tenantId: tenant.id, name: 'High SLA', priority: 'HIGH', responseHours: 4, resolutionHours: 8, escalationHours: 6, isDefault: true },
          { tenantId: tenant.id, name: 'Medium SLA', priority: 'MEDIUM', responseHours: 8, resolutionHours: 24, escalationHours: 16, isDefault: true },
          { tenantId: tenant.id, name: 'Low SLA', priority: 'LOW', responseHours: 24, resolutionHours: 72, escalationHours: 48, isDefault: true },
        ],
      });
    });

    this.logger.warn(
      `On-prem bootstrapped. Support SuperAdmin: ${ownerEmail} — change OWNER_PASSWORD immediately.`,
    );
  }

  // ─── SaaS: issue / list / revoke ──────────────────────────────

  async issueLicense(dto: {
    customerName: string;
    plan?: 'ENTERPRISE' | 'ON_PREMISE';
    maxAssets?: number;
    maxUsers?: number;
    allowedModules?: string[];
    expiresAt: string | Date;
    notes?: string;
    createdBy?: string;
  }) {
    const plan = dto.plan || 'ON_PREMISE';
    const modules =
      dto.allowedModules && dto.allowedModules.length > 0
        ? dto.allowedModules.filter((m) => MODULE_CATALOG[m as ModuleKey])
        : Object.keys(MODULE_CATALOG);

    const licenseKey = generateLicenseKey();
    const expiresAt = new Date(dto.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiresAt');
    }

    const record = await this.prisma.productLicense.create({
      data: {
        licenseKey,
        customerName: dto.customerName,
        plan,
        maxAssets: dto.maxAssets ?? -1,
        maxUsers: dto.maxUsers ?? -1,
        allowedModules: modules,
        expiresAt,
        status: 'ISSUED',
        createdBy: dto.createdBy || null,
        notes: dto.notes || null,
      },
    });

    const signed = this.buildSignedFile(record);
    return {
      ...record,
      licenseFile: signed,
      licenseBlob: encodeLicenseBlob(signed),
    };
  }

  buildSignedFile(record: {
    licenseKey: string;
    customerName: string;
    plan: string;
    maxAssets: number;
    maxUsers: number;
    allowedModules: unknown;
    expiresAt: Date;
    deploymentFingerprint?: string | null;
  }, activation?: { installId?: string; nonce?: string }): SignedLicenseFile {
    const claims: EntitlementClaims = {
      licenseKey: record.licenseKey,
      customerName: record.customerName,
      plan: record.plan as 'ENTERPRISE' | 'ON_PREMISE',
      maxAssets: record.maxAssets,
      maxUsers: record.maxUsers,
      allowedModules: Array.isArray(record.allowedModules)
        ? (record.allowedModules as string[])
        : Object.keys(MODULE_CATALOG),
      expiresAt: record.expiresAt.toISOString(),
      iss: 'neurq',
      fingerprint: record.deploymentFingerprint || null,
      installId: activation?.installId,
      activationNonce: activation?.nonce,
    };
    return signEntitlement(claims);
  }

  async listLicenses(query?: { limit?: number; offset?: number; search?: string; status?: string }) {
    const where: any = {};
    if (query?.search) {
      where.OR = [
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { licenseKey: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query?.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.productLicense.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query?.limit || 50,
        skip: query?.offset || 0,
      }),
      this.prisma.productLicense.count({ where }),
    ]);
    return { data, total };
  }

  async getLicenseSummary() {
    const now = new Date();
    const expiringBefore = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [total, issued, active, revoked, expired, expiringSoon, activeCapacity] =
      await Promise.all([
        this.prisma.productLicense.count(),
        this.prisma.productLicense.count({ where: { status: 'ISSUED' } }),
        this.prisma.productLicense.count({ where: { status: 'ACTIVE' } }),
        this.prisma.productLicense.count({ where: { status: 'REVOKED' } }),
        this.prisma.productLicense.count({
          where: {
            OR: [{ status: 'EXPIRED' }, { expiresAt: { lt: now } }],
          },
        }),
        this.prisma.productLicense.count({
          where: {
            status: { in: ['ISSUED', 'ACTIVE'] },
            expiresAt: { gte: now, lte: expiringBefore },
          },
        }),
        this.prisma.productLicense.aggregate({
          where: { status: 'ACTIVE' },
          _sum: { maxAssets: true, maxUsers: true },
        }),
      ]);

    return {
      total,
      byStatus: { issued, active, revoked, expired },
      expiringSoon,
      activeCapacity: {
        maxAssets: activeCapacity._sum.maxAssets ?? 0,
        maxUsers: activeCapacity._sum.maxUsers ?? 0,
        includesUnlimitedAssets: await this.prisma.productLicense.count({
          where: { status: 'ACTIVE', maxAssets: -1 },
        }),
        includesUnlimitedUsers: await this.prisma.productLicense.count({
          where: { status: 'ACTIVE', maxUsers: -1 },
        }),
      },
      generatedAt: now.toISOString(),
    };
  }

  async getLicense(id: string) {
    const lic = await this.prisma.productLicense.findUnique({ where: { id } });
    if (!lic) throw new NotFoundException('License not found');
    const signed = this.buildSignedFile(lic);
    return { ...lic, licenseFile: signed, licenseBlob: encodeLicenseBlob(signed) };
  }

  async downloadLicense(id: string) {
    const lic = await this.getLicense(id);
    return {
      filename: `${lic.licenseKey}.lic`,
      contentType: 'application/json',
      body: JSON.stringify(lic.licenseFile, null, 2),
      blob: lic.licenseBlob,
    };
  }

  async revokeLicense(id: string) {
    const lic = await this.prisma.productLicense.findUnique({ where: { id } });
    if (!lic) throw new NotFoundException('License not found');
    return this.prisma.productLicense.update({
      where: { id },
      data: { status: 'REVOKED' },
    });
  }

  async renewLicense(id: string, expiresAt: string | Date) {
    const lic = await this.prisma.productLicense.findUnique({ where: { id } });
    if (!lic) throw new NotFoundException('License not found');
    const next = new Date(expiresAt);
    if (Number.isNaN(next.getTime())) throw new BadRequestException('Invalid expiresAt');
    const updated = await this.prisma.productLicense.update({
      where: { id },
      data: {
        expiresAt: next,
        status: lic.status === 'REVOKED' ? 'REVOKED' : next < new Date() ? 'EXPIRED' : lic.deploymentFingerprint ? 'ACTIVE' : 'ISSUED',
      },
    });
    const signed = this.buildSignedFile(updated);
    return { ...updated, licenseFile: signed, licenseBlob: encodeLicenseBlob(signed) };
  }

  /** Public SaaS endpoint: activate key from on-prem install */
  async activateOnline(dto: { licenseKey: string; fingerprint: string; installId?: string }) {
    const key = dto.licenseKey.trim().toUpperCase();
    const lic = await this.prisma.productLicense.findUnique({ where: { licenseKey: key } });
    if (!lic) throw new NotFoundException('Invalid license key');
    if (lic.status === 'REVOKED') throw new ForbiddenException('License has been revoked');
    if (lic.expiresAt < new Date()) {
      await this.prisma.productLicense.update({ where: { id: lic.id }, data: { status: 'EXPIRED' } });
      throw new ForbiddenException('License has expired');
    }
    if (lic.deploymentFingerprint && lic.deploymentFingerprint !== dto.fingerprint) {
      throw new ForbiddenException('License is bound to another installation');
    }

    const fingerprint = dto.fingerprint || this.hashInstall(dto.installId || key);
    const updated = await this.prisma.productLicense.update({
      where: { id: lic.id },
      data: {
        status: 'ACTIVE',
        activatedAt: lic.activatedAt || new Date(),
        deploymentFingerprint: lic.deploymentFingerprint || fingerprint,
      },
    });

    const signed = this.buildSignedFile({ ...updated, deploymentFingerprint: updated.deploymentFingerprint });
    return {
      licenseBlob: encodeLicenseBlob(signed),
      licenseFile: signed,
      expiresAt: updated.expiresAt,
      plan: updated.plan,
    };
  }

  async createInstanceChallenge() {
    if (!isOnPrem()) {
      throw new BadRequestException('License challenges are only created by on-prem instances');
    }
    const installId = await this.ensureInstallId();
    const challenge: LicenseChallenge = {
      version: 1,
      installId,
      fingerprint: this.hashInstall(installId),
      nonce: randomBytes(24).toString('base64url'),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    await this.prisma.instanceEntitlement.update({
      where: { installId },
      data: {
        challengeNonce: challenge.nonce,
        challengeExpiresAt: new Date(challenge.expiresAt),
      },
    });
    return {
      installId,
      fingerprint: challenge.fingerprint,
      challenge,
      challengeBlob: encodeLicenseChallenge(challenge),
    };
  }

  async activateChallenge(dto: {
    licenseKey: string;
    challenge: string | LicenseChallenge;
  }) {
    let challenge: LicenseChallenge;
    try {
      challenge = parseLicenseChallenge(dto.challenge);
    } catch (error: any) {
      throw new BadRequestException(error?.message || 'Invalid license challenge');
    }
    if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
      throw new BadRequestException('License challenge has expired');
    }
    const activated = await this.activateOnline({
      licenseKey: dto.licenseKey,
      fingerprint: challenge.fingerprint,
      installId: challenge.installId,
    });
    const lic = await this.prisma.productLicense.findUnique({
      where: { licenseKey: dto.licenseKey.trim().toUpperCase() },
    });
    if (!lic) throw new NotFoundException('Invalid license key');
    const signed = this.buildSignedFile(lic, {
      installId: challenge.installId,
      nonce: challenge.nonce,
    });
    return {
      ...activated,
      licenseFile: signed,
      licenseBlob: encodeLicenseBlob(signed),
    };
  }

  async activateInstanceResponse(raw: string) {
    const installId = await this.ensureInstallId();
    const row = await this.prisma.instanceEntitlement.findUnique({ where: { installId } });
    if (!row?.challengeNonce || !row.challengeExpiresAt) {
      throw new BadRequestException('No pending license challenge');
    }
    if (row.challengeExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('License challenge has expired');
    }
    return this.applySignedLicense(raw, {
      fingerprint: this.hashInstall(installId),
      expectedNonce: row.challengeNonce,
      activationMode: 'AIR_GAP',
    });
  }

  private hashInstall(raw: string): string {
    return createHash('sha256').update(raw).digest('hex').slice(0, 32);
  }

  // ─── On-prem: apply license locally ───────────────────────────

  async applySignedLicense(raw: string, opts?: {
    fingerprint?: string;
    expectedNonce?: string;
    activationMode?: 'ONLINE' | 'AIR_GAP' | 'UPLOAD';
  }) {
    let file: SignedLicenseFile;
    try {
      file = parseLicenseInput(raw);
    } catch {
      throw new BadRequestException('Could not parse license file');
    }

    let claims: EntitlementClaims;
    try {
      claims = verifySignedLicense(file);
    } catch (e: any) {
      throw new BadRequestException(e?.message || 'License verification failed');
    }

    if (new Date(claims.expiresAt) < new Date()) {
      throw new ForbiddenException('License has expired');
    }

    const installId = await this.ensureInstallId();
    const fingerprint = opts?.fingerprint || this.hashInstall(installId);

    if (claims.fingerprint && claims.fingerprint !== fingerprint) {
      throw new ForbiddenException('License fingerprint does not match this installation');
    }
    if (opts?.expectedNonce && claims.activationNonce !== opts.expectedNonce) {
      throw new ForbiddenException('License challenge nonce does not match');
    }
    if (claims.installId && claims.installId !== installId) {
      throw new ForbiddenException('License response belongs to another installation');
    }

    // Optional SaaS revocation check is not available offline — trust signature + expiry

    const plan = claims.plan === 'ENTERPRISE' ? TenantPlan.ENTERPRISE : TenantPlan.ON_PREMISE;
    const modules = claims.allowedModules?.length ? claims.allowedModules : Object.keys(MODULE_CATALOG);
    const blob = encodeLicenseBlob(file);

    const existing = await this.prisma.instanceEntitlement.findUnique({ where: { installId } });
    const data = {
      licenseKey: claims.licenseKey,
      payload: claims as any,
      signedBlob: blob,
      expiresAt: new Date(claims.expiresAt),
      plan,
      maxAssets: claims.maxAssets,
      maxUsers: claims.maxUsers,
      allowedModules: modules,
      status: 'ACTIVE',
      activatedAt: new Date(),
      activationMode: opts?.activationMode || 'UPLOAD',
      lastValidatedAt: new Date(),
      challengeNonce: null,
      challengeExpiresAt: null,
    };

    const entitlement = existing
      ? await this.prisma.instanceEntitlement.update({ where: { installId }, data })
      : await this.prisma.instanceEntitlement.create({
          data: { installId, ...data },
        });

    await this.applyEntitlementToPrimaryTenant(claims);

    return {
      success: true,
      entitlement: {
        installId: entitlement.installId,
        plan: entitlement.plan,
        expiresAt: entitlement.expiresAt,
        maxAssets: entitlement.maxAssets,
        maxUsers: entitlement.maxUsers,
        allowedModules: entitlement.allowedModules,
        status: entitlement.status,
        licenseKey: entitlement.licenseKey,
      },
    };
  }

  async activateFromLicenseServer(licenseKey: string) {
    const server = getLicenseServerUrl();
    if (!server) {
      throw new BadRequestException(
        'LICENSE_SERVER_URL is not configured. Use offline .lic upload or set LICENSE_SERVER_URL to NeurQ SaaS.',
      );
    }
    const installId = await this.ensureInstallId();
    const fingerprint = this.hashInstall(installId);
    const url = `${server.replace(/\/$/, '')}/product-licenses/activate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, fingerprint, installId }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new BadRequestException(`License server rejected activation: ${text}`);
    }
    const body = await res.json();
    const blob = body.licenseBlob || body.licenseFile;
    if (!blob) throw new BadRequestException('License server returned empty entitlement');
    return this.applySignedLicense(
      typeof blob === 'string' ? blob : JSON.stringify(blob),
      { fingerprint, activationMode: 'ONLINE' },
    );
  }

  private async applyEntitlementToPrimaryTenant(claims: EntitlementClaims) {
    const tenant = await this.prisma.tenant.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    if (!tenant) return;

    const settings = (typeof tenant.settings === 'object' && tenant.settings ? tenant.settings : {}) as Record<string, any>;
    const modules = claims.allowedModules?.length ? claims.allowedModules : Object.keys(MODULE_CATALOG);

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        plan: claims.plan === 'ENTERPRISE' ? 'ENTERPRISE' : 'ON_PREMISE',
        settings: {
          ...settings,
          maxAssets: claims.maxAssets < 0 ? undefined : claims.maxAssets,
          maxUsers: claims.maxUsers < 0 ? undefined : claims.maxUsers,
          customAllowedModules: modules,
          productLicenseAllowedModules: modules,
          productLicenseKey: claims.licenseKey,
          productLicenseExpiresAt: claims.expiresAt,
        },
      },
    });
  }

  async refreshEntitlementStatus() {
    const row = await this.prisma.instanceEntitlement.findFirst({
      orderBy: { activatedAt: 'desc' },
    });
    if (!row) return;
    if (row.expiresAt && row.expiresAt < new Date() && row.status === 'ACTIVE') {
      await this.prisma.instanceEntitlement.update({
        where: { id: row.id },
        data: { status: 'EXPIRED' },
      });
    }
  }

  async getEffectiveEntitlement(): Promise<EffectiveEntitlement> {
    const mode = isOnPrem() ? 'onprem' : 'saas';

    if (mode === 'saas') {
      return {
        valid: true,
        expired: false,
        missing: false,
        readOnly: false,
        plan: TenantPlan.ENTERPRISE,
        maxAssets: -1,
        maxUsers: -1,
        allowedModules: null,
        expiresAt: null,
        licenseKey: null,
        customerName: null,
        status: 'SAAS',
        deploymentMode: 'saas',
      };
    }

    await this.refreshEntitlementStatus();
    const row = await this.prisma.instanceEntitlement.findFirst({
      where: { status: { in: ['ACTIVE', 'EXPIRED'] } },
      orderBy: { activatedAt: 'desc' },
    });

    if (!row || !row.signedBlob) {
      return {
        valid: false,
        expired: false,
        missing: true,
        readOnly: true,
        plan: TenantPlan.ON_PREMISE,
        maxAssets: 0,
        maxUsers: 5,
        allowedModules: ['DASHBOARD', 'SETTINGS', 'USERS', 'HELP'],
        expiresAt: null,
        licenseKey: null,
        customerName: null,
        status: 'MISSING',
        deploymentMode: 'onprem',
        message: 'No product license activated. Activate online or upload a .lic file.',
      };
    }

    const expired = row.status === 'EXPIRED' || (!!row.expiresAt && row.expiresAt < new Date());
    const payload = row.payload as any;

    return {
      valid: !expired,
      expired,
      missing: false,
      readOnly: expired,
      plan: row.plan,
      maxAssets: row.maxAssets,
      maxUsers: row.maxUsers,
      allowedModules: Array.isArray(row.allowedModules) ? (row.allowedModules as string[]) : null,
      expiresAt: row.expiresAt,
      licenseKey: row.licenseKey,
      customerName: payload?.customerName || null,
      status: expired ? 'EXPIRED' : row.status,
      deploymentMode: 'onprem',
      message: expired
        ? 'Product license expired. Admins can log in to renew; discovery and agent enroll are blocked.'
        : undefined,
    };
  }

  async getInstanceStatus() {
    const entitlement = await this.getEffectiveEntitlement();
    if (!isOnPrem()) return entitlement;
    const installId = await this.ensureInstallId();
    const row = await this.prisma.instanceEntitlement.findUnique({ where: { installId } });
    return {
      ...entitlement,
      installId,
      fingerprint: this.hashInstall(installId),
      activationMode: row?.activationMode || null,
      lastValidatedAt: row?.lastValidatedAt || null,
      challenge: row?.challengeNonce && row.challengeExpiresAt
        ? {
            version: 1,
            installId,
            fingerprint: this.hashInstall(installId),
            nonce: row.challengeNonce,
            pending: row.challengeExpiresAt > new Date(),
            expiresAt: row.challengeExpiresAt,
          }
        : null,
    };
  }

  async assertOperationalLicense(): Promise<void> {
    if (!isOnPrem()) return;
    const ent = await this.getEffectiveEntitlement();
    if (ent.missing || ent.expired || !ent.valid) {
      throw new ForbiddenException(
        ent.message || 'A valid product license is required for this operation.',
      );
    }
  }

  /** Merge entitlement into module resolution for on-prem */
  resolveModulesForTenant(plan: TenantPlan, settings: any): ModuleKey[] {
    if (!isOnPrem()) {
      return getResolvedModules(plan, settings);
    }
    const base = getResolvedModules(plan, settings);
    const licensedModules = Array.isArray(settings?.productLicenseAllowedModules)
      ? settings.productLicenseAllowedModules
      : Array.isArray(settings?.customAllowedModules)
        ? settings.customAllowedModules
        : null;
    const licensed = licensedModules ? new Set(licensedModules) : null;
    return licensed ? base.filter((module) => licensed.has(module)) : base;
  }

  async getResolvedModulesAsync(plan: TenantPlan, settings: any): Promise<ModuleKey[]> {
    if (!isOnPrem()) return getResolvedModules(plan, settings);
    const ent = await this.getEffectiveEntitlement();
    if (ent.missing) {
      return (ent.allowedModules || ['DASHBOARD', 'SETTINGS', 'USERS', 'HELP']) as ModuleKey[];
    }
    if (ent.expired) {
      // Keep SETTINGS so they can renew
      const keep = new Set(['DASHBOARD', 'SETTINGS', 'USERS', 'HELP', 'MY_PORTAL']);
      return getResolvedModules(plan, settings).filter((m) => keep.has(m));
    }
    if (ent.allowedModules?.length) {
      const licensed = new Set(ent.allowedModules);
      return getResolvedModules(plan, settings).filter((module) => licensed.has(module));
    }
    return getResolvedModules(plan, settings);
  }

  getDeploymentInfo() {
    return {
      deploymentMode: isOnPrem() ? 'onprem' : 'saas',
      publicSignupDisabled: isPublicSignupDisabled(),
      licenseServerConfigured: !!getLicenseServerUrl(),
      installId: this.installId,
    };
  }
}
