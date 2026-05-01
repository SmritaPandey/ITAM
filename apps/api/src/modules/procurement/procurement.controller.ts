import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProcurementService } from './procurement.service';

@ApiTags('procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(private service: ProcurementService) {}

  // ─── VENDORS ─────
  @Get('vendors')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List vendors' })
  vendors(@Request() req: any) { return this.service.getVendors(req.user.tenantId); }

  @Post('vendors')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create vendor' })
  createVendor(@Request() req: any, @Body() body: any) { return this.service.createVendor(req.user.tenantId, body); }

  @Patch('vendors/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update vendor' })
  updateVendor(@Param('id') id: string, @Request() req: any, @Body() body: any) { return this.service.updateVendor(id, req.user.tenantId, body); }

  @Delete('vendors/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete vendor' })
  deleteVendor(@Param('id') id: string, @Request() req: any) { return this.service.deleteVendor(id, req.user.tenantId); }

  @Get('vendors/:id/scorecard')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Vendor performance scorecard' })
  vendorScorecard(@Param('id') id: string, @Request() req: any) { return this.service.getVendorScorecard(id, req.user.tenantId); }

  // ─── CONTRACTS ───
  @Get('contracts')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List contracts' })
  contracts(@Request() req: any, @Query('status') status?: string) { return this.service.getContracts(req.user.tenantId, status); }

  @Post('contracts')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create contract' })
  createContract(@Request() req: any, @Body() body: any) { return this.service.createContract(req.user.tenantId, body); }

  @Patch('contracts/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update contract' })
  updateContract(@Param('id') id: string, @Request() req: any, @Body() body: any) { return this.service.updateContract(id, req.user.tenantId, body); }

  @Delete('contracts/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete contract' })
  deleteContract(@Param('id') id: string, @Request() req: any) { return this.service.deleteContract(id, req.user.tenantId); }

  @Get('contracts/expiring')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Contracts expiring soon' })
  expiringContracts(@Request() req: any, @Query('days') days?: string) { return this.service.getExpiringContracts(req.user.tenantId, days ? parseInt(days) : 30); }

  // ─── PURCHASE ORDERS ───
  @Get('purchase-orders')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List purchase orders' })
  purchaseOrders(@Request() req: any, @Query('status') status?: string) { return this.service.getPurchaseOrders(req.user.tenantId, status); }

  @Get('purchase-orders/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get purchase order detail' })
  purchaseOrder(@Param('id') id: string, @Request() req: any) { return this.service.getPurchaseOrder(id, req.user.tenantId); }

  @Post('purchase-orders')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create purchase order with items' })
  createPO(@Request() req: any, @Body() body: any) { return this.service.createPurchaseOrder(req.user.tenantId, req.user.sub, body); }

  @Post('purchase-orders/:id/approve')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Approve purchase order' })
  approvePO(@Param('id') id: string, @Request() req: any) { return this.service.approvePO(id, req.user.tenantId, req.user.sub); }

  @Post('purchase-orders/:id/receive')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Receive goods from PO' })
  receivePO(@Param('id') id: string, @Request() req: any, @Body() body: any) { return this.service.receivePO(id, req.user.tenantId, body); }

  // ─── DASHBOARD ───
  @Get('dashboard')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Procurement analytics dashboard' })
  dashboard(@Request() req: any) { return this.service.getProcurementDashboard(req.user.tenantId); }
}
