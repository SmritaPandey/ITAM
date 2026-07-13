import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CloudConnectorsService } from './cloud-connectors.service';

@ApiTags('cloud-connectors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cloud-connectors')
export class CloudConnectorsController {
  constructor(private service: CloudConnectorsService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin', 'Platform Owner')
  @ApiOperation({ summary: 'List cloud connectors' })
  list(@Request() req: any) {
    return this.service.list(req.user.tenantId);
  }

  @Get(':id')
  @Roles('Tenant Admin', 'IT Admin', 'Platform Owner')
  @ApiOperation({ summary: 'Get cloud connector' })
  get(@Request() req: any, @Param('id') id: string) {
    return this.service.get(id, req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin', 'Platform Owner')
  @ApiOperation({ summary: 'Create cloud connector (AWS / Azure / GCP)' })
  create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @Roles('Tenant Admin', 'Platform Owner')
  @ApiOperation({ summary: 'Update cloud connector' })
  update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(id, req.user.tenantId, body);
  }

  @Delete(':id')
  @Roles('Tenant Admin', 'Platform Owner')
  @ApiOperation({ summary: 'Delete cloud connector' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.service.remove(id, req.user.tenantId);
  }

  @Post(':id/sync')
  @Roles('Tenant Admin', 'Platform Owner')
  @ApiOperation({ summary: 'Sync assets from cloud provider (AWS EC2 / Azure VMs / GCP Compute)' })
  sync(@Request() req: any, @Param('id') id: string) {
    return this.service.sync(id, req.user.tenantId, req.user.sub);
  }
}
