Param(
  [string]$PythonExe = "python",
  [string]$NodeExe = "npm",
  [string]$WinSWUrl = "https://github.com/winsw/winsw/releases/download/v3.0.0/WinSW-x64.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Resolve-Path "$PSScriptRoot/../.."
$BundleDir = Join-Path $Root 'dist-bundle-windows'
Remove-Item -Recurse -Force $BundleDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $BundleDir | Out-Null

Write-Host 'Building frontend...'
Push-Location (Join-Path $Root 'frontend')
& $NodeExe ci --no-audit --no-fund
& $NodeExe run build
Pop-Location

Write-Host 'Preparing backend venv...'
$BackendDir = Join-Path $Root 'backend'
Push-Location $BackendDir
& $PythonExe -m venv .venv
& (Join-Path $BackendDir '.venv/Scripts/python.exe') -m pip install --no-cache-dir -r requirements.txt
Pop-Location

Write-Host 'Downloading WinSW...'
$WinSWDest = Join-Path $BundleDir 'OnPremAsset.exe'
Invoke-WebRequest -Uri $WinSWUrl -OutFile $WinSWDest

Write-Host 'Assembling bundle...'
$OutAppDir = Join-Path $BundleDir 'OnPremAsset'
New-Item -ItemType Directory -Force -Path $OutAppDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root 'backend') (Join-Path $OutAppDir 'backend')
Copy-Item -Recurse -Force (Join-Path $Root 'backend/frontend-dist') (Join-Path $OutAppDir 'backend/frontend-dist') -ErrorAction SilentlyContinue
Copy-Item -Force (Join-Path $PSScriptRoot 'OnPremAsset.xml') (Join-Path $OutAppDir 'OnPremAsset.xml')
Copy-Item -Force (Join-Path $PSScriptRoot 'run-backend.bat') (Join-Path $OutAppDir 'run-backend.bat')
Copy-Item -Force $WinSWDest (Join-Path $OutAppDir 'OnPremAsset.exe')
Copy-Item -Force (Join-Path $PSScriptRoot 'install.ps1') (Join-Path $BundleDir 'install.ps1')

"On-Prem Asset Management - Windows Offline Bundle`n`nInstall:`n  1) Extract zip`n  2) Run PowerShell as Administrator`n  3) .\\install.ps1`n`nThen open http://localhost:8080/" |
  Set-Content (Join-Path $BundleDir 'README.txt')

Write-Host 'Creating zip...'
$zipPath = Join-Path $Root 'onprem-asset-windows-offline.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $BundleDir '*') -DestinationPath $zipPath -Force
Write-Host "Bundle created: $zipPath"

