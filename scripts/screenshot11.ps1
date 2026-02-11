Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinFocus11 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder text, int count);
}
"@

# Step 1: Find Chrome and RESTORE it
$chrome = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle
} | Select-Object -First 1

if (-not $chrome) {
    Write-Output "No Chrome found, opening..."
    Start-Process "chrome.exe" "https://ato-ai.app/dashboard"
    Start-Sleep -Seconds 8
    $chrome = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle
    } | Select-Object -First 1
}

if ($chrome) {
    $hwnd = $chrome.MainWindowHandle
    Write-Output "Chrome: $($chrome.MainWindowTitle) (handle=$hwnd)"

    # Force restore from minimized
    [WinFocus11]::ShowWindow($hwnd, 9) | Out-Null  # SW_RESTORE
    Write-Output "Restored"
    Start-Sleep -Seconds 2

    # Maximize
    [WinFocus11]::ShowWindow($hwnd, 3) | Out-Null  # SW_MAXIMIZE
    Write-Output "Maximized"
    Start-Sleep -Seconds 1

    # Set foreground
    [WinFocus11]::SetForegroundWindow($hwnd) | Out-Null
    Write-Output "Set foreground"
    Start-Sleep -Seconds 5  # Long wait for DWM to actually render

    # Check what's actually foreground
    $fg = [WinFocus11]::GetForegroundWindow()
    $sb = New-Object System.Text.StringBuilder 256
    [WinFocus11]::GetWindowText($fg, $sb, 256) | Out-Null
    Write-Output "Current foreground: $($sb.ToString()) (handle=$fg)"
}

# Take screenshot
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
Write-Output "Screen bounds: $($screen.Width)x$($screen.Height)"
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save("C:\ATO\ato-app\screenshot-dashboard.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gfx.Dispose()
$bmp.Dispose()
Write-Output "Screenshot saved"
