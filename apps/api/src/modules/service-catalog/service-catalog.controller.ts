import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ServiceCatalogService } from './service-catalog.service';

@ApiTags('service-catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('service-catalog')
export class ServiceCatalogController {
  constructor(private service: ServiceCatalogService) {}

  @Get()
  @Roles('*')
  @ApiOperation({ summary: 'List available services in the catalog' })
  async getCatalog(@Request() req: any) {
    return this.service.getCatalog(req.user.tenantId);
  }

  @Post(':id/request')
  @Roles('*')
  @ApiOperation({ summary: 'Submit a service request from the catalog' })
  async requestService(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.requestService(req.user.tenantId, req.user.sub, id, body);
  }
}
