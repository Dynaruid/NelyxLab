# SPDX-License-Identifier: BSD-3-Clause
param(
    [Parameter(Mandatory)][int] $WindowProcessId,
    [Parameter(Mandatory)][ValidateSet('focus', 'scan', 'uia')][string] $Action,
    [string] $Value
)

$ErrorActionPreference = 'Stop'
$process = Get-Process -Id $WindowProcessId
$window = $process.MainWindowHandle
if ($window -eq [IntPtr]::Zero) { throw 'The selected process has no main window' }

if ($Action -eq 'uia') {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    $desktop = [System.Windows.Automation.AutomationElement]::RootElement
    $owner = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::ProcessIdProperty, $WindowProcessId)
    $windows = $desktop.FindAll([System.Windows.Automation.TreeScope]::Children, $owner)
    $condition = [System.Windows.Automation.PropertyCondition]::new(
        [System.Windows.Automation.AutomationElement]::NameProperty, $Value)
    $items = @(foreach ($root in $windows) {
        $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, $condition) |
            ForEach-Object {
                @{ name = $_.Current.Name; enabled = $_.Current.IsEnabled; control = $_.Current.ControlType.ProgrammaticName }
            }
    })
    ConvertTo-Json -InputObject $items -Compress
    return
}

Add-Type @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Threading;

public static class SelectionWindowInput {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")] private static extern bool GetCursorPos(out Point point);
    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint count, Input[] input, int size);

    [StructLayout(LayoutKind.Sequential)]
    private struct Input {
        public uint Type;
        public Data Data;
    }
    [StructLayout(LayoutKind.Explicit)]
    private struct Data {
        [FieldOffset(0)] public Keyboard Keyboard;
        [FieldOffset(0)] public Mouse Mouse;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct Keyboard {
        public ushort VirtualKey, ScanCode;
        public uint Flags, Time;
        public UIntPtr ExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct Mouse {
        public int X, Y;
        public uint MouseData, Flags, Time;
        public UIntPtr ExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)]
    private struct Point { public int X, Y; }

    public static void ClickTitleBar(IntPtr window) {
        const uint noMoveResizeOrActivate = 0x0013;
        Point previous;
        if (!GetCursorPos(out previous) ||
            !SetWindowPos(window, new IntPtr(-1), 0, 0, 0, 0, noMoveResizeOrActivate)) return;
        try {
            Rect rect;
            if (!GetWindowRect(window, out rect)) return;
            Point point = new Point { X = (rect.Left + rect.Right) / 2, Y = rect.Top + 18 };
            if (WindowFromPoint(point) != window || !SetCursorPos(point.X, point.Y)) return;
            var down = new Input { Data = new Data { Mouse = new Mouse { Flags = 2 } } };
            var up = new Input { Data = new Data { Mouse = new Mouse { Flags = 4 } } };
            SendInput(2, new[] { down, up }, Marshal.SizeOf(typeof(Input)));
            Thread.Sleep(150);
        } finally {
            SetCursorPos(previous.X, previous.Y);
            SetWindowPos(window, new IntPtr(-2), 0, 0, 0, 0, noMoveResizeOrActivate);
        }
    }
    private static void Scan(IntPtr window, ushort scan, bool release) {
        if (!release) {
            uint testProcess, foregroundProcess;
            GetWindowThreadProcessId(window, out testProcess);
            GetWindowThreadProcessId(GetForegroundWindow(), out foregroundProcess);
            if (testProcess == 0 || foregroundProcess != testProcess)
                throw new InvalidOperationException("The test process lost foreground focus");
        }
        uint flags = 8;
        if ((scan & 0xff00) == 0xe000) flags |= 1;
        if (release) flags |= 2;
        var input = new Input {
            Type = 1,
            Data = new Data { Keyboard = new Keyboard { ScanCode = (ushort)(scan & 0xff), Flags = flags } }
        };
        if (SendInput(1, new[] { input }, Marshal.SizeOf(typeof(Input))) != 1)
            throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    public static void Chord(IntPtr window, ushort[] scans) {
        int pressed = 0;
        try {
            for (; pressed < scans.Length; pressed++) {
                Scan(window, scans[pressed], false);
                Thread.Sleep(45);
            }
        } finally {
            while (pressed > 0) {
                Scan(window, scans[--pressed], true);
                Thread.Sleep(30);
            }
        }
    }
}
'@

if ($Action -eq 'focus') {
    [void][SelectionWindowInput]::ShowWindowAsync($window, 3)
    [void][SelectionWindowInput]::SetForegroundWindow($window)
    if ([SelectionWindowInput]::GetForegroundWindow() -ne $window) {
        [void](New-Object -ComObject WScript.Shell).AppActivate($WindowProcessId)
    }
    Start-Sleep -Milliseconds 200
    if ([SelectionWindowInput]::GetForegroundWindow() -ne $window) {
        [SelectionWindowInput]::ClickTitleBar($window)
    }
    if ([SelectionWindowInput]::GetForegroundWindow() -ne $window) {
        throw 'The packaged window could not be foregrounded'
    }
} else {
    [System.UInt16[]] $scans = $Value.Split(',') | ForEach-Object { [Convert]::ToUInt16($_, 16) }
    [SelectionWindowInput]::Chord($window, $scans)
}
