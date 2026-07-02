import { Controller, Get, Post, Patch as PatchMethod, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PatchesService } from './patches.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('patches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('PATCH_MGMT')
@Controller('patches')
export class PatchesController {
  constructor(private service: PatchesService) {}

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

  @Post('scan')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Trigger a real OS-level patch scan (softwareupdate / apt / yum)' })
  async scan(@Request() req: any) {
    return this.service.scanForPatches(req.user.tenantId, 'MANUAL');
  }

  @Post(':id/deploy')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Mark patch as deployed' })
  async deploy(@Param('id') id: string, @Request() req: any) {
    return this.service.deploy(id, req.user.tenantId);
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
  @ApiOperation({ summary: 'Rollback a deployed patch to previous state' })
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
