# ServeTrack Full Stack Local Development Startup Script (Windows PowerShell)
# This script starts SSH tunnel to remote VPS, Laravel backend, and Angular frontend
# Credentials are loaded from .server.env file (must be in the same directory as this script)

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

# Resolve paths relative to this script's location
$scriptDir = $PSScriptRoot
$serverEnvPath = Join-Path $scriptDir ".server.env"
$backendPath  = Join-Path $scriptDir "servetrack-backend"
$frontendPath = Join-Path $scriptDir "servetrack-frontend"

# ── Load credentials from .server.env ──────────────────────────────────────
if (-not (Test-Path $serverEnvPath)) {
    Write-Host "[ERROR] .server.env file not found at $serverEnvPath" -ForegroundColor Red
    Write-Host "Please create .server.env with your VPS and database credentials." -ForegroundColor Gray
    Write-Host ""
    Write-Host "Required format:" -ForegroundColor Yellow
    Write-Host "  SSH_HOSTNAME: your.vps.ip.address" -ForegroundColor Gray
    Write-Host "  SSH_PORT: 22" -ForegroundColor Gray
    Write-Host "  SSH_USERNAME: your-username" -ForegroundColor Gray
    Write-Host "  MYSQL_SERVER_PORT: 3306" -ForegroundColor Gray
    Write-Host "  MYSQL_LOCAL_PORT: 3307" -ForegroundColor Gray
    exit 1
}

$serverEnv = @{}
Get-Content $serverEnvPath | ForEach-Object {
    if ($_ -match '^([^:]+):\s*(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $serverEnv[$key] = $value
    }
}

# Extract variables with defaults
$sshHost = $serverEnv['SSH_HOSTNAME']
$sshPort = if ($serverEnv['SSH_PORT']) { $serverEnv['SSH_PORT'] } else { 22 }
$sshUser = $serverEnv['SSH_USERNAME']
$mysqlServerPort = if ($serverEnv['MYSQL_SERVER_PORT']) { $serverEnv['MYSQL_SERVER_PORT'] } else { 3306 }
$mysqlLocalPort = if ($serverEnv['MYSQL_LOCAL_PORT']) { $serverEnv['MYSQL_LOCAL_PORT'] } else { 3307 }

Write-Host "[INFO] Loaded server credentials from .server.env" -ForegroundColor Yellow
Write-Host "[INFO] SSH Target: $sshHost`:$sshPort -> $sshUser" -ForegroundColor Gray
Write-Host "[INFO] MySQL Local Port: $mysqlLocalPort -> VPS MySQL: $mysqlServerPort" -ForegroundColor Gray
Write-Host ""

# ── Step 1: SSH Tunnel ─────────────────────────────────────────────────────────
$tunnelExists = Get-Process -Name ssh -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*$mysqlLocalPort*" -and ($_.CommandLine -like "*localhost:$mysqlServerPort*" -or $_.CommandLine -like "*127.0.0.1:$mysqlServerPort*")
}

if ($tunnelExists) {
    Write-Host "[INFO] SSH tunnel already running on port $mysqlLocalPort" -ForegroundColor Yellow
} else {
    Write-Host "[STEP 1/3] Starting SSH tunnel to production VPS..." -ForegroundColor Green
    Write-Host "  Local Port: $mysqlLocalPort -> VPS MySQL: localhost:$mysqlServerPort" -ForegroundColor Gray
    Write-Host ""

    $tunnelCmd = "Write-Host '═══════════════════════════════════════════════════════════' -ForegroundColor Cyan; " +
        "Write-Host '  SSH TUNNEL - Keep this window open!' -ForegroundColor Green; " +
        "Write-Host '  Port: $mysqlLocalPort -> VPS MySQL: localhost:$mysqlServerPort' -ForegroundColor Gray; " +
        "Write-Host '═══════════════════════════════════════════════════════════' -ForegroundColor Cyan; " +
        "Write-Host ''; " +
        "ssh -p $sshPort -L $mysqlLocalPort`:localhost:$mysqlServerPort $sshUser@$sshHost"

    Start-Process powershell -ArgumentList "-NoExit", "-Command", $tunnelCmd

    Write-Host "[INFO] Waiting for SSH tunnel to establish on port $mysqlLocalPort..." -ForegroundColor Yellow

    $retryCount = 0
    $maxRetries = 15
    $connected = $false

    while ($retryCount -lt $maxRetries -and -not $connected) {
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $connect = $tcpClient.BeginConnect("localhost", $mysqlLocalPort, $null, $null)
            $wait = $connect.AsyncWaitHandle.WaitOne(1000, $false)

            if ($wait -and $tcpClient.Connected) {
                $connected = $true
                $tcpClient.Close()
            } else {
                $tcpClient.Close()
            }
        } catch {
            # Connection failed, continue retrying
        }

        if (-not $connected) {
            Start-Sleep -Milliseconds 500
            $retryCount++
        }
    }

    if ($connected) {
        Write-Host "[SUCCESS] SSH tunnel connected successfully on port $mysqlLocalPort!" -ForegroundColor Green
    } else {
        Write-Host "[ERROR] Failed to establish SSH tunnel after $maxRetries attempts." -ForegroundColor Red
        Write-Host "Please check your SSH key and VPS credentials." -ForegroundColor Gray
        exit 1
    }
}

Write-Host ""

# ── Step 2: Laravel Backend ─────────────────────────────────────────────────────
Write-Host "[STEP 2/3] Starting Laravel backend (server + queue + vite)..." -ForegroundColor Green
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

# ── Step 3: Angular Frontend ───────────────────────────────────────────────────
Write-Host ""
Write-Host "[STEP 3/3] Starting Angular frontend..." -ForegroundColor Green
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

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  Development Environment Started!" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Services Running:" -ForegroundColor White
Write-Host "  ├─ SSH Tunnel:  localhost:$mysqlLocalPort -> VPS MySQL (localhost:$mysqlServerPort)" -ForegroundColor Gray
Write-Host "  ├─ Backend API:  http://localhost:8000" -ForegroundColor Yellow
Write-Host "  ├─ Queue Worker: listening (via composer run dev)" -ForegroundColor Gray
Write-Host "  ├─ Vite HMR:    http://localhost:5173" -ForegroundColor Gray
Write-Host "  └─ Frontend:    http://localhost:4200" -ForegroundColor Yellow
Write-Host ""
Write-Host "  To stop all services, close each PowerShell window or press Ctrl+C" -ForegroundColor Gray
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press any key to close this window (services will continue running)..." -ForegroundColor White
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")