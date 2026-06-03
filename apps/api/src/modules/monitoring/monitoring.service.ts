import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { NmapScanner } from '../../common/scanners/nmap.scanner';
import { SnmpTrapReceiverService } from './snmp-trap-receiver.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as net from 'net';
import { TopologyService } from './topology.service';

const execAsync = promisify(exec);

const PROBE_PORTS = [22, 23, 80, 161, 443, 8080, 8443];
const PORT_NAMES: Record<number, string> = {
  22: 'SSH', 23: 'Telnet', 80: 'HTTP', 161: 'SNMP', 443: 'HTTPS', 8080: 'HTTP-Alt', 8443: 'HTTPS-Alt',
};

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private topologyService: TopologyService,
    @Optional() private trapReceiver?: SnmpTrapReceiverService,
  ) {}

  // ─── Real ICMP Ping ──────────────────────────────────────────────
  private async pingHost(ip: string): Promise<{ alive: boolean; latency?: number }> {
    try {
      const platform = os.platform();
      const cmd = platform === 'win32' ? `ping -n 1 -w 2000 ${ip}` : `ping -c 1 -W 2 ${ip}`;
      const { stdout } = await execAsync(cmd, { timeout: 5000 });
      const match = stdout.match(/time[=<]([\d.]+)/);
      return { alive: true, latency: match ? parseFloat(match[1]) : undefined };
    } catch (err: any) {
      this.logger.debug(`Ping failed for ${ip}: ${err.message || 'unknown error'}`);
      return { alive: false };
    }
  }

  // ─── Real TCP Port Probe ─────────────────────────────────────────
  private probePort(ip: string, port: number, timeout = 2000): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
      socket.on('error', () => { socket.destroy(); resolve(false); });
      socket.connect(port, ip);
    });
  }

  // ─── Scan Single Device ──────────────────────────────────────────
  async probeDevice(id: string, tenantId: string) {
    const device = await this.prisma.monitoredDevice.findFirst({
      where: { id, tenantId, type: 'NETWORK_DEVICE' },
    });
    if (!device) throw new NotFoundException('Network device not found');
    if (!device.ipAddress) return { error: 'No IP address configured', device };

    const ping = await this.pingHost(device.ipAddress);
    const openPorts: { port: number; service: string }[] = [];

    if (ping.alive) {
      const portResults = await Promise.allSettled(
        PROBE_PORTS.map(async (port) => {
          const open = await this.probePort(device.ipAddress!, port);
          return open ? { port, service: PORT_NAMES[port] || `port-${port}` } : null;
        }),
      );
      for (const r of portResults) {
        if (r.status === 'fulfilled' && r.value) openPorts.push(r.value);
      }
    }

    // Determine status
    let newStatus = 'OFFLINE';
    if (ping.alive && openPorts.length > 0) newStatus = 'ONLINE';
    else if (ping.alive) newStatus = 'WARNING';

    const oldStatus = device.status;
    const metrics = {
      ...(device.metrics as any || {}),
      latency: ping.latency || null,
      lastProbe: new Date().toISOString(),
      openPorts: openPorts.map(p => p.service),
      portCount: openPorts.length,
    };

    const updated = await this.prisma.monitoredDevice.update({
      where: { id },
      data: { status: newStatus, lastSeen: ping.alive ? new Date() : device.lastSeen, metrics },
    });

    // Emit event on status change
    if (oldStatus !== newStatus) {
      if (newStatus === 'OFFLINE') {
        this.eventBus.emitMonitoringEvent(tenantId, 'device_down', {
          deviceId: id, name: device.name, previousStatus: oldStatus,
        });
      } else if (oldStatus === 'OFFLINE' && newStatus === 'ONLINE') {
        this.eventBus.emitMonitoringEvent(tenantId, 'device_recovered', {
          deviceId: id, name: device.name,
        });
      }
    }

    return {
      device: updated,
      probe: { alive: ping.alive, latency: ping.latency, openPorts, statusChange: oldStatus !== newStatus ? `${oldStatus} → ${newStatus}` : null },
    };
  }

  // ─── Scan ALL Network Devices ────────────────────────────────────
  async runNetworkScan(tenantId: string) {
    const devices = await this.prisma.monitoredDevice.findMany({
      where: { tenantId, type: 'NETWORK_DEVICE' },
    });

    this.logger.log(`Network scan: probing ${devices.length} devices for tenant ${tenantId}`);
    const results: any[] = [];
    const batchSize = 10;

    for (let i = 0; i < devices.length; i += batchSize) {
      const batch = devices.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map(d => d.ipAddress ? this.probeDevice(d.id, tenantId) : Promise.resolve({ device: d, probe: { alive: false, error: 'No IP' } })),
      );
      for (const r of batchResults) {
        if (r.status === 'fulfilled') results.push(r.value);
      }
    }

    const summary = {
      scannedAt: new Date(),
      totalDevices: devices.length,
      online: results.filter(r => r.device?.status === 'ONLINE').length,
      warning: results.filter(r => r.device?.status === 'WARNING').length,
      offline: results.filter(r => r.device?.status === 'OFFLINE').length,
      results,
    };

    this.eventBus.emitMonitoringEvent(tenantId, 'network_scan_completed', {
      total: summary.totalDevices, online: summary.online, offline: summary.offline,
    });

    return summary;
  }

  // ─── Nmap Deep Scanning ──────────────────────────────────────────

  /**
   * Check if nmap is available on the host
   */
  async getNmapStatus() {
    return NmapScanner.isAvailable();
  }

  /**
   * Deep scan a subnet using nmap — discovers hosts, ports, OS, services
   */
  async deepScanSubnet(tenantId: string, subnet: string, scanType: 'quick' | 'standard' | 'deep' = 'standard') {
    const available = await NmapScanner.isAvailable();
    if (!available.available) {
      return { error: 'nmap is not installed. Install with: brew install nmap (macOS) or apt install nmap (Linux)' };
    }

    this.logger.log(`Starting nmap ${scanType} scan on ${subnet} for tenant ${tenantId}`);

    let result;
    switch (scanType) {
      case 'quick':
        result = await NmapScanner.quickScan(subnet);
        break;
      case 'deep':
        result = await NmapScanner.deepScan(subnet);
        break;
      default:
        result = await NmapScanner.subnetScan(subnet);
    }

    // Upsert discovered hosts as MonitoredDevices
    let created = 0;
    let updated = 0;

    for (const host of result.hosts.filter(h => h.state === 'up')) {
      const existing = await this.prisma.monitoredDevice.findFirst({
        where: { tenantId, ipAddress: host.ip, type: 'NETWORK_DEVICE' },
      });

      const deviceData = {
        status: host.ports.length > 0 ? 'ONLINE' : 'WARNING',
        lastSeen: new Date(),
        config: {
          deviceType: this.classifyNmapHost(host),
          nmapOS: host.osGuess || null,
          nmapVendor: host.vendor || null,
          interfaces: host.ports.map(p => ({
            name: `${p.protocol.toUpperCase()}/${p.port} (${p.service})`,
            status: p.state,
            speed: 'N/A',
            product: p.product || null,
            version: p.version || null,
          })),
          lastNmapScan: new Date().toISOString(),
          nmapScripts: host.scripts || {},
        },
        metrics: {
          latency: host.latency || null,
          openPorts: host.ports.map(p => `${p.port}/${p.service}`),
          portCount: host.ports.length,
          lastProbe: new Date().toISOString(),
        },
      };

      if (existing) {
        await this.prisma.monitoredDevice.update({
          where: { id: existing.id },
          data: deviceData,
        });
        updated++;
      } else {
        await this.prisma.monitoredDevice.create({
          data: {
            tenantId,
            type: 'NETWORK_DEVICE',
            name: host.hostname || (host.vendor ? `${host.vendor} (${host.ip})` : host.ip),
            ipAddress: host.ip,
            ...deviceData,
          },
        });
        created++;
      }
    }

    this.eventBus.emitMonitoringEvent(tenantId, 'nmap_scan_completed', {
      subnet, scanType, hostsFound: result.totalUp, created, updated,
    });

    return {
      ...result,
      created,
      updated,
      nmapVersion: available.version,
    };
  }

  /**
   * Deep scan a single device by ID
   */
  async deepScanDevice(id: string, tenantId: string) {
    const device = await this.prisma.monitoredDevice.findFirst({
      where: { id, tenantId },
    });
    if (!device) throw new NotFoundException('Device not found');
    if (!device.ipAddress) return { error: 'No IP address configured' };

    const available = await NmapScanner.isAvailable();
    if (!available.available) {
      return { error: 'nmap is not installed' };
    }

    const result = await NmapScanner.standardScan(device.ipAddress);
    const host = result.hosts.find(h => h.ip === device.ipAddress);

    if (host) {
      const config = device.config as any || {};
      await this.prisma.monitoredDevice.update({
        where: { id },
        data: {
          status: host.state === 'up' ? 'ONLINE' : 'OFFLINE',
          lastSeen: host.state === 'up' ? new Date() : device.lastSeen,
          config: {
            ...config,
            deviceType: this.classifyNmapHost(host),
            nmapOS: host.osGuess || config.nmapOS,
            nmapVendor: host.vendor || config.nmapVendor,
            interfaces: host.ports.map(p => ({
              name: `${p.protocol.toUpperCase()}/${p.port} (${p.service})`,
              status: p.state,
              speed: 'N/A',
              product: p.product || null,
              version: p.version || null,
            })),
            lastNmapScan: new Date().toISOString(),
            nmapScripts: host.scripts || {},
          },
          metrics: {
            latency: host.latency || null,
            openPorts: host.ports.map(p => `${p.port}/${p.service}`),
            portCount: host.ports.length,
          },
        },
      });
    }

    return { device: { id, name: device.name, ip: device.ipAddress }, scan: result };
  }

  /**
   * Classify a host based on nmap results
   */
  private classifyNmapHost(host: any): string {
    const ports = new Set((host.ports || []).map((p: any) => p.port));
    const os = (host.osGuess || '').toLowerCase();
    const vendor = (host.vendor || '').toLowerCase();

    if (os.includes('cisco') || vendor.includes('cisco')) return 'router';
    if (os.includes('juniper') || vendor.includes('juniper')) return 'router';
    if (os.includes('fortinet') || vendor.includes('fortinet')) return 'firewall';
    if (os.includes('palo alto')) return 'firewall';
    if (ports.has(631) || ports.has(9100)) return 'printer';
    if (ports.has(554) || ports.has(8554)) return 'camera';
    if (ports.has(161) && !ports.has(22) && !ports.has(3389)) return 'switch';
    if (ports.has(3389)) return os.includes('server') ? 'windows-server' : 'windows-workstation';
    if (ports.has(22) && (ports.has(80) || ports.has(443))) return 'linux-server';
    if (ports.has(22)) return 'linux-workstation';
    if (vendor.includes('apple')) return 'apple-device';
    if (vendor.includes('vmware') || os.includes('vmware')) return 'virtual-machine';
    return 'unknown';
  }

  // ─── Auto-discover from Assets ───────────────────────────────────
  async autoDiscoverFromAssets(tenantId: string) {
    const networkAssets = await this.prisma.asset.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        ipAddress: { not: null },
      },
      include: { assetType: true },
    });

    // Batch-fetch existing monitored IPs to avoid N+1 lookups
    const existingDevices = await this.prisma.monitoredDevice.findMany({
      where: { tenantId, type: 'NETWORK_DEVICE', ipAddress: { not: null } },
      select: { ipAddress: true },
    });
    const existingIPs = new Set(existingDevices.map(d => d.ipAddress));

    let skipped = 0;
    const candidates: { asset: typeof networkAssets[number]; isNetworkDevice: boolean }[] = [];

    for (const asset of networkAssets) {
      const typeName = asset.assetType?.name?.toLowerCase() || '';
      const isNetworkDevice = ['switch', 'router', 'firewall', 'access point', 'network', 'gateway', 'load balancer'].some(t => typeName.includes(t));

      if (!isNetworkDevice && !asset.ipAddress) { skipped++; continue; }
      if (existingIPs.has(asset.ipAddress)) { skipped++; continue; }

      candidates.push({ asset, isNetworkDevice });
    }

    // Batch-ping all candidates with concurrency limit of 20
    const newDevices: any[] = [];
    const batchSize = 20;
    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const pingResults = await Promise.allSettled(
        batch.map(async ({ asset, isNetworkDevice }) => {
          const typeName = asset.assetType?.name?.toLowerCase() || '';
          const ping = await this.pingHost(asset.ipAddress!);
          return {
            tenantId,
            type: 'NETWORK_DEVICE' as const,
            name: asset.name || asset.hostname || asset.ipAddress!,
            ipAddress: asset.ipAddress,
            status: ping.alive ? 'ONLINE' : 'OFFLINE',
            lastSeen: ping.alive ? new Date() : null,
            config: { deviceType: isNetworkDevice ? typeName : 'endpoint', sourceAssetId: asset.id },
            metrics: { latency: ping.latency || null },
          };
        }),
      );
      for (const r of pingResults) {
        if (r.status === 'fulfilled') newDevices.push(r.value);
      }
    }

    // Batch-insert all new devices at once
    let created = 0;
    if (newDevices.length > 0) {
      const result = await this.prisma.monitoredDevice.createMany({ data: newDevices });
      created = result.count;
    }

    return { created, skipped, total: networkAssets.length };
  }

  // ─── Scheduled Health Check ──────────────────────────────────────
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledHealthCheck() {
    try {
      // Batch-fetch all network devices across all active tenants in one query
      const allDevices = await this.prisma.monitoredDevice.findMany({
        where: {
          type: 'NETWORK_DEVICE',
          ipAddress: { not: null },
          tenant: { status: 'ACTIVE' },
        },
        select: { id: true, ipAddress: true, status: true, name: true, tenantId: true, metrics: true },
      });

      if (allDevices.length === 0) return;

      // Batch-ping with concurrency limit of 20
      const pingResults: { device: typeof allDevices[number]; ping: { alive: boolean; latency?: number } }[] = [];
      const batchSize = 20;

      for (let i = 0; i < allDevices.length; i += batchSize) {
        const batch = allDevices.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map(async (d) => {
            const ping = await this.pingHost(d.ipAddress!);
            return { device: d, ping };
          }),
        );
        for (const r of results) {
          if (r.status === 'fulfilled') pingResults.push(r.value);
        }
      }

      // Build update operations and collect events to emit
      const updateOps: any[] = [];
      const events: { tenantId: string; event: string; data: any }[] = [];

      for (const { device, ping } of pingResults) {
        const newStatus = ping.alive ? 'ONLINE' : 'OFFLINE';
        const existingMetrics = (device.metrics as any) || {};
        if (device.status !== newStatus) {
          updateOps.push(
            this.prisma.monitoredDevice.update({
              where: { id: device.id },
              data: {
                status: newStatus,
                lastSeen: ping.alive ? new Date() : undefined,
                metrics: { ...existingMetrics, latency: ping.latency || null, lastHealthCheck: new Date().toISOString() },
              },
            }),
          );
          if (newStatus === 'OFFLINE') {
            events.push({ tenantId: device.tenantId, event: 'device_down', data: { deviceId: device.id, name: device.name } });
          }
        } else if (ping.alive) {
          updateOps.push(
            this.prisma.monitoredDevice.update({
              where: { id: device.id },
              data: { lastSeen: new Date(), metrics: { ...existingMetrics, latency: ping.latency, lastHealthCheck: new Date().toISOString() } },
            }),
          );
        }
      }

      // Batch-update all device statuses in a single transaction
      if (updateOps.length > 0) {
        await this.prisma.$transaction(updateOps);
      }

      // Emit events after transaction completes
      for (const evt of events) {
        this.eventBus.emitMonitoringEvent(evt.tenantId, evt.event, evt.data);
      }

      this.logger.debug(`Health check: ${allDevices.length} devices checked across all tenants`);
    } catch (err: any) {
      this.logger.error(`Scheduled health check error: ${err.message}`);
    }
  }

  // ─── Cameras (CCTV) ─────────────────────────────────────────────
  async getCameras(tenantId: string) {
    const data = await this.prisma.monitoredDevice.findMany({
      where: { tenantId, type: 'CAMERA' },
      orderBy: { name: 'asc' },
    });
    const online = data.filter(d => d.status === 'ONLINE').length;
    const recording = data.filter(d => (d.config as any)?.recording).length;
    const alerts = data.filter(d => d.status === 'OFFLINE').length;
    return { data, total: data.length, online, recording, alerts };
  }

  async getCameraStream(id: string, tenantId: string) {
    const camera = await this.prisma.monitoredDevice.findFirst({
      where: { id, tenantId, type: 'CAMERA' },
    });
    if (!camera) throw new NotFoundException('Camera not found');
    const config = camera.config as any || {};
    return {
      id: camera.id, name: camera.name,
      streamUrl: config.rtspUrl || config.streamUrl || `rtsp://${camera.ipAddress}:554/stream1`,
      subStreamUrl: config.subStreamUrl || `rtsp://${camera.ipAddress}:554/stream2`,
      snapshotUrl: config.snapshotUrl || `http://${camera.ipAddress}/snapshot.jpg`,
      ptzSupport: config.ptzSupport || false,
      status: camera.status,
    };
  }

  async getCameraEvents(id: string, tenantId: string) {
    const camera = await this.prisma.monitoredDevice.findFirst({
      where: { id, tenantId, type: 'CAMERA' },
    });
    if (!camera) throw new NotFoundException('Camera not found');

    // Pull real audit log entries for this device
    const auditEvents = await this.prisma.auditLog.findMany({
      where: { tenantId, resourceId: id },
      orderBy: { timestamp: 'desc' },
      take: 20,
      select: { action: true, timestamp: true, metadata: true, actorId: true },
    });

    // Build events from real data + device state
    const events: any[] = auditEvents.map(e => ({
      type: e.action,
      timestamp: e.timestamp,
      details: e.metadata,
      userId: e.actorId,
    }));

    // Add current status as a live event
    events.unshift({
      type: camera.status === 'OFFLINE' ? 'camera_offline' : 'health_check',
      timestamp: camera.lastSeen || new Date(),
      status: camera.status,
      details: camera.status === 'OFFLINE'
        ? `Camera went offline. Last seen: ${camera.lastSeen?.toISOString() || 'unknown'}`
        : `Camera is ${camera.status}. Recording: ${(camera.config as any)?.recording ? 'Yes' : 'No'}`,
    });

    return { cameraId: id, cameraName: camera.name, events, total: events.length };
  }

  // ─── Network Devices (NMS) ──────────────────────────────────────
  async getNetworkDevices(tenantId: string) {
    const data = await this.prisma.monitoredDevice.findMany({
      where: { tenantId, type: 'NETWORK_DEVICE' },
      orderBy: { name: 'asc' },
    });
    const up = data.filter(d => d.status === 'ONLINE').length;
    const warning = data.filter(d => d.status === 'WARNING').length;
    const down = data.filter(d => d.status === 'OFFLINE').length;
    return { data, total: data.length, up, warning, down };
  }

  async getTopology(tenantId: string) {
    return this.topologyService.getTopology(tenantId);
  }

  // ─── Real Device Interface Scan ──────────────────────────────────
  async getDeviceInterfaces(id: string, tenantId: string) {
    const device = await this.prisma.monitoredDevice.findFirst({
      where: { id, tenantId, type: 'NETWORK_DEVICE' },
    });
    if (!device) throw new NotFoundException('Network device not found');

    const config = device.config as any || {};

    // If stored SNMP interface data exists, return it (with port scan data separate)
    if (config.interfaces && Array.isArray(config.interfaces) && config.interfaces.length > 0) {
      return { deviceId: id, deviceName: device.name, interfaces: config.interfaces, openPorts: [], source: 'stored' };
    }

    // No real SNMP interface data — run a port scan and return results in 'openPorts', NOT 'interfaces'
    if (device.ipAddress) {
      const ports = [22, 23, 80, 161, 443, 445, 3389, 5432, 8080, 8443, 9100];
      const openPorts: any[] = [];

      const results = await Promise.allSettled(
        ports.map(async (port) => {
          const open = await this.probePort(device.ipAddress!, port);
          return { port, open, service: PORT_NAMES[port] || `port-${port}` };
        }),
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          const { port, open, service } = r.value;
          openPorts.push({
            port,
            service,
            status: open ? 'open' : 'closed',
          });
        }
      }

      return { deviceId: id, deviceName: device.name, interfaces: [], openPorts, source: 'port_scan' };
    }

    return { deviceId: id, deviceName: device.name, interfaces: [], openPorts: [], source: 'none' };
  }

  async getTraps(tenantId: string) {
    // Return real SNMP traps from the trap receiver if available
    if (this.trapReceiver) {
      const traps = await this.trapReceiver.getRecentTraps(tenantId);
      return { traps, total: traps.length };
    }

    // Trap receiver is not enabled — return empty with informational message
    return {
      traps: [],
      total: 0,
      message: 'SNMP Trap Receiver is disabled. Enable via ENABLE_SNMP_TRAPS=true environment variable.',
    };
  }

  // ─── Virtual Machines (VDI) ─────────────────────────────────────
  async getVirtualMachines(tenantId: string) {
    const data = await this.prisma.monitoredDevice.findMany({ where: { tenantId, type: 'VIRTUAL_MACHINE' }, orderBy: { name: 'asc' } });
    const running = data.filter(d => d.status === 'ONLINE').length;
    const stopped = data.filter(d => d.status === 'STOPPED').length;
    const runningVms = data.filter(d => d.status === 'ONLINE');
    const avgCpu = runningVms.length > 0 ? Math.round(runningVms.reduce((s, d) => s + ((d.metrics as any)?.cpu || 0), 0) / runningVms.length) : 0;
    const avgRam = runningVms.length > 0 ? Math.round(runningVms.reduce((s, d) => s + ((d.metrics as any)?.ram || 0), 0) / runningVms.length) : 0;
    return { data, total: data.length, running, stopped, avgCpu, avgRam };
  }

  async getVdiPools(tenantId: string) {
    const vms = await this.prisma.monitoredDevice.findMany({ where: { tenantId, type: 'VIRTUAL_MACHINE' } });
    const poolMap: Record<string, any[]> = {};
    for (const vm of vms) {
      const pool = (vm.config as any)?.pool || 'Default Pool';
      if (!poolMap[pool]) poolMap[pool] = [];
      poolMap[pool].push(vm);
    }
    const pools = Object.entries(poolMap).map(([name, members]) => ({
      name, totalVMs: members.length,
      runningVMs: members.filter(m => m.status === 'ONLINE').length,
      avgCpu: Math.round(members.reduce((s, m) => s + ((m.metrics as any)?.cpu || 0), 0) / Math.max(members.length, 1)),
      avgRam: Math.round(members.reduce((s, m) => s + ((m.metrics as any)?.ram || 0), 0) / Math.max(members.length, 1)),
      protocol: 'RDP',
    }));
    return { pools, totalPools: pools.length };
  }

  async getVdiSessions(tenantId: string) {
    const runningVms = await this.prisma.monitoredDevice.findMany({ where: { tenantId, type: 'VIRTUAL_MACHINE', status: 'ONLINE' } });
    // Only include VMs that have an assigned user — unassigned VMs are not active sessions
    const assignedVms = runningVms.filter(vm => (vm.config as any)?.assignedUser);
    const sessions = assignedVms.map(vm => ({
      vmId: vm.id, vmName: vm.name,
      user: (vm.config as any).assignedUser,
      protocol: (vm.config as any)?.protocol || 'Unknown',
      sessionState: 'Active',
      connectedSince: vm.lastSeen || new Date(),
      cpu: (vm.metrics as any)?.cpu || 0, ram: (vm.metrics as any)?.ram || 0,
      note: 'Session data inferred from VM assignment. Connect hypervisor for real-time session tracking.',
    }));
    return { sessions, totalActive: sessions.length };
  }

  async getVdiMetrics(tenantId: string) {
    const vms = await this.prisma.monitoredDevice.findMany({ where: { tenantId, type: 'VIRTUAL_MACHINE' } });
    const running = vms.filter(v => v.status === 'ONLINE');
    return {
      totalVMs: vms.length, runningVMs: running.length,
      avgCpu: Math.round(running.reduce((s, v) => s + ((v.metrics as any)?.cpu || 0), 0) / Math.max(running.length, 1)),
      avgRam: Math.round(running.reduce((s, v) => s + ((v.metrics as any)?.ram || 0), 0) / Math.max(running.length, 1)),
      avgDisk: Math.round(running.reduce((s, v) => s + ((v.metrics as any)?.disk || 0), 0) / Math.max(running.length, 1)),
      peakCpuVM: running.sort((a, b) => ((b.metrics as any)?.cpu || 0) - ((a.metrics as any)?.cpu || 0))[0]?.name || 'N/A',
      peakRamVM: running.sort((a, b) => ((b.metrics as any)?.ram || 0) - ((a.metrics as any)?.ram || 0))[0]?.name || 'N/A',
    };
  }

  // ─── Generic CRUD ───────────────────────────────────────────────
  async createDevice(tenantId: string, body: any) {
    const { name, ipAddress, type, snmpCommunity, snmpVersion, location, notes, config: customConfig, metrics: customMetrics } = body;
    const config: any = customConfig || {};
    if (snmpCommunity) config.snmpCommunity = snmpCommunity;
    if (snmpVersion) config.snmpVersion = snmpVersion;
    if (notes) config.notes = notes;

    const device = await this.prisma.monitoredDevice.create({
      data: {
        tenantId,
        name: name || ipAddress || 'Unknown Device',
        ipAddress: ipAddress || null,
        type: (type as any) || 'NETWORK_DEVICE',
        ...(location && { location }),
        config: config,
        metrics: customMetrics || {},
      },
    });
    if (device.status === 'OFFLINE') {
      this.eventBus.emitMonitoringEvent(tenantId, 'device_down', { deviceId: device.id, name: device.name, type: device.type });
    }
    return device;
  }

  async updateDevice(id: string, tenantId: string, body: any) {
    const existing = await this.prisma.monitoredDevice.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Device not found');
    const device = await this.prisma.monitoredDevice.update({ where: { id: existing.id }, data: body });
    if (existing.status !== 'OFFLINE' && device.status === 'OFFLINE') {
      this.eventBus.emitMonitoringEvent(tenantId, 'device_down', { deviceId: device.id, name: device.name, type: device.type });
    }
    return device;
  }

  async deleteDevice(id: string, tenantId: string) {
    const device = await this.prisma.monitoredDevice.findFirst({ where: { id, tenantId } });
    if (!device) throw new NotFoundException('Device not found');
    return this.prisma.monitoredDevice.delete({ where: { id } });
  }

  async getAlerts(tenantId: string) {
    const devices = await this.prisma.monitoredDevice.findMany({
      where: { tenantId, status: { in: ['OFFLINE', 'WARNING', 'CRITICAL'] } },
      orderBy: { lastSeen: 'desc' },
      take: 50,
    });
    return {
      alerts: devices.map(d => ({
        id: d.id,
        deviceName: d.name,
        type: d.type,
        status: d.status,
        severity: d.status === 'OFFLINE' ? 'critical' : d.status === 'CRITICAL' ? 'critical' : 'warning',
        ip: d.ipAddress,
        lastSeen: d.lastSeen,
        message: `${d.name} is ${d.status.toLowerCase()}`,
      })),
      total: devices.length,
    };
  }
}
