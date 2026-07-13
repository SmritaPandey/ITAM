import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import mqtt, { MqttClient } from 'mqtt';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

export interface CreateMqttConfigDto {
  name: string;
  brokerUrl: string;
  username?: string;
  password?: string;
  topics?: string[];
  enabled?: boolean;
}

export interface UpdateMqttConfigDto {
  name?: string;
  brokerUrl?: string;
  username?: string;
  password?: string;
  topics?: string[];
  enabled?: boolean;
}

interface MqttDevicePayload {
  hostname?: string;
  host?: string;
  name?: string;
  serialNumber?: string;
  serial?: string;
  deviceId?: string;
  manufacturer?: string;
  model?: string;
  ipAddress?: string;
  ip?: string;
  macAddress?: string;
  mac?: string;
  discoverySource?: 'IOT' | 'AGENTLESS';
  [key: string]: unknown;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  /** Active broker connections keyed by MqttBrokerConfig.id */
  private readonly clients = new Map<string, MqttClient>();

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  async onModuleInit() {
    // Defer broker reconnects so Nest can bind HTTP first
    setTimeout(() => {
      this.autoConnectBrokers().catch((err: any) =>
        this.logger.warn(`MQTT auto-connect skipped: ${err.message}`),
      );
    }, 3000);
  }

  private async autoConnectBrokers() {
    const configs = await this.prisma.mqttBrokerConfig.findMany({
      where: { enabled: true },
    });
    for (const config of configs) {
      try {
        await this.connectBroker(config.id);
      } catch (err: any) {
        this.logger.warn(
          `Failed to auto-connect MQTT broker "${config.name}" (${config.id}): ${err.message}`,
        );
      }
    }
    if (configs.length > 0) {
      this.logger.log(`MQTT: attempted connect for ${configs.length} enabled broker(s)`);
    }
  }

  onModuleDestroy() {
    for (const [id, client] of this.clients) {
      try {
        client.end(true);
      } catch {
        /* ignore */
      }
      this.clients.delete(id);
    }
  }

  // ─── CRUD ──────────────────────────────────────────────────────

  async listConfigs(tenantId: string) {
    const configs = await this.prisma.mqttBrokerConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return configs.map((c) => this.sanitize(c));
  }

  async getConfig(tenantId: string, id: string) {
    const config = await this.findOwned(tenantId, id);
    return this.sanitize(config);
  }

