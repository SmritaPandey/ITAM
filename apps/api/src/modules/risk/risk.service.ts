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
   * Calculates a compound risk score for an asset (CVE-primary):
   * 1. Open CVE / CVSS findings - weight 50%
   * 2. Software policy (blacklist/unauthorized/EOL) - weight 15%
   * 3. OS Lifecycle (EOL/EOS) - weight 15%
   * 4. Security Posture (Firewall/Encryption) - weight 10%
   * 5. Telemetry + Hardware Age - weight 10% combined
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

    // Fetch the live agent linked to this asset (if any) for real telemetry
    const agent = await this.prisma.agent.findFirst({
      where: { tenantId, assetId },
      select: { systemInfo: true, lastHeartbeat: true, status: true },
    });

    let score = 0;
    const components: any = {};

    // 1. CVE-primary risk (0–100 health → contribution to risk)
    const openVulns = await this.prisma.assetVulnerability.findMany({
      where: { tenantId, assetId, status: 'OPEN' },
      select: {
        vulnerability: { select: { severity: true, cvssScore: true } },
      },
    });
    let cveHealth = 100;
    let maxCvss = 0;
    let criticalVulns = 0;
    let highVulns = 0;
    let mediumVulns = 0;
    for (const v of openVulns) {
      const sev = v.vulnerability.severity;
      const cvss = Number(v.vulnerability.cvssScore || 0);
      if (cvss > maxCvss) maxCvss = cvss;
      if (sev === 'CRITICAL') {
        criticalVulns++;
        cveHealth -= Math.max(20, cvss * 2.5);
      } else if (sev === 'HIGH') {
        highVulns++;
        cveHealth -= Math.max(10, cvss * 1.5);
      } else if (sev === 'MEDIUM') {
        mediumVulns++;
        cveHealth -= 5;
      } else {
        cveHealth -= 2;
      }
    }
    cveHealth = Math.max(0, Math.min(100, cveHealth));
    // Floor: any CRITICAL open finding caps health at 40
    if (criticalVulns > 0) cveHealth = Math.min(cveHealth, 40);
    components.cve = cveHealth;
    components.vulnerabilities = {
      critical: criticalVulns,
      high: highVulns,
      medium: mediumVulns,
      open: openVulns.length,
      maxCvss,
    };
    score += (100 - cveHealth) * 0.5;

    // 2. Software policy risks
    let swScore = 100;
    if (asset.softwareInstalls.length > 0) {
      const unauthorized = asset.softwareInstalls.filter(
        (s) => s.software.authorizationStatus === 'UNAUTHORIZED',
      );
      const blacklisted = asset.softwareInstalls.filter(
        (s) => s.software.isBlacklisted || s.software.authorizationStatus === 'BLACKLISTED',
      );
      const eol = asset.softwareInstalls.filter((s) => s.software.lifecycleStatus === 'EOL');
      const highRisk = asset.softwareInstalls.filter((s) => (s.software.riskScore || 0) > 70);

      swScore -= blacklisted.length * 30;
      swScore -= unauthorized.length * 15;
      swScore -= eol.length * 12;
      swScore -= highRisk.length * 8;
    }
    swScore = Math.max(0, swScore);
    components.software = swScore;
    score += (100 - swScore) * 0.15;

    // 3. OS Lifecycle (0-100)
    let osScore = 100;
    if (asset.osDetails) {
      const name = asset.osDetails.osName?.toLowerCase() || '';
      if (name.includes('windows 7') || name.includes('windows 2008') || name.includes('centos 7')) {
        osScore = 0;
      } else if (name.includes('windows 10') && asset.osDetails.osVersion?.includes('1809')) {
        osScore = 30;
      } else if (asset.osDetails.uptimeDays && asset.osDetails.uptimeDays > 30) {
        osScore -= 10;
      }
    }
    components.os = osScore;
    score += (100 - osScore) * 0.15;

    // 4. Security Posture
    let secScore = 0;
    if (asset.securityPosture) {
      if (asset.securityPosture.firewallEnabled) secScore += 50;
      if (asset.securityPosture.encryptionEnabled) secScore += 50;
      if (asset.securityPosture.complianceScore) {
        secScore = (secScore + asset.securityPosture.complianceScore) / 2;
      }
    }
    components.security = secScore;
    score += (100 - secScore) * 0.1;

    // 4. Telemetry — real agent heartbeat data (CPU/RAM pressure, disk saturation, staleness)
    let telScore = 100;
    if (agent) {
      const si = (agent.systemInfo as any) || {};
      const cpuPct = Number(si?.performance?.cpuUsagePercent ?? NaN);
      const ramPct = Number(si?.hardware?.ramUsagePercent ?? NaN);
      const diskPct = Number(
        si?.hardware?.diskUsagePercent ?? si?.performance?.diskUsagePercent ?? NaN,
      );
      // Sustained resource saturation indicates instability / possible compromise (cryptominers, runaway procs)
      if (!Number.isNaN(cpuPct) && cpuPct >= 95) telScore -= 25;
      else if (!Number.isNaN(cpuPct) && cpuPct >= 85) telScore -= 10;
      if (!Number.isNaN(ramPct) && ramPct >= 95) telScore -= 20;
      else if (!Number.isNaN(ramPct) && ramPct >= 85) telScore -= 10;
      if (!Number.isNaN(diskPct) && diskPct >= 95) telScore -= 20;
      else if (!Number.isNaN(diskPct) && diskPct >= 90) telScore -= 10;
      // Stale/offline agent = blind spot: no live visibility on this asset
      if (agent.lastHeartbeat) {
        const staleMins = (Date.now() - new Date(agent.lastHeartbeat).getTime()) / 60000;
        if (staleMins > 24 * 60) telScore -= 30;
        else if (staleMins > 60) telScore -= 15;
      } else {
        telScore -= 30;
      }
      telScore = Math.max(0, telScore);
    } else if (asset.lastScannedAt) {
      // Agentless asset: score visibility freshness from last scan time
      const staleDays = (Date.now() - new Date(asset.lastScannedAt).getTime()) / 86400000;
      if (staleDays > 30) telScore = 60;
      else if (staleDays > 7) telScore = 80;
    } else {
      telScore = 50; // Never scanned and no agent — unknown state is a risk
    }
    components.telemetry = telScore;
    score += (100 - telScore) * 0.05;

    // 5. Hardware Age — real signals: warranty/EOL dates, deployment age, BIOS release year
    let hwScore = 100;
    const now = Date.now();
    if (asset.eolDate && new Date(asset.eolDate).getTime() < now) {
      hwScore = 0; // Past declared hardware end-of-life
    } else if (asset.warrantyExpiry && new Date(asset.warrantyExpiry).getTime() < now) {
      hwScore = 40; // Out of warranty — no vendor support/parts
    } else {
      const ageBasis = asset.deploymentDate || asset.procurementDate;
      if (ageBasis) {
        const ageYears = (now - new Date(ageBasis).getTime()) / (365.25 * 86400000);
        if (ageYears >= 7) hwScore = 30;
        else if (ageYears >= 5) hwScore = 50;
        else if (ageYears >= 4) hwScore = 75;
      }
      // BIOS release year as a corroborating signal when lifecycle dates are absent
      const biosYearMatch = asset.hardwareDetails?.biosVersion?.match(/\b(20[0-2][0-9])\b/);
      if (biosYearMatch) {
        const biosAge = new Date().getFullYear() - parseInt(biosYearMatch[1], 10);
        if (biosAge >= 8) hwScore = Math.min(hwScore, 40);
        else if (biosAge >= 5) hwScore = Math.min(hwScore, 70);
      }
    }
    components.hardware = hwScore;
    score += (100 - hwScore) * 0.05;

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
    // Score the most recently active assets first (bounded batch to protect the DB;
    // scores are recomputed on every call so results always reflect live data)
    const assets = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 200,
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
