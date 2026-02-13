$url = "https://ato-9xr2nb4ps-unite-group.vercel.app/api/slack/test"
Write-Host "Testing: $url" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $url -Method POST -UseBasicParsing -TimeoutSec 30
    Write-Host "`nSuccess!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "`nRequest completed with status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow

    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody"
    } else {
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}
