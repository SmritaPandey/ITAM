import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  /**
   * Calculates a compound risk score for an asset based on:
   * 1. OS Lifecycle (EOL/EOS) - weight 25%
   * 2. Software Vulnerabilities - weight 35%
   * 3. Security Posture (Firewall/Encryption) - weight 20%
   * 4. Telemetry Anomalies (High CPU/Latency) - weight 10%
   * 5. Hardware Age - weight 10%
   */
  async calculateAssetRisk(assetId: string, tenantId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, tenantId },
      include: {
        osDetails: true,
        securityPosture: true,
        softwareInstalls: { include: { software: true } },
        hardwareDetails: true,
      },
    });

    if (!asset) return null;

    let score = 0;
    const components: any = {};

    // 1. OS Lifecycle (0-100)
    let osScore = 100; // Perfect score
    if (asset.osDetails) {
      const name = asset.osDetails.osName?.toLowerCase() || '';
      if (name.includes('windows 7') || name.includes('windows 2008') || name.includes('centos 7')) {
        osScore = 0; // EOL
      } else if (name.includes('windows 10') && asset.osDetails.osVersion?.includes('1809')) {
        osScore = 30; // Near EOL
      } else if (asset.osDetails.uptimeDays && asset.osDetails.uptimeDays > 30) {
        osScore -= 10; // High uptime = missing reboots/patches
      }
    }
    components.os = osScore;
    score += (100 - osScore) * 0.25;

    // 2. Software Risks (0-100)
    let swScore = 100;
    if (asset.softwareInstalls.length > 0) {
      const unauthorized = asset.softwareInstalls.filter(s => s.software.authorizationStatus === 'UNAUTHORIZED');
      const eol = asset.softwareInstalls.filter(s => s.software.lifecycleStatus === 'EOL');
      const highRisk = asset.softwareInstalls.filter(s => (s.software.riskScore || 0) > 70);

      swScore -= (unauthorized.length * 20);
      swScore -= (eol.length * 15);
      swScore -= (highRisk.length * 10);
      swScore = Math.max(0, swScore);
    }
    components.software = swScore;
    score += (100 - swScore) * 0.35;

    // 3. Security Posture
    let secScore = 0;
    if (asset.securityPosture) {
      if (asset.securityPosture.firewallEnabled) secScore += 50;
      if (asset.securityPosture.encryptionEnabled) secScore += 50;
      if (asset.securityPosture.complianceScore) {
        secScore = (secScore + asset.securityPosture.complianceScore) / 2;
      }
    }
    components.security = secScore;
    score += (100 - secScore) * 0.20;

    // 4. Telemetry (Placeholder for actual anomaly detection)
    let telScore = 100;
    // In a real system, we would query the time-series DB for CPU/RAM spikes
    components.telemetry = telScore;
    score += (100 - telScore) * 0.10;

    // 5. Hardware Age
    let hwScore = 100;
    if (asset.hardwareDetails) {
       // Mock logic: older bios = older hardware
       if (asset.hardwareDetails.biosVersion?.includes('2015') || asset.hardwareDetails.biosVersion?.includes('2016')) {
         hwScore = 50;
       }
    }
    components.hardware = hwScore;
    score += (100 - hwScore) * 0.10;

    const finalScore = Math.min(100, Math.round(score));
    
    // Update the asset with the calculated risk score
    await this.prisma.asset.update({
      where: { id: assetId },
      data: { 
        category: finalScore > 70 ? 'CRITICAL_RISK' : finalScore > 40 ? 'HIGH_RISK' : asset.category 
      }
    });

    return {
      assetId,
      assetName: asset.name,
      overallScore: finalScore,
      riskLevel: finalScore > 75 ? 'CRITICAL' : finalScore > 50 ? 'HIGH' : finalScore > 25 ? 'MEDIUM' : 'LOW',
      components,
      updatedAt: new Date(),
    };
  }

  async getTopRisks(tenantId: string, limit = 10) {
    // This would be a cached or pre-computed table in a large system
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      take: 100, // Sample for demo
    });

    const risks = await Promise.all(
      assets.map(a => this.calculateAssetRisk(a.id, tenantId))
    );

    return risks
      .filter(r => r !== null)
      .sort((a, b) => b!.overallScore - a!.overallScore)
      .slice(0, limit);
  }
}
