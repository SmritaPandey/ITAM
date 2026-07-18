import { Controller, Get, UseGuards, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../common/database/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import * as v8 from 'v8';

const APP_VERSION = '1.0.0';
const MEMORY_WARN_PERCENT = 85;

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  /**
   * Basic health check — public, no auth.
   * Used by load balancers and uptime monitors.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Basic health check (public, no auth)' })
  async check(@Res() res: any) {
    // Hard cap so a stuck DB pool never hangs load balancers / clients
    const dbHealthy = await this.checkDb(5000);
    const status = dbHealthy ? 'healthy' : 'degraded';
    const code = dbHealthy ? 200 : 503;

    res.status(code).json({
      status,
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
    });
  }

  /**
   * Readiness probe — returns 200 when the app is ready to serve traffic.
   * K8s/ECS will not route traffic until this returns 200.
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe (K8s/ECS)' })
  async ready(@Res() res: any) {
    const dbReady = await this.checkDb(5000);
    const memOk = this.checkMemory();

    const ready = dbReady && memOk;
    res.status(ready ? 200 : 503).json({
      ready,
      checks: {
        database: dbReady ? 'up' : 'down',
        memory: memOk ? 'ok' : 'pressure',
      },
    });
  }

  /**
   * Liveness probe — returns 200 as long as the process is alive.
   * K8s will restart the pod if this fails.
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe (K8s/ECS)' })
  live() {
    return {
      alive: true,
      uptime: Math.round(process.uptime()),
      pid: process.pid,
    };
  }

  /**
   * Optional collector / binary availability for operators.
   */
  @Get('capabilities')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Report optional host capabilities (imapflow, ffmpeg, package managers)' })
  async capabilities() {
    const which = async (bin: string) => {
      try {
        const { execFile } = await import('child_process');
        const { promisify } = await import('util');
        const execFileAsync = promisify(execFile);
        await execFileAsync('which', [bin], { timeout: 2000 });
        return true;
      } catch {
        return false;
      }
    };

    let imapflow = false;
    try {
      require.resolve('imapflow');
      imapflow = true;
    } catch {
      imapflow = false;
    }

    let mqtt = false;
    try {
      require.resolve('mqtt');
      mqtt = true;
    } catch {
      mqtt = false;
    }

    const [ffmpeg, winget, apt, yum, brew, nmap] = await Promise.all([
      which('ffmpeg'),
      which('winget'),
      which('apt'),
      which('yum'),
      which('brew'),
      which('nmap'),
    ]);

    return {
      timestamp: new Date().toISOString(),
      note:
        'Patch host-scan (winget/apt/brew) runs on the API host, not managed endpoints. Prefer agent-reported missing patches for endpoint coverage.',
      packages: { imapflow, mqtt },
      binaries: { ffmpeg, winget, apt, yum, brew, nmap },
      redis: !!process.env.REDIS_URL,
      meilisearch: !!(process.env.MEILI_HOST || process.env.MEILISEARCH_HOST),
    };
  }

  /**
   * Detailed health — admin only, includes DB stats, memory, system info.
   */
  @Get('detailed')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Tenant Admin')
  @ApiOperation({ summary: 'Detailed health with system stats (admin only)' })
  async detailed() {
    const dbHealthy = await this.checkDb(5000);
    const [assetCount, ticketCount, userCount, deviceCount, tenantCount] = await Promise.all([
      this.prisma.asset.count().catch(() => 0),
      this.prisma.ticket.count().catch(() => 0),
      this.prisma.user.count().catch(() => 0),
      this.prisma.monitoredDevice.count().catch(() => 0),
      this.prisma.tenant.count().catch(() => 0),
    ]);
    const mem = process.memoryUsage();
    const heapLimit = v8.getHeapStatistics().heap_size_limit;
    const heapPercent = Math.round((mem.heapUsed / heapLimit) * 100);

    return {
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: APP_VERSION,
      uptime: Math.round(process.uptime()),
      services: {
        database: dbHealthy ? 'up' : 'down',
        api: 'up',
      },
      database: {
        tenants: tenantCount,
        assets: assetCount,
        tickets: ticketCount,
        users: userCount,
        monitoredDevices: deviceCount,
      },
      system: {
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        heapLimitMB: Math.round(heapLimit / 1024 / 1024),
        heapPercent,
        rssMB: Math.round(mem.rss / 1024 / 1024),
        externalMB: Math.round(mem.external / 1024 / 1024),
        memoryPressure: heapPercent > MEMORY_WARN_PERCENT,
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid,
      },
    };
  }

  private async checkDb(timeoutMs = 2000): Promise<boolean> {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('db ping timeout')), timeoutMs),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  private checkMemory(): boolean {
    const mem = process.memoryUsage();
    const heapLimit = v8.getHeapStatistics().heap_size_limit;
    const heapPercent = (mem.heapUsed / heapLimit) * 100;
    return heapPercent < MEMORY_WARN_PERCENT;
  }
}
