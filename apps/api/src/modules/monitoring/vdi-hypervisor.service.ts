import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { PrismaService } from '../../common/database/prisma.service';
import { EventBusService } from '../../common/events/event-bus.service';
import { redactSecrets } from '../../common/security/redact';
import { openVaultValue } from '../../common/security/vault-crypto';

const execFileAsync = promisify(execFile);

/**
 * Hypervisor connection configuration
 */
export interface HypervisorConfig {
  type: 'vmware-horizon' | 'vmware-vcenter' | 'proxmox' | 'hyper-v';
  host: string;
  port: number;
  username: string;
  password: string;
  domain?: string;
  ssl?: boolean;
  verifySsl?: boolean;
}

export interface VmInfo {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'suspended' | 'error';
  os: string;
  host: string;
  pool: string;
  cpu: number;    // vCPUs
  ramMb: number;  // Allocated RAM in MB
  diskGb: number; // Allocated disk in GB
  cpuUsage: number | null;  // Current CPU usage %
  ramUsage: number | null;  // Current RAM usage %
  diskUsage: number | null; // Current disk usage %
  uptime?: string;
  ipAddress?: string;
  assignedUser?: string;
}

export interface HypervisorSyncResult {
  hypervisor: string;
  totalVMs: number;
  created: number;
  updated: number;
  removed: number;
}

@Injectable()
export class VdiHypervisorService {
  private readonly logger = new Logger(VdiHypervisorService.name);
  private authTokens: Map<string, { token: string; expiresAt: Date }> = new Map();

  constructor(
    private prisma: PrismaService,
    private eventBus: EventBusService,
  ) {}

  // ─── VMware Horizon REST API ─────────────────────────────────────

