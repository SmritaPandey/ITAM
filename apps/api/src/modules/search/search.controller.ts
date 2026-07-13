import { Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('search')
export class SearchController {
  constructor(private service: SearchService) {}

  @Get()
  @Roles(
    'Tenant Admin',
    'IT Admin',
    'Fleet Manager',
    'Employee',
    'Service Desk',
    'Security Analyst',
    'NOC Operator',
    'Facility Manager',
  )
  @ApiOperation({ summary: 'Global search across assets, tickets, users, business services (Meilisearch)' })
  async search(
    @Request() req: any,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.search(req.user.tenantId, q || '', limit ? parseInt(limit, 10) : 10);
  }

  @Post('reindex')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Reindex tenant documents into Meilisearch' })
  async reindex(@Request() req: any) {
    return this.service.reindexTenant(req.user.tenantId);
  }
}
