import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { WorkOrderService } from './work-orders.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('work-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('WORK_ORDERS')
@Controller('work-orders')
export class WorkOrdersController {
  constructor(private service: WorkOrderService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List work orders' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  async findAll(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(req.user.tenantId, page, limit, status);
  }

  @Get('stats')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Work order statistics' })
  async getStats(@Request() req: any) {
    return this.service.getStats(req.user.tenantId);
  }

  @Get(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get work order by ID' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.service.findById(id, req.user.tenantId);
  }

  @Post()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create a new work order' })
  async create(@Request() req: any, @Body() body: any) {
    return this.service.create(req.user.tenantId, req.user.sub, body);
  }

  @Post('from-ticket/:ticketId')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Convert a ticket into a work order' })
  async convertFromTicket(@Request() req: any, @Param('ticketId') ticketId: string) {
    return this.service.convertFromTicket(ticketId, req.user.tenantId, req.user.sub);
  }

  @Patch(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update work order details' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(id, req.user.tenantId, body);
  }

  @Post(':id/status')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Transition work order status' })
  async updateStatus(@Request() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.service.updateStatus(id, req.user.tenantId, req.user.sub, body.status);
  }
}
