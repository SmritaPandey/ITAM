<#
.SYNOPSIS
  Stage QS Discovery Agent for MSI packaging (WiX) or produce a file tree for QS-Agent-Setup.ps1.

.DESCRIPTION
  If WiX Toolset (candle/light) is on PATH, builds a minimal MSI.
  Otherwise stages files under dist/windows/stage and prints instructions
  to run QS-Agent-Setup.ps1 as the self-extracting installer path.

.PARAMETER Configuration
  Output label (default: Release)

.PARAMETER OutDir
  Staging / MSI output directory. Default: agent/packaging/windows/dist
#>
[CmdletBinding()]
param(
  [string]$Configuration = "Release",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
$AgentRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Version = "2.0.0"
$ProductName = "QS Discovery Agent"
$Manufacturer = "QS"

if (-not $OutDir) {
  $OutDir = Join-Path $PSScriptRoot "dist"
}

$StageDir = Join-Path $OutDir "stage\QS-Discovery-Agent"
$MsiOut = Join-Path $OutDir "QS-Discovery-Agent-$Version.msi"

Write-Host ""
Write-Host "  =============================================="
Write-Host "   QS Discovery Agent — MSI / stage builder"
Write-Host "  =============================================="
Write-Host ""
Write-Host "  Agent root : $AgentRoot"
Write-Host "  Stage dir  : $StageDir"
Write-Host ""

# ─── Stage payload ───────────────────────────────────────────
if (Test-Path $StageDir) { Remove-Item $StageDir -Recurse -Force }
New-Item -ItemType Directory -Path $StageDir -Force | Out-Null

$files = @(
  "qs-discovery-agent.js",
  "run-agent.bat",
  "Start Agent.bat",
  "launch-silent.vbs",
  "setup.html",
  "Status Dashboard.html",
  "QuickStart.txt",
  "install-service.bat"
)
foreach ($f in $files) {
  $src = Join-Path $AgentRoot $f
  if (Test-Path $src) {
    Copy-Item $src (Join-Path $StageDir $f) -Force
  }
}

$pkgDest = Join-Path $StageDir "packaging\windows"
New-Item -ItemType Directory -Path $pkgDest -Force | Out-Null
Copy-Item (Join-Path $PSScriptRoot "install-windows-service.ps1") $pkgDest -Force
Copy-Item (Join-Path $PSScriptRoot "QS-Agent-Setup.ps1") $pkgDest -Force

Write-Host "  Staged files to: $StageDir"

# ─── Try WiX ─────────────────────────────────────────────────
$candle = Get-Command candle -ErrorAction SilentlyContinue
$light = Get-Command light -ErrorAction SilentlyContinue

if (-not $candle -or -not $light) {
  Write-Host ""
  Write-Host "  WiX Toolset (candle/light) not found on PATH."
  Write-Host "  Staging complete. Use the self-extracting installer instead:"
  Write-Host ""
  Write-Host "    powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\QS-Agent-Setup.ps1`" -SourceDir `"$StageDir`""
  Write-Host ""
  Write-Host "  Or install WiX v3+ from https://wixtoolset.org/ and re-run this script."
  Write-Host "  Stage tree is ready for heat.exe / candle / light if you add a .wxs later."
  Write-Host ""
  exit 0
}

# Minimal WiX source (per-machine, ProgramFiles)
$wxsPath = Join-Path $OutDir "QSDiscoveryAgent.wxs"
$stageEscaped = $StageDir -replace '\\', '\\'

$wxs = @"
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" Name="$ProductName" Language="1033" Version="$Version.0"
           Manufacturer="$Manufacturer" UpgradeCode="A1B2C3D4-E5F6-7890-ABCD-EF1234567890">
    <Package InstallerVersion="500" Compressed="yes" InstallScope="perMachine" />
    <MajorUpgrade DowngradeErrorMessage="A newer version is already installed." />
    <MediaTemplate EmbedCab="yes" />
    <Feature Id="ProductFeature" Title="$ProductName" Level="1">
      <ComponentGroupRef Id="ProductComponents" />
    </Feature>
  </Product>
  <Fragment>
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFilesFolder">
        <Directory Id="INSTALLFOLDER" Name="QS-Discovery-Agent" />
      </Directory>
    </Directory>
  </Fragment>
  <Fragment>
    <ComponentGroup Id="ProductComponents" Directory="INSTALLFOLDER">
      <Component Id="AgentJs" Guid="B1B2C3D4-E5F6-7890-ABCD-EF1234567891">
        <File Id="QsDiscoveryAgentJs" Source="$StageDir\qs-discovery-agent.js" KeyPath="yes" />
      </Component>
      <Component Id="InstallServiceBat" Guid="B1B2C3D4-E5F6-7890-ABCD-EF1234567892">
        <File Id="InstallServiceBat" Source="$StageDir\install-service.bat" />
      </Component>
      <Component Id="RunAgentBat" Guid="B1B2C3D4-E5F6-7890-ABCD-EF1234567893">
        <File Id="RunAgentBat" Source="$StageDir\run-agent.bat" />
      </Component>
      <Component Id="LaunchSilent" Guid="B1B2C3D4-E5F6-7890-ABCD-EF1234567894">
        <File Id="LaunchSilentVbs" Source="$StageDir\launch-silent.vbs" />
      </Component>
    </ComponentGroup>
  </Fragment>
</Wix>
"@

Set-Content -Path $wxsPath -Value $wxs -Encoding UTF8
Write-Host "  Compiling WiX: $wxsPath"

Push-Location $OutDir
try {
  & candle.exe -nologo "QSDiscoveryAgent.wxs" -out "QSDiscoveryAgent.wixobj"
  if ($LASTEXITCODE -ne 0) { throw "candle failed" }
  & light.exe -nologo "QSDiscoveryAgent.wixobj" -out $MsiOut
  if ($LASTEXITCODE -ne 0) { throw "light failed" }
  Write-Host "  MSI built: $MsiOut"
  Write-Host "  Note: MSI copies core files; run install-windows-service.ps1 post-install for the service."
} finally {
  Pop-Location
}
Write-Host ""
