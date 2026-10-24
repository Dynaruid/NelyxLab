# SPDX-License-Identifier: BSD-3-Clause
# Operate the built package through its real Windows accessibility/input ports.
param([Parameter(Mandatory=$true)][int]$AppPid,[switch]$SnapshotOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class PackageInput {
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window,int mode);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,IntPtr process);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint from,uint to,bool attach);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool SetPhysicalCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern bool GetPhysicalCursorPos(out Point point);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,int data,UIntPtr extra);
  [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
}
'@
$app=Get-Process -Id $AppPid
$window=$app.MainWindowHandle
if($window -eq [IntPtr]::Zero){throw 'Package window missing'}
[void][PackageInput]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
[void][PackageInput]::ShowWindow($window,3)
function Foreground {
  [void][PackageInput]::SetWindowPos($window,[IntPtr]::new(-1),0,0,0,0,0x43)
  $foregroundThread=[PackageInput]::GetWindowThreadProcessId([PackageInput]::GetForegroundWindow(),[IntPtr]::Zero)
  $currentThread=[PackageInput]::GetCurrentThreadId()
  $attached=$foregroundThread -ne 0 -and $foregroundThread -ne $currentThread -and [PackageInput]::AttachThreadInput($currentThread,$foregroundThread,$true)
  try {[void][PackageInput]::SetForegroundWindow($window)} finally {if($attached){[void][PackageInput]::AttachThreadInput($currentThread,$foregroundThread,$false)}}
  if([PackageInput]::GetForegroundWindow() -ne $window){throw 'Package did not acquire its own foreground window'}
}
Foreground
Start-Sleep -Milliseconds 500
$root=[System.Windows.Automation.AutomationElement]::FromHandle($window)
$scope=[System.Windows.Automation.TreeScope]::Descendants
$original=[PackageInput+Point]::new()
$restore=[PackageInput]::GetPhysicalCursorPos([ref]$original)
$ownedPoint=[PackageInput+Point]::new()
$pointerOwned=$false
function Nodes {
  $values=$root.FindAll($scope,[System.Windows.Automation.Condition]::TrueCondition)
  if($values.Count -gt 4096){throw 'Package UIA tree exceeded4096'}
  return ,$values
}
function Lookup([string]$id) {
  $condition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,$id)
  return $root.FindFirst($scope,$condition)
}
function Visible($element) {
  if(!$element -or $element.Current.IsOffscreen){return $false}
  $bounds=$element.Current.BoundingRectangle
  $viewport=$root.Current.BoundingRectangle
  return $bounds.Width -gt 0 -and $bounds.Height -gt 0 -and $bounds.Top -ge $viewport.Top+40 -and $bounds.Bottom -le $viewport.Bottom-100
}
function FindId([string]$id) {
  for($attempt=0;$attempt -lt 30;$attempt++) {
    $element=Lookup $id
    if(Visible $element){return $element}
    Start-Sleep -Milliseconds 100
  }
  throw ('Package action missing: '+$id)
}
function InvokeId([string]$id) {
  Foreground
  $element=FindId $id
  $bounds=$element.Current.BoundingRectangle
  $script:ownedPoint.X=[int]($bounds.Left+$bounds.Width*.5);$script:ownedPoint.Y=[int]($bounds.Top+$bounds.Height*.5)
  if(![PackageInput]::SetPhysicalCursorPos($ownedPoint.X,$ownedPoint.Y)){throw 'Package click pointer positioning failed'}
  $script:pointerOwned=$true
  Start-Sleep -Milliseconds 150
  [PackageInput]::mouse_event(0x0002,0,0,0,[UIntPtr]::Zero)
  [PackageInput]::mouse_event(0x0004,0,0,0,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 350
}
function ScreenText {
  # Plain descendant Text widgets are painted but are not all exported as UIA
  # labels. Read their actual pixels rather than treating missing labels as
  # missing product state. No image or OCR log is written to disk.
  Add-Type -AssemblyName System.Drawing,System.Windows.Forms,System.Runtime.WindowsRuntime
  [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
  [Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
  [Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
  [Windows.Graphics.Imaging.SoftwareBitmap,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
  [Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
  [Windows.Storage.Streams.DataWriter,Windows.Foundation,ContentType=WindowsRuntime] | Out-Null
  $asTask=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'} | Select-Object -First 1
  function Await($operation,[Type]$type) {$task=$asTask.MakeGenericMethod($type).Invoke($null,@($operation));if(!$task.Wait(10000)){throw 'Screen OCR timed out'};return $task.Result}
  $bounds=$root.Current.BoundingRectangle
  $screen=[System.Windows.Forms.SystemInformation]::VirtualScreen
  $left=[int][math]::Max($screen.Left,$bounds.Left);$top=[int][math]::Max($screen.Top,$bounds.Top)
  $bitmap=[System.Drawing.Bitmap]::new([int]([math]::Min($screen.Right,$bounds.Right)-$left),[int]([math]::Min($screen.Bottom,$bounds.Bottom)-$top))
  $graphics=[System.Drawing.Graphics]::FromImage($bitmap);$stream=[System.IO.MemoryStream]::new()
  $random=[Windows.Storage.Streams.InMemoryRandomAccessStream]::new();$writer=[Windows.Storage.Streams.DataWriter]::new($random);$software=$null
  try {
    $graphics.CopyFromScreen($left,$top,0,0,$bitmap.Size);$bitmap.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
    $writer.WriteBytes($stream.ToArray());[void](Await $writer.StoreAsync() ([uint32]));$random.Seek(0)
    $decoder=Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($random)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $software=Await $decoder.GetSoftwareBitmapAsync() ([Windows.Graphics.Imaging.SoftwareBitmap])
    $engine=[Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages();if(!$engine){throw 'Configured Windows OCR language unavailable'}
    $result=Await $engine.RecognizeAsync($software) ([Windows.Media.Ocr.OcrResult])
    return $result.Text
  } finally {if($software){$software.Dispose()};$writer.Dispose();$random.Dispose();$stream.Dispose();$graphics.Dispose();$bitmap.Dispose()}
}
function WaitName([string]$text) {
  for($attempt=0;$attempt -lt 5;$attempt++) {
    foreach($element in (Nodes)){if($element.Current.Name.Contains($text)){return}}
    Start-Sleep -Milliseconds 100
  }
  $pixels=ScreenText
  $normalize={param($value)($value -replace '[^\p{L}\p{N}]','').ToLowerInvariant()}
  if((&$normalize $pixels).Contains((&$normalize $text))){Write-Output ('PACKAGED_PIXEL_TEXT '+$text);return}
  throw ('Package text missing: '+$text+'; visible='+(@(foreach($element in (Nodes)){$element.Current.Name}) -join ' | '))
}
function ScrollFind([string]$id) {
  for($attempt=0;$attempt -lt 12;$attempt++) {
    $element=Lookup $id
    if(Visible $element){return $element}
    $bounds=$root.Current.BoundingRectangle
    $target=if($element){$element.Current.BoundingRectangle}else{$null}
    $script:ownedPoint.X=if($target -and $target.Width -gt 0){[int]($target.Left+$target.Width*.5)}else{[int]($bounds.Left+$bounds.Width*.35)}
    $script:ownedPoint.Y=[int]($bounds.Top+$bounds.Height*.65)
    if(![PackageInput]::SetPhysicalCursorPos($ownedPoint.X,$ownedPoint.Y)){throw 'Package pointer positioning failed'}
    $script:pointerOwned=$true
    [PackageInput]::mouse_event(0x0800,0,0,-240,[UIntPtr]::Zero)
    Start-Sleep -Milliseconds 200
  }
  throw ('Package scrolling did not expose: '+$id)
}
function SetValue([string]$id,[string]$text) {
  $element=ScrollFind $id
  $element.SetFocus()
  Start-Sleep -Milliseconds 300
  for($attempt=0;$attempt -lt 3;$attempt++) {
    $element=FindId $id
    ([System.Windows.Automation.ValuePattern]$element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).SetValue($text)
    Start-Sleep -Milliseconds 300
    $value=([System.Windows.Automation.ValuePattern](FindId $id).GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).Current.Value
    if($value -eq $text){return}
  }
  throw ('Core did not acknowledge UIA value: '+$id+' actual='+$value)
}
function EnterKey {
  Foreground
  [PackageInput]::keybd_event(13,0,0,[UIntPtr]::Zero)
  [PackageInput]::keybd_event(13,0,2,[UIntPtr]::Zero)
  Start-Sleep -Milliseconds 300
}
function Form([string]$prefix,[string]$saved,[string]$reset) {
  SetValue ($prefix+'name') 'Ada'
  EnterKey
  $focused=[System.Windows.Automation.AutomationElement]::FocusedElement
  if($focused.Current.AutomationId -ne ($prefix+'email')){throw ('Next did not focus email: '+$focused.Current.AutomationId)}
  SetValue ($prefix+'email') 'ada@example.test'
  EnterKey
  [void](ScrollFind ($prefix+'reset'))
  WaitName $saved
  InvokeId ($prefix+'reset')
  WaitName $reset
  foreach($field in @('name','email')) {
    $element=FindId ($prefix+$field)
    $value=([System.Windows.Automation.ValuePattern]$element.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)).Current.Value
    if($value -ne ''){throw ('Form reset retained '+$field)}
  }
}
try {
  if($SnapshotOnly) {
    @(foreach($element in (Nodes)){[pscustomobject]@{id=$element.Current.AutomationId;name=$element.Current.Name;offscreen=$element.Current.IsOffscreen}}) | ConvertTo-Json -Compress -Depth 3
    return
  }
  InvokeId 'seed-1';InvokeId 'toggle-theme';InvokeId 'seed-0';InvokeId 'toggle-theme'
  InvokeId 'category-containment';[void](ScrollFind 'open-dialog');InvokeId 'open-dialog'
  InvokeId 'gallery-dialog-close';WaitName 'Dialog closed'
  InvokeId 'category-text'
  Form 'form-' 'Saved: Ada' 'Form reset'
  InvokeId 'show-cupertino';InvokeId 'cupertino-toggle-theme';InvokeId 'cupertino-toggle-theme';InvokeId 'cupertino-toggle-planned'
  InvokeId 'cupertino-category-containment';[void](ScrollFind 'cupertino-open-dialog');InvokeId 'cupertino-open-dialog'
  InvokeId 'cupertino-dialog-close';WaitName 'Cupertino dialog closed'
  InvokeId 'cupertino-category-navigation';[void](ScrollFind 'cupertino-open-route');InvokeId 'cupertino-open-route'
  WaitName 'Named route · count: 0';InvokeId 'cupertino-route-increment';WaitName 'Named route · count: 1'
  InvokeId 'cupertino-route-return';WaitName 'Cupertino route result: 1'
  InvokeId 'cupertino-open-route';WaitName 'Named route · count: 0'
  InvokeId 'cupertino-route-increment';InvokeId 'cupertino-route-reset';WaitName 'Named route · count: 0'
  InvokeId 'cupertino-route-return';WaitName 'Cupertino route result: 0'
  InvokeId 'show-material';InvokeId 'show-cupertino';WaitName 'Cupertino route result: 0'
  Write-Output 'PACKAGED_WINDOWS_INTERACTION PASS OS pointer seed/theme/both dialogs, Material Form UIA edits/OS Next/Done/reset, route increment/result/new-state/reset and design return; planned Cupertino Form is outside the existing product'
} catch {
  Add-Type -AssemblyName System.Drawing,System.Windows.Forms
  $bounds=$root.Current.BoundingRectangle
  $screen=[System.Windows.Forms.SystemInformation]::VirtualScreen
  $left=[int][math]::Max($screen.Left,$bounds.Left)
  $top=[int][math]::Max($screen.Top,$bounds.Top+$bounds.Height*.35)
  $width=[int]([math]::Min($screen.Right,$bounds.Right)-$left)
  $height=[int]([math]::Min($screen.Bottom,$bounds.Bottom)-$top)
  $bitmap=[System.Drawing.Bitmap]::new($width,$height)
  $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
  $stream=[System.IO.MemoryStream]::new()
  try {$graphics.CopyFromScreen($left,$top,0,0,$bitmap.Size);$bitmap.Save($stream,[System.Drawing.Imaging.ImageFormat]::Jpeg);Write-Output ('PACKAGED_SCREENSHOT '+[Convert]::ToBase64String($stream.ToArray()))} finally {$stream.Dispose();$graphics.Dispose();$bitmap.Dispose()}
  throw
} finally {
  if($restore -and $pointerOwned){$current=[PackageInput+Point]::new();if([PackageInput]::GetPhysicalCursorPos([ref]$current) -and $current.X -eq $ownedPoint.X -and $current.Y -eq $ownedPoint.Y){[void][PackageInput]::SetPhysicalCursorPos($original.X,$original.Y)}}
}
