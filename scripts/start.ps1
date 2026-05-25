Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Starting BV Command Center (detached)..." -ForegroundColor Cyan
docker compose up --build -d

Write-Host ""
Write-Host "Services status:" -ForegroundColor Cyan
docker compose ps

Write-Host ""
Write-Host "Frontend:   http://localhost:15174" -ForegroundColor Green
Write-Host "Backend:    http://localhost:18005" -ForegroundColor Green
Write-Host "API Docs:   http://localhost:18005/docs" -ForegroundColor Green
