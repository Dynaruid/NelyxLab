// SPDX-License-Identifier: BSD-3-Clause
using System;
using System.Collections.Generic;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;

public static partial class JankScreen {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  struct MonitorInfo {
    public int size;
    public FastCalendarInput.Rect monitor, work;
    public uint flags;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string device;
  }
  [StructLayout(LayoutKind.Explicit, Size=220)]
  struct DisplayMode {
    [FieldOffset(68)] public ushort size;
    [FieldOffset(184)] public uint frequency;
  }
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern bool EnumDisplaySettings(string device, int index, ref DisplayMode mode);
  public static string Display(IntPtr window) {
    var info = new MonitorInfo { size = Marshal.SizeOf<MonitorInfo>() };
    var mode = new DisplayMode { size = (ushort)Marshal.SizeOf<DisplayMode>() };
    if (!GetMonitorInfo(MonitorFromWindow(window, 2), ref info) ||
        !EnumDisplaySettings(info.device, -1, ref mode) || mode.frequency <= 1)
      throw new Exception("Calendar display mode unavailable");
    return info.device + " @ " + mode.frequency + " Hz";
  }
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string title);
  [DllImport("oleacc.dll")]
  static extern int AccessibleObjectFromWindow(IntPtr window, uint id, ref Guid iid,
    [MarshalAs(UnmanagedType.Interface)] out object accessible);
  [DllImport("oleacc.dll")]
  static extern int AccessibleChildren([MarshalAs(UnmanagedType.Interface)] object parent, int start,
    int count, [Out, MarshalAs(UnmanagedType.LPArray, SizeParamIndex=2)] object[] children, out int obtained);

  // Flutter's stock Windows engine exposes MSAA on the child view HWND.
  public static string[] FlutterNames(IntPtr window) {
    var names = new List<string>();
    var view = FindWindowEx(window, IntPtr.Zero, "FLUTTERVIEW", null);
    var iid = new Guid("618736E0-3C3D-11CF-810C-00AA00389B71");
    object root;
    if (view != IntPtr.Zero && AccessibleObjectFromWindow(view, 0xfffffffc, ref iid, out root) == 0) {
      var pending = new Stack<object>();
      pending.Push(root);
      int visited = 0;
      while (pending.Count > 0 && visited++ < 1024) {
        object node = pending.Pop();
        try {
          var type = node.GetType();
          string name = type.InvokeMember("accName", BindingFlags.GetProperty, null, node, new object[]{0}) as string;
          if (!string.IsNullOrEmpty(name)) names.Add(name);
          int count = (int)type.InvokeMember("accChildCount", BindingFlags.GetProperty, null, node, null);
          if (count <= 0 || count > 1024) continue;
          var children = new object[count]; int actual;
          if (AccessibleChildren(node, 0, count, children, out actual) < 0) continue;
          for (int i = 0; i < actual; i++) {
            var child = children[i];
            if (child is int) {
              var label = type.InvokeMember("accName", BindingFlags.GetProperty, null, node, new object[]{child}) as string;
              if (!string.IsNullOrEmpty(label)) names.Add(label);
            } else if (child != null) pending.Push(child);
          }
        } finally { Marshal.ReleaseComObject(node); }
      }
    }
    return names.ToArray();
  }
  public sealed class CalendarContent {
    public List<double> Changes = new List<double>();
    public int Captures;
    public double MaximumIntervalMs, Ended;
    public FastCalendarInput.SwipeResult Input;
  }

  // A strip across the date grid, away from the injected contact and header.
  // Both apps use a centered 360 x 400 logical calendar on the same display.
  static CalendarContent ReadGrid(IntPtr window, int x, int y, int width, int height,
      ManualResetEventSlim ready, CancellationToken token) {
    var result = new CalendarContent();
    IntPtr screen = IntPtr.Zero, memory = IntPtr.Zero, bitmap = IntPtr.Zero, old = IntPtr.Zero, bits;
    IntPtr dpi = SetThreadDpiAwarenessContext(new IntPtr(-4));
    try {
      screen = GetDC(IntPtr.Zero);
      memory = CreateCompatibleDC(screen);
      var info = new BitmapInfo { Size=40, Width=width, Height=-height, Planes=1, Bits=32 };
      bitmap = CreateDIBSection(screen, ref info, 0, out bits, IntPtr.Zero, 0);
      if (screen == IntPtr.Zero || memory == IntPtr.Zero || bitmap == IntPtr.Zero || bits == IntPtr.Zero)
        throw new Exception("Calendar capture allocation failed");
      old = SelectObject(memory, bitmap);
      var previous = new int[width * height];
      var pixels = new int[previous.Length];
      double last = 0, lastChange = Now();
      while (!token.IsCancellationRequested) {
        if (GetForegroundWindow() != window) throw new Exception("Calendar lost foreground");
        double start = Now();
        if (!BitBlt(memory, 0, 0, width, height, screen, x, y, 0x40cc0020) || !GdiFlush())
          throw new Exception("Calendar desktop read failed");
        double at = (start + Now()) / 2;
        if (last > 0) result.MaximumIntervalMs = Math.Max(result.MaximumIntervalMs, at - last);
        last = at;
        Marshal.Copy(bits, pixels, 0, pixels.Length);
        if (result.Captures > 0 && !pixels.AsSpan().SequenceEqual(previous)) {
          result.Changes.Add(at);
          lastChange = at;
        }
        var swap = previous; previous = pixels; pixels = swap;
        result.Captures++;
        if (at - lastChange >= 400) ready.Set();
        Thread.Sleep(1);
      }
      result.Ended = Now();
      return result;
    } finally {
      if (old != IntPtr.Zero) SelectObject(memory, old);
      if (bitmap != IntPtr.Zero) DeleteObject(bitmap);
      if (memory != IntPtr.Zero) DeleteDC(memory);
      if (screen != IntPtr.Zero) ReleaseDC(IntPtr.Zero, screen);
      SetThreadDpiAwarenessContext(dpi);
    }
  }

  public static CalendarContent MeasureContent(IntPtr window, int count, int moveMs, int gapMs, int direction) {
    var origin = new Point();
    FastCalendarInput.Rect rect;
    if (!ClientToScreen(window, ref origin) || !FastCalendarInput.GetClientRect(window, out rect))
      throw new Exception("Calendar geometry unavailable");
    int cx = origin.X + rect.Right / 2, cy = origin.Y + rect.Bottom / 2;
    double scale = GetDpiForWindow(window) / 96.0;
    int reach = (int)Math.Round(114 * scale) * direction;
    using (var cancel = new CancellationTokenSource())
    using (var ready = new ManualResetEventSlim()) {
      var capture = Task.Run(() => ReadGrid(window, cx - (int)(150 * scale), cy - (int)(65 * scale),
        (int)(300 * scale), (int)(74 * scale), ready, cancel.Token));
      FastCalendarInput.SwipeResult input;
      try {
        if (!ready.Wait(5000)) throw new Exception("Calendar observer failed to start");
        input = FastCalendarInput.Swipes(window, count, moveMs, gapMs, 60, cx + reach, cx - reach, cy + (int)(66 * scale));
        Thread.Sleep(3000);
      } finally {
        cancel.Cancel();
        capture.GetAwaiter().GetResult();
      }
      var observed = capture.Result;
      observed.Input = input;
      return observed;
    }
  }
}
