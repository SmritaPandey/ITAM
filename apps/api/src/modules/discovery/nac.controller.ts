import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { NacService } from './nac.service';

@ApiTags('nac')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nac')
export class NacController {
  constructor(private nacService: NacService) {}

  // ─── Dashboard ──────────────────────────────────────────
  @Get('dashboard')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get NAC dashboard overview' })
  async getDashboard(@Request() req: any) {
    return this.nacService.getDashboard(req.user.tenantId);
  }

  // ─── Device Posture ─────────────────────────────────────
  @Get('posture')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get network device posture assessment for all agents' })
  async getDevicePosture(@Request() req: any) {
    return this.nacService.getDevicePosture(req.user.tenantId);
  }

  @Post('posture/:agentId/reassess')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Reassess a specific device posture' })
  async reassessPosture(@Request() req: any, @Param('agentId') agentId: string) {
    return this.nacService.reassessPosture(req.user.tenantId, agentId);
  }

  // ─── VLAN Policies ──────────────────────────────────────
  @Get('vlan-policies')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List VLAN assignment policies' })
  async listVlanPolicies(@Request() req: any) {
    return this.nacService.listVlanPolicies(req.user.tenantId);
  }

  @Post('vlan-policies')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a VLAN assignment policy' })
  async createVlanPolicy(@Request() req: any, @Body() body: {
    name: string; description?: string;
    vlanId: number; vlanName: string;
    conditions: any; action: string; priority?: number;
  }) {
    return this.nacService.createVlanPolicy(req.user.tenantId, body);
  }

  @Delete('vlan-policies/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete a VLAN policy' })
  async deleteVlanPolicy(@Request() req: any, @Param('id') id: string) {
    return this.nacService.deleteVlanPolicy(req.user.tenantId, id);
  }

  // ─── Device Fingerprinting ──────────────────────────────
  @Get('fingerprints')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get DHCP fingerprint database for discovered devices' })
  async getFingerprints(@Request() req: any) {
    return this.nacService.getFingerprints(req.user.tenantId);
  }

  // ─── 802.1X RADIUS ──────────────────────────────────────
  @Get('radius/config')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Get RADIUS server configuration' })
  async getRadiusConfig(@Request() req: any) {
    return this.nacService.getRadiusConfig(req.user.tenantId);
  }

  @Post('radius/config')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Save RADIUS server configuration' })
  async saveRadiusConfig(@Request() req: any, @Body() body: {
    serverAddress: string; port: number; sharedSecret: string;
    authProtocol: string; enabled: boolean;
  }) {
    return this.nacService.saveRadiusConfig(req.user.tenantId, body);
  }

  @Put('radius/config')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update RADIUS server configuration' })
  async updateRadiusConfig(@Request() req: any, @Body() body: {
    serverAddress: string; port: number; sharedSecret: string;
    authProtocol: string; enabled: boolean;
  }) {
    return this.nacService.saveRadiusConfig(req.user.tenantId, body);
  }

  // ─── Network Segments ───────────────────────────────────
  @Get('segments')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List network segments and their security zones' })
  async listSegments(@Request() req: any) {
    return this.nacService.listSegments(req.user.tenantId);
  }

  @Post('segments')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a network segment' })
  async createSegment(@Request() req: any, @Body() body: {
    name: string; vlanId: number; subnet: string;
    securityZone: string; description?: string;
  }) {
    return this.nacService.createSegment(req.user.tenantId, body);
  }

  // ─── Quarantine ─────────────────────────────────────────
  @Post('quarantine/:agentId')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Quarantine a non-compliant device' })
  async quarantineDevice(@Request() req: any, @Param('agentId') agentId: string, @Body() body: { reason: string }) {
    return this.nacService.quarantineDevice(req.user.tenantId, agentId, body.reason);
  }

  // Alias route — frontend calls /posture/:id/quarantine
  @Post('posture/:agentId/quarantine')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Quarantine a device (alias route)' })
  async quarantineDeviceAlias(@Request() req: any, @Param('agentId') agentId: string, @Body() body: { reason: string }) {
    return this.nacService.quarantineDevice(req.user.tenantId, agentId, body.reason);
  }

  @Post('unquarantine/:agentId')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Release a device from quarantine' })
  async unquarantineDevice(@Request() req: any, @Param('agentId') agentId: string) {
    return this.nacService.unquarantineDevice(req.user.tenantId, agentId);
  }
}
