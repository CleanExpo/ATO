Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinHelper {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
}
"@

# Minimize ALL non-Chrome windows
$allProcs = Get-Process | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.ProcessName -ne "chrome" }
foreach ($p in $allProcs) {
    [WinHelper]::ShowWindow($p.MainWindowHandle, 6) | Out-Null  # SW_MINIMIZE = 6
}

Start-Sleep -Milliseconds 500

# Find and maximize Chrome window with dashboard
$chromeProcs = Get-Process -Name chrome -ErrorAction SilentlyContinue
$focused = $false
foreach ($p in $chromeProcs) {
    if ($p.MainWindowHandle -ne [IntPtr]::Zero) {
        $t = $p.MainWindowTitle
        if ($t -and ($t -match "dashboard" -or $t -match "ATO" -or $t -match "ato-ai" -or $t -match "Tax")) {
            [WinHelper]::ShowWindow($p.MainWindowHandle, 3) | Out-Null  # SW_MAXIMIZE = 3
            Start-Sleep -Milliseconds 200
            [WinHelper]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
            [WinHelper]::BringWindowToTop($p.MainWindowHandle) | Out-Null
            Write-Output "Focused: $t"
            $focused = $true
            break
        }
    }
}

if (-not $focused) {
    # Try any Chrome window
    foreach ($p in $chromeProcs) {
        if ($p.MainWindowHandle -ne [IntPtr]::Zero -and $p.MainWindowTitle) {
            [WinHelper]::ShowWindow($p.MainWindowHandle, 3) | Out-Null
            Start-Sleep -Milliseconds 200
            [WinHelper]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
            [WinHelper]::BringWindowToTop($p.MainWindowHandle) | Out-Null
            Write-Output "Focused (fallback): $($p.MainWindowTitle)"
            break
        }
    }
}

Start-Sleep -Seconds 2

# Take screenshot
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save("C:\ATO\ato-app\screenshot-dashboard.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gfx.Dispose()
$bmp.Dispose()
Write-Output "Screenshot saved"
