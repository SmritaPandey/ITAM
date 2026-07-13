import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OtProbeService } from './ot-probe.service';

@ApiTags('iot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('iot/ot-probes')
export class OtProbeController {
  constructor(private otProbe: OtProbeService) {}

  @Get('capabilities')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({
    summary: 'Modbus/BACnet probe capability flags (honest when disabled)',
  })
  capabilities() {
    return this.otProbe.getCapabilities();
  }

  @Post('modbus')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({
    summary:
      'Probe Modbus TCP targets (requires MODBUS_PROBE_ENABLED=true). Returns empty when disabled.',
  })
  probeModbus(
    @Request() req: any,
    @Body() body: { targets: Array<{ host: string; port?: number; unitId?: number }> },
  ) {
    return this.otProbe.probeModbus(req.user.tenantId, body.targets || [], req.user.sub);
  }

  @Post('bacnet')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({
    summary:
      'BACnet/IP Who-Is probe (requires BACNET_PROBE_ENABLED=true). Returns empty when disabled.',
  })
  probeBacnet(
    @Request() req: any,
    @Body()
    body: {
      targets?: Array<{ host: string; port?: number }>;
      broadcastAddress?: string;
      timeoutMs?: number;
    },
  ) {
    return this.otProbe.probeBacnet(req.user.tenantId, body || {}, req.user.sub);
  }
}
