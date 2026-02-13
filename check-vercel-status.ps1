#!/usr/bin/env pwsh

Write-Host "`n=== Checking Vercel Deployment Status ===" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "https://ato-blush.vercel.app/api/slack/test" -Method GET -UseBasicParsing
    Write-Host "`n✅ Success!" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "`nResponse:" -ForegroundColor Cyan
    Write-Host $response.Content
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "`n❌ Endpoint Not Ready" -ForegroundColor Yellow
    Write-Host "Status Code: $statusCode" -ForegroundColor Yellow

    if ($statusCode -eq 404) {
        Write-Host "`nThis is expected if:" -ForegroundColor Cyan
        Write-Host "  1. Deployment is still in progress (wait 2-3 minutes)" -ForegroundColor White
        Write-Host "  2. Environment variables not added to Vercel Dashboard yet" -ForegroundColor White
        Write-Host "  3. Not redeployed after adding environment variables" -ForegroundColor White
    }
}

Write-Host "`n=== Next Steps ===" -ForegroundColor Cyan
Write-Host "1. Visit: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "2. Check if deployment status shows 'Ready' (green checkmark)" -ForegroundColor White
Write-Host "3. Add environment variables if not done yet (see SLACK_DEPLOYMENT_CHECKLIST.md)" -ForegroundColor White
Write-Host ""
