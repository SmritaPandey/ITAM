import {
  Controller,
  Get,
  Post,
  Patch as PatchMethod,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PatchesService } from './patches.service';
import { PatchCatalogService } from './patch-catalog.service';
import { PatchPolicyService } from './patch-policy.service';
import { PatchBundleService } from './patch-bundle.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('patches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('PATCH_MGMT')
@Controller('patches')
export class PatchesController {
  constructor(
    private service: PatchesService,
    private catalog: PatchCatalogService,
    private policies: PatchPolicyService,
    private bundles: PatchBundleService,
  ) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List all patches with compliance stats' })
  async findAll(@Request() req: any) {
    return this.service.findAll(req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a patch record manually' })
  async create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.tenantId, body);
  }

  @PatchMethod(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update a patch record' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(id, req.user.tenantId, body);
  }

  @Get('compliance')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Patch compliance report by severity' })
  async compliance(@Request() req: any) {
    return this.service.getCompliance(req.user.tenantId);
  }

  @Get('compliance/history')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get weekly compliance trend (real data from DB)' })
  async complianceHistory(@Request() req: any) {
    return this.service.getComplianceHistory(req.user.tenantId);
  }

  @Get('missing')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List missing/pending patches' })
  async missing(@Request() req: any) {
    return this.service.getMissing(req.user.tenantId);
  }

  // ─── Catalog ──────────────────────────────────────────────────

  @Get('catalog')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List patch catalog items (winget/brew)' })
  async listCatalog(
    @Query('source') source?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.catalog.listCatalog({
      source,
      search,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('catalog/stats')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Patch catalog stats by source' })
  async catalogStats() {
    return this.catalog.getStats();
  }

  @Post('catalog/sync')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Sync catalog from Homebrew API + winget popular list' })
  async syncCatalog(@Request() req: any) {
    return this.catalog.syncCatalog(req.user.tenantId);
  }

  // ─── Deploy policies ──────────────────────────────────────────

  @Get('policies')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List patch deploy policies' })
  async listPolicies(@Request() req: any) {
    return this.policies.list(req.user.tenantId);
  }

  @Post('policies')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a patch deploy policy' })
  async createPolicy(@Request() req: any, @Body() body: any) {
    return this.policies.create(req.user.tenantId, body);
  }

  @PatchMethod('policies/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update a patch deploy policy' })
  async updatePolicy(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.policies.update(req.user.tenantId, id, body);
  }

  @Delete('policies/:id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete a patch deploy policy' })
  async deletePolicy(@Request() req: any, @Param('id') id: string) {
    return this.policies.remove(req.user.tenantId, id);
  }

  @Post(':id/promote')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Promote patch deploy ring PILOT→STAGED→ALL' })
  async promote(@Request() req: any, @Param('id') id: string) {
    return this.policies.promoteRing(req.user.tenantId, id);
  }

  // ─── Air-gap bundle ───────────────────────────────────────────

  @Get('bundle/export')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Export air-gap patch bundle ZIP' })
  async exportBundle(@Request() req: any, @Res() res: Response) {
    const buf = await this.bundles.exportBundle(req.user.tenantId);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="patch-bundle-${new Date().toISOString().slice(0, 10)}.zip"`,
    );
    res.send(buf);
  }

  @Post('bundle/import')
  @Roles('Tenant Admin')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import air-gap patch bundle ZIP' })
  async importBundle(
    @Request() req: any,
    @UploadedFile() file: any,
    @Body() body?: { zipBase64?: string },
  ) {
    let buffer: Buffer | null = null;
    if (file?.buffer) buffer = file.buffer;
    else if (body?.zipBase64) buffer = Buffer.from(body.zipBase64, 'base64');
    if (!buffer) {
      return { error: 'Provide multipart file or zipBase64 body' };
    }
    return this.bundles.importBundle(req.user.tenantId, buffer);
  }

  @Post('scan')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Trigger a real OS-level patch scan (softwareupdate / apt / yum)' })
  async scan(@Request() req: any) {
    return this.service.scanForPatches(req.user.tenantId, 'MANUAL');
  }

  @Post(':id/deploy')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Deploy patch respecting PILOT→STAGED→ALL rings' })
  async deploy(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body?: { ring?: string; policyId?: string; promote?: boolean },
  ) {
    return this.service.deploy(id, req.user.tenantId, body);
  }

  @Post('deploy-all')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Deploy all pending patches at once' })
  async deployAll(@Request() req: any) {
    return this.service.deployAll(req.user.tenantId);
  }

  @Get(':id/deployments')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get per-asset deployment status for a patch' })
  async deployments(@Param('id') id: string) {
    return this.service.getDeployments(id);
  }

  @Delete(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete a patch record' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.service.delete(id, req.user.tenantId);
  }

  @Post(':id/schedule')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Schedule a patch deployment in a maintenance window' })
  async schedule(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.service.schedulePatch(id, req.user.tenantId, body);
  }

  @Post(':id/rollback')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Rollback a deployed patch; queues agent UNINSTALL_PACKAGE' })
  async rollback(@Param('id') id: string, @Request() req: any) {
    return this.service.rollbackPatch(id, req.user.tenantId);
  }

  @Get('schedules/upcoming')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get upcoming scheduled patch deployments' })
  async upcomingSchedules(@Request() req: any) {
    return this.service.getUpcomingSchedules(req.user.tenantId);
  }

  @Post('software/deploy')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Deploy a software package to agents' })
  async deploySoftware(@Request() req: any, @Body() body: any) {
    return this.service.deploySoftware(req.user.tenantId, body);
  }

  @Get('software/catalog')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get the 3rd-party software catalog' })
  async softwareCatalog() {
    return this.service.getSoftwareCatalog();
  }
}
