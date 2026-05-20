import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssetsService } from './assets.service';

@ApiTags('assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assets')
export class AssetsController {
  constructor(private assetsService: AssetsService) {}

  @Get()
  @Roles('*')
  @ApiOperation({ summary: 'List assets with filtering and pagination' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'assetTypeId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'departmentId', required: false })
  async findAll(@Request() req: any, @Query() query: any) {
    return this.assetsService.findAll(req.user.tenantId, query, req.user.sub, req.user.role);
  }

  // ─── STATIC ROUTES (must come before :id) ─────────────────────────

  @Get('types')
  @Roles('*')
  @ApiOperation({ summary: 'List asset types for this tenant' })
  async getTypes(@Request() req: any) {
    return this.assetsService.getAssetTypes(req.user.tenantId);
  }

  @Get('dashboard')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Get asset dashboard statistics' })
  async getDashboard(@Request() req: any) {
    return this.assetsService.getDashboardStats(req.user.tenantId);
  }

  @Get('export')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Export filtered assets as flat JSON (CSV-ready)' })
  async exportAssets(@Request() req: any, @Query() query: any) {
    return this.assetsService.exportAssets(req.user.tenantId, query);
  }

  @Get('checked-out')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List all currently checked out assets' })
  checkedOut(@Request() req: any) { return this.assetsService.getCheckedOut(req.user.tenantId); }

  @Get('overdue')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List overdue asset returns' })
  overdue(@Request() req: any) { return this.assetsService.getOverdue(req.user.tenantId); }

  @Get('lookup')
  @Roles('*')
  @ApiOperation({ summary: 'Lookup asset by barcode/tag/serial' })
  lookup(@Request() req: any, @Query('barcode') barcode: string) {
    return this.assetsService.lookupByBarcode(req.user.tenantId, barcode);
  }

  @Get('warranty-expiring')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Assets with warranty expiring soon' })
  warrantyExpiring(@Request() req: any, @Query('days') days?: string) {
    return this.assetsService.getExpiringAssets(req.user.tenantId, 'warranty', days ? parseInt(days) : 30);
  }

  @Get('lease-expiring')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Assets with lease expiring soon' })
  leaseExpiring(@Request() req: any, @Query('days') days?: string) {
    return this.assetsService.getExpiringAssets(req.user.tenantId, 'lease', days ? parseInt(days) : 30);
  }

  @Get('attestation/pending')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List pending attestations' })
  pendingAttestations(@Request() req: any) { return this.assetsService.getPendingAttestations(req.user.tenantId); }

  // ─── PARAMETERIZED ROUTES ─────────────────────────────────────────

  @Get(':id')
  @Roles('*')
  @ApiOperation({ summary: 'Get a single asset with full details' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.assetsService.findById(id, req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create a new asset' })
  async create(@Request() req: any, @Body() body: any) {
    return this.assetsService.create(req.user.tenantId, req.user.sub, body);
  }

  @Patch(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update an asset' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.assetsService.update(id, req.user.tenantId, req.user.sub, body);
  }

  @Delete(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Soft-delete an asset' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.assetsService.softDelete(id, req.user.tenantId, req.user.sub);
  }

  @Post('bulk-import')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Bulk import assets from parsed CSV data' })
  async bulkImport(@Request() req: any, @Body() body: { assets: any[] }) {
    return this.assetsService.bulkImport(req.user.tenantId, req.user.sub, body.assets);
  }

  @Get(':id/history')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get asset lifecycle history' })
  async getHistory(@Request() req: any, @Param('id') id: string) {
    return this.assetsService.getHistory(id, req.user.tenantId);
  }

  @Get(':id/qr')
  @Roles('*')
  @ApiOperation({ summary: 'Get asset QR and barcode telemetrics data' })
  async getQrData(@Request() req: any, @Param('id') id: string) {
    return this.assetsService.getQrData(id, req.user.tenantId);
  }

  @Get(':id/relationships')
  @Roles('*')
  @ApiOperation({ summary: 'Get asset CI relationships' })
  async getRelationships(@Request() req: any, @Param('id') id: string) {
    return this.assetsService.getRelationships(id, req.user.tenantId);
  }

  @Post(':id/relationships')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create asset relationship' })
  async createRelationship(@Request() req: any, @Param('id') id: string, @Body() body: { targetAssetId: string; type: string }) {
    return this.assetsService.createRelationship(id, req.user.tenantId, body);
  }

  @Get(':id/depreciation')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Calculate asset depreciation (straight-line or declining balance)' })
  async getDepreciation(@Request() req: any, @Param('id') id: string) {
    const asset = await this.assetsService.findById(id, req.user.tenantId);

    const purchasePrice = asset.purchasePrice ? Number(asset.purchasePrice) : 0;
    const salvageValue = asset.salvageValue ? Number(asset.salvageValue) : 0;
    const usefulLifeMonths = asset.usefulLifeMonths || 60; // default 5 years
    const method = asset.depreciationMethod || 'STRAIGHT_LINE';
    const procDate = asset.procurementDate || asset.createdAt;
    const monthsElapsed = Math.max(0, Math.floor((Date.now() - new Date(procDate).getTime()) / (30.44 * 24 * 3600 * 1000)));

    let currentBookValue: number;
    let monthlyDepreciation: number;

    if (method === 'DECLINING_BALANCE') {
      const rate = 2 / usefulLifeMonths;
      currentBookValue = purchasePrice * Math.pow(1 - rate, Math.min(monthsElapsed, usefulLifeMonths));
      currentBookValue = Math.max(currentBookValue, salvageValue);
      monthlyDepreciation = currentBookValue * rate;
    } else {
      // Straight-line
      monthlyDepreciation = (purchasePrice - salvageValue) / usefulLifeMonths;
      const totalDepreciation = monthlyDepreciation * Math.min(monthsElapsed, usefulLifeMonths);
      currentBookValue = Math.max(purchasePrice - totalDepreciation, salvageValue);
    }

    const remainingMonths = Math.max(0, usefulLifeMonths - monthsElapsed);
    const percentDepreciated = purchasePrice > 0 ? ((purchasePrice - currentBookValue) / purchasePrice) * 100 : 0;

    return {
      assetId: id,
      assetName: asset.name,
      purchasePrice,
      salvageValue,
      usefulLifeMonths,
      method,
      monthsElapsed,
      remainingMonths,
      monthlyDepreciation: Math.round(monthlyDepreciation * 100) / 100,
      currentBookValue: Math.round(currentBookValue * 100) / 100,
      percentDepreciated: Math.round(percentDepreciated * 10) / 10,
      projectedEolValue: salvageValue,
      fullyDepreciated: monthsElapsed >= usefulLifeMonths,
    };
  }

  // ─── CHECK-IN / CHECK-OUT ──────────────────────────────────────────
  @Post(':id/checkout')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Check out asset to a user' })
  checkout(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.assetsService.checkout(id, req.user.tenantId, req.user.sub, body);
  }

  @Post(':id/checkin')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Check in (return) asset' })
  checkin(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.assetsService.checkin(id, req.user.tenantId, req.user.sub, body);
  }

}

