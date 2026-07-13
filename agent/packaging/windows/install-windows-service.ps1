#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Install QS Discovery Agent as a real Windows Service (boot-level, Automatic).

.DESCRIPTION
  Prefers NSSM (Non-Sucking Service Manager) when available; otherwise uses
  sc.exe with node.exe as the service binary wrapper.

  Sets:
    - Start type: Automatic (boot)
    - Working directory
    - Failure recovery: restart after 5s / 10s / 30s

.PARAMETER InstallDir
  Agent install directory (contains qs-discovery-agent.js). Defaults to repo agent/ or Program Files.

.PARAMETER ServiceName
  Windows service name. Default: QSDiscoveryAgent

.PARAMETER Uninstall
  Remove the service instead of installing.
#>
[CmdletBinding()]
param(
  [string]$InstallDir = "",
  [string]$ServiceName = "QSDiscoveryAgent",
  [string]$DisplayName = "QS Discovery Agent",
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$NodeVersion = "v20.11.1"

function Write-Banner {
  Write-Host ""
  Write-Host "  =============================================="
  Write-Host "   QS Discovery Agent — Windows Service Install"
  Write-Host "  =============================================="
  Write-Host ""
}

function Test-IsAdmin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Resolve-InstallDir {
  param([string]$Hint)
  if ($Hint -and (Test-Path (Join-Path $Hint "qs-discovery-agent.js"))) {
    return (Resolve-Path $Hint).Path
  }
  # packaging/windows -> packaging -> agent
  $agentRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..") -ErrorAction SilentlyContinue
  if ($agentRoot -and (Test-Path (Join-Path $agentRoot "qs-discovery-agent.js"))) {
    return $agentRoot.Path
  }
  $pf = Join-Path ${env:ProgramFiles} "QS-Discovery-Agent"
  if (Test-Path (Join-Path $pf "qs-discovery-agent.js")) {
    return $pf
  }
  throw "Could not find qs-discovery-agent.js. Pass -InstallDir to the agent folder."
}

function Find-Node {
  param([string]$Dir)
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $portable = Join-Path $Dir ".node\node.exe"
  if (Test-Path $portable) { return $portable }
  $pfNode = Join-Path ${env:ProgramFiles} "QS-Discovery-Agent\.node\node.exe"
  if (Test-Path $pfNode) { return $pfNode }
  return $null
}

function Find-Nssm {
  $cmd = Get-Command nssm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $candidates = @(
    (Join-Path $PSScriptRoot "nssm.exe"),
    (Join-Path ${env:ProgramFiles} "nssm\nssm.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "nssm\nssm.exe"),
    "C:\Tools\nssm\nssm.exe"
  )
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  return $null
}

function Remove-ExistingService {
  param([string]$Name)
  $svc = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if (-not $svc) { return }
  Write-Host "  Stopping existing service '$Name'..."
  if ($svc.Status -ne "Stopped") {
    Stop-Service -Name $Name -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  $nssm = Find-Nssm
  if ($nssm) {
    & $nssm remove $Name confirm 2>$null | Out-Null
  }
  sc.exe delete $Name | Out-Null
  Start-Sleep -Seconds 1
}

function Set-ServiceRecovery {
  param([string]$Name)
  # reset=86400 (1 day), actions: restart/5000, restart/10000, restart/30000
  sc.exe failure $Name reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null
  sc.exe failureflag $Name 1 | Out-Null
}

function Install-WithNssm {
  param(
    [string]$NssmPath,
    [string]$Name,
    [string]$Display,
    [string]$NodeExe,
    [string]$AgentJs,
    [string]$WorkDir
  )
  Write-Host "  Using NSSM: $NssmPath"
  & $NssmPath install $Name $NodeExe $AgentJs
  if ($LASTEXITCODE -ne 0) { throw "NSSM install failed (exit $LASTEXITCODE)" }

  & $NssmPath set $Name AppDirectory $WorkDir | Out-Null
  & $NssmPath set $Name DisplayName $Display | Out-Null
  & $NssmPath set $Name Description "QS Discovery Agent — reports hardware/OS inventory to the QS Asset server" | Out-Null
  & $NssmPath set $Name Start SERVICE_AUTO_START | Out-Null
  & $NssmPath set $Name AppStdout (Join-Path $WorkDir "agent-service.log") | Out-Null
  & $NssmPath set $Name AppStderr (Join-Path $WorkDir "agent-service-error.log") | Out-Null
  & $NssmPath set $Name AppRotateFiles 1 | Out-Null
  & $NssmPath set $Name AppExit Default Restart | Out-Null
  & $NssmPath set $Name AppRestartDelay 5000 | Out-Null

  Set-ServiceRecovery -Name $Name
  Start-Service -Name $Name
}

function Install-WithSc {
  param(
    [string]$Name,
    [string]$Display,
    [string]$NodeExe,
    [string]$AgentJs,
    [string]$WorkDir
  )
  Write-Host "  Using sc.exe + node (NSSM not found)"
  # Quote paths for spaces in Program Files
  $binPath = "`"$NodeExe`" `"$AgentJs`""
  sc.exe create $Name binPath= $binPath DisplayName= "$Display" start= auto | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "sc.exe create failed (exit $LASTEXITCODE). Install NSSM for more reliable Node services."
  }
  sc.exe description $Name "QS Discovery Agent — reports hardware/OS inventory to the QS Asset server" | Out-Null
  # AppDirectory is not native to sc; set via registry for Type=own process services
  $regPath = "HKLM:\SYSTEM\CurrentControlSet\Services\$Name"
  if (Test-Path $regPath) {
    New-ItemProperty -Path $regPath -Name "AppDirectory" -Value $WorkDir -PropertyType String -Force | Out-Null
  }
  Set-ServiceRecovery -Name $Name

  # Working directory for node: use a thin wrapper cmd if needed
  $wrapper = Join-Path $WorkDir "service-run.cmd"
  @"
@echo off
cd /d "$WorkDir"
"$NodeExe" "$AgentJs"
"@ | Set-Content -Path $wrapper -Encoding ASCII

  sc.exe config $Name binPath= "`"$wrapper`"" | Out-Null
  Start-Service -Name $Name -ErrorAction SilentlyContinue
  if ((Get-Service -Name $Name).Status -ne "Running") {
    Write-Host "  Starting via sc.exe start..."
    sc.exe start $Name | Out-Null
  }
}

# ─── Main ────────────────────────────────────────────────────
Write-Banner

if (-not (Test-IsAdmin)) {
  Write-Host "  ERROR: Administrator privileges required."
  Write-Host "  Right-click PowerShell → Run as administrator, then re-run this script."
  exit 1
}

if ($Uninstall) {
  Write-Host "  Uninstalling service '$ServiceName'..."
  Remove-ExistingService -Name $ServiceName
  Write-Host "  Done."
  exit 0
}

$InstallDir = Resolve-InstallDir -Hint $InstallDir
$agentJs = Join-Path $InstallDir "qs-discovery-agent.js"
if (-not (Test-Path $agentJs)) {
  throw "Missing agent script: $agentJs"
}

$nodeExe = Find-Node -Dir $InstallDir
if (-not $nodeExe) {
  Write-Host "  Node.js not found. Run QS-Agent-Setup.ps1 first, or install Node 18+."
  exit 1
}

Write-Host "  Install dir : $InstallDir"
Write-Host "  Node        : $nodeExe"
Write-Host "  Service     : $ServiceName"
Write-Host ""

Remove-ExistingService -Name $ServiceName

$nssm = Find-Nssm
if ($nssm) {
  Install-WithNssm -NssmPath $nssm -Name $ServiceName -Display $DisplayName `
    -NodeExe $nodeExe -AgentJs $agentJs -WorkDir $InstallDir
} else {
  Install-WithSc -Name $ServiceName -Display $DisplayName `
    -NodeExe $nodeExe -AgentJs $agentJs -WorkDir $InstallDir
}

$final = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
Write-Host ""
if ($final -and $final.Status -eq "Running") {
  Write-Host "  OK: Service installed and running (start=Automatic, recovery=restart)."
} elseif ($final) {
  Write-Host "  WARN: Service installed but status=$($final.Status). Check Event Viewer / agent-service-error.log"
} else {
  Write-Host "  ERROR: Service was not created."
  exit 1
}
Write-Host "  Logs: $InstallDir\agent-service.log"
Write-Host ""
