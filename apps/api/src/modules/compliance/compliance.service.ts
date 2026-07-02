import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { SshScanner } from '../../common/scanners/ssh.scanner';
import * as crypto from 'crypto';

const VAULT_KEY = (() => {
  const key = process.env.VAULT_ENCRYPTION_KEY;
  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL: VAULT_ENCRYPTION_KEY must be set in production. Refusing to start with a default key.');
  }
  return key || 'assetcommand-default-vault-key-32!'; // fallback for development only
})();
const ALGORITHM = 'aes-256-cbc';

interface ChangeDetection {
  category: string;
  changeType: string;
  severity?: string;
  summary: string;
  previousValue: any;
  newValue: any;
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  // DIFF ENGINE — Compares two system snapshots
  // ═══════════════════════════════════════════════════════════════

  diffSnapshots(prev: any, curr: any, policies?: any[]): ChangeDetection[] {
    const changes: ChangeDetection[] = [];
    if (!prev || !curr) return changes;

    // 1. RAM Change
    const prevRam = prev?.hardware?.totalRamMb || 0;
    const currRam = curr?.hardware?.totalRamMb || 0;
    if (prevRam > 0 && currRam > 0 && Math.abs(prevRam - currRam) > 100) {
      changes.push({
        category: 'RAM_CHANGE',
        changeType: 'MODIFIED',
        summary: `RAM changed from ${Math.round(prevRam / 1024)}GB to ${Math.round(currRam / 1024)}GB`,
        previousValue: { totalRamMb: prevRam },
        newValue: { totalRamMb: currRam },
      });
    }

    // 2. Disk Changes
    const prevDisks = prev?.hardware?.diskDrives || [];
    const currDisks = curr?.hardware?.diskDrives || [];
    if (prevDisks.length > 0 && currDisks.length !== prevDisks.length) {
      changes.push({
        category: 'DISK_CHANGE',
        changeType: currDisks.length > prevDisks.length ? 'ADDED' : 'REMOVED',
        summary: `Disk count changed from ${prevDisks.length} to ${currDisks.length}`,
        previousValue: prevDisks,
        newValue: currDisks,
      });
    }

    // 3. Network Adapter Changes
    const prevNets = (prev?.network?.interfaces || []).map((n: any) => n.mac).filter(Boolean).sort();
    const currNets = (curr?.network?.interfaces || []).map((n: any) => n.mac).filter(Boolean).sort();
    const addedNets = currNets.filter((m: string) => !prevNets.includes(m));
    const removedNets = prevNets.filter((m: string) => !currNets.includes(m));
    for (const mac of addedNets) {
      const iface = (curr?.network?.interfaces || []).find((n: any) => n.mac === mac);
      changes.push({
        category: 'NETWORK_CHANGE',
        changeType: 'ADDED',
        summary: `New network adapter detected: ${iface?.name || mac} (${iface?.ip || 'no IP'})`,
        previousValue: null,
        newValue: iface,
      });
    }
    for (const mac of removedNets) {
      const iface = (prev?.network?.interfaces || []).find((n: any) => n.mac === mac);
      changes.push({
        category: 'NETWORK_CHANGE',
        changeType: 'REMOVED',
        summary: `Network adapter removed: ${iface?.name || mac}`,
        previousValue: iface,
        newValue: null,
      });
    }

    // 4. Software Changes
    const prevSw = (prev?.software || []).map((s: any) => s.name?.toLowerCase()).filter(Boolean);
    const currSw = (curr?.software || []).map((s: any) => s.name?.toLowerCase()).filter(Boolean);
    const installed = currSw.filter((s: string) => !prevSw.includes(s));
    const removed = prevSw.filter((s: string) => !currSw.includes(s));
    for (const name of installed) {
      const sw = (curr?.software || []).find((s: any) => s.name?.toLowerCase() === name);
      changes.push({
        category: 'SOFTWARE_INSTALL',
        changeType: 'ADDED',
        summary: `Software installed: ${sw?.name || name}${sw?.version ? ` v${sw.version}` : ''}`,
        previousValue: null,
        newValue: sw,
      });
    }
    for (const name of removed) {
      const sw = (prev?.software || []).find((s: any) => s.name?.toLowerCase() === name);
      changes.push({
        category: 'SOFTWARE_REMOVE',
        changeType: 'REMOVED',
        summary: `Software removed: ${sw?.name || name}`,
        previousValue: sw,
        newValue: null,
      });
    }

    // 5. USB Device Changes
    const prevUsb = (prev?.usbDevices || []).map((u: any) => u.serial || u.name).filter(Boolean);
    const currUsb = (curr?.usbDevices || []).map((u: any) => u.serial || u.name).filter(Boolean);
    const addedUsb = currUsb.filter((u: string) => !prevUsb.includes(u));
    for (const id of addedUsb) {
      const device = (curr?.usbDevices || []).find((u: any) => (u.serial || u.name) === id);
      changes.push({
        category: 'USB_DEVICE',
        changeType: 'ADDED',
        summary: `USB device connected: ${device?.name || id}`,
        previousValue: null,
        newValue: device,
      });
    }

    // 6. CPU Change (unusual but detectable in VMs)
    const prevCpu = prev?.hardware?.cpuCores || 0;
    const currCpu = curr?.hardware?.cpuCores || 0;
    if (prevCpu > 0 && currCpu > 0 && prevCpu !== currCpu) {
      changes.push({
        category: 'HARDWARE_CHANGE',
        changeType: 'MODIFIED',
        summary: `CPU cores changed from ${prevCpu} to ${currCpu}`,
        previousValue: { cpuCores: prevCpu, cpuModel: prev?.hardware?.cpuModel },
        newValue: { cpuCores: currCpu, cpuModel: curr?.hardware?.cpuModel },
      });
    }

    // 7. Firewall/Encryption changes
    if (prev?.security && curr?.security) {
      if (prev.security.firewallEnabled === true && curr.security.firewallEnabled === false) {
        changes.push({
          category: 'HARDWARE_CHANGE',
          changeType: 'MODIFIED',
          summary: 'Firewall was DISABLED',
          previousValue: { firewallEnabled: true },
          newValue: { firewallEnabled: false },
        });
      }
      if (prev.security.encryptionEnabled === true && curr.security.encryptionEnabled === false) {
        changes.push({
          category: 'HARDWARE_CHANGE',
          changeType: 'MODIFIED',
          summary: 'Disk encryption was DISABLED',
          previousValue: { encryptionEnabled: true },
          newValue: { encryptionEnabled: false },
        });
      }
    }

    // 8. OS User accounts (UNAUTHORIZED_ACCESS)
    const prevUsers = prev?.security?.users || [];
    const currUsers = curr?.security?.users || [];
    const addedUsers = currUsers.filter((u: string) => !prevUsers.includes(u));
    for (const u of addedUsers) {
      changes.push({
        category: 'UNAUTHORIZED_ACCESS',
        changeType: 'ADDED',
        summary: `New OS user account created: "${u}"`,
        previousValue: null,
        newValue: { username: u },
      });
    }

    // 9. Active shell sessions (UNAUTHORIZED_ACCESS)
    const prevShells = prev?.security?.activeShellUsers || [];
    const currShells = curr?.security?.activeShellUsers || [];
    const addedShells = currShells.filter((u: string) => !prevShells.includes(u));
    for (const u of addedShells) {
      changes.push({
        category: 'UNAUTHORIZED_ACCESS',
        changeType: 'ADDED',
        summary: `Unauthorized active terminal shell login: "${u}"`,
        previousValue: null,
        newValue: { username: u },
      });
    }

    // 10. Failed login attempts (UNAUTHORIZED_ACCESS)
    const prevFailed = prev?.security?.failedLoginsCount || 0;
    const currFailed = curr?.security?.failedLoginsCount || 0;
    if (currFailed > prevFailed && currFailed >= 3) {
      changes.push({
        category: 'UNAUTHORIZED_ACCESS',
        changeType: 'MODIFIED',
        summary: `Suspicious elevated failed login attempts: ${currFailed} attempts`,
        previousValue: { failedLoginsCount: prevFailed },
        newValue: { failedLoginsCount: currFailed },
      });
    }

    // 11. New Listening Ports (UNAUTHORIZED_ACCESS)
    const prevPorts = (prev?.security?.openPorts || []).map((p: any) => p.port);
    const currPorts = curr?.security?.openPorts || [];
    const IGNORED_PORT_PROCESSES = [
      'antigravity',
      'antigravi',
      'vscode',
      'node',
      'npm',
      'yarn',
      'pnpm',
      'language_',
      'tsserver',
      'typescript',
      'next',
      'vite',
      'webpack',
      'docker',
      'postgres',
      'mysql',
      'redis',
      'mongod',
      'python',
      'ruby',
      'java',
      'go',
      'rust',
      'dotnet',
    ];
    for (const p of currPorts) {
      if (!prevPorts.includes(p.port)) {
        // Safe process whitelist check to prevent blocking development tools
        const procName = (p.process || '').toLowerCase();
        if (IGNORED_PORT_PROCESSES.some(ip => procName.includes(ip))) {
          continue;
        }

        changes.push({
          category: 'UNAUTHORIZED_ACCESS',
          changeType: 'ADDED',
          summary: `New open listening port detected: ${p.port} (${p.process || 'Unknown process'})`,
          previousValue: null,
          newValue: p,
        });
      }
    }

    // 12. Active Process Block / Blacklist Threat Control (PROCESS_BLOCKED)
    const currProcs = curr?.processes || [];
    const processPolicies = (policies || []).filter(p => p.category === 'PROCESS_BLOCKED' && p.isActive);
    
    // Seed standard dangerous processes keywords
    const blockedKeywords = ['miner', 'torrent', 'wireshark', 'nmap', 'nc', 'netcat', 'john the ripper', 'hashcat', 'hydra', 'metasploit'];
    
    for (const p of processPolicies) {
      const pattern = p.matchPattern as any;
      if (pattern?.blockedProcesses && Array.isArray(pattern.blockedProcesses)) {
        blockedKeywords.push(...pattern.blockedProcesses);
      }
      if (pattern?.blockedKeywords && Array.isArray(pattern.blockedKeywords)) {
        blockedKeywords.push(...pattern.blockedKeywords);
      }
    }

    // Filter out empty, whitespace, or non-string keywords to prevent broad matching
    const uniqueBlockedKeywords = Array.from(
      new Set(
        blockedKeywords
          .filter(k => typeof k === 'string' && k.trim().length > 0)
          .map(k => k.toLowerCase())
      )
    );

    // Whitelist of critical system and user development tools that should NEVER be blocked
    const SYSTEM_PROTECTED_PROCESSES = [
      'antigravity',
      'antigravi',
      'vscode',
      'node',
      'npm',
      'yarn',
      'pnpm',
      'language_',
      'tsserver',
      'typescript',
      'chrome',
      'safari',
      'firefox',
      'terminal',
      'bash',
      'zsh',
      'sh',
      'cmd',
      'powershell',
      'explorer.exe',
      'systemidle',
      'taskmgr',
      'svchost',
      'launchd',
    ];

    for (const proc of currProcs) {
      const procName = (proc.name || '').toLowerCase();
      const procCmd = (proc.command || '').toLowerCase();

      // Skip evaluation for protected system processes and developer tools
      const isProtected = SYSTEM_PROTECTED_PROCESSES.some(sp => 
        procName.includes(sp) || procCmd.includes(sp)
      );
      if (isProtected) {
        continue;
      }

      const matchedKeyword = uniqueBlockedKeywords.find(k => {
        // For short keywords (like 'nc' or other length <= 2), use exact word boundary regex
        if (k.length <= 2) {
          const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\b${escaped}\\b`, 'i');
          return regex.test(procName) || regex.test(procCmd);
        }
        return procName.includes(k) || procCmd.includes(k);
      });

      if (matchedKeyword) {
        changes.push({
          category: 'PROCESS_BLOCKED',
          changeType: 'ADDED',
          summary: `Suspicious process execution detected: ${proc.name || proc.command || 'Unknown'} (PID: ${proc.pid || 'N/A'})`,
          previousValue: null,
          newValue: {
            name: proc.name || proc.command || 'Unknown',
            pid: proc.pid ? String(proc.pid) : undefined,
            command: proc.command || '',
            user: proc.user || '',
            matchedKeyword,
          },
        });
      }
    }

    // Startup program changes — detect persistence
    const prevStartup = prev?.startupPrograms || [];
    const currStartup = curr?.startupPrograms || [];
    const newStartup = currStartup.filter((s: any) => !prevStartup.some((p: any) => p.name === s.name && p.path === s.path));
    if (newStartup.length > 0) {
      changes.push({ category: 'PERSISTENCE_CHANGE', changeType: 'STARTUP_ITEM_ADDED', severity: 'WARNING',
        summary: `${newStartup.length} new startup program(s) detected: ${newStartup.map((s: any) => s.name).join(', ')}`,
        previousValue: JSON.stringify(prevStartup.map((s: any) => s.name)), newValue: JSON.stringify(newStartup) });
    }
    const removedStartup = prevStartup.filter((s: any) => !currStartup.some((c: any) => c.name === s.name && c.path === s.path));
    if (removedStartup.length > 0) {
      changes.push({ category: 'PERSISTENCE_CHANGE', changeType: 'STARTUP_ITEM_REMOVED', severity: 'INFO',
        summary: `${removedStartup.length} startup program(s) removed: ${removedStartup.map((s: any) => s.name).join(', ')}`,
        previousValue: JSON.stringify(removedStartup.map((s: any) => s.name)), newValue: JSON.stringify(currStartup.map((s: any) => s.name)) });
    }

    // Screen lock / password policy degradation
    const prevPolicy = prev?.screenLockPolicy || {} as any;
    const currPolicy = curr?.screenLockPolicy || {} as any;
    if (prevPolicy.screenLockEnabled && !currPolicy.screenLockEnabled) {
      changes.push({ category: 'POLICY_VIOLATION', changeType: 'SCREEN_LOCK_DISABLED', severity: 'CRITICAL',
        summary: 'Screen lock has been DISABLED on this endpoint',
        previousValue: JSON.stringify(prevPolicy), newValue: JSON.stringify(currPolicy) });
    }
    if (currPolicy.idleTimeSeconds && prevPolicy.idleTimeSeconds && currPolicy.idleTimeSeconds > prevPolicy.idleTimeSeconds * 2) {
      changes.push({ category: 'POLICY_VIOLATION', changeType: 'SCREEN_LOCK_TIMEOUT_INCREASED', severity: 'WARNING',
        summary: `Screen lock idle timeout increased from ${prevPolicy.idleTimeSeconds}s to ${currPolicy.idleTimeSeconds}s`,
        previousValue: String(prevPolicy.idleTimeSeconds), newValue: String(currPolicy.idleTimeSeconds) });
    }

    // Browser extension changes
    const prevExts = prev?.browserExtensions || [];
    const currExts = curr?.browserExtensions || [];
    const newExts = currExts.filter((e: any) => !prevExts.some((p: any) => p.id === e.id && p.browser === e.browser));
    if (newExts.length > 0) {
      changes.push({ category: 'SOFTWARE_CHANGE', changeType: 'BROWSER_EXTENSION_INSTALLED', severity: 'WARNING',
        summary: `${newExts.length} new browser extension(s) installed: ${newExts.map((e: any) => `${e.name} (${e.browser})`).join(', ')}`,
        previousValue: JSON.stringify(prevExts.map((e: any) => e.name)), newValue: JSON.stringify(newExts) });
    }

    // USB volume mount changes
    const prevMounts = prev?.externalMounts || [];
    const currMounts = curr?.externalMounts || [];
    const newMounts = currMounts.filter((m: any) => !prevMounts.some((p: any) => p.mountPoint === m.mountPoint && p.device === m.device));
    if (newMounts.length > 0) {
      changes.push({ category: 'USB_MOUNT', changeType: 'EXTERNAL_VOLUME_MOUNTED', severity: 'WARNING',
        summary: `${newMounts.length} external volume(s) mounted: ${newMounts.map((m: any) => m.mountPoint || m.device).join(', ')}`,
        previousValue: JSON.stringify(prevMounts.map((m: any) => m.mountPoint)), newValue: JSON.stringify(newMounts) });
    }

    // Certificate store changes — detect rogue CA injection
    const prevCerts = prev?.certificateStore || {} as any;
    const currCerts = curr?.certificateStore || {} as any;
    if (prevCerts.trustedRootCount && currCerts.trustedRootCount && currCerts.trustedRootCount > prevCerts.trustedRootCount) {
      changes.push({ category: 'CERTIFICATE_CHANGE', changeType: 'ROOT_CERT_ADDED', severity: 'CRITICAL',
        summary: `Trusted root certificate count increased from ${prevCerts.trustedRootCount} to ${currCerts.trustedRootCount} — possible rogue CA injection`,
        previousValue: String(prevCerts.trustedRootCount), newValue: String(currCerts.trustedRootCount) });
    }
    if (prevCerts.trustedRootCount && currCerts.trustedRootCount && currCerts.trustedRootCount < prevCerts.trustedRootCount) {
      changes.push({ category: 'CERTIFICATE_CHANGE', changeType: 'ROOT_CERT_REMOVED', severity: 'WARNING',
        summary: `Trusted root certificate count decreased from ${prevCerts.trustedRootCount} to ${currCerts.trustedRootCount}`,
        previousValue: String(prevCerts.trustedRootCount), newValue: String(currCerts.trustedRootCount) });
    }

    return changes;
  }

  // ═══════════════════════════════════════════════════════════════
  // POLICY EVALUATION
  // ═══════════════════════════════════════════════════════════════

  async evaluateAndRecord(
    tenantId: string,
    agentId: string,
    hostname: string,
    ipAddress: string,
    platform: string,
    changes: ChangeDetection[],
  ) {
    if (changes.length === 0) return [];

    const policies = await this.prisma.endpointPolicy.findMany({
      where: { tenantId, isActive: true },
    });

    const results = [];

    for (const change of changes) {
      // ─── Duplicate & Manual Approval Gates Check ────────────────
      if (change.category === 'PROCESS_BLOCKED') {
        const processName = change.newValue?.name;
        const existingChanges = await this.prisma.endpointChange.findMany({
          where: { agentId, category: 'PROCESS_BLOCKED' },
        });
        const matched = existingChanges.find(c => (c.newValue as any)?.name === processName);
        if (matched) {
          if (matched.status === 'APPROVED') {
            continue; // Already approved by admin! Allow process execution.
          }
          results.push(matched); // Skip recreating log row, keep active change
          continue;
        }
      }

      if (change.category === 'UNAUTHORIZED_ACCESS') {
        const username = change.newValue?.username;
        const port = change.newValue?.port;
        const existingChanges = await this.prisma.endpointChange.findMany({
          where: { agentId, category: 'UNAUTHORIZED_ACCESS' },
        });

        if (username) {
          const matched = existingChanges.find(c => (c.newValue as any)?.username === username);
          if (matched) {
            if (matched.status === 'APPROVED') continue;
            results.push(matched);
            continue;
          }
        } else if (port) {
          const matched = existingChanges.find(c => (c.newValue as any)?.port === port);
          if (matched) {
            if (matched.status === 'APPROVED') continue;
            results.push(matched);
            continue;
          }
        }
      }

      if (change.category === 'USB_DEVICE') {
        const usbName = change.newValue?.name;
        const usbSerial = change.newValue?.serial;
        const existingChanges = await this.prisma.endpointChange.findMany({
          where: { agentId, category: 'USB_DEVICE' },
        });
        const matched = existingChanges.find(c => {
          const u = c.newValue as any;
          return u && ((usbSerial && u.serial === usbSerial) || (u.name === usbName));
        });
        if (matched) {
          if (matched.status === 'APPROVED') {
            continue; // Already approved by admin! Allow connection.
          }
          results.push(matched); // Keep active review gate
          continue;
        }
      }

      if (change.category === 'DISK_CHANGE') {
        const existingChanges = await this.prisma.endpointChange.findMany({
          where: { agentId, category: 'DISK_CHANGE' },
        });
        const matched = existingChanges.find(c => c.status === 'APPROVED');
        if (matched) {
          continue; // Already approved by admin! Allow volume.
        }
      }

      // Find matching policy
      const matchedPolicy = policies.find(p => {
        if (p.category !== change.category) return false;
        // Check scope
        const scope = p.scope as any;
        if (scope?.platforms?.length && !scope.platforms.includes(platform)) return false;
        if (scope?.hostnames?.length) {
          const matches = scope.hostnames.some((pattern: string) => {
            if (pattern.endsWith('*')) return hostname.startsWith(pattern.slice(0, -1));
            return hostname === pattern;
          });
          if (!matches) return false;
        }
        return true;
      });

      const severity = matchedPolicy?.severity || 'INFO';
      const action = matchedPolicy?.action || 'ALERT_ONLY';
      let status = 'AUTO_ALLOWED';

      if (matchedPolicy) {
        if (action === 'REQUIRE_APPROVAL') status = 'PENDING_REVIEW';
        else if (action === 'AUTO_BLOCK') status = 'VIOLATION';
        else status = 'AUTO_ALLOWED';
      }

      const record = await this.prisma.endpointChange.create({
        data: {
          tenantId,
          agentId,
          policyId: matchedPolicy?.id || null,
          category: change.category,
          changeType: change.changeType,
          severity,
          summary: change.summary,
          previousValue: change.previousValue || undefined,
          newValue: change.newValue || undefined,
          status,
          hostname,
          ipAddress,
          platform,
        },
      });

      results.push(record);

      // Create notification for admins on warnings/criticals
      if (severity !== 'INFO') {
        const admins = await this.prisma.user.findMany({
          where: {
            tenantId,
            role: { name: { in: ['Tenant Admin', 'IT Admin'] } },
            status: 'ACTIVE',
          },
          select: { id: true },
        });

        const notifType = severity === 'CRITICAL' ? 'ALERT' : 'WARNING';
        for (const admin of admins) {
          await this.prisma.notification.create({
            data: {
              tenantId,
              userId: admin.id,
              title: `${severity}: ${change.summary}`,
              message: `Agent "${hostname}" (${ipAddress}) — ${change.summary}. Status: ${status === 'PENDING_REVIEW' ? 'Needs approval' : status}.`,
              type: notifType,
              module: 'compliance',
              resourceId: record.id,
            },
          });
        }

        this.eventBus.emitDomainEvent({
          type: 'compliance.change_detected',
          tenantId,
          payload: { changeId: record.id, category: change.category, severity, hostname, summary: change.summary },
          timestamp: new Date(),
        });
      }

      this.logger.log(`[${severity}] ${hostname}: ${change.summary} → ${status}`);
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // HEARTBEAT INTEGRATION — Called from discovery service
  // ═══════════════════════════════════════════════════════════════

  async processHeartbeat(tenantId: string, agentId: string, agent: any, newSnapshot: any) {
    // Get or create baseline
    const baseline = await this.prisma.agentBaseline.findUnique({
      where: { agentId },
    });

    if (!baseline) {
      // First heartbeat — create baseline, no diff
      await this.prisma.agentBaseline.create({
        data: { tenantId, agentId, snapshot: newSnapshot, snapshotAt: new Date() },
      });
      this.logger.log(`Baseline created for agent ${agent.hostname}`);
      return [];
    }

    // Load active policies for the tenant
    let policies = await this.prisma.endpointPolicy.findMany({
      where: { tenantId, isActive: true },
    });

    // Auto-seed default policies if the tenant has zero active policies
    if (policies.length === 0) {
      this.logger.log(`No active compliance policies found for tenant ${tenantId}. Auto-seeding default templates...`);
      await this.seedDefaultPolicies(tenantId);
      policies = await this.prisma.endpointPolicy.findMany({
        where: { tenantId, isActive: true },
      });
    }

    // --- Active Threat Auto-Resolution Loop ---
    try {
      const activeThreats = await this.prisma.endpointChange.findMany({
        where: {
          agentId,
          status: { in: ['PENDING_REVIEW', 'VIOLATION'] },
          category: { in: ['PROCESS_BLOCKED', 'UNAUTHORIZED_ACCESS'] },
        },
      });

      for (const threat of activeThreats) {
        const val = threat.newValue as any;
        if (!val) continue;

        if (threat.category === 'PROCESS_BLOCKED') {
          const stillRunning = (newSnapshot.processes || []).some((proc: any) => {
            if (val.pid && String(proc.pid) === String(val.pid)) return true;
            if (val.name && (proc.name === val.name || proc.command === val.name)) return true;
            if (val.command && (proc.command === val.command || proc.name === val.command)) return true;
            return false;
          });
          if (!stillRunning) {
            await this.prisma.endpointChange.update({
              where: { id: threat.id },
              data: { status: 'RESOLVED' },
            });
            this.logger.log(`Suspicious process threat auto-resolved (terminated): ${val.name} (PID: ${val.pid || 'N/A'})`);
          }
        } else if (threat.category === 'UNAUTHORIZED_ACCESS') {
          if (val.port !== undefined && val.port !== null) {
            const portStillOpen = (newSnapshot.security?.openPorts || []).some((p: any) => p.port === val.port);
            if (!portStillOpen) {
              await this.prisma.endpointChange.update({
                where: { id: threat.id },
                data: { status: 'RESOLVED' },
              });
              this.logger.log(`Unauthorized open port threat auto-resolved (blocked): Port ${val.port}`);
            }
          } else if (val.username) {
            const isShellSession = threat.summary?.includes('terminal') || threat.summary?.includes('shell') || threat.summary?.includes('login');
            if (isShellSession) {
              const shellStillActive = (newSnapshot.security?.activeShellUsers || []).includes(val.username);
              if (!shellStillActive) {
                await this.prisma.endpointChange.update({
                  where: { id: threat.id },
                  data: { status: 'RESOLVED' },
                });
                this.logger.log(`Unauthorized terminal shell threat auto-resolved (disconnected): User "${val.username}"`);
              }
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Threat auto-resolution failed for agent ${agentId}: ${err.message}`);
    }

    // Diff against baseline using active policies
    const changes = this.diffSnapshots(baseline.snapshot as any, newSnapshot, policies);

    // Evaluate against policies and record
    const results = await this.evaluateAndRecord(
      tenantId, agentId, agent.hostname, agent.ipAddress, agent.platform, changes,
    );

    // Update baseline
    await this.prisma.agentBaseline.update({
      where: { agentId },
      data: { snapshot: newSnapshot, snapshotAt: new Date() },
    });

    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // POLICY CRUD
  // ═══════════════════════════════════════════════════════════════

  async listPolicies(tenantId: string) {
    return this.prisma.endpointPolicy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { changes: true } } },
    });
  }

  async createPolicy(tenantId: string, userId: string, data: {
    name: string; description?: string; category: string; severity?: string;
    action?: string; matchPattern?: any; scope?: any;
  }) {
    return this.prisma.endpointPolicy.create({
      data: {
        tenantId,
        createdById: userId,
        name: data.name,
        description: data.description,
        category: data.category,
        severity: data.severity || 'WARNING',
        action: data.action || 'ALERT_ONLY',
        matchPattern: data.matchPattern || {},
        scope: data.scope || {},
      },
    });
  }

  async updatePolicy(id: string, tenantId: string, data: any) {
    const policy = await this.prisma.endpointPolicy.findFirst({ where: { id, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    return this.prisma.endpointPolicy.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.severity !== undefined && { severity: data.severity }),
        ...(data.action !== undefined && { action: data.action }),
        ...(data.matchPattern !== undefined && { matchPattern: data.matchPattern }),
        ...(data.scope !== undefined && { scope: data.scope }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async deletePolicy(id: string, tenantId: string) {
    const policy = await this.prisma.endpointPolicy.findFirst({ where: { id, tenantId } });
    if (!policy) throw new NotFoundException('Policy not found');
    return this.prisma.endpointPolicy.delete({ where: { id } });
  }

  // ═══════════════════════════════════════════════════════════════
  // CHANGES — List, Approve, Reject
  // ═══════════════════════════════════════════════════════════════

  async listChanges(tenantId: string, filters?: {
    status?: string; severity?: string; category?: string; agentId?: string;
    page?: number; limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.severity) where.severity = filters.severity;
    if (filters?.category) where.category = filters.category;
    if (filters?.agentId) where.agentId = filters.agentId;

    const [data, total] = await Promise.all([
      this.prisma.endpointChange.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { policy: { select: { name: true, action: true } } },
      }),
      this.prisma.endpointChange.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async approveChange(id: string, tenantId: string, userId: string, note?: string) {
    const change = await this.prisma.endpointChange.findFirst({ where: { id, tenantId } });
    if (!change) throw new NotFoundException('Change not found');
    return this.prisma.endpointChange.update({
      where: { id },
      data: { status: 'APPROVED', reviewedById: userId, reviewedAt: new Date(), reviewNote: note || null },
    });
  }

  async rejectChange(id: string, tenantId: string, userId: string, note?: string) {
    const change = await this.prisma.endpointChange.findFirst({ where: { id, tenantId } });
    if (!change) throw new NotFoundException('Change not found');
    return this.prisma.endpointChange.update({
      where: { id },
      data: { status: 'REJECTED', reviewedById: userId, reviewedAt: new Date(), reviewNote: note || null },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD STATS
  // ═══════════════════════════════════════════════════════════════

  async getDashboard(tenantId: string) {
    const [total, pending, approved, rejected, violations, bySeverity, byCategory, recentChanges] = await Promise.all([
      this.prisma.endpointChange.count({ where: { tenantId } }),
      this.prisma.endpointChange.count({ where: { tenantId, status: 'PENDING_REVIEW' } }),
      this.prisma.endpointChange.count({ where: { tenantId, status: 'APPROVED' } }),
      this.prisma.endpointChange.count({ where: { tenantId, status: 'REJECTED' } }),
      this.prisma.endpointChange.count({ where: { tenantId, status: 'VIOLATION' } }),
      this.prisma.endpointChange.groupBy({ by: ['severity'], where: { tenantId }, _count: true }),
      this.prisma.endpointChange.groupBy({ by: ['category'], where: { tenantId }, _count: true }),
      this.prisma.endpointChange.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { policy: { select: { name: true } } },
      }),
    ]);

    const activePolicies = await this.prisma.endpointPolicy.count({ where: { tenantId, isActive: true } });
    const agentCount = await this.prisma.agent.count({ where: { tenantId } });
    const compliantAgents = await this.prisma.agent.count({
      where: {
        tenantId,
        changes: { none: { status: { in: ['PENDING_REVIEW', 'VIOLATION'] } } },
      },
    });

    return {
      total, pending, approved, rejected, violations,
      activePolicies, agentCount, compliantAgents,
      complianceScore: agentCount > 0 ? Math.round((compliantAgents / agentCount) * 100) : 100,
      bySeverity: Object.fromEntries(bySeverity.map(s => [s.severity, s._count])),
      byCategory: Object.fromEntries(byCategory.map(c => [c.category, c._count])),
      recentChanges,
    };
  }

  async getAgentTimeline(agentId: string, tenantId: string) {
    return this.prisma.endpointChange.findMany({
      where: { agentId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { policy: { select: { name: true, action: true } } },
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // POLICY TEMPLATES
  // ═══════════════════════════════════════════════════════════════

  getTemplates() {
    return [
      {
        name: 'Unauthorized RAM Change',
        description: 'Alert when RAM is added or removed from a machine',
        category: 'RAM_CHANGE',
        severity: 'WARNING',
        action: 'REQUIRE_APPROVAL',
        matchPattern: {},
        scope: {},
      },
      {
        name: 'USB Mass Storage Device',
        description: 'Detect when a USB storage device is connected',
        category: 'USB_DEVICE',
        severity: 'WARNING',
        action: 'REQUIRE_APPROVAL',
        matchPattern: {},
        scope: {},
      },
      {
        name: 'Blocked Software Installation',
        description: 'Flag when restricted software is installed (e.g., P2P, gaming)',
        category: 'SOFTWARE_INSTALL',
        severity: 'CRITICAL',
        action: 'REQUIRE_APPROVAL',
        matchPattern: { blockedKeywords: ['torrent', 'bittorrent', 'steam', 'discord', 'telegram'] },
        scope: {},
      },
      {
        name: 'Network Adapter Change',
        description: 'Detect new network interfaces (WiFi adapters, USB NICs)',
        category: 'NETWORK_CHANGE',
        severity: 'INFO',
        action: 'ALERT_ONLY',
        matchPattern: {},
        scope: {},
      },
      {
        name: 'Disk Drive Change',
        description: 'Alert when storage drives are added or removed',
        category: 'DISK_CHANGE',
        severity: 'WARNING',
        action: 'REQUIRE_APPROVAL',
        matchPattern: {},
        scope: {},
      },
      {
        name: 'Security Degradation',
        description: 'Critical alert when firewall or encryption is disabled',
        category: 'HARDWARE_CHANGE',
        severity: 'CRITICAL',
        action: 'REQUIRE_APPROVAL',
        matchPattern: { securityDegradation: true },
        scope: {},
      },
      {
        name: 'Unauthorized OS Access',
        description: 'Detect and alert on new OS users, suspicious terminal shell logins, or failed brute force attempts',
        category: 'UNAUTHORIZED_ACCESS',
        severity: 'CRITICAL',
        action: 'REQUIRE_APPROVAL',
        matchPattern: {},
        scope: {},
      },
      {
        name: 'Suspicious Process Execution',
        description: 'Flag and forcefully terminate unauthorized software execution (P2P, gaming, miners, tools)',
        category: 'PROCESS_BLOCKED',
        severity: 'CRITICAL',
        action: 'REQUIRE_APPROVAL',
        matchPattern: {
          blockedProcesses: ['miner', 'torrent', 'wireshark', 'nmap', 'nc', 'netcat', 'john the ripper', 'hashcat', 'hydra', 'metasploit'],
        },
        scope: {},
      },
      // ─── CIS BENCHMARK TEMPLATES ────────────────────────────────
      {
        name: 'CIS: Disk Encryption Required',
        description: 'CIS 1.1.1 — Ensure BitLocker (Windows) or FileVault (macOS) is enabled on all endpoints',
        category: 'POLICY_VIOLATION',
        severity: 'CRITICAL',
        action: 'ENFORCE',
        matchPattern: { cisBenchmark: '1.1.1', checkField: 'diskEncryption.enabled', expectedValue: true },
        scope: {},
      },
      {
        name: 'CIS: Firewall Enabled',
        description: 'CIS 3.5.1 — Ensure host-based firewall is enabled (Windows Firewall / macOS ALF / Linux ufw)',
        category: 'POLICY_VIOLATION',
        severity: 'CRITICAL',
        action: 'ENFORCE',
        matchPattern: { cisBenchmark: '3.5.1', checkField: 'firewallStatus.enabled', expectedValue: true },
        scope: {},
      },
      {
        name: 'CIS: Auto-Updates Enabled',
        description: 'CIS 1.5.3 — Ensure automatic OS updates are enabled',
        category: 'POLICY_VIOLATION',
        severity: 'WARNING',
        action: 'ALERT_ONLY',
        matchPattern: { cisBenchmark: '1.5.3', checkField: 'pendingUpdates.autoUpdateEnabled', expectedValue: true },
        scope: {},
      },
      {
        name: 'CIS: Screen Lock Timeout ≤ 15 min',
        description: 'CIS 1.4.1 — Ensure screen lock activates within 15 minutes of inactivity',
        category: 'POLICY_VIOLATION',
        severity: 'WARNING',
        action: 'REQUIRE_APPROVAL',
        matchPattern: { cisBenchmark: '1.4.1', checkField: 'screenLockPolicy.idleTimeSeconds', maxValue: 900 },
        scope: {},
      },
      {
        name: 'CIS: No Guest Accounts',
        description: 'CIS 5.6.1 — Ensure guest account is disabled',
        category: 'UNAUTHORIZED_ACCESS',
        severity: 'WARNING',
        action: 'REQUIRE_APPROVAL',
        matchPattern: { cisBenchmark: '5.6.1', checkField: 'userAccounts', blockedUsers: ['guest', 'Guest'] },
        scope: {},
      },
      {
        name: 'CIS: Remote Desktop Disabled',
        description: 'CIS 2.2.2 — Ensure Remote Desktop (RDP) is disabled unless explicitly required',
        category: 'PORT_CHANGE',
        severity: 'WARNING',
        action: 'ALERT_ONLY',
        matchPattern: { cisBenchmark: '2.2.2', blockedPorts: [3389] },
        scope: {},
      },
      {
        name: 'CIS: SSH Root Login Disabled',
        description: 'CIS 5.2.8 — Ensure SSH root login is disabled',
        category: 'POLICY_VIOLATION',
        severity: 'CRITICAL',
        action: 'REQUIRE_APPROVAL',
        matchPattern: { cisBenchmark: '5.2.8', checkField: 'sshConfig.permitRootLogin', expectedValue: false },
        scope: {},
      },
      {
        name: 'CIS: Antivirus Active',
        description: 'CIS 1.1.2 — Ensure endpoint antivirus/antimalware is installed and running',
        category: 'POLICY_VIOLATION',
        severity: 'CRITICAL',
        action: 'ALERT_ONLY',
        matchPattern: { cisBenchmark: '1.1.2', checkField: 'antivirusStatus.active', expectedValue: true },
        scope: {},
      },
      {
        name: 'CIS: USB Storage Policy',
        description: 'CIS 1.7.1 — Control removable media (USB storage) access policy',
        category: 'USB_DEVICE',
        severity: 'WARNING',
        action: 'BLOCK_USB',
        matchPattern: { cisBenchmark: '1.7.1', blockAll: false, requireApproval: true },
        scope: {},
      },
      {
        name: 'CIS: Password Complexity',
        description: 'CIS 5.3.1 — Ensure password length minimum of 14 characters and complexity requirements',
        category: 'POLICY_VIOLATION',
        severity: 'WARNING',
        action: 'ALERT_ONLY',
        matchPattern: { cisBenchmark: '5.3.1', checkField: 'passwordPolicy.minLength', minValue: 14 },
        scope: {},
      },
      {
        name: 'CIS: Audit Logging Enabled',
        description: 'CIS 4.1.1 — Ensure audit logging is enabled on the endpoint',
        category: 'POLICY_VIOLATION',
        severity: 'WARNING',
        action: 'ALERT_ONLY',
        matchPattern: { cisBenchmark: '4.1.1', checkField: 'auditLogging.enabled', expectedValue: true },
        scope: {},
      },
      {
        name: 'CIS: No Unauthorized Listening Ports',
        description: 'CIS 2.1.1 — Ensure only approved services are listening on network ports',
        category: 'PORT_CHANGE',
        severity: 'WARNING',
        action: 'REQUIRE_APPROVAL',
        matchPattern: { cisBenchmark: '2.1.1', approvedPorts: [22, 53, 80, 443, 8080] },
        scope: {},
      },
    ];
  }

  async seedDefaultPolicies(tenantId: string) {
    const existing = await this.prisma.endpointPolicy.count({ where: { tenantId } });
    if (existing > 0) return { message: 'Policies already exist', count: existing };

    const templates = this.getTemplates();
    for (const t of templates) {
      await this.prisma.endpointPolicy.create({
        data: { tenantId, ...t, isSystem: true },
      });
    }
    return { message: `Created ${templates.length} default policies`, count: templates.length };
  }

  // ═══════════════════════════════════════════════════════════════
  // AGENTLESS COMPLIANCE SCAN — SSH into remote hosts
  // ═══════════════════════════════════════════════════════════════

  /**
   * Convert SshScanResult to the same snapshot format the agent uses,
   * so the diff engine works identically for both modes.
   */
  private normalizeSshToSnapshot(ssh: any): any {
    // Parse memory (e.g., "7.6Gi" → MB)
    const parseMemGb = (s: string) => {
      if (!s) return 0;
      const num = parseFloat(s);
      if (s.includes('Gi') || s.includes('G')) return Math.round(num * 1024);
      if (s.includes('Mi') || s.includes('M')) return Math.round(num);
      return Math.round(num);
    };

    return {
      collectedAt: new Date().toISOString(),
      agentVersion: 'agentless-ssh',
      hardware: {
        cpuModel: ssh.cpuInfo?.model || 'Unknown',
        cpuCores: ssh.cpuInfo?.cores || 0,
        totalRamMb: parseMemGb(ssh.memoryInfo?.total || '0'),
        freeRamMb: parseMemGb(ssh.memoryInfo?.free || '0'),
        usedRamMb: parseMemGb(ssh.memoryInfo?.used || '0'),
        ramUsagePercent: ssh.memoryInfo?.percent || 0,
        diskDrives: (ssh.diskUsage || []).map((d: any) => ({
          mount: d.mount, totalGb: d.size, usedGb: d.used, freeGb: d.available, usedPercent: d.percent,
        })),
        serialNumber: ssh.hardwareDetails?.serialNumber || 'Unknown',
        biosVendor: ssh.hardwareDetails?.biosVendor || 'Unknown',
        biosVersion: ssh.hardwareDetails?.biosVersion || 'Unknown',
        motherboard: ssh.hardwareDetails?.motherboard || 'Unknown',
        tpmEnabled: ssh.hardwareDetails?.tpmEnabled !== undefined ? ssh.hardwareDetails.tpmEnabled : false,
        tpmVersion: ssh.hardwareDetails?.tpmVersion || 'N/A',
      },
      operatingSystem: {
        platform: 'linux',
        type: ssh.osInfo?.distro || 'Linux',
        release: ssh.osInfo?.kernel || '',
        arch: ssh.osInfo?.arch || '',
        hostname: ssh.hostname || ssh.ip,
        uptime: 0,
      },
      network: {
        interfaces: [], // SSH doesn't easily enumerate MACs like the agent
        hostname: ssh.hostname || ssh.ip,
      },
      security: {
        firewallEnabled: ssh.firewallStatus ? ssh.firewallStatus.includes('active') || ssh.firewallStatus.includes('enabled') : false,
        users: ssh.users || [],
        activeShellUsers: ssh.activeShellUsers || [],
        failedLoginsCount: ssh.failedLoginsCount || 0,
        openPorts: ssh.openPorts || [],
      },
      software: (ssh.runningServices || []).map((s: any) => ({
        name: s.name, version: s.status || '',
      })),
      processes: ssh.processes || [],
      services: ssh.runningServices || [],
      usbDevices: [],
    };
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encrypted] = encryptedText.split(':');
    const key = crypto.scryptSync(VAULT_KEY, 'salt', 32);
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Run an agentless compliance scan on a target IP via SSH.
   * Creates a virtual agent record if one doesn't exist.
   */
  async agentlessScan(tenantId: string, data: {
    target: string;
    username: string;
    password?: string;
    privateKeyPath?: string;
    credentialId?: string;
  }) {
    const { target } = data;
    this.logger.log(`Starting agentless compliance scan: ${target}`);

    // Resolve credentials from vault if credentialId provided
    let creds = { username: data.username, password: data.password, privateKeyPath: data.privateKeyPath };
    if (data.credentialId) {
      const stored = await this.prisma.scanCredential.findFirst({
        where: { id: data.credentialId, tenantId },
      });
      if (stored) {
        const c = JSON.parse(this.decrypt(stored.encryptedData)) as any;
        creds = { username: c.username || data.username, password: c.password, privateKeyPath: c.privateKeyPath };
      }
    }

    // Run SSH scan
    const sshResult = await SshScanner.scan(target, creds, 45000);
    if (sshResult.error) {
      return { success: false, error: sshResult.error, target };
    }

    // Normalize to agent snapshot format
    const snapshot = this.normalizeSshToSnapshot(sshResult);
    const hostname = sshResult.hostname || target;

    // Find or create a virtual agent for this target
    let agent = await this.prisma.agent.findFirst({
      where: { tenantId, ipAddress: target },
    });

    if (!agent) {
      agent = await this.prisma.agent.create({
        data: {
          tenantId,
          hostname,
          platform: 'linux',
          agentVersion: 'agentless-ssh',
          ipAddress: target,
          status: 'ONLINE',
          lastHeartbeat: new Date(),
          systemInfo: snapshot,
        },
      });
      this.logger.log(`Created virtual agent for ${hostname} (${target})`);
    } else {
      await this.prisma.agent.update({
        where: { id: agent.id },
        data: { lastHeartbeat: new Date(), status: 'ONLINE', systemInfo: snapshot, hostname },
      });
    }

    // Run through the same compliance engine as agent heartbeats
    const results = await this.processHeartbeat(tenantId, agent.id, agent, snapshot);

    return {
      success: true,
      target,
      hostname,
      agentId: agent.id,
      mode: 'agentless',
      snapshot: {
        cpu: snapshot.hardware.cpuModel,
        cores: snapshot.hardware.cpuCores,
        ramMb: snapshot.hardware.totalRamMb,
        disks: snapshot.hardware.diskDrives?.length || 0,
        services: snapshot.services?.length || 0,
        firewall: snapshot.security.firewallEnabled,
      },
      changesDetected: results.length,
      changes: results.map((r: any) => ({ id: r.id, summary: r.summary, severity: r.severity, status: r.status })),
    };
  }

  /**
   * Batch agentless scan — scan multiple IPs with the same credentials
   */
  async agentlessBatchScan(tenantId: string, data: {
    targets: string[];
    username: string;
    password?: string;
    privateKeyPath?: string;
    credentialId?: string;
  }) {
    const results = [];
    for (const target of data.targets) {
      try {
        const result = await this.agentlessScan(tenantId, { ...data, target });
        results.push(result);
      } catch (err: any) {
        results.push({ success: false, target, error: err.message });
      }
    }
    return {
      total: data.targets.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    };
  }

  // ─── CIS BENCHMARK ASSESSMENT ───────────────────────────────
  async assessCisBenchmark(tenantId: string, agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) throw new NotFoundException('Agent not found');
    const raw = (agent.systemInfo as any) || {};
    // Normalize agent telemetry paths to expected CIS field names
    const info = {
      ...raw,
      diskEncryption: raw.diskEncryption || {
        enabled: raw.security?.encryptionEnabled || false,
        method: raw.security?.encryptionMethod || null,
      },
      firewallStatus: raw.firewallStatus || {
        enabled: raw.security?.firewallEnabled || false,
      },
      antivirusStatus: raw.antivirusStatus || {
        installed: raw.antivirus?.installed || false,
        active: raw.antivirus?.active || false,
        name: raw.antivirus?.name || raw.antivirus?.product || null,
      },
      userAccounts: raw.userAccounts || raw.security?.users || [],
      listeningPorts: raw.listeningPorts || raw.security?.openPorts || [],
      pendingUpdates: raw.pendingUpdates || {
        count: raw.softwareUpdates?.pendingCount || 0,
        autoUpdateEnabled: raw.softwareUpdates?.autoUpdateEnabled ?? null,
      },
    };
    const checks: any[] = [];

    // CIS 1.1.1 — Disk Encryption
    const diskEnc = info.diskEncryption || {};
    checks.push({
      id: 'CIS-1.1.1', name: 'Disk Encryption',
      status: diskEnc.enabled ? 'PASS' : 'FAIL',
      detail: diskEnc.enabled ? `Encrypted (${diskEnc.method || 'Unknown'})` : 'Disk encryption is NOT enabled',
      severity: 'CRITICAL',
    });

    // CIS 3.5.1 — Firewall Enabled
    const fw = info.firewallStatus || {};
    checks.push({
      id: 'CIS-3.5.1', name: 'Firewall Enabled',
      status: fw.enabled ? 'PASS' : 'FAIL',
      detail: fw.enabled ? 'Firewall is active' : 'Firewall is DISABLED',
      severity: 'CRITICAL',
    });

    // CIS 1.4.1 — Screen Lock Timeout
    const sl = info.screenLockPolicy || {};
    const slTimeout = sl.idleTimeSeconds || 0;
    checks.push({
      id: 'CIS-1.4.1', name: 'Screen Lock ≤ 15 min',
      status: sl.screenLockEnabled && slTimeout > 0 && slTimeout <= 900 ? 'PASS' : 'FAIL',
      detail: sl.screenLockEnabled ? `Timeout: ${slTimeout}s (${Math.round(slTimeout / 60)} min)` : 'Screen lock disabled',
      severity: 'WARNING',
    });

    // CIS 1.1.2 — Antivirus Active
    const av = info.antivirusStatus || {};
    checks.push({
      id: 'CIS-1.1.2', name: 'Antivirus Active',
      status: av.installed && av.active ? 'PASS' : av.installed ? 'WARNING' : 'FAIL',
      detail: av.installed ? (av.active ? `${av.name || 'AV'} is active` : `${av.name || 'AV'} installed but not active`) : 'No antivirus detected',
      severity: 'CRITICAL',
    });

    // CIS 5.6.1 — No Guest Accounts
    const users = info.userAccounts || [];
    const guestUsers = users.filter((u: any) => ['guest', 'Guest', 'GUEST'].includes(u.name || u.username));
    checks.push({
      id: 'CIS-5.6.1', name: 'No Guest Accounts',
      status: guestUsers.length === 0 ? 'PASS' : 'FAIL',
      detail: guestUsers.length === 0 ? 'No guest accounts found' : `${guestUsers.length} guest account(s) found`,
      severity: 'WARNING',
    });

    // CIS 2.2.2 — RDP Disabled
    const ports = info.listeningPorts || [];
    const rdpOpen = ports.some((p: any) => p.port === 3389);
    checks.push({
      id: 'CIS-2.2.2', name: 'RDP Disabled',
      status: rdpOpen ? 'FAIL' : 'PASS',
      detail: rdpOpen ? 'Port 3389 (RDP) is open' : 'RDP is not listening',
      severity: 'WARNING',
    });

    // CIS 2.1.1 — Unauthorized Ports
    const approvedPorts = [22, 53, 80, 443, 4100, 8080, 8443, 3000, 5432];
    const unauthorizedPorts = ports.filter((p: any) => !approvedPorts.includes(p.port));
    checks.push({
      id: 'CIS-2.1.1', name: 'No Unauthorized Ports',
      status: unauthorizedPorts.length === 0 ? 'PASS' : 'WARNING',
      detail: unauthorizedPorts.length === 0 ? 'All ports approved' : `${unauthorizedPorts.length} unapproved port(s): ${unauthorizedPorts.map((p: any) => p.port).join(', ')}`,
      severity: 'WARNING',
    });

    // CIS 1.5.3 — Auto-Updates
    const updates = info.pendingUpdates || {};
    checks.push({
      id: 'CIS-1.5.3', name: 'Auto-Updates Enabled',
      status: updates.autoUpdateEnabled ? 'PASS' : 'WARNING',
      detail: updates.autoUpdateEnabled ? 'Automatic updates are enabled' : 'Auto-updates may be disabled',
      severity: 'WARNING',
    });

    const pass = checks.filter(c => c.status === 'PASS').length;
    const fail = checks.filter(c => c.status === 'FAIL').length;
    const warn = checks.filter(c => c.status === 'WARNING').length;

    return {
      agentId, hostname: (agent as any).hostname || agent.id.slice(0, 8),
      assessedAt: new Date().toISOString(),
      score: Math.round((pass / checks.length) * 100),
      summary: { total: checks.length, pass, fail, warn },
      checks,
    };
  }

  async getCisBenchmarkReport(tenantId: string) {
    const agents = await this.prisma.agent.findMany({
      where: { tenantId, status: 'ONLINE' },
      select: { id: true, systemInfo: true, hostname: true },
    });

    const results = [];
    for (const agent of agents) {
      try {
        const assessment = await this.assessCisBenchmark(tenantId, agent.id);
        results.push(assessment);
      } catch {}
    }

    const avgScore = results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length)
      : 0;

    return {
      assessedAt: new Date().toISOString(),
      totalAgents: results.length,
      averageScore: avgScore,
      agents: results,
    };
  }
}
