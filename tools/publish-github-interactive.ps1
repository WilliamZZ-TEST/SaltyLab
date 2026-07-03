$ErrorActionPreference = "Stop"

$owner = Read-Host "GitHub owner"
if (-not $owner) { $owner = "WilliamZZ-TEST" }

$repo = Read-Host "Repository name"
if (-not $repo) { $repo = "SaltyLab" }

$token = Read-Host "GitHub token"
if (-not $token) {
  throw "GitHub token is required."
}

& "$PSScriptRoot\publish-github-api.ps1" -Owner $owner -Repo $repo -Token $token
