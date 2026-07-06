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

  async getDetectedFindings(tenantId: string) {
    const scanResults = await this.prisma.scanResult.findMany({
      where: { tenantId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 20,
    });

    const agentThreats = await this.prisma.endpointChange.findMany({
      where: {
        tenantId,
        category: { in: ['PROCESS_BLOCKED', 'UNAUTHORIZED_ACCESS', 'USB_DEVICE'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const findings: any[] = [];

    // Parse scan results to extract vulnerabilities
    for (const scan of scanResults) {
      const summary = (scan.summary || {}) as Record<string, any>;
      const results = (scan.results || {}) as any;

      if (scan.scanType === 'SSL') {
        // Expired certificate
        if (summary.expired) {
          findings.push({
            id: `ssl-expired-${scan.id}`,
            title: 'Expired SSL/TLS Certificate',
            severity: 'CRITICAL',
            category: 'SSL_RISK',
            target: scan.target,
            detectedAt: scan.completedAt || scan.startedAt,
            status: 'ACTIVE',
            cvss: 9.0,
            evidence: `Certificate is expired. Days remaining: ${summary.daysRemaining || 0}`,
            remediation: 'Renew the SSL/TLS certificate immediately through your certificate authority (CA) and apply it to the endpoint.',
          });
        } else if (summary.daysRemaining !== undefined && summary.daysRemaining < 30) {
          findings.push({
            id: `ssl-expiring-${scan.id}`,
            title: 'SSL/TLS Certificate Expiring Soon',
            severity: 'HIGH',
            category: 'SSL_RISK',
            target: scan.target,
            detectedAt: scan.completedAt || scan.startedAt,
            status: 'ACTIVE',
            cvss: 6.5,
            evidence: `Certificate will expire in ${summary.daysRemaining} days.`,
            remediation: 'Initiate renewal process for the SSL/TLS certificate prior to the expiration date.',
          });
        }

        // Self-signed certificate
        if (summary.selfSigned) {
          findings.push({
            id: `ssl-selfsigned-${scan.id}`,
            title: 'Self-Signed SSL/TLS Certificate',
            severity: 'HIGH',
            category: 'SSL_RISK',
            target: scan.target,
            detectedAt: scan.completedAt || scan.startedAt,
            status: 'ACTIVE',
            cvss: 7.5,
            evidence: 'Certificate is self-signed and not trusted by public root certificate authorities.',
            remediation: 'Replace the self-signed certificate with a valid certificate signed by a publicly trusted CA.',
          });
        }

        // Grade capping
        if (summary.grade === 'F') {
          findings.push({
            id: `ssl-gradef-${scan.id}`,
            title: 'Severely Vulnerable SSL/TLS Configuration',
            severity: 'CRITICAL',
            category: 'SSL_RISK',
            target: scan.target,
            detectedAt: scan.completedAt || scan.startedAt,
            status: 'ACTIVE',
            cvss: 9.8,
            evidence: `Server received a grade of 'F' in security audit. Active vulnerabilities detected: BEAST, POODLE, or obsolete cipher suites.`,
            remediation: 'Upgrade server TLS configuration. Disable SSLv2, SSLv3, TLS 1.0, and TLS 1.1. Enforce TLS 1.2 or TLS 1.3 and secure cipher suites (ECDHE-ECDSA-AES128-GCM-SHA256, etc.).',
          });
        } else if (summary.grade === 'C' || summary.grade === 'D') {
          findings.push({
            id: `ssl-gradec-${scan.id}`,
            title: 'Suboptimal SSL/TLS Security Grade',
            severity: 'MEDIUM',
            category: 'SSL_RISK',
            target: scan.target,
            detectedAt: scan.completedAt || scan.startedAt,
            status: 'ACTIVE',
            cvss: 5.5,
            evidence: `Server TLS grade: ${summary.grade}. Legacy CBC ciphers or old protocols allowed.`,
            remediation: 'Disable legacy CBC ciphers and require forward secrecy (DHE/ECDHE). Disable TLS 1.0 and TLS 1.1 if possible.',
          });
        }
      }

      if (scan.scanType === 'NMAP' && results && Array.isArray(results.hosts)) {
        for (const host of results.hosts) {
          if (!host.ports || !Array.isArray(host.ports)) continue;
          for (const p of host.ports) {
            // Port 23: Telnet (obsolete, plain text)
            if (p.port === 23 && p.state === 'open') {
              findings.push({
                id: `port-23-${scan.id}-${host.ip}`,
                title: 'Obsolete Telnet Protocol Service Active',
                severity: 'CRITICAL',
                category: 'OPEN_PORT',
                target: `${host.ip}:23`,
                detectedAt: scan.completedAt || scan.startedAt,
                status: 'ACTIVE',
                cvss: 9.8,
                evidence: `Port 23 (tcp) is open. Banner grab: ${p.product || 'Telnetd'} ${p.version || ''}`,
                remediation: 'Disable the Telnet service immediately. Enforce SSH (port 22) for all command line communications and remote administrative access.',
              });
            }

            // Port 21: FTP (plain text credentials)
            if (p.port === 21 && p.state === 'open') {
              findings.push({
                id: `port-21-${scan.id}-${host.ip}`,
                title: 'Insecure FTP Protocol Service Active',
                severity: 'HIGH',
                category: 'OPEN_PORT',
                target: `${host.ip}:21`,
                detectedAt: scan.completedAt || scan.startedAt,
                status: 'ACTIVE',
                cvss: 7.5,
                evidence: `Port 21 (tcp) is open. Service: ${p.product || 'ftpd'} ${p.version || ''}`,
                remediation: 'Migrate from FTP to SFTP (SSH File Transfer Protocol) or FTPS (FTP over SSL/TLS). Disable legacy unencrypted FTP.',
              });
            }

            // Port 3389: RDP open to world / public (common ransomware entry point)
            if (p.port === 3389 && p.state === 'open') {
              findings.push({
                id: `port-3389-${scan.id}-${host.ip}`,
                title: 'Exposed Windows Remote Desktop (RDP)',
                severity: 'HIGH',
                category: 'OPEN_PORT',
                target: `${host.ip}:3389`,
                detectedAt: scan.completedAt || scan.startedAt,
                status: 'ACTIVE',
                cvss: 8.5,
                evidence: `Port 3389 (RDP) is publicly accessible on this host. Service: ${p.product || 'terminal-services'}`,
                remediation: 'Do not expose RDP (3389) directly to the internet. Restrict RDP access behind a VPN or enforce Multi-Factor Authentication (MFA) via RD Gateway, and restrict access to authorized source IPs.',
              });
            }

            // Obsolete software version detections
            if (p.product?.toLowerCase().includes('openssh') && p.version) {
              const versionNum = parseFloat(p.version);
              if (!isNaN(versionNum) && versionNum < 8.0) {
                findings.push({
                  id: `openssh-vuln-${scan.id}-${host.ip}`,
                  title: 'Outdated & Vulnerable OpenSSH Server',
                  severity: 'HIGH',
                  category: 'OS_SERVICES',
                  target: `${host.ip}:${p.port}`,
                  detectedAt: scan.completedAt || scan.startedAt,
                  status: 'ACTIVE',
                  cvss: 8.1,
                  evidence: `Detected OpenSSH ${p.version}. Versions older than 8.0 contain multiple known CVEs including potential privilege escalation and remote code execution vulnerabilities (e.g. CVE-2020-15778).`,
                  remediation: 'Upgrade the OpenSSH server on the target system to the latest stable release (8.4p1+ or 9.x) via your package manager.',
                });
              }
            }
          }
        }
      }
    }

    // Parse agent threats (EndpointChange records)
    for (const threat of agentThreats) {
      const val = (threat.newValue || {}) as Record<string, any>;
      const statusLabel = threat.status === 'VIOLATION' || threat.status === 'PENDING_REVIEW' ? 'ACTIVE' : 'RESOLVED';

      if (threat.category === 'PROCESS_BLOCKED') {
        findings.push({
          id: `agent-proc-${threat.id}`,
          title: `Malicious Process Blocked: ${val.name || 'Unknown'}`,
          severity: 'CRITICAL',
          category: 'MALWARE',
          target: threat.hostname || threat.ipAddress || 'Agent System',
          detectedAt: threat.createdAt,
          status: statusLabel,
          cvss: 9.6,
          evidence: `Process '${val.name}' (PID: ${val.pid || 'N/A'}) was initiated by user '${val.user || 'system'}' and terminated by compliance policy signature matching. Command: ${val.command || 'N/A'}`,
          remediation: 'Investigate the endpoint for persistent malware, cron jobs, or scheduled tasks. Run a full antivirus sweep and inspect user authorization credentials.',
        });
      } else if (threat.category === 'UNAUTHORIZED_ACCESS') {
        findings.push({
          id: `agent-access-${threat.id}`,
          title: 'Brute-Force SSH/RDP Attack Blocked',
          severity: 'CRITICAL',
          category: 'COMPLIANCE',
          target: threat.hostname || threat.ipAddress || 'Agent System',
          detectedAt: threat.createdAt,
          status: statusLabel,
          cvss: 9.8,
          evidence: `Agent detected multiple failed authentication attempts (${val.failedLoginsCount || 10}+ logins) for username '${val.username || 'admin'}' on port ${val.port || 22}. Host source blocked.`,
          remediation: 'Enforce strong passphrase policies, change root/admin credentials, disable password-based login in favor of SSH public keys, and implement fail2ban.',
        });
      } else if (threat.category === 'USB_DEVICE') {
        findings.push({
          id: `agent-usb-${threat.id}`,
          title: 'Unauthorized USB Device Mount',
          severity: 'MEDIUM',
          category: 'COMPLIANCE',
          target: threat.hostname || 'Agent System',
          detectedAt: threat.createdAt,
          status: statusLabel,
          cvss: 5.0,
          evidence: `Unapproved USB Storage Device connected: ${val.vendor || 'Unknown'} - ${val.model || 'Removable Disk'}`,
          remediation: 'Review endpoint compliance registry policy for USB storage blocks. Educate staff on the risks of unauthorized external media.',
        });
      }
    }

    // No seeded/fallback findings — return only real scan data

    // Apply muted/resolved overrides from tenant settings
    const overrides = await this.loadFindingOverrides(tenantId);
    for (const f of findings) {
      const override = overrides[f.id];
      if (override) f.status = override;
    }

    return findings;
  }

  async updateFinding(id: string, tenantId: string, status: string) {
    const overrides = await this.loadFindingOverrides(tenantId);
    overrides[id] = status;
    await this.saveFindingOverrides(tenantId, overrides);
    return { id, status };
  }

  // ─── Finding Override Persistence Helpers ──────────────────────

  private async loadFindingOverrides(tenantId: string): Promise<Record<string, string>> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as any) || {};
    return settings.scanFindingOverrides || {};
  }

  private async saveFindingOverrides(tenantId: string, overrides: Record<string, string>) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const settings = (tenant?.settings as any) || {};
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: { ...settings, scanFindingOverrides: overrides } },
    });
  }

  // ─── Delete Scan Result ───────────────────────────────────────
  async deleteScanResult(id: string, tenantId: string) {
    const result = await this.prisma.scanResult.findFirst({
      where: { id, tenantId },
    });
    if (!result) {
      return { deleted: false, message: 'Scan result not found' };
    }
    await this.prisma.scanResult.delete({ where: { id } });
    this.logger.log(`Deleted scan result ${id} for tenant ${tenantId}`);
    return { deleted: true, id };
  }
}
