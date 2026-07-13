import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { CmdbService } from './cmdb.service';

@ApiTags('cmdb')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('CMDB')
@Controller('cmdb')
export class CmdbController {
  constructor(private service: CmdbService) {}

  @Get('business-services')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List business services with health rollup' })
  list(@Request() req: any) {
    return this.service.listServices(req.user.tenantId);
  }

  @Post('business-services')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create business service' })
  create(@Request() req: any, @Body() body: any) {
    return this.service.createService(req.user.tenantId, body);
  }

  @Post('business-services/rollup')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Recompute health for all business services' })
  rollupAll(@Request() req: any) {
    return this.service.rollupAll(req.user.tenantId);
  }

  @Get('business-services/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get business service with linked assets' })
  get(@Request() req: any, @Param('id') id: string) {
    return this.service.getService(id, req.user.tenantId);
  }

  @Patch('business-services/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update business service' })
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateService(id, req.user.tenantId, body);
  }

  @Delete('business-services/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Delete business service' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteService(id, req.user.tenantId);
  }

  @Post('business-services/:id/assets')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Link asset to business service' })
  linkAsset(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { assetId: string; role?: string },
  ) {
    return this.service.linkAsset(id, req.user.tenantId, body);
  }

  @Delete('business-services/:id/assets/:assetId')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Unlink asset from business service' })
  unlinkAsset(
    @Request() req: any,
    @Param('id') id: string,
    @Param('assetId') assetId: string,
  ) {
    return this.service.unlinkAsset(id, req.user.tenantId, assetId);
  }

  @Post('business-services/:id/rollup')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Recompute health for one business service' })
  rollupOne(@Request() req: any, @Param('id') id: string) {
    return this.service.rollupServiceHealth(id, req.user.tenantId);
  }

  @Get('impact/:assetId')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'CMDB impact analysis — what breaks if this CI goes down' })
  impact(@Request() req: any, @Param('assetId') assetId: string) {
    return this.service.getImpactAnalysis(assetId, req.user.tenantId);
  }
}
