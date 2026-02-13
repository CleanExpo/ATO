# Deploy to Vercel Production
# This script adds environment variables and deploys

Write-Host "=== Deploying to Vercel (ato project) ===" -ForegroundColor Cyan

# Navigate to project directory
Set-Location "C:\ATO\ato-app"

# Check Vercel login status
Write-Host "`nChecking Vercel authentication..." -ForegroundColor Yellow
vercel whoami

# List current environment variables
Write-Host "`nCurrent environment variables:" -ForegroundColor Yellow
vercel env ls

# Deploy to production
Write-Host "`nDeploying to production..." -ForegroundColor Green
vercel --prod --yes

Write-Host "`n=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Check: https://ato-ai.app" -ForegroundColor Cyan
