import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Client } from 'ldapts';
import { PrismaService } from '../../common/database/prisma.service';
import { CredentialVaultService } from './credential-vault.service';
import { openVaultValue, sealVaultValue } from '../../common/security/vault-crypto';

export interface AdSyncConfig {
  enabled?: boolean;
  host?: string;
  port?: number;
  useTls?: boolean;
  bindDn?: string;
  /** Prefer vaulted credential id over plaintext password */
  credentialId?: string;
  password?: string;
  baseDns?: string[];
  computerFilter?: string;
  userFilter?: string;
  /** cron expression, default every 6 hours */
  schedule?: string;
  lastSyncAt?: string;
  lastSyncStatus?: string;
}

@Injectable()
export class AdSyncService {
  private readonly logger = new Logger(AdSyncService.name);

  constructor(
    private prisma: PrismaService,
    private credentialVault: CredentialVaultService,
  ) {}

  async getConfig(tenantId: string): Promise<AdSyncConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as Record<string, any>) || {};
    const cfg = (settings.adSync || {}) as AdSyncConfig;
    return {
      enabled: !!cfg.enabled,
      host: cfg.host || '',
      port: cfg.port || (cfg.useTls ? 636 : 389),
      useTls: !!cfg.useTls,
      bindDn: cfg.bindDn || '',
      credentialId: cfg.credentialId,
      baseDns: Array.isArray(cfg.baseDns) ? cfg.baseDns : [],
      computerFilter: cfg.computerFilter || '(objectClass=computer)',
      userFilter: cfg.userFilter || '(&(objectClass=user)(!(objectClass=computer)))',
      schedule: cfg.schedule || '0 */6 * * *',
      lastSyncAt: cfg.lastSyncAt,
      lastSyncStatus: cfg.lastSyncStatus,
      // never return password
    };
  }

  async updateConfig(tenantId: string, patch: Partial<AdSyncConfig>) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const existing = (tenant.settings as Record<string, any>) || {};
    const prev = (existing.adSync || {}) as AdSyncConfig;
    const next: AdSyncConfig = {
      ...prev,
      ...patch,
      baseDns: patch.baseDns !== undefined ? patch.baseDns : prev.baseDns,
    };
    if (typeof patch.password === 'string' && patch.password) {
      next.password = sealVaultValue(patch.password);
    }
    // Strip empty password so we don't wipe a stored one accidentally
    if (patch.password === '' || patch.password === undefined) {
      delete (next as any).password;
      if (prev.password) next.password = prev.password;
    }
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...existing, adSync: next } as any },
    });

    // Optionally mirror schedule into ScheduledScan for visibility
    if (next.enabled && next.schedule && next.host) {
      const existingSched = await this.prisma.scheduledScan.findFirst({
        where: { tenantId, scanType: 'AD_LDAP_SYNC', name: 'Active Directory Sync' },
      });
      if (existingSched) {
        await this.prisma.scheduledScan.update({
          where: { id: existingSched.id },
          data: {
            schedule: next.schedule,
            isActive: true,
            subnet: next.baseDns?.join(';') || next.host,
          },
        });
      } else {
        // createdById required — use first admin if available
        const admin = await this.prisma.user.findFirst({
          where: { tenantId, deletedAt: null },
          select: { id: true },
        });
        if (admin) {
          await this.prisma.scheduledScan.create({
            data: {
              tenantId,
              name: 'Active Directory Sync',
              subnet: next.baseDns?.join(';') || next.host,
              scanType: 'AD_LDAP_SYNC',
              schedule: next.schedule,
              isActive: true,
              createdById: admin.id,
            },
          });
        }
      }
    }

    return this.getConfig(tenantId);
  }

  async sync(tenantId: string, userId?: string) {
    const cfg = await this.loadFullConfig(tenantId);
    if (!cfg.host || !cfg.bindDn) {
      throw new BadRequestException(
        'AD sync not configured. Set host, bindDn, and baseDns (and credentialId or password) in settings.adSync.',
      );
    }
    const baseDns = cfg.baseDns?.filter(Boolean) || [];
    if (baseDns.length === 0) {
      throw new BadRequestException('At least one base DN (OU) is required in settings.adSync.baseDns');
    }

    const password = await this.resolvePassword(tenantId, cfg);
    const url = `${cfg.useTls ? 'ldaps' : 'ldap'}://${cfg.host}:${cfg.port || (cfg.useTls ? 636 : 389)}`;
    const client = new Client({ url, timeout: 30000, connectTimeout: 15000 });

    let computers = 0;
    let users = 0;
    try {
      await client.bind(cfg.bindDn!, password);

      const assetType = await this.ensureAssetType(tenantId, 'AD Computer', 'computer');

      for (const baseDn of baseDns) {
        // Computers
        const computerResult = await client.search(baseDn, {
          scope: 'sub',
          filter: cfg.computerFilter || '(objectClass=computer)',
          attributes: [
            'cn',
            'dNSHostName',
            'name',
            'sAMAccountName',
            'operatingSystem',
            'operatingSystemVersion',
            'whenCreated',
            'userAccountControl',
            'distinguishedName',
          ],
          paged: true,
          sizeLimit: 0,
        });

        for (const entry of computerResult.searchEntries) {
          const hostname =
            String(entry.dNSHostName || entry.cn || entry.name || entry.sAMAccountName || '')
              .replace(/\$$/, '')
              .trim();
          if (!hostname) continue;
          const sam = String(entry.sAMAccountName || '').replace(/\$$/, '');
          const uac = Number(entry.userAccountControl || 0);
          const disabled = (uac & 0x2) !== 0;
          const osName = entry.operatingSystem
            ? `${entry.operatingSystem}${entry.operatingSystemVersion ? ' ' + entry.operatingSystemVersion : ''}`
            : null;

          const existing = await this.prisma.asset.findFirst({
            where: {
              tenantId,
              deletedAt: null,
              OR: [
                { hostname: { equals: hostname, mode: 'insensitive' } },
                ...(sam
                  ? [{ hostname: { equals: sam, mode: 'insensitive' as const } }]
                  : []),
                {
                  customFields: {
                    path: ['adSamAccountName'],
                    equals: sam || hostname,
                  },
                },
              ],
            },
          });

          const payload = {
            name: hostname,
            hostname,
            manufacturer: 'Active Directory',
            model: osName,
            category: 'Endpoint',
            status: disabled ? ('PENDING_REVIEW' as const) : ('ACTIVE' as const),
            discoverySource: 'ACTIVE_DIRECTORY' as const,
            lastScannedAt: new Date(),
            customFields: {
              adSamAccountName: sam || hostname,
              adDistinguishedName: entry.distinguishedName || null,
              adDisabled: disabled,
              adSourceOu: baseDn,
            },
          };

          if (existing) {
            await this.prisma.asset.update({
              where: { id: existing.id },
              data: {
                ...payload,
                customFields: {
                  ...((existing.customFields as object) || {}),
                  ...payload.customFields,
                },
              },
            });
          } else {
            await this.prisma.asset.create({
              data: {
                tenantId,
                assetTypeId: assetType.id,
                createdById: userId || null,
                ...payload,
              },
            });
          }
          computers++;
        }

        // Users
        const userResult = await client.search(baseDn, {
          scope: 'sub',
          filter: cfg.userFilter || '(&(objectClass=user)(!(objectClass=computer)))',
          attributes: [
            'cn',
            'mail',
            'givenName',
            'sn',
            'sAMAccountName',
            'userPrincipalName',
            'userAccountControl',
            'department',
            'telephoneNumber',
            'distinguishedName',
          ],
          paged: true,
          sizeLimit: 0,
        });

        const viewerRole = await this.prisma.role.findFirst({
          where: {
            tenantId,
            OR: [
              { name: { equals: 'Viewer', mode: 'insensitive' } },
              { name: { equals: 'Employee', mode: 'insensitive' } },
              { name: { equals: 'User', mode: 'insensitive' } },
            ],
          },
        });
        const fallbackRole =
          viewerRole ||
          (await this.prisma.role.findFirst({ where: { tenantId } }));

        for (const entry of userResult.searchEntries) {
          const sam = String(entry.sAMAccountName || '').trim();
          const email = String(
            entry.mail || entry.userPrincipalName || (sam ? `${sam}@ad.local` : ''),
          )
            .trim()
            .toLowerCase();
          if (!email && !sam) continue;
          const firstName = String(entry.givenName || entry.cn || sam || 'AD').split(' ')[0];
          const lastName = String(entry.sn || 'User');
          const uac = Number(entry.userAccountControl || 0);
          const disabled = (uac & 0x2) !== 0;

          if (!fallbackRole) {
            this.logger.warn(`No role found for tenant ${tenantId}; skipping AD user upsert`);
            break;
          }

          const existing = await this.prisma.user.findFirst({
            where: {
              tenantId,
              deletedAt: null,
              OR: [
                ...(email ? [{ email }] : []),
                {
                  preferences: {
                    path: ['adSamAccountName'],
                    equals: sam,
                  },
                },
              ],
            },
          });

          const prefs = {
            adSamAccountName: sam,
            adDistinguishedName: entry.distinguishedName || null,
            adSynced: true,
            adSourceOu: baseDn,
          };

          if (existing) {
            await this.prisma.user.update({
              where: { id: existing.id },
              data: {
                firstName: existing.firstName || firstName,
                lastName: existing.lastName || lastName,
                phone: entry.telephoneNumber
                  ? String(entry.telephoneNumber)
                  : existing.phone,
                status: disabled ? 'INACTIVE' : existing.status,
                preferences: {
                  ...((existing.preferences as object) || {}),
                  ...prefs,
                },
              },
            });
          } else if (email) {
            await this.prisma.user.create({
              data: {
                tenantId,
                email,
                firstName,
                lastName,
                phone: entry.telephoneNumber ? String(entry.telephoneNumber) : null,
                roleId: fallbackRole.id,
                status: disabled ? 'INACTIVE' : 'ACTIVE',
                emailVerified: true,
                oauthProvider: 'active_directory',
                oauthProviderId: sam || email,
                preferences: prefs,
              },
            });
          }
          users++;
        }
      }

      const status = `OK: ${computers} computers, ${users} users`;
      await this.persistSyncStatus(tenantId, status);
      this.logger.log(`AD sync ${tenantId}: ${status}`);
      return { computers, users, status };
    } catch (err: any) {
      const msg = err.message || String(err);
      await this.persistSyncStatus(tenantId, `ERROR: ${msg}`);
      throw new BadRequestException(`AD/LDAP sync failed: ${msg}`);
    } finally {
      try {
        await client.unbind();
      } catch {
        /* ignore */
      }
    }
  }

  /** Hourly tick — runs AD sync for tenants whose cron matches (simple hour-based check). */
  @Cron('0 * * * *')
  async scheduledSyncTick() {
    if (process.env.DISABLE_CRON_JOBS === 'true') return;
    try {
      const tenants = await this.prisma.tenant.findMany({
        select: { id: true, settings: true },
      });
      const hour = new Date().getUTCHours();
      for (const t of tenants) {
        const cfg = ((t.settings as any)?.adSync || {}) as AdSyncConfig;
        if (!cfg.enabled || !cfg.host) continue;
        // Default every 6 hours at :00 UTC; honor simple "0 */N * * *" patterns
        const schedule = cfg.schedule || '0 */6 * * *';
        const match = schedule.match(/^\d+\s+\*\/(\d+)/);
        const every = match ? parseInt(match[1], 10) : 6;
        if (hour % every !== 0) continue;
        try {
          await this.sync(t.id);
        } catch (err: any) {
          this.logger.warn(`Scheduled AD sync failed for ${t.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`AD scheduled sync tick error: ${err.message}`);
    }
  }

  private async loadFullConfig(tenantId: string): Promise<AdSyncConfig> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    return ((tenant?.settings as any)?.adSync || {}) as AdSyncConfig;
  }

  private async resolvePassword(tenantId: string, cfg: AdSyncConfig): Promise<string> {
    if (cfg.credentialId) {
      try {
        const creds = await this.credentialVault.getDecrypted(cfg.credentialId, tenantId);
        const pw = creds?.password || creds?.bindPassword || creds?.secret;
        if (pw) return String(pw);
      } catch (err: any) {
        this.logger.warn(`AD credential vault lookup failed: ${err.message}`);
      }
    }
    if (cfg.password) return openVaultValue(cfg.password);
    throw new BadRequestException(
      'AD bind password missing. Set credentialId (vault) or password in settings.adSync.',
    );
  }

  private async persistSyncStatus(tenantId: string, status: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return;
    const existing = (tenant.settings as Record<string, any>) || {};
    const adSync = { ...(existing.adSync || {}), lastSyncAt: new Date().toISOString(), lastSyncStatus: status };
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...existing, adSync } },
    });
  }

  private async ensureAssetType(tenantId: string, name: string, icon: string) {
    let assetType = await this.prisma.assetType.findFirst({
      where: { tenantId, name: { equals: name, mode: 'insensitive' } },
    });
    if (!assetType) {
      assetType = await this.prisma.assetType.create({
        data: { tenantId, name, icon },
      });
    }
    return assetType;
  }
}
