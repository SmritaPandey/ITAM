import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiProduces } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssetsService } from './assets.service';
import { CreateAssetDto } from './dto/create-asset.dto';

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
  pendingAttestations(@Request() req: any, @Query('campaign') campaign?: string) {
    return this.assetsService.getPendingAttestations(req.user.tenantId, campaign);
  }

  @Get('attestation/campaigns')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List attestation campaigns with completion stats' })
  attestationCampaigns(@Request() req: any) {
    return this.assetsService.listAttestationCampaigns(req.user.tenantId);
  }

  @Post('attestation/campaigns')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create attestation campaign (bulk assign certify requests)' })
  createAttestationCampaign(
    @Request() req: any,
    @Body() body: { campaignName?: string; assetIds?: string[]; userIds?: string[] },
  ) {
    return this.assetsService.createAttestationCampaign(
      req.user.tenantId,
      body.campaignName || '',
      { assetIds: body.assetIds, userIds: body.userIds },
    );
  }

  @Post('attestation/remind')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Remind owners of pending attestations' })
  remindAttestations(@Request() req: any, @Body() body: { campaignName?: string }) {
    return this.assetsService.remindAttestations(req.user.tenantId, body?.campaignName);
  }

  @Post('attestation/:id/respond')
  @Roles('*')
  @ApiOperation({ summary: 'Respond to an attestation (CONFIRMED / LOST / TRANSFERRED)' })
  respondAttestation(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { response: string; notes?: string },
  ) {
    return this.assetsService.respondAttestation(id, req.user.tenantId, body.response, body.notes);
  }

  @Post('depreciation/mass-run')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Recalculate currentValue for all assets with purchase price (queued)' })
  massDepreciation(@Request() req: any, @Query('sync') sync?: string) {
    if (sync === 'true') {
      return this.assetsService.runMassDepreciation(req.user.tenantId);
    }
    return this.assetsService.enqueueMassDepreciation(req.user.tenantId);
  }

  @Get('depreciation/report')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Finance depreciation report' })
  depreciationReport(@Request() req: any) {
    return this.assetsService.financeDepreciationReport(req.user.tenantId);
  }

  @Get('lookup/rfid')
  @Roles('*')
  @ApiOperation({ summary: 'Lookup asset by RFID/NFC tag ID' })
  lookupRfid(@Request() req: any, @Query('tag') tag: string) {
    return this.assetsService.findByRfid(req.user.tenantId, tag);
  }

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
  async create(@Request() req: any, @Body() body: CreateAssetDto) {
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
  @ApiOperation({ summary: 'Get asset QR code as PNG (scan URL) or JSON metadata' })
  @ApiProduces('image/png', 'application/json')
  @ApiQuery({ name: 'format', required: false, description: 'png (default) or json' })
  async getQr(
    @Request() req: any,
    @Param('id') id: string,
    @Query('format') format: string,
    @Query('baseUrl') baseUrl: string,
    @Res() res: Response,
  ) {
    const origin = baseUrl || process.env.APP_URL || process.env.FRONTEND_URL;
    if (format === 'json') {
      const data = await this.assetsService.getQrData(id, req.user.tenantId, origin);
      return res.json(data);
    }
    const png = await this.assetsService.generateQrPng(id, req.user.tenantId, origin);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', `inline; filename="asset-${id}-qr.png"`);
    return res.send(png);
  }

  @Get(':id/barcode')
  @Roles('*')
  @ApiOperation({ summary: 'Get asset Code128 barcode as PNG' })
  @ApiProduces('image/png')
  async getBarcode(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, barcode } = await this.assetsService.generateBarcodePng(id, req.user.tenantId);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Barcode-Value', barcode);
    res.setHeader('Content-Disposition', `inline; filename="asset-${id}-barcode.png"`);
    return res.send(buffer);
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
    return this.assetsService.calculateDepreciation(id, req.user.tenantId);
  }

  @Get(':id/impact')
  @Roles('*')
  @ApiOperation({ summary: 'CMDB impact analysis — what breaks if this CI goes down' })
  async getImpact(@Request() req: any, @Param('id') id: string) {
    return this.assetsService.getImpactAnalysis(id, req.user.tenantId);
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

