#Requires -Version 5.1
# DEPRECATED (v3.0.0+): Smiley.Native is no longer shipped in releases.
# Local development only — do not use for publishing.
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\Smiley.Native"

Write-Host "==> Restoring..."
dotnet restore

Write-Host "==> Building Release..."
dotnet build -c Release

$Rid = if ($args[0]) { $args[0] } else { "win-x64" }
$Out = Join-Path $PSScriptRoot "dist-native\$Rid"

Write-Host "==> Publishing $Rid (trimmed, single-file)..."
dotnet publish -c Release -r $Rid --self-contained true `
  -p:PublishTrimmed=true `
  -p:PublishSingleFile=true `
  -p:EnableCompressionInSingleFile=true `
  -o $Out

Write-Host ""
Write-Host "Done! Output: $Out"
Get-ChildItem $Out -File | Select-Object Name, @{N='MB';E={[math]::Round($_.Length/1MB,1)}}
