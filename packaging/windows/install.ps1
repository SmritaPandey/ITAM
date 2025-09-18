Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Base = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'OnPremAsset'
Push-Location $Base
New-Item -ItemType Directory -Force -Path data | Out-Null
New-Item -ItemType Directory -Force -Path logs | Out-Null

Write-Host 'Installing service...'
& .\OnPremAsset.exe install
& .\OnPremAsset.exe start
Pop-Location

Write-Host 'Installed. Service name: OnPremAsset. Open http://localhost:8080/'

