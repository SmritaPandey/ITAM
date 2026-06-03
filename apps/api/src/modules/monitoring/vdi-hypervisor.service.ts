import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

/**
 * Hypervisor connection configuration
 */
export interface HypervisorConfig {
  type: 'vmware-horizon' | 'vmware-vcenter' | 'proxmox' | 'hyper-v';
  host: string;
  port: number;
  username: string;
  password: string;
  domain?: string;
  ssl?: boolean;
  verifySsl?: boolean;
}

export interface VmInfo {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'suspended' | 'error';
  os: string;
  host: string;
  pool: string;
  cpu: number;    // vCPUs
  ramMb: number;  // Allocated RAM in MB
  diskGb: number; // Allocated disk in GB
  cpuUsage: number | null;  // Current CPU usage %
  ramUsage: number | null;  // Current RAM usage %
  diskUsage: number | null; // Current disk usage %
  uptime?: string;
  ipAddress?: string;
  assignedUser?: string;
}

export interface HypervisorSyncResult {
  hypervisor: string;
  totalVMs: number;
  created: number;
  updated: number;
  removed: number;
}

@Injectable()
export class VdiHypervisorService {
  private readonly logger = new Logger(VdiHypervisorService.name);
  private authTokens: Map<string, { token: string; expiresAt: Date }> = new Map();

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  // ─── VMware Horizon REST API ─────────────────────────────────────