  /**
   * Authenticate to VMware Horizon Connection Server
   */
  async horizonLogin(config: HypervisorConfig): Promise<string> {
    const cached = this.authTokens.get(`horizon:${config.host}`);
    if (cached && cached.expiresAt > new Date()) return cached.token;

    const body = JSON.stringify({
      domain: config.domain || 'DOMAIN',
      username: config.username,
      password: config.password,
    });

    const response = await this.apiRequest(config, 'POST', '/rest/login', body);
    const token = response?.access_token;

    if (!token) throw new Error('Horizon authentication failed — no access_token returned');

    // Cache for 30 minutes
    this.authTokens.set(`horizon:${config.host}`, {
      token,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    this.logger.log(`Authenticated to VMware Horizon at ${config.host}`);
    return token;
  }

  /**
   * List all desktop pools from VMware Horizon
   */
  async horizonGetPools(config: HypervisorConfig): Promise<any[]> {
    const token = await this.horizonLogin(config);
    const pools = await this.apiRequest(config, 'GET', '/rest/inventory/v1/desktop-pools', undefined, token);
    return Array.isArray(pools) ? pools : [];
  }

  /**
   * List all machine instances from VMware Horizon
   */
  async horizonGetMachines(config: HypervisorConfig): Promise<VmInfo[]> {
    const token = await this.horizonLogin(config);
    const machines = await this.apiRequest(config, 'GET', '/rest/inventory/v1/machines', undefined, token);

    if (!Array.isArray(machines)) return [];

    return machines.map((m: any) => ({
      id: m.id,
      name: m.name || m.dns_name || m.machine_id,
      status: this.mapHorizonStatus(m.basic_state),
      os: m.operating_system || 'Unknown',
      host: m.host_name || 'Unknown Host',
      pool: m.desktop_pool_id || 'Default',
      cpu: m.virtual_center_data?.num_cpus || 0,
      ramMb: m.virtual_center_data?.memory_mb || 0,
      diskGb: Math.round((m.virtual_center_data?.disk_space_mb || 0) / 1024),
      cpuUsage: null, // Horizon doesn't provide real-time usage in this endpoint
      ramUsage: null,
      diskUsage: null,
      ipAddress: m.agent_data?.ip_v4,
      assignedUser: m.user?.name,
    }));
  }

  private mapHorizonStatus(state: string): VmInfo['status'] {
    const running = ['AVAILABLE', 'CONNECTED', 'IN_PROGRESS', 'PROVISIONED'];
    const suspended = ['MAINTENANCE', 'AGENT_UNREACHABLE', 'WAIT_FOR_AGENT'];
    if (running.includes(state)) return 'running';
    if (suspended.includes(state)) return 'suspended';
    if (state === 'ERROR' || state === 'AGENT_ERROR') return 'error';
    return 'stopped';
  }

  // ─── Proxmox VE REST API ─────────────────────────────────────────

  /**
   * Authenticate to Proxmox VE
   */
  async proxmoxLogin(config: HypervisorConfig): Promise<{ ticket: string; csrfToken: string }> {
    const cached = this.authTokens.get(`proxmox:${config.host}`);
    if (cached && cached.expiresAt > new Date()) {
      const csrf = (cached as any).csrfToken || '';
      return { ticket: cached.token, csrfToken: csrf };
    }

    const body = `username=${encodeURIComponent(config.username)}@pam&password=${encodeURIComponent(config.password)}`;
    const response = await this.apiRequest(
      { ...config, ssl: true, verifySsl: false },
      'POST', '/api2/json/access/ticket', body,
      undefined, 'application/x-www-form-urlencoded',
    );

    const ticket = response?.data?.ticket;
    const csrfToken = response?.data?.CSRFPreventionToken;

    if (!ticket) throw new Error('Proxmox authentication failed');

    this.authTokens.set(`proxmox:${config.host}`, {
      token: ticket,
      expiresAt: new Date(Date.now() + 120 * 60 * 1000), // 2 hours
      csrfToken,
    } as any);

    return { ticket, csrfToken };
  }

  /**
   * List all VMs across Proxmox nodes
   */
  async proxmoxGetVMs(config: HypervisorConfig): Promise<VmInfo[]> {
    const { ticket } = await this.proxmoxLogin(config);

    // Get all nodes
    const nodesRes = await this.apiRequest(
      { ...config, ssl: true, verifySsl: false },
      'GET', '/api2/json/nodes', undefined,
      undefined, undefined, `PVEAuthCookie=${ticket}`,
    );

    const nodes = nodesRes?.data || [];
    const vms: VmInfo[] = [];

    for (const node of nodes) {
      const nodeVMs = await this.apiRequest(
        { ...config, ssl: true, verifySsl: false },
        'GET', `/api2/json/nodes/${node.node}/qemu`, undefined,
        undefined, undefined, `PVEAuthCookie=${ticket}`,
      );

      for (const vm of (nodeVMs?.data || [])) {
        vms.push({
          id: `${node.node}-${vm.vmid}`,
          name: vm.name || `VM-${vm.vmid}`,
          status: vm.status === 'running' ? 'running' : 'stopped',
          os: vm.lock ? 'Locked' : 'Linux/Windows',
          host: node.node,
          pool: vm.pool || 'Default',
          cpu: vm.cpus || 1,
          ramMb: Math.round((vm.maxmem || 0) / 1024 / 1024),
          diskGb: Math.round((vm.maxdisk || 0) / 1024 / 1024 / 1024),
          cpuUsage: Math.round((vm.cpu || 0) * 100),
          ramUsage: vm.maxmem > 0 ? Math.round(((vm.mem || 0) / vm.maxmem) * 100) : 0,
          diskUsage: vm.maxdisk > 0 ? Math.round(((vm.disk || 0) / vm.maxdisk) * 100) : 0,
          uptime: vm.uptime ? this.formatUptime(vm.uptime) : undefined,
        });
      }
    }

    return vms;
  }

  // ─── Hyper-V via WinRM / PowerShell Remoting ───────────────────

  /**
   * Inventory Hyper-V VMs by spawning pwsh and running
   * `Invoke-Command -ComputerName ... { Get-VM }` over WinRM.
   */
  async hyperVGetVMs(config: HypervisorConfig): Promise<VmInfo[]> {
    if (!config.host) throw new BadRequestException('Hyper-V host is required');
    if (!config.username || !config.password) {
      throw new BadRequestException(
        'Hyper-V WinRM sync requires username and password (Enable-PSRemoting on the host)',
      );
    }

    const psBinary = await this.findPowerShellBinary();
    if (!psBinary) {
      const hint =
        process.platform === 'win32'
          ? 'Install PowerShell 7+ or ensure powershell.exe is on PATH.'
          : 'Install PowerShell 7+ (https://aka.ms/powershell) on this API host so Invoke-Command over WinRM can run.';
      throw new BadRequestException(
        `PowerShell was not found on this API host. ${hint} Also ensure WinRM is enabled on the Hyper-V host (Enable-PSRemoting -Force).`,
      );
    }

    const stamp = Date.now();
    const localPs1Path = path.join(os.tmpdir(), `qs-hyperv-inventory-${stamp}.ps1`);

    const ps1 = `
$ErrorActionPreference = 'Stop'
$target = $env:QS_WINRM_TARGET
$user = $env:QS_WINRM_USER
$passPlain = $env:QS_WINRM_PASS

if (-not $target -or -not $user -or -not $passPlain) {
  Write-Output '{"error":"Missing WinRM target or credentials"}'
  exit 2
}

Write-Output "[INFO] Connecting via WinRM to Hyper-V host $target as $user"
$secure = ConvertTo-SecureString $passPlain -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ($user, $secure)

try {
  $vms = Invoke-Command -ComputerName $target -Credential $cred -Authentication Negotiate -ScriptBlock {
    $ErrorActionPreference = 'Stop'
    if (-not (Get-Command Get-VM -ErrorAction SilentlyContinue)) {
      throw 'Hyper-V PowerShell module is not available on this host (Install-WindowsFeature Hyper-V-PowerShell).'
    }
    Get-VM | ForEach-Object {
      $vm = $_
      $ip = $null
      try {
        $adapters = Get-VMNetworkAdapter -VM $vm -ErrorAction SilentlyContinue
        $ip = @($adapters | ForEach-Object { $_.IPAddresses } | Where-Object { $_ -and $_ -notmatch ':' } | Select-Object -First 1)[0]
      } catch {}
      $memMb = 0
      if ($vm.MemoryAssigned -gt 0) { $memMb = [math]::Round($vm.MemoryAssigned / 1MB) }
      elseif ($vm.MemoryStartup -gt 0) { $memMb = [math]::Round($vm.MemoryStartup / 1MB) }
      [PSCustomObject]@{
        Id        = [string]$vm.Id
        Name      = $vm.Name
        State     = [string]$vm.State
        CPUCount  = [int]$vm.ProcessorCount
        MemoryMB  = [int]$memMb
        Status    = [string]$vm.Status
        Uptime    = if ($vm.Uptime) { $vm.Uptime.ToString() } else { $null }
        IpAddress = $ip
        Version   = [string]$vm.Version
        Path      = [string]$vm.Path
      }
    } | ConvertTo-Json -Depth 4 -Compress
  }

  Write-Output '[OK] Invoke-Command completed'
  if ($null -eq $vms -or $vms -eq '') {
    Write-Output '[]'
  } else {
    Write-Output $vms
  }
  exit 0
} catch {
  Write-Output ("[FAIL] " + $_.Exception.Message)
  Write-Output '[HINT] Ensure WinRM is enabled (Enable-PSRemoting -Force), firewall allows 5985/5986, Hyper-V PowerShell is installed, and credentials have Hyper-V admin rights.'
  exit 1
}
`.trim();

    try {
      fs.writeFileSync(localPs1Path, ps1, 'utf8');

      const { stdout, stderr } = await execFileAsync(
        psBinary,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', localPs1Path],
        {
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
          env: {
            ...process.env,
            QS_WINRM_TARGET: config.host,
            QS_WINRM_USER: config.username,
            QS_WINRM_PASS: config.password,
          },
        },
      );

      const combined = `${stdout || ''}\n${stderr || ''}`;
      if (/\[FAIL\]/i.test(combined) || !/\[OK\] Invoke-Command completed/i.test(combined)) {
        const failLine = combined.split('\n').find((l) => /\[FAIL\]/i.test(l)) || combined.trim();
        throw new Error(failLine.replace(/^\[FAIL\]\s*/i, '').trim() || 'Hyper-V WinRM inventory failed');
      }

      // Extract JSON payload after the OK marker (array or single object)
      const afterOk = combined.split(/\[OK\] Invoke-Command completed/i).pop() || '';
      const jsonMatch = afterOk.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
      if (!jsonMatch) {
        this.logger.warn(`Hyper-V inventory returned no JSON from ${config.host}`);
        return [];
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonMatch[1]);
      } catch (err: any) {
        throw new Error(`Failed to parse Hyper-V inventory JSON: ${err.message}`);
      }

      const rows = Array.isArray(parsed) ? parsed : [parsed];
      return rows.filter(Boolean).map((row: any) => this.mapHyperVRow(row, config.host));
    } finally {
      try {
        fs.unlinkSync(localPs1Path);
      } catch {
        /* ignore */
      }
    }
  }

  private mapHyperVRow(row: any, hypervisorHost: string): VmInfo {
    const stateRaw = String(row.State || row.state || '').toLowerCase();
    let status: VmInfo['status'] = 'stopped';
    if (stateRaw === 'running' || stateRaw === '2') status = 'running';
    else if (stateRaw === 'paused' || stateRaw === 'saved' || stateRaw === '3' || stateRaw === '6') {
      status = 'suspended';
    } else if (stateRaw.includes('error') || stateRaw === 'critical') {
      status = 'error';
    }

    return {
      id: String(row.Id || row.id || row.Name || row.name),
      name: String(row.Name || row.name || 'Unknown-VM'),
      status,
      os: 'Unknown',
      host: hypervisorHost,
      pool: 'Hyper-V',
      cpu: Number(row.CPUCount ?? row.ProcessorCount ?? 0) || 0,
      ramMb: Number(row.MemoryMB ?? 0) || 0,
      diskGb: 0,
      cpuUsage: null,
      ramUsage: null,
      diskUsage: null,
      uptime: row.Uptime || undefined,
      ipAddress: row.IpAddress || row.IPAddress || undefined,
    };
  }

  /**
   * Locate pwsh / powershell for WinRM Invoke-Command (same approach as discovery deploy).
   */
  private async findPowerShellBinary(): Promise<string | null> {
    const candidates =
      process.platform === 'win32'
        ? ['pwsh.exe', 'powershell.exe']
        : ['pwsh', 'powershell'];

    for (const cmd of candidates) {
      try {
        if (process.platform === 'win32') {
          await execFileAsync('where.exe', [cmd], { timeout: 5000 });
        } else {
          await execFileAsync('which', [cmd], { timeout: 5000 });
        }
        return cmd;
      } catch {
        // try next
      }
    }

    const absPaths =
      process.platform === 'win32'
        ? [
            'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
            'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
          ]
        : ['/usr/bin/pwsh', '/usr/local/bin/pwsh', '/opt/microsoft/powershell/7/pwsh'];

    for (const p of absPaths) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  // ─── Sync to MonitoredDevice ─────────────────────────────────────

  /**
   * Sync VMs from a hypervisor into the MonitoredDevice table
   */
  async syncHypervisor(tenantId: string, config: HypervisorConfig): Promise<HypervisorSyncResult> {
    let vms: VmInfo[] = [];

    try {
      switch (config.type) {
        case 'vmware-horizon':
          vms = await this.horizonGetMachines(config);
          break;
        case 'proxmox':
          vms = await this.proxmoxGetVMs(config);
          break;
        case 'hyper-v':
          vms = await this.hyperVGetVMs(config);
          break;
        default:
          this.logger.warn(`Unsupported hypervisor type: ${config.type}`);
          return { hypervisor: config.type, totalVMs: 0, created: 0, updated: 0, removed: 0 };
      }
    } catch (err: any) {
      this.logger.error(`Failed to connect to ${config.type} at ${config.host}: ${err.message}`);
      throw err;
    }

    let created = 0;
    let updated = 0;

    for (const vm of vms) {
      const existing = await this.prisma.monitoredDevice.findFirst({
        where: { tenantId, type: 'VIRTUAL_MACHINE', name: vm.name },
      });

      const deviceData = {
        status: vm.status === 'running' ? 'ONLINE' : 'STOPPED',
        lastSeen: vm.status === 'running' ? new Date() : undefined,
        ipAddress: vm.ipAddress || null,
        config: {
          hypervisor: config.type,
          hypervisorHost: config.host,
          os: vm.os,
          host: vm.host,
          pool: vm.pool,
          vcpus: vm.cpu,
          ramMb: vm.ramMb,
          diskGb: vm.diskGb,
          assignedUser: vm.assignedUser,
          externalId: vm.id,
          user: vm.assignedUser,
        },
        metrics: {
          cpu: vm.cpuUsage,
          ram: vm.ramUsage,
          disk: vm.diskUsage,
          uptime: vm.uptime,
          lastSync: new Date().toISOString(),
        },
      };

      if (existing) {
        await this.prisma.monitoredDevice.update({ where: { id: existing.id }, data: deviceData });
        updated++;
      } else {
        await this.prisma.monitoredDevice.create({
          data: { tenantId, type: 'VIRTUAL_MACHINE', name: vm.name, ...deviceData },
        });
        created++;
      }
    }

    // Remove devices no longer in the hypervisor
    const syncedNames = new Set(vms.map(v => v.name));
    const stale = await this.prisma.monitoredDevice.findMany({
      where: { tenantId, type: 'VIRTUAL_MACHINE' },
    });
    const toRemove = stale.filter(d => !syncedNames.has(d.name) && (d.config as any)?.hypervisorHost === config.host);
    for (const d of toRemove) {
      await this.prisma.monitoredDevice.delete({ where: { id: d.id } });
    }

    if (created > 0 || updated > 0) {
      this.eventBus.emitMonitoringEvent(tenantId, 'vdi_sync_completed', {
        hypervisor: config.type, host: config.host, total: vms.length, created, updated, removed: toRemove.length,
      });
    }

    return { hypervisor: config.type, totalVMs: vms.length, created, updated, removed: toRemove.length };
  }

  /**
   * Get the list of configured hypervisors for a tenant (stored in settings)
   */
  async getHypervisors(
    tenantId: string,
    includeSecrets = false,
  ): Promise<Array<HypervisorConfig | Omit<HypervisorConfig, 'password'> & { hasPassword: boolean }>> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as any) || {};
    const hypervisors = (settings.hypervisors || []) as HypervisorConfig[];
    if (includeSecrets) {
      return hypervisors.map((config) => ({
        ...config,
        password: openVaultValue(config.password),
      }));
    }
    return redactSecrets(hypervisors, { preservePresence: true });
  }

