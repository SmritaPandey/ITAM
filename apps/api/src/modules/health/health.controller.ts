import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../common/database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'System health check (no auth required)' })
  async check() {
    const dbHealthy = await this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    return {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      services: {
        database: dbHealthy ? 'up' : 'down',
      },
    };
  }

  @Get('detailed')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Detailed health check with database stats (admin only)' })
  async detailed() {
    const dbHealthy = await this.prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    const [assetCount, ticketCount, userCount, deviceCount, patchCount] = await Promise.all([
      this.prisma.asset.count().catch(() => 0),
      this.prisma.ticket.count().catch(() => 0),
      this.prisma.user.count().catch(() => 0),
      this.prisma.monitoredDevice.count().catch(() => 0),
      this.prisma.patch.count().catch(() => 0),
    ]);
    const mem = process.memoryUsage();
    return {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      uptime: Math.round(process.uptime()),
      services: { database: dbHealthy ? 'up' : 'down', api: 'up' },
      database: { assets: assetCount, tickets: ticketCount, users: userCount, monitoredDevices: deviceCount, patches: patchCount },
      system: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        rssMB: Math.round(mem.rss / 1024 / 1024),
        platform: process.platform,
        nodeVersion: process.version,
      },
    };
  }
}

