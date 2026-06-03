import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ServiceCatalogService } from './service-catalog.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('service-catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('SERVICE_CATALOG')
@Controller('service-catalog')
export class ServiceCatalogController {
  constructor(private service: ServiceCatalogService) {}

  @Get()
  @Roles('*')
  @ApiOperation({ summary: 'List available services in the catalog' })
  async getCatalog(@Request() req: any) {
    return this.service.getCatalog(req.user.tenantId);
  }

  @Get(':id')
  @Roles('*')
  @ApiOperation({ summary: 'Get a single catalog item by ID' })
  async getItem(@Request() req: any, @Param('id') id: string) {
    return this.service.getItem(req.user.tenantId, id);
  }

  @Post()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create a new catalog item' })
  async createItem(@Request() req: any, @Body() body: any) {
    return this.service.createItem(req.user.tenantId, body);
  }

  @Patch(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update a catalog item' })
  async updateItem(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateItem(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete a catalog item' })
  async deleteItem(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteItem(req.user.tenantId, id);
  }

  @Post(':id/request')
  @Roles('*')
  @ApiOperation({ summary: 'Submit a service request from the catalog' })
  async requestService(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.requestService(req.user.tenantId, req.user.sub, id, body);
  }
}
