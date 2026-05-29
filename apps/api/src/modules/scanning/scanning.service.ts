import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { ScanEngine } from '../../common/scanners/scan-engine';
import { CredentialVaultService } from '../discovery/credential-vault.service';

@Injectable()
export class ScanningService {
  private readonly logger = new Logger(ScanningService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private credentialVault: CredentialVaultService,
  ) {}

  async getCapabilities() {
    return ScanEngine.getCapabilities();
  }

  async runScan(tenantId: string, userId: string, body: {
    type: 'NMAP' | 'SNMP' | 'SSH' | 'ARP' | 'TRACEROUTE' | 'SSL';
    target: string;
    options?: any;
  }) {
    // Determine target type
    let targetType = 'HOST';
    if (body.target.includes('/')) targetType = 'SUBNET';
    else if (body.target.match(/^[a-zA-Z]/)) targetType = body.type === 'SSL' ? 'URL' : 'HOST';
    else if (body.type === 'ARP') targetType = 'SUBNET';

    // Create scan record
    const scanRecord = await this.prisma.scanResult.create({
      data: {
        tenantId,
        scanType: body.type,
        targetType,
        target: body.target,
        status: 'RUNNING',
        triggeredBy: userId,
      },
    });

    this.logger.log(`Scan ${scanRecord.id} started: ${body.type} → ${body.target}`);

    // If SSH scan needs credentials from vault
    if (body.type === 'SSH' && body.options?.credentialId) {
      const credData = await this.credentialVault.getDecrypted(body.options.credentialId, tenantId);
      if (credData) {
        body.options = body.options || {};
        body.options.username = credData.username;
        body.options.password = credData.password;
        body.options.privateKeyPath = credData.privateKeyPath;
      }
    }

    // Run the scan
    const result = await ScanEngine.runScan({
      type: body.type,
      target: body.target,
      options: body.options,
    });

    // Update scan record
    await this.prisma.scanResult.update({
      where: { id: scanRecord.id },
      data: {
        status: result.status,
        completedAt: result.completedAt,
        duration: result.duration,
        summary: result.summary as any,
        results: result.results as any,
        rawOutput: result.error || null,
      },
    });

    // Emit event
    this.eventBus.emitAssetEvent(tenantId, 'scan_completed', {
      scanId: scanRecord.id,
      type: body.type,
      target: body.target,
      status: result.status,
      duration: result.duration,
    });

    this.logger.log(`Scan ${scanRecord.id} ${result.status}: ${result.duration}s`);

    return { id: scanRecord.id, ...result };
  }

  async getScanHistory(tenantId: string, limit = 50) {
    return this.prisma.scanResult.findMany({
      where: { tenantId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true, scanType: true, targetType: true, target: true,
        status: true, startedAt: true, completedAt: true, duration: true,
        summary: true, triggeredBy: true,
      },
    });
  }

  async getScanDetail(id: string, tenantId: string) {
    return this.prisma.scanResult.findFirst({
      where: { id, tenantId },
    });
  }

  async subnetAudit(tenantId: string, userId: string, subnet: string) {
    this.logger.log(`Starting subnet audit: ${subnet}`);

    const results: any[] = [];

    // 1. ARP scan (Layer 2 — fast)
    try {
      const arp = await this.runScan(tenantId, userId, { type: 'ARP', target: subnet });
      results.push({ scanType: 'ARP', ...arp });
    } catch (err: any) {
      results.push({ scanType: 'ARP', status: 'FAILED', error: err.message });
    }

    // 2. Nmap scan (Layer 3+4)
    try {
      const nmap = await this.runScan(tenantId, userId, {
        type: 'NMAP', target: subnet, options: { scanDepth: 'quick' },
      });
      results.push({ scanType: 'NMAP', ...nmap });
    } catch (err: any) {
      results.push({ scanType: 'NMAP', status: 'FAILED', error: err.message });
    }

    return {
      subnet,
      auditedAt: new Date(),
      scansRun: results.length,
      results,
    };
  }
}
