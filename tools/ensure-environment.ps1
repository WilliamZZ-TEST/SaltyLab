$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $root "runtime"
$downloadsDir = Join-Path $runtimeDir "downloads"
$nodeVersion = "v24.18.0"
$nodeFolderName = "node-$nodeVersion-win-x64"
$nodeZipName = "$nodeFolderName.zip"
$nodeZipPath = Join-Path $downloadsDir $nodeZipName
$nodeDir = Join-Path $runtimeDir $nodeFolderName
$nodeExe = Join-Path $nodeDir "node.exe"
$npmCmd = Join-Path $nodeDir "npm.cmd"
$downloadUrls = @(
  "https://nodejs.org/dist/latest-v24.x/$nodeZipName",
  "https://nodejs.org/dist/$nodeVersion/$nodeZipName",
  "https://npmmirror.com/mirrors/node/latest-v24.x/$nodeZipName",
  "https://npmmirror.com/mirrors/node/$nodeVersion/$nodeZipName"
)

function Initialize-NetworkDefaults {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
  [System.Net.WebRequest]::DefaultWebProxy.Credentials = [System.Net.CredentialCache]::DefaultCredentials
}

function Get-SystemNodeMajor {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return $null }
  $version = (& node -v).TrimStart("v")
  return [int]($version.Split(".")[0])
}

function Use-PortableNode {
  if ((Test-Path $nodeExe) -and (Test-Path $npmCmd)) {
    $env:Path = "$nodeDir;$env:Path"
    Write-Host "Using portable Node.js: $(& $nodeExe -v)"
    Write-Host "npm: $(& $npmCmd -v)"
    return $true
  }
  return $false
}

function Use-BundledCodexNode {
  $runtimeRoot = Join-Path $env:LOCALAPPDATA "OpenAI\Codex\runtimes"
  if (-not (Test-Path $runtimeRoot)) {
    return $false
  }

  $candidates = Get-ChildItem -Path $runtimeRoot -Recurse -Filter node.exe -ErrorAction SilentlyContinue
  foreach ($candidate in $candidates) {
    $candidateDir = Split-Path -Parent $candidate.FullName
    $candidateNpm = Join-Path $candidateDir "npm.cmd"
    if (-not (Test-Path $candidateNpm)) {
      continue
    }

    $versionText = (& $candidate.FullName -v).TrimStart("v")
    $major = [int]($versionText.Split(".")[0])
    if ($major -ge 24) {
      $env:Path = "$candidateDir;$env:Path"
      Write-Host "Using bundled Codex Node.js: $(& $candidate.FullName -v)"
      Write-Host "npm: $(& $candidateNpm -v)"
      return $true
    }
  }

  return $false
}

New-Item -ItemType Directory -Force -Path $runtimeDir, $downloadsDir | Out-Null

if (Use-PortableNode) {
  exit 0
}

if (Use-BundledCodexNode) {
  exit 0
}

$major = Get-SystemNodeMajor
if ($major -ge 24) {
  Write-Host "Using system Node.js: $(node -v)"
  Write-Host "npm: $(npm -v)"
  exit 0
}

if (Test-Path $nodeZipPath) {
  Write-Host "Extracting portable Node.js from $nodeZipPath"
  Expand-Archive -LiteralPath $nodeZipPath -DestinationPath $runtimeDir -Force
  if (Use-PortableNode) {
    exit 0
  }
}

Initialize-NetworkDefaults
foreach ($url in $downloadUrls) {
  try {
    Write-Host "Downloading Node.js from $url"
    Invoke-WebRequest -Uri $url -OutFile $nodeZipPath -UseBasicParsing -TimeoutSec 120
    if ((Test-Path $nodeZipPath) -and ((Get-Item $nodeZipPath).Length -gt 10000000)) {
      Write-Host "Download complete: $nodeZipPath"
      Expand-Archive -LiteralPath $nodeZipPath -DestinationPath $runtimeDir -Force
      if (Use-PortableNode) {
        exit 0
      }
    }
  } catch {
    Write-Host "Download failed: $($_.Exception.Message)"
    if (Test-Path $nodeZipPath) {
      Remove-Item -LiteralPath $nodeZipPath -Force
    }
  }
}

Write-Host "Node.js 24+ is required and was not found."
Write-Host "Current project can use a portable Node.js zip without system installation."
Write-Host ""
Write-Host "Automatic download failed. Download one of these files manually:"
foreach ($url in $downloadUrls) {
  Write-Host $url
}
Write-Host ""
Write-Host "Save it here:"
Write-Host $nodeZipPath
Write-Host ""
Write-Host "Then run:"
Write-Host "powershell -ExecutionPolicy Bypass -File tools\ensure-environment.ps1"
exit 1
