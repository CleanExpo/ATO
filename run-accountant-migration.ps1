# Run Accountant Vetting System Migration

Write-Host ""
Write-Host "Accountant Vetting System Migration" -ForegroundColor Cyan
Write-Host ""

# Copy SQL to clipboard
Write-Host "Copying SQL to clipboard..." -ForegroundColor Yellow
Get-Content "supabase\migrations\20260129_accountant_vetting_system.sql" | Set-Clipboard
Write-Host "   DONE: SQL copied (376 lines)" -ForegroundColor Green

# Open Supabase Dashboard
Write-Host ""
Write-Host "Opening Supabase Dashboard..." -ForegroundColor Yellow
$supabaseUrl = "https://supabase.com/dashboard/project/xwqymjisxmtcmaebcehw/editor"
Start-Process $supabaseUrl
Write-Host "   DONE: Dashboard opened" -ForegroundColor Green

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Click 'New Query' in Supabase" -ForegroundColor White
Write-Host "2. Paste SQL (Ctrl+V)" -ForegroundColor White
Write-Host "3. Click 'Run'" -ForegroundColor White
Write-Host ""
