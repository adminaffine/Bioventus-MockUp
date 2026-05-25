Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command '$name' not found in PATH."
  }
}

function Test-AzLoggedIn {
  $null = az account show --only-show-errors 2>&1 | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Ensure-AzLogin {
  if (-not (Test-AzLoggedIn)) {
    throw "Azure CLI not logged in. Run: az login"
  }
}

function Test-AzExtensionInstalled([string]$extName) {
  $null = az extension show --name $extName --only-show-errors 2>&1 | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Ensure-AzExtension([string]$extName) {
  if (-not (Test-AzExtensionInstalled $extName)) {
    Write-Host "Installing Azure CLI extension '$extName'..." -ForegroundColor Cyan
    az extension add --name $extName --yes --only-show-errors | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "az extension add $extName failed" }
  } else {
    az extension update --name $extName --only-show-errors 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "az extension update $extName failed" }
  }
}

function Ensure-SwaCli {
  if (-not (Get-Command swa -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Static Web Apps CLI (@azure/static-web-apps-cli)..." -ForegroundColor Cyan
    npm install -g @azure/static-web-apps-cli | Out-Null
  }
}

function Get-AvailableAcrName([string]$prefix) {
  while ($true) {
    $suffix = Get-Random -Minimum 10000 -Maximum 99999
    $name = ($prefix + $suffix).ToLower()
    $check = az acr check-name --name $name --query nameAvailable -o tsv --only-show-errors 2>&1
    if ($LASTEXITCODE -ne 0) { throw "az acr check-name failed for $name" }
    if ($check -eq "true") { return $name }
  }
}

function Test-ResourceExists([string]$type, [string]$name, [string]$rg) {
  switch ($type) {
    "containerapp-env" {
      $null = az containerapp env show -g $rg -n $name --only-show-errors 2>&1 | Out-Null
    }
    "containerapp" {
      $null = az containerapp show -g $rg -n $name --only-show-errors 2>&1 | Out-Null
    }
    "staticwebapp" {
      $null = az staticwebapp show -n $name -g $rg --only-show-errors 2>&1 | Out-Null
    }
    default { throw "Unknown resource type: $type" }
  }
  return ($LASTEXITCODE -eq 0)
}

function Set-ContainerAppRegistry {
  param(
    [string]$Rg,
    [string]$AppName,
    [string]$AcrName,
    [string]$LoginServer
  )
  $user = az acr credential show -n $AcrName -g $Rg --query username -o tsv --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Failed to read ACR admin username" }
  $pwd = az acr credential show -n $AcrName -g $Rg --query "passwords[0].value" -o tsv --only-show-errors
  if ($LASTEXITCODE -ne 0) { throw "Failed to read ACR admin password" }
  az containerapp registry set -g $Rg -n $AppName --server $LoginServer --username $user --password $pwd --only-show-errors | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "containerapp registry set failed" }
}

function Wait-ResourceGroupDeployable([string]$rgName, [int]$timeoutSec = 3600) {
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ($true) {
    $json = az group show -n $rgName -o json --only-show-errors 2>$null
    if ($LASTEXITCODE -ne 0) {
      Write-Host "Resource group '$rgName' is absent; creating fresh." -ForegroundColor Gray
      return
    }
    $g = $json | ConvertFrom-Json
    $state = [string]$g.properties.provisioningState
    if ($state -eq "Succeeded") {
      Write-Host "Resource group '$rgName' already exists (Succeeded)." -ForegroundColor Gray
      return
    }
    if ($state -match "^(Deleting|Deallocating|Updating)$") {
      if ((Get-Date) -ge $deadline) {
        throw "Timed out after ${timeoutSec}s waiting for resource group '$rgName' to finish (still '$state'). Retry deploy later."
      }
      Write-Host "Resource group '$rgName' is '$state'; waiting 15s before retry..." -ForegroundColor Yellow
      Start-Sleep -Seconds 15
      continue
    }
    Write-Host "Resource group '$rgName' is in state '$state'; continuing." -ForegroundColor Yellow
    return
  }
}

