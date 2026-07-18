import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ReportGeneratorService } from './report-generator.service';
import { PrismaService } from '../../common/database/prisma.service';
import type { Response } from 'express';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { calculateNextRun } from '../../common/utils/cron-next-run';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('REPORTS')
@Controller('reports')
export class ReportsController {
  constructor(
    private service: ReportsService,
    private generator: ReportGeneratorService,
    private prisma: PrismaService,
  ) {}

  @Get('assets')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Asset inventory summary report' })
  async getAssetSummary(@Request() req: any) {
    return this.service.getAssetSummary(req.user.tenantId);
  }

  @Get('tickets')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Ticket SLA & performance report' })
  async getTicketSummary(@Request() req: any) {
    return this.service.getTicketSummary(req.user.tenantId);
  }

  @Get('licenses')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'License utilization report' })
  async getLicenseSummary(@Request() req: any) {
    return this.service.getLicenseSummary(req.user.tenantId);
  }

  @Get('executive')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Executive dashboard data (all KPIs)' })
  async getExecutiveDashboard(@Request() req: any) {
    return this.service.getExecutiveDashboard(req.user.tenantId);
  }

  @Get('business-services')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Business service health summary for reports' })
  async getBusinessServiceHealth(@Request() req: any) {
    return this.service.getBusinessServiceHealth(req.user.tenantId);
  }

  @Post('run')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Parameterized report builder — run now, optionally email' })
  async runReport(
    @Request() req: any,
    @Body()
    body: {
      reportType: string;
      startDate?: string;
      endDate?: string;
      format?: string;
      filters?: Record<string, any>;
      emailTo?: string[];
      name?: string;
    },
  ) {
    return this.service.runReport(req.user.tenantId, body);
  }

  @Get('trends')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Monthly asset & ticket trends' })
  async getMonthlyTrend(@Request() req: any) {
    return this.service.getMonthlyTrend(req.user.tenantId);
  }

  @Get('trend')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Monthly trends (alias)' })
  async getMonthlyTrendAlias(@Request() req: any) {
    return this.service.getMonthlyTrend(req.user.tenantId);
  }

  // ─── Report Generation & Download ────────────────────────────

  @Get('generate/:type')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Generate a report (JSON data)' })
  async generateReport(
    @Request() req: any,
    @Param('type') type: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.generator.generate(req.user.tenantId, type, { startDate, endDate });
  }

  @Get('download/:type')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Download a report as CSV, XLSX, or PDF' })
  async downloadReport(
    @Request() req: any,
    @Res() res: Response,
    @Param('type') type: string,
    @Query('format') format: string = 'csv',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('priority') priority?: string,
  ) {
    const filters: Record<string, string> = {};
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (priority) filters.priority = priority;

    const report = await this.generator.generate(req.user.tenantId, type, {
      startDate,
      endDate,
      filters,
    });
    const filename = `${type}_report_${new Date().toISOString().split('T')[0]}`;
    const fmt = String(format || 'csv').toLowerCase();

    if (fmt === 'xlsx' || fmt === 'xls') {
      const buffer = await this.generator.toXLSX(report);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.send(buffer);
    } else if (fmt === 'pdf') {
      const buffer = await this.generator.toPDF(report);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.send(buffer);
    } else {
      const csv = this.generator.toCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csv);
    }
  }

  // ─── Scheduled Reports ────────────────────────────────────────

  @Get('schedules')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List scheduled report deliveries' })
  async listSchedules(@Request() req: any) {
    return this.prisma.scheduledReport.findMany({
      where: { tenantId: req.user.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post('schedules')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a scheduled report' })
  async createSchedule(@Request() req: any, @Body() body: {
    name: string; reportType: string; schedule: string;
    format?: string; recipients?: string[]; filters?: any;
  }) {
    return this.prisma.scheduledReport.create({
      data: {
        tenantId: req.user.tenantId,
        name: body.name,
        reportType: body.reportType,
        schedule: body.schedule,
        format: body.format || 'CSV',
        recipients: body.recipients || [],
        filters: body.filters || {},
        createdById: req.user.sub,
        nextRunAt: this.calculateNextRun(body.schedule),
      },
    });
  }

  @Patch('schedules/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update a scheduled report' })
  async updateSchedule(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.prisma.scheduledReport.update({
      where: { id },
      data: {
        ...body,
        ...(body.schedule ? { nextRunAt: this.calculateNextRun(body.schedule) } : {}),
      },
    });
  }

  @Delete('schedules/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete a scheduled report' })
  async deleteSchedule(@Request() req: any, @Param('id') id: string) {
    await this.prisma.scheduledReport.delete({ where: { id } });
    return { deleted: true };
  }

  // ─── Saved custom filters ─────────────────────────────────────

  @Get('saved-filters')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List saved custom report filters' })
  async listSavedFilters(@Request() req: any) {
    return this.service.listSavedFilters(req.user.tenantId);
  }

  @Post('saved-filters')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Save a custom report filter preset' })
  async saveFilter(
    @Request() req: any,
    @Body()
    body: {
      id?: string;
      name: string;
      reportType: string;
      filters?: Record<string, any>;
      format?: string;
    },
  ) {
    return this.service.saveFilter(req.user.tenantId, body);
  }

  @Delete('saved-filters/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Delete a saved report filter' })
  async deleteSavedFilter(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteSavedFilter(req.user.tenantId, id);
  }

  private calculateNextRun(cronExpr: string): Date {
    return calculateNextRun(cronExpr);
  }
}
