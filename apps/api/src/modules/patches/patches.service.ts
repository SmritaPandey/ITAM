import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { EmailService } from '../notifications/email.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

@Injectable()
export class PatchesService {
  private readonly logger = new Logger(PatchesService.name);

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
    private emailService: EmailService,
  ) {}

  // ─── LIST ────────────────────────────────────────────────────────
  async findAll(tenantId: string) {
    const data = await this.prisma.patch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { deployments: true } } },
    });
    const deployed = data.filter(p => p.status === 'Deployed').length;
    const pending = data.filter(p => p.status === 'Pending').length;
    const failed = data.filter(p => p.status === 'Failed').length;
    const critical = data.filter(p => p.severity === 'Critical' && p.status !== 'Deployed').length;
    const compliance = data.length > 0 ? Math.round((deployed / data.length) * 100) : 100;
    return { data, total: data.length, deployed, pending, failed, critical, compliance };
  }

  async create(tenantId: string, body: any) {
    return this.prisma.patch.create({ data: { tenantId, ...body } });
  }

  async update(id: string, tenantId: string, body: any) {
    const existing = await this.prisma.patch.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Patch not found');
    return this.prisma.patch.update({ where: { id }, data: body });
  }

  async delete(id: string, tenantId: string) {
    const existing = await this.prisma.patch.findFirst({ where: { id, tenantId } });
    if (!existing) throw new NotFoundException('Patch not found');
    // Delete related deployments first
    await this.prisma.patchDeployment.deleteMany({ where: { patchId: id } });
    return this.prisma.patch.delete({ where: { id } });
  }

  // ─── DEPLOY ──────────────────────────────────────────────────────
  /**
   * Queue a patch for agent-based deployment.
   * Instead of immediately marking as 'Deployed', sets status to 'PENDING_DEPLOYMENT'.
   * Agents will pick up QUEUED PatchDeployment records on their next heartbeat check-in
   * and execute the actual patch installation on managed endpoints.
   */
  async deploy(id: string, tenantId?: string) {
    const patch = await this.prisma.patch.update({
      where: { id },
      data: { status: 'PENDING_DEPLOYMENT' },
    });

    // If we have a tenantId, queue PatchDeployment records for agent-based deployment
    if (tenantId) {
      await this.prisma.patchDeployment.updateMany({
        where: { patchId: id, tenantId, status: { in: ['PENDING', 'DEPLOYING'] } },
        data: { status: 'QUEUED' },
      });

      // Create QUEUED PatchDeployment records for assets with agents that don't have one yet
      const assetsWithAgents = await this.prisma.asset.findMany({
        where: { tenantId, deletedAt: null, agentId: { not: null }, status: 'ACTIVE' },
        select: { id: true },
      });

      for (const asset of assetsWithAgents) {
        await this.prisma.patchDeployment.upsert({
          where: { patchId_assetId: { patchId: id, assetId: asset.id } },
          create: {
            tenantId,
            patchId: id,
            assetId: asset.id,
            status: 'QUEUED',
          },
          update: {},
        });
      }

      this.logger.log(`Patch ${patch.patchId} queued for agent-based deployment on ${assetsWithAgents.length} endpoints`);
    }

    return patch;
  }

  /**
   * Queue all pending/scheduled patches for agent-based deployment.
   * Marks patches as 'PENDING_DEPLOYMENT' instead of 'Deployed'.
   * Agents will execute actual installations on their next heartbeat check-in.
   */
  async deployAll(tenantId: string) {
    const pending = await this.prisma.patch.findMany({
      where: { tenantId, status: { in: ['Pending', 'Scheduled'] } },
    });

    const results = { deployed: 0, failed: 0, errors: [] as string[] };

    // Get all assets with online agents for this tenant
    const assetsWithAgents = await this.prisma.asset.findMany({
      where: { tenantId, deletedAt: null, agentId: { not: null }, status: 'ACTIVE' },
      select: { id: true },
    });

    for (const patch of pending) {
      try {
        await this.prisma.patch.update({
          where: { id: patch.id },
          data: { status: 'PENDING_DEPLOYMENT' },
        });
        // Queue per-asset deployments for agent pickup
        await this.prisma.patchDeployment.updateMany({
          where: { patchId: patch.id, tenantId, status: { in: ['PENDING', 'DEPLOYING'] } },
          data: { status: 'QUEUED' },
        });

        // Create QUEUED PatchDeployment records for assets that don't have one
        for (const asset of assetsWithAgents) {
          await this.prisma.patchDeployment.upsert({
            where: { patchId_assetId: { patchId: patch.id, assetId: asset.id } },
            create: {
              tenantId,
              patchId: patch.id,
              assetId: asset.id,
              status: 'QUEUED',
            },
            update: {},
          });
        }

        results.deployed++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${patch.patchId}: ${err.message}`);
      }
    }

    this.eventBus.emitAssetEvent(tenantId, 'patches_deployed', {
      count: results.deployed,
      timestamp: new Date(),
    });

    this.logger.log(`Queued ${results.deployed} patches for agent-based deployment on ${assetsWithAgents.length} endpoints`);

    return { ...results, total: pending.length };
  }

  // ─── GET DEPLOYMENTS ─────────────────────────────────────────────
  async getDeployments(patchId: string) {
    return this.prisma.patchDeployment.findMany({
      where: { patchId },
      include: { asset: { select: { id: true, name: true, hostname: true, ipAddress: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── COMPLIANCE ──────────────────────────────────────────────────
  async getCompliance(tenantId: string) {
    const data = await this.prisma.patch.findMany({ where: { tenantId } });
    const bySeverity = ['Critical', 'High', 'Medium', 'Low'].map(sev => {
      const group = data.filter(p => p.severity === sev);
      const deployed = group.filter(p => p.status === 'Deployed').length;
      return { severity: sev, total: group.length, deployed, compliance: group.length > 0 ? Math.round((deployed / group.length) * 100) : 100 };
    });
    const overall = data.length > 0 ? Math.round((data.filter(p => p.status === 'Deployed').length / data.length) * 100) : 100;
    return { overall, bySeverity, totalPatches: data.length };
  }

  async getComplianceHistory(tenantId: string) {
    // Build real weekly compliance from patch deployment timestamps
    const patches = await this.prisma.patch.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });

    if (patches.length === 0) {
      return { timeline: [] };
    }

    const now = new Date();
    const weeks: { week: string; rate: number; deployed: number; total: number }[] = [];

    for (let w = 7; w >= 0; w--) {
      const weekEnd = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      const weekLabel = `W${8 - w}`;
      const relevantPatches = patches.filter(p => new Date(p.createdAt) <= weekEnd);
      const deployedByThen = relevantPatches.filter(p =>
        p.status === 'Deployed' && p.deployedDate && new Date(p.deployedDate) <= weekEnd,
      ).length;
      const total = relevantPatches.length;
      const rate = total > 0 ? Math.round((deployedByThen / total) * 100) : 100;
      weeks.push({ week: weekLabel, rate, deployed: deployedByThen, total });
    }

    return { timeline: weeks };
  }

  async getMissing(tenantId: string) {
    const missing = await this.prisma.patch.findMany({
      where: { tenantId, status: { in: ['Pending', 'Failed', 'Scheduled'] } },
      orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    });
    return { data: missing, total: missing.length };
  }

  // ─── REAL PATCH SCANNING ─────────────────────────────────────────
  /**
   * Scans the host machine for available OS updates and creates patch records.
   * Supports macOS (softwareupdate), Debian/Ubuntu (apt), and RHEL/CentOS (yum/dnf).
   */
  async scanForPatches(tenantId: string, source: string = 'MANUAL') {
    const platform = os.platform();
    const scanStartedAt = new Date();
    // NOTE: This scan runs on the API SERVER host, not on managed endpoints.
    // For agent-based scanning, patches are detected via agent heartbeat reports.
    // See processAgentPatchReport() for agent-submitted patch inventory.
    this.logger.log(`Starting patch scan on ${platform} for tenant ${tenantId} (source: ${source})`);

    const results: {
      patchId: string; title: string; severity: string; category: string;
    }[] = [];

    try {
      if (platform === 'darwin') {
        results.push(...await this.scanMacOS());
      } else if (platform === 'linux') {
        results.push(...await this.scanLinux());
      } else if (platform === 'win32') {
        results.push(...await this.scanWindows());
      } else {
        this.logger.warn(`Unsupported platform for patch scanning: ${platform}`);
      }
    } catch (err: any) {
      this.logger.error(`Patch scan error: ${err.message}`);
    }

    // Count IT assets for affectedAssets estimate
    const assetCount = await this.prisma.asset.count({
      where: { tenantId, status: 'ACTIVE', ipAddress: { not: null } },
    });

    // Upsert patch records
    let created = 0;
    let updated = 0;
    for (const patch of results) {
      const existing = await this.prisma.patch.findFirst({
        where: { tenantId, patchId: patch.patchId },
      });

      if (existing) {
        // Update if not already deployed
        if (existing.status !== 'Deployed') {
          await this.prisma.patch.update({
            where: { id: existing.id },
            data: {
              title: patch.title,
              severity: patch.severity,
              category: patch.category,
              lastScanAt: scanStartedAt,
              scanSource: source,
              affectedAssets: assetCount,
            },
          });
          updated++;
        }
      } else {
        await this.prisma.patch.create({
          data: {
            tenantId,
            patchId: patch.patchId,
            title: patch.title,
            severity: patch.severity,
            category: patch.category,
            status: 'Pending',
            affectedAssets: assetCount,
            lastScanAt: scanStartedAt,
            scanSource: source,
          },
        });
        created++;
      }
    }

    // Emit event
    this.eventBus.emitAssetEvent(tenantId, 'patch_scan_completed', {
      platform,
      patchesFound: results.length,
      created,
      updated,
      timestamp: scanStartedAt,
    });

    // Check if discovery agents exist for this tenant
    const agentCount = await this.prisma.agent.count({
      where: {
        tenantId,
        status: 'ONLINE',
        lastHeartbeat: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
    });

    const summary: any = {
      platform,
      scannedAt: scanStartedAt,
      // Label results with source to distinguish from agent-reported patches
      source: 'API_SERVER',
      scanTrigger: source,
      totalFound: results.length,
      created,
      updated,
      skipped: results.length - created - updated,
      patches: results,
    };

    // If agents are available, note that agent-based scanning is preferred
    if (agentCount > 0) {
      summary.agentNote = `Agent-based scanning available — ${agentCount} online agent(s) detected. Patches from managed endpoints are reported via agent heartbeat. These results are from the API server host only.`;
    }

    this.logger.log(`Patch scan complete: ${results.length} found, ${created} created, ${updated} updated`);
    return summary;
  }

  // ─── macOS: softwareupdate ───────────────────────────────────────
  private async scanMacOS(): Promise<{ patchId: string; title: string; severity: string; category: string }[]> {
    const patches: { patchId: string; title: string; severity: string; category: string }[] = [];

    try {
      // softwareupdate -l lists available updates
      const { stdout, stderr } = await execAsync('softwareupdate -l 2>&1', { timeout: 60000 });
      const output = stdout + '\n' + (stderr || '');

      // Parse output lines like: "* Label: macOS Sequoia 15.4.1"
      // or "* macOS Sequoia 15.4.1"
      const lines = output.split('\n');
      let currentTitle = '';

      for (const line of lines) {
        const trimmed = line.trim();

        // Match "* Label: ..." pattern (newer macOS)
        const labelMatch = trimmed.match(/^\*\s+Label:\s+(.+)/);
        if (labelMatch) {
          currentTitle = labelMatch[1].trim();
          continue;
        }

        // Match "* Title: ..." pattern
        const titleMatch = trimmed.match(/^\*\s+Title:\s+(.+)/);
        if (titleMatch) {
          currentTitle = titleMatch[1].trim();
          continue;
        }

        // Match standalone "* UpdateName-Version" pattern
        const standaloneMatch = trimmed.match(/^\*\s+(.+)/);
        if (standaloneMatch && !trimmed.includes('Label:') && !trimmed.includes('Title:')) {
          currentTitle = standaloneMatch[1].trim();
        }

        // Look for size/recommended lines to finalize the entry
        if (currentTitle && (trimmed.includes('Recommended:') || trimmed.includes('Size:') || trimmed.includes('Action:'))) {
          const isRecommended = trimmed.includes('Recommended: YES');
          const isRestart = trimmed.includes('Action: restart');

          // Generate a patch ID from the title
          const patchId = `APPLE-${currentTitle.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 40)}`;

          // Determine severity
          let severity = 'Medium';
          const titleLower = currentTitle.toLowerCase();
          if (titleLower.includes('security') || titleLower.includes('xprotect') || isRestart) {
            severity = 'Critical';
          } else if (isRecommended) {
            severity = 'High';
          } else if (titleLower.includes('safari') || titleLower.includes('firmware')) {
            severity = 'High';
          }

          // Determine category
          let category = 'System';
          if (titleLower.includes('security') || titleLower.includes('xprotect')) {
            category = 'Security';
          } else if (titleLower.includes('safari')) {
            category = 'Browser';
          } else if (titleLower.includes('macos')) {
            category = 'Operating System';
          } else if (titleLower.includes('firmware') || titleLower.includes('efi')) {
            category = 'Firmware';
          } else if (titleLower.includes('command line') || titleLower.includes('xcode')) {
            category = 'Developer Tools';
          }

          // Avoid duplicates
          if (!patches.some(p => p.patchId === patchId)) {
            patches.push({ patchId, title: currentTitle, severity, category });
          }
          currentTitle = '';
        }
      }

      // If we found a title but no metadata line followed, still capture it
      if (currentTitle && !patches.some(p => p.title === currentTitle)) {
        const patchId = `APPLE-${currentTitle.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase().substring(0, 40)}`;
        patches.push({ patchId, title: currentTitle, severity: 'Medium', category: 'System' });
      }

      // Also check for "No new software available." — means fully patched
      if (output.includes('No new software available')) {
        this.logger.log('macOS: System is fully patched — no updates available');
      }
    } catch (err: any) {
      this.logger.warn(`macOS softwareupdate scan failed: ${err.message}`);
    }

    // Also scan Homebrew if available (catches browser/app patches)
    try {
      const { stdout: brewOut } = await execAsync('brew outdated --json=v2 2>/dev/null', { timeout: 30000 });
      const brewData = JSON.parse(brewOut);

      for (const formula of (brewData.formulae || [])) {
        const name = formula.name || formula.installed_versions?.[0]?.version;
        if (name) {
          const patchId = `BREW-${name.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
          if (!patches.some(p => p.patchId === patchId)) {
            patches.push({
              patchId,
              title: `${name} update: ${formula.installed_versions?.[0]?.version || '?'} → ${formula.current_version || 'latest'}`,
              severity: 'Low',
              category: 'Application',
            });
          }
        }
      }

      for (const cask of (brewData.casks || [])) {
        const name = cask.name || cask.token;
        if (name) {
          const patchId = `BREW-CASK-${(cask.token || name).toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
          if (!patches.some(p => p.patchId === patchId)) {
            let severity = 'Low';
            const tokenLower = (cask.token || '').toLowerCase();
            if (['firefox', 'chrome', 'brave', 'edge'].some(b => tokenLower.includes(b))) {
              severity = 'High'; // Browser updates are security-critical
            }
            patches.push({
              patchId,
              title: `${name} cask update: ${cask.installed_versions || '?'} → ${cask.current_version || 'latest'}`,
              severity,
              category: tokenLower.includes('font') ? 'Fonts' : 'Application',
            });
          }
        }
      }
    } catch {
      // Homebrew not installed or failed — that's fine
    }

    return patches;
  }

  // ─── Linux: apt / yum / dnf ──────────────────────────────────────
  private async scanLinux(): Promise<{ patchId: string; title: string; severity: string; category: string }[]> {
    const patches: { patchId: string; title: string; severity: string; category: string }[] = [];

    // Try apt-based systems first (Debian/Ubuntu)
    try {
      await execAsync('apt-get update -qq 2>/dev/null', { timeout: 30000 });
      const { stdout } = await execAsync('apt list --upgradable 2>/dev/null', { timeout: 15000 });

      for (const line of stdout.split('\n')) {
        // Format: "package/suite version arch [upgradable from: old-version]"
        const match = line.match(/^([^/]+)\/\S+\s+(\S+)\s+\S+\s+\[upgradable from: (\S+)\]/);
        if (match) {
          const [, pkg, newVer, oldVer] = match;
          const patchId = `APT-${pkg.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
          let severity = 'Medium';
          let category = 'System';

          if (pkg.includes('linux-') || pkg.includes('kernel')) { severity = 'Critical'; category = 'Kernel'; }
          else if (pkg.includes('openssl') || pkg.includes('libssl') || pkg.includes('openssh')) { severity = 'Critical'; category = 'Security'; }
          else if (pkg.includes('firefox') || pkg.includes('chromium')) { severity = 'High'; category = 'Browser'; }
          else if (pkg.includes('lib')) { category = 'Library'; }

          patches.push({ patchId, title: `${pkg}: ${oldVer} → ${newVer}`, severity, category });
        }
      }
    } catch {
      // Not apt-based, try yum/dnf
      try {
        const cmd = await this.detectYumOrDnf();
        const { stdout } = await execAsync(`${cmd} check-update 2>/dev/null || true`, { timeout: 30000 });

        for (const line of stdout.split('\n')) {
          const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)/);
          if (match && !line.startsWith('Last') && !line.startsWith('Obsoleting')) {
            const [, pkg, newVer] = match;
            const patchId = `YUM-${pkg.toUpperCase().replace(/[^A-Z0-9]/g, '-')}`;
            let severity = 'Medium';
            let category = 'System';

            if (pkg.includes('kernel')) { severity = 'Critical'; category = 'Kernel'; }
            else if (pkg.includes('openssl') || pkg.includes('openssh')) { severity = 'Critical'; category = 'Security'; }

            patches.push({ patchId, title: `${pkg} update to ${newVer}`, severity, category });
          }
        }
      } catch {
        this.logger.warn('Neither apt nor yum/dnf available for patch scanning');
      }
    }

    return patches;
  }

  private async detectYumOrDnf(): Promise<string> {
    try { await execAsync('which dnf'); return 'dnf'; } catch {}
    try { await execAsync('which yum'); return 'yum'; } catch {}
    throw new Error('No package manager found');
  }

  // ─── Windows: wmic / PowerShell ──────────────────────────────────
  private async scanWindows(): Promise<{ patchId: string; title: string; severity: string; category: string }[]> {
    const patches: { patchId: string; title: string; severity: string; category: string }[] = [];

    try {
      // Use PowerShell to check for available Windows updates
      const psScript = `
        $UpdateSession = New-Object -ComObject Microsoft.Update.Session
        $Searcher = $UpdateSession.CreateUpdateSearcher()
        $Results = $Searcher.Search("IsInstalled=0")
        foreach ($Update in $Results.Updates) {
          Write-Output "$($Update.Title)|$($Update.MsrcSeverity)|$($Update.Categories.Item(0).Name)|$($Update.Identity.UpdateID)"
        }
      `;
      const { stdout } = await execAsync(`powershell -Command "${psScript.replace(/\n/g, '; ')}"`, { timeout: 60000 });

      for (const line of stdout.split('\n')) {
        const parts = line.trim().split('|');
        if (parts.length >= 4) {
          const [title, msrcSeverity, category, updateId] = parts;
          const patchId = `MS-${updateId.substring(0, 16).toUpperCase()}`;
          let severity = 'Medium';
          if (msrcSeverity === 'Critical') severity = 'Critical';
          else if (msrcSeverity === 'Important') severity = 'High';
          else if (msrcSeverity === 'Moderate') severity = 'Medium';

          patches.push({ patchId, title, severity, category: category || 'Windows Update' });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Windows update scan failed: ${err.message}`);
    }

    // Also check installed patches via wmic for inventory
    try {
      const { stdout } = await execAsync('wmic qfe list brief /format:csv 2>/dev/null', { timeout: 15000 });
      this.logger.log(`Windows installed patches: ${stdout.split('\n').length - 1} found`);
    } catch {}

    return patches;
  }

  // ─── SCHEDULED SCAN ──────────────────────────────────────────────
  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledPatchScan() {
    this.logger.log('Running scheduled patch scan...');
    try {
      const tenants = await this.prisma.tenant.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });

      for (const tenant of tenants) {
        await this.scanForPatches(tenant.id, 'SCHEDULED').catch(err =>
          this.logger.error(`Scheduled scan failed for tenant ${tenant.id}: ${err.message}`),
        );

        // Check for critical overdue patches (Pending for >7 days)
        await this.sendOverdueAlerts(tenant.id).catch(err =>
          this.logger.error(`Overdue alert failed for tenant ${tenant.id}: ${err.message}`),
        );
      }
    } catch (err: any) {
      this.logger.error(`Scheduled patch scan error: ${err.message}`);
    }
  }

  /**
   * Detect Critical patches that have been Pending for >7 days and send alert emails
   */
  private async sendOverdueAlerts(tenantId: string) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const overduePatches = await this.prisma.patch.findMany({
      where: {
        tenantId,
        severity: 'Critical',
        status: 'Pending',
        createdAt: { lte: sevenDaysAgo },
      },
    });

    if (overduePatches.length === 0) return;

    // Resolve admin emails for this tenant
    const admins = await this.prisma.user.findMany({
      where: {
        tenantId,
        role: { name: { in: ['Tenant Admin', 'IT Admin'] } },
        status: 'ACTIVE',
      },
      select: { email: true },
    });
    const adminEmails = admins.map(a => a.email).filter(Boolean);
    if (adminEmails.length === 0) return;

    for (const patch of overduePatches) {
      await this.emailService.sendPatchOverdueAlert(
        adminEmails,
        patch.patchId,
        patch.title,
        patch.severity,
        patch.affectedAssets || 0,
      );
    }

    this.logger.log(`Sent ${overduePatches.length} overdue patch alerts for tenant ${tenantId}`);
  }

  // ─── AGENT PATCH REPORT ────────────────────────────────────────────
  /**
   * Process patch inventory reported by an agent during heartbeat.
   * Agents submit their detected patches (available updates on their host OS),
   * which are then upserted into the patch database for the tenant.
   */
  async processAgentPatchReport(
    tenantId: string,
    agentId: string,
    patches: { patchId: string; title: string; severity: string; category: string; installed?: boolean }[],
  ) {
    this.logger.log(`Processing agent patch report from agent ${agentId}: ${patches.length} patches reported`);

    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found for tenant ${tenantId}`);
    }

    let created = 0;
    let updated = 0;

    for (const patch of patches) {
      const existing = await this.prisma.patch.findFirst({
        where: { tenantId, patchId: patch.patchId },
      });

      if (existing) {
        // Update scan metadata
        if (existing.status !== 'Deployed') {
          await this.prisma.patch.update({
            where: { id: existing.id },
            data: {
              title: patch.title,
              severity: patch.severity,
              category: patch.category,
              lastScanAt: new Date(),
              scanSource: 'AGENT',
            },
          });
          updated++;
        }

        // If agent reports patch as installed, mark the per-asset deployment as DEPLOYED
        if (patch.installed && agent.assetId) {
          await this.prisma.patchDeployment.upsert({
            where: { patchId_assetId: { patchId: existing.id, assetId: agent.assetId } },
            create: {
              tenantId,
              patchId: existing.id,
              assetId: agent.assetId,
              status: 'DEPLOYED',
              deployedAt: new Date(),
            },
            update: {
              status: 'DEPLOYED',
              deployedAt: new Date(),
            },
          });
        }
      } else {
        const newPatch = await this.prisma.patch.create({
          data: {
            tenantId,
            patchId: patch.patchId,
            title: patch.title,
            severity: patch.severity,
            category: patch.category,
            status: patch.installed ? 'Deployed' : 'Pending',
            lastScanAt: new Date(),
            scanSource: 'AGENT',
          },
        });

        // Create per-asset deployment record
        if (agent.assetId) {
          await this.prisma.patchDeployment.create({
            data: {
              tenantId,
              patchId: newPatch.id,
              assetId: agent.assetId,
              status: patch.installed ? 'DEPLOYED' : 'PENDING',
              deployedAt: patch.installed ? new Date() : null,
            },
          });
        }

        created++;
      }
    }

    this.eventBus.emitAssetEvent(tenantId, 'agent_patch_report', {
      agentId,
      hostname: agent.hostname,
      patchesReported: patches.length,
      created,
      updated,
      timestamp: new Date(),
    });

    this.logger.log(`Agent patch report processed: ${created} created, ${updated} updated`);
    return { agentId, created, updated, total: patches.length };
  }
}
