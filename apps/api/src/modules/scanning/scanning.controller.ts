import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ScanningService } from './scanning.service';
import { TenantMeteringService } from '../tenants/tenant-metering.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('scanning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('SECURITY_SCAN')
@Controller('scanning')
export class ScanningController {
  constructor(
    private service: ScanningService,
    private metering: TenantMeteringService,
  ) {}

  @Get('capabilities')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List available scanning tools and capabilities' })
  async capabilities() {
    return this.service.getCapabilities();
  }

  @Post('run')
  @Roles('Tenant Admin')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Run a scan (NMAP, SNMP, SSH, ARP, TRACEROUTE, SSL)' })
  async run(@Request() req: any, @Body() body: {
    type: 'NMAP' | 'SNMP' | 'SSH' | 'ARP' | 'TRACEROUTE' | 'SSL';
    target: string;
    options?: any;
  }) {
    // Enforce monthly scan limit
    await this.metering.checkScanLimit(req.user.tenantId);
    return this.service.runScan(req.user.tenantId, req.user.sub, body);
  }

  @Get('results')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get scan history' })
  async results(@Request() req: any) {
    return this.service.getScanHistory(req.user.tenantId);
  }

  @Get('results/:id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get detailed scan result' })
  async resultDetail(@Param('id') id: string, @Request() req: any) {
    return this.service.getScanDetail(id, req.user.tenantId);
  }

  @Post('subnet-audit')
  @Roles('Tenant Admin')
  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @ApiOperation({ summary: 'Full subnet audit (ARP + Nmap combined scan)' })
  async subnetAudit(@Request() req: any, @Body() body: { subnet: string }) {
    await this.metering.checkScanLimit(req.user.tenantId);
    return this.service.subnetAudit(req.user.tenantId, req.user.sub, body.subnet);
  }
}

