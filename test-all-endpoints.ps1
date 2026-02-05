Write-Host "=== Testing ATO Deployment Endpoints ===" -ForegroundColor Cyan

$endpoints = @(
    "https://ato-9xr2nb4ps-unite-group.vercel.app",
    "https://ato-ai.app",
    "https://ato-blush.vercel.app"
)

foreach ($base in $endpoints) {
    Write-Host "`n--- Testing: $base ---" -ForegroundColor Yellow

    # Test root
    try {
        $response = Invoke-WebRequest -Uri $base -Method GET -UseBasicParsing -TimeoutSec 10
        Write-Host "Root: $($response.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "Root: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }

    # Test Slack endpoint (GET - shows instructions)
    try {
        $response = Invoke-WebRequest -Uri "$base/api/slack/test" -Method GET -UseBasicParsing -TimeoutSec 10
        Write-Host "Slack (GET): $($response.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "Slack (GET): $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    }

    # Test Slack endpoint (POST - sends test)
    try {
        $response = Invoke-WebRequest -Uri "$base/api/slack/test" -Method POST -UseBasicParsing -TimeoutSec 10
        Write-Host "Slack (POST): $($response.StatusCode) - $($response.Content)" -ForegroundColor Green
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 500) {
            Write-Host "Slack (POST): $status - Likely missing env vars" -ForegroundColor Yellow
        } else {
            Write-Host "Slack (POST): $status" -ForegroundColor Red
        }
    }
}

Write-Host "`n=== Done ===" -ForegroundColor Cyan
