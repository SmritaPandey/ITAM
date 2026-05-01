import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LicensesService } from './licenses.service';

@ApiTags('licenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Get(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get license details' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.licensesService.findById(id, req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create a license' })
  async create(@Request() req: any, @Body() body: any) {
    return this.licensesService.create(req.user.tenantId, body);
  }

  @Patch(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update a license' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.licensesService.update(id, req.user.tenantId, body);
  }

  @Get(':id/assignments')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List license assignments (who is using it)' })
  async getAssignments(@Param('id') id: string) {
    return this.licensesService.getAssignments(id);
  }
}
