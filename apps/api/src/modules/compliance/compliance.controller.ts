import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ComplianceService } from './compliance.service';

@ApiTags('compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  async updatePolicy(@Request() req: any, @Param('id') id: string, @Body() body: any) {
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
  @ApiOperation({ summary: 'Approve a detected change' })
  async approveChange(@Request() req: any, @Param('id') id: string, @Body() body?: { note?: string }) {
    return this.complianceService.approveChange(id, req.user.tenantId, req.user.sub, body?.note);
  }

  @Patch('changes/:id/reject')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Reject a detected change' })
  async rejectChange(@Request() req: any, @Param('id') id: string, @Body() body?: { note?: string }) {
    return this.complianceService.rejectChange(id, req.user.tenantId, req.user.sub, body?.note);
  }

  // ─── Agent Timeline ────────────────────────────────────────
  @Get('agents/:id/timeline')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get change timeline for a specific agent' })
  async getAgentTimeline(@Request() req: any, @Param('id') id: string) {
    return this.complianceService.getAgentTimeline(id, req.user.tenantId);
  }
}
