# SPDX-License-Identifier: BSD-3-Clause
param(
  [Parameter(Mandatory=$true)][int]$TestbedProcess,
  [Parameter(Mandatory=$true)][ValidateSet('inspect', 'plus', 'edit', 'tab', 'clickSaved', 'inspectSaved', 'accessibility')][string]$Action,
  [int]$ClickX, [int]$ClickY
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing, System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class TestbedControls {
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct GuiState {
    public int Size, Flags;
    public IntPtr Active, Focus, Capture, MenuOwner, MoveSize, Caret;
    public Rect CaretRect;
  }
  public delegate bool Visit(IntPtr window, IntPtr data);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, Visit visit, IntPtr data);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr window);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr window, StringBuilder name, int length);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int length);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr length, [Out] StringBuilder text);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern uint GetSysColor(int index);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetGUIThreadInfo(uint thread, ref GuiState state);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out Point point);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flags);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);

  public static string ClassOf(IntPtr window) {
    var name = new StringBuilder(96);
    GetClassName(window, name, name.Capacity);
    return name.ToString();
  }
  public static IntPtr FindChild(IntPtr parent, string className) {
    var result = IntPtr.Zero;
    EnumChildWindows(parent, (child, ignored) => {
      if (GetParent(child) != parent || !String.Equals(ClassOf(child), className, StringComparison.OrdinalIgnoreCase)) return true;
      result = child;
      return false;
    }, IntPtr.Zero);
    return result;
  }
}
'@

function Invoke-TestbedClick($parent, $point) {
  $hit = [TestbedControls]::WindowFromPoint($point)
  if ([TestbedControls]::GetAncestor($hit, 2) -ne $parent) {
    throw 'The isolated Testbed is not the target at the requested screen point'
  }
  if ([TestbedControls]::GetForegroundWindow() -ne $parent) {
    [void][TestbedControls]::SetForegroundWindow($parent)
  }
  $cursor = New-Object TestbedControls+Point
  [void][TestbedControls]::GetCursorPos([ref]$cursor)
  try {
    [void][TestbedControls]::SetCursorPos($point.X, $point.Y)
    [TestbedControls]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero)
    [TestbedControls]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)
    if ($Action -eq 'edit') {
      $focused = $false
      $target = New-Object TestbedControls+GuiState
      $target.Size = [Runtime.InteropServices.Marshal]::SizeOf($target)
      for ($attempt = 0; $attempt -lt 5 -and !$focused; $attempt++) {
        $focused = [TestbedControls]::GetForegroundWindow() -eq $parent -and
          [TestbedControls]::GetGUIThreadInfo(0, [ref]$target) -and $target.Focus -eq $hit
        if (!$focused) { Start-Sleep -Milliseconds 50 }
      }
      if (!$focused) { throw 'The isolated Win32 editor did not receive keyboard focus' }
      [System.Windows.Forms.SendKeys]::SendWait('W9')
    }
  } finally {
    [void][TestbedControls]::SetCursorPos($cursor.X, $cursor.Y)
  }
  $hit
}

