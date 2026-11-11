# SPDX-License-Identifier: BSD-3-Clause
# Run with Windows PowerShell 5.1. No CUA, persistent trace, installed consumer
# copy or browser profile is used. The caller owns optional exported captures.
#requires -Version 5.1
[CmdletBinding()]
param(
  [string]$App = '',
  [ValidateSet('All','List','Calendar','CalendarReverse','CalendarFast','CalendarContact','Manual')][string]$Scenario = 'All',
  [ValidateRange(-24,24)][int]$RapidMonths = 0,
  [ValidateSet(0,60)][int]$PrecisionHz = 0,
  [switch]$CpuProfile,
  [switch]$NoTrace,
  [string]$CaptureDirectory = ''
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (!$App) { $App=Join-Path $root 'sample/nelyx-demo-app/engine-v2' }
$App = (Resolve-Path -LiteralPath $App).Path
if($CpuProfile -and $PrecisionHz -ne 60){throw '-CpuProfile requires -PrecisionHz 60.'}
if($RapidMonths -lt 0 -and $PrecisionHz -ne 60){throw 'Backward -RapidMonths requires -PrecisionHz 60.'}
if ($PSVersionTable.PSEdition -ne 'Desktop') { throw 'Use powershell.exe (Windows PowerShell 5.1) for the native UIA assemblies.' }
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, WindowsBase, System.Drawing
$references = @('System.dll','System.Core.dll','System.Drawing.dll',
  [System.Windows.Automation.AutomationElement].Assembly.Location,
  [System.Windows.Automation.ControlType].Assembly.Location,
  [System.Windows.Rect].Assembly.Location) | Select-Object -Unique
if (-not ('Nelyx.ScrollCheck.Desktop' -as [type])) {
  Add-Type -Path (Join-Path $PSScriptRoot 'windows-scroll-helper.cs') -ReferencedAssemblies $references
}
$node = (Get-Command node.exe).Source
$identityText = & $node (Join-Path $PSScriptRoot 'check-windows-scroll-identity.mjs') $App
if ($LASTEXITCODE) { throw 'Current Windows source/supply/application identity verification failed.' }
$identity = ($identityText -join "`n") | ConvertFrom-Json
$runner = $null; $native = $null; $mapping = $null; $window = [IntPtr]::Zero
$script:stats = $null; $script:coreState = $null; $script:statsRevision = 0; $script:delivery = $null; $script:trace = $null
$script:closed = $null; $script:errors = New-Object 'Collections.Generic.List[string]'
$script:appDiagnostics = $null; $script:profile = $null; $script:gc = $null
$script:profileBlock = ''; $script:profileText = New-Object Text.StringBuilder
$script:events = New-Object 'Collections.Generic.List[Nelyx.ScrollCheck.Record]'
$script:eventDrops = 0; $script:appReady = $false
$script:lastLines = New-Object 'Collections.Generic.Queue[string]'
$script:segments = New-Object 'Collections.Generic.List[object]'
$script:deadline = [Nelyx.ScrollCheck.Desktop]::Now + 1200
$script:physicalInput = $null
$manualStop = $null
function Pump {
  foreach ($line in $runner.Take()) {
    if ($line -eq 'V2_PROFILE_BEGIN' -or $line -eq 'V2_GC_BEGIN') {
      $script:profileBlock=$line; $null=$script:profileText.Clear(); continue
    }
    if ($script:profileBlock) {
      if ($line -eq 'V2_PROFILE_END' -or $line -eq 'V2_GC_END') {
        $report=$script:profileText.ToString()
        # Hermes' GC instrumentation prefixes the JSON with "GC stats:".
        if($script:profileBlock -eq 'V2_GC_BEGIN'){$report=$report.Substring($report.IndexOf('{'))}
        $value=$report|ConvertFrom-Json
        if ($script:profileBlock -eq 'V2_PROFILE_BEGIN') {$script:profile=$value} else {$script:gc=$value}
        $script:profileBlock=''; $null=$script:profileText.Clear()
      } else {
        if ($script:profileText.Length+$line.Length -gt 8*1024*1024) {throw 'CPU/GC diagnostic exceeded its memory bound.'}
        $null=$script:profileText.AppendLine($line)
      }
      continue
    }
    if ($script:lastLines.Count -ge 16) { $null=$script:lastLines.Dequeue() }
    $script:lastLines.Enqueue($line.Substring(0,[Math]::Min(500,$line.Length)))
    if ($line.StartsWith('V2_STATS ')) { $script:stats = $line.Substring(9) | ConvertFrom-Json; ++$script:statsRevision }
    elseif ($line.StartsWith('V2_CORE_STATE ')) { $script:coreState = $line.Substring(14) | ConvertFrom-Json }
    elseif ($line.StartsWith('V2_INPUT_SOURCE ')) { $script:physicalInput = $line.Substring(16) | ConvertFrom-Json }
    elseif ($line.StartsWith('V2_NATIVE_DELIVERY ')) { $script:delivery = $line.Substring(19) | ConvertFrom-Json }
    elseif ($line.StartsWith('V2_TRACE ')) { $script:trace = $line.Substring(9) | ConvertFrom-Json }
    elseif ($line.StartsWith('V2_CLOSED ')) { $script:closed = $line.Substring(10) | ConvertFrom-Json }
    elseif ($line.StartsWith('V2_APP {"kind":"app-disposed"')) { $script:appDiagnostics=($line.Substring(7)|ConvertFrom-Json).diagnostics }
    elseif ($line -match 'V2_HOST_ERROR|V2_PREPARATION_ERROR|"kind":"app-error"') {
      if ($script:errors.Count -lt 4) { $script:errors.Add($line.Substring(0,[Math]::Min(1800,$line.Length))) }
    }
    if ($line -match 'app-ready') { $script:appReady = $true }
  }
  if ($mapping) {
    foreach ($record in $mapping.Drain()) {
      if ($script:events.Count -lt 65536) { $script:events.Add($record) } else { ++$script:eventDrops }
    }
  }
  if ([Nelyx.ScrollCheck.Desktop]::Now -ge $script:deadline) { throw 'Windows scroll check exceeded its 20-minute timeout.' }
  if ($script:errors.Count) { throw $script:errors[0] }
}
function Pause([int]$Milliseconds) {
  $until = [Nelyx.ScrollCheck.Desktop]::Now + $Milliseconds / 1000.0
  do { Start-Sleep -Milliseconds ([Math]::Min(40,$Milliseconds)); Pump } while ([Nelyx.ScrollCheck.Desktop]::Now -lt $until)
}
function Get-Stats {
  $revision = $script:statsRevision; $runner.Send('stats'); $until = [Nelyx.ScrollCheck.Desktop]::Now + 10
  do { Pause 40 } while ($script:statsRevision -eq $revision -and [Nelyx.ScrollCheck.Desktop]::Now -lt $until)
  if ($script:statsRevision -eq $revision) { throw 'Native stats reply timed out.' }
  return $script:stats
}
function Settle {
  for ($i=0; $i -lt 12; ++$i) {
    Pause 150; $s = Get-Stats
    # A published document can still be in a Core page spring. Its header can
    # already name the destination while only part of that page is visible.
    if ($s.document -eq $s.activeDocument -and $s.document -eq $script:coreState.publishedDocument -and $s.pendingDocument -eq 0 -and $s.preparation -eq 0 -and $s.queued -eq 0 -and ($script:coreState.flags -band 128) -eq 0) { return }
  }
  throw ('Windows did not settle: ' + ($s | ConvertTo-Json -Compress -Depth 6))
}
function Wait-Peer([string]$Pattern,[string]$Role='') {
  $until = [Nelyx.ScrollCheck.Desktop]::Now + 15
  do {
    $peers = [Nelyx.ScrollCheck.Desktop]::Peers($window)
    $found = @($peers | Where-Object { ($_.Name -match $Pattern -or $_.Help -match $Pattern) -and (!$Role -or $_.Role -eq ('ControlType.'+$Role)) -and !$_.Offscreen -and $_.Width -gt 0 -and $_.Height -gt 0 })
    if ($found.Count) { return $found[0] }
    Pause 120
  } while ([Nelyx.ScrollCheck.Desktop]::Now -lt $until)
  throw ('UIA peer unavailable: ' + $Pattern + '; visible names: ' + (($peers | Where-Object { !$_.Offscreen } | Select-Object -First 45 -ExpandProperty Name) -join ' | '))
}
function Click-Peer([string]$Pattern,[string]$Role='Button') {
  $peer = Wait-Peer $Pattern $Role
  [Nelyx.ScrollCheck.Desktop]::Click($window,$peer); Pause 200
}
function Capture([string]$Name) {
  if (!$CaptureDirectory) { return }
  $directory = (Resolve-Path -LiteralPath $CaptureDirectory).Path
  [Nelyx.ScrollCheck.Desktop]::Capture($window,(Join-Path $directory ($Name+'.png')))
}
function Gap-Summary($Values) {
  $array = @($Values); $maximum = 0.0
  foreach ($v in $array) { $maximum = [Math]::Max($maximum,[double]$v) }
  return [ordered]@{ count=$array.Count; maxMs=[Math]::Round($maximum,3);
    ge100=@($array | Where-Object { $_ -ge 100 }).Count; ge250=@($array | Where-Object { $_ -ge 250 }).Count;
    ge500=@($array | Where-Object { $_ -ge 500 }).Count; ge1000=@($array | Where-Object { $_ -ge 1000 }).Count }
}
function Gaps($Records) {
  $previous = $null
  foreach ($r in $Records) { if ($null -ne $previous) { ($r.At - $previous.At)*1000 }; $previous=$r }
}
function Record-Segment([string]$Name,[string]$Source,$Sent,[double]$Started,[double]$Ended,$Before,$After) {
  $records = @($script:events | Where-Object { $_.At -ge $Started -and $_.At -le $Ended })
  $inputs = @($records | Where-Object { $_.Stage -eq 7 })
  $frames = @($records | Where-Object { $_.Stage -eq 27 -and $_.At -le $Sent[$Sent.Count-1] })
  $driver = New-Object 'Collections.Generic.List[double]'
  for ($i=1; $i -lt $Sent.Count; ++$i) { $driver.Add(($Sent[$i]-$Sent[$i-1])*1000) }
  $admission = @($records | Where-Object { $_.Stage -eq 14 } | ForEach-Object { $_.B })
  $appTurns = @($records | Where-Object { $_.Stage -eq 21 } | ForEach-Object { $_.B })
  $frameGaps = @(Gaps $frames)
  $pauses = New-Object 'Collections.Generic.List[object]'
  for($i=1;$i -lt $frames.Count;++$i){
    $previous=$frames[$i-1];$current=$frames[$i];$elapsed=($current.At-$previous.At)*1000
    if($elapsed -ge 250){$pauses.Add([pscustomobject]@{
      startedMs=[Math]::Round(($previous.At-$Sent[0])*1000,3);elapsedMs=[Math]::Round($elapsed,3)
      beforeInput=$previous.Input;afterInput=$current.Input;beforeDocument=$previous.B;afterDocument=$current.B
    })}
  }
  $coreOps=@($records | Where-Object {$_.Stage -eq 16} | Group-Object A | ForEach-Object {
    [pscustomobject]@{op=[int]$_.Name; elapsed=(Gap-Summary @($_.Group | ForEach-Object {$_.B}))}
  })
  $draws=Gap-Summary @($records | Where-Object {$_.Stage -eq 25} | ForEach-Object {$_.B})
  $submitted=@{}; $completion=New-Object 'Collections.Generic.List[double]'
  foreach($r in $records){
    if($r.Stage -eq 25){$submitted[[string]$r.A]=$r.At}
    elseif($r.Stage -eq 26 -and $submitted.ContainsKey([string]$r.A)){$completion.Add(($r.At-$submitted[[string]$r.A])*1000)}
  }
  $viewports=@($records | Where-Object {$_.Stage -eq 28} | Group-Object Surface | ForEach-Object {
    $rows=@($_.Group); $minimum=[double]::PositiveInfinity; $maximum=[double]::NegativeInfinity; $deferred=0.0
    $spans=New-Object 'Collections.Generic.List[double]'; $progressAt=$Sent[0]; $offset=$rows[0].A
    foreach($r in $rows){
      $minimum=[Math]::Min($minimum,$r.A);$maximum=[Math]::Max($maximum,$r.A);$deferred=[Math]::Max($deferred,[Math]::Abs($r.B-$r.A))
      if([Math]::Abs($r.A-$offset) -gt 0.01){$spans.Add([Math]::Max(0,($r.At-$progressAt)*1000));$progressAt=$r.At;$offset=$r.A}
    }
    if($maximum-$minimum -gt 0.01 -or $deferred -gt 0.01){
      $spans.Add([Math]::Max(0,($Sent[-1]-$progressAt)*1000))
      [pscustomobject]@{handle=$_.Name; from=$rows[0].A; to=$rows[-1].A; range=($maximum-$minimum); maxDeferred=$deferred; displayedOffsetGaps=(Gap-Summary $spans)}
    }
  })
  # Idle before the first response is not a frame interval. Include a leading
  # or trailing active-input wait only when the driver kept sending samples.
  if ($frames.Count) {
    $frameGaps += ($frames[0].At-$Sent[0])*1000
    $frameGaps += ($Sent[$Sent.Count-1]-$frames[-1].At)*1000
  } elseif ($Sent.Count -gt 1 -and !$NoTrace) { $frameGaps += ($Sent[-1]-$Sent[0])*1000 }
  $driverSummary = Gap-Summary $driver
  $summary = [ordered]@{ name=$Name; source=$Source; traceEnabled=(!$NoTrace); sent=$Sent.Count; received=$inputs.Count;
    consumedDelta=($After.consumed-$Before.consumed); scrollOffsetBefore=$Before.scrollOffset; scrollOffsetAfter=$After.scrollOffset;
    lazyOffsetBefore=$Before.lazyOffset; lazyOffsetAfter=$After.lazyOffset; driverGaps=$driverSummary;
    inputReceiveGaps=(Gap-Summary @(Gaps $inputs)); admission=(Gap-Summary $admission); appTurns=(Gap-Summary $appTurns);
    publicationGaps=(Gap-Summary $frameGaps); activePublications=$frames.Count;
    publicationPauses=@($pauses | Sort-Object elapsedMs -Descending | Select-Object -First 8);
    coreOps=$coreOps; recordAndSubmit=$draws; submitToObservedGpuComplete=(Gap-Summary $completion); viewportProgress=$viewports;
    driverTimingUsable=($driverSummary.ge100 -eq 0); layoutWorkDelta=($After.layoutWork-$Before.layoutWork);
    paragraphLayoutsDelta=($After.paragraphLayouts-$Before.paragraphLayouts); nativePicturesDelta=($After.pictures-$Before.pictures);
    memoryBefore=$Before.memoryTotal; memoryAfter=$After.memoryTotal }
  $script:segments.Add([pscustomobject]$summary)
  Write-Output ('WINDOWS_SCROLL_SEGMENT ' + ($summary | ConvertTo-Json -Compress -Depth 8))
}
function Wheel-Segment([string]$Name,[int]$Count,[int]$Delta) {
  $rect=[Nelyx.ScrollCheck.Desktop]::Client($window)
  [Nelyx.ScrollCheck.Desktop]::Move($window,$rect.Left+($rect.Right-$rect.Left)*0.32,$rect.Top+($rect.Bottom-$rect.Top)*0.70)
  Pause 100; $before=Get-Stats; $sent=New-Object 'Collections.Generic.List[double]'; $start=[Nelyx.ScrollCheck.Desktop]::Now
  for ($i=0;$i -lt $Count;++$i) { $sent.Add([Nelyx.ScrollCheck.Desktop]::Now); [Nelyx.ScrollCheck.Desktop]::Wheel($window,$Delta); Pause 20 }
  $end=[Nelyx.ScrollCheck.Desktop]::Now; Pause 200; $after=Get-Stats
  Record-Segment $Name 'os-wheel' $sent $start $end $before $after
}
$monthPattern='January|February|March|April|May|June|July|August|September|October|November|December'
function Calendar {
  $header=Wait-Peer ('('+$monthPattern+') [0-9]{4}')
  $headerName=[regex]::Match(($header.Name+' '+$header.Help),'('+$monthPattern+') [0-9]{4}').Value
  $date=[DateTime]::ParseExact($headerName,'MMMM yyyy',[Globalization.CultureInfo]::InvariantCulture)
  $days=@([Nelyx.ScrollCheck.Desktop]::Peers($window) | Where-Object { $_.Role -eq 'ControlType.Button' -and !$_.Offscreen -and $_.Name -match '^\d{1,2},' })
  $current=@($days | Where-Object { $_.Name -match ([regex]::Escape($date.ToString('MMMM',[Globalization.CultureInfo]::InvariantCulture))+'\s+\d{1,2},?\s+'+$date.Year) })
  $numbers=@($current | ForEach-Object { [int]([regex]::Match($_.Name,'^\d{1,2}').Value) } | Sort-Object -Unique)
  $expected=[DateTime]::DaysInMonth($date.Year,$date.Month)
  if ($numbers.Count -ne $expected -or $numbers[0] -ne 1 -or $numbers[-1] -ne $expected) {
    throw ('Calendar header/grid disagree: '+$header.Name+'; '+(($days | Select-Object -ExpandProperty Name)-join ' | '))
  }
  return [pscustomobject]@{ date=$date; name=$headerName; days=$current }
}
function Wait-Month([DateTime]$Expected) {
  # Core may be idle before App has dispatched an admitted button callback.
  # Wait for this action's requested state, without sending the action again.
  $name=$Expected.ToString('MMMM yyyy',[Globalization.CultureInfo]::InvariantCulture)
  $until=[Nelyx.ScrollCheck.Desktop]::Now+15
  do {
    Pump
    if([Nelyx.ScrollCheck.Desktop]::HasMonth($window,$name)){
      Settle
      $calendar=Calendar
      if($calendar.date -eq $Expected){return $calendar}
    }
    Pause 80
  } while([Nelyx.ScrollCheck.Desktop]::Now -lt $until)
  throw ('The admitted month action did not reach '+$name)
}
function Precision-Segment([string]$Name,[double]$Dx,[string]$Terminal='end') {
  $calendar=Calendar; $rect=[Nelyx.ScrollCheck.Desktop]::Client($window); $dpi=[Nelyx.ScrollCheck.Desktop]::GetDpiForWindow($window)/96.0
  $peer=$calendar.days[[int]($calendar.days.Count/2)]; $x=($peer.X+$peer.Width/2-$rect.Left)/$dpi; $y=($peer.Y+$peer.Height/2-$rect.Top)/$dpi
  $before=Get-Stats; $sent=New-Object 'Collections.Generic.List[double]'; $start=[Nelyx.ScrollCheck.Desktop]::Now
  $runner.Send(('precision start {0} {1} 0 0' -f $x.ToString('R',[Globalization.CultureInfo]::InvariantCulture),$y.ToString('R',[Globalization.CultureInfo]::InvariantCulture)))
  Pause 30
  for($i=0;$i -lt 24;++$i) { $sent.Add([Nelyx.ScrollCheck.Desktop]::Now); $runner.Send(('precision update 0 0 {0} 0' -f $Dx.ToString('R',[Globalization.CultureInfo]::InvariantCulture))); Pause 20 }
  $runner.Send(('precision '+$Terminal+' 0 0 0 0')); $end=[Nelyx.ScrollCheck.Desktop]::Now
  Pause 250; $after=Get-Stats; Record-Segment $Name 'injected-precision' $sent $start $end $before $after
  Settle
  if ($Terminal -eq 'cancel') {
    # Cancel stops at its last accepted offset. A new, zero-velocity gesture
    # explicitly exercises recovery/page snapping before the resize scenario.
    $runner.Send(('precision start {0} {1} 0 0' -f $x.ToString('R',[Globalization.CultureInfo]::InvariantCulture),$y.ToString('R',[Globalization.CultureInfo]::InvariantCulture)))
    Pause 30; $runner.Send('precision end 0 0 0 0'); Settle
    $null=Wait-Month $calendar.date
  }
}
function Drag-Month([string]$Name,[int]$Direction) {
  $first=Calendar; $peer=$first.days[[int]($first.days.Count/2)]
  $viewport=[Nelyx.ScrollCheck.Desktop]::PageViewport($window,$peer.Name)
  $left=$viewport.X+$viewport.Width*0.1; $right=$viewport.X+$viewport.Width*0.9
  $from=if($Direction -gt 0){$right}else{$left}; $to=if($Direction -gt 0){$left}else{$right}
  $y=$peer.Y+$peer.Height/2; $sent=New-Object 'Collections.Generic.List[double]'; $before=Get-Stats
  [Nelyx.ScrollCheck.Desktop]::Move($window,$from,$y); $start=[Nelyx.ScrollCheck.Desktop]::Now
  [Nelyx.ScrollCheck.Desktop]::Down($window)
  try {
    for($i=1;$i -le 24;++$i){
      $sent.Add([Nelyx.ScrollCheck.Desktop]::Now)
      [Nelyx.ScrollCheck.Desktop]::Move($window,$from+($to-$from)*$i/24,$y); Pause 20
    }
  } finally {[Nelyx.ScrollCheck.Desktop]::Up($window)}
  $end=[Nelyx.ScrollCheck.Desktop]::Now; Settle; $after=Get-Stats
  Record-Segment $Name 'os-mouse-drag' $sent $start $end $before $after
  $last=Wait-Month ($first.date.AddMonths($Direction))
  if($last.date -ne $first.date.AddMonths($Direction)){throw ('OS drag month mismatch: '+$first.name+' -> '+$last.name)}
}
function Rapid-Months([int]$Count) {
  $first=Calendar; $next=Wait-Peer '^Next month$' 'Button'; $before=Get-Stats
  $latencies=New-Object 'Collections.Generic.List[double]'; $months=New-Object 'Collections.Generic.List[string]'
  $start=[Nelyx.ScrollCheck.Desktop]::Now
  for($i=1;$i -le $Count;++$i) {
    $expected=$first.date.AddMonths($i).ToString('MMMM yyyy',[Globalization.CultureInfo]::InvariantCulture)
    $clicked=[Nelyx.ScrollCheck.Desktop]::Now
    [Nelyx.ScrollCheck.Desktop]::Click($window,$next)
    # Advance as soon as the new header is published; do not wait for a full
    # settle/200ms animation or run stats/captures for every moving frame.
    $until=[Nelyx.ScrollCheck.Desktop]::Now+15
    do {
      Pump
      $headerReady=[Nelyx.ScrollCheck.Desktop]::HasMonth($window,$expected)
      if($headerReady){break}
      Pause 20
    } while([Nelyx.ScrollCheck.Desktop]::Now -lt $until)
    if(!$headerReady){throw ('Rapid month header did not reach '+$expected)}
    $latencies.Add(([Nelyx.ScrollCheck.Desktop]::Now-$clicked)*1000); $months.Add($expected)
  }
  Settle; $last=Calendar; $after=Get-Stats; Capture 'calendar-rapid-last'
  if($last.date -ne $first.date.AddMonths($Count)){throw 'Rapid month navigation lost or duplicated a requested month.'}
  Write-Output ('WINDOWS_SCROLL_RAPID_MONTHS '+([ordered]@{ requested=$Count; observed=$months.Count; first=$first.name; last=$last.name;
    elapsedMs=([Nelyx.ScrollCheck.Desktop]::Now-$start)*1000; clickToPublishedHeader=(Gap-Summary $latencies);
    months=$months.ToArray(); frames=($after.frames-$before.frames); layoutWork=($after.layoutWork-$before.layoutWork);
    paragraphLayouts=($after.paragraphLayouts-$before.paragraphLayouts); memoryBefore=$before.memoryTotal; memoryAfter=$after.memoryTotal;
    physicalTrackpad='notVerified'; scanout='notVerified' } | ConvertTo-Json -Compress -Depth 5))
}
function Precision60-Months([int]$Count) {
  if($Count -eq 0 -or [Math]::Abs($Count) -gt 24){throw '60Hz month injection requires 1..24 months in either direction.'}
  $first=Calendar; $rect=[Nelyx.ScrollCheck.Desktop]::Client($window); $dpi=[Nelyx.ScrollCheck.Desktop]::GetDpiForWindow($window)/96.0
  $origin=$first.days[[int]($first.days.Count/2)]
  $viewport=[Nelyx.ScrollCheck.Desktop]::PageViewport($window,$origin.Name)
  $x=($origin.X+$origin.Width/2-$rect.Left)/$dpi; $y=($origin.Y+$origin.Height/2-$rect.Top)/$dpi
  $width=$viewport.Width/$dpi; $samples=[Math]::Abs($Count)*30; $dx=-$width*$Count/$samples
  $before=Get-Stats; $admitted=$script:delivery.injectedPrecisionAdmitted
  if($CpuProfile){$runner.Send('profile-start');Pause 80}
  $task=$runner.Precision60($x,$y,$samples,$dx)
  while(!$task.IsCompleted){Pause 40}
  $injection=$task.Result
  if($CpuProfile){$runner.Send('profile-stop');Pause 120}
  Pause 150; Settle; $after=Get-Stats
  Record-Segment 'continuous-months-60hz' 'injected-precision-60hz' $injection.Sent $injection.Started $injection.Ended $before $after
  $last=Calendar; Capture 'calendar-60hz-last'
  $observed=($last.date.Year-$first.date.Year)*12+$last.date.Month-$first.date.Month
  Write-Output ('WINDOWS_SCROLL_PRECISION_60HZ '+([ordered]@{ requestedMonths=$Count; observedMonths=$observed; first=$first.name; last=$last.name;
    requestedHz=60; samples=$injection.Samples; activeMs=($injection.Ended-$injection.Started)*1000;
    driverLateness=(Gap-Summary $injection.Lateness); pageWidthLogical=$width; deltaPerSample=$dx; totalDelta=($dx*$samples);
    admitted=($script:delivery.injectedPrecisionAdmitted-$admitted); rejected=$script:delivery.injectedPrecisionRejected;
    memoryBefore=$before.memoryTotal; memoryAfter=$after.memoryTotal; memoryPeak=$after.memoryPeak;
    physicalTrackpad='notVerified'; renderingFps='notMeasured'; scanout='notVerified' } | ConvertTo-Json -Compress -Depth 5))
  if($observed -ne $Count){throw 'Continuous precision input did not reach the requested month count.'}
  if($script:delivery.injectedPrecisionAdmitted-$admitted -ne $samples+2 -or $script:delivery.injectedPrecisionRejected -ne 0){throw 'Continuous precision input lost a start/update/end sample.'}
}
function Precision-FastMonths {
  $first=Calendar; $rect=[Nelyx.ScrollCheck.Desktop]::Client($window); $dpi=[Nelyx.ScrollCheck.Desktop]::GetDpiForWindow($window)/96.0
  $origin=$first.days[[int]($first.days.Count/2)]; $viewport=[Nelyx.ScrollCheck.Desktop]::PageViewport($window,$origin.Name)
  $x=($origin.X+$origin.Width/2-$rect.Left)/$dpi; $y=($origin.Y+$origin.Height/2-$rect.Top)/$dpi
  $width=$viewport.Width/$dpi; $before=Get-Stats; $admitted=$script:delivery.injectedPrecisionAdmitted
  $sent=New-Object 'Collections.Generic.List[double]'; $started=[Nelyx.ScrollCheck.Desktop]::Now; $ended=$started
  for($stroke=0;$stroke -lt 12;++$stroke){
    # Lift while moving and immediately recontact, unlike the distance-only
    # scenario's stationary lift. Do not settle or rebuild between strokes.
    $task=$runner.Precision60($x,$y,8,$width/4,$false)
    while(!$task.IsCompleted){Pause 10}
    $injection=$task.Result; $sent.AddRange([double[]]$injection.Sent); $ended=$injection.Ended; Pause 40
  }
  Settle; $after=Get-Stats
  Record-Segment 'fast-backward-contacts' 'injected-precision-fast-contacts' $sent.ToArray() $started $ended $before $after
  $last=Calendar; $observed=($last.date.Year-$first.date.Year)*12+$last.date.Month-$first.date.Month
  Write-Output ('WINDOWS_SCROLL_FAST_MONTHS '+([ordered]@{strokes=12;updates=$sent.Count;logicalContactMonths=-24;
    observedMonths=$observed;first=$first.name;last=$last.name;activeMs=($ended-$started)*1000;
    admitted=($script:delivery.injectedPrecisionAdmitted-$admitted);rejected=$script:delivery.injectedPrecisionRejected;
    release='moving';physicalTrackpad='notVerified'}|ConvertTo-Json -Compress))
  if($observed -gt -12){throw 'Fast backward contacts failed to progress beyond twelve months.'}
  if($script:delivery.injectedPrecisionAdmitted-$admitted -ne 120 -or $script:delivery.injectedPrecisionRejected -ne 0){throw 'Fast contacts lost a start/update/end sample.'}
}
function Precision-LiveContact {
    $first=Calendar; $rect=[Nelyx.ScrollCheck.Desktop]::Client($window); $dpi=[Nelyx.ScrollCheck.Desktop]::GetDpiForWindow($window)/96.0
    $peer=$first.days[[int]($first.days.Count/2)]; $viewport=[Nelyx.ScrollCheck.Desktop]::PageViewport($window,$peer.Name)
    $x=($peer.X+$peer.Width/2-$rect.Left)/$dpi; $y=($peer.Y+$peer.Height/2-$rect.Top)/$dpi; $width=$viewport.Width/$dpi
    foreach($fraction in @(0.4,0.8)){
    foreach($direction in @(1,-1)){
      $month=Calendar
      $before=Get-Stats; Pump
      $baseline=@($script:events|Where-Object {$_.Stage -eq 28 -and $_.A -gt $width}|Select-Object -Last 1)
      if($baseline.Count -ne 1){throw 'Live contact has no published page-offset baseline.'}
      $handle=$baseline[0].Surface; $offset=$baseline[0].A; $dx=$direction*$width*$fraction/36
      $task=$runner.Precision60($x,$y,36,$dx)
      while(!$task.IsCompleted){Pause 10}
      $injection=$task.Result; Pause 200; $after=Get-Stats
      $received=@($script:events|Where-Object {$_.Stage -eq 7 -and $_.A -eq 4 -and $_.B -eq 2 -and $_.At -ge $injection.Started -and $_.At -le $injection.Ended+0.1})
      $frames=@($script:events|Where-Object {$_.Stage -eq 28 -and $_.Surface -eq $handle -and $_.At -ge $injection.Started -and $_.At -le $injection.Ended})
      $errors=New-Object 'Collections.Generic.List[double]'; $latencies=New-Object 'Collections.Generic.List[double]'; $offsets=New-Object 'Collections.Generic.HashSet[double]'
      foreach($frame in $frames){
        $through=@($received|Where-Object {$_.Input -le $frame.Input})
        $expected=$offset-$dx*$through.Count
        if($through.Count){$latencies.Add(($frame.At-$through[-1].At)*1000)}
        $errors.Add([Math]::Abs($frame.A-$expected)); $null=$offsets.Add([Math]::Round($frame.A,3))
      }
      $maximum=if($errors.Count){($errors|Measure-Object -Maximum).Maximum}else{[double]::PositiveInfinity}
      $latency=if($latencies.Count){($latencies|Measure-Object -Maximum).Maximum}else{[double]::PositiveInfinity}
      Write-Output ('WINDOWS_SCROLL_LIVE_CONTACT '+([ordered]@{direction=$direction;fraction=$fraction;updates=$received.Count;activeFrames=$frames.Count;
        distinctOffsets=$offsets.Count;maximumConsumedOffsetError=$maximum;maximumInputToPublicationMs=$latency;acceptedDelta=(-$dx*$received.Count);
        baseline=$offset;physicalTrackpad='notVerified';scanout='notVerified'}|ConvertTo-Json -Compress))
      if($received.Count -ne 36 -or $frames.Count -lt 12 -or $offsets.Count -lt 12 -or $maximum -gt 0.01 -or $latency -ge 100){throw 'Contact pixels did not continuously follow consumed precision deltas.'}
      Settle; $null=Wait-Month ($month.date.AddMonths(-$direction*[int][Math]::Round($fraction)))
    }
    }
}
function Write-Diagnostics {
  if($script:appDiagnostics){
    $d=$script:appDiagnostics
    Write-Output ('WINDOWS_SCROLL_APP '+([ordered]@{samplesThrough=$d.samplesThrough;samplesOverwritten=$d.samplesOverwritten;
      build=(Gap-Summary @($d.samples|ForEach-Object{$_.buildMs}));capture=(Gap-Summary @($d.samples|ForEach-Object{$_.captureMs}));
      scene=(Gap-Summary @($d.samples|ForEach-Object{$_.sceneMs}));wait=(Gap-Summary @($d.samples|ForEach-Object{$_.waitMs}));
      slowest=@($d.samples|Sort-Object {($_.completed-$_.started)} -Descending|Select-Object -First 5);captureCounters=$d.capture;sceneCounters=$d.scene;scrollCounters=$(if($d.PSObject.Properties['scrolling']){$d.scrolling}else{$null})
    }|ConvertTo-Json -Compress -Depth 8))
  }
  if($CpuProfile){
    if(!$script:profile){Write-Output 'WINDOWS_SCROLL_CPU missing';return}
    $frames=@{};foreach($p in $script:profile.stackFrames.PSObject.Properties){$frames[$p.Name]=$p.Value}
    $self=@{};$inclusive=@{}
    foreach($sample in $script:profile.samples){
      $id=[string]$sample.sf;$leaf=$true;$seen=@{}
      for($depth=0;$id -and $frames.ContainsKey($id) -and $depth -lt 256;++$depth){
        $frame=$frames[$id];$name=$frame.name
        if($leaf){$self[$name]=1+[int]$self[$name];$leaf=$false}
        if(!$seen.ContainsKey($name)){$inclusive[$name]=1+[int]$inclusive[$name];$seen[$name]=$true}
        $parent=$frame.PSObject.Properties['parent'];$id=if($parent){[string]$parent.Value}else{''}
      }
    }
    Write-Output ('WINDOWS_SCROLL_CPU '+([ordered]@{diagnosticOnly=$true;samples=$script:profile.samples.Count;
      self=@($self.GetEnumerator()|Sort-Object Value -Descending|Select-Object -First 22 Name,Value);
      inclusive=@($inclusive.GetEnumerator()|Sort-Object Value -Descending|Select-Object -First 30 Name,Value);gcGeneral=$script:gc.general
    }|ConvertTo-Json -Compress -Depth 8))
    $script:profile=$null;$script:gc=$null
  }
}
try {
  $cli=Join-Path $root 'Nelyx/sdk/tooling/cli/src/main.mjs'
  $runner=New-Object Nelyx.ScrollCheck.Output($node,([string[]]@($cli,'run','--engine','v2','--app',$App,'--target','windows')),$root,(!$NoTrace),[bool]$CpuProfile)
  $until=[Nelyx.ScrollCheck.Desktop]::Now+40
  do {
    Pump
    if (!$native) {
      $children=@(Get-CimInstance Win32_Process -Filter ('ParentProcessId = '+$runner.Process.Id) | Where-Object { $_.ExecutablePath -eq $identity.executable })
      if ($children.Count -eq 1) { $native=[Diagnostics.Process]::GetProcessById($children[0].ProcessId) }
    }
    if ($native) { $window=[Nelyx.ScrollCheck.Desktop]::Window($native.Id) }
    if ($runner.Process.HasExited) { throw 'Windows CLI exited before app readiness.' }
    if ($window -ne [IntPtr]::Zero -and $script:appReady) { break }
    Start-Sleep -Milliseconds 100
  } while ([Nelyx.ScrollCheck.Desktop]::Now -lt $until)
  if (!$script:appReady -or $window -eq [IntPtr]::Zero) { throw 'Owned Windows app window did not become ready.' }
  if (!$NoTrace) { $mapping=New-Object Nelyx.ScrollCheck.Trace($native) }
  $runner.Bind($window,$native.Id)
  Write-Output ('WINDOWS_SCROLL_IDENTITY '+([ordered]@{ supply=$identity; cliPid=$runner.Process.Id; appPid=$native.Id;
    appStartedUtc=$native.StartTime.ToUniversalTime().ToString('o'); hwnd=$window.ToInt64(); dpi=[Nelyx.ScrollCheck.Desktop]::GetDpiForWindow($window) } | ConvertTo-Json -Compress -Depth 5))
  Settle
  if ($Scenario -eq 'All' -or $Scenario -eq 'List') {
    Wheel-Segment 'warm-forward' 16 -30; Settle
    Wheel-Segment 'warm-reverse' 16 30; Settle
    Wheel-Segment 'new-region' 48 -120; Settle
    Wheel-Segment 'revisit-reverse' 48 120; Settle
  }
  if ($Scenario -eq 'Manual') {
    Click-Peer '^Explore components$'; Click-Peer '^Selection$'; Click-Peer '^Choose date$'; Settle
    $stopName='Local\NelyxScrollCheck.Stop.'+$PID
    $manualStop=New-Object Threading.EventWaitHandle($false,[Threading.EventResetMode]::ManualReset,$stopName)
    Write-Output ('WINDOWS_SCROLL_MANUAL_READY '+([ordered]@{stopEvent=$stopName;appPid=$native.Id;hwnd=$window.ToInt64();calendar=(Calendar).name}|ConvertTo-Json -Compress))
    do {
      Pause 2000; $manualStats=Get-Stats
      Write-Output ('WINDOWS_SCROLL_MANUAL_STATE '+([ordered]@{state=$script:coreState;physical=$script:physicalInput;
        received=$manualStats.received;consumed=$manualStats.consumed;queued=$manualStats.queued;frames=$manualStats.frames;
        memory=$manualStats.memoryTotal;errors=@($script:errors.ToArray())}|ConvertTo-Json -Compress -Depth 5))
    } while(!$manualStop.WaitOne(0))
    $physical=@($script:events|Where-Object {$_.Stage -eq 7 -and $_.A -eq 2})
    if($physical.Count){
      $firstPhysical=$physical[0].At; $lastPhysical=$physical[-1].At
      $during=@($script:events|Where-Object {$_.At -ge $firstPhysical -and $_.At -le $lastPhysical})
      $frames=@($during|Where-Object {$_.Stage -eq 27}); $pauses=New-Object 'Collections.Generic.List[object]'
      for($i=1;$i -lt $frames.Count;++$i){
        $before=$frames[$i-1]; $after=$frames[$i]; $gap=($after.At-$before.At)*1000
        if($gap -lt 100){continue}
        $received=@($physical|Where-Object {$_.At -gt $before.At -and $_.At -le $after.At})
        if(!$received.Count){continue}
        $pauses.Add([pscustomobject]@{elapsedMs=$gap;physicalSamples=$received.Count;
          inputSpanMs=($received[-1].At-$received[0].At)*1000;beforeDocument=$before.B;afterDocument=$after.B})
      }
      # These are native reception/publication intervals, not hardware sample
      # times or scanout. inputSpanMs makes idle inside a frame gap explicit.
      Write-Output ('WINDOWS_SCROLL_MANUAL_TIMING '+([ordered]@{physicalSamples=$physical.Count;
        appTurns=(Gap-Summary @($during|Where-Object {$_.Stage -eq 21}|ForEach-Object {$_.B}));
        publicationPauses=@($pauses|Sort-Object elapsedMs -Descending|Select-Object -First 12);
        scanout='notVerified';performanceAccepted=$false}|ConvertTo-Json -Compress -Depth 5))
    }
    Write-Output ('WINDOWS_SCROLL_MANUAL_INPUT '+(@($script:events|Where-Object {$_.Stage -ge 2 -and $_.Stage -le 14}|Select-Object -Last 120)|ConvertTo-Json -Compress -Depth 4))
    Write-Output ('WINDOWS_SCROLL_MANUAL_PEERS '+(@([Nelyx.ScrollCheck.Desktop]::Peers($window))|ConvertTo-Json -Compress -Depth 3))
  }
  if ($Scenario -ne 'List' -and $Scenario -ne 'Manual') {
    Click-Peer '^Explore components$'; Click-Peer '^Selection$'; Click-Peer '^Choose date$'; Settle
    $first=Calendar; Capture 'calendar-initial'
    if($Scenario -eq 'CalendarContact'){
      Precision-LiveContact; $next=Calendar; $precisionNext=$next
    } elseif($Scenario -eq 'CalendarFast'){
      Precision-FastMonths; $next=Calendar; $precisionNext=$next
    } elseif($Scenario -eq 'CalendarReverse'){
      # Reproduce the first gesture on a fresh picker, before any button or
      # forward movement has prepared neighbouring months. Select immediately
      # afterwards: cancel/resize must not conceal a stuck input/Source owner.
      Precision60-Months -2; $next=Calendar; $precisionNext=$next
    } elseif($PrecisionHz -eq 60){
      Precision60-Months $RapidMonths; $first=Calendar; $next=$first; $precisionNext=$first
    } else {
      if($RapidMonths -gt 0){Rapid-Months $RapidMonths; $first=Calendar}
      Click-Peer '^Next month$'; $next=Wait-Month ($first.date.AddMonths(1))
      if ($next.date -ne $first.date.AddMonths(1)) { throw ('Next month button did not advance exactly one month: '+$first.name+' -> '+$next.name) }
      Capture 'calendar-next'
      Click-Peer '^Previous month$'; Settle
      if ((Wait-Month $first.date).date -ne $first.date) { throw 'Previous month button did not restore the calendar.' }
      Precision-Segment 'precision-next' -14; $precisionNext=Wait-Month ($first.date.AddMonths(1)); Capture 'calendar-precision'
      if ($precisionNext.date -ne $first.date.AddMonths(1)) { throw 'Injected precision did not advance exactly one month.' }
      Precision-Segment 'precision-reverse' 14
      if ((Wait-Month $first.date).date -ne $first.date) { throw 'Injected precision reversal did not restore the calendar month.' }
      Drag-Month 'mouse-drag-next' 1; Drag-Month 'mouse-drag-reverse' -1
    }
    if($Scenario -ne 'CalendarReverse' -and $Scenario -ne 'CalendarFast'){
      Precision-Segment 'precision-cancel' -2 'cancel'
      $beforeResize=Calendar
      [Nelyx.ScrollCheck.Desktop]::Resize($window,80); Settle
      if ((Calendar).date -ne $beforeResize.date) { throw 'Resize lost the calendar month anchor.' }
      [Nelyx.ScrollCheck.Desktop]::Resize($window,-80); Settle
    }
    $final=Calendar; $fifteen=@($final.days | Where-Object { $_.Name -match '^15,' })[0]
    [Nelyx.ScrollCheck.Desktop]::Click($window,$fifteen); Pause 200; Capture 'calendar-selected'
    Click-Peer '^OK$'; Settle
    $selected=$final.date.AddDays(14).ToString('yyyy-MM-dd')
    $null=Wait-Peer ('Selected date: '+[regex]::Escape($selected))
    Write-Output ('WINDOWS_SCROLL_CALENDAR '+([ordered]@{ first=$first.name; next=$next.name; precisionNext=$precisionNext.name;
      selected=$selected; uiaHeaderAndAllDays='PASS'; displayedPixels='requires-capture-review'; physicalTrackpad='notVerified' } | ConvertTo-Json -Compress))
  }
  $finalStats=Get-Stats; $runner.Send('trace'); Pause 150
  $runner.Send('close'); $until=[Nelyx.ScrollCheck.Desktop]::Now+15
  while (!$runner.Process.HasExited -and [Nelyx.ScrollCheck.Desktop]::Now -lt $until) { Pause 60 }
  if (!$runner.Process.HasExited) { throw 'Normal Windows close timed out.' }
  $runner.Process.WaitForExit(); Pump
  if (!$script:closed -or $script:closed.status -ne 0 -or $script:closed.reservedBytes -ne 0 -or $script:closed.memoryTotal -ne 0 -or !$script:closed.workersJoined -or $runner.Process.ExitCode -ne 0) { throw 'Windows close did not retire workers/leases cleanly.' }
  $lost=if($mapping){$mapping.Overwritten+$mapping.Unstable+$script:eventDrops}else{0}
  $longDispatch=@(); $longQueue=@(); $longLock=@()
  if ($script:trace) { $longDispatch=@($script:trace.samples | ForEach-Object {$_.elapsedMs}); $longQueue=@($script:trace.samples | ForEach-Object {$_.queueMs}); $longLock=@($script:trace.samples | ForEach-Object {$_.lockHeldMs}) }
  $stalls=@($script:segments | Where-Object { $_.driverTimingUsable -and
    ($_.publicationGaps.ge500 -gt 0 -or @($_.viewportProgress | Where-Object {$_.displayedOffsetGaps.ge500 -gt 0}).Count -gt 0) })
  $usable=$Scenario -ne 'Manual' -and !$NoTrace -and $lost -eq 0 -and $runner.Dropped -eq 0
  Write-Output ('WINDOWS_SCROLL_RESULT '+([ordered]@{ functional=$(if($Scenario -eq 'Manual'){'notVerified'}else{'PASS'}); syntheticStallGoal= $(if(!$usable){'notVerified'}elseif($stalls.Count){'FAIL'}else{'PASS'});
    nativeDelivery=$script:delivery; dispatch=(Gap-Summary $longDispatch); contentQueue=(Gap-Summary $longQueue); coreLockHeld=(Gap-Summary $longLock);
    contentTiming=$finalStats.contentTiming; ringLost=$lost; outputDropped=$runner.Dropped;
    ringThrough=$(if($mapping){$mapping.Through}else{0}); traceOverwritten=$(if($script:trace){$script:trace.overwritten}else{0});
    closed=$script:closed; physicalTrackpad='notVerified'; scanout='notVerified'; performanceAccepted=$false } | ConvertTo-Json -Compress -Depth 8))
} catch {
  if ($window -ne [IntPtr]::Zero) {
    try { Capture 'failure' } catch {}
    try { Write-Output ('WINDOWS_SCROLL_PEERS '+(@([Nelyx.ScrollCheck.Desktop]::Peers($window) | Where-Object {$_.Name -notmatch '^\d{1,2},'} | Select-Object -First 60) | ConvertTo-Json -Compress -Depth 3)) } catch {}
  }
  Write-Output ('WINDOWS_SCROLL_FAILURE '+([ordered]@{ reason=$_.Exception.Message; lastLines=@($script:lastLines.ToArray());
    observedEvents=$script:events.Count; outputDropped=$(if($runner){$runner.Dropped}else{0}) } | ConvertTo-Json -Compress -Depth 4))
  throw
} finally {
  if($manualStop){$manualStop.Dispose()}
  # Only the CLI and native PID created above are eligible for cleanup. No
  # process-name kill, user window cleanup or computed recursive deletion.
  if ($runner) {
    $runner.CancelPrecision()
    if (!$runner.Process.HasExited) {
      try { $runner.Send('close') } catch {}
      if ($window -ne [IntPtr]::Zero) { [Nelyx.ScrollCheck.Desktop]::Close($window) }
      $null=$runner.Process.WaitForExit(5000)
    }
    if ($native -and !$native.HasExited) { $native.Kill(); $native.WaitForExit() }
    if (!$runner.Process.HasExited) { $runner.Process.Kill(); $runner.Process.WaitForExit() }
    foreach($line in $runner.Take()){
      if($line.StartsWith('V2_CLOSED ')){$script:closed=$line.Substring(10)|ConvertFrom-Json}
      elseif($line.StartsWith('V2_APP {"kind":"app-disposed"')){$script:appDiagnostics=($line.Substring(7)|ConvertFrom-Json).diagnostics}
    }
    Write-Output ('WINDOWS_SCROLL_CLEANUP '+([ordered]@{exitCode=$runner.Process.ExitCode;closed=$script:closed;appExited=$(if($native){$native.HasExited}else{$null})}|ConvertTo-Json -Compress -Depth 4))
    if ($mapping) { $mapping.Dispose() }
    if ($native) { $native.Dispose() }
    $runner.Dispose()
    Write-Diagnostics
  }
}
