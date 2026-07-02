import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private alertsService: AlertsService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get all alerts' })
  async getAlerts(@Request() req: any, @Query() query: any) {
    return this.alertsService.getAlerts(req.user.tenantId, query);
  }

  @Get('dashboard')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get alerts dashboard stats' })
  async getDashboard(@Request() req: any) {
    return this.alertsService.getDashboard(req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a manual alert' })
  async createAlert(@Request() req: any, @Body() body: any) {
    return this.alertsService.createAlert(req.user.tenantId, body);
  }

  @Patch(':id/acknowledge')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  async acknowledge(@Request() req: any, @Param('id') id: string) {
    return this.alertsService.acknowledgeAlert(req.user.tenantId, id, req.user.id);
  }

  @Post('acknowledge-all')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Acknowledge all alerts' })
  async acknowledgeAll(@Request() req: any) {
    return this.alertsService.acknowledgeAll(req.user.tenantId, req.user.id);
  }

  @Patch(':id/resolve')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Resolve an alert' })
  async resolve(@Request() req: any, @Param('id') id: string) {
    return this.alertsService.resolveAlert(req.user.tenantId, id);
  }

  // ─── Alert Rules ──────────────────────────────────────────
  @Get('rules')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List alert rules' })
  async getRules(@Request() req: any) {
    return this.alertsService.getAlertRules(req.user.tenantId);
  }

  @Post('rules')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create an alert rule' })
  async createRule(@Request() req: any, @Body() body: any) {
    return this.alertsService.createAlertRule(req.user.tenantId, body);
  }

  @Patch('rules/:id/toggle')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Enable/disable an alert rule' })
  async toggleRule(@Request() req: any, @Param('id') id: string) {
    return this.alertsService.toggleAlertRule(req.user.tenantId, id);
  }

  @Delete('rules/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete an alert rule' })
  async deleteRule(@Request() req: any, @Param('id') id: string) {
    return this.alertsService.deleteAlertRule(req.user.tenantId, id);
  }

  // ─── Notification Channels ──────────────────────────────
  @Get('channels')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'List notification channels' })
  async getChannels(@Request() req: any) {
    return this.alertsService.getNotificationChannels(req.user.tenantId);
  }
}
