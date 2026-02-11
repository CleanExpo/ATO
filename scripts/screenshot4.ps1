Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinFocus4 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern IntPtr SetActiveWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    public static void PressAltTab() {
        // Press and release Alt to trick Windows into allowing SetForegroundWindow
        keybd_event(0x12, 0, 0, UIntPtr.Zero); // ALT down
        keybd_event(0x12, 0, 2, UIntPtr.Zero); // ALT up
    }
}
"@

# Get Chrome process handle
$chrome = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle -match "ATO|dashboard|ato-ai|Tax"
} | Select-Object -First 1

if ($chrome) {
    Write-Output "Found Chrome: $($chrome.MainWindowTitle)"
    $hwnd = $chrome.MainWindowHandle

    # Trick: press Alt key to allow foreground window change
    [WinFocus4]::PressAltTab()
    Start-Sleep -Milliseconds 100

    # Restore and maximize
    [WinFocus4]::ShowWindow($hwnd, 9) | Out-Null   # SW_RESTORE
    Start-Sleep -Milliseconds 200
    [WinFocus4]::ShowWindow($hwnd, 3) | Out-Null   # SW_MAXIMIZE
    Start-Sleep -Milliseconds 200
    [WinFocus4]::SetForegroundWindow($hwnd) | Out-Null
    [WinFocus4]::BringWindowToTop($hwnd) | Out-Null

    Start-Sleep -Seconds 2
} else {
    Write-Output "Chrome not found!"
}

# Take screenshot
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save("C:\ATO\ato-app\screenshot-dashboard.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gfx.Dispose()
$bmp.Dispose()
Write-Output "Screenshot saved"
