import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrivacyService } from './privacy.service';

@ApiTags('privacy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('privacy/data-subject-requests')
export class PrivacyController {
  constructor(private readonly service: PrivacyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a tenant-scoped DPDP data subject request' })
  create(
    @Request() req: any,
    @Body() body: { type: string; subjectEmail: string; details?: string },
  ) {
    return this.service.create(req.user.tenantId, req.user.id || req.user.sub, body);
  }

  @Get()
  @ApiOperation({ summary: 'List data subject requests (admins see the tenant queue)' })
  list(@Request() req: any) {
    const role = req.user?.role?.name || req.user?.role;
    const admin = ['Tenant Admin', 'IT Admin'].includes(role);
    return this.service.list(req.user.tenantId, req.user.id || req.user.sub, !admin);
  }

  @Patch(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update status or resolution of a data subject request' })
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { status?: string; resolution?: string },
  ) {
    return this.service.update(req.user.tenantId, id, body);
  }
}
