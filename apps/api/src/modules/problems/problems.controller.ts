import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProblemsService } from './problems.service';

@ApiTags('problems')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('problems')
export class ProblemsController {
  constructor(private service: ProblemsService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List problems' })
  list(@Request() req: any, @Query('status') status?: string) { return this.service.list(req.user.tenantId, status); }

  @Get('stats')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Problem stats' })
  stats(@Request() req: any) { return this.service.getStats(req.user.tenantId); }

  @Get('known-errors')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Known error database' })
  knownErrors(@Request() req: any) { return this.service.getKnownErrors(req.user.tenantId); }

  @Get(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get problem detail' })
  detail(@Param('id') id: string, @Request() req: any) { return this.service.getById(id, req.user.tenantId); }

  @Post()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create problem record' })
  create(@Request() req: any, @Body() body: any) { return this.service.create(req.user.tenantId, body); }

  @Patch(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update problem' })
  update(@Param('id') id: string, @Request() req: any, @Body() body: any) { return this.service.update(id, req.user.tenantId, body); }

  @Post(':id/known-error')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Promote to known error' })
  knownError(@Param('id') id: string, @Request() req: any, @Body() body: { workaround: string }) {
    return this.service.promoteToKnownError(id, req.user.tenantId, body.workaround);
  }

  @Post(':id/resolve')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Resolve problem' })
  resolve(@Param('id') id: string, @Request() req: any, @Body() body: { resolution: string }) {
    return this.service.resolve(id, req.user.tenantId, body.resolution);
  }
}
