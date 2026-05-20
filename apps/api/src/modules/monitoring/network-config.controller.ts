import { Controller, Get, Post, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../common/database/prisma.service';
import * as crypto from 'crypto';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

@ApiTags('monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('NETWORK')
@Controller('monitoring/network/configs')
export class NetworkConfigController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'List network config backups' })
  @ApiQuery({ name: 'deviceId', required: false })
  async findAll(@Request() req: any, @Query('deviceId') deviceId?: string) {
    const where: any = { tenantId: req.user.tenantId };
    if (deviceId) where.deviceId = deviceId;
    return this.prisma.networkConfig.findMany({
      where,
      orderBy: { backedUpAt: 'desc' },
      take: 50,
    });
  }

  @Get(':deviceId/history')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get config version history for a device' })
  async getHistory(@Request() req: any, @Param('deviceId') deviceId: string) {
    return this.prisma.networkConfig.findMany({
      where: { tenantId: req.user.tenantId, deviceId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, configHash: true, backedUpAt: true, isBaseline: true, changesSummary: true },
    });
  }

  @Get(':deviceId/latest')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Get latest config for a device' })
  async getLatest(@Request() req: any, @Param('deviceId') deviceId: string) {
    return this.prisma.networkConfig.findFirst({
      where: { tenantId: req.user.tenantId, deviceId },
      orderBy: { version: 'desc' },
    });
  }

  @Post(':deviceId/backup')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Trigger config backup for a network device' })
  async backupConfig(
    @Request() req: any,
    @Param('deviceId') deviceId: string,
    @Body() body: { deviceName: string; configText: string; isBaseline?: boolean },
  ) {
    const tenantId = req.user.tenantId;
    const configHash = crypto.createHash('sha256').update(body.configText).digest('hex');

    // Check if config has changed from latest
    const latest = await this.prisma.networkConfig.findFirst({
      where: { tenantId, deviceId },
      orderBy: { version: 'desc' },
    });

    if (latest && latest.configHash === configHash) {
      return { message: 'Config unchanged — no new backup created', latestVersion: latest.version };
    }

    // Generate diff summary
    let changesSummary: string | null = null;
    if (latest) {
      const oldLines = latest.configText.split('\n');
      const newLines = body.configText.split('\n');
      const added = newLines.filter(l => !oldLines.includes(l)).length;
      const removed = oldLines.filter(l => !newLines.includes(l)).length;
      changesSummary = `+${added} lines, -${removed} lines from v${latest.version}`;
    }

    const config = await this.prisma.networkConfig.create({
      data: {
        tenantId,
        deviceId,
        deviceName: body.deviceName,
        configText: body.configText,
        version: (latest?.version || 0) + 1,
        configHash,
        changesSummary,
        backedUpById: req.user.sub,
        isBaseline: body.isBaseline || false,
      },
    });

    return config;
  }

  @Get(':deviceId/diff')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Compare two config versions (drift detection)' })
  @ApiQuery({ name: 'v1', required: true, description: 'First version number' })
  @ApiQuery({ name: 'v2', required: true, description: 'Second version number' })
  async diffConfigs(
    @Request() req: any,
    @Param('deviceId') deviceId: string,
    @Query('v1') v1: number,
    @Query('v2') v2: number,
  ) {
    const tenantId = req.user.tenantId;
    const [config1, config2] = await Promise.all([
      this.prisma.networkConfig.findFirst({ where: { tenantId, deviceId, version: +v1 } }),
      this.prisma.networkConfig.findFirst({ where: { tenantId, deviceId, version: +v2 } }),
    ]);

    if (!config1 || !config2) {
      return { error: 'One or both versions not found' };
    }

    const lines1 = config1.configText.split('\n');
    const lines2 = config2.configText.split('\n');
    const added = lines2.filter(l => !lines1.includes(l));
    const removed = lines1.filter(l => !lines2.includes(l));
    const unchanged = lines1.filter(l => lines2.includes(l));

    return {
      deviceId,
      version1: +v1,
      version2: +v2,
      hash1: config1.configHash,
      hash2: config2.configHash,
      driftDetected: config1.configHash !== config2.configHash,
      stats: { added: added.length, removed: removed.length, unchanged: unchanged.length },
      diff: {
        added: added.slice(0, 50),
        removed: removed.slice(0, 50),
      },
    };
  }

  @Post(':id/set-baseline')
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Mark a config version as the compliance baseline' })
  async setBaseline(@Request() req: any, @Param('id') id: string) {
    const config = await this.prisma.networkConfig.findFirstOrThrow({
      where: { id, tenantId: req.user.tenantId },
    });

    // Clear other baselines for this device
    await this.prisma.networkConfig.updateMany({
      where: { tenantId: req.user.tenantId, deviceId: config.deviceId },
      data: { isBaseline: false },
    });

    return this.prisma.networkConfig.update({
      where: { id },
      data: { isBaseline: true },
    });
  }
}
