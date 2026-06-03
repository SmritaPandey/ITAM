import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AssetTypesService } from './asset-types.service';

@ApiTags('asset-types')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('asset-types')
export class AssetTypesController {
  constructor(private service: AssetTypesService) {}

  @Get()
  @Roles('*')
  @ApiOperation({ summary: 'List all asset types (hierarchical)' })
  async findAll(@Request() req: any) {
    return this.service.findAll(req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a new asset type' })
  async create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update an asset type' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(id, req.user.tenantId, body);
  }

  @Delete(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete an asset type' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.service.delete(id, req.user.tenantId);
  }
}
