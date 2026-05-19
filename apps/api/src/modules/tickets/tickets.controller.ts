import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TicketsService } from './tickets.service';
import { SlaService } from './sla.service';

@ApiTags('tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tickets')
export class TicketsController {
  constructor(
    private ticketsService: TicketsService,
    private slaService: SlaService,
  ) {}

  @Get()
  @Roles('*')
  @ApiOperation({ summary: 'List tickets with filters' })
  async findAll(@Request() req: any, @Query() query: any) {
    return this.ticketsService.findAll(req.user.tenantId, query, req.user.sub, req.user.role);
  }

  @Get('stats')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get ticket statistics' })
  async getStats(@Request() req: any) {
    return this.ticketsService.getStats(req.user.tenantId);
  }

  // SLA routes (static, before :id)
  @Get('sla/policies')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List all SLA policies' })
  async getSlaPolices(@Request() req: any) {
    return this.slaService.findAll(req.user.tenantId);
  }

  @Get('sla/stats')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'SLA compliance statistics' })
  async getSlaStats(@Request() req: any) {
    return this.slaService.getStats(req.user.tenantId);
  }

  @Get(':id')
  @Roles('*')
  @ApiOperation({ summary: 'Get ticket details' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.ticketsService.findById(id, req.user.tenantId);
  }

  @Post()
  @Roles('*')
  @ApiOperation({ summary: 'Create a new ticket / service request' })
  async create(@Request() req: any, @Body() body: any) {
    const ticket = await this.ticketsService.create(req.user.tenantId, req.user.sub, body);
    // Auto-apply SLA based on priority
    if (ticket?.id && ticket?.priority) {
      await this.slaService.applySlaToTicket(ticket.id, req.user.tenantId, ticket.priority).catch(() => {});
    }
    return ticket;
  }

  @Get(':id/comments')
  @Roles('*')
  @ApiOperation({ summary: 'Get ticket comments' })
  async getComments(@Request() req: any, @Param('id') id: string) {
    return this.ticketsService.getTimeline(id, req.user.tenantId);
  }

  @Post(':id/comments')
  @Roles('*')
  @ApiOperation({ summary: 'Add comment to ticket' })
  async addComment(@Request() req: any, @Param('id') id: string, @Body() body: { content: string; isInternal?: boolean }) {
    return this.ticketsService.addComment(id, req.user.tenantId, req.user.sub, body.content, body.isInternal);
  }

  @Patch(':id/status')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update ticket status (admin only)' })
  async updateStatus(@Request() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.ticketsService.updateStatus(id, req.user.tenantId, body.status);
  }

  @Post(':id/assign')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Assign ticket to user' })
  async assignTicket(@Request() req: any, @Param('id') id: string, @Body() body: { assignedToId: string }) {
    return this.ticketsService.assignTicket(id, req.user.tenantId, body.assignedToId);
  }

  @Post(':id/escalate')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Escalate ticket priority' })
  async escalateTicket(@Request() req: any, @Param('id') id: string, @Body() body: { reason: string; escalateTo?: string }) {
    return this.ticketsService.escalateTicket(id, req.user.tenantId, body);
  }

  @Get(':id/history')
  @Roles('*')
  @ApiOperation({ summary: 'Get ticket timeline/comments' })
  async getTimeline(@Request() req: any, @Param('id') id: string) {
    return this.ticketsService.getTimeline(id, req.user.tenantId);
  }

  @Post('sla/policies')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create SLA policy' })
  async createSlaPolicy(@Request() req: any, @Body() body: any) {
    return this.slaService.create(req.user.tenantId, body);
  }

  @Patch('sla/policies/:policyId')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update SLA policy' })
  async updateSlaPolicy(@Param('policyId') policyId: string, @Body() body: any) {
    return this.slaService.update(policyId, body);
  }

  @Delete('sla/policies/:policyId')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete SLA policy' })
  async deleteSlaPolicy(@Param('policyId') policyId: string) {
    return this.slaService.delete(policyId);
  }
}
