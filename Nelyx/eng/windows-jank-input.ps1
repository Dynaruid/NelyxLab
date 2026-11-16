param(
  [Parameter(Mandatory)][string]$Package,
  [Parameter(Mandatory)][ValidateSet('Setup','SetupGallery','SetupTestbed','SetupList','SnapshotList','Capture','Wheel','Editor','Swipe','Snapshot','Close')][string]$Action,
  [int]$Count = 0, [int]$MoveMs = 6, [int]$GapMs = 16, [int]$Direction = 1,
  [ValidateRange(1,240)][double]$InputHz = 60,
  [string]$ExpectedMonth = '', [string]$CapturePath = '', [int]$Delta = -120
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Drawing
Add-Type -Path (Join-Path $PSScriptRoot 'windows-jank-input.cs')
$targetExe = Join-Path ([IO.Path]::GetFullPath($Package)) 'NelyxHermesHost.exe'
$owned = @(Get-CimInstance Win32_Process -Filter "Name='NelyxHermesHost.exe'" | Where-Object { $_.ExecutablePath -eq $targetExe })
if ($owned.Count -ne 1) { throw "Expected one owned native process, found $($owned.Count)" }
$process = Get-Process -Id $owned[0].ProcessId
$window = $process.MainWindowHandle
if ($window -eq [IntPtr]::Zero) { throw 'Owned native window unavailable' }
$oldDpi = [FastCalendarInput]::SetThreadDpiAwarenessContext([IntPtr](-4))
function Assert-Foreground {
  if ([FastCalendarInput]::GetForegroundWindow() -ne $window) { throw 'Owned window lost foreground' }
}
function Get-Buttons {
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($window)
  $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button)
  $all = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition)
  foreach ($node in $all) {
    try {
      $current=$node.Current; $rect=$current.BoundingRectangle
      if ($null -ne $current.ControlType -and !$current.IsOffscreen -and $rect.Width -gt 0 -and $rect.Height -gt 0) {
        [pscustomobject]@{ Name=$current.Name; Id=$current.AutomationId; X=$rect.X; Y=$rect.Y; Width=$rect.Width; Height=$rect.Height }
      }
    } catch [System.Windows.Automation.ElementNotAvailableException] { }
  }
}
function Click-Button([string]$name,[string]$id) {
  $until=[Diagnostics.Stopwatch]::StartNew()
  do {
    $matches=@(Get-Buttons | Where-Object { if ($id) { $_.Id -eq $id } else { $_.Name -eq $name } })
    if ($matches.Count -eq 1) { break }
    Start-Sleep -Milliseconds 100
  } while ($until.ElapsedMilliseconds -lt 5000)
  if ($matches.Count -ne 1) { throw "Button unavailable: $name / $id ($($matches.Count)); visible=$(@(Get-Buttons) | ConvertTo-Json -Compress)" }
  Assert-Foreground
  $button=$matches[0]
  [FastCalendarInput]::Click([int]($button.X+$button.Width/2),[int]($button.Y+$button.Height/2))
  Start-Sleep -Milliseconds 400
}
function Get-Calendar {
  $buttons=@(Get-Buttons)
  $header=@($buttons | Where-Object { $_.Name -like 'Select year*' })
  $days=@($buttons | Where-Object { $_.Name -match '^\d{1,2},\s' })
  if ($header.Count -ne 1 -or $days.Count -lt 28 -or $days.Count -gt 31) { throw "Calendar semantics unavailable header=$($header.Count) days=$($days.Count)" }
  $left=($days.X | Measure-Object -Minimum).Minimum
  $right=($days | ForEach-Object {$_.X+$_.Width} | Measure-Object -Maximum).Maximum
  $top=($days.Y | Measure-Object -Minimum).Minimum
  $bottom=($days | ForEach-Object {$_.Y+$_.Height} | Measure-Object -Maximum).Maximum
  [pscustomobject]@{ Header=$header[0].Name; Days=$days.Count; Left=$left; Right=$right; Top=$top; Bottom=$bottom }
}
function Get-EditorValues {
  $root=[System.Windows.Automation.AutomationElement]::FromHandle($window)
  $condition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
  $edits=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition)
  foreach($edit in $edits) {
    $current=$edit.Current; if($current.IsOffscreen -or $current.BoundingRectangle.Width -le 0){continue}
    $pattern=$null; $value=''
    if($edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern,[ref]$pattern)){$value=$pattern.Current.Value}
    elseif($edit.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern,[ref]$pattern)){$value=$pattern.DocumentRange.GetText(-1)}
    [pscustomobject]@{Name=$current.Name;Value=$value;Rect=$current.BoundingRectangle;Focused=$current.HasKeyboardFocus}
  }
}
try {
  if($Action -eq 'Capture') {
    Assert-Foreground
    if(!$CapturePath){throw 'Capture path is required'}
    $rect=[FastCalendarInput+Rect]::new();$origin=[FastCalendarInput+Point]::new()
    if(![FastCalendarInput]::GetClientRect($window,[ref]$rect) -or ![FastCalendarInput]::ClientToScreen($window,[ref]$origin)){throw 'Capture client unavailable'}
    $bitmap=[Drawing.Bitmap]::new($rect.Right,$rect.Bottom);$graphics=[Drawing.Graphics]::FromImage($bitmap)
    try{$graphics.CopyFromScreen($origin.X,$origin.Y,0,0,$bitmap.Size);$bitmap.Save($CapturePath,[Drawing.Imaging.ImageFormat]::Png)}
    finally{$graphics.Dispose();$bitmap.Dispose()}
    Write-Output ('FAST_CAPTURE '+$CapturePath);return
  }
  if ($Action -eq 'Close') {
    if (![FastCalendarInput]::PostMessage($window,0x10,[IntPtr]::Zero,[IntPtr]::Zero)) { throw 'Close message rejected' }
    Write-Output 'FAST_UI_CLOSE'; return
  }
  if ($Action -eq 'Setup' -or $Action -eq 'SetupGallery' -or $Action -eq 'SetupTestbed' -or $Action -eq 'SetupList') {
    $foreground=[FastCalendarInput]::GetForegroundWindow(); [uint32]$foregroundPid=0
    $foregroundThread=[FastCalendarInput]::GetWindowThreadProcessId($foreground,[ref]$foregroundPid)
    $ourThread=[FastCalendarInput]::GetCurrentThreadId(); $attached=$false
    try {
      if ($foregroundThread -ne $ourThread) { $attached=[FastCalendarInput]::AttachThreadInput($ourThread,$foregroundThread,$true) }
      [void][FastCalendarInput]::ShowWindow($window,3)
      [void][FastCalendarInput]::BringWindowToTop($window)
      [void][FastCalendarInput]::SetForegroundWindow($window)
    } finally { if ($attached) { [void][FastCalendarInput]::AttachThreadInput($ourThread,$foregroundThread,$false) } }
    Start-Sleep -Milliseconds 600
    Assert-Foreground
    if($Action -eq 'SetupList') {
      Click-Button '' 'show-list-view'
      $items=@(Get-Buttons|Where-Object {$_.Id -like 'list-view-item-*'}|Select-Object -ExpandProperty Id)
      if(!$items.Count){throw 'Variable list semantics unavailable'}
      Write-Output ('LIST_UI_SNAPSHOT '+(@{Items=$items}|ConvertTo-Json -Compress));return
    }
    if($Action -eq 'SetupTestbed') {
      Click-Button '' 'show-mixed-scroll'
      $editorWait=[Diagnostics.Stopwatch]::StartNew()
      do {
        $edits=@(Get-EditorValues|Sort-Object {$_.Rect.Y},{$_.Rect.X})
        if($edits.Count){break}
        Start-Sleep -Milliseconds 100
      } while($editorWait.ElapsedMilliseconds -lt 10000)
      if(!$edits.Count){throw ('MixedScroll editor unavailable; visible='+(@(Get-Buttons)|ConvertTo-Json -Compress))}
      $edit=$edits[0];[FastCalendarInput]::Click([int]($edit.Rect.X+$edit.Rect.Width/2),[int]($edit.Rect.Y+$edit.Rect.Height/2))
      Start-Sleep -Milliseconds 150;[FastCalendarInput]::TypeText('Jank 한글 😀')
      $editorWait.Restart()
      do {
        $entered=@(Get-EditorValues|Where-Object {$_.Value.Trim() -eq 'Jank 한글 😀'})
        if($entered.Count){break}
        Start-Sleep -Milliseconds 100
      } while($editorWait.ElapsedMilliseconds -lt 5000)
      if(!$entered.Count){throw 'MixedScroll initial edit did not publish'}
      Start-Sleep -Milliseconds 500
      $origin=[FastCalendarInput+Point]::new();$rect=[FastCalendarInput+Rect]::new()
      if(![FastCalendarInput]::ClientToScreen($window,[ref]$origin) -or ![FastCalendarInput]::GetClientRect($window,[ref]$rect)){throw 'Testbed client unavailable'}
      [void][FastCalendarInput]::SetCursorPos($origin.X+45,$origin.Y+[int]($rect.Bottom*.65))
      [void][FastCalendarInput]::Wheels($window,30,-24,$InputHz);Start-Sleep -Milliseconds 300
      [void][FastCalendarInput]::Wheels($window,30,24,$InputHz);Start-Sleep -Milliseconds 600
      if(!(Get-EditorValues|Where-Object {$_.Value.Trim() -eq 'Jank 한글 😀'})){throw 'MixedScroll editor value lost'}
      Click-Button '' 'mixed-scroll-count-0'
      if(!(Get-Buttons|Where-Object {$_.Id -eq 'mixed-scroll-count-0' -and $_.Name -like '*1*'})){throw 'MixedScroll button did not update'}
      Click-Button '' 'mixed-scroll-back';Click-Button '' 'show-list-view'
      $before=@(Get-Buttons|Where-Object {$_.Id -like 'list-view-item-*'}|Select-Object -ExpandProperty Id)
      [void][FastCalendarInput]::SetCursorPos($origin.X+[int]($rect.Right*.3),$origin.Y+[int]($rect.Bottom*.65))
      [void][FastCalendarInput]::Wheels($window,30,-24,$InputHz);Start-Sleep -Milliseconds 600
      $after=@(Get-Buttons|Where-Object {$_.Id -like 'list-view-item-*'}|Select-Object -ExpandProperty Id)
      if(!$before.Count -or !$after.Count -or ($before -join ',') -eq ($after -join ',')){throw 'Testbed list did not progress'}
      Click-Button '' 'list-view-back'
      Write-Output ('TESTBED_UI_PASS '+(@{MixedEditor='Jank 한글 😀';MixedCounter=1;Before=$before;After=$after}|ConvertTo-Json -Compress));return
    }
    if($Action -eq 'SetupGallery'){Write-Output 'GALLERY_UI_SETUP';return}
    Click-Button '' 'open-drawer'
    Click-Button 'Selection' ''
    Click-Button 'Choose date' ''
    $calendar=Get-Calendar
    Write-Output ('FAST_UI_SETUP '+($calendar|ConvertTo-Json -Compress)); return
  }
  Assert-Foreground
  if($Action -eq 'SnapshotList') {
    $items=@(Get-Buttons|Where-Object {$_.Id -like 'list-view-item-*'}|Select-Object -ExpandProperty Id)
    if(!$items.Count){throw 'Variable list semantics unavailable'}
    Write-Output ('LIST_UI_SNAPSHOT '+(@{Items=$items}|ConvertTo-Json -Compress));return
  }
  if($Action -eq 'Wheel') {
    if($Count -lt 2 -or $Count -gt 240 -or $Delta -eq 0 -or [Math]::Abs([long]$Delta) -gt 120){throw 'Invalid bounded wheel plan'}
    $rect=[FastCalendarInput+Rect]::new();$origin=[FastCalendarInput+Point]::new()
    if(![FastCalendarInput]::GetClientRect($window,[ref]$rect) -or ![FastCalendarInput]::ClientToScreen($window,[ref]$origin)){throw 'Client geometry unavailable'}
    [void][FastCalendarInput]::SetCursorPos($origin.X+[int]($rect.Right*.22),$origin.Y+[int]($rect.Bottom*.62))
    Start-Sleep -Milliseconds 50
    $timings=[FastCalendarInput]::Wheels($window,$Count,$Delta,$InputHz)
    Write-Output ('GALLERY_UI_WHEEL '+(@{Count=$Count;Delta=$Delta;TotalDelta=($Count*$Delta);InputHz=$InputHz;Timing=$timings;Width=$rect.Right;Height=$rect.Bottom;Dpi=[FastCalendarInput]::GetDpiForWindow($window)}|ConvertTo-Json -Compress -Depth 4));return
  }
  if($Action -eq 'Editor') {
    Click-Button '' 'open-drawer';Click-Button 'Text inputs' ''
    $edits=@(Get-EditorValues|Sort-Object {$_.Rect.Y},{$_.Rect.X});if($edits.Count -lt 1){throw 'No visible editor'}
    $edit=$edits[0];[FastCalendarInput]::Click([int]($edit.Rect.X+$edit.Rect.Width/2),[int]($edit.Rect.Y+$edit.Rect.Height/2))
    Start-Sleep -Milliseconds 150;[FastCalendarInput]::TypeText('Jank 한글 😀');Start-Sleep -Milliseconds 600
    $values=@(Get-EditorValues);if(!($values|Where-Object {$_.Value.Trim() -eq 'Jank 한글 😀'})){throw ('Edited UIA value mismatch: '+($values|ConvertTo-Json -Compress -Depth 3))}
    Click-Button '' 'toggle-theme'
    [void][FastCalendarInput]::ShowWindow($window,9)
    if(![FastCalendarInput]::SetWindowPos($window,[IntPtr]::Zero,40,40,1200,900,4)){throw 'Resize rejected'}
    Start-Sleep -Milliseconds 600;Assert-Foreground
    $values=@(Get-EditorValues);if(!($values|Where-Object {$_.Value.Trim() -eq 'Jank 한글 😀'})){throw 'Edited value was lost on theme/resize'}
    [void][FastCalendarInput]::ShowWindow($window,3);Start-Sleep -Milliseconds 500
    Click-Button 'Show all' ''
    Write-Output 'GALLERY_UI_EDITOR_PASS';return
  }
  $calendar=Get-Calendar
  if ($Action -eq 'Snapshot') {
    $until=[Diagnostics.Stopwatch]::StartNew()
    while ($ExpectedMonth -and !$calendar.Header.Contains($ExpectedMonth) -and $until.ElapsedMilliseconds -lt 3000) {
      Start-Sleep -Milliseconds 100; $calendar=Get-Calendar
    }
    if ($ExpectedMonth -and !$calendar.Header.Contains($ExpectedMonth)) { throw "Calendar header mismatch expected=$ExpectedMonth actual=$($calendar.Header)" }
    $rect=[FastCalendarInput+Rect]::new(); $origin=[FastCalendarInput+Point]::new()
    if (![FastCalendarInput]::GetClientRect($window,[ref]$rect) -or ![FastCalendarInput]::ClientToScreen($window,[ref]$origin)) { throw 'Client geometry unavailable' }
    if ($CapturePath) {
      $bitmap=[Drawing.Bitmap]::new($rect.Right,$rect.Bottom); $graphics=[Drawing.Graphics]::FromImage($bitmap)
      try { $graphics.CopyFromScreen($origin.X,$origin.Y,0,0,$bitmap.Size); $bitmap.Save($CapturePath,[Drawing.Imaging.ImageFormat]::Png) }
      finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
    Write-Output ('FAST_UI_SNAPSHOT '+(@{Calendar=$calendar;Width=$rect.Right;Height=$rect.Bottom;Dpi=[FastCalendarInput]::GetDpiForWindow($window)}|ConvertTo-Json -Compress -Depth 4)); return
  }
  if ($Count -lt 1 -or $Count -gt 24 -or $MoveMs -lt 5 -or $GapMs -lt 1 -or [Math]::Abs($Direction) -ne 1) { throw 'Invalid bounded swipe plan' }
  if (![FastCalendarInput]::InitializeTouchInjection(1,3)) { throw "InitializeTouchInjection error=$([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
  $width=$calendar.Right-$calendar.Left
  $from=[int]($calendar.Left+$width*$(if($Direction -gt 0){.84}else{.16}))
  $to=[int]($calendar.Left+$width*$(if($Direction -gt 0){.16}else{.84}))
  $y=[int](($calendar.Top+$calendar.Bottom)/2)
  $timings=[FastCalendarInput]::Swipes($window,$Count,$MoveMs,$GapMs,$InputHz,$from,$to,$y)
  Write-Output ('FAST_UI_SWIPES '+(@{Count=$Count;Direction=$Direction;MoveMs=$MoveMs;GapMs=$GapMs;InputHz=$InputHz;MovesPerGesture=$timings.MovesPerGesture;ScheduledMoveMs=$timings.ScheduledMoveMs;DurationMs=$timings.DurationMs;StartCadenceMs=$timings.StartCadenceMs;Timing=$timings.Timing;From=$from;To=$to;Y=$y}|ConvertTo-Json -Compress -Depth 4))
} finally { [void][FastCalendarInput]::SetThreadDpiAwarenessContext($oldDpi) }