$previousDpi = [TestbedControls]::SetThreadDpiAwarenessContext([IntPtr](-4))
try {
  $parent = (Get-Process -Id $TestbedProcess).MainWindowHandle
  if ($Action -in 'clickSaved', 'inspectSaved') {
    $point = New-Object TestbedControls+Point
    $point.X = $ClickX
    $point.Y = $ClickY
    $hit = if ($Action -eq 'clickSaved') {
      Invoke-TestbedClick $parent $point
    } else { [TestbedControls]::WindowFromPoint($point) }
    @{ hitClass = [TestbedControls]::ClassOf($hit); hitHandle = $hit.ToInt64() } | ConvertTo-Json -Compress
    return
  }
  $editor = [TestbedControls]::FindChild($parent, 'Edit')
  $foreground = [TestbedControls]::FindChild($parent, 'NelyxSkiaForeground')
  if ($Action -eq 'accessibility') {
    Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
    Add-Type -ReferencedAssemblies Accessibility -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using Accessibility;
public sealed class TestbedEditorAccessibility {
  public object Role { get; private set; }
  public string Name { get; private set; }
  [DllImport("oleacc.dll")]
  private static extern int AccessibleObjectFromWindow(IntPtr window, uint kind, ref Guid iid,
      [MarshalAs(UnmanagedType.Interface)] out IAccessible control);
  public static TestbedEditorAccessibility FromWindow(IntPtr window) {
    var iid = typeof(IAccessible).GUID;
    IAccessible control;
    const uint clientObject = unchecked((uint)-4);
    const int self = 0;
    Marshal.ThrowExceptionForHR(AccessibleObjectFromWindow(window, clientObject, ref iid, out control));
    try {
      return new TestbedEditorAccessibility { Role = control.get_accRole(self), Name = control.get_accName(self) };
    }
    finally { Marshal.ReleaseComObject(control); }
  }
}
'@
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($parent)
    $condition = [System.Windows.Automation.PropertyCondition]::new(
      [System.Windows.Automation.AutomationElement]::ClassNameProperty,
      'Edit',
      [System.Windows.Automation.PropertyConditionFlags]::IgnoreCase
    )
    $editors = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
    $result = @{ visible = 0; role = $null; name = $null; foregroundFocusable = $false }
    if ($foreground -ne [IntPtr]::Zero) {
      $surface = [System.Windows.Automation.AutomationElement]::FromHandle($foreground)
      $result.foregroundFocusable = $surface.Current.IsKeyboardFocusable
    }
    foreach ($entry in $editors) {
      $current = $entry.Current
      if (!$current.IsControlElement -or $current.IsOffscreen) { continue }
      if ($current.NativeWindowHandle -eq $editor.ToInt64() -and $editor -ne [IntPtr]::Zero) {
        $result.visible++
      }
    }
    if ($result.visible -gt 0) {
      $accessible = [TestbedEditorAccessibility]::FromWindow($editor)
      $result.role = $accessible.Role
      $result.name = $accessible.Name
    }
    $result | ConvertTo-Json -Compress
    return
  }
  $visible = $editor -ne [IntPtr]::Zero -and [TestbedControls]::IsWindowVisible($editor)
  $result = @{ handle = $editor.ToInt64(); parent = $parent.ToInt64(); visible = $visible; foregroundHandle = $foreground.ToInt64() }
  if ($visible) {
    $bounds = New-Object TestbedControls+Rect
    if (![TestbedControls]::GetWindowRect($editor, [ref]$bounds)) { throw 'The editor has no screen coordinates' }
    $scale = [TestbedControls]::GetDpiForWindow($parent) / 96
    $result.bounds = @($bounds.Left, $bounds.Top, $bounds.Right, $bounds.Bottom)
    $result.className = [TestbedControls]::ClassOf($editor)
    $point = New-Object TestbedControls+Point
    $point.X = $bounds.Right - [int](105 * $scale)
    $point.Y = $bounds.Top + [int](83 * $scale)
    $image = New-Object System.Drawing.Bitmap(1, 1)
    $drawing = [System.Drawing.Graphics]::FromImage($image)
    try {
      $drawing.CopyFromScreen($point.X, $point.Y, 0, 0, $image.Size)
      $color = $image.GetPixel(0, 0)
      $result.sample = @($color.R, $color.G, $color.B)
      $drawing.CopyFromScreen($bounds.Left + [int](80 * $scale), $bounds.Top + [int](129 * $scale), 0, 0, $image.Size)
      $color = $image.GetPixel(0, 0)
      $result.editorBackground = @($color.R, $color.G, $color.B)
      $windowColor = [TestbedControls]::GetSysColor(5)
      $result.windowColor = @(($windowColor -band 255), (($windowColor -shr 8) -band 255), (($windowColor -shr 16) -band 255))
    } finally {
      $drawing.Dispose()
      $image.Dispose()
    }
    $gui = New-Object TestbedControls+GuiState
    $gui.Size = [Runtime.InteropServices.Marshal]::SizeOf($gui)
    $result.editorFocused = [TestbedControls]::GetGUIThreadInfo(0, [ref]$gui) -and $gui.Focus -eq $editor
    $result.editorCaret = $gui.Caret -eq $editor
    $result.plusPoint = @(($bounds.Right - [int](46 * $scale)), ($bounds.Top + [int](46 * $scale)))
    if ($Action -eq 'tab') {
      if (!$result.editorFocused) { throw 'The Win32 editor needs focus before pressing Tab' }
      [System.Windows.Forms.SendKeys]::SendWait('{TAB}')
    } elseif ($Action -ne 'inspect') {
      if ($Action -eq 'plus') {
        $point.X = $bounds.Right - [int](46 * $scale)
        $point.Y = $bounds.Top + [int](46 * $scale)
      }
      $hit = Invoke-TestbedClick $parent $point
      $result.hitClass = [TestbedControls]::ClassOf($hit)
      $result.hitHandle = $hit.ToInt64()
    }
    $text = New-Object System.Text.StringBuilder(4096)
    [void][TestbedControls]::SendMessage($editor, 0x000D, [IntPtr]($text.Capacity), $text)
    $result.text = $text.ToString()
  } elseif ($Action -ne 'inspect') {
    throw 'The Win32 editor is hidden or has been removed'
  }
  $result | ConvertTo-Json -Compress
} finally {
  [void][TestbedControls]::SetThreadDpiAwarenessContext($previousDpi)
}
