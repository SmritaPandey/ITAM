import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LicensesService } from './licenses.service';
import { CreateLicenseDto } from './dto/create-license.dto';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('licenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('LICENSES')
@Controller('licenses')
export class LicensesController {
  constructor(private licensesService: LicensesService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List all licenses' })
  async findAll(@Request() req: any, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.licensesService.findAll(req.user.tenantId, page, limit);
  }

  @Get('compliance')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'License compliance overview' })
  async getCompliance(@Request() req: any) {
    return this.licensesService.getCompliance(req.user.tenantId);
  }

  @Get('match')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Find licenses matching a software name (for linking)' })
  async match(
    @Request() req: any,
    @Query('name') name?: string,
    @Query('softwareCatalogId') softwareCatalogId?: string,
  ) {
    return this.licensesService.findMatching(req.user.tenantId, name || '', softwareCatalogId);
  }

  @Get(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get license details' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.licensesService.findById(id, req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create a license' })
  async create(@Request() req: any, @Body() body: CreateLicenseDto) {
    return this.licensesService.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update a license' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.licensesService.update(id, req.user.tenantId, body);
  }

  @Post(':id/link')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Link license to a software catalog entry' })
  async link(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { softwareCatalogId: string },
  ) {
    return this.licensesService.linkToSoftware(id, req.user.tenantId, body.softwareCatalogId);
  }

  @Post(':id/unlink')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Unlink license from software catalog' })
  async unlink(@Request() req: any, @Param('id') id: string) {
    return this.licensesService.unlinkFromSoftware(id, req.user.tenantId);
  }

  @Get(':id/assignments')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List license assignments (who is using it)' })
  async getAssignments(@Param('id') id: string) {
    return this.licensesService.getAssignments(id);
  }

  @Delete(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Delete a license and its assignments' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.licensesService.delete(id, req.user.tenantId);
  }
}
