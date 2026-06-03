import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FleetService } from './fleet.service';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('fleet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('FLEET')
@Controller('fleet')
export class FleetController {
  constructor(private service: FleetService) {}

  @Get('vehicles')
  @Roles('Tenant Admin', 'IT Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'List all GPS-tracked vehicles with stats' })
  async getVehicles(@Request() req: any) {
    return this.service.getVehicles(req.user.tenantId);
  }

  @Get('vehicles/:id/trips')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Get vehicle trip history with GPS points' })
  async getTrips(@Request() req: any, @Param('id') id: string) {
    return this.service.getTripHistory(req.user.tenantId, id);
  }

  @Get('vehicles/:id/live')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Get live vehicle position (poll-based fallback)' })
  async getLivePosition(@Request() req: any, @Param('id') id: string) {
    return this.service.getLivePosition(req.user.tenantId, id);
  }

  @Get('geofences')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'List geofence definitions' })
  async getGeofences(@Request() req: any) {
    return this.service.getGeofences(req.user.tenantId);
  }

  @Post('geofences')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Create a geofence' })
  async createGeofence(@Request() req: any, @Body() body: any) {
    return this.service.createGeofence(req.user.tenantId, body);
  }

  @Get('alerts')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Get fleet alerts' })
  async getAlerts(@Request() req: any) {
    return this.service.getAlerts(req.user.tenantId);
  }

  @Post('telemetry')
  @Roles('Tenant Admin', 'Fleet Manager')
  @ApiOperation({ summary: 'Ingest GPS telemetry data for a vehicle' })
  async ingestTelemetry(@Request() req: any, @Body() body: {
    assetId: string; latitude: number; longitude: number;
    speed?: number; fuelLevel?: number;
  }) {
    return this.service.ingestTelemetry(req.user.tenantId, body);
  }
}
