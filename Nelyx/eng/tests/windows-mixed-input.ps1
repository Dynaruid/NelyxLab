# SPDX-License-Identifier: BSD-3-Clause
# Real UIA actions and OS keyboard input against one explicitly owned package.
param([Parameter(Mandatory=$true)][int]$AppPid,[switch]$KoreanIme,[switch]$InitialKeyboardProbe,[switch]$ImeOnly,[switch]$ActionsOnly)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MixedInput {
  [StructLayout(LayoutKind.Sequential)] public struct Point { public int X,Y; }
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window,int mode);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window,IntPtr process);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint from,uint to,bool attach);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr window,IntPtr after,int x,int y,int width,int height,uint flags);
  [DllImport("user32.dll")] public static extern void keybd_event(byte key,byte scan,uint flags,UIntPtr extra);
  [DllImport("user32.dll")] public static extern uint MapVirtualKeyW(uint key,uint mode);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool GetPhysicalCursorPos(out Point point);
  [DllImport("user32.dll")] public static extern bool SetPhysicalCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(Point point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window,uint flags);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint x,uint y,int data,UIntPtr extra);
  [DllImport("user32.dll")] public static extern IntPtr GetKeyboardLayout(uint thread);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr LoadKeyboardLayoutW(string id,uint flags);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageW(IntPtr window,uint message,IntPtr wp,IntPtr lp);
}
'@
$app=Get-Process -Id $AppPid
$window=$app.MainWindowHandle
if($window -eq [IntPtr]::Zero){throw 'Owned package window missing'}
$root=[Windows.Automation.AutomationElement]::FromHandle($window)
$scope=[Windows.Automation.TreeScope]::Descendants
$thread=[MixedInput]::GetWindowThreadProcessId($window,[IntPtr]::Zero)
$originalLayout=[MixedInput]::GetKeyboardLayout($thread)
$layoutChanged=$false;$hangulToggled=$false
$oldDpi=[MixedInput]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
$originalPointer=[MixedInput+Point]::new();$pointerSaved=[MixedInput]::GetPhysicalCursorPos([ref]$originalPointer)
$ownedPoint=$null
$checks=@();$ime=@{status='notRequested';physicalKeyboard='unobserved'}
$stage='open'
function Foreground {
  [void][MixedInput]::SetWindowPos($window,[IntPtr]::new(-1),0,0,0,0,0x43)
  $other=[MixedInput]::GetWindowThreadProcessId([MixedInput]::GetForegroundWindow(),[IntPtr]::Zero)
  $self=[MixedInput]::GetCurrentThreadId()
  $attached=$other -ne 0 -and $other -ne $self -and [MixedInput]::AttachThreadInput($self,$other,$true)
  try{[void][MixedInput]::SetForegroundWindow($window)}finally{if($attached){[void][MixedInput]::AttachThreadInput($self,$other,$false)}}
  if([MixedInput]::GetForegroundWindow() -ne $window){throw 'Owned foreground unavailable'}
}
function Lookup([string]$id) {
  $condition=[Windows.Automation.PropertyCondition]::new([Windows.Automation.AutomationElement]::AutomationIdProperty,$id)
  return $root.FindFirst($scope,$condition)
}
function FindId([string]$id,[bool]$visible=$true) {
  for($attempt=0;$attempt -lt 30;$attempt++){
    $element=Lookup $id
    if($element -and (-not $visible -or -not $element.Current.IsOffscreen)){return $element}
    Start-Sleep -Milliseconds 100
  }
  throw ('Missing owned endpoint: '+$id)
}
function InvokeId([string]$id) {
  Foreground
  $element=FindId $id
  ([Windows.Automation.InvokePattern]$element.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke()
  Start-Sleep -Milliseconds 450
}
function Value([string]$id) {
  $element=FindId $id $false
  return ([Windows.Automation.ValuePattern]$element.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern)).Current.Value
}
function WaitValue([string]$id,[string]$text) {
  for($attempt=0;$attempt -lt 30;$attempt++) {
    if((Value $id) -ceq $text){return}
    Start-Sleep -Milliseconds 100
  }
  throw ('Core value did not reach the expected text: '+$id)
}
function SetValue([string]$id,[string]$text) {
  $element=FindId $id
  ([Windows.Automation.ValuePattern]$element.GetCurrentPattern([Windows.Automation.ValuePattern]::Pattern)).SetValue($text)
  for($attempt=0;$attempt -lt 30;$attempt++){
    if((Value $id) -ceq $text){return}
    Start-Sleep -Milliseconds 100
  }
  throw ('Value action did not reach Core: '+$id)
}
function Key([byte]$code) {
  if([MixedInput]::GetForegroundWindow() -ne $window){throw 'Keyboard left the owned window'}
  $scan=[MixedInput]::MapVirtualKeyW($code,4)
  $flags=if(($scan -band 0xff00) -eq 0xe000){1}else{0}
  [MixedInput]::keybd_event($code,[byte]($scan -band 0xff),$flags,[UIntPtr]::Zero)
  [MixedInput]::keybd_event($code,[byte]($scan -band 0xff),($flags -bor 2),[UIntPtr]::Zero)
}
function ClearKeys {
  [MixedInput]::keybd_event(0x11,0,0,[UIntPtr]::Zero)
  try{Key 0x41}finally{[MixedInput]::keybd_event(0x11,0,2,[UIntPtr]::Zero)}
  Key 0x08
  Start-Sleep -Milliseconds 350
}
function CheckRow([int]$index) {
  $id='mixed-scroll-field-'+$index
  SetValue $id ('range-'+$index)
  InvokeId ('mixed-scroll-send-'+$index)
  $prefix=([string][char]0xc804)+([string][char]0xc1a1)+': '
  $status=FindId ('mixed-scroll-status-'+$index)
  if($status.Current.Name -cne ($prefix+'range-'+$index)){throw 'Send did not publish the current text'}
  InvokeId ('mixed-scroll-count-'+$index)
  if((FindId ('mixed-scroll-count-'+$index)).Current.Name -notmatch '1'){throw 'Count action did not update'}
  InvokeId ('mixed-scroll-clear-'+$index)
  if((Value $id) -cne '' -or (FindId ('mixed-scroll-count-'+$index)).Current.Name -notmatch '0'){throw 'Clear did not reset Core state'}
  $script:checks+=@{row=$index;send=$true;count=$true;clear=$true}
}
try {
  [void][MixedInput]::ShowWindow($window,3);Foreground
  Start-Sleep -Milliseconds 500
  if(Lookup 'show-mixed-scroll'){InvokeId 'show-mixed-scroll'}
  [void](FindId 'mixed-scroll-field-0')
  if($InitialKeyboardProbe) {
    $stage='initial-keyboard'
    $first=FindId 'mixed-scroll-field-0';$first.SetFocus();Start-Sleep -Milliseconds 350
    SetValue 'mixed-scroll-field-0' 'initial'
    Key 0x23;Key 0x5a;Key 0x20;Start-Sleep -Milliseconds 500
    $value=Value 'mixed-scroll-field-0'
    if($value -ceq 'initial'){throw 'Initial editor did not receive OS keys'}
    Write-Output ('MIXED_INITIAL_KEYBOARD '+$value)
    return
  }
  $fields=[Collections.Generic.HashSet[string]]::new()
  $buttons=[Collections.Generic.HashSet[string]]::new()
  if(-not $ImeOnly) {
  $stage='range-inventory'
  $bounds=$root.Current.BoundingRectangle
  $ownedPoint=[MixedInput+Point]::new();$ownedPoint.X=[int]($bounds.Left+$bounds.Width*.67);$ownedPoint.Y=[int]($bounds.Top+$bounds.Height*.7)
  if(-not [MixedInput]::SetPhysicalCursorPos($ownedPoint.X,$ownedPoint.Y)){throw 'Owned scroll point unavailable'}
  for($step=0;$step -lt 20;$step++) {
    $nodes=$root.FindAll($scope,[Windows.Automation.Condition]::TrueCondition)
    if($nodes.Count -gt 4096){throw 'Mixed UIA node budget exceeded'}
    foreach($element in $nodes) {
      $id=$element.Current.AutomationId
      if($id -match '^mixed-scroll-field-\d+$'){[void]$fields.Add($id)}
      if($id -match '^mixed-scroll-(send|count|clear)-\d+$'){[void]$buttons.Add($id)}
    }
    if($fields.Count -eq 12 -and $buttons.Count -eq 36){break}
    if([MixedInput]::GetForegroundWindow() -ne $window -or [MixedInput]::GetAncestor([MixedInput]::WindowFromPoint($ownedPoint),2) -ne $window){throw 'Scroll left the owned window'}
    [MixedInput]::mouse_event(0x800,0,0,-480,[UIntPtr]::Zero)
    Start-Sleep -Milliseconds 450
  }
  if($fields.Count -ne 12 -or $buttons.Count -ne 36){throw ('Incomplete mixed range: '+$fields.Count+' fields / '+$buttons.Count+' buttons')}
  InvokeId 'mixed-scroll-first'
  if(-not $ActionsOnly) {
  $first=FindId 'mixed-scroll-field-0';$first.SetFocus()
  Start-Sleep -Milliseconds 350
  if(-not $first.Current.HasKeyboardFocus){throw 'First editor focus unavailable'}
  SetValue 'mixed-scroll-field-0' 'retained'
  for($trial=1;$trial -le 3;$trial++) {
    $stage='range-'+$trial
    InvokeId 'mixed-scroll-last'
    [void](FindId 'mixed-scroll-field-11')
    $offscreen=Lookup 'mixed-scroll-field-0'
    if($offscreen -and -not $offscreen.Current.IsOffscreen){throw 'First editor did not leave the viewport'}
    InvokeId 'mixed-scroll-first'
    $first=FindId 'mixed-scroll-field-0'
    $before=Value 'mixed-scroll-field-0'
    # Intentionally no SetFocus/click after return.
    Key 0x23;Key 0x5a;Key 0x20
    Start-Sleep -Milliseconds 450
    $after=Value 'mixed-scroll-field-0'
    if($after -ceq $before){throw 'Returning editor did not receive OS keys without refocus'}
    $checks+=@{trial=$trial;lastVisible=$true;firstOffscreen=$true;firstReturned=$true;osKeyWithoutRefocus=$true;before=$before;after=$after}
  }
  }
  CheckRow 0
  $stage='last-actions'
  InvokeId 'mixed-scroll-last';CheckRow 11
  InvokeId 'mixed-scroll-first'
  }
  if($KoreanIme) {
    $stage='korean-ime'
    $layout=[MixedInput]::LoadKeyboardLayoutW('00000412',0)
    $ime=@{status='notVerified';layoutAvailable=$layout -ne [IntPtr]::Zero;attempts=@();physicalKeyboard='unobserved'}
    if($layout -ne [IntPtr]::Zero) {
      [void][MixedInput]::SendMessageW($window,0x50,[IntPtr]::Zero,$layout)
      $layoutChanged=$true;Start-Sleep -Milliseconds 500
      $ime.layout=([MixedInput]::GetKeyboardLayout($thread)).ToInt64()
      if(($ime.layout -band 0xffff) -eq 0x412) {
        $first=FindId 'mixed-scroll-field-0';$first.SetFocus();Start-Sleep -Milliseconds 300
        if(-not $first.Current.HasKeyboardFocus){throw 'IME editor focus unavailable'}
        for($attempt=0;$attempt -lt 2;$attempt++) {
          ClearKeys
          $observed=@()
          foreach($code in @(0x47,0x4b,0x53,0x20)){Key ([byte]$code);Start-Sleep -Milliseconds 350;$observed+=Value 'mixed-scroll-field-0'}
          $ime.attempts+=,@($observed)
          $expected=@(([string][char]0x314e),([string][char]0xd558),([string][char]0xd55c),(([string][char]0xd55c)+' '))
          if(($observed -join '|') -ceq ($expected -join '|')){$ime.status='PASS-scoped';break}
          if($attempt -eq 0){Key 0x15;$hangulToggled=-not $hangulToggled;Start-Sleep -Milliseconds 300}
        }
      }
    }
    Write-Output ('WINDOWS_IME '+($ime|ConvertTo-Json -Depth 5 -Compress))
    if($ime.status -eq 'PASS-scoped') {
      $before=Value 'mixed-scroll-field-0'
      ClearKeys
      WaitValue 'mixed-scroll-field-0' ''
      [MixedInput]::keybd_event(0x11,0,0,[UIntPtr]::Zero)
      try{Key 0x5a}finally{[MixedInput]::keybd_event(0x11,0,2,[UIntPtr]::Zero)}
      Start-Sleep -Milliseconds 450
      WaitValue 'mixed-scroll-field-0' $before
      $ime.undoAfterCommit=$true
    }
    if($hangulToggled){Key 0x15;$hangulToggled=$false}
    if($layoutChanged){[void][MixedInput]::SendMessageW($window,0x50,[IntPtr]::Zero,$originalLayout);$layoutChanged=$false}
    InvokeId 'mixed-scroll-clear-0'
  }
  if(Lookup 'mixed-scroll-back'){InvokeId 'mixed-scroll-back'}
  [void](FindId 'show-mixed-scroll')
  Write-Output ('MIXED_INPUT '+(@{fields=$fields.Count;buttons=$buttons.Count;checks=$checks;ime=$ime;back=$true;scope='actual package UIA and OS keys; physical input, native input HWND lifecycle and scanout unobserved'}|ConvertTo-Json -Depth 7 -Compress))
} catch {
  $failure=$_.Exception.Message
  $failureStack=$_.ScriptStackTrace
  $visibleText=@()
  try {
    $remaining=$root.FindAll($scope,[Windows.Automation.Condition]::TrueCondition)
    for($index=0;$index -lt [Math]::Min($remaining.Count,128);$index++) {
      $label=$remaining[$index].Current.Name
      if($label){$visibleText+=$label.Substring(0,[Math]::Min($label.Length,512))}
    }
  } catch {}
  Write-Output ('MIXED_INPUT_FAILURE '+(@{stage=$stage;message=$failure;stack=$failureStack;visibleText=$visibleText}|ConvertTo-Json -Depth 4 -Compress))
  throw
} finally {
  if($hangulToggled -and [MixedInput]::GetForegroundWindow() -eq $window){Key 0x15}
  if($layoutChanged){[void][MixedInput]::SendMessageW($window,0x50,[IntPtr]::Zero,$originalLayout)}
  [void][MixedInput]::SetWindowPos($window,[IntPtr]::new(-2),0,0,0,0,0x43)
  if($pointerSaved -and $ownedPoint){$point=[MixedInput+Point]::new();if([MixedInput]::GetPhysicalCursorPos([ref]$point) -and $point.X -eq $ownedPoint.X -and $point.Y -eq $ownedPoint.Y){[void][MixedInput]::SetPhysicalCursorPos($originalPointer.X,$originalPointer.Y)}}
  if($oldDpi -ne [IntPtr]::Zero){[void][MixedInput]::SetThreadDpiAwarenessContext($oldDpi)}
}
