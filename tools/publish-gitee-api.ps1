param(
  [Parameter(Mandatory=$true)][string]$Owner,
  [string]$Repo = "SaltyLab",
  [string]$Token = $env:GITEE_TOKEN,
  [string]$Branch = "master"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not $Token) {
  throw "Missing Gitee token. Pass -Token or set GITEE_TOKEN."
}

function Invoke-GiteeJson {
  param([string]$Method, [string]$Uri, $Body = $null)
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri
  }
  return Invoke-RestMethod -Method $Method -Uri $Uri -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 20)
}

$encodedOwner = [uri]::EscapeDataString($Owner)
$encodedRepo = [uri]::EscapeDataString($Repo)

try {
  Invoke-GiteeJson GET "https://gitee.com/api/v5/repos/$encodedOwner/$encodedRepo?access_token=$Token" | Out-Null
  Write-Host "Gitee repo exists: $Owner/$Repo"
} catch {
  Write-Host "Creating Gitee repo: $Owner/$Repo"
  Invoke-GiteeJson POST "https://gitee.com/api/v5/user/repos" @{
    access_token = $Token
    name = $Repo
    private = $false
    has_issues = $true
    has_wiki = $false
    auto_init = $true
  } | Out-Null
  Start-Sleep -Seconds 2
}

$skip = @(
  "\\runtime\\",
  "\\node_modules\\",
  "\\.git\\",
  "\\dist\\"
)

$files = Get-ChildItem -Path $Root -Recurse -File | Where-Object {
  $full = $_.FullName
  foreach ($pattern in $skip) {
    if ($full -like "*$pattern*") { return $false }
  }
  if ($_.Name -like "*.sqlite*" -or $_.Name -eq ".DS_Store") { return $false }
  return $true
}

foreach ($file in $files) {
  $rootPrefix = (Resolve-Path $Root).Path.TrimEnd("\") + "\"
  $relative = $file.FullName.Substring($rootPrefix.Length).Replace("\", "/")
  $content = [Convert]::ToBase64String([IO.File]::ReadAllBytes($file.FullName))
  $pathEncoded = [uri]::EscapeDataString($relative)
  $uri = "https://gitee.com/api/v5/repos/$encodedOwner/$encodedRepo/contents/$pathEncoded"
  $sha = $null
  try {
    $existing = Invoke-GiteeJson GET "$uri?access_token=$Token&ref=$Branch"
    $sha = $existing.sha
  } catch {}

  $body = @{
    access_token = $Token
    message = "Publish $relative"
    content = $content
    branch = $Branch
  }
  if ($sha) { $body.sha = $sha }

  Write-Host "Uploading $relative"
  if ($sha) {
    Invoke-GiteeJson PUT $uri $body | Out-Null
  } else {
    Invoke-GiteeJson POST $uri $body | Out-Null
  }
}

Write-Host "Gitee publish complete."
Write-Host "Repo: https://gitee.com/$Owner/$Repo"
Write-Host "Gitee Pages usually requires manual activation in repository: 服务 > Gitee Pages."
