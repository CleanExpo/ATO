Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinFocus5 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@

# Step 1: Minimize ALL VS Code windows
$vscodeProcs = Get-Process | Where-Object { $_.ProcessName -match "Code" -and $_.MainWindowHandle -ne [IntPtr]::Zero }
foreach ($p in $vscodeProcs) {
    Write-Output "Minimizing VS Code: $($p.MainWindowTitle)"
    [WinFocus5]::ShowWindow($p.MainWindowHandle, 6) | Out-Null  # SW_MINIMIZE
}

# Step 2: Also minimize Cursor
$cursorProcs = Get-Process | Where-Object { $_.ProcessName -match "Cursor" -and $_.MainWindowHandle -ne [IntPtr]::Zero }
foreach ($p in $cursorProcs) {
    Write-Output "Minimizing Cursor: $($p.MainWindowTitle)"
    [WinFocus5]::ShowWindow($p.MainWindowHandle, 6) | Out-Null
}

Start-Sleep -Milliseconds 500

# Step 3: Find and maximize Chrome
$chrome = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle
} | Select-Object -First 1

if ($chrome) {
    Write-Output "Activating Chrome: $($chrome.MainWindowTitle)"
    $hwnd = $chrome.MainWindowHandle

    # Press Alt to allow foreground switch
    [WinFocus5]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
    [WinFocus5]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 100

    [WinFocus5]::ShowWindow($hwnd, 9) | Out-Null   # SW_RESTORE
    Start-Sleep -Milliseconds 300
    [WinFocus5]::ShowWindow($hwnd, 3) | Out-Null   # SW_MAXIMIZE
    Start-Sleep -Milliseconds 300
    [WinFocus5]::SetForegroundWindow($hwnd) | Out-Null
    [WinFocus5]::BringWindowToTop($hwnd) | Out-Null
}

# Step 4: Wait for Chrome to fully render
Start-Sleep -Seconds 3

# Step 5: Take screenshot
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save("C:\ATO\ato-app\screenshot-dashboard.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gfx.Dispose()
$bmp.Dispose()
Write-Output "Screenshot saved"
