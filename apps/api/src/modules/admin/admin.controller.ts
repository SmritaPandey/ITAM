import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), SuperAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private service: AdminService) {}

  // ─── Dashboard ─────────────────────────────────────────────
  @Get('dashboard')
  @ApiOperation({ summary: 'Platform dashboard KPIs' })
  getDashboard() {
    return this.service.getDashboard();
  }

  // ─── Tenants ───────────────────────────────────────────────
  @Get('tenants')
  @ApiOperation({ summary: 'List all tenants' })
  listTenants(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
    @Query('plan') plan?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listTenants({ limit, offset, search, plan, status });
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant detail' })
  getTenant(@Param('id') id: string) {
    return this.service.getTenant(id);
  }

  @Patch('tenants/:id')
  @ApiOperation({ summary: 'Update tenant (plan, status, settings)' })
  updateTenant(@Param('id') id: string, @Body() body: any) {
    return this.service.updateTenant(id, body);
  }

  @Delete('tenants/:id')
  @ApiOperation({ summary: 'Soft-delete tenant' })
  deleteTenant(@Param('id') id: string) {
    return this.service.deleteTenant(id);
  }

  // ─── Users ─────────────────────────────────────────────────
  @Get('users')
  @ApiOperation({ summary: 'List all users (cross-tenant)' })
  listUsers(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.listUsers({ limit, offset, search, tenantId, status });
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update user (status, role, password reset)' })
  updateUser(@Param('id') id: string, @Body() body: any) {
    return this.service.updateUser(id, body);
  }

  // ─── Support Inbox ─────────────────────────────────────────
  @Get('contacts')
  @ApiOperation({ summary: 'List contact form submissions' })
  listContacts(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.service.listContacts({ status, limit, offset });
  }

  @Patch('contacts/:id')
  @ApiOperation({ summary: 'Update contact (status, reply)' })
  updateContact(@Param('id') id: string, @Body() body: any) {
    return this.service.updateContact(id, body);
  }

  // ─── Payments ──────────────────────────────────────────────
  @Get('payments')
  @ApiOperation({ summary: 'List all payments' })
  listPayments(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.service.listPayments({ limit, offset });
  }

  @Post('payments')
  @ApiOperation({ summary: 'Record manual payment' })
  createPayment(@Body() body: any) {
    return this.service.createPayment(body);
  }

  @Patch('subscriptions/:tenantId')
  @ApiOperation({ summary: 'Update subscription' })
  updateSubscription(@Param('tenantId') tenantId: string, @Body() body: any) {
    return this.service.updateSubscription(tenantId, body);
  }

  // ─── Audit & System ────────────────────────────────────────
  @Get('audit-logs')
  @ApiOperation({ summary: 'Platform-wide audit logs' })
  listAuditLogs(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('module') module?: string,
  ) {
    return this.service.listAuditLogs({ limit, offset, module });
  }

  @Get('telemetry')
  @ApiOperation({ summary: 'Platform-wide user telemetry' })
  listTelemetry(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('search') search?: string,
  ) {
    return this.service.listTelemetry({
      limit: limit ? parseInt(String(limit)) : undefined,
      offset: offset ? parseInt(String(offset)) : undefined,
      search,
    });
  }

  @Get('system')
  @ApiOperation({ summary: 'System health & info' })
  getSystemHealth() {
    return this.service.getSystemHealth();
  }
}
