import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SoftwareService } from './software.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('software')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('IT_ASSETS')
@Controller('software')
export class SoftwareController {
  constructor(private softwareService: SoftwareService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List all software catalog entries' })
  async findAll(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('authorizationStatus') authorizationStatus?: string,
    @Query('lifecycleStatus') lifecycleStatus?: string,
    @Query('category') category?: string,
    @Query('publisher') publisher?: string,
    @Query('sortBy') sortBy?: string,
  ) {
    return this.softwareService.findAll(req.user.tenantId, page, limit, search, {
      authorizationStatus,
      lifecycleStatus,
      category,
      publisher,
    }, sortBy);
  }

  @Get('dashboard')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Software inventory dashboard stats' })
  async getDashboard(@Request() req: any) {
    return this.softwareService.getDashboard(req.user.tenantId);
  }

  @Get('utilization')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'License utilization across software' })
  async getUtilization(@Request() req: any) {
    return this.softwareService.getUtilization(req.user.tenantId);
  }

  @Get('eol')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Software approaching or past end-of-life' })
  async getEolSoftware(@Request() req: any) {
    return this.softwareService.getEolSoftware(req.user.tenantId);
  }

  @Get('unauthorized')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Unauthorized/blacklisted software with install counts' })
  async getUnauthorized(@Request() req: any) {
    return this.softwareService.getUnauthorized(req.user.tenantId);
  }

  @Get('by-user/:userId')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'All software installed on assets assigned to a user' })
  async getByUser(@Request() req: any, @Param('userId') userId: string) {
    return this.softwareService.getByUser(userId, req.user.tenantId);
  }

  @Get(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get software detail with version distribution and licenses' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.softwareService.findById(id, req.user.tenantId);
  }

  @Get(':id/assets')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Assets with this software installed' })
  async getAssets(
    @Request() req: any,
    @Param('id') id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.softwareService.getAssets(id, req.user.tenantId, page, limit);
  }

  @Get(':id/users')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get users using a specific software' })
  async getUsers(
    @Param('id') id: string,
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.softwareService.getUsers(id, req.user.tenantId, page, limit);
  }

  @Post('sync')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Manually sync software inventory from discovery data' })
  async sync(@Request() req: any) {
    return this.softwareService.syncFromDiscovery(req.user.tenantId);
  }

  @Patch(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update software catalog entry' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.softwareService.update(id, req.user.tenantId, body);
  }
}
