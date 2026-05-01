import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AutomationService } from './automation.service';

@ApiTags('automation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('automation')
export class AutomationController {
  constructor(private service: AutomationService) {}

  @Get('rules')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List automation rules' })
  async findAll(@Request() req: any, @Query('page') page = 1, @Query('limit') limit = 20) {
    return this.service.findAll(req.user.tenantId, page, limit);
  }

  @Get('rules/stats')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Automation statistics' })
  async getStats(@Request() req: any) {
    return this.service.getStats(req.user.tenantId);
  }

  @Get('rules/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get rule details' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findById(id, req.user.tenantId);
  }

  @Post('rules')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create automation rule' })
  async create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.tenantId, req.user.sub, body);
  }

  @Patch('rules/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update automation rule' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(id, req.user.tenantId, body);
  }

  @Delete('rules/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Delete automation rule' })
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.service.delete(id, req.user.tenantId);
  }

  @Get('executions')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List execution history' })
  async getExecutions(@Request() req: any, @Query('page') page = 1, @Query('limit') limit = 30) {
    return this.service.getExecutions(req.user.tenantId, page, limit);
  }
}
