import { Controller, Get, Post, Query, UseGuards, Request, Body, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditLogsService } from './audit-logs.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import type { Response } from 'express';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('AUDIT_LOGS')
@Controller('admin/audit-logs')
export class AuditLogsController {
  constructor(private service: AuditLogsService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List audit logs with filters' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resourceType', required: false })
  async findAll(@Request() req: any,
    @Query('page') page?: number, @Query('limit') limit?: number,
    @Query('action') action?: string, @Query('resourceType') resourceType?: string,
    @Query('actorId') actorId?: string, @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.findAll(req.user.tenantId, { page, limit, action, resourceType, actorId, startDate, endDate });
  }

  @Get('stats')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Audit log statistics' })
  async getStats(@Request() req: any) {
    return this.service.getStats(req.user.tenantId);
  }

  @Get('verify')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Verify audit log hash chain integrity' })
  async verify(@Request() req: any) {
    return this.service.verifyChain(req.user.tenantId);
  }

  @Get('export')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Export immutable audit records with hash-chain fields as JSON or CSV' })
  @ApiQuery({ name: 'format', required: false, enum: ['json', 'csv'] })
  async export(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('format') requestedFormat?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const format: 'json' | 'csv' = requestedFormat === 'csv' ? 'csv' : 'json';
    const body = await this.service.exportLogs(req.user.tenantId, format, { startDate, endDate });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${stamp}.${format}"`);
    return body;
  }

  @Post('siem/export')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Export recent audit events to SIEM syslog/webhook channels' })
  async exportSiem(
    @Request() req: any,
    @Body() body?: { sinceHours?: number; limit?: number },
  ) {
    return this.service.exportToSiem(req.user.tenantId, body);
  }
}
