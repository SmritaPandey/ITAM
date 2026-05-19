import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantsService } from './tenants.service';
import { TenantMeteringService } from './tenant-metering.service';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tenants')
export class TenantsController {
  constructor(
    private service: TenantsService,
    private metering: TenantMeteringService,
  ) {}

  @Get('me')
  @Roles('*')
  @ApiOperation({ summary: 'Get current tenant profile' })
  async getMyTenant(@Request() req: any) {
    return this.service.findById(req.user.tenantId);
  }

  @Get('usage')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get current tenant usage and plan limits' })
  async getUsage(@Request() req: any) {
    return this.metering.getUsage(req.user.tenantId);
  }

  @Get('settings')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Get tenant settings' })
  async getSettings(@Request() req: any) {
    const tenant = await this.service.findById(req.user.tenantId);
    return {
      id: tenant?.id,
      name: tenant?.name,
      slug: tenant?.slug,
      domain: tenant?.domain,
      plan: tenant?.plan,
      status: tenant?.status,
      logoUrl: tenant?.logoUrl,
      settings: tenant?.settings || {},
    };
  }

  @Patch('settings')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update tenant settings' })
  async updateSettings(@Request() req: any, @Body() body: any) {
    return this.service.updateSettings(req.user.tenantId, body);
  }
}
