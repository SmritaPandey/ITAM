import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MonitoringService } from './monitoring.service';
import { SnmpPollerService } from './snmp-poller.service';
import { SnmpTrapReceiverService } from './snmp-trap-receiver.service';
import { OnvifDiscoveryService } from './onvif-discovery.service';
import { VdiHypervisorService } from './vdi-hypervisor.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { CreateDeviceDto } from './dto/create-device.dto';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private service: MonitoringService,
    private snmpPoller: SnmpPollerService,
    private trapReceiver: SnmpTrapReceiverService,
    private onvifDiscovery: OnvifDiscoveryService,
    private vdiHypervisor: VdiHypervisorService,
  ) {}

  // ─── CCTV ─────────────────────────────────────────────────────

  @RequireModule('CCTV')
  @Get('cameras')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List CCTV cameras with stats' })
  async getCameras(@Request() req: any) {
    return this.service.getCameras(req.user.tenantId);
  }

  @RequireModule('CCTV')
  @Get('cameras/:id/stream')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get camera stream URL (RTSP/HTTP)' })
  async getCameraStream(@Request() req: any, @Param('id') id: string) {
    return this.service.getCameraStream(id, req.user.tenantId);
  }

  @RequireModule('CCTV')
  @Get('cameras/:id/events')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get camera events (motion, tamper, offline)' })
  async getCameraEvents(@Request() req: any, @Param('id') id: string) {
    return this.service.getCameraEvents(id, req.user.tenantId);
  }

  @RequireModule('CCTV')
  @Post('cameras/discover')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Discover ONVIF cameras on the network via WS-Discovery' })
  async discoverCameras(@Request() req: any) {
    return this.onvifDiscovery.discoverAndRegister(req.user.tenantId);
  }

  // ─── Network (NMS) ───────────────────────────────────────────

  @RequireModule('NETWORK')
  @Get('network')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List NMS network devices with stats' })
  async getNetworkDevices(@Request() req: any) {
    return this.service.getNetworkDevices(req.user.tenantId);
  }

  @RequireModule('NETWORK')
  @Get('network/topology')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get network topology map data (nodes + links)' })
  async getTopology(@Request() req: any) {
    return this.service.getTopology(req.user.tenantId);
  }

  @RequireModule('NETWORK')
  @Get('network/devices/:id/interfaces')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get device interface table (ports, VLANs, traffic)' })
  async getDeviceInterfaces(@Request() req: any, @Param('id') id: string) {
    return this.service.getDeviceInterfaces(id, req.user.tenantId);
  }

  @RequireModule('NETWORK')
  @Get('network/traps')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get recent SNMP traps and events' })
  async getTraps(@Request() req: any) {
    return this.service.getTraps(req.user.tenantId);
  }

  @RequireModule('NETWORK')
  @Get('network/traps/live')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get recent SNMP traps from the live trap receiver' })
  async getLiveTraps(@Request() req: any, @Query('limit') limit?: string) {
    const traps = await this.trapReceiver.getRecentTraps(req.user.tenantId, Number(limit) || 100);
    return { traps, total: traps.length };
  }

  @RequireModule('NETWORK')
  @Get('network/traps/stats')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get SNMP trap receiver statistics' })
  async getTrapStats() {
    return this.trapReceiver.getStats();
  }

  @RequireModule('NETWORK')
  @Post('network/scan')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Trigger a real ICMP/TCP network scan of all devices' })
  async scanNetwork(@Request() req: any) {
    return this.service.runNetworkScan(req.user.tenantId);
  }

  @RequireModule('NETWORK')
  @Post('network/devices/:id/probe')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Probe a single network device (ping + port scan)' })
  async probeDevice(@Request() req: any, @Param('id') id: string) {
    return this.service.probeDevice(id, req.user.tenantId);
  }

  @RequireModule('NETWORK')
  @Post('network/auto-discover')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Auto-create monitored devices from existing assets with IPs' })
  async autoDiscover(@Request() req: any) {
    return this.service.autoDiscoverFromAssets(req.user.tenantId);
  }

  // ─── Nmap Deep Scanning ────────────────────────────────────────

  @RequireModule('NETWORK')
  @Get('nmap/status')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Check if nmap is installed and available' })
  async nmapStatus() {
    return this.service.getNmapStatus();
  }

  @RequireModule('NETWORK')
  @Post('nmap/scan')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Run nmap deep scan on a subnet (quick/standard/deep)' })
  async nmapScan(@Request() req: any, @Body() body: { subnet: string; scanType?: 'quick' | 'standard' | 'deep' }) {
    return this.service.deepScanSubnet(req.user.tenantId, body.subnet, body.scanType || 'standard');
  }

  @RequireModule('NETWORK')
  @Post('nmap/devices/:id/scan')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Run nmap deep scan on a single device' })
  async nmapDeviceScan(@Request() req: any, @Param('id') id: string) {
    return this.service.deepScanDevice(id, req.user.tenantId);
  }

  // ─── SNMP Polling ───────────────────────────────────────────

  @RequireModule('NETWORK')
  @Post('snmp/poll')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Trigger SNMP poll for all tenant devices' })
  async snmpPollAll(@Request() req: any) {
    await this.snmpPoller.pollTenantDevices(req.user.tenantId);
    return { message: 'SNMP poll completed' };
  }

  @RequireModule('NETWORK')
  @Post('snmp/devices/:id/poll')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'SNMP poll a single device' })
  async snmpPollDevice(@Request() req: any, @Param('id') id: string) {
    return this.snmpPoller.pollDevice(id, req.user.tenantId);
  }

  @RequireModule('NETWORK')
  @Get('snmp/devices/:id/history')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get SNMP metrics history for charts' })
  async snmpHistory(@Request() req: any, @Param('id') id: string, @Query('hours') hours?: string) {
    return this.snmpPoller.getMetricsHistory(id, req.user.tenantId, Number(hours) || 24);
  }

  // ─── VDI ──────────────────────────────────────────────────────

  @RequireModule('VDI')
  @Get('vdi')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List virtual machines with stats' })
  async getVirtualMachines(@Request() req: any) {
    return this.service.getVirtualMachines(req.user.tenantId);
  }

  @RequireModule('VDI')
  @Get('vdi/pools')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get VDI pool overview' })
  async getVdiPools(@Request() req: any) {
    return this.service.getVdiPools(req.user.tenantId);
  }

  @RequireModule('VDI')
  @Get('vdi/sessions')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get active VDI sessions' })
  async getVdiSessions(@Request() req: any) {
    return this.service.getVdiSessions(req.user.tenantId);
  }

  @RequireModule('VDI')
  @Get('vdi/metrics')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get VDI performance metrics' })
  async getVdiMetrics(@Request() req: any) {
    return this.service.getVdiMetrics(req.user.tenantId);
  }

  @RequireModule('VDI')
  @Get('vdi/hypervisors')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Get configured hypervisors for this tenant' })
  async getHypervisors(@Request() req: any) {
    return this.vdiHypervisor.getHypervisors(req.user.tenantId);
  }

  @RequireModule('VDI')
  @Post('vdi/sync')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Sync VMs from a hypervisor (VMware Horizon / Proxmox)' })
  async syncHypervisor(@Request() req: any, @Body() body: any) {
    return this.vdiHypervisor.syncHypervisor(req.user.tenantId, body);
  }

  // ─── Device CRUD ──────────────────────────────────────────────

  @RequireModule('NETWORK')
  @Get('devices')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List all monitored devices' })
  async getDevices(@Request() req: any) {
    return this.service.getNetworkDevices(req.user.tenantId);
  }

  @RequireModule('NETWORK')
  @Get('alerts')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get monitoring alerts' })
  async getAlerts(@Request() req: any) {
    return this.service.getAlerts(req.user.tenantId);
  }

  @RequireModule('NETWORK')
  @Get('topology')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get network topology (shorthand)' })
  async getTopologyShort(@Request() req: any) {
    return this.service.getTopology(req.user.tenantId);
  }

  @RequireModule('NETWORK')
  @Post('devices')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a monitored device' })
  async create(@Request() req: any, @Body() body: CreateDeviceDto) {
    return this.service.createDevice(req.user.tenantId, body);
  }

  @RequireModule('NETWORK')
  @Patch('devices/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update a monitored device' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateDevice(id, req.user.tenantId, body);
  }

  @RequireModule('NETWORK')
  @Delete('devices/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete a monitored device' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteDevice(id, req.user.tenantId);
  }
}

