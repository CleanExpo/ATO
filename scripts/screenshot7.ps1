Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinFocus7 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")]
    public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    public static void ForceForeground(IntPtr hwnd) {
        IntPtr fg = GetForegroundWindow();
        uint fgThread = 0;
        uint dummy = 0;
        fgThread = GetWindowThreadProcessId(fg, out dummy);
        uint curThread = GetCurrentThreadId();

        AttachThreadInput(curThread, fgThread, true);
        SetForegroundWindow(hwnd);
        AttachThreadInput(curThread, fgThread, false);
    }
}
"@

# Find Chrome
$chrome = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle
} | Select-Object -First 1

if ($chrome) {
    $hwnd = $chrome.MainWindowHandle
    Write-Output "Chrome handle: $hwnd - $($chrome.MainWindowTitle)"

    # Restore from minimized
    [WinFocus7]::ShowWindow($hwnd, 9) | Out-Null   # SW_RESTORE
    Start-Sleep -Milliseconds 500

    # Maximize
    [WinFocus7]::ShowWindow($hwnd, 3) | Out-Null   # SW_MAXIMIZE
    Start-Sleep -Milliseconds 500

    # Force foreground using thread attachment
    [WinFocus7]::ForceForeground($hwnd)
    Start-Sleep -Seconds 3

    $fg = [WinFocus7]::GetForegroundWindow()
    Write-Output "Foreground window handle: $fg"
    Write-Output "Match: $($fg -eq $hwnd)"
} else {
    Write-Output "No Chrome window found"
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
