// SPDX-License-Identifier: BSD-3-Clause
// Loaded in memory by check-windows-scroll.ps1 (Windows PowerShell 5.1).
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO.MemoryMappedFiles;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Automation;

namespace Nelyx.ScrollCheck {
  public sealed class Injection {
    public double[] Sent, Lateness;
    public double Started, Ended;
    public int Samples;
  }
  public sealed class Peer {
    public string Name, Help, Role, Id;
    public double X, Y, Width, Height;
    public bool Enabled, Offscreen;
  }
  public sealed class Output : IDisposable {
    public readonly Process Process;
    readonly object inputGate = new object();
    IntPtr window;
    int nativePid, cancelPrecision;
    Task<Injection> precisionTask;
    readonly ConcurrentQueue<string> lines = new ConcurrentQueue<string>();
    public long Dropped;
    public static string Quote(string value) {
      var result = new System.Text.StringBuilder("\""); int slashes = 0;
      foreach (var c in value) {
        if (c == '\\') { ++slashes; continue; }
        if (c == '"') result.Append('\\', slashes * 2 + 1); else result.Append('\\', slashes);
        result.Append(c); slashes = 0;
      }
      return result.Append('\\', slashes * 2).Append('"').ToString();
    }
    public Output(string file, string[] args, string directory, bool trace, bool profile) {
      var start = new ProcessStartInfo(file, String.Join(" ", Array.ConvertAll(args, Quote)));
      start.WorkingDirectory = directory; start.UseShellExecute = false; start.CreateNoWindow = true;
      start.RedirectStandardInput = start.RedirectStandardOutput = start.RedirectStandardError = true;
      start.EnvironmentVariables["NELYX_WINDOWS_SCROLL_DIAGNOSTICS"] = "1";
      start.EnvironmentVariables["NELYX_WINDOWS_INPUT_TRACE"] = trace ? "1" : "0";
      start.EnvironmentVariables["NELYX_WINDOWS_INPUT_TRACE_FULL"] = "1";
      start.EnvironmentVariables["NELYX_V2_CPU_PROFILE"] = profile ? "1" : "0";
      Process = new Process(); Process.StartInfo = start;
      Process.OutputDataReceived += Receive; Process.ErrorDataReceived += Receive;
      Process.Start(); Process.BeginOutputReadLine(); Process.BeginErrorReadLine();
      // .NET Framework's StandardInput getter may flush an encoding preamble
      // while enabling AutoFlush. End that non-command line before sending any
      // protocol command, including when Node passes this pipe to the host.
      Send("");
    }
    void Receive(object sender, DataReceivedEventArgs e) {
      if (e.Data == null) return;
      if (lines.Count >= 4096 || e.Data.Length > 2 * 1024 * 1024) { Interlocked.Increment(ref Dropped); return; }
      lines.Enqueue(e.Data);
    }
    public string[] Take() {
      var result = new List<string>(); string line;
      while (lines.TryDequeue(out line)) result.Add(line);
      return result.ToArray();
    }
    public void Send(string command) {
      // Commands themselves use explicit UTF-8 bytes without another preamble.
      var bytes = System.Text.Encoding.UTF8.GetBytes(command + "\n");
      lock (inputGate) {
        var pipe = Process.StandardInput.BaseStream; pipe.Write(bytes, 0, bytes.Length); pipe.Flush();
        if (window != IntPtr.Zero) Desktop.Wake(window, nativePid);
      }
    }
    public void Bind(IntPtr target, int owner) { Desktop.Wake(target, owner); window = target; nativePid = owner; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateWaitableTimerEx(IntPtr attributes, string name, uint flags, uint access);
    [DllImport("kernel32.dll")] static extern bool SetWaitableTimer(IntPtr timer, ref long due, int period, IntPtr callback, IntPtr arg, bool resume);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    static string Number(double value) { return value.ToString("R", System.Globalization.CultureInfo.InvariantCulture); }
    public Task<Injection> Precision60(double x, double y, int samples, double dx) {
      return Precision60(x, y, samples, dx, true);
    }
    public Task<Injection> Precision60(double x, double y, int samples, double dx, bool stopBeforeLift) {
      if (window == IntPtr.Zero || samples < 1 || samples > 1800 || (precisionTask != null && !precisionTask.IsCompleted))
        throw new InvalidOperationException("60Hz precision injection is unavailable or unbounded");
      cancelPrecision = 0;
      precisionTask = Task.Factory.StartNew(delegate {
        var result = new Injection { Sent = new double[samples], Lateness = new double[samples] };
        var timer = CreateWaitableTimerEx(IntPtr.Zero, null, 2, 0x1F0003);
        if (timer == IntPtr.Zero) throw new InvalidOperationException("High resolution input timer unavailable");
        try {
          result.Started = Desktop.Now;
          Send("precision start " + Number(x) + " " + Number(y) + " 0 0 " + Number(result.Started));
          for (var i = 0; i < samples; ++i) {
            if (Volatile.Read(ref cancelPrecision) != 0) throw new OperationCanceledException("Precision injection stopped");
            var target = result.Started + (i + 1) / 60.0;
            var remaining = target - Desktop.Now;
            if (remaining > 0) {
              long due = -Math.Max(1, (long)Math.Ceiling(remaining * 10000000));
              if (!SetWaitableTimer(timer, ref due, 0, IntPtr.Zero, IntPtr.Zero, false) || WaitForSingleObject(timer, 20000) != 0)
                throw new InvalidOperationException("60Hz precision input timer failed");
            }
            var at = Desktop.Now; result.Sent[i] = at; result.Lateness[i] = Math.Max(0, (at - target) * 1000);
            Send("precision update 0 0 " + Number(dx) + " 0 " + Number(at)); ++result.Samples;
          }
          result.Ended = Desktop.Now;
          // Stop movement before lifting so the requested distance is measured
          // separately from an additional page selected by release momentum.
          if (stopBeforeLift) {
            long liftDelay = -1000000;
            if (!SetWaitableTimer(timer, ref liftDelay, 0, IntPtr.Zero, IntPtr.Zero, false) || WaitForSingleObject(timer, 20000) != 0)
              throw new InvalidOperationException("Precision lift timer failed");
          }
          Send("precision end 0 0 0 0 " + Number(Desktop.Now)); return result;
        } finally { CloseHandle(timer); }
      });
      return precisionTask;
    }
    public void CancelPrecision() { Interlocked.Exchange(ref cancelPrecision, 1); if (precisionTask != null) try { precisionTask.Wait(5000); } catch (AggregateException) {} }
    public void Dispose() { CancelPrecision(); Process.Dispose(); }
  }
  public sealed class Record {
    public ulong Sequence, Stage, Surface, Input;
    public double At, A, B;
  }
  public sealed class Trace : IDisposable {
    readonly MemoryMappedFile mapping;
    readonly MemoryMappedViewAccessor view;
    ulong cursor;
    public ulong Overwritten, Unstable, Through, SampleEvery;
    const int Header = 128, Stages = 32, Capacity = 8192, Entry = 64;
    public Trace(Process process) {
      mapping = MemoryMappedFile.OpenExisting("Local\\NelyxInputTrace.v1." + process.Id, MemoryMappedFileRights.Read);
      try {
        view = mapping.CreateViewAccessor(0, Header + (Stages + Capacity) * Entry, MemoryMappedFileAccess.Read);
        long creation, exit, kernel, user;
        if (!Desktop.GetProcessTimes(process.Handle, out creation, out exit, out kernel, out user) ||
            view.ReadUInt64(0) != 0x4e4c585452414345UL || view.ReadUInt64(8) != 1 ||
            view.ReadUInt64(16) != (ulong)process.Id || view.ReadUInt64(24) != (ulong)creation ||
            view.ReadUInt64(32) != Entry || view.ReadUInt64(40) != Capacity || view.ReadUInt64(72) != 1)
          throw new InvalidOperationException("Input trace identity/layout differs");
        SampleEvery = view.ReadUInt64(48);
      } catch { Dispose(); throw; }
    }
    Record Read(long offset, ulong expected) {
      var first = view.ReadUInt64(offset);
      if (first == 0 || (expected != 0 && first != expected)) return null;
      var result = new Record { Sequence = first, At = view.ReadDouble(offset + 8) / 1000,
        Stage = view.ReadUInt64(offset + 16), Surface = view.ReadUInt64(offset + 32), Input = view.ReadUInt64(offset + 40),
        A = view.ReadDouble(offset + 48), B = view.ReadDouble(offset + 56) };
      Thread.MemoryBarrier();
      return view.ReadUInt64(offset) == first ? result : null;
    }
    public Record[] Drain() {
      Through = view.ReadUInt64(56);
      var result = new List<Record>();
      var first = cursor + 1;
      if (Through >= first && Through - first >= Capacity) {
        var next = Through - Capacity + 1; Overwritten += next - first; first = next;
      }
      for (var sequence = first; sequence <= Through; ++sequence) {
        var record = Read(Header + Stages * Entry + (long)((sequence - 1) % Capacity) * Entry, sequence);
        // A concurrent slot replacement is reported, never parsed as a stable
        // input. The next drain proceeds; no fabricated timestamps or zeros.
        if (record == null) ++Unstable; else result.Add(record);
      }
      cursor = Through; return result.ToArray();
    }
    public void Dispose() { if (view != null) view.Dispose(); if (mapping != null) mapping.Dispose(); }
  }
  public static class Desktop {
    [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] struct Point { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)] struct Mouse { public int X, Y; public uint Data, Flags, Time; public UIntPtr Extra; }
    [StructLayout(LayoutKind.Explicit)] struct Union { [FieldOffset(0)] public Mouse Mouse; }
    [StructLayout(LayoutKind.Sequential)] struct Input { public uint Type; public Union Value; }
    delegate bool EnumWindow(IntPtr window, IntPtr param);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindow callback, IntPtr param);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr window, ref Point point);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(Point point);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr window);
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint from, uint to, bool attach);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
    [DllImport("user32.dll")] static extern uint SendInput(uint count, Input[] inputs, int bytes);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr window, uint message, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int w, int h, uint flags);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("kernel32.dll")] public static extern bool GetProcessTimes(IntPtr handle, out long creation, out long exit, out long kernel, out long user);
    static Desktop() { SetProcessDpiAwarenessContext(new IntPtr(-4)); }
    public static double Now { get { return (double)Stopwatch.GetTimestamp() / Stopwatch.Frequency; } }
    public static IntPtr Window(int process) {
      IntPtr found = IntPtr.Zero;
      EnumWindows(delegate(IntPtr window, IntPtr ignored) {
        uint owner; GetWindowThreadProcessId(window, out owner);
        if (owner == process && IsWindowVisible(window)) { found = window; return false; } return true;
      }, IntPtr.Zero); return found;
    }
    public static Rect Client(IntPtr window) {
      Rect rect; Point origin = new Point();
      if (!GetClientRect(window, out rect) || !ClientToScreen(window, ref origin)) throw new InvalidOperationException("Client geometry unavailable");
      rect.Left += origin.X; rect.Right += origin.X; rect.Top += origin.Y; rect.Bottom += origin.Y; return rect;
    }
    public static Peer[] Peers(IntPtr window) {
      AutomationElementCollection all;
      var cache = new CacheRequest(); cache.TreeScope = TreeScope.Element;
      foreach (var property in new[] { AutomationElement.NameProperty, AutomationElement.HelpTextProperty,
        AutomationElement.ControlTypeProperty, AutomationElement.AutomationIdProperty, AutomationElement.BoundingRectangleProperty,
        AutomationElement.IsEnabledProperty, AutomationElement.IsOffscreenProperty }) cache.Add(property);
      using (cache.Activate()) {
        try { all = AutomationElement.FromHandle(window).FindAll(TreeScope.Descendants, Condition.TrueCondition); }
        catch (ElementNotAvailableException) { return new Peer[0]; }
      }
      if (all.Count > 8192) throw new InvalidOperationException("UIA query exceeded its bound");
      var result = new List<Peer>();
      foreach (AutomationElement element in all) {
        try {
          var current = element.Cached; var bounds = current.BoundingRectangle;
          result.Add(new Peer { Name = current.Name, Help = current.HelpText, Role = current.ControlType.ProgrammaticName, Id = current.AutomationId,
            X = bounds.X, Y = bounds.Y, Width = bounds.Width, Height = bounds.Height,
            Enabled = current.IsEnabled, Offscreen = current.IsOffscreen });
        } catch (ElementNotAvailableException) {
          // A publication can retire a peer between FindAll and a property
          // read. The caller's bounded transition wait queries the new tree.
        }
      }
      return result.ToArray();
    }
    public static bool HasMonth(IntPtr window, string month) {
      try {
        var condition = new AndCondition(new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button),
          new OrCondition(new PropertyCondition(AutomationElement.NameProperty, month),
            new PropertyCondition(AutomationElement.NameProperty, "Select year\n" + month)));
        var peer = AutomationElement.FromHandle(window).FindFirst(TreeScope.Descendants, condition);
        return peer != null && !peer.Current.IsOffscreen;
      } catch (ElementNotAvailableException) { return false; }
    }
    public static Peer PageViewport(IntPtr window, string day) {
      var cell = AutomationElement.FromHandle(window).FindFirst(TreeScope.Descendants,
        new PropertyCondition(AutomationElement.NameProperty, day));
      if (cell == null) throw new InvalidOperationException("Calendar origin day unavailable");
      var bounds = cell.Current.BoundingRectangle;
      for (var i = 0; i < 8; ++i) {
        cell = TreeWalker.ControlViewWalker.GetParent(cell); if (cell == null) break;
        var rect = cell.Current.BoundingRectangle;
        if (rect.Width > bounds.Width * 2 && rect.Height > bounds.Height * 2)
          return new Peer { X = rect.X, Y = rect.Y, Width = rect.Width, Height = rect.Height };
      }
      throw new InvalidOperationException("Calendar viewport geometry unavailable");
    }
    public static void Wake(IntPtr window, int process) {
      uint owner; GetWindowThreadProcessId(window, out owner);
      if (owner != process || !PostMessage(window, 0x8005, IntPtr.Zero, IntPtr.Zero))
        throw new InvalidOperationException("Diagnostic wake does not belong to the owned app");
    }
    static void Focus(IntPtr window) {
      if (GetAncestor(GetForegroundWindow(), 2) == GetAncestor(window, 2)) return;
      SetForegroundWindow(window);
      if (GetAncestor(GetForegroundWindow(), 2) != GetAncestor(window, 2)) {
        uint ignored; var thread = GetCurrentThreadId();
        var foreground = GetWindowThreadProcessId(GetForegroundWindow(), out ignored);
        var attached = foreground != 0 && foreground != thread && AttachThreadInput(thread, foreground, true);
        try { BringWindowToTop(window); SetForegroundWindow(window); }
        finally { if (attached) AttachThreadInput(thread, foreground, false); }
      }
      if (GetAncestor(GetForegroundWindow(), 2) != GetAncestor(window, 2))
        throw new InvalidOperationException("Target app does not own foreground input; target=" + window + "; foreground=" + GetForegroundWindow());
    }
    static void Emit(uint flags, uint data, int x, int y) {
      var input = new Input { Value = new Union { Mouse = new Mouse { X = x, Y = y, Data = data, Flags = flags } } };
      if (SendInput(1, new[] { input }, Marshal.SizeOf(typeof(Input))) != 1) throw new InvalidOperationException("SendInput failed");
    }
    public static void Move(IntPtr window, double x, double y) {
      Focus(window); var rect = Client(window); var point = new Point { X = (int)x, Y = (int)y };
      if (point.X < rect.Left || point.Y < rect.Top || point.X >= rect.Right || point.Y >= rect.Bottom)
        throw new InvalidOperationException("Input point is outside the target client");
      if (GetAncestor(WindowFromPoint(point), 2) != GetAncestor(window, 2)) throw new InvalidOperationException("Another window covers the input point");
      var left = GetSystemMetrics(76); var top = GetSystemMetrics(77);
      Emit(0x8000 | 0x4000 | 1, 0, (point.X - left) * 65535 / Math.Max(1, GetSystemMetrics(78) - 1),
        (point.Y - top) * 65535 / Math.Max(1, GetSystemMetrics(79) - 1));
    }
    public static void Click(IntPtr window, Peer peer) {
      if (!peer.Enabled || peer.Offscreen || peer.Width <= 0 || peer.Height <= 0) throw new InvalidOperationException("UIA peer cannot receive input");
      Move(window, peer.X + peer.Width / 2, peer.Y + peer.Height / 2); Emit(2, 0, 0, 0); Emit(4, 0, 0, 0);
    }
    public static void Wheel(IntPtr window, int delta) { Focus(window); Emit(0x800, unchecked((uint)delta), 0, 0); }
    public static void Down(IntPtr window) { Focus(window); Emit(2, 0, 0, 0); }
    public static void Up(IntPtr window) { Focus(window); Emit(4, 0, 0, 0); }
    public static void Resize(IntPtr window, int delta) {
      Rect rect; if (!GetWindowRect(window, out rect) || !SetWindowPos(window, IntPtr.Zero, 0, 0,
        rect.Right - rect.Left + delta, rect.Bottom - rect.Top, 0x2 | 0x4 | 0x10)) throw new InvalidOperationException("Resize failed");
    }
    public static void Close(IntPtr window) { PostMessage(window, 0x10, IntPtr.Zero, IntPtr.Zero); }
    public static void Capture(IntPtr window, string file) {
      var rect = Client(window);
      using (var bitmap = new Bitmap(rect.Right - rect.Left, rect.Bottom - rect.Top)) {
        using (var graphics = Graphics.FromImage(bitmap)) graphics.CopyFromScreen(rect.Left, rect.Top, 0, 0, bitmap.Size);
        bitmap.Save(file, ImageFormat.Png);
      }
    }
  }
}
