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
$productVersion = (Get-Item $exe).VersionInfo.ProductVersion
# Exact match, not a prefix: "1.10.30" must not sign an intended 1.10.3 release.
# ProductVersion may carry a trailing space or "+<sha>" suffix.
$productBase = $productVersion.Trim()
if ($productBase.Contains(' ')) { $productBase = $productBase.Split(' ')[0] }
if ($productBase.Contains('+')) { $productBase = $productBase.Split('+')[0] }
if ($productBase -ne $version) {
  throw "target/release/rustmd.exe reports '$productVersion', expected '$version'; run 'npx tauri build --no-bundle' again"
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
# README.md links to CHANGELOG.md, docs/*.md and docs/screenshots/*.png.
# Ship those files so the offline README does not contain dead links.
foreach ($doc in @('README.en.md', 'CHANGELOG.md', 'AUDIT_REPORT.md', 'AGENTS.md', 'LINUX_BUILD.md')) {
  $path = Join-Path $root $doc
  if (Test-Path $path) { Copy-Item $path (Join-Path $green $doc) }
}
$docs = Join-Path $root 'docs'
if (Test-Path $docs) {
  Copy-Item $docs (Join-Path $green 'docs') -Recurse
}
# GitHub-only promo artwork is not needed in the portable zip (the README GIF is).
foreach ($promo in @('docs/social-preview.png', 'docs/social-preview.html')) {
  $promoPath = Join-Path $green $promo
  if (Test-Path $promoPath) { Remove-Item $promoPath -Force }
}
# docs/PROMOTION.md links to the package-manager README; ship it so the
# offline docs have no dead relative links.
$packagingReadme = Join-Path $root 'packaging/README.md'
if (Test-Path $packagingReadme) {
  $greenPackaging = Join-Path $green 'packaging'
  New-Item -ItemType Directory -Force -Path $greenPackaging | Out-Null
  Copy-Item $packagingReadme (Join-Path $greenPackaging 'README.md')
}
# README/RELEASING link the CI/release workflow files; ship them so the
# offline copy has no dead repository links.
$workflows = Join-Path $root '.github/workflows'
if (Test-Path $workflows) {
  $greenWorkflows = Join-Path $green '.github/workflows'
  New-Item -ItemType Directory -Force -Path $greenWorkflows | Out-Null
  Copy-Item (Join-Path $workflows '*.yml') $greenWorkflows
}

$cert = Join-Path $release 'rustmd-selfsigned.cer'
$certIncluded = $false
if (Test-Path $cert) {
  Copy-Item $cert (Join-Path $green 'rustmd-selfsigned.cer')
  $certIncluded = $true
}

# Compress-Archive (PowerShell 5.1 / .NET Framework) stores entry names with
# backslashes, which `unzip`, macOS Archive Utility and Python zipfile turn into
# flat filenames like `dir\file`. Build the archive explicitly with `/`
# separators so the documented directory tree survives on every OS.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path $zip) { Remove-Item $zip -Force }
$greenFull = (Resolve-Path $green).Path
$archive = [IO.Compression.ZipFile]::Open($zip, 'Create')
try {
  Get-ChildItem -LiteralPath $green -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($greenFull.Length + 1).Replace('\', '/')
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $archive, $_.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
  }
} finally {
  $archive.Dispose()
}

$archive = [IO.Compression.ZipFile]::OpenRead($zip)
try {
  $names = @($archive.Entries | ForEach-Object FullName)
  $required = @(
    'rustmd.exe',
    'README.md',
    'README.en.md',
    'LICENSE',
    'SECURITY.md',
    'CHANGELOG.md',
    'docs/screenshots/overview.png',
    'docs/ARCHITECTURE.md',
    'docs/PROMOTION.md',
    'packaging/README.md',
    '.github/workflows/ci.yml',
    '.github/workflows/release.yml'
  )
  foreach ($entry in $required) {
    if ($names -notcontains $entry) { throw "$entry missing in zip" }
  }
  $screenshots = @($names | Where-Object { $_ -like 'docs/screenshots/*.png' })
  if ($screenshots.Count -lt 20) {
    throw "expected at least 20 screenshots in the zip, found $($screenshots.Count)"
  }
  if ($certIncluded -and ($names -notcontains 'rustmd-selfsigned.cer')) {
    throw 'rustmd-selfsigned.cer was signed but is missing from the zip'
  }
  if ($names -match '\\') {
    throw 'zip entries must use forward slashes (portable across unzip/macOS)'
  }
  if ($names -match 'rustmd-tmp') { throw 'temporary files leaked into the zip' }
  Write-Host "zip entries: $($names.Count)"
} finally {
  $archive.Dispose()
}

$hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
# LF, not CRLF: sha256sum -c treats a trailing CR as part of the filename.
[IO.File]::WriteAllText("$zip.sha256", "$hash  $(Split-Path $zip -Leaf)`n", [Text.Encoding]::ASCII)

$item = Get-Item $zip
Write-Host "zip: $($item.FullName)"
Write-Host "bytes: $($item.Length)"
Write-Host "sha256: $hash"
