import { Controller, Get, Patch, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('settings')
export class SettingsController {
  constructor(private service: SettingsService) {}

  @Get()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Get tenant settings' })
  async getSettings(@Request() req: any) {
    return this.service.getSettings(req.user.tenantId);
  }

  @Patch()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update tenant settings' })
  async updateSettings(@Request() req: any, @Body() body: any) {
    return this.service.updateSettings(req.user.tenantId, body);
  }

  @Get('sites')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List sites' })
  async getSites(@Request() req: any) {
    return this.service.getSites(req.user.tenantId);
  }

  @Get('departments')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List departments' })
  async getDepartments(@Request() req: any) {
    return this.service.getDepartments(req.user.tenantId);
  }

  // ─── Account & Billing ─────────────────────────────────────────

  @Get('account')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Get account overview (users, assets, plan)' })
  async getAccount(@Request() req: any) {
    return this.service.getAccount(req.user.tenantId);
  }

  @Get('subscription')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Get current subscription and plan details' })
  async getSubscription(@Request() req: any) {
    return this.service.getSubscription(req.user.tenantId);
  }

  @Get('invoices')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Get payment/invoice history' })
  async getInvoices(@Request() req: any) {
    return this.service.getInvoices(req.user.tenantId);
  }

  @Post('upgrade')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Request plan upgrade' })
  async requestUpgrade(@Request() req: any, @Body() body: { plan: string; billingCycle?: string }) {
    return this.service.requestUpgrade(req.user.tenantId, body.plan, body.billingCycle);
  }
}
