import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { SnmpScanner } from '../../common/scanners/snmp.scanner';
import { TopologyService } from './topology.service';

@Injectable()
export class SnmpPollerService {
  private readonly logger = new Logger(SnmpPollerService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private snmpScanner: SnmpScanner,
    private topologyService: TopologyService,
  ) {}

  /**
   * Poll all SNMP-enabled network devices every 5 minutes
   * Stores real metrics (CPU, memory, interface counters) in DeviceMetricsHistory
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async scheduledSnmpPoll() {
    const available = await this.snmpScanner.isAvailable();
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    if (!available) {
      this.logger.warn('SNMP tools not available. Skipping SNMP poll — install net-snmp for real device metrics.');
      return;
    }

    try {
      for (const tenant of tenants) {
        await this.pollTenantDevices(tenant.id);
        await this.topologyService.buildAndPersistTopology(tenant.id);
      }
    } catch (err: any) {
      this.logger.error(`Scheduled SNMP poll error: ${err.message}`);
    }
  }

  async pollTenantDevices(tenantId: string) {
    const devices = await this.prisma.monitoredDevice.findMany({
      where: {
        tenantId,
        type: 'NETWORK_DEVICE',
        ipAddress: { not: null },
      },
      select: { id: true, ipAddress: true, name: true, status: true, config: true },
    });

    if (devices.length === 0) return;

    this.logger.log(`SNMP polling ${devices.length} devices for tenant ${tenantId.substring(0, 8)}...`);

    const batchSize = 5;
    for (let i = 0; i < devices.length; i += batchSize) {
      const batch = devices.slice(i, i + batchSize);
      await Promise.allSettled(batch.map(d => this.pollSingleDevice(d, tenantId)));
    }
  }

  private async pollSingleDevice(device: any, tenantId: string) {
    const config = (device.config as any) || {};
    const community = config.snmpCommunity || 'public';

    try {
      const info = await this.snmpScanner.pollDevice(device.ipAddress!, community);
      if (!info) return;

      const newStatus = info.sysDescr?.includes('Unreachable') ? 'OFFLINE' : 'ONLINE';
      const oldStatus = device.status;

      // Build metrics from SNMP data
      const totalInOctets = (info.interfaces || []).reduce((s, i) => s + (i.inOctets || 0), 0);
      const totalOutOctets = (info.interfaces || []).reduce((s, i) => s + (i.outOctets || 0), 0);
      const upInterfaces = (info.interfaces || []).filter(i => i.operStatus === 'up').length;

      const metrics = {
        cpu: info.cpuLoad || 0,
        memory: info.memoryPercent || 0,
        ifInOctets: totalInOctets,
        ifOutOctets: totalOutOctets,
        interfacesUp: upInterfaces,
        interfacesTotal: (info.interfaces || []).length,
        sysUpTime: info.sysUpTime || 0,
        lastSnmpPoll: new Date().toISOString(),
        snmpAvailable: true,
      };

      // Update device
      await this.prisma.monitoredDevice.update({
        where: { id: device.id },
        data: {
          status: newStatus,
          lastSeen: newStatus === 'ONLINE' ? new Date() : undefined,
          metrics,
          config: {
            ...config,
            sysDescr: info.sysDescr,
            sysName: info.sysName,
            sysContact: info.sysContact,
            sysLocation: info.sysLocation,
            lldpNeighbors: info.lldpNeighbors || [],
            cdpNeighbors: info.cdpNeighbors || [],
            interfaces: (info.interfaces || []).map(i => ({
              name: i.name,
              speed: i.speed,
              status: i.operStatus,
              inOctets: i.inOctets,
              outOctets: i.outOctets,
            })),
            lastSnmpPoll: new Date().toISOString(),
          },
        },
      });

      // Store metrics history (time-series)
      await this.prisma.deviceMetricsHistory.create({
        data: {
          tenantId,
          deviceId: device.id,
          metrics: metrics as any,
        },
      }).catch((e: any) => {
        this.logger.debug(`Metrics history insert failed: ${e.message}`);
      });

      // Emit events on status change
      if (oldStatus !== newStatus) {
        if (newStatus === 'OFFLINE') {
          this.eventBus.emitMonitoringEvent(tenantId, 'device_down', {
            deviceId: device.id, name: device.name, source: 'snmp',
          });
        } else if (oldStatus === 'OFFLINE') {
          this.eventBus.emitMonitoringEvent(tenantId, 'device_recovered', {
            deviceId: device.id, name: device.name, source: 'snmp',
          });
        }
      }
    } catch (err: any) {
      this.logger.debug(`SNMP poll failed for ${device.name} (${device.ipAddress}): ${err.message}`);
    }
  }

  /**
   * Manual SNMP poll for a single device (triggered from API)
   */
  async pollDevice(deviceId: string, tenantId: string) {
    const device = await this.prisma.monitoredDevice.findFirst({
      where: { id: deviceId, tenantId, type: 'NETWORK_DEVICE' },
    });
    if (!device?.ipAddress) return { error: 'Device not found or no IP' };

    const config = (device.config as any) || {};
    const community = config.snmpCommunity || 'public';
    const info = await this.snmpScanner.pollDevice(device.ipAddress, community);

    if (!info) return { error: 'SNMP poll returned no data' };

    return {
      device: { id: device.id, name: device.name, ip: device.ipAddress },
      snmp: info,
    };
  }

  /**
   * Get SNMP metrics history for a device (for charts)
   */
  async getMetricsHistory(deviceId: string, tenantId: string, hours = 24) {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      return this.prisma.deviceMetricsHistory.findMany({
        where: {
          deviceId,
          tenantId,
          collectedAt: { gte: since },
        },
        select: { metrics: true, collectedAt: true },
        orderBy: { collectedAt: 'asc' },
        take: 288,
      });
    } catch {
      return [];
    }
  }
}
