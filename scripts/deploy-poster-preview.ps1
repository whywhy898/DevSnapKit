$ErrorActionPreference = 'Stop'
$productRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent (Split-Path -Parent $productRoot)
Push-Location $productRoot
try {
  $branch = git branch --show-current
  if ($branch -ne 'codex/poster-v1') { throw 'Preview deployment requires codex/poster-v1.' }
  if (-not $env:CLOUDFLARE_API_TOKEN) { throw 'Cloudflare authentication must be configured in the environment.' }
  $commit = git rev-parse HEAD
  $stage = Join-Path $workspaceRoot ('output/devsnapkit/poster-v1/deployment-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Path $stage | Out-Null
  Copy-Item -LiteralPath (Join-Path $productRoot 'dist') -Destination (Join-Path $stage 'public') -Recurse
  Copy-Item -LiteralPath (Join-Path $productRoot 'functions') -Destination (Join-Path $stage 'functions') -Recurse
  # Keep review deployments out of search results. No local environment/config files are copied.
  $headers = Join-Path $stage 'public/_headers'
  $headerText = [IO.File]::ReadAllText($headers)
  $headerText = $headerText -replace '\A/\*\r?\n', "/*`n  X-Robots-Tag: noindex, nofollow`n"
  [IO.File]::WriteAllText($headers, $headerText)
  [IO.File]::WriteAllText((Join-Path $stage 'public/robots.txt'), "User-agent: *`nDisallow: /`n")
  Push-Location $stage
  $previousGitDir = $env:GIT_DIR
  $previousGitWorkTree = $env:GIT_WORK_TREE
  try {
    # Staging lives in the outer workspace repository; resolve metadata against the product.
    $env:GIT_DIR = Join-Path $productRoot '.git'
    $env:GIT_WORK_TREE = $productRoot
    npx wrangler pages deploy public --project-name devsnapkit --branch poster-v1-review --commit-hash $commit --commit-dirty=true
    if ($LASTEXITCODE -ne 0) { throw "Preview deployment failed with exit code $LASTEXITCODE." }
  } finally {
    $env:GIT_DIR = $previousGitDir
    $env:GIT_WORK_TREE = $previousGitWorkTree
    Pop-Location
  }
} finally { Pop-Location }
