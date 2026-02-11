Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinUtil {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
"@

# List all visible windows
Write-Output "=== All visible windows ==="
$windows = @()
[WinUtil]::EnumWindows({
    param($hwnd, $lparam)
    if ([WinUtil]::IsWindowVisible($hwnd)) {
        $sb = New-Object System.Text.StringBuilder 256
        [WinUtil]::GetWindowText($hwnd, $sb, 256) | Out-Null
        $title = $sb.ToString()
        if ($title) {
            $pid = 0
            [WinUtil]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
            try {
                $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
                $name = if ($proc) { $proc.ProcessName } else { "unknown" }
            } catch { $name = "unknown" }
            Write-Output "  [$name] $title (hwnd=$hwnd)"
        }
    }
    return $true
}, [IntPtr]::Zero) | Out-Null

# Find Chrome windows specifically
Write-Output "`n=== Chrome windows ==="
$chromeProcs = Get-Process -Name chrome -ErrorAction SilentlyContinue
foreach ($p in $chromeProcs) {
    if ($p.MainWindowHandle -ne [IntPtr]::Zero -and $p.MainWindowTitle) {
        Write-Output "  PID=$($p.Id) Handle=$($p.MainWindowHandle) Title='$($p.MainWindowTitle)'"
    }
}
