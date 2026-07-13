import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { VulnerabilitiesService } from './vulnerabilities.service';

@ApiTags('vulnerabilities')
@Controller('vulnerabilities')
export class VulnerabilitiesController {
  constructor(private service: VulnerabilitiesService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List asset vulnerability findings for tenant' })
  async list(
    @Request() req: any,
    @Query('severity') severity?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listForTenant(req.user.tenantId, {
      severity,
      status,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }

  @Get('dashboard')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Vulnerability dashboard stats' })
  async dashboard(@Request() req: any) {
    return this.service.getDashboard(req.user.tenantId);
  }

  @Get('asset/:assetId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List vulnerabilities for an asset' })
  async forAsset(@Request() req: any, @Param('assetId') assetId: string) {
    return this.service.listForAsset(req.user.tenantId, assetId);
  }

  @Post('ingest')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Ingest recent CVEs from NVD 2.0 API' })
  async ingest(@Body() body: { daysBack?: number }) {
    return this.service.ingestFromNvd({ daysBack: body?.daysBack });
  }

  @Post('scan')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Match tenant assets against CVE catalog' })
  async scan(@Request() req: any) {
    return this.service.scanTenant(req.user.tenantId);
  }

  @Post('agent/scan')
  @UseGuards(ApiKeyGuard)
  @ApiHeader({ name: 'X-Agent-Key', description: 'Tenant agent API key' })
  @ApiOperation({
    summary: 'Agent product CVE scan — matches installed products to CVEs; auto-tickets CRITICAL',
  })
  async agentScan(
    @Request() req: any,
    @Body()
    body: {
      assetId?: string;
      hostname?: string;
      agentId?: string;
      products: { name: string; version?: string }[];
      autoTicket?: boolean;
    },
  ) {
    return this.service.agentProductScan(req.tenantId, body);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Update finding status' })
  async updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.service.updateStatus(req.user.tenantId, id, body.status);
  }

  @Post(':id/ticket')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Create a ticket from a vulnerability finding' })
  async createTicket(@Request() req: any, @Param('id') id: string) {
    return this.service.createTicketFromFinding(
      req.user.tenantId,
      id,
      req.user.id,
    );
  }
}