  /**
   * Build a console launch URL for a monitored VM.
   * - Proxmox: VNC proxy ticket → noVNC console URL
   * - VMware Horizon: HTML Access portal URL
   * - Hyper-V: RDP connection hint (no browser console)
   */
  async getConsoleUrl(deviceId: string, tenantId: string): Promise<{
    available: boolean;
    type: string;
    url?: string;
    hint?: string;
    reason?: string;
  }> {
    const device = await this.prisma.monitoredDevice.findFirst({
      where: { id: deviceId, tenantId, type: 'VIRTUAL_MACHINE' },
    });
    if (!device) throw new BadRequestException('Virtual machine not found');

    const cfg = (device.config as any) || {};
    const hypervisorType = (cfg.hypervisor || cfg.hypervisorType || '') as string;
    const hypervisors = (await this.getHypervisors(tenantId, true)) as HypervisorConfig[];
    const matched =
      hypervisors.find(
        (h) =>
          h.host === cfg.hypervisorHost ||
          h.type === hypervisorType ||
          (hypervisorType && h.type?.includes(String(hypervisorType).replace('vmware-', ''))),
      ) || hypervisors.find((h) => h.type === hypervisorType);

    if (hypervisorType === 'proxmox' || matched?.type === 'proxmox') {
      const config = matched || {
        type: 'proxmox' as const,
        host: cfg.hypervisorHost || '',
        port: 8006,
        username: '',
        password: '',
        ssl: true,
        verifySsl: false,
      };
      if (!config.host || !config.username || !config.password) {
        return {
          available: false,
          type: 'proxmox',
          reason: 'Proxmox credentials not configured in tenant hypervisors settings.',
        };
      }
      return this.proxmoxConsoleUrl(config, device.name, cfg);
    }

    if (
      hypervisorType === 'vmware-horizon' ||
      hypervisorType === 'horizon' ||
      matched?.type === 'vmware-horizon'
    ) {
      const host = matched?.host || cfg.hypervisorHost;
      if (!host) {
        return {
          available: false,
          type: 'horizon',
          reason: 'Horizon connection server host is not configured.',
        };
      }
      const scheme = matched?.ssl === false ? 'http' : 'https';
      const port = matched?.port && matched.port !== 443 ? `:${matched.port}` : '';
      const url = `${scheme}://${host}${port}/portal/webclient/index.html`;
      return {
        available: true,
        type: 'horizon',
        url,
        hint: 'Opens VMware Horizon HTML Access. Sign in with your Horizon credentials.',
      };
    }

    if (hypervisorType === 'hyper-v' || matched?.type === 'hyper-v') {
      const host = device.ipAddress || cfg.host || cfg.hypervisorHost || matched?.host;
      if (!host) {
        return {
          available: false,
          type: 'rdp',
          reason: 'No IP/host available for RDP. Sync Hyper-V inventory or set the VM IP.',
        };
      }
      return {
        available: true,
        type: 'rdp',
        url: `rdp://full%20address=s:${host}:3389`,
        hint: `Open Remote Desktop (mstsc) and connect to ${host}:3389. Browser WebRTC console is not available for Hyper-V.`,
      };
    }

    // Fallback: if VM has an IP, offer RDP hint
    if (device.ipAddress) {
      return {
        available: true,
        type: 'rdp',
        url: `rdp://full%20address=s:${device.ipAddress}:3389`,
        hint: `No hypervisor console integration configured. Try RDP to ${device.ipAddress}:3389.`,
      };
    }

    return {
      available: false,
      type: 'unknown',
      reason:
        'Console access requires a synced hypervisor (Proxmox, VMware Horizon, or Hyper-V) with credentials configured in settings.',
    };
  }

