Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Drawing;
using System.Runtime.InteropServices;

public class WindowCapture {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hwnd, IntPtr hDC, uint nFlags);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left, Top, Right, Bottom;
    }

    public static Bitmap CaptureWindow(IntPtr hwnd) {
        // Restore window first
        ShowWindow(hwnd, 9);  // SW_RESTORE
        System.Threading.Thread.Sleep(1000);
        ShowWindow(hwnd, 3);  // SW_MAXIMIZE
        System.Threading.Thread.Sleep(1000);

        RECT rect;
        GetWindowRect(hwnd, out rect);
        int width = rect.Right - rect.Left;
        int height = rect.Bottom - rect.Top;

        if (width <= 0 || height <= 0) {
            width = 1920;
            height = 1080;
        }

        Bitmap bmp = new Bitmap(width, height);
        Graphics gfx = Graphics.FromImage(bmp);
        IntPtr hdc = gfx.GetHdc();

        // PW_RENDERFULLCONTENT = 2 captures even DWM composed content
        PrintWindow(hwnd, hdc, 2);

        gfx.ReleaseHdc(hdc);
        gfx.Dispose();
        return bmp;
    }
}
"@

# Find Chrome window
$chrome = Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object {
    $_.MainWindowHandle -ne [IntPtr]::Zero -and $_.MainWindowTitle
} | Select-Object -First 1

if ($chrome) {
    Write-Output "Capturing Chrome: $($chrome.MainWindowTitle)"
    $bmp = [WindowCapture]::CaptureWindow($chrome.MainWindowHandle)
    $bmp.Save("C:\ATO\ato-app\screenshot-dashboard.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Screenshot saved (PrintWindow method)"
} else {
    Write-Output "No Chrome window found"
}
