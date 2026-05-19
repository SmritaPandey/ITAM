import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { ReportGeneratorService } from './report-generator.service';
import { PrismaService } from '../../common/database/prisma.service';
import type { Response } from 'express';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  @ApiOperation({ summary: 'Download a report as CSV or XLSX' })
  async downloadReport(
    @Request() req: any,
    @Res() res: Response,
    @Param('type') type: string,
    @Query('format') format: string = 'csv',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const report = await this.generator.generate(req.user.tenantId, type, { startDate, endDate });
    const filename = `${type}_report_${new Date().toISOString().split('T')[0]}`;

    if (format === 'xlsx') {
      const buffer = await this.generator.toXLSX(report);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
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

  private calculateNextRun(cronExpr: string): Date {
    const now = new Date();
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const [min, hour] = parts;
    const next = new Date(now);
    next.setHours(parseInt(hour) || 0, parseInt(min) || 0, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }
}
