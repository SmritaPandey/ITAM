import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { MqttService } from './mqtt.service';

@ApiTags('iot')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('iot/mqtt')
export class MqttController {
  constructor(private mqttService: MqttService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List MQTT broker configs for the tenant' })
  async list(@Request() req: any) {
    return this.mqttService.listConfigs(req.user.tenantId);
  }

  @Get(':id/status')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Connection status for an MQTT broker' })
  async status(@Request() req: any, @Param('id') id: string) {
    await this.mqttService.getConfig(req.user.tenantId, id);
    return this.mqttService.getConnectionStatus(req.user.tenantId, id);
  }

  @Get(':id')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get a single MQTT broker config' })
  async get(@Request() req: any, @Param('id') id: string) {
    return this.mqttService.getConfig(req.user.tenantId, id);
  }

  @Post()
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Create an MQTT broker config' })
  async create(@Request() req: any, @Body() body: any) {
    return this.mqttService.createConfig(req.user.tenantId, body);
  }

  @Patch(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Update an MQTT broker config' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.mqttService.updateConfig(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Delete an MQTT broker config' })
  async remove(@Request() req: any, @Param('id') id: string) {
    return this.mqttService.deleteConfig(req.user.tenantId, id);
  }

  @Post(':id/start')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Connect / start ingest for an MQTT broker' })
  async start(@Request() req: any, @Param('id') id: string) {
    return this.mqttService.startBroker(req.user.tenantId, id);
  }

  @Post(':id/stop')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Disconnect / stop ingest for an MQTT broker' })
  async stop(@Request() req: any, @Param('id') id: string) {
    return this.mqttService.stopBroker(req.user.tenantId, id);
  }
}
