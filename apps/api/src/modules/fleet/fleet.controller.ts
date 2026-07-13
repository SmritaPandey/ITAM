import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FleetService } from './fleet.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';
import { PrismaService } from '../../common/database/prisma.service';

@ApiTags('fleet')
@Controller('fleet')
export class FleetController {
  constructor(
    private service: FleetService,
    private prisma: PrismaService,
  ) {}

  @Get('vehicles')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
  @RequireModule('FLEET')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'List all GPS-tracked vehicles with stats' })
  async getVehicles(@Request() req: any) {
    return this.service.getVehicles(req.user.tenantId);
  }

  @Get('vehicles/:id/trips')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
  @RequireModule('FLEET')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Get vehicle trip history with GPS points' })
  async getTrips(@Request() req: any, @Param('id') id: string) {
    return this.service.getTripHistory(req.user.tenantId, id);
  }

  @Get('vehicles/:id/live')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
  @RequireModule('FLEET')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Get live vehicle position (poll-based fallback)' })
  async getLivePosition(@Request() req: any, @Param('id') id: string) {
    return this.service.getLivePosition(req.user.tenantId, id);
  }

  @Get('geofences')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
  @RequireModule('FLEET')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'List geofence definitions' })
  async getGeofences(@Request() req: any) {
    return this.service.getGeofences(req.user.tenantId);
  }

  @Post('geofences')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
  @RequireModule('FLEET')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Create a geofence' })
  async createGeofence(@Request() req: any, @Body() body: any) {
    return this.service.createGeofence(req.user.tenantId, body);
  }

  @Get('alerts')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
  @RequireModule('FLEET')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Get fleet alerts (AlertEvent geofence/speeding/idle)' })
  async getAlerts(@Request() req: any) {
    return this.service.getAlerts(req.user.tenantId);
  }

  @Get('maintenance-due')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
  @RequireModule('FLEET')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Fleet vehicle maintenance due from EAM schedules' })
  async getMaintenanceDue(@Request() req: any) {
    return this.service.getMaintenanceDue(req.user.tenantId);
  }

  @Post('telemetry')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
  @RequireModule('FLEET')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Ingest GPS telemetry data for a vehicle' })
  async ingestTelemetry(
    @Request() req: any,
    @Body()
    body: {
      assetId: string;
      latitude: number;
      longitude: number;
      speed?: number;
      fuelLevel?: number;
    },
  ) {
    return this.service.ingestTelemetry(req.user.tenantId, body);
  }

  @Post('traccar')
  @ApiOperation({ summary: 'Traccar webhook → GpsTelemetry (X-Fleet-Token or X-Agent-Key)' })
  @ApiHeader({ name: 'X-Fleet-Token', required: false })
  async traccarWebhook(
    @Body() body: any,
    @Query() query: any,
    @Headers('x-fleet-token') fleetToken?: string,
    @Headers('x-agent-key') agentKey?: string,
    @Headers('x-api-key') apiKey?: string,
  ) {
    const tenantId = await this.resolveWebhookTenant(fleetToken || agentKey || apiKey, query.token);
    return this.service.ingestTraccarOrOsmand(tenantId, { ...body, protocol: 'traccar' }, query);
  }

  @Post('osmand')
  @ApiOperation({ summary: 'OsmAnd / Traccar OsmAnd protocol webhook → GpsTelemetry' })
  async osmandWebhook(
    @Body() body: any,
    @Query() query: any,
    @Headers('x-fleet-token') fleetToken?: string,
    @Headers('x-agent-key') agentKey?: string,
    @Headers('x-api-key') apiKey?: string,
  ) {
    const tenantId = await this.resolveWebhookTenant(
      fleetToken || agentKey || apiKey,
      query.token || query.fleetToken,
    );
    return this.service.ingestTraccarOrOsmand(tenantId, { ...body, protocol: 'osmand' }, query);
  }

  private async resolveWebhookTenant(
    headerToken?: string,
    queryToken?: string,
  ): Promise<string> {
    const token = headerToken || queryToken;
    if (!token) throw new UnauthorizedException('Fleet webhook token required');

    // Match tenant.settings.fleet.webhookToken or settings.apiKey or tenant id
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, settings: true },
      take: 500,
    });
    for (const t of tenants) {
      const s = (t.settings as any) || {};
      if (s.fleet?.webhookToken === token || s.apiKey === token || t.id === token) {
        return t.id;
      }
    }
    throw new UnauthorizedException('Invalid fleet webhook token');
  }
}
