// Exercise the real QPC pacer with sender work, without taking desktop focus.
import path from 'node:path';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

await execute(
  'pwsh.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -Path 'Nelyx/eng/windows-jank-input.cs'
function Assert($condition, $message) { if (!$condition) { throw $message } }
Assert ([Runtime.InteropServices.Marshal]::SizeOf([type][FastCalendarInput+Input]) -eq 40) 'Win64 INPUT layout'
Assert ([Runtime.InteropServices.Marshal]::SizeOf([type][FastCalendarInput+PointerInfo]) -eq 96) 'Win64 POINTER_INFO layout'
Assert ([Runtime.InteropServices.Marshal]::SizeOf([type][FastCalendarInput+TouchInfo]) -eq 144) 'Win64 POINTER_TOUCH_INFO layout'
$work = [Action[int]] { param($i) [Threading.Thread]::Sleep(2) }
$wheel = [FastCalendarInput]::Replay([FastCalendarInput]::Deadlines(50,60),60,$work)
Assert ($wheel.Injected -eq 50 -and $wheel.CadenceValid) 'Wheel pacing/accounting'
Assert ([Math]::Abs($wheel.EffectiveHz - 60) -lt 0.5) 'Sender work accumulated into wheel cadence'
$results = @($wheel)
foreach ($plan in @(@(6,12,24,500,100), @(6,6,16,500,100), @(12,6,16,100,500))) {
  $count,$move,$gap,$from,$to = $plan
  $frames = [FastCalendarInput]::SwipeFrames($count,$move,$gap,60,$from,$to,200)
  $stride = $frames.Count / $count
  Assert ([Math]::Abs(($stride-2)*1000/60 - $move*8) -le 1000/120) 'Gesture duration changed beyond half a frame'
  for ($g=0; $g -lt $count; $g++) {
    $a=$g*$stride; $b=$a+$stride-1
    Assert ($frames[$a].Flags -eq 0x10006 -and $frames[$b].Flags -eq 0x40000) 'Missing touch terminals'
    Assert ($frames[$a].X -eq $from -and $frames[$b].X -eq $to -and $frames[$b-1].X -eq $to) 'Lost swipe endpoint'
    for ($i=$a+1; $i -lt $b; $i++) {
      Assert ($frames[$i].Flags -eq 0x20006) 'Lost swipe update'
      Assert (($frames[$i].X-$frames[$i-1].X)*[Math]::Sign($to-$from) -gt 0) 'Reversed swipe trajectory'
      Assert ([Math]::Abs($frames[$i].At-$frames[$i-1].At-1000/60) -lt 0.001) 'Non-60Hz motion deadline'
    }
    if ($g -gt 0) { Assert ($frames[$a].At-$frames[$a-1].At -ge $gap-0.001) 'Lost recontact gap' }
  }
  $timing = [FastCalendarInput]::Replay([double[]]@($frames | ForEach-Object At),60,$work)
  Assert ($timing.Injected -eq $frames.Count -and $timing.CadenceValid) 'Swipe pacing/accounting'
  $results += $timing
}
$script:sent = 0
$missed = $false
try {
  [void][FastCalendarInput]::Replay([FastCalendarInput]::Deadlines(3,60),60,[Action[int]] {
    param($i) $script:sent++; [Threading.Thread]::Sleep(40)
  })
} catch { if ($_.Exception.ToString().Contains('Input deadline missed')) { $missed=$true } else { throw } }
Assert ($missed -and $script:sent -eq 1) 'Late sender caught up in a burst instead of failing'
$script:sent = 0
try {
  [void][FastCalendarInput]::Replay([double[]]@(0,0),60,[Action[int]] { param($i) $script:sent++ })
  throw 'Non-increasing deadlines accepted'
} catch { Assert ($_.Exception.ToString().Contains('Input deadlines must increase')) 'Wrong invalid-schedule failure' }
Assert ($script:sent -eq 0) 'Invalid plan emitted input'
Write-Output ('WINDOWS_INPUT_PASS '+(@{Cases=6;Profiles=@($results | ForEach-Object {
  @{Hz=$_.Hz;EffectiveHz=$_.EffectiveHz;Injected=$_.Injected;MaxLatenessMs=$_.MaxLatenessMs;MaxIntervalErrorMs=$_.MaxIntervalErrorMs}
})}|ConvertTo-Json -Compress -Depth 4))
`,
  ],
  { cwd: path.resolve(import.meta.dirname, '../..'), timeout: 1_200_000 },
);
