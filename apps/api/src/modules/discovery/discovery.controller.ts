import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DiscoveryService } from './discovery.service';
import { CredentialVaultService } from './credential-vault.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('discovery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('DISCOVERY')
@Controller('discovery')
export class DiscoveryController {
  constructor(
    private discoveryService: DiscoveryService,
    private credentialVault: CredentialVaultService,
  ) {}

  // ─── Subnet Detection ────────────────────────────────────────

  @Get('subnets')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Detect local network subnets' })
  getSubnets(@Request() req: any) {
    return this.discoveryService.getLocalSubnets(req.user.tenantId);
  }

  // ─── Scan Jobs ────────────────────────────────────────────────

  @Post('scans')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({
    summary:
      'Trigger a network scan (PING_SWEEP, TCP_PORT_SCAN, SNMP_DISCOVERY, FULL_SCAN)',
  })
  async createScan(
    @Request() req: any,
    @Body()
    body: {
      subnet: string;
      scanType?: string;
      name?: string;
      portRange?: string;
      credentialId?: string;
    },
  ) {
    return this.discoveryService.createScan(
      req.user.tenantId,
      req.user.sub,
      body,
    );
  }

  @Get('scans')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List scan jobs' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async findAllScans(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.discoveryService.findAllScans(req.user.tenantId, page, limit);
  }

  @Get('scans/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get scan results with discovered devices' })
  async findScan(@Request() req: any, @Param('id') id: string) {
    return this.discoveryService.findScanById(id, req.user.tenantId);
  }

  @Post('scans/:id/stop')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Stop a running scan job' })
  async stopScan(@Request() req: any, @Param('id') id: string) {
    return this.discoveryService.stopScan(id, req.user.tenantId);
  }

  @Delete('scans/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Delete a completed/failed/cancelled scan job' })
  async deleteScan(@Request() req: any, @Param('id') id: string) {
    return this.discoveryService.deleteScan(id, req.user.tenantId);
  }

  @Post('scans/:id/results')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Submit scan results from discovery agent' })
  async submitScanResults(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      devices: Array<{
        ip: string;
        mac?: string;
        hostname?: string;
        openPorts?: Array<{ port: number; service: string }>;
        deviceType?: string;
        manufacturer?: string;
        osInfo?: string;
      }>;
    },
  ) {
    return this.discoveryService.processAgentScanResults(
      id,
      req.user.tenantId,
      body.devices,
    );
  }

  // ─── Discovered Devices ───────────────────────────────────────

  @Get('pending')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List devices pending review' })
  async getPendingDevices(@Request() req: any) {
    return this.discoveryService.findPendingDevices(req.user.tenantId);
  }

  @Post('devices/:id/approve')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Approve discovered device → create asset' })
  async approveDevice(
    @Request() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      assetTypeId?: string;
    },
  ) {
    return this.discoveryService.approveDevice(
      id,
      req.user.tenantId,
      req.user.sub,
      body,
    );
  }

  @Post('devices/:id/merge')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Merge discovered device specs into existing asset' })
  async mergeDevice(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { assetId: string },
  ) {
    return this.discoveryService.mergeDevice(
      id,
      req.user.tenantId,
      req.user.sub,
      body,
    );
  }

  @Post('devices/bulk-approve')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Bulk approve multiple discovered devices' })
  async bulkApprove(
    @Request() req: any,
    @Body() body: { deviceIds: string[] },
  ) {
    return this.discoveryService.bulkApprove(
      req.user.tenantId,
      req.user.sub,
      body.deviceIds,
    );
  }

  @Post('devices/bulk-ignore')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Bulk ignore multiple discovered devices' })
  async bulkIgnore(@Request() req: any, @Body() body: { deviceIds: string[] }) {
    return this.discoveryService.bulkIgnore(req.user.tenantId, body.deviceIds);
  }

  @Post('devices/:id/ignore')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Ignore a discovered device' })
  async ignoreDevice(@Request() req: any, @Param('id') id: string) {
    return this.discoveryService.ignoreDevice(id, req.user.tenantId);
  }

  @Post('devices/:id/enrich')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({
    summary: 'Run WMI/SSH/SNMP enrichment scan on discovered device',
  })
  async enrichDevice(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { credentialId?: string },
  ) {
    return this.discoveryService.enrichDevice(
      id,
      req.user.tenantId,
      body.credentialId,
    );
  }

  // ─── Credential Vault ─────────────────────────────────────────

  @Get('credentials')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({
    summary: 'List scan credentials (metadata only, no secrets)',
  })
  async listCredentials(@Request() req: any) {
    return this.credentialVault.findAll(req.user.tenantId);
  }

  @Post('credentials')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create encrypted scan credential' })
  async createCredential(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      type: string;
      credentials: Record<string, any>;
      scope?: any;
    },
  ) {
    return this.credentialVault.create(req.user.tenantId, req.user.sub, body);
  }

  @Patch('credentials/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update scan credential' })
  async updateCredential(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.credentialVault.update(id, req.user.tenantId, body);
  }

  @Delete('credentials/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete scan credential' })
  async deleteCredential(@Request() req: any, @Param('id') id: string) {
    return this.credentialVault.delete(id, req.user.tenantId);
  }

  // ─── Agent Management ─────────────────────────────────────────

  @Get('agents')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List registered discovery agents' })
  async listAgents(@Request() req: any) {
    return this.discoveryService.listAgents(req.user.tenantId);
  }

  @Get('agents/download')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({
    summary:
      'Download the lightweight Node.js discovery agent as a zip package',
  })
  async downloadAgent(@Request() req: any, @Res() res: any) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    const host =
      req.headers['x-forwarded-host'] || req.headers.host || 'localhost:4100';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';

    let serverUrl = `${protocol}://${host}`;
    serverUrl = serverUrl.replace(/\/api\/v1\/?$/, '');

    // Pass the downloader's email so the agent config includes credential-based re-auth
    const userEmail = req.user?.email || '';

    const buffer = this.discoveryService.getAgentZipPackage(
      serverUrl,
      token || undefined,
      userEmail || undefined,
    );
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename=qs-discovery-agent.zip',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('agents/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get agent details + system info' })
  async getAgent(@Request() req: any, @Param('id') id: string) {
    return this.discoveryService.getAgent(id, req.user.tenantId);
  }

  @Delete('agents/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete / unregister a discovery agent' })
  async deleteAgent(@Request() req: any, @Param('id') id: string) {
    return this.discoveryService.deleteAgent(id, req.user.tenantId);
  }

  @Post('agents/register')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Register / re-register a discovery agent' })
  async registerAgent(
    @Request() req: any,
    @Body()
    body: {
      hostname: string;
      platform: string;
      agentVersion: string;
      ipAddress: string;
      macAddress?: string;
      systemInfo?: any;
    },
  ) {
    return this.discoveryService.registerAgent(req.user.tenantId, body);
  }

  @Post('agents/deploy-remote')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Remotely push and install discovery agent on target LAN host' })
  async deployRemoteAgent(
    @Request() req: any,
    @Body() body: { targetIp: string; credentialId: string },
  ) {
    return this.discoveryService.deployRemoteAgent(req.user.tenantId, req.user.sub, body.targetIp, body.credentialId);
  }

  @Post('agents/:id/heartbeat')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Agent heartbeat — confirm alive + push data' })
  async agentHeartbeat(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body?: { systemInfo?: any },
  ) {
    return this.discoveryService.agentHeartbeat(id, req.user.tenantId, body);
  }

  // ─── Scheduled Scans ──────────────────────────────────────────

  @Get('schedules')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List scheduled scans' })
  async listSchedules(@Request() req: any) {
    return this.discoveryService.listSchedules(req.user.tenantId);
  }

  @Post('schedules')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create a scheduled scan (cron-based)' })
  async createSchedule(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      subnet: string;
      scanType: string;
      schedule: string;
      scanWindow?: any;
      credentialId?: string;
    },
  ) {
    return this.discoveryService.createSchedule(
      req.user.tenantId,
      req.user.sub,
      body,
    );
  }

  @Patch('schedules/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update scheduled scan' })
  async updateSchedule(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.discoveryService.updateSchedule(id, req.user.tenantId, body);
  }

  @Delete('schedules/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Delete scheduled scan' })
  async deleteSchedule(@Request() req: any, @Param('id') id: string) {
    return this.discoveryService.deleteSchedule(id, req.user.tenantId);
  }
}
