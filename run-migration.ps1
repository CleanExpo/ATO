# Quick Migration Script - One Command Setup
# Run with: .\run-migration.ps1

Write-Host ""
Write-Host "Database Migration Helper" -ForegroundColor Cyan
Write-Host ""

# Step 1: Copy SQL to clipboard
Write-Host "Step 1: Copying SQL to clipboard..." -ForegroundColor Yellow
Get-Content "supabase\migrations\20260129_create_work_queue.sql" | Set-Clipboard
Write-Host "   DONE: SQL copied (261 lines)" -ForegroundColor Green

# Step 2: Open Supabase Dashboard
Write-Host ""
Write-Host "Step 2: Opening Supabase Dashboard..." -ForegroundColor Yellow
$supabaseUrl = "https://supabase.com/dashboard/project/xwqymjisxmtcmaebcehw/editor"
Start-Process $supabaseUrl
Write-Host "   DONE: Dashboard opened in browser" -ForegroundColor Green

# Step 3: Instructions
Write-Host ""
Write-Host "Step 3: In your browser:" -ForegroundColor Yellow
Write-Host "   1. Click 'New Query' button (top right)" -ForegroundColor White
Write-Host "   2. Paste the SQL (Ctrl+V)" -ForegroundColor White
Write-Host "   3. Click 'Run' button or press Ctrl+Enter" -ForegroundColor White
Write-Host "   4. Wait for 'Success' message" -ForegroundColor White
Write-Host ""

Write-Host "Waiting for you to run the migration..." -ForegroundColor Cyan
Write-Host "Press any key after you see the success message..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Step 4: Verify
Write-Host ""
Write-Host "Step 4: Verifying migration..." -ForegroundColor Yellow
npx tsx test-setup.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "SUCCESS: Migration completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now use: /workflow" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "WARNING: Verification failed. Check output above." -ForegroundColor Red
    Write-Host "Try running: npx tsx test-setup.ts" -ForegroundColor Gray
}

Write-Host ""