Require-Command "az"
Require-Command "docker"
Require-Command "npm"

Ensure-AzLogin
Ensure-AzExtension "containerapp"
Ensure-AzExtension "staticwebapp"
Ensure-SwaCli

$RG = "rg_didq"
$Prefix = "didq-"

# Backend in eastus (Container Apps). Static Web Apps: eastus2 is a supported region for Microsoft.Web/staticSites.
$BackendLocation = "eastus"
$FrontendLocation = "eastus2"

$SwaName = "didq-frontend"
$CaeName = "${Prefix}cae"
$BackendAppName = "${Prefix}backend"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $RepoRoot "frontend"
$BackendDir = Join-Path $RepoRoot "backend"

Write-Host "Deploying to Azure..." -ForegroundColor Cyan
Write-Host "  Resource Group: $RG" -ForegroundColor Gray
Write-Host "  Static Web App: $SwaName ($FrontendLocation)" -ForegroundColor Gray
Write-Host "  Container App:  $BackendAppName ($BackendLocation) min=0 max=1" -ForegroundColor Gray

Wait-ResourceGroupDeployable $RG

Write-Host "Creating/ensuring resource group..." -ForegroundColor Cyan
az group create -n $RG -l $BackendLocation --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "az group create failed" }

Write-Host "Creating/ensuring Container Apps environment..." -ForegroundColor Cyan
if (-not (Test-ResourceExists "containerapp-env" $CaeName $RG)) {
  az containerapp env create --resource-group $RG --name $CaeName --location $BackendLocation --only-show-errors | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Container Apps environment create failed" }
}

# Resolve environment by explicit RG + name, then use ARM id for containerapp create.
# Passing only --environment <name> can bind to another env with the same name in a different RG.
$CaeResourceId = az containerapp env show --resource-group $RG --name $CaeName --query id -o tsv --only-show-errors
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($CaeResourceId)) {
  throw "Could not read Container Apps environment id for '$CaeName' in resource group '$RG'."
}
$rgSegment = "/resourceGroups/$RG/"
if ($CaeResourceId.IndexOf($rgSegment, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
  throw "Container Apps environment resource id is not under '$RG': $CaeResourceId"
}

$AcrPrefix = "didqacr"
$AcrName = Get-AvailableAcrName $AcrPrefix
$AcrLoginServer = "$AcrName.azurecr.io"

Write-Host "Creating ACR: $AcrName" -ForegroundColor Cyan
az acr create -g $RG -n $AcrName -l $BackendLocation --sku Basic --admin-enabled true --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "ACR create failed" }
az acr login -n $AcrName --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "ACR login failed" }

$ImageTag = "1.0.0-" + (Get-Date -Format "yyyyMMddHHmmss")
$Image = "$AcrLoginServer/didq-backend:$ImageTag"

Write-Host "Building backend image locally..." -ForegroundColor Cyan
docker build -t $Image -f (Join-Path $BackendDir "Dockerfile") $BackendDir
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

Write-Host "Pushing backend image to ACR..." -ForegroundColor Cyan
docker push $Image
if ($LASTEXITCODE -ne 0) { throw "docker push failed" }

Write-Host "Creating/updating backend Container App..." -ForegroundColor Cyan
$backendExists = Test-ResourceExists "containerapp" $BackendAppName $RG

if ($backendExists) {
  $linkedEnvId = az containerapp show -g $RG -n $BackendAppName --query "properties.managedEnvironmentId" -o tsv --only-show-errors
  if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($linkedEnvId)) {
    $rgSeg = "/resourceGroups/$RG/"
    if ($linkedEnvId.IndexOf($rgSeg, [StringComparison]::OrdinalIgnoreCase) -lt 0) {
      throw "Container app '$BackendAppName' is linked to a Container Apps environment outside '$RG': $linkedEnvId. Delete that app or the stray environment, then redeploy."
    }
  }
}

if (-not $backendExists) {
  az containerapp create `
    --resource-group $RG --name $BackendAppName `
    --environment $CaeResourceId `
    --image $Image `
    --registry-server $AcrLoginServer `
    --ingress external `
    --target-port 8005 `
    --min-replicas 0 `
    --max-replicas 1 `
    --env-vars "SKIP_STARTUP_CACHE=true" `
    --only-show-errors | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "containerapp create failed" }
} else {
  Set-ContainerAppRegistry -Rg $RG -AppName $BackendAppName -AcrName $AcrName -LoginServer $AcrLoginServer
  az containerapp update `
    -g $RG -n $BackendAppName `
    --image $Image `
    --set-env-vars "SKIP_STARTUP_CACHE=true" `
    --only-show-errors | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "containerapp update failed" }
}

$BackendFqdn = az containerapp show -g $RG -n $BackendAppName --query properties.configuration.ingress.fqdn -o tsv --only-show-errors
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($BackendFqdn)) { throw "Could not read backend FQDN" }
$BackendUrl = "https://$BackendFqdn"

Write-Host "Ensuring Static Web App exists (no GitHub integration)..." -ForegroundColor Cyan
if (-not (Test-ResourceExists "staticwebapp" $SwaName $RG)) {
  az staticwebapp create -n $SwaName -g $RG -l $FrontendLocation --only-show-errors | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "staticwebapp create failed" }
}

$SwaHostname = az staticwebapp show -n $SwaName -g $RG --query defaultHostname -o tsv --only-show-errors
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($SwaHostname)) { throw "Could not read Static Web App hostname" }

Write-Host "Configuring Static Web App app settings..." -ForegroundColor Cyan
az staticwebapp appsettings set -n $SwaName -g $RG --setting-names "VITE_API_URL=$BackendUrl" --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "staticwebapp appsettings set failed" }

Write-Host "Building frontend..." -ForegroundColor Cyan
$prevVite = $env:VITE_API_URL
$prevNodeOpts = $env:NODE_OPTIONS
try {
  $env:VITE_API_URL = $BackendUrl
  # tsc + vite can exceed 4GB on large TS projects; inherit into all npm/node children
  $env:NODE_OPTIONS = "--max-old-space-size=8192"
  Push-Location $FrontendDir
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
}
finally {
  Pop-Location
  if ($null -ne $prevVite) { $env:VITE_API_URL = $prevVite } else { Remove-Item Env:\VITE_API_URL -ErrorAction SilentlyContinue }
  if ($null -ne $prevNodeOpts) { $env:NODE_OPTIONS = $prevNodeOpts } else { Remove-Item Env:\NODE_OPTIONS -ErrorAction SilentlyContinue }
}

Write-Host "Deploying frontend dist to Static Web App (production)..." -ForegroundColor Cyan
$deployToken = az staticwebapp secrets list -n $SwaName -g $RG --query properties.apiKey -o tsv --only-show-errors
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($deployToken)) { throw "Could not read Static Web App deployment token" }
swa deploy (Join-Path $FrontendDir "dist") --deployment-token $deployToken --env production
if ($LASTEXITCODE -ne 0) { throw "swa deploy failed" }

Write-Host "Applying backend environment (startup + CORS allowlist in one update)..." -ForegroundColor Cyan
$corsOrigin = "https://$SwaHostname"
az containerapp update -g $RG -n $BackendAppName --set-env-vars "SKIP_STARTUP_CACHE=true" "CORS_ALLOW_ORIGINS=$corsOrigin" --only-show-errors | Out-Null
if ($LASTEXITCODE -ne 0) { throw "containerapp final env update failed" }

Write-Host ""
Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "Frontend:  https://$SwaHostname" -ForegroundColor Green
Write-Host "Backend:   $BackendUrl" -ForegroundColor Green
Write-Host "Note: CORS_ALLOW_ORIGINS is set for browser preflight; backend main.py still uses allow_origins=['*'] until wired to env." -ForegroundColor DarkGray
