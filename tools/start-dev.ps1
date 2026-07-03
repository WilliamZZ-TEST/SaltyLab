$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

& "$PSScriptRoot\ensure-environment.ps1"

if (-not (Test-Path "$root\node_modules")) {
  & "$PSScriptRoot\install-dependencies.ps1"
}

npm run dev
