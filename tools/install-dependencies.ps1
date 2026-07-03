$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

& "$PSScriptRoot\ensure-environment.ps1"

$env:npm_config_registry = "https://registry.npmmirror.com"
$env:npm_config_fetch_retries = "5"
$env:npm_config_fetch_retry_mintimeout = "20000"
$env:npm_config_fetch_retry_maxtimeout = "120000"

Write-Host "Installing workspace dependencies..."
npm install

Write-Host "Installing backend dependencies..."
npm install --prefix backend

Write-Host "Installing frontend dependencies..."
npm install --prefix frontend

Write-Host "All dependencies installed."
