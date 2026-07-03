param(
  [Parameter(Mandatory=$true)][string]$Owner,
  [string]$Repo = "SaltyLab",
  [string]$Token = $env:GH_TOKEN,
  [string]$Branch = "main"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not $Token) {
  throw "Missing GitHub token. Pass -Token or set GH_TOKEN."
}

$Headers = @{
  Authorization = "Bearer $Token"
  Accept = "application/vnd.github+json"
  "X-GitHub-Api-Version" = "2022-11-28"
}

function Invoke-GitHubJson {
  param([string]$Method, [string]$Uri, $Body = $null)
  if ($null -eq $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
  }
  return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 20)
}

try {
  Invoke-GitHubJson GET "https://api.github.com/repos/$Owner/$Repo" | Out-Null
  Write-Host "GitHub repo exists: $Owner/$Repo"
} catch {
  Write-Host "Creating GitHub repo: $Owner/$Repo"
  Invoke-GitHubJson POST "https://api.github.com/user/repos" @{
    name = $Repo
    private = $false
    auto_init = $true
    default_branch = $Branch
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
  $uri = "https://api.github.com/repos/$Owner/$Repo/contents/$relative"
  $sha = $null
  try {
    $existing = Invoke-GitHubJson GET "$uri?ref=$Branch"
    $sha = $existing.sha
  } catch {}

  $body = @{
    message = "Publish $relative"
    content = $content
    branch = $Branch
  }
  if ($sha) { $body.sha = $sha }

  Write-Host "Uploading $relative"
  try {
    Invoke-GitHubJson PUT $uri $body | Out-Null
  } catch {
    $message = $_.Exception.Message
    if ($message -like '*422*' -or $message -like '*sha*') {
      $existing = Invoke-GitHubJson GET $uri
      $body.sha = $existing.sha
      Invoke-GitHubJson PUT $uri $body | Out-Null
    } else {
      throw
    }
  }
}

try {
  Write-Host "Enabling GitHub Pages workflow deployment"
  Invoke-GitHubJson POST "https://api.github.com/repos/$Owner/$Repo/pages" @{
    build_type = "workflow"
  } | Out-Null
} catch {
  Write-Host "GitHub Pages may already be enabled or requires manual enablement: Settings > Pages > GitHub Actions"
}

Write-Host "GitHub publish complete."
Write-Host "Repo: https://github.com/$Owner/$Repo"
Write-Host "Pages: https://$Owner.github.io/$Repo/"
