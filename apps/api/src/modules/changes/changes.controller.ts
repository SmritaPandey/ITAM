import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChangesService } from './changes.service';

@ApiTags('changes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('changes')
export class ChangesController {
  constructor(private service: ChangesService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List change requests' })
  list(@Request() req: any, @Query('status') status?: string) { return this.service.list(req.user.tenantId, status); }

  @Get('stats')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Change management stats' })
  stats(@Request() req: any) { return this.service.getStats(req.user.tenantId); }

  @Get('calendar')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Change calendar (scheduled changes)' })
  calendar(@Request() req: any) { return this.service.getCalendar(req.user.tenantId); }

  @Get(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get change request detail' })
  detail(@Param('id') id: string, @Request() req: any) { return this.service.getById(id, req.user.tenantId); }

  @Post()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create change request' })
  create(@Request() req: any, @Body() body: any) { return this.service.create(req.user.tenantId, req.user.sub, body); }

  @Patch(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update change request' })
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) { return this.service.update(id, req.user.tenantId, body); }

  @Post(':id/status')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Transition change request status (approve/implement/rollback)' })
  transition(@Param('id') id: string, @Request() req: any, @Body() body: { status: string; notes?: string }) {
    return this.service.transition(id, req.user.tenantId, req.user.sub, body.status, body.notes);
  }
}
