# Build the Windows "green" portable zip:
#   release/<version>/rustmd-<version>-win-x64-portable.zip
# Layout inside the zip: rustmd-<version>-win-x64/{rustmd.exe,README.md,...}
# Run after build + sign. ASCII only for Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$version = (node -p "require('./package.json').version").Trim()
if (-not $version) { throw 'cannot read package.json version' }

$release = Join-Path $root "release/$version"
$source = Join-Path $root 'target/release'
$exe = Join-Path $source 'rustmd.exe'
if (-not (Test-Path $exe)) {
  throw "missing $exe; run 'npx tauri build --no-bundle' first"
}

$greenName = "rustmd-$version-win-x64"
$green = Join-Path $release $greenName
$zip = Join-Path $release "$greenName-portable.zip"

if (Test-Path $green) { Remove-Item $green -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }
if (Test-Path "$zip.sha256") { Remove-Item "$zip.sha256" -Force }
New-Item -ItemType Directory -Force -Path $green | Out-Null

Copy-Item $exe (Join-Path $green 'rustmd.exe')
Copy-Item (Join-Path $root 'README.md') (Join-Path $green 'README.md')
if (Test-Path (Join-Path $root 'LICENSE')) {
  Copy-Item (Join-Path $root 'LICENSE') (Join-Path $green 'LICENSE')
}
if (Test-Path (Join-Path $root 'docs/SECURITY.md')) {
  Copy-Item (Join-Path $root 'docs/SECURITY.md') (Join-Path $green 'SECURITY.md')
}

$cert = Join-Path $release 'rustmd-selfsigned.cer'
if (Test-Path $cert) {
  Copy-Item $cert (Join-Path $green 'rustmd-selfsigned.cer')
}

Compress-Archive -Path $green -DestinationPath $zip -CompressionLevel Optimal

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zip)
try {
  $names = @($archive.Entries | ForEach-Object FullName)
  if (-not ($names -match '(^|[\\/])rustmd\.exe$')) { throw 'rustmd.exe missing in zip' }
  if (-not ($names -match '(^|[\\/])README\.md$')) { throw 'README.md missing in zip' }
  if ($names -match 'rustmd-tmp') { throw 'temporary files leaked into the zip' }
  Write-Host "zip entries: $($names.Count)"
} finally {
  $archive.Dispose()
}

$hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
"$hash  $(Split-Path $zip -Leaf)" | Out-File -FilePath "$zip.sha256" -Encoding ascii

$item = Get-Item $zip
Write-Host "zip: $($item.FullName)"
Write-Host "bytes: $($item.Length)"
Write-Host "sha256: $hash"
