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
import { AuthService } from '../auth/auth.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { Throttle } from '@nestjs/throttler';
import { AdSyncService } from './ad-sync.service';
import {
  getAgentUpdatePublicKeyPem,
  loadAgentSource,
  signAgentArtifact,
} from '../../common/security/agent-update-crypto';

@ApiTags('discovery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('DISCOVERY')
@Controller('discovery')
export class DiscoveryController {
  constructor(
    private discoveryService: DiscoveryService,
    private credentialVault: CredentialVaultService,
    private authService: AuthService,
    private adSyncService: AdSyncService,
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

  @Throttle({ long: { limit: 60, ttl: 60000 } })
  @Post('scans/:id/results')
  @Roles('Tenant Admin', 'IT Admin', 'agent')
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
    const { serverUrl, agentToken, userEmail } = this.buildAgentDownloadContext(req);

    const buffer = this.discoveryService.getAgentZipPackage(
      serverUrl,
      agentToken,
      userEmail || undefined,
    );
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename=qs-discovery-agent.zip',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('agents/download/desktop')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({
    summary:
      'Download Desktop App package (Electron tray wrapper sources + paired agent config)',
  })
  async downloadDesktopApp(@Request() req: any, @Res() res: any) {
    const { serverUrl, agentToken, userEmail } = this.buildAgentDownloadContext(req);
    const buffer = this.discoveryService.getDesktopAppPackage(serverUrl, agentToken, userEmail);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename=qs-discovery-agent-desktop.zip',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('agents/download/service')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({
    summary: 'Download OS service installer package (systemd / launchd / Windows service scripts)',
  })
  async downloadServiceInstaller(@Request() req: any, @Res() res: any) {
    const { serverUrl, agentToken, userEmail } = this.buildAgentDownloadContext(req);
    const buffer = this.discoveryService.getServiceInstallerPackage(serverUrl, agentToken, userEmail);
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename=qs-discovery-agent-service.zip',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('agents/download-urls')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List real download URLs for Desktop App / Service Installer / ZIP' })
  getDownloadUrls() {
    return {
      zip: '/discovery/agents/download',
      desktop: '/discovery/agents/download/desktop',
      service: '/discovery/agents/download/service',
      note: 'All URLs require Bearer auth. Artifacts are generated from monorepo /agent and /apps/agent-desktop sources.',
    };
  }

  private buildAgentDownloadContext(req: any) {
    const configured =
      process.env.API_PUBLIC_URL ||
      process.env.OAUTH_CALLBACK_URL ||
      process.env.API_URL;
    let serverUrl: string;
    if (configured) {
      serverUrl = configured.replace(/\/$/, '').replace(/\/api\/v1\/?$/, '');
    } else {
      // Dev-only fallback — never trust Host headers in production
      const host = req.headers.host || 'localhost:4100';
      const protocol = req.protocol || 'http';
      serverUrl = `${protocol}://${host}`.replace(/\/api\/v1\/?$/, '');
      if (process.env.NODE_ENV === 'production') {
        throw new Error('API_PUBLIC_URL must be set for agent downloads in production');
      }
    }
    const userEmail = req.user?.email || '';
    const agentToken = this.authService.generateAgentToken(req.user.tenantId, userEmail, req.user.sub);
    return { serverUrl, agentToken, userEmail: userEmail || undefined };
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

  @Throttle({ long: { limit: 20, ttl: 60000 } })
  @Post('agents/register')
  @Roles('Tenant Admin', 'IT Admin', 'agent')
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
  @ApiOperation({
    summary: 'Remotely push and install discovery agent on target LAN host (SSH or WinRM)',
  })
  async deployRemoteAgent(
    @Request() req: any,
    @Body()
    body: {
      targetIp: string;
      credentialId?: string;
      method?: 'ssh' | 'winrm' | 'auto';
      platform?: string;
      username?: string;
      password?: string;
    },
  ) {
    return this.discoveryService.deployRemoteAgent(
      req.user.tenantId,
      req.user.sub,
      body.targetIp,
      body.credentialId || '',
      {
        method: body.method || 'auto',
        platform: body.platform,
        username: body.username,
        password: body.password,
      },
    );
  }

  @Post('agents/deploy-remote/bulk')
  @Roles('Tenant Admin')
  @ApiOperation({
    summary: 'Bulk push-deploy discovery agents to multiple LAN hosts concurrently (SSH or WinRM)',
  })
  async bulkDeployRemoteAgent(
    @Request() req: any,
    @Body()
    body: {
      targets: Array<{
        ip: string;
        credentialId?: string;
        method?: 'ssh' | 'winrm' | 'auto';
        platform?: string;
        username?: string;
        password?: string;
      }>;
      defaultCredentialId?: string;
      method?: 'ssh' | 'winrm' | 'auto';
    },
  ) {
    const results = await Promise.allSettled(
      body.targets.map((t) =>
        this.discoveryService.deployRemoteAgent(
          req.user.tenantId,
          req.user.sub,
          t.ip,
          t.credentialId || body.defaultCredentialId || '',
          {
            method: t.method || body.method || 'auto',
            platform: t.platform,
            username: t.username,
            password: t.password,
          },
        ),
      ),
    );

    const summary = results.map((r, i) => ({
      ip: body.targets[i].ip,
      method:
        r.status === 'fulfilled'
          ? (r.value as any).method
          : body.targets[i].method || body.method || 'auto',
      status: r.status === 'fulfilled' ? (r.value as any).status : 'FAILED',
      success: r.status === 'fulfilled' ? !!(r.value as any).success : false,
      logs: r.status === 'fulfilled' ? (r.value as any).logs : [],
      error:
        r.status === 'rejected'
          ? (r as PromiseRejectedResult).reason?.message
          : (r.value as any)?.error,
      message: r.status === 'fulfilled' ? (r.value as any).message : undefined,
    }));

    return {
      total: body.targets.length,
      succeeded: summary.filter((s) => s.status === 'SUCCESS').length,
      failed: summary.filter((s) => s.status !== 'SUCCESS').length,
      results: summary,
    };
  }

  @Throttle({ long: { limit: 180, ttl: 60000 } })
  @Post('agents/:id/heartbeat')
  @Roles('Tenant Admin', 'IT Admin', 'agent')
  @ApiOperation({ summary: 'Agent heartbeat — confirm alive + push data' })
  async agentHeartbeat(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body?: { systemInfo?: any },
  ) {
    return this.discoveryService.agentHeartbeat(id, req.user.tenantId, body);
  }

  // ─── Remote Command Execution ──────────────────────────────────

  @Post('agents/:agentId/run-script')
  @Roles('Tenant Admin')
  @ApiOperation({
    summary: 'Queue an approved ScriptLibrary script on an agent (UEM remote run)',
  })
  async runScriptOnAgent(
    @Request() req: any,
    @Param('agentId') agentId: string,
    @Body() body: { scriptId: string; parameters?: any },
  ) {
    return this.discoveryService.queueScriptLibraryRun(
      req.user.tenantId,
      req.user.sub,
      agentId,
      body.scriptId,
      body.parameters,
    );
  }

  @Post('agents/:agentId/file-pull')
  @Roles('Tenant Admin')
  @ApiOperation({
    summary: 'Queue FILE_PULL — agent uploads a log/file path back to the server',
  })
  async filePull(
    @Request() req: any,
    @Param('agentId') agentId: string,
    @Body() body: { path: string; maxBytes?: number },
  ) {
    return this.discoveryService.queueFilePull(req.user.tenantId, agentId, body);
  }

  @Throttle({ long: { limit: 60, ttl: 60000 } })
  @Post('agents/file-pull-result')
  @Roles('Tenant Admin', 'IT Admin', 'agent')
  @ApiOperation({ summary: 'Receive FILE_PULL content from agent' })
  async filePullResult(@Request() req: any, @Body() body: any) {
    return this.discoveryService.storeFilePullResult(body, req.user.tenantId);
  }

  @Get('agents/:agentId/remote-assist')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({
    summary:
      'Return rdp:// or ssh:// deep-link for remote assist (no fake WebRTC console)',
  })
  async remoteAssist(@Request() req: any, @Param('agentId') agentId: string) {
    return this.discoveryService.getRemoteAssistDeepLink(agentId, req.user.tenantId);
  }

  @Patch('agents/:agentId/deploy-ring')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Set software deploy ring for an agent (PILOT | STAGED | ALL)' })
  async setDeployRing(
    @Request() req: any,
    @Param('agentId') agentId: string,
    @Body() body: { deployRing: string },
  ) {
    return this.discoveryService.setAgentDeployRing(
      req.user.tenantId,
      agentId,
      body.deployRing,
    );
  }

  @Throttle({ long: { limit: 120, ttl: 60000 } })
  @Post('agents/command-result')
  @Roles('Tenant Admin', 'IT Admin', 'agent')
  @ApiOperation({ summary: 'Receive command execution result from agent' })
  async commandResult(@Request() req: any, @Body() body: any) {
    return this.discoveryService.storeCommandResult(body, req.user.tenantId);
  }

  @Get('agents/:agentId/command-history')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get command execution history for an agent' })
  async commandHistory(@Request() req: any, @Param('agentId') agentId: string) {
    return this.discoveryService.getCommandHistory(agentId, req.user.tenantId);
  }

  // ─── Active Directory / LDAP Sync ───────────────────────────────

  @Get('ad-sync')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get AD/LDAP sync configuration (no secrets)' })
  async getAdSync(@Request() req: any) {
    return this.adSyncService.getConfig(req.user.tenantId);
  }

  @Patch('ad-sync')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update AD/LDAP sync configuration (multi-OU)' })
  async updateAdSync(@Request() req: any, @Body() body: any) {
    return this.adSyncService.updateConfig(req.user.tenantId, body);
  }

  @Post('ad-sync/run')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Run AD/LDAP computer + user sync now' })
  async runAdSync(@Request() req: any) {
    return this.adSyncService.sync(req.user.tenantId, req.user.sub);
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

  // ─── Agent Version Check ──────────────────────────────────────

  @Get('agents/version/latest')
  @ApiOperation({ summary: 'Get latest agent version info (checksum + Ed25519 signature when keys configured)' })
  async getLatestAgentVersion() {
    const source = loadAgentSource();
    const signed = source ? signAgentArtifact(source) : null;
    const publicKey = getAgentUpdatePublicKeyPem();
    return {
      version: '2.0.0',
      releaseDate: '2026-07-01',
      changelog: 'Enterprise v2: signed updates, ScriptLibrary-only remote execution, FILE_PULL allowlists',
      downloadUrls: {
        zip: '/discovery/agents/download',
        desktop: '/discovery/agents/download/desktop',
        service: '/discovery/agents/download/service',
        darwin: '/discovery/agents/download?platform=darwin',
        win32: '/discovery/agents/download?platform=win32',
        linux: '/discovery/agents/download?platform=linux',
      },
      updateChecksum: signed?.checksum || null,
      updateSignature: signed?.signature || null,
      updatePublicKey: publicKey,
      signingRequired: process.env.NODE_ENV === 'production',
    };
  }
}
