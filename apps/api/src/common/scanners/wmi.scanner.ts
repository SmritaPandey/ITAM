import { Logger } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const execFileAsync = promisify(execFile);

export interface WmiCredentials {
  host: string;
  username: string;
  password: string;
  domain?: string;
  timeout?: number;
}

export interface WmiNicInfo {
  name?: string;
  description?: string;
  mac?: string;
  ips?: string[];
  dhcpEnabled?: boolean;
}

export interface WmiDiskInfo {
  deviceId?: string;
  driveType?: number;
  filesystem?: string;
  sizeBytes?: number;
  freeBytes?: number;
  sizeGb?: number;
  freeGb?: number;
  model?: string;
  serial?: string;
}

export interface WmiSoftwareInfo {
  name: string;
  version?: string;
  publisher?: string;
  installDate?: string;
}

export interface WmiServiceInfo {
  name: string;
  displayName?: string;
  state?: string;
  startMode?: string;
}

export interface WmiHotfixInfo {
  hotfixId: string;
  description?: string;
  installedOn?: string;
  installedBy?: string;
}

export interface WmiScanResult {
  host: string;
  hostname?: string;
  os?: {
    name?: string;
    version?: string;
    build?: string;
    architecture?: string;
    installDate?: string;
    lastBoot?: string;
  };
  manufacturer?: string;
  model?: string;
  serial?: string;
  cpu?: {
    name?: string;
    cores?: number;
    logicalProcessors?: number;
    maxClockMhz?: number;
  };
  ram?: {
    totalBytes?: number;
    totalMb?: number;
    totalGb?: number;
  };
  disks?: WmiDiskInfo[];
  nics?: WmiNicInfo[];
  software?: WmiSoftwareInfo[];
  services?: WmiServiceInfo[];
  hotfixes?: WmiHotfixInfo[];
  collectedAt?: string;
  method?: 'WINRM';
  error?: string;
}

/**
 * WMI / WinRM agentless scanner.
 * Connects to Windows hosts via PowerShell Remoting (Invoke-Command) and collects
 * real CIM/WMI inventory. Never fabricates inventory data.
 */
export class WmiScanner {
  private static readonly logger = new Logger('WmiScanner');

  static async isAvailable(): Promise<{ available: boolean; binary?: string }> {
    const binary = await this.findPowerShellBinary();
    return { available: !!binary, binary: binary || undefined };
  }

  /**
   * Full Windows inventory via WinRM / PowerShell Remoting.
   */
  static async scan(creds: WmiCredentials): Promise<WmiScanResult> {
    const host = (creds.host || '').trim();
    const result: WmiScanResult = { host, method: 'WINRM' };

    if (!host) {
      result.error = 'Host is required for WMI/WinRM scan';
      return result;
    }
    if (!creds.username || !creds.password) {
      result.error = 'Username and password are required for WMI/WinRM scan';
      return result;
    }

    const psBinary = await this.findPowerShellBinary();
    if (!psBinary) {
      result.error =
        process.platform === 'win32'
          ? 'PowerShell was not found on this API host. Install PowerShell 7+ or ensure powershell.exe is on PATH, then enable WinRM on the target (Enable-PSRemoting -Force).'
          : 'PowerShell (pwsh) is not installed on this API host. Install PowerShell 7+ (https://aka.ms/powershell) so the API can run Invoke-Command over WinRM. Target must have WinRM enabled (Enable-PSRemoting -Force) on port 5985/5986.';
      this.logger.error(result.error);
      return result;
    }

    const timeout = Math.max(creds.timeout || 90000, 15000);
    const stamp = Date.now();
    const localPs1Path = path.join(os.tmpdir(), `qs-wmi-scan-${stamp}.ps1`);

    const userForCred = this.formatUsername(creds.username, creds.domain);

    try {
      fs.writeFileSync(localPs1Path, this.buildInventoryScript(), 'utf8');

      const { stdout, stderr } = await execFileAsync(
        psBinary,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', localPs1Path],
        {
          timeout,
          maxBuffer: 32 * 1024 * 1024,
          env: {
            ...process.env,
            QS_WMI_TARGET: host,
            QS_WMI_USER: userForCred,
            QS_WMI_PASS: creds.password,
          },
        },
      );

      const combined = `${stdout || ''}\n${stderr || ''}`.trim();
      const parsed = this.parseInventoryOutput(combined);

      if (parsed.error && !parsed.hostname && !parsed.os) {
        result.error = parsed.error;
        this.logger.warn(`WMI/WinRM scan failed for ${host}: ${parsed.error}`);
        return result;
      }

      Object.assign(result, parsed);
      result.host = host;
      result.method = 'WINRM';
      result.collectedAt = new Date().toISOString();

      if (!result.hostname && !result.os?.name && !result.serial) {
        result.error =
          result.error ||
          'WinRM connected but returned no inventory data. Ensure the account has local admin rights and WMI/CIM is accessible.';
        this.logger.warn(`WMI/WinRM empty inventory for ${host}: ${result.error}`);
      } else {
        // Successful real inventory — strip any partial error noise
        delete result.error;
        this.logger.log(
          `WMI/WinRM inventory for ${host}: hostname=${result.hostname || '?'}, software=${result.software?.length || 0}, services=${result.services?.length || 0}`,
        );
      }

      return result;
    } catch (err: any) {
      const msg = this.normalizeExecError(err);
      result.error = msg;
      this.logger.error(`WMI/WinRM scan exception for ${host}: ${msg}`);
      return result;
    } finally {
      try {
        if (fs.existsSync(localPs1Path)) fs.unlinkSync(localPs1Path);
      } catch {
        // ignore cleanup errors
      }
    }
  }

