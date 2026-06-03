import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('problems')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('PROBLEMS')
@Controller('problems')
export class ProblemsController {
  constructor(private service: ProblemsService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List problems' })
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
  create(@Request() req: any, @Body() body: CreateProblemDto) { return this.service.create(req.user.tenantId, body); }

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

  @Post(':id/promote-change')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Promote problem to change request' })
  promoteChange(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.service.promoteToChangeRequest(id, req.user.tenantId, req.user.sub, body);
  }

  @Delete(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete a problem record' })
  remove(@Param('id') id: string, @Request() req: any) { return this.service.delete(id, req.user.tenantId); }
}
