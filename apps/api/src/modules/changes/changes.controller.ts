import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ChangesService } from './changes.service';
import { CreateChangeDto } from './dto/create-change.dto';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('changes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('CHANGES')
@Controller('changes')
export class ChangesController {
  constructor(private service: ChangesService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List change requests' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  list(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit?: number,
  ) {
    return this.service.list(req.user.tenantId, status, page, limit);
  }

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
  create(@Request() req: any, @Body() body: CreateChangeDto) { return this.service.create(req.user.tenantId, req.user.sub, body); }

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
