$ErrorActionPreference = "Stop"

$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue

if (-not $node) {
  throw "Node.js was not found in PATH. Run tools\\install-node-lts.ps1 first."
}

if (-not $npm) {
  throw "npm was not found in PATH. Reinstall Node.js LTS from https://nodejs.org/en/download."
}

$nodeVersion = (& node -v).Trim()
$npmVersion = (& npm -v).Trim()
$major = [int]($nodeVersion.TrimStart("v").Split(".")[0])

if ($major -lt 24) {
  throw "Node.js $nodeVersion is too old. This project uses node:sqlite and requires Node.js 24 or newer."
}

Write-Host "Environment OK"
Write-Host "Node.js: $nodeVersion"
Write-Host "npm: $npmVersion"
