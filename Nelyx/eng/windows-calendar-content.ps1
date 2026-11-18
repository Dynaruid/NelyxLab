param([Parameter(Mandatory)][int]$ProcessId,[Parameter(Mandatory)][string]$ResultPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
Add-Type -Path @('windows-jank-input.cs','windows-jank-screen.cs','windows-calendar-content.cs').ForEach({ Join-Path $PSScriptRoot $_ })
$previousDpi = [FastCalendarInput]::SetThreadDpiAwarenessContext([IntPtr](-4))
try {
  $process = Get-Process -Id $ProcessId
  $deadline = [Diagnostics.Stopwatch]::StartNew()
  do {
    $process.Refresh()
    $window = $process.MainWindowHandle
    if ($window -ne [IntPtr]::Zero) { break }
    Start-Sleep -Milliseconds 100
  } while (!$process.HasExited -and $deadline.Elapsed.TotalSeconds -lt 30)
  if ($window -eq [IntPtr]::Zero) { throw 'Calendar window unavailable' }
  $fg = [FastCalendarInput]::GetForegroundWindow()
  [uint32]$ownerPid = 0
  $thread = [FastCalendarInput]::GetWindowThreadProcessId($fg,[ref]$ownerPid)
  $ours = [FastCalendarInput]::GetCurrentThreadId()
  $attached = $thread -ne $ours -and [FastCalendarInput]::AttachThreadInput($ours,$thread,$true)
  try {
    [void][FastCalendarInput]::ShowWindow($window,3)
    [void][FastCalendarInput]::BringWindowToTop($window)
    [void][FastCalendarInput]::SetForegroundWindow($window)
  } finally { if ($attached) { [void][FastCalendarInput]::AttachThreadInput($ours,$thread,$false) } }
  function Get-Month {
    $root = [Windows.Automation.AutomationElement]::FromHandle($window)
    $nodes = $root.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)
    $labels = @($nodes | ForEach-Object { $_.Current.Name })
    if ($labels -contains 'FLUTTERVIEW') { $labels += [JankScreen]::FlutterNames($window) }
    $months = @($labels | Where-Object {
      $_ -match '(?m)^(January|February|March|April|May|June|July|August|September|October|November|December) 20\d\d$'
    } | ForEach-Object { ($_.Trim() -split '\r?\n')[-1] } | Select-Object -Unique)
    if ($months.Count -eq 1) { return $months[0] }
    return ''
  }
  $deadline.Restart()
  do {
    Start-Sleep -Milliseconds 200
    $month = Get-Month
  } while ($month -ne 'February 2025' -and $deadline.Elapsed.TotalSeconds -lt 15)
  if ($month -ne 'February 2025') {
    $root = [Windows.Automation.AutomationElement]::FromHandle($window)
    $names = @($root.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition) | ForEach-Object { $_.Current.Name } | Where-Object { $_ } | Select-Object -First 12)
    throw "Calendar initial accessibility header unavailable ($month), labels $($names -join ', ')"
  }
  [void][FastCalendarInput]::SetCursorPos(10,10)
  Start-Sleep -Milliseconds 800
  $rect = [FastCalendarInput+Rect]::new()
  if (![FastCalendarInput]::GetClientRect($window,[ref]$rect)) { throw 'Client rectangle unavailable' }
  $geometry = @{Width=$rect.Right; Height=$rect.Bottom; Dpi=[FastCalendarInput]::GetDpiForWindow($window); Display=[JankScreen]::Display($window)}
  Write-Output ('VIEW ' + ($geometry | ConvertTo-Json -Compress))
  $phases = @()
  if (![FastCalendarInput]::InitializeTouchInjection(1,3)) { throw 'Touch injection unavailable' }
  foreach ($plan in @(@(6,12,24,1),@(6,6,16,1),@(12,6,16,-1))) {
    $r = [JankScreen]::MeasureContent($window,$plan[0],$plan[1],$plan[2],$plan[3])
    $start = $r.Input.Timing.AttemptQpcMs[0]
    $wallOffset = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - [Diagnostics.Stopwatch]::GetTimestamp()*1000.0/[Diagnostics.Stopwatch]::Frequency
    $motion = @($r.Changes | Where-Object { $_ -ge $start })
    $early = @($r.Changes | Where-Object { $_ -lt $start -and $_ -ge $start-250 })
    $quietMs = if ($motion.Count) { $r.Ended - $motion[-1] } else { 0 }
    if ($motion.Count -lt 2 -or $early.Count -or $quietMs -lt 350) {
      throw "Incomplete grid motion: changes=$($motion.Count) pre-input=$($early.Count) settledMs=$quietMs"
    }
    $gaps = @(for ($i=1; $i -lt $motion.Count; $i++) { $motion[$i] - $motion[$i-1] })
    $end = Get-Month
    $culture = [Globalization.CultureInfo]::InvariantCulture
    if (!$end -or ([DateTime]::ParseExact($end,'MMMM yyyy',$culture) - [DateTime]::ParseExact($month,'MMMM yyyy',$culture)).Days * $plan[3] -le 0) {
      throw "Unexpected calendar direction from $month to $end"
    }
    $phase = @{
      Start=$month; End=$end; Samples=$r.Input.Timing.Injected; Changes=$motion.Count; FirstMs=$motion[0]-$start;
      LastMs=$motion[-1]-$start; Fps=1000*($motion.Count-1)/($motion[-1]-$motion[0]);
      MaxGapMs=($gaps|Measure-Object -Maximum).Maximum; Gaps100=@($gaps|Where-Object {$_ -ge 100}).Count;
      MaxCaptureIntervalMs=$r.MaximumIntervalMs
      StartUtcMs=$wallOffset+$start; EndUtcMs=$wallOffset+$motion[-1]
    }
    $phases += $phase
    Write-Output ('CONTENT ' + ($phase | ConvertTo-Json -Compress))
    $month = $end
  }
  [IO.File]::WriteAllText($ResultPath, (@{View=$geometry; Phases=$phases} | ConvertTo-Json -Depth 5))
  if (![FastCalendarInput]::PostMessage($window,0x10,[IntPtr]::Zero,[IntPtr]::Zero)) { throw 'Calendar close request failed' }
} finally { [void][FastCalendarInput]::SetThreadDpiAwarenessContext($previousDpi) }
