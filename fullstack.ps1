# ServeTrack Full Stack Local Development Startup Script (Windows PowerShell)
# This script starts Laravel backend and Angular frontend in separate terminals

# ASCII Art Banner
Write-Host ""
Write-Host "  ███████╗███████╗██████╗ ██╗   ██╗███████╗████████╗██████╗  █████╗  ██████╗██╗  ██╗" -ForegroundColor Cyan
Write-Host "  ██╔════╝██╔════╝██╔══██╗██║   ██║██╔════╝╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██║ ██╔╝" -ForegroundColor Cyan
Write-Host "  ███████╗█████╗  ██████╔╝██║   ██║█████╗     ██║   ██████╔╝███████║██║     █████╔╝ " -ForegroundColor Cyan
Write-Host "  ╚════██║██╔══╝  ██╔══██╗╚██╗ ██╔╝██╔══╝     ██║   ██╔══██╗██╔══██║██║     ██╔═██╗ " -ForegroundColor Cyan
Write-Host "  ███████║███████╗██║  ██║ ╚████╔╝ ███████╗   ██║   ██║  ██║██║  ██║╚██████╗██║  ██╗" -ForegroundColor Cyan
Write-Host "  ╚══════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝" -ForegroundColor Cyan
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  Full Stack Development Environment Startup" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Resolve paths relative to this script's location (works on any machine)
$backendPath  = Join-Path $PSScriptRoot "servetrack-backend"
$frontendPath = Join-Path $PSScriptRoot "servetrack-frontend"

# ── Step 1: Laravel Backend ──────────────────────────────────────────────────
Write-Host "[STEP 1/2] Starting Laravel backend (server + queue + vite)..." -ForegroundColor Green
Write-Host "  Runs: composer run dev" -ForegroundColor Gray
Write-Host "  API URL:   http://localhost:8000" -ForegroundColor Gray
Write-Host "  Vite HMR:  http://localhost:5173" -ForegroundColor Gray
Write-Host ""

$backendCmd = "Write-Host '════════════════════════════════════════════════════════════' -ForegroundColor Cyan; " +
    "Write-Host '  LARAVEL BACKEND (server + queue + vite)' -ForegroundColor Green; " +
    "Write-Host '  API:  http://localhost:8000' -ForegroundColor Yellow; " +
    "Write-Host '  Vite: http://localhost:5173' -ForegroundColor Yellow; " +
    "Write-Host '════════════════════════════════════════════════════════════' -ForegroundColor Cyan; " +
    "Write-Host ''; " +
    "cd '$backendPath'; " +
    "composer run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

Write-Host "[INFO] Waiting 8 seconds for backend to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# ── Step 2: Angular Frontend ─────────────────────────────────────────────────
Write-Host ""
Write-Host "[STEP 2/2] Starting Angular frontend..." -ForegroundColor Green
Write-Host "  Runs: npm start" -ForegroundColor Gray
Write-Host "  Frontend URL: http://localhost:4200" -ForegroundColor Gray
Write-Host ""

$frontendCmd = "Write-Host '════════════════════════════════════════════════════════════' -ForegroundColor Cyan; " +
    "Write-Host '  ANGULAR FRONTEND' -ForegroundColor Green; " +
    "Write-Host '  URL: http://localhost:4200' -ForegroundColor Yellow; " +
    "Write-Host '════════════════════════════════════════════════════════════' -ForegroundColor Cyan; " +
    "Write-Host ''; " +
    "cd '$frontendPath'; " +
    "npm start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  Development Environment Started!" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Services Running:" -ForegroundColor White
Write-Host "  +-- Backend API:  http://localhost:8000" -ForegroundColor Yellow
Write-Host "  +-- Queue Worker: listening (via composer run dev)" -ForegroundColor Gray
Write-Host "  +-- Vite HMR:    http://localhost:5173" -ForegroundColor Gray
Write-Host "  +-- Frontend:    http://localhost:4200" -ForegroundColor Yellow
Write-Host ""
Write-Host "  To stop all services, close each PowerShell window or press Ctrl+C" -ForegroundColor Gray
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to close this window (services will continue running)..." -ForegroundColor White
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
