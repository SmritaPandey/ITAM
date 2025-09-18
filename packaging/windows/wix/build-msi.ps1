Param(
  [string]$CandleExe = "candle.exe",
  [string]$LightExe = "light.exe",
  [string]$HeatExe = "heat.exe"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Resolve-Path "$PSScriptRoot/../../.."
$BundleRoot = Join-Path $Root 'dist-bundle-windows/OnPremAsset'
$WixOut = Join-Path $PSScriptRoot 'obj'
New-Item -ItemType Directory -Force -Path $WixOut | Out-Null

Write-Host 'Harvesting files...'
& $HeatExe dir "$BundleRoot" -gg -sreg -sfrag -srd -dr INSTALLDIR -cg OnPremAssetGroup -out (Join-Path $WixOut 'harvest.wxs')

Write-Host 'Compiling WiX...'
& $CandleExe -o (Join-Path $WixOut '\') (Join-Path $PSScriptRoot 'Product.wxs') (Join-Path $WixOut 'harvest.wxs')

Write-Host 'Linking MSI...'
$MsiOut = Join-Path $Root 'onprem-asset-setup.msi'
& $LightExe -o $MsiOut (Join-Path $WixOut 'Product.wixobj') (Join-Path $WixOut 'harvest.wixobj')
Write-Host "MSI created: $MsiOut"

