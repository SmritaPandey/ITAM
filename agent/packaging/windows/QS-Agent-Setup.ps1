#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Self-extracting / staging installer for QS Discovery Agent on Windows.

.DESCRIPTION
  Copies agent files to Program Files\QS-Discovery-Agent, downloads portable
  Node.js if missing, then installs a real Windows Service via
  install-windows-service.ps1 (NSSM or sc.exe).

  Use this when WiX / full MSI tooling is unavailable.

.PARAMETER SourceDir
  Folder containing qs-discovery-agent.js (defaults to agent/ two levels up).

.PARAMETER InstallDir
  Target install path. Default: %ProgramFiles%\QS-Discovery-Agent

.PARAMETER SkipService
  Copy files only; do not install the Windows Service.
#>
[CmdletBinding()]
param(
  [string]$SourceDir = "",
  [string]$InstallDir = (Join-Path ${env:ProgramFiles} "QS-Discovery-Agent"),
  [switch]$SkipService
)

$ErrorActionPreference = "Stop"
$NodeVersion = "v20.11.1"
$NodeZipName = "node-$NodeVersion-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/$NodeVersion/$NodeZipName"

function Test-IsAdmin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($id)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Write-Host ""
Write-Host "  =============================================="
Write-Host "   QS Discovery Agent Setup (Windows)"
Write-Host "  =============================================="
Write-Host ""

if (-not (Test-IsAdmin)) {
  Write-Host "  ERROR: Run PowerShell as Administrator."
  exit 1
}

if (-not $SourceDir) {
  $SourceDir = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
if (-not (Test-Path (Join-Path $SourceDir "qs-discovery-agent.js"))) {
  throw "SourceDir missing qs-discovery-agent.js: $SourceDir"
}

Write-Host "  Source : $SourceDir"
Write-Host "  Target : $InstallDir"
Write-Host ""

# ─── Stage files ─────────────────────────────────────────────
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

$copyNames = @(
  "qs-discovery-agent.js",
  "run-agent.bat",
  "Start Agent.bat",
  "launch-silent.vbs",
  "setup.html",
  "Status Dashboard.html",
  "QuickStart.txt",
  "install-service.bat",
  "config.json"
)

foreach ($name in $copyNames) {
  $src = Join-Path $SourceDir $name
  if (Test-Path $src) {
    Copy-Item -Path $src -Destination (Join-Path $InstallDir $name) -Force
  }
}

# Preserve existing config if already present at destination
$configSrc = Join-Path $SourceDir "config.json"
$configDst = Join-Path $InstallDir "config.json"
if ((Test-Path $configSrc) -and -not (Test-Path $configDst)) {
  Copy-Item $configSrc $configDst -Force
}

# Copy packaging helpers next to the install
$pkgWin = Join-Path $InstallDir "packaging\windows"
New-Item -ItemType Directory -Path $pkgWin -Force | Out-Null
Copy-Item (Join-Path $PSScriptRoot "install-windows-service.ps1") (Join-Path $pkgWin "install-windows-service.ps1") -Force
Copy-Item $PSCommandPath (Join-Path $pkgWin "QS-Agent-Setup.ps1") -Force -ErrorAction SilentlyContinue

Write-Host "  Staged agent files."

# ─── Portable Node if missing ────────────────────────────────
$nodeExe = $null
$sysNode = Get-Command node -ErrorAction SilentlyContinue
if ($sysNode) {
  $nodeExe = $sysNode.Source
  Write-Host "  Using system Node: $nodeExe"
} else {
  $portable = Join-Path $InstallDir ".node\node.exe"
  if (-not (Test-Path $portable)) {
    Write-Host "  Downloading portable Node.js $NodeVersion..."
    $zipPath = Join-Path $env:TEMP $NodeZipName
    $extractTo = Join-Path $env:TEMP "qs-node-extract"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $NodeUrl -OutFile $zipPath -UseBasicParsing
    if (Test-Path $extractTo) { Remove-Item $extractTo -Recurse -Force }
    Expand-Archive -Path $zipPath -DestinationPath $extractTo -Force
    $inner = Join-Path $extractTo "node-$NodeVersion-win-x64"
    $nodeDest = Join-Path $InstallDir ".node"
    if (Test-Path $nodeDest) { Remove-Item $nodeDest -Recurse -Force }
    Move-Item $inner $nodeDest
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    Remove-Item $extractTo -Recurse -Force -ErrorAction SilentlyContinue
  }
  if (-not (Test-Path (Join-Path $InstallDir ".node\node.exe"))) {
    throw "Failed to provision portable Node.js under $InstallDir\.node"
  }
  $nodeExe = Join-Path $InstallDir ".node\node.exe"
  Write-Host "  Portable Node ready: $nodeExe"
}

# ─── Install Windows Service ─────────────────────────────────
if (-not $SkipService) {
  $svcScript = Join-Path $PSScriptRoot "install-windows-service.ps1"
  if (-not (Test-Path $svcScript)) {
    $svcScript = Join-Path $InstallDir "packaging\windows\install-windows-service.ps1"
  }
  Write-Host "  Installing Windows Service..."
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $svcScript -InstallDir $InstallDir
  if ($LASTEXITCODE -ne 0) {
    throw "Service install failed."
  }
} else {
  Write-Host "  SkipService set — files copied only."
}

Write-Host ""
Write-Host "  Setup complete."
Write-Host "  Install path: $InstallDir"
if (-not (Test-Path (Join-Path $InstallDir "config.json"))) {
  Write-Host "  Next: open setup.html, save config.json into the install folder, then restart the service:"
  Write-Host "    Restart-Service QSDiscoveryAgent"
}
Write-Host ""