  /**
   * Authenticate to VMware Horizon Connection Server
   */
  async horizonLogin(config: HypervisorConfig): Promise<string> {
    const cached = this.authTokens.get(`horizon:${config.host}`);
    if (cached && cached.expiresAt > new Date()) return cached.token;

    const body = JSON.stringify({
      domain: config.domain || 'DOMAIN',
      username: config.username,
      password: config.password,
    });

    const response = await this.apiRequest(config, 'POST', '/rest/login', body);
    const token = response?.access_token;

    if (!token) throw new Error('Horizon authentication failed — no access_token returned');

    // Cache for 30 minutes
    this.authTokens.set(`horizon:${config.host}`, {
      token,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    this.logger.log(`Authenticated to VMware Horizon at ${config.host}`);
    return token;
  }

  /**
   * List all desktop pools from VMware Horizon
   */
  async horizonGetPools(config: HypervisorConfig): Promise<any[]> {
    const token = await this.horizonLogin(config);
    const pools = await this.apiRequest(config, 'GET', '/rest/inventory/v1/desktop-pools', undefined, token);
    return Array.isArray(pools) ? pools : [];
  }

  /**
   * List all machine instances from VMware Horizon
   */
  async horizonGetMachines(config: HypervisorConfig): Promise<VmInfo[]> {
    const token = await this.horizonLogin(config);
    const machines = await this.apiRequest(config, 'GET', '/rest/inventory/v1/machines', undefined, token);

    if (!Array.isArray(machines)) return [];

    return machines.map((m: any) => ({
      id: m.id,
      name: m.name || m.dns_name || m.machine_id,
      status: this.mapHorizonStatus(m.basic_state),
      os: m.operating_system || 'Unknown',
      host: m.host_name || 'Unknown Host',
      pool: m.desktop_pool_id || 'Default',
      cpu: m.virtual_center_data?.num_cpus || 0,
      ramMb: m.virtual_center_data?.memory_mb || 0,
      diskGb: Math.round((m.virtual_center_data?.disk_space_mb || 0) / 1024),
      cpuUsage: null, // Horizon doesn't provide real-time usage in this endpoint
      ramUsage: null,
      diskUsage: null,
      ipAddress: m.agent_data?.ip_v4,
      assignedUser: m.user?.name,
    }));
  }

  private mapHorizonStatus(state: string): VmInfo['status'] {
    const running = ['AVAILABLE', 'CONNECTED', 'IN_PROGRESS', 'PROVISIONED'];
    const suspended = ['MAINTENANCE', 'AGENT_UNREACHABLE', 'WAIT_FOR_AGENT'];
    if (running.includes(state)) return 'running';
    if (suspended.includes(state)) return 'suspended';
    if (state === 'ERROR' || state === 'AGENT_ERROR') return 'error';
    return 'stopped';
  }

  // ─── Proxmox VE REST API ─────────────────────────────────────────

  /**
   * Authenticate to Proxmox VE
   */
  async proxmoxLogin(config: HypervisorConfig): Promise<{ ticket: string; csrfToken: string }> {
    const cached = this.authTokens.get(`proxmox:${config.host}`);
    if (cached && cached.expiresAt > new Date()) {
      return { ticket: cached.token, csrfToken: '' };
    }

    const body = `username=${encodeURIComponent(config.username)}@pam&password=${encodeURIComponent(config.password)}`;
    const response = await this.apiRequest(
      { ...config, ssl: true, verifySsl: false },
      'POST', '/api2/json/access/ticket', body,
      undefined, 'application/x-www-form-urlencoded',
    );

    const ticket = response?.data?.ticket;
    const csrfToken = response?.data?.CSRFPreventionToken;

    if (!ticket) throw new Error('Proxmox authentication failed');

    this.authTokens.set(`proxmox:${config.host}`, {
      token: ticket,
      expiresAt: new Date(Date.now() + 120 * 60 * 1000), // 2 hours
    });

    return { ticket, csrfToken };
  }

  /**
   * List all VMs across Proxmox nodes
   */
  async proxmoxGetVMs(config: HypervisorConfig): Promise<VmInfo[]> {
    const { ticket } = await this.proxmoxLogin(config);

    // Get all nodes
    const nodesRes = await this.apiRequest(
      { ...config, ssl: true, verifySsl: false },
      'GET', '/api2/json/nodes', undefined,
      undefined, undefined, `PVEAuthCookie=${ticket}`,
    );

    const nodes = nodesRes?.data || [];
    const vms: VmInfo[] = [];

    for (const node of nodes) {
      const nodeVMs = await this.apiRequest(
        { ...config, ssl: true, verifySsl: false },
        'GET', `/api2/json/nodes/${node.node}/qemu`, undefined,
        undefined, undefined, `PVEAuthCookie=${ticket}`,
      );

      for (const vm of (nodeVMs?.data || [])) {
        vms.push({
          id: `${node.node}-${vm.vmid}`,
          name: vm.name || `VM-${vm.vmid}`,
          status: vm.status === 'running' ? 'running' : 'stopped',
          os: vm.lock ? 'Locked' : 'Linux/Windows',
          host: node.node,
          pool: vm.pool || 'Default',
          cpu: vm.cpus || 1,
          ramMb: Math.round((vm.maxmem || 0) / 1024 / 1024),
          diskGb: Math.round((vm.maxdisk || 0) / 1024 / 1024 / 1024),
          cpuUsage: Math.round((vm.cpu || 0) * 100),
          ramUsage: vm.maxmem > 0 ? Math.round(((vm.mem || 0) / vm.maxmem) * 100) : 0,
          diskUsage: vm.maxdisk > 0 ? Math.round(((vm.disk || 0) / vm.maxdisk) * 100) : 0,
          uptime: vm.uptime ? this.formatUptime(vm.uptime) : undefined,
        });
      }
    }

    return vms;
  }

  // ─── Sync to MonitoredDevice ─────────────────────────────────────

  /**
   * Sync VMs from a hypervisor into the MonitoredDevice table
   */
  async syncHypervisor(tenantId: string, config: HypervisorConfig): Promise<HypervisorSyncResult> {
    let vms: VmInfo[] = [];

    try {
      switch (config.type) {
        case 'vmware-horizon':
          vms = await this.horizonGetMachines(config);
          break;
        case 'proxmox':
          vms = await this.proxmoxGetVMs(config);
          break;
        case 'hyper-v':
          throw new NotImplementedException('Hyper-V integration is not yet available. Supported hypervisors: VMware Horizon, Proxmox VE.');
        default:
          this.logger.warn(`Unsupported hypervisor type: ${config.type}`);
          return { hypervisor: config.type, totalVMs: 0, created: 0, updated: 0, removed: 0 };
      }
    } catch (err: any) {
      this.logger.error(`Failed to connect to ${config.type} at ${config.host}: ${err.message}`);
      throw err;
    }

    let created = 0;
    let updated = 0;

    for (const vm of vms) {
      const existing = await this.prisma.monitoredDevice.findFirst({
        where: { tenantId, type: 'VIRTUAL_MACHINE', name: vm.name },
      });

      const deviceData = {
        status: vm.status === 'running' ? 'ONLINE' : 'STOPPED',
        lastSeen: vm.status === 'running' ? new Date() : undefined,
        ipAddress: vm.ipAddress || null,
        config: {
          hypervisor: config.type,
          hypervisorHost: config.host,
          os: vm.os,
          host: vm.host,
          pool: vm.pool,
          vcpus: vm.cpu,
          ramMb: vm.ramMb,
          diskGb: vm.diskGb,
          assignedUser: vm.assignedUser,
        },
        metrics: {
          cpu: vm.cpuUsage,
          ram: vm.ramUsage,
          disk: vm.diskUsage,
          uptime: vm.uptime,
          lastSync: new Date().toISOString(),
        },
      };

      if (existing) {
        await this.prisma.monitoredDevice.update({ where: { id: existing.id }, data: deviceData });
        updated++;
      } else {
        await this.prisma.monitoredDevice.create({
          data: { tenantId, type: 'VIRTUAL_MACHINE', name: vm.name, ...deviceData },
        });
        created++;
      }
    }

    // Remove devices no longer in the hypervisor
    const syncedNames = new Set(vms.map(v => v.name));
    const stale = await this.prisma.monitoredDevice.findMany({
      where: { tenantId, type: 'VIRTUAL_MACHINE' },
    });
    const toRemove = stale.filter(d => !syncedNames.has(d.name) && (d.config as any)?.hypervisorHost === config.host);
    for (const d of toRemove) {
      await this.prisma.monitoredDevice.delete({ where: { id: d.id } });
    }

    if (created > 0 || updated > 0) {
      this.eventBus.emitMonitoringEvent(tenantId, 'vdi_sync_completed', {
        hypervisor: config.type, host: config.host, total: vms.length, created, updated, removed: toRemove.length,
      });
    }

    return { hypervisor: config.type, totalVMs: vms.length, created, updated, removed: toRemove.length };
  }

  /**
   * Get the list of configured hypervisors for a tenant (stored in settings)
   */
  async getHypervisors(tenantId: string): Promise<HypervisorConfig[]> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as any) || {};
    return settings.hypervisors || [];
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private async apiRequest(
    config: HypervisorConfig,
    method: string,
    path: string,
    body?: string,
    authToken?: string,
    contentType = 'application/json',
    cookie?: string,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const isHttps = config.ssl !== false;
      const client = isHttps ? https : http;

      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Accept': 'application/json',
      };
      if (body) headers['Content-Length'] = Buffer.byteLength(body).toString();
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      if (cookie) headers['Cookie'] = cookie;

      const options: any = {
        hostname: config.host,
        port: config.port,
        path,
        method,
        headers,
        timeout: 10000,
      };

      if (isHttps && config.verifySsl === false) {
        options.rejectUnauthorized = false;
      }

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      if (body) req.write(body);
      req.end();
    });
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}
