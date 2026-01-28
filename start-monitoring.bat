@echo off
echo.
echo ============================================
echo   ATO Autonomous Monitoring System
echo ============================================
echo.
echo Starting in 2 terminal windows...
echo.

REM Start dev server in new window
start "ATO Dev Server" cmd /k "npm run dev"

REM Wait for dev server to initialize
echo Waiting 15 seconds for dev server...
timeout /t 15 /nobreak >nul

REM Start orchestrator in new window
start "ATO Agent Orchestrator" cmd /k "npm run agents:start"

echo.
echo ✅ Both processes started in separate windows
echo.
echo Dev Server: http://localhost:3000
echo Dashboard: http://localhost:3000/dashboard/agent-monitor
echo.
echo Press Ctrl+C in each window to stop
echo.
pause
