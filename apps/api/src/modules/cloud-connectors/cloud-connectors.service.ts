import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getVaultKey(): string {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('VAULT_ENCRYPTION_KEY is required in production');
    }
    return 'assetcommand-default-vault-key-32!';
  }
  return key;
}

export interface AwsCreds {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
}

export interface AzureCreds {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId?: string;
}

export interface GcpCreds {
  /** Full service-account JSON (preferred) or individual fields */
  type?: string;
  project_id?: string;
  projectId?: string;
  private_key?: string;
  privateKey?: string;
  client_email?: string;
  clientEmail?: string;
  /** Alternate: entire SA JSON string under `serviceAccountJson` */
  serviceAccountJson?: string | Record<string, unknown>;
}

@Injectable()
export class CloudConnectorsService {
  private readonly logger = new Logger(CloudConnectorsService.name);

  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    const rows = await this.prisma.cloudConnector.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.sanitize(r));
  }

  async get(id: string, tenantId: string) {
    const row = await this.prisma.cloudConnector.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException('Cloud connector not found');
    return this.sanitize(row);
  }

  async create(
    tenantId: string,
    data: {
      provider: string;
      name: string;
      enabled?: boolean;
      credentials: Record<string, string>;
      regions?: string[];
    },
  ) {
    const provider = (data.provider || '').toUpperCase();
    if (!['AWS', 'AZURE', 'GCP'].includes(provider)) {
      throw new BadRequestException('provider must be AWS, AZURE, or GCP');
    }
    if (!data.name?.trim()) throw new BadRequestException('name is required');
    if (!data.credentials || typeof data.credentials !== 'object') {
      throw new BadRequestException('credentials object is required');
    }

    const row = await this.prisma.cloudConnector.create({
      data: {
        tenantId,
        provider,
        name: data.name.trim(),
        enabled: data.enabled ?? true,
        encryptedCreds: this.encrypt(JSON.stringify(data.credentials)),
        regions: data.regions || [],
      },
    });
    return this.sanitize(row);
  }

  async update(
    id: string,
    tenantId: string,
    data: Partial<{
      name: string;
      enabled: boolean;
      credentials: Record<string, string>;
      regions: string[];
    }>,
  ) {
    await this.get(id, tenantId);
    const row = await this.prisma.cloudConnector.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.regions !== undefined ? { regions: data.regions } : {}),
        ...(data.credentials
          ? { encryptedCreds: this.encrypt(JSON.stringify(data.credentials)) }
          : {}),
      },
    });
    return this.sanitize(row);
  }

  async remove(id: string, tenantId: string) {
    await this.get(id, tenantId);
    await this.prisma.cloudConnector.delete({ where: { id } });
    return { deleted: true };
  }

  async sync(id: string, tenantId: string, userId?: string) {
    const connector = await this.prisma.cloudConnector.findFirst({ where: { id, tenantId } });
    if (!connector) throw new NotFoundException('Cloud connector not found');
    if (!connector.enabled) throw new BadRequestException('Connector is disabled');

    try {
      let result: { upserted: number; provider: string; details?: any };
      if (connector.provider === 'AWS') {
        result = await this.syncAws(connector, tenantId, userId);
      } else if (connector.provider === 'AZURE') {
        result = await this.syncAzure(connector, tenantId, userId);
      } else if (connector.provider === 'GCP') {
        result = await this.syncGcp(connector, tenantId, userId);
      } else {
        throw new BadRequestException(`Unsupported provider: ${connector.provider}`);
      }

      await this.prisma.cloudConnector.update({
        where: { id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: `OK: ${result.upserted} assets`,
        },
      });
      return result;
    } catch (err: any) {
      await this.prisma.cloudConnector.update({
        where: { id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: `ERROR: ${err.message}`,
        },
      });
      throw err;
    }
  }

  /**
   * AWS EC2 DescribeInstances via AWS SDK v3 when keys are present.
   */
  async syncAws(connector: any, tenantId: string, userId?: string) {
    const creds = JSON.parse(this.decrypt(connector.encryptedCreds)) as AwsCreds;
    if (!creds.accessKeyId || !creds.secretAccessKey) {
      throw new BadRequestException(
        'AWS credentials incomplete. Provide accessKeyId and secretAccessKey on the connector.',
      );
    }

    let EC2Client: any;
    let DescribeInstancesCommand: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sdk = require('@aws-sdk/client-ec2');
      EC2Client = sdk.EC2Client;
      DescribeInstancesCommand = sdk.DescribeInstancesCommand;
    } catch {
      throw new BadRequestException(
        '@aws-sdk/client-ec2 is not installed. Run npm install @aws-sdk/client-ec2 in apps/api.',
      );
    }

    const regions: string[] = Array.isArray(connector.regions) && connector.regions.length
      ? (connector.regions as string[])
      : [creds.region || process.env.AWS_REGION || 'us-east-1'];

    const assetType = await this.ensureAssetType(tenantId, 'Cloud Instance', 'cloud');
    let upserted = 0;
    const seen: string[] = [];

    for (const region of regions) {
      const client = new EC2Client({
        region,
        credentials: {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          ...(creds.sessionToken ? { sessionToken: creds.sessionToken } : {}),
        },
      });

      let nextToken: string | undefined;
      do {
        const resp = await client.send(
          new DescribeInstancesCommand({ NextToken: nextToken, MaxResults: 100 }),
        );
        nextToken = resp.NextToken;
        for (const reservation of resp.Reservations || []) {
          for (const inst of reservation.Instances || []) {
            const instanceId = inst.InstanceId;
            if (!instanceId) continue;
            seen.push(instanceId);
            const nameTag = (inst.Tags || []).find((t: any) => t.Key === 'Name')?.Value;
            const name = nameTag || instanceId;
            const ip = inst.PrivateIpAddress || inst.PublicIpAddress || null;
            const state = inst.State?.Name || 'unknown';

            const existing = await this.prisma.asset.findFirst({
              where: {
                tenantId,
                deletedAt: null,
                serialNumber: instanceId,
              },
            });

            const payload = {
              name,
              hostname: name,
              ipAddress: ip,
              manufacturer: 'Amazon Web Services',
              model: inst.InstanceType || null,
              serialNumber: instanceId,
              category: 'Cloud',
              status: state === 'running' ? ('ACTIVE' as const) : ('DISCOVERED' as const),
              discoverySource: 'CLOUD' as const,
              lastScannedAt: new Date(),
              customFields: {
                cloudProvider: 'AWS',
                awsInstanceId: instanceId,
                awsRegion: region,
                awsState: state,
                awsAz: inst.Placement?.AvailabilityZone,
                connectorId: connector.id,
              },
            };

            if (existing) {
              await this.prisma.asset.update({
                where: { id: existing.id },
                data: payload,
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
            upserted++;
          }
        }
      } while (nextToken);
    }

    this.logger.log(`AWS sync ${connector.id}: upserted ${upserted} instances across ${regions.join(',')}`);
    return { upserted, provider: 'AWS', regions, instanceIds: seen.slice(0, 50) };
  }

  /**
   * Azure VM sync via ARM REST + OAuth client credentials (no Azure SDK).
   */
  async syncAzure(connector: any, tenantId: string, userId?: string) {
    const creds = JSON.parse(this.decrypt(connector.encryptedCreds)) as AzureCreds;
    if (!creds.tenantId || !creds.clientId || !creds.clientSecret) {
      throw new BadRequestException(
        'Azure credentials incomplete. Provide tenantId, clientId, and clientSecret.',
      );
    }
    const subscriptionId =
      creds.subscriptionId ||
      (Array.isArray(connector.regions) && connector.regions[0]) ||
      process.env.AZURE_SUBSCRIPTION_ID;
    if (!subscriptionId) {
      throw new BadRequestException(
        'Azure subscriptionId is required (in credentials.subscriptionId or connector regions[0]).',
      );
    }

    const token = await this.getAzureAccessToken(creds);
    const assetType = await this.ensureAssetType(tenantId, 'Cloud Instance', 'cloud');
    let upserted = 0;
    const seen: string[] = [];
    let nextLink: string | null =
      `https://management.azure.com/subscriptions/${encodeURIComponent(subscriptionId)}` +
      `/providers/Microsoft.Compute/virtualMachines?api-version=2023-09-01`;

    while (nextLink) {
      const resp = await fetch(nextLink, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new BadRequestException(
          `Azure ARM list VMs failed (${resp.status}): ${body.slice(0, 500) || resp.statusText}`,
        );
      }
      const data = (await resp.json()) as { value?: any[]; nextLink?: string };
      for (const vm of data.value || []) {
        const vmId = vm.vmId || vm.properties?.vmId || vm.id;
        const name = vm.name || vmId;
        if (!vmId && !name) continue;
        const serial = String(vmId || `${subscriptionId}/${name}`);
        seen.push(serial);

        const location = vm.location || null;
        const vmSize = vm.properties?.hardwareProfile?.vmSize || null;
        const powerState =
          (vm.properties?.instanceView?.statuses || [])
            .find((s: any) => String(s.code || '').startsWith('PowerState/'))
            ?.code?.replace('PowerState/', '') ||
          vm.properties?.provisioningState ||
          'unknown';

        let ip: string | null = null;
        const nics = vm.properties?.networkProfile?.networkInterfaces || [];
        // Prefer private IP if already expanded; otherwise leave null (list API often omits NIC expand)
        for (const nic of nics) {
          const configs = nic.properties?.ipConfigurations || [];
          for (const cfg of configs) {
            ip = cfg.properties?.privateIPAddress || cfg.properties?.publicIPAddress?.ipAddress || ip;
          }
        }

        const existing = await this.prisma.asset.findFirst({
          where: { tenantId, deletedAt: null, serialNumber: serial },
        });

        const payload = {
          name,
          hostname: name,
          ipAddress: ip,
          manufacturer: 'Microsoft Azure',
          model: vmSize,
          serialNumber: serial,
          category: 'Cloud',
          status: ['running', 'Succeeded'].includes(powerState) ? ('ACTIVE' as const) : ('DISCOVERED' as const),
          discoverySource: 'CLOUD_AZURE' as const,
          lastScannedAt: new Date(),
          customFields: {
            cloudProvider: 'AZURE',
            azureVmId: serial,
            azureResourceId: vm.id,
            azureLocation: location,
            azureVmSize: vmSize,
            azurePowerState: powerState,
            azureSubscriptionId: subscriptionId,
            connectorId: connector.id,
          },
        };

        if (existing) {
          await this.prisma.asset.update({ where: { id: existing.id }, data: payload });
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
        upserted++;
      }
      nextLink = data.nextLink || null;
    }

    this.logger.log(`Azure sync ${connector.id}: upserted ${upserted} VMs`);
    return { upserted, provider: 'AZURE', subscriptionId, instanceIds: seen.slice(0, 50) };
  }

  /**
   * GCP Compute Engine sync via aggregated instances API + service-account JWT.
   */
  async syncGcp(connector: any, tenantId: string, userId?: string) {
    const raw = JSON.parse(this.decrypt(connector.encryptedCreds)) as GcpCreds;
    const sa = this.normalizeGcpServiceAccount(raw);
    if (!sa.projectId || !sa.clientEmail || !sa.privateKey) {
      throw new BadRequestException(
        'GCP credentials incomplete. Provide a service-account JSON with project_id, client_email, and private_key.',
      );
    }

    const accessToken = await this.getGcpAccessToken(sa);
    const url =
      `https://compute.googleapis.com/compute/v1/projects/${encodeURIComponent(sa.projectId)}/aggregated/instances`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new BadRequestException(
        `GCP Compute aggregated/instances failed (${resp.status}): ${body.slice(0, 500) || resp.statusText}`,
      );
    }

    const data = (await resp.json()) as { items?: Record<string, { instances?: any[]; warning?: any }> };
    const assetType = await this.ensureAssetType(tenantId, 'Cloud Instance', 'cloud');
    let upserted = 0;
    const seen: string[] = [];

    for (const [zoneKey, zoneData] of Object.entries(data.items || {})) {
      for (const inst of zoneData.instances || []) {
        const instanceId = String(inst.id || inst.name);
        if (!instanceId) continue;
        seen.push(instanceId);
        const name = inst.name || instanceId;
        const zone = zoneKey.replace(/^zones\//, '') || inst.zone?.split('/').pop() || null;
        const status = (inst.status || 'UNKNOWN').toLowerCase();
        const nic = (inst.networkInterfaces || [])[0];
        const ip = nic?.networkIP || nic?.accessConfigs?.[0]?.natIP || null;
        const machineType = inst.machineType?.split('/').pop() || null;

        const existing = await this.prisma.asset.findFirst({
          where: { tenantId, deletedAt: null, serialNumber: instanceId },
        });

        const payload = {
          name,
          hostname: name,
          ipAddress: ip,
          manufacturer: 'Google Cloud',
          model: machineType,
          serialNumber: instanceId,
          category: 'Cloud',
          status: status === 'running' ? ('ACTIVE' as const) : ('DISCOVERED' as const),
          discoverySource: 'CLOUD_GCP' as const,
          lastScannedAt: new Date(),
          customFields: {
            cloudProvider: 'GCP',
            gcpInstanceId: instanceId,
            gcpProjectId: sa.projectId,
            gcpZone: zone,
            gcpStatus: inst.status,
            gcpMachineType: machineType,
            connectorId: connector.id,
          },
        };

        if (existing) {
          await this.prisma.asset.update({ where: { id: existing.id }, data: payload });
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
        upserted++;
      }
    }

    this.logger.log(`GCP sync ${connector.id}: upserted ${upserted} instances`);
    return { upserted, provider: 'GCP', projectId: sa.projectId, instanceIds: seen.slice(0, 50) };
  }

  private async getAzureAccessToken(creds: AzureCreds): Promise<string> {
    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(creds.tenantId)}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      scope: 'https://management.azure.com/.default',
      grant_type: 'client_credentials',
    });
    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new BadRequestException(
        `Azure OAuth token request failed (${resp.status}): ${text.slice(0, 400) || resp.statusText}`,
      );
    }
    const json = (await resp.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new BadRequestException('Azure OAuth response missing access_token');
    }
    return json.access_token;
  }

  private normalizeGcpServiceAccount(raw: GcpCreds): {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  } {
    let sa: Record<string, any> = { ...raw };
    if (raw.serviceAccountJson) {
      const parsed =
        typeof raw.serviceAccountJson === 'string'
          ? JSON.parse(raw.serviceAccountJson)
          : raw.serviceAccountJson;
      sa = { ...sa, ...parsed };
    }
    return {
      projectId: String(sa.project_id || sa.projectId || ''),
      clientEmail: String(sa.client_email || sa.clientEmail || ''),
      privateKey: String(sa.private_key || sa.privateKey || '').replace(/\\n/g, '\n'),
    };
  }

  private async getGcpAccessToken(sa: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  }): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const claimSet = Buffer.from(
      JSON.stringify({
        iss: sa.clientEmail,
        scope: 'https://www.googleapis.com/auth/compute.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ).toString('base64url');
    const unsigned = `${header}.${claimSet}`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(unsigned);
    signer.end();
    const signature = signer.sign(sa.privateKey, 'base64url');
    const assertion = `${unsigned}.${signature}`;

    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new BadRequestException(
        `GCP OAuth token request failed (${resp.status}): ${text.slice(0, 400) || resp.statusText}`,
      );
    }
    const json = (await resp.json()) as { access_token?: string };
    if (!json.access_token) {
      throw new BadRequestException('GCP OAuth response missing access_token');
    }
    return json.access_token;
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

  private sanitize(row: any) {
    const { encryptedCreds, ...rest } = row;
    return { ...rest, hasCredentials: !!encryptedCreds };
  }

  private encrypt(text: string): string {
    const vaultKey = getVaultKey();
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(vaultKey, salt, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const vaultKey = getVaultKey();
    const parts = encryptedText.split(':');
    const salt = Buffer.from(parts[0], 'hex');
    const iv = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const key = crypto.scryptSync(vaultKey, salt, 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
