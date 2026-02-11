Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# First, simulate Win+D to show desktop, then click Chrome icon
# Use SendKeys with Alt+Tab approach

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Mouse1 {
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, IntPtr dwExtraInfo);
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;

    public static void ClickAt(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(100);
        mouse_event(MOUSEEVENTF_LEFTDOWN, x, y, 0, IntPtr.Zero);
        System.Threading.Thread.Sleep(50);
        mouse_event(MOUSEEVENTF_LEFTUP, x, y, 0, IntPtr.Zero);
    }
}
"@

# Click on the Chrome icon in the taskbar (approximately at position)
# The taskbar Chrome icon appears to be around x=780, y=800
# Let me click on the Chrome icon area in the taskbar
Write-Output "Clicking Chrome taskbar icon..."
[Mouse1]::ClickAt(780, 800)
Start-Sleep -Seconds 1

# Double click for good measure
[Mouse1]::ClickAt(780, 800)
Start-Sleep -Seconds 4

# Take screenshot
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bmp.Save("C:\ATO\ato-app\screenshot-dashboard.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gfx.Dispose()
$bmp.Dispose()
Write-Output "Screenshot saved"
