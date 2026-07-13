import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../common/database/prisma.service';
import { CredentialVaultService } from '../discovery/credential-vault.service';
import { SshScanner } from '../../common/scanners/ssh.scanner';
import * as crypto from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { ModuleGuard } from '../../common/guards/module.guard';
import { RequireModule } from '../../common/decorators/require-module.decorator';

const execAsync = promisify(exec);

@ApiTags('monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ModuleGuard)
@RequireModule('NETWORK')
@Controller('monitoring/network/configs')
export class NetworkConfigController {
  constructor(
    private prisma: PrismaService,
    private credentialVault: CredentialVaultService,
  ) {}

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

  @Post(':deviceId/check-drift')
  @Roles('Tenant Admin', 'IT Admin')
  @ApiOperation({ summary: 'Compare current/latest config hash to baseline; create AlertEvent on drift' })
  async checkDrift(
    @Request() req: any,
    @Param('deviceId') deviceId: string,
    @Body() body?: { configText?: string },
  ) {
    const tenantId = req.user.tenantId;

    const baseline = await this.prisma.networkConfig.findFirst({
      where: { tenantId, deviceId, isBaseline: true },
      orderBy: { version: 'desc' },
    });

    if (!baseline) {
      return {
        deviceId,
        driftDetected: false,
        state: 'NO_BASELINE',
        message: 'No baseline config set for this device. Mark a version as baseline first.',
      };
    }

    let currentHash: string;
    let currentVersion: number | null = null;
    let currentText: string | null = body?.configText || null;

    if (currentText) {
      currentHash = crypto.createHash('sha256').update(currentText).digest('hex');
    } else {
      const latest = await this.prisma.networkConfig.findFirst({
        where: { tenantId, deviceId },
        orderBy: { version: 'desc' },
      });
      if (!latest) {
        return {
          deviceId,
          driftDetected: false,
          state: 'NO_CURRENT',
          message: 'No current config backup found to compare against baseline.',
        };
      }
      currentHash = latest.configHash;
      currentVersion = latest.version;
      currentText = latest.configText;
    }

    const driftDetected = currentHash !== baseline.configHash;
    let alertId: string | null = null;

    if (driftDetected) {
      const alert = await this.prisma.alertEvent.create({
        data: {
          tenantId,
          severity: 'WARNING',
          category: 'NETWORK',
          title: `Config drift on ${baseline.deviceName}`,
          message:
            `Device ${baseline.deviceName} (${deviceId}) config hash differs from baseline v${baseline.version}. ` +
            `Baseline: ${baseline.configHash.slice(0, 12)}… Current: ${currentHash.slice(0, 12)}…`,
          source: 'network-config-drift',
          sourceId: deviceId,
          metadata: {
            deviceId,
            baselineVersion: baseline.version,
            baselineHash: baseline.configHash,
            currentHash,
            currentVersion,
          },
        },
      });
      alertId = alert.id;
    }

    const baselineLines = baseline.configText.split('\n');
    const currentLines = (currentText || '').split('\n');
    const added = currentLines.filter((l) => !baselineLines.includes(l)).length;
    const removed = baselineLines.filter((l) => !currentLines.includes(l)).length;

    return {
      deviceId,
      driftDetected,
      state: driftDetected ? 'DRIFT' : 'IN_SYNC',
      baselineVersion: baseline.version,
      baselineHash: baseline.configHash,
      currentHash,
      currentVersion,
      stats: { added, removed },
      alertId,
      message: driftDetected
        ? 'Config drift detected — AlertEvent created.'
        : 'Config matches baseline.',
    };
  }

  @Post(':deviceId/approve-push')
  @Roles('Tenant Admin')
  @ApiOperation({
    summary: 'Approve and push a config version via SSH (only when credentials exist; honest failure otherwise)',
  })
  async approvePush(
    @Request() req: any,
    @Param('deviceId') deviceId: string,
    @Body() body: { configId?: string; version?: number },
  ) {
    const tenantId = req.user.tenantId;

    let config = null as Awaited<ReturnType<typeof this.prisma.networkConfig.findFirst>>;
    if (body?.configId) {
      config = await this.prisma.networkConfig.findFirst({
        where: { id: body.configId, tenantId, deviceId },
      });
    } else if (body?.version) {
      config = await this.prisma.networkConfig.findFirst({
        where: { tenantId, deviceId, version: body.version },
      });
    } else {
      config = await this.prisma.networkConfig.findFirst({
        where: { tenantId, deviceId, isBaseline: true },
        orderBy: { version: 'desc' },
      });
      if (!config) {
        config = await this.prisma.networkConfig.findFirst({
          where: { tenantId, deviceId },
          orderBy: { version: 'desc' },
        });
      }
    }

    if (!config) {
      throw new NotFoundException('Config version not found for this device');
    }

    const device = await this.prisma.monitoredDevice.findFirst({
      where: { id: deviceId, tenantId },
    });
    const ip =
      device?.ipAddress ||
      (await this.prisma.asset.findFirst({
        where: { id: deviceId, tenantId, deletedAt: null },
        select: { ipAddress: true },
      }))?.ipAddress;

    if (!ip) {
      return {
        success: false,
        state: 'NO_DEVICE_IP',
        message: 'Cannot push: no IP address found for this device. Register the device with an IP first.',
        configId: config.id,
        version: config.version,
      };
    }

    const creds = await this.resolveSshCredentials(tenantId, deviceId, device?.config as any);
    if (!creds) {
      return {
        success: false,
        state: 'NO_CREDENTIALS',
        message:
          'Cannot push: no SSH credentials available for this device. ' +
          'Add an SSH_PASSWORD or SSH_KEY credential in Discovery, or set sshUsername/sshPassword (or credentialId) on the monitored device config.',
        configId: config.id,
        version: config.version,
        targetIp: ip,
      };
    }

    const avail = await SshScanner.isAvailable();
    if (!avail.available) {
      return {
        success: false,
        state: 'SSH_UNAVAILABLE',
        message: 'Cannot push: ssh binary is not available on the API host.',
        configId: config.id,
        version: config.version,
        targetIp: ip,
      };
    }
    if (creds.password && !avail.sshpassAvailable) {
      return {
        success: false,
        state: 'SSHPASS_UNAVAILABLE',
        message: 'Cannot push: password auth requires sshpass on the API host, which is not installed.',
        configId: config.id,
        version: config.version,
        targetIp: ip,
      };
    }

    // Stage config remotely under /tmp — does not apply to running-config automatically
    const remotePath = `/tmp/qs-approved-config-${config.version}-${Date.now()}.cfg`;
    const b64 = Buffer.from(config.configText, 'utf8').toString('base64');
    // Chunk-safe: write via base64 decode on remote
    const remoteCmd = `echo '${b64.replace(/'/g, `'\\''`)}' | base64 -d > '${remotePath}' && wc -c '${remotePath}'`;

    try {
      const sshCmd = this.buildSshCommand(ip, creds, remoteCmd);
      const { stdout, stderr } = await execAsync(sshCmd, { timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
      return {
        success: true,
        state: 'STAGED',
        message: `Config v${config.version} staged on ${ip} at ${remotePath}. Manual apply on the device is still required.`,
        configId: config.id,
        version: config.version,
        targetIp: ip,
        remotePath,
        stdout: (stdout || '').trim().slice(0, 500),
        stderr: (stderr || '').trim().slice(0, 500) || undefined,
      };
    } catch (err: any) {
      return {
        success: false,
        state: 'SSH_FAILED',
        message: `SSH push failed: ${err.message || 'unknown error'}. Credentials were present but the remote operation did not succeed.`,
        configId: config.id,
        version: config.version,
        targetIp: ip,
      };
    }
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

  private async resolveSshCredentials(
    tenantId: string,
    deviceId: string,
    deviceConfig?: any,
  ): Promise<{ username: string; password?: string; privateKeyPath?: string } | null> {
    const cfg = deviceConfig || {};

    if (cfg.sshUsername && (cfg.sshPassword || cfg.privateKeyPath || cfg.sshPrivateKeyPath)) {
      return {
        username: cfg.sshUsername,
        password: cfg.sshPassword,
        privateKeyPath: cfg.privateKeyPath || cfg.sshPrivateKeyPath,
      };
    }

    if (cfg.credentialId) {
      const decrypted = await this.credentialVault.getDecrypted(cfg.credentialId, tenantId);
      if (decrypted?.username) {
        return {
          username: decrypted.username,
          password: decrypted.password,
          privateKeyPath: decrypted.privateKeyPath,
        };
      }
    }

    const sshCreds = await this.prisma.scanCredential.findMany({
      where: { tenantId, type: { in: ['SSH_PASSWORD', 'SSH_KEY'] } },
      orderBy: { lastUsedAt: 'desc' },
      take: 10,
    });

    for (const cred of sshCreds) {
      const scope = (cred.scope || {}) as any;
      const deviceIds: string[] = scope.deviceIds || [];
      const subnets: string[] = scope.subnets || [];
      // Prefer credentials scoped to this device; otherwise accept tenant-wide SSH creds
      if (deviceIds.length && !deviceIds.includes(deviceId) && subnets.length === 0) continue;

      try {
        const decrypted = await this.credentialVault.getDecrypted(cred.id, tenantId);
        if (decrypted?.username) {
          return {
            username: decrypted.username,
            password: decrypted.password,
            privateKeyPath: decrypted.privateKeyPath,
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private buildSshCommand(
    ip: string,
    creds: { username: string; password?: string; privateKeyPath?: string },
    cmd: string,
  ): string {
    const sshOpts = '-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o UserKnownHostsFile=/dev/null';
    const cleanCmd = cmd.replace(/'/g, `'\\''`);

    if (creds.privateKeyPath) {
      return `ssh ${sshOpts} -o BatchMode=yes -i ${creds.privateKeyPath} ${creds.username}@${ip} '${cleanCmd}'`;
    }
    if (creds.password) {
      return `sshpass -p '${creds.password.replace(/'/g, `'\\''`)}' ssh ${sshOpts} ${creds.username}@${ip} '${cleanCmd}'`;
    }
    return `ssh ${sshOpts} -o BatchMode=yes ${creds.username}@${ip} '${cleanCmd}'`;
  }
}
