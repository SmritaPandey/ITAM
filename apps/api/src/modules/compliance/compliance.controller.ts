import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ComplianceService } from './compliance.service';
import { UpdatePolicyDto } from './dto/update-policy.dto';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('COMPLIANCE')
@Controller('compliance')
export class ComplianceController {
  constructor(private complianceService: ComplianceService) {}

  // ─── Dashboard ─────────────────────────────────────────────
  @Get('dashboard')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get compliance dashboard stats' })
  async getDashboard(@Request() req: any) {
    return this.complianceService.getDashboard(req.user.tenantId);
  }

  // ─── Policies ──────────────────────────────────────────────
  @Get('policies')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List endpoint compliance policies' })
  async listPolicies(@Request() req: any) {
    return this.complianceService.listPolicies(req.user.tenantId);
  }

  @Get('policies/templates')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get pre-built policy templates' })
  getTemplates() {
    return this.complianceService.getTemplates();
  }

  @Post('policies')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a new endpoint policy' })
  async createPolicy(@Request() req: any, @Body() body: {
    name: string; description?: string; category: string;
    severity?: string; action?: string; matchPattern?: any; scope?: any;
  }) {
    return this.complianceService.createPolicy(req.user.tenantId, req.user.sub, body);
  }

  @Patch('policies/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update an endpoint policy' })
  async updatePolicy(@Request() req: any, @Param('id') id: string, @Body() body: UpdatePolicyDto) {
    return this.complianceService.updatePolicy(id, req.user.tenantId, body);
  }

  @Delete('policies/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete an endpoint policy' })
  async deletePolicy(@Request() req: any, @Param('id') id: string) {
    return this.complianceService.deletePolicy(id, req.user.tenantId);
  }

  @Post('policies/seed')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Seed default policy templates' })
  async seedPolicies(@Request() req: any) {
    return this.complianceService.seedDefaultPolicies(req.user.tenantId);
  }

  // ─── Changes ───────────────────────────────────────────────
  @Get('changes')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List detected endpoint changes' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'agentId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async listChanges(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('category') category?: string,
    @Query('agentId') agentId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.complianceService.listChanges(req.user.tenantId, {
      status, severity, category, agentId, page, limit,
    });
  }

  @Patch('changes/:id/approve')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Approve a detected change / threat (enqueues APPROVE_CHANGE for agent)' })
  async approveChange(@Request() req: any, @Param('id') id: string, @Body() body?: { note?: string }) {
    return this.complianceService.approveChange(id, req.user.tenantId, req.user.sub, body?.note);
  }

  @Patch('changes/:id/reject')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Reject/block a detected change (enqueues KILL_PROCESS / BLOCK_USB / etc.)' })
  async rejectChange(@Request() req: any, @Param('id') id: string, @Body() body?: { note?: string }) {
    return this.complianceService.rejectChange(id, req.user.tenantId, req.user.sub, body?.note);
  }

  @Patch('changes/:id/quarantine')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Quarantine endpoint for a detected threat (enqueues QUARANTINE_DEVICE)' })
  async quarantineChange(@Request() req: any, @Param('id') id: string, @Body() body?: { note?: string }) {
    return this.complianceService.quarantineChange(id, req.user.tenantId, req.user.sub, body?.note);
  }

  @Patch('changes/:id/block')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Block a detected threat (enqueues KILL_PROCESS / BLOCK_USB / BLOCK_PORT)' })
  async blockChange(@Request() req: any, @Param('id') id: string, @Body() body?: { note?: string }) {
    return this.complianceService.blockChange(id, req.user.tenantId, req.user.sub, body?.note);
  }

  // ─── Agent Timeline ────────────────────────────────────────
  @Get('agents/:id/timeline')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get change timeline for a specific agent' })
  async getAgentTimeline(@Request() req: any, @Param('id') id: string) {
    return this.complianceService.getAgentTimeline(id, req.user.tenantId);
  }

  // ─── Agentless Scanning ────────────────────────────────────
  @Post('agentless/scan')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Run agentless compliance scan via SSH on a single target' })
  async agentlessScan(@Request() req: any, @Body() body: {
    target: string; username: string; password?: string;
    privateKeyPath?: string; credentialId?: string;
  }) {
    return this.complianceService.agentlessScan(req.user.tenantId, body);
  }

  @Post('agentless/batch')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Run agentless compliance scan on multiple targets' })
  async agentlessBatchScan(@Request() req: any, @Body() body: {
    targets: string[]; username: string; password?: string;
    privateKeyPath?: string; credentialId?: string;
  }) {
    return this.complianceService.agentlessBatchScan(req.user.tenantId, body);
  }

  // ─── CIS Benchmark Assessment ──────────────────────────────
  @Post('cis-benchmark/assess/:agentId')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Run CIS Benchmark compliance assessment on a specific agent' })
  async assessCisBenchmark(@Request() req: any, @Param('agentId') agentId: string) {
    return this.complianceService.assessCisBenchmark(req.user.tenantId, agentId);
  }

  @Get('cis-benchmark/report')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get CIS Benchmark compliance report across all agents' })
  async cisBenchmarkReport(@Request() req: any) {
    return this.complianceService.getCisBenchmarkReport(req.user.tenantId);
  }

  @Get('cis-benchmark/evidence')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiQuery({ name: 'format', required: false, enum: ['csv', 'pdf'] })
  @ApiOperation({ summary: 'Export CIS evidence pack as CSV or PDF' })
  async exportCisEvidence(
    @Request() req: any,
    @Res() res: Response,
    @Query('format') format?: string,
  ) {
    const fmt = format === 'pdf' ? 'pdf' : 'csv';
    const pack = await this.complianceService.exportCisEvidencePack(
      req.user.tenantId,
      fmt,
    );
    res.setHeader('Content-Type', pack.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${pack.filename}"`);
    res.send(pack.body);
  }
}
