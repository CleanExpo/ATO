Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Use AppActivate to bring Chrome to front
$wshell = New-Object -ComObject WScript.Shell

# Try to activate Chrome by its window title
$activated = $wshell.AppActivate("Google Chrome")
Write-Output "AppActivate Chrome: $activated"

if (-not $activated) {
    # Try with partial title match
    $activated = $wshell.AppActivate("ATO Tax Optimizer")
    Write-Output "AppActivate ATO: $activated"
}

if (-not $activated) {
    $activated = $wshell.AppActivate("ato-ai")
    Write-Output "AppActivate ato-ai: $activated"
}

Start-Sleep -Seconds 3

# Take screenshot
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save("C:\ATO\ato-app\screenshot-dashboard.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gfx.Dispose()
$bmp.Dispose()
Write-Output "Screenshot saved"