  private static formatUsername(username: string, domain?: string): string {
    const user = username.trim();
    if (!domain) return user;
    const d = domain.trim();
    if (!d) return user;
    if (user.includes('\\') || user.includes('@')) return user;
    return `${d}\\${user}`;
  }

  private static async findPowerShellBinary(): Promise<string | null> {
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

  /**
   * Remote inventory script. Credentials come from env to avoid argv leaks.
   * Emits a single JSON object between markers for reliable parsing.
   */
  private static buildInventoryScript(): string {
    return `
$ErrorActionPreference = 'Stop'
$target = $env:QS_WMI_TARGET
$user = $env:QS_WMI_USER
$passPlain = $env:QS_WMI_PASS

if (-not $target -or -not $user -or -not $passPlain) {
  Write-Output 'QS_WMI_JSON_BEGIN'
  Write-Output (@{ error = 'Missing WinRM target or credentials in environment' } | ConvertTo-Json -Compress)
  Write-Output 'QS_WMI_JSON_END'
  exit 2
}

$secure = ConvertTo-SecureString $passPlain -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ($user, $secure)

try {
  $raw = Invoke-Command -ComputerName $target -Credential $cred -Authentication Negotiate -ScriptBlock {
    $ErrorActionPreference = 'SilentlyContinue'

    function To-Array($x) {
      if ($null -eq $x) { return @() }
      if ($x -is [System.Array]) { return @($x) }
      return @($x)
    }

    $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    $bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
    $cpu = @(Get-CimInstance Win32_Processor -ErrorAction SilentlyContinue) | Select-Object -First 1

    $disks = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction SilentlyContinue | ForEach-Object {
      [pscustomobject]@{
        deviceId   = $_.DeviceID
        driveType  = [int]$_.DriveType
        filesystem = $_.FileSystem
        sizeBytes  = [int64]$_.Size
        freeBytes  = [int64]$_.FreeSpace
        sizeGb     = if ($_.Size) { [math]::Round($_.Size / 1GB, 2) } else { $null }
        freeGb     = if ($_.FreeSpace) { [math]::Round($_.FreeSpace / 1GB, 2) } else { $null }
      }
    })

    $nics = @(Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=True' -ErrorAction SilentlyContinue | ForEach-Object {
      [pscustomobject]@{
        name        = $_.Description
        description = $_.Description
        mac         = $_.MACAddress
        ips         = @(To-Array $_.IPAddress | Where-Object { $_ -and $_ -notmatch ':' })
        dhcpEnabled = [bool]$_.DHCPEnabled
      }
    })

    # Prefer Uninstall registry keys (fast) over Win32_Product (triggers MSI repair)
    $software = @()
    $uninstallRoots = @(
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
      'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'
    )
    foreach ($root in $uninstallRoots) {
      Get-ItemProperty $root -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.DisplayName) {
          $software += [pscustomobject]@{
            name        = [string]$_.DisplayName
            version     = [string]$_.DisplayVersion
            publisher   = [string]$_.Publisher
            installDate = [string]$_.InstallDate
          }
        }
      }
    }
    if ($software.Count -eq 0) {
      $software = @(Get-CimInstance Win32_Product -ErrorAction SilentlyContinue | ForEach-Object {
        [pscustomobject]@{
          name        = [string]$_.Name
          version     = [string]$_.Version
          publisher   = [string]$_.Vendor
          installDate = [string]$_.InstallDate
        }
      } | Where-Object { $_.name })
    }
    $software = $software | Sort-Object name -Unique | Select-Object -First 2000

    $services = @(Get-CimInstance Win32_Service -ErrorAction SilentlyContinue | ForEach-Object {
      [pscustomobject]@{
        name        = [string]$_.Name
        displayName = [string]$_.DisplayName
        state       = [string]$_.State
        startMode   = [string]$_.StartMode
      }
    } | Select-Object -First 500)

    $hotfixes = @(Get-CimInstance Win32_QuickFixEngineering -ErrorAction SilentlyContinue | ForEach-Object {
      [pscustomobject]@{
        hotfixId    = [string]$_.HotFixID
        description = [string]$_.Description
        installedOn = if ($_.InstalledOn) { $_.InstalledOn.ToString('yyyy-MM-dd') } else { $null }
        installedBy = [string]$_.InstalledBy
      }
    } | Select-Object -First 500)

    $totalRam = [int64]($cs.TotalPhysicalMemory)
    [pscustomobject]@{
      hostname     = if ($cs.DNSHostName) { $cs.DNSHostName } else { $cs.Name }
      manufacturer = [string]$cs.Manufacturer
      model        = [string]$cs.Model
      serial       = [string]$bios.SerialNumber
      os = [pscustomobject]@{
        name         = [string]$os.Caption
        version      = [string]$os.Version
        build        = [string]$os.BuildNumber
        architecture = [string]$os.OSArchitecture
        installDate  = if ($os.InstallDate) { $os.InstallDate.ToString('o') } else { $null }
        lastBoot     = if ($os.LastBootUpTime) { $os.LastBootUpTime.ToString('o') } else { $null }
      }
      cpu = [pscustomobject]@{
        name              = [string]$cpu.Name
        cores             = [int]$cpu.NumberOfCores
        logicalProcessors = [int]$cpu.NumberOfLogicalProcessors
        maxClockMhz       = [int]$cpu.MaxClockSpeed
      }
      ram = [pscustomobject]@{
        totalBytes = $totalRam
        totalMb    = if ($totalRam) { [math]::Round($totalRam / 1MB) } else { $null }
        totalGb    = if ($totalRam) { [math]::Round($totalRam / 1GB, 2) } else { $null }
      }
      disks     = $disks
      nics      = $nics
      software  = @($software)
      services  = $services
      hotfixes  = $hotfixes
    }
  }

  Write-Output 'QS_WMI_JSON_BEGIN'
  Write-Output ($raw | ConvertTo-Json -Depth 8 -Compress)
  Write-Output 'QS_WMI_JSON_END'
  exit 0
} catch {
  Write-Output 'QS_WMI_JSON_BEGIN'
  $msg = $_.Exception.Message
  if (-not $msg) { $msg = $_.ToString() }
  Write-Output (@{
    error = ("WinRM Invoke-Command failed: " + $msg)
    hint  = 'Ensure WinRM is enabled on the target (Enable-PSRemoting -Force), firewall allows 5985/5986, and credentials have local admin rights.'
  } | ConvertTo-Json -Compress)
  Write-Output 'QS_WMI_JSON_END'
  exit 1
}
`.trim();
  }

  private static parseInventoryOutput(combined: string): Partial<WmiScanResult> {
    const begin = combined.indexOf('QS_WMI_JSON_BEGIN');
    const end = combined.indexOf('QS_WMI_JSON_END');
    let jsonText = '';

    if (begin >= 0 && end > begin) {
      jsonText = combined.slice(begin + 'QS_WMI_JSON_BEGIN'.length, end).trim();
    } else {
      // Fallback: last JSON-looking block
      const match = combined.match(/\{[\s\S]*\}/);
      if (match) jsonText = match[0];
    }

    if (!jsonText) {
      return {
        error:
          combined.slice(0, 500) ||
          'No JSON inventory returned from PowerShell WinRM session',
      };
    }

    try {
      const data = JSON.parse(jsonText);
      if (data.error && !data.hostname && !data.os) {
        const hint = data.hint ? ` ${data.hint}` : '';
        return { error: `${data.error}${hint}`.trim() };
      }

      return {
        hostname: data.hostname || undefined,
        manufacturer: data.manufacturer || undefined,
        model: data.model || undefined,
        serial: data.serial || undefined,
        os: data.os || undefined,
        cpu: data.cpu || undefined,
        ram: data.ram || undefined,
        disks: Array.isArray(data.disks) ? data.disks : data.disks ? [data.disks] : [],
        nics: Array.isArray(data.nics) ? data.nics : data.nics ? [data.nics] : [],
        software: Array.isArray(data.software)
          ? data.software
          : data.software
            ? [data.software]
            : [],
        services: Array.isArray(data.services)
          ? data.services
          : data.services
            ? [data.services]
            : [],
        hotfixes: Array.isArray(data.hotfixes)
          ? data.hotfixes
          : data.hotfixes
            ? [data.hotfixes]
            : [],
        error: data.error || undefined,
      };
    } catch (err: any) {
      return {
        error: `Failed to parse WinRM inventory JSON: ${err.message}`,
      };
    }
  }

  private static normalizeExecError(err: any): string {
    const stderr = typeof err?.stderr === 'string' ? err.stderr.trim() : '';
    const stdout = typeof err?.stdout === 'string' ? err.stdout.trim() : '';
    const message = err?.message || String(err);

    if (stdout.includes('QS_WMI_JSON_BEGIN')) {
      const parsed = this.parseInventoryOutput(stdout);
      if (parsed.error) return parsed.error;
    }

    if (/ETIMEDOUT|timed out/i.test(message)) {
      return `WinRM scan timed out connecting to host. Check network reachability and WinRM ports 5985/5986.`;
    }
    if (stderr) return stderr.slice(0, 800);
    return message.slice(0, 800);
  }
}
