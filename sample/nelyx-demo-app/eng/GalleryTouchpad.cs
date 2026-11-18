// SPDX-License-Identifier: BSD-3-Clause
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

// Win32 precision touchpad injection uses device coordinates in hundredths of a millimetre.
public static class GalleryTouchpad
{
    [StructLayout(LayoutKind.Sequential)]
    public struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)]
    struct DeviceParams {
        public uint Type, MaxCount, Feedback;
        public IntPtr Monitor;
        public uint Width, Height, Options;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct PointerInfo {
        public uint Type, Id, Frame, Flags;
        public IntPtr Source, Target;
        public Point Pixel, Himetric, RawPixel, RawHimetric;
        public uint Time, History;
        public int InputData;
        public uint Keys;
        public ulong PerformanceCount;
        public uint ButtonChange;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct Rect { public int Left, Top, Right, Bottom; }
    // POINTER_TYPE_INFO uses POINTER_TOUCH_INFO, the largest member of its union.
    [StructLayout(LayoutKind.Sequential)]
    struct Contact {
        public uint Type;
        public PointerInfo Pointer;
        public uint TouchFlags, TouchMask;
        public Rect Area, RawArea;
        public uint Orientation, Pressure;
    }

    [DllImport("user32", SetLastError=true)] static extern IntPtr CreateSyntheticPointerDevice2(ref DeviceParams config);
    [DllImport("user32", SetLastError=true)] static extern bool InjectSyntheticPointerInput(IntPtr device, [In] Contact[] frame, uint count);
    [DllImport("user32")] static extern void DestroySyntheticPointerDevice(IntPtr device);
    [DllImport("user32")] public static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32")] public static extern bool ShowWindowAsync(IntPtr window, int command);
    [DllImport("user32")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32")] public static extern bool GetPhysicalCursorPos(out Point point);
    [DllImport("user32")] public static extern bool SetPhysicalCursorPos(int x, int y);
    [DllImport("user32")] static extern IntPtr WindowFromPhysicalPoint(Point point);
    [DllImport("user32")] static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("kernel32", SetLastError=true)] static extern IntPtr CreateWaitableTimerExW(IntPtr attributes, IntPtr name, uint flags, uint access);
    [DllImport("kernel32", SetLastError=true)] static extern bool SetWaitableTimer(IntPtr timer, ref long due, int period, IntPtr callback, IntPtr argument, bool resume);
    [DllImport("kernel32")] static extern uint WaitForSingleObject(IntPtr handle, uint timeout);
    [DllImport("kernel32")] static extern bool CloseHandle(IntPtr handle);

    public static IntPtr Create() {
        const uint touchpad = 5, feedbackNone = 3, physicalSize = 1, gestureOnly = 2;
        var config = new DeviceParams { Type = touchpad, MaxCount = 2, Feedback = feedbackNone,
            Width = 12000, Height = 9000, Options = physicalSize | gestureOnly };
        var device = CreateSyntheticPointerDevice2(ref config);
        if (device == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error(), "Cannot create a synthetic precision touchpad");
        return device;
    }

    public static void Close(IntPtr device) { DestroySyntheticPointerDevice(device); }

    public static double[] Swipe(IntPtr device, IntPtr window, int x, int y, bool fingersUp, int distance) {
        const int steps = 48, periodMs = 16;
        if (distance < 1 || distance > 7200) throw new ArgumentOutOfRangeException(nameof(distance));
        const uint confidence = 0x4000, inRange = 2, inContact = 4;
        var frame = new Contact[2];
        for (int i = 0; i < frame.Length; i++) {
            frame[i].Type = 5;
            frame[i].Pointer.Id = (uint)i;
            frame[i].Pointer.Himetric.X = 4500 + 2400 * i;
        }
        var gaps = new double[steps + 1];
        long previous = 0;
        long period = (long)Math.Round(Stopwatch.Frequency * periodMs / 1000.0);
        if (GetAncestor(WindowFromPhysicalPoint(new Point { X = x, Y = y }), 2) != window)
            throw new InvalidOperationException("The point to scroll is covered by another window.");
        IntPtr timer = CreateWaitableTimerExW(IntPtr.Zero, IntPtr.Zero, 2, 0x100002);
        if (timer == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        try {
            for (int step = 0; step <= steps + 1; step++) {
                if (step > 0) {
                    long due = previous + period; // Do not burst to catch up after a late delivery.
                    long remaining = due - Stopwatch.GetTimestamp() - Stopwatch.Frequency / 1000;
                    if (remaining > 0) {
                        long relative100ns = -Math.Max(1, remaining * 10000000 / Stopwatch.Frequency);
                        if (!SetWaitableTimer(timer, ref relative100ns, 0, IntPtr.Zero, IntPtr.Zero, false))
                            throw new Win32Exception(Marshal.GetLastWin32Error());
                        if (WaitForSingleObject(timer, 1000) != 0) throw new TimeoutException("Gesture timer timed out");
                    }
                    while (Stopwatch.GetTimestamp() < due) Thread.SpinWait(16);
                }
                Point cursor;
                if (!GetPhysicalCursorPos(out cursor) || cursor.X != x || cursor.Y != y ||
                    GetForegroundWindow() != window)
                    throw new InvalidOperationException("Demo lost the cursor or foreground during a gesture.");
                for (int i = 0; i < frame.Length; i++) {
                    int travel = distance * Math.Min(step, steps) / steps;
                    frame[i].Pointer.Himetric.Y = fingersUp ? 8100 - travel : 900 + travel;
                    frame[i].Pointer.Flags = step > steps ? confidence : confidence | inRange | inContact;
                    frame[i].Pointer.Time = (uint)(1 + step * periodMs);
                }
                long now = Stopwatch.GetTimestamp();
                if (!InjectSyntheticPointerInput(device, frame, 2)) throw new Win32Exception(Marshal.GetLastWin32Error());
                if (step > 0) gaps[step - 1] = (now - previous) * 1000.0 / Stopwatch.Frequency;
                previous = now;
            }
        } finally {
            CloseHandle(timer);
        }
        return gaps;
    }
}