  async createConfig(tenantId: string, dto: CreateMqttConfigDto) {
    if (!dto.name?.trim() || !dto.brokerUrl?.trim()) {
      throw new BadRequestException('name and brokerUrl are required');
    }
    const topics = dto.topics?.length ? dto.topics : ['devices/+/telemetry'];
    const config = await this.prisma.mqttBrokerConfig.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        brokerUrl: dto.brokerUrl.trim(),
        username: dto.username || null,
        password: dto.password || null,
        topics,
        enabled: dto.enabled !== false,
      },
    });
    if (config.enabled) {
      try {
        await this.connectBroker(config.id);
      } catch (err: any) {
        this.logger.warn(`Created MQTT config but connect failed: ${err.message}`);
      }
    }
    return this.sanitize(config);
  }

  async updateConfig(tenantId: string, id: string, dto: UpdateMqttConfigDto) {
    await this.findOwned(tenantId, id);
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.brokerUrl !== undefined) data.brokerUrl = dto.brokerUrl.trim();
    if (dto.username !== undefined) data.username = dto.username || null;
    if (dto.password !== undefined) data.password = dto.password || null;
    if (dto.topics !== undefined) data.topics = dto.topics;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;

    const config = await this.prisma.mqttBrokerConfig.update({
      where: { id },
      data,
    });

    // Reconnect if running or if newly enabled
    if (this.clients.has(id) || config.enabled) {
      await this.disconnectBroker(id);
      if (config.enabled) {
        try {
          await this.connectBroker(id);
        } catch (err: any) {
          this.logger.warn(`Updated MQTT config but reconnect failed: ${err.message}`);
        }
      }
    }

    return this.sanitize(config);
  }

  async deleteConfig(tenantId: string, id: string) {
    await this.findOwned(tenantId, id);
    await this.disconnectBroker(id);
    await this.prisma.mqttBrokerConfig.delete({ where: { id } });
    return { deleted: true, id };
  }

  async startBroker(tenantId: string, id: string) {
    const config = await this.findOwned(tenantId, id);
    if (!config.enabled) {
      await this.prisma.mqttBrokerConfig.update({
        where: { id },
        data: { enabled: true },
      });
    }
    await this.connectBroker(id);
    return { id, status: 'connected', connected: true };
  }

  async stopBroker(tenantId: string, id: string) {
    await this.findOwned(tenantId, id);
    await this.disconnectBroker(id);
    await this.prisma.mqttBrokerConfig.update({
      where: { id },
      data: { enabled: false },
    });
    return { id, status: 'stopped', connected: false };
  }

  getConnectionStatus(tenantId: string, id?: string) {
    if (id) {
      const client = this.clients.get(id);
      return {
        id,
        connected: !!client?.connected,
        status: client?.connected ? 'connected' : 'disconnected',
      };
    }
    // Caller should filter by tenant via list; return all active for owned configs
    return Array.from(this.clients.entries()).map(([configId, client]) => ({
      id: configId,
      connected: !!client.connected,
      status: client.connected ? 'connected' : 'disconnected',
    }));
  }

  // ─── Connection management ─────────────────────────────────────

  async connectBroker(configId: string): Promise<void> {
    if (this.clients.has(configId)) {
      const existing = this.clients.get(configId)!;
      if (existing.connected) return;
      await this.disconnectBroker(configId);
    }

    const config = await this.prisma.mqttBrokerConfig.findUnique({ where: { id: configId } });
    if (!config) throw new NotFoundException('MQTT broker config not found');

    const topics = this.normalizeTopics(config.topics);

    return new Promise((resolve, reject) => {
      let settled = false;
      const client = mqtt.connect(config.brokerUrl, {
        username: config.username || undefined,
        password: config.password || undefined,
        reconnectPeriod: 5000,
        connectTimeout: 15000,
        clientId: `qs-asset-${config.tenantId.slice(0, 8)}-${configId.slice(0, 8)}`,
      });

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        try {
          client.end(true);
        } catch {
          /* ignore */
        }
        this.clients.delete(configId);
        reject(err);
      };

      const timer = setTimeout(() => {
        fail(new Error(`MQTT connect timeout for ${config.brokerUrl}`));
      }, 20000);

      client.on('connect', () => {
        this.logger.log(`MQTT connected: ${config.name} (${config.brokerUrl})`);
        for (const topic of topics) {
          client.subscribe(topic, (err) => {
            if (err) {
              this.logger.warn(`MQTT subscribe failed [${topic}]: ${err.message}`);
            } else {
              this.logger.debug(`MQTT subscribed: ${topic}`);
            }
          });
        }
        this.clients.set(configId, client);
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve();
        }
      });

      client.on('message', (topic, payload) => {
        void this.handleMessage(config.tenantId, configId, topic, payload);
      });

      client.on('error', (err) => {
        this.logger.warn(`MQTT error [${config.name}]: ${err.message}`);
        if (!settled) fail(err);
      });

      client.on('close', () => {
        this.logger.debug(`MQTT closed: ${config.name}`);
      });

      client.on('offline', () => {
        this.logger.debug(`MQTT offline: ${config.name}`);
      });
    });
  }

  async disconnectBroker(configId: string): Promise<void> {
    const client = this.clients.get(configId);
    if (!client) return;
    await new Promise<void>((resolve) => {
      try {
        client.end(false, {}, () => resolve());
      } catch {
        resolve();
      }
      // Ensure we don't hang if end never callbacks
      setTimeout(resolve, 3000);
    });
    this.clients.delete(configId);
  }

  // ─── Message ingest ────────────────────────────────────────────

  private async handleMessage(
    tenantId: string,
    configId: string,
    topic: string,
    raw: Buffer,
  ): Promise<void> {
    try {
      const text = raw.toString('utf8').trim();
      if (!text) return;

      let payload: MqttDevicePayload;
      try {
        payload = JSON.parse(text) as MqttDevicePayload;
      } catch {
        // Non-JSON: treat topic leaf as device id and raw as a heartbeat
        const leaf = topic.split('/').filter(Boolean).pop() || topic;
        payload = { hostname: leaf, name: leaf, deviceId: leaf };
      }

      const hostname =
        this.asString(payload.hostname) ||
        this.asString(payload.host) ||
        this.asString(payload.deviceId) ||
        topic.split('/').filter(Boolean).pop();
      const serialNumber =
        this.asString(payload.serialNumber) ||
        this.asString(payload.serial) ||
        this.asString(payload.deviceId);
      const name =
        this.asString(payload.name) || hostname || serialNumber || `IoT device (${topic})`;

      if (!hostname && !serialNumber) {
        this.logger.debug(`MQTT message on ${topic} missing hostname/serial — skipped`);
        return;
      }

      const discoverySource =
        payload.discoverySource === 'AGENTLESS' ? 'AGENTLESS' : 'IOT';

      await this.upsertAsset(tenantId, {
        name: name!,
        hostname: hostname || null,
        serialNumber: serialNumber || null,
        manufacturer: this.asString(payload.manufacturer),
        model: this.asString(payload.model),
        ipAddress: this.asString(payload.ipAddress) || this.asString(payload.ip),
        macAddress: this.asString(payload.macAddress) || this.asString(payload.mac),
        discoverySource,
        topic,
        configId,
        raw: payload,
      });
    } catch (err: any) {
      this.logger.warn(`MQTT ingest error [${topic}]: ${err.message}`);
    }
  }

  private async upsertAsset(
    tenantId: string,
    data: {
      name: string;
      hostname: string | null;
      serialNumber: string | null;
      manufacturer: string | null;
      model: string | null;
      ipAddress: string | null;
      macAddress: string | null;
      discoverySource: 'IOT' | 'AGENTLESS';
      topic: string;
      configId: string;
      raw: MqttDevicePayload;
    },
  ) {
    const or: Array<Record<string, unknown>> = [];
    if (data.serialNumber) or.push({ serialNumber: data.serialNumber });
    if (data.hostname) or.push({ hostname: data.hostname });

    let existing = or.length
      ? await this.prisma.asset.findFirst({
          where: { tenantId, deletedAt: null, OR: or },
        })
      : null;

    const customFields = {
      ...((existing?.customFields as Record<string, unknown>) || {}),
      mqtt: {
        topic: data.topic,
        brokerConfigId: data.configId,
        lastPayloadAt: new Date().toISOString(),
        lastKeys: Object.keys(data.raw).slice(0, 40),
      },
    };

    if (existing) {
      await this.prisma.asset.update({
        where: { id: existing.id },
        data: {
          lastScannedAt: new Date(),
          status: existing.status === 'DISCOVERED' ? 'ACTIVE' : existing.status,
          discoverySource: data.discoverySource,
          ipAddress: data.ipAddress || existing.ipAddress,
          macAddress: data.macAddress || existing.macAddress,
          manufacturer: data.manufacturer || existing.manufacturer,
          model: data.model || existing.model,
          hostname: data.hostname || existing.hostname,
          serialNumber: data.serialNumber || existing.serialNumber,
          customFields,
        },
      });
      return;
    }

    const assetType = await this.resolveIotAssetType(tenantId);
    const created = await this.prisma.asset.create({
      data: {
        tenantId,
        assetTypeId: assetType.id,
        name: data.name,
        hostname: data.hostname,
        serialNumber: data.serialNumber,
        manufacturer: data.manufacturer,
        model: data.model,
        ipAddress: data.ipAddress,
        macAddress: data.macAddress,
        status: 'DISCOVERED',
        category: 'IoT Device',
        discoverySource: data.discoverySource,
        lastScannedAt: new Date(),
        customFields,
        tags: ['iot', 'mqtt'],
      },
    });

    this.eventBus.emitDiscoveryEvent(tenantId, 'mqtt_device_discovered', {
      assetId: created.id,
      name: created.name,
      hostname: created.hostname,
      serialNumber: created.serialNumber,
      topic: data.topic,
      source: data.discoverySource,
    });
  }

  private async resolveIotAssetType(tenantId: string) {
    let assetType = await this.prisma.assetType.findFirst({
      where: {
        tenantId,
        OR: [
          { name: { equals: 'IoT Device', mode: 'insensitive' } },
          { name: { contains: 'IoT', mode: 'insensitive' } },
        ],
      },
    });
    if (!assetType) {
      assetType = await this.prisma.assetType.create({
        data: { tenantId, name: 'IoT Device', icon: 'cpu' },
      });
    }
    return assetType;
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private async findOwned(tenantId: string, id: string) {
    const config = await this.prisma.mqttBrokerConfig.findFirst({
      where: { id, tenantId },
    });
    if (!config) throw new NotFoundException('MQTT broker config not found');
    return config;
  }

  private sanitize(config: {
    id: string;
    tenantId: string;
    name: string;
    brokerUrl: string;
    username: string | null;
    password: string | null;
    topics: unknown;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const client = this.clients.get(config.id);
    return {
      id: config.id,
      tenantId: config.tenantId,
      name: config.name,
      brokerUrl: config.brokerUrl,
      username: config.username,
      hasPassword: !!config.password,
      topics: this.normalizeTopics(config.topics),
      enabled: config.enabled,
      connected: !!client?.connected,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  private normalizeTopics(topics: unknown): string[] {
    if (Array.isArray(topics)) {
      return topics.map(String).filter(Boolean);
    }
    if (typeof topics === 'string') {
      try {
        const parsed = JSON.parse(topics);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      } catch {
        return [topics];
      }
    }
    return ['devices/+/telemetry'];
  }

  private asString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
    return null;
  }
}