  private async proxmoxConsoleUrl(
    config: HypervisorConfig,
    vmName: string,
    cfg: any,
  ): Promise<{ available: boolean; type: string; url?: string; hint?: string; reason?: string }> {
    try {
      const { ticket, csrfToken } = await this.proxmoxLogin({
        ...config,
        ssl: true,
        verifySsl: false,
        port: config.port || 8006,
      });

      // Resolve node + vmid from config or id pattern "node-vmid"
      let node = cfg.host || cfg.node;
      let vmid = cfg.vmid || cfg.vmId;
      if ((!node || !vmid) && cfg.hypervisorId) {
        const parts = String(cfg.hypervisorId).split('-');
        if (parts.length >= 2) {
          vmid = parts.pop();
          node = parts.join('-');
        }
      }
      // Try matching from name sync id stored as `${node}-${vmid}`
      const existingId = String(cfg.externalId || '');
      if ((!node || !vmid) && existingId.includes('-')) {
        const parts = existingId.split('-');
        vmid = parts.pop();
        node = parts.join('-');
      }

      if (!node || !vmid) {
        // Look up from live inventory
        const vms = await this.proxmoxGetVMs({ ...config, ssl: true, verifySsl: false, port: config.port || 8006 });
        const match = vms.find((v) => v.name === vmName);
        if (match) {
          const parts = match.id.split('-');
          vmid = parts.pop();
          node = parts.join('-');
        }
      }

      if (!node || !vmid) {
        return {
          available: false,
          type: 'proxmox',
          reason: 'Could not resolve Proxmox node/VMID for this VM. Re-sync from Proxmox.',
        };
      }

      const proxy = await this.apiRequest(
        { ...config, ssl: true, verifySsl: false, port: config.port || 8006 },
        'POST',
        `/api2/json/nodes/${encodeURIComponent(node)}/qemu/${encodeURIComponent(String(vmid))}/vncproxy`,
        '',
        undefined,
        'application/x-www-form-urlencoded',
        `PVEAuthCookie=${ticket}`,
        csrfToken ? { CSRFPreventionToken: csrfToken } : undefined,
      );

      const vncticket = proxy?.data?.ticket;
      if (!vncticket) {
        return {
          available: false,
          type: 'proxmox',
          reason: 'Proxmox VNC proxy did not return a ticket. Check API permissions (VM.Console).',
        };
      }

      const host = config.host;
      const port = config.port || 8006;
      const url =
        `https://${host}:${port}/?console=kvm&novnc=1` +
        `&vmid=${encodeURIComponent(String(vmid))}` +
        `&vmname=${encodeURIComponent(vmName)}` +
        `&node=${encodeURIComponent(node)}` +
        `&resize=1&vncticket=${encodeURIComponent(vncticket)}`;

      return {
        available: true,
        type: 'proxmox',
        url,
        hint: 'Opens Proxmox noVNC console. Your session ticket is short-lived.',
      };
    } catch (err: any) {
      this.logger.error(`Proxmox console URL failed: ${err.message}`);
      return {
        available: false,
        type: 'proxmox',
        reason: err.message || 'Failed to obtain Proxmox console ticket',
      };
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private async apiRequest(
    config: HypervisorConfig,
    method: string,
    path: string,
    body?: string,
    authToken?: string,
    contentType = 'application/json',
    cookie?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const isHttps = config.ssl !== false;
      const client = isHttps ? https : http;

      const headers: Record<string, string> = {
        'Content-Type': contentType,
        'Accept': 'application/json',
        ...(extraHeaders || {}),
      };
      if (body) headers['Content-Length'] = Buffer.byteLength(body).toString();
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
      if (cookie) headers['Cookie'] = cookie;

      const options: any = {
        hostname: config.host,
        port: config.port,
        path,
        method,
        headers,
        timeout: 10000,
      };

      if (isHttps && config.verifySsl === false) {
        options.rejectUnauthorized = false;
      }

      const req = client.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      if (body) req.write(body);
      req.end();
    });
  }

  private formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}
