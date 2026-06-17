param(
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
  throw "Azure CLI (az) not found in PATH."
}

$RG = "rg_bv_demo"

Write-Host "This will delete the Azure resource group '$RG' and ALL resources inside it." -ForegroundColor Yellow

if (-not $Force) {
  $confirm = Read-Host "Type DELETE to confirm"
  if ($confirm -ne "DELETE") {
    Write-Host "Cancelled." -ForegroundColor Cyan
    exit 0
  }
} else {
  Write-Host "-Force: skipping interactive confirmation." -ForegroundColor Yellow
}

Write-Host "Deleting resource group '$RG'..." -ForegroundColor Cyan
az group delete -n $RG --yes --no-wait
if ($LASTEXITCODE -ne 0) { throw "az group delete failed to start" }

Write-Host "Deletion started (async). Monitor with: az group show -n $RG" -ForegroundColor Green
Write-Host "When the group is gone, deploy again with: .\scripts\azure_deploy.ps1" -ForegroundColor Gray
