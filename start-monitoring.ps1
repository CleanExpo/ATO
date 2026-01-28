# Start Autonomous Agent Monitoring System
# This script starts both the Next.js dev server and the agent orchestrator

Write-Host "🚀 Starting ATO Autonomous Monitoring System..." -ForegroundColor Cyan
Write-Host ""

# Change to app directory
Set-Location $PSScriptRoot

# Check if dev server is already running
$devServerRunning = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($devServerRunning) {
    Write-Host "✅ Dev server already running on port 3000" -ForegroundColor Green
} else {
    Write-Host "▶️  Starting Next.js dev server..." -ForegroundColor Yellow
    Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run", "dev"
    Write-Host "⏳ Waiting 15 seconds for dev server to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
    Write-Host "✅ Dev server started" -ForegroundColor Green
}

Write-Host ""
Write-Host "▶️  Starting Agent Orchestrator..." -ForegroundColor Yellow
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host ""

# Start orchestrator in foreground (it will run continuously)
npm run agents:start

# If orchestrator exits, show message
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray
Write-Host "🛑 Orchestrator stopped" -ForegroundColor Red
