Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Starting BV Command Center with validation profile..." -ForegroundColor Cyan
Write-Host "This run exits based on ui_sanity result." -ForegroundColor Yellow

docker compose --profile validation up --build --abort-on-container-exit --exit-code-from ui_sanity
