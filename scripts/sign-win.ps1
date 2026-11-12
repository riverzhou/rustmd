# Authenticode signing for the Windows release executable.
#
# Default: a per-build self-signed certificate. It proves the file was not
# changed after signing, but it does NOT remove the SmartScreen "unknown
# publisher" warning. The public certificate is exported next to the build.
#
# Optional real certificate: set RUSTMD_WIN_CERT_BASE64 (base64 .pfx) and
# RUSTMD_WIN_CERT_PASSWORD. The script imports it and timestamps the signature.
#
# ASCII only: Windows PowerShell 5.1 reads UTF-8 without BOM as ANSI.
$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$version = (node -p "require('./package.json').version").Trim()
$release = Join-Path $root "release/$version"
New-Item -ItemType Directory -Force -Path $release | Out-Null

$exe = Join-Path $root 'target/release/rustmd.exe'
if (-not (Test-Path $exe)) {
  throw "missing $exe; run 'npx tauri build --no-bundle' first"
}
$productVersion = (Get-Item $exe).VersionInfo.ProductVersion
if ($productVersion -notlike "$version*") {
  throw "target/release/rustmd.exe reports '$productVersion', expected '$version'; run 'npx tauri build --no-bundle' again"
}

$isSelfSigned = $true
$cert = $null
$timestampServer = $null

if ($env:RUSTMD_WIN_CERT_BASE64) {
  Write-Host 'Using RUSTMD_WIN_CERT_BASE64 (real Authenticode certificate).'
  $tempDir = $env:RUNNER_TEMP
  if (-not $tempDir) { $tempDir = [IO.Path]::GetTempPath() }
  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
  $pfx = Join-Path $tempDir 'rustmd-sign.pfx'
  [IO.File]::WriteAllBytes($pfx, [Convert]::FromBase64String($env:RUSTMD_WIN_CERT_BASE64))
  try {
    $password = ''
    if ($env:RUSTMD_WIN_CERT_PASSWORD) { $password = $env:RUSTMD_WIN_CERT_PASSWORD }
    if ($password) {
      $secure = ConvertTo-SecureString $password -AsPlainText -Force
    } else {
      $secure = New-Object System.Security.SecureString
    }
    $imported = Import-PfxCertificate -FilePath $pfx -CertStoreLocation Cert:\CurrentUser\My -Password $secure
    $cert = @($imported) | Where-Object { $_.HasPrivateKey } | Select-Object -First 1
    if (-not $cert) { throw 'the imported PFX has no private key' }
    $isSelfSigned = $false
    $timestampServer = 'http://timestamp.digicert.com'
  } finally {
    Remove-Item $pfx -Force -ErrorAction SilentlyContinue
  }
} else {
  $subject = 'CN=rustmd Self-Signed (integrity only)'
  $cert = Get-ChildItem Cert:\CurrentUser\My |
    Where-Object {
      $_.Subject -eq $subject -and
      $_.HasPrivateKey -and
      $_.NotAfter -gt (Get-Date) -and
      ($_.EnhancedKeyUsageList.ObjectId -contains '1.3.6.1.5.5.7.3.3')
    } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1
  if (-not $cert) {
    Write-Host 'No self-signed certificate found; creating a 10-year code signing certificate...'
    $cert = New-SelfSignedCertificate `
      -Type CodeSigningCert `
      -Subject $subject `
      -CertStoreLocation Cert:\CurrentUser\My `
      -KeyExportPolicy Exportable `
      -HashAlgorithm SHA256 `
      -NotAfter (Get-Date).AddYears(10)
  }
  $cerPath = Join-Path $release 'rustmd-selfsigned.cer'
  Export-Certificate -Cert $cert -FilePath $cerPath -Force | Out-Null
  Write-Host "Public certificate: $cerPath"
  Write-Host "Certificate thumbprint: $($cert.Thumbprint)"
}

$params = @{
  FilePath = $exe
  Certificate = $cert
  HashAlgorithm = 'SHA256'
}
if ($timestampServer) { $params.TimestampServer = $timestampServer }

$signature = Set-AuthenticodeSignature @params
Write-Host "Signed: $(Split-Path $exe -Leaf) [$($signature.Status)]"
if ($signature.Status -in @('HashMismatch', 'NotSigned')) {
  throw "signing failed: $($signature.Status) $($signature.StatusMessage)"
}

$verified = Get-AuthenticodeSignature $exe
Write-Host "Verified status: $($verified.Status)"
if ($verified.Status -in @('HashMismatch', 'NotSigned')) {
  throw "signature verification failed: $($verified.Status)"
}
if ($isSelfSigned) {
  Write-Host 'Self-signed: integrity only; SmartScreen will still warn on other machines.'
}
