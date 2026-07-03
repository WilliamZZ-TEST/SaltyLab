$ErrorActionPreference = "Stop"

function Get-NodeMajorVersion {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) {
    return $null
  }

  $versionText = (& node -v).TrimStart("v")
  return [int]($versionText.Split(".")[0])
}

$major = Get-NodeMajorVersion
if ($major -ge 24) {
  Write-Host "Node.js is already installed and compatible: $(node -v)"
  Write-Host "npm: $(npm -v)"
  exit 0
}

$winget = Get-Command winget -ErrorAction SilentlyContinue
if (-not $winget) {
  Write-Host "winget was not found."
  Write-Host "Install Node.js LTS manually from https://nodejs.org/en/download, then run tools\\verify-environment.ps1."
  exit 1
}

Write-Host "Installing Node.js LTS with winget..."
winget install OpenJS.NodeJS.LTS --source winget --accept-package-agreements --accept-source-agreements

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

$major = Get-NodeMajorVersion
if ($major -lt 24) {
  Write-Host "Node.js was installed, but this project requires Node.js 24 or newer."
  Write-Host "Current node: $(node -v)"
  exit 1
}

Write-Host "Node.js installation complete: $(node -v)"
Write-Host "npm: $(npm -v)"
