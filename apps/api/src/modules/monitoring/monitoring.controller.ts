import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MonitoringService } from './monitoring.service';

@ApiTags('monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('monitoring')
export class MonitoringController {
  constructor(private service: MonitoringService) {}

  // ─── CCTV ─────────────────────────────────────────────────────

  @Get('cameras')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List CCTV cameras with stats' })
  async getCameras(@Request() req: any) {
    return this.service.getCameras(req.user.tenantId);
  }

  @Get('cameras/:id/stream')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get camera stream URL (RTSP/HTTP)' })
  async getCameraStream(@Request() req: any, @Param('id') id: string) {
    return this.service.getCameraStream(id, req.user.tenantId);
  }

  @Get('cameras/:id/events')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get camera events (motion, tamper, offline)' })
  async getCameraEvents(@Request() req: any, @Param('id') id: string) {
    return this.service.getCameraEvents(id, req.user.tenantId);
  }

  // ─── Network (NMS) ───────────────────────────────────────────

  @Get('network')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List NMS network devices with stats' })
  async getNetworkDevices(@Request() req: any) {
    return this.service.getNetworkDevices(req.user.tenantId);
  }

  @Get('network/topology')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get network topology map data (nodes + links)' })
  async getTopology(@Request() req: any) {
    return this.service.getTopology(req.user.tenantId);
  }

  @Get('network/devices/:id/interfaces')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get device interface table (ports, VLANs, traffic)' })
  async getDeviceInterfaces(@Request() req: any, @Param('id') id: string) {
    return this.service.getDeviceInterfaces(id, req.user.tenantId);
  }

  @Get('network/traps')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get recent SNMP traps and events' })
  async getTraps(@Request() req: any) {
    return this.service.getTraps(req.user.tenantId);
  }

  @Post('network/scan')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Trigger a real ICMP/TCP network scan of all devices' })
  async scanNetwork(@Request() req: any) {
    return this.service.runNetworkScan(req.user.tenantId);
  }

  @Post('network/devices/:id/probe')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Probe a single network device (ping + port scan)' })
  async probeDevice(@Request() req: any, @Param('id') id: string) {
    return this.service.probeDevice(id, req.user.tenantId);
  }

  @Post('network/auto-discover')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Auto-create monitored devices from existing assets with IPs' })
  async autoDiscover(@Request() req: any) {
    return this.service.autoDiscoverFromAssets(req.user.tenantId);
  }

  // ─── Nmap Deep Scanning ────────────────────────────────────────

  @Get('nmap/status')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Check if nmap is installed and available' })
  async nmapStatus() {
    return this.service.getNmapStatus();
  }

  @Post('nmap/scan')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Run nmap deep scan on a subnet (quick/standard/deep)' })
  async nmapScan(@Request() req: any, @Body() body: { subnet: string; scanType?: 'quick' | 'standard' | 'deep' }) {
    return this.service.deepScanSubnet(req.user.tenantId, body.subnet, body.scanType || 'standard');
  }

  @Post('nmap/devices/:id/scan')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Run nmap deep scan on a single device' })
  async nmapDeviceScan(@Request() req: any, @Param('id') id: string) {
    return this.service.deepScanDevice(id, req.user.tenantId);
  }

  // ─── VDI ──────────────────────────────────────────────────────

  @Get('vdi')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List virtual machines with stats' })
  async getVirtualMachines(@Request() req: any) {
    return this.service.getVirtualMachines(req.user.tenantId);
  }

  @Get('vdi/pools')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get VDI pool overview' })
  async getVdiPools(@Request() req: any) {
    return this.service.getVdiPools(req.user.tenantId);
  }

  @Get('vdi/sessions')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get active VDI sessions' })
  async getVdiSessions(@Request() req: any) {
    return this.service.getVdiSessions(req.user.tenantId);
  }

  @Get('vdi/metrics')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get VDI performance metrics' })
  async getVdiMetrics(@Request() req: any) {
    return this.service.getVdiMetrics(req.user.tenantId);
  }

  // ─── Device CRUD ──────────────────────────────────────────────

  @Post('devices')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a monitored device' })
  async create(@Request() req: any, @Body() body: any) {
    return this.service.createDevice(req.user.tenantId, body);
  }

  @Patch('devices/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update a monitored device' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateDevice(id, req.user.tenantId, body);
  }

  @Delete('devices/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete a monitored device' })
  async remove(@Param('id') id: string) {
    return this.service.deleteDevice(id);
  }
}
