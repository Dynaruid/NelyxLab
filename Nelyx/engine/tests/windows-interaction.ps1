param([Parameter(Mandatory = $true)][int]$ProcessId)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class NelyxPointerProbe {
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X, Y; }
  [DllImport("user32.dll")] static extern bool ScreenToClient(IntPtr window, ref Point point);
  [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr window, uint message, IntPtr w, IntPtr l);
  static IntPtr Position(IntPtr window, double x, double y) { var point = new Point { X = (int)x, Y = (int)y }; if (!ScreenToClient(window, ref point)) throw new InvalidOperationException("Screen mapping failed"); return (IntPtr)((point.Y << 16) | (point.X & 65535)); }
  public static void Click(IntPtr window, double x, double y) { var p = Position(window, x, y); SendMessage(window, 0x201, (IntPtr)1, p); SendMessage(window, 0x202, IntPtr.Zero, p); }
}
'@
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$taskProcess = Get-Process -Id $ProcessId
$root = [System.Windows.Automation.AutomationElement]::FromHandle($taskProcess.MainWindowHandle)
$label = [string][char]0xc785 + [char]0xb825
$condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, $label)
$editor = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
if ($null -eq $editor) { throw 'Published editor is missing from UIA' }
$value = $editor.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
$text = $editor.GetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern)
$initial = $text.DocumentRange.GetText(-1)
if ($initial.Length -lt 4) { throw 'UIA did not read the Core editing document' }
$rectangles = $text.DocumentRange.GetBoundingRectangles()
if ($rectangles.Length -eq 0) { throw 'Published paragraph geometry is missing' }
$editor.SetFocus()
$replacement = 'A' + [char]::ConvertFromUtf32(0x1f600) + [char]0xd55c
$value.SetValue($replacement)
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  if ($value.Current.Value -eq $replacement) { break }
  Start-Sleep -Milliseconds 20
}
if ($value.Current.Value -ne $replacement) { throw 'UIA value did not reach Core' }
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  $range = $text.DocumentRange.Clone()
  $range.MoveEndpointByRange([System.Windows.Automation.Text.TextPatternRangeEndpoint]::End, $range, [System.Windows.Automation.Text.TextPatternRangeEndpoint]::Start)
  $moved = $range.MoveEndpointByUnit([System.Windows.Automation.Text.TextPatternRangeEndpoint]::End, [System.Windows.Automation.Text.TextUnit]::Character, 2)
  if ($moved -eq 2) { break }
  Start-Sleep -Milliseconds 20
}
if ($moved -ne 2 -or $range.GetText(-1) -ne ('A' + [char]::ConvertFromUtf32(0x1f600))) { throw 'UIA grapheme navigation split the document incorrectly' }
$first = $text.DocumentRange.Clone()
$first.MoveEndpointByRange([System.Windows.Automation.Text.TextPatternRangeEndpoint]::End, $first, [System.Windows.Automation.Text.TextPatternRangeEndpoint]::Start)
$null = $first.MoveEndpointByUnit([System.Windows.Automation.Text.TextPatternRangeEndpoint]::End, [System.Windows.Automation.Text.TextUnit]::Character, 1)
$firstBounds = $first.GetBoundingRectangles()[0]
[NelyxPointerProbe]::Click($taskProcess.MainWindowHandle, $firstBounds.X + $firstBounds.Width * 0.85, $firstBounds.Y + $firstBounds.Height / 2)
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  $selected = $text.GetSelection()[0]
  $offset = $selected.CompareEndpoints([System.Windows.Automation.Text.TextPatternRangeEndpoint]::Start, $text.DocumentRange, [System.Windows.Automation.Text.TextPatternRangeEndpoint]::Start)
  if ($offset -eq 1 -and $selected.GetText(-1) -eq '') { break }
  Start-Sleep -Milliseconds 20
}
if ($offset -ne 1 -or $selected.GetText(-1) -ne '') { throw 'Native pointer did not place the Core caret using the published paragraph' }
$range.Select()
$buttonCondition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, 'Update title')
$button = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $buttonCondition)
if ($null -eq $button) { throw 'Published button is missing from UIA' }
$invoke = $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
$invoke.Invoke()
@{ profile = 'TSF/UIA'; utf16Length = $replacement.Length; graphemesMoved = $moved; rectangles = $rectangles.Length; pointerCaret = $offset } | ConvertTo-Json -Compress
