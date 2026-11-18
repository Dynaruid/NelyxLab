#requires -Version 7.0
<#
.SYNOPSIS
Runs a two-finger scroll on the left of the Windows Demo's All components page.
.DESCRIPTION
Opens the last normal Demo bytecode package in its own window. Injects two touchpad
contacts at 16 ms intervals by default. Use -InputIntervalMs 8 for 125 Hz input.
Keep the window in front and the mouse still.
CursorX and CursorY are fractions of the left column's visible scroll area.
#>
[CmdletBinding()]
param(
    [ValidateRange(0.01,0.99)][double]$CursorX = 0.5,
    [ValidateRange(0.05,0.95)][double]$CursorY = 0.80,
    [ValidateSet(8,16)][int]$InputIntervalMs = 16
)
$ErrorActionPreference = 'Stop'
if (!$IsWindows) { throw 'This test requires Windows with synthetic precision touchpad support.' }
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
if (!('GalleryTouchpad' -as [type])) { Add-Type -Path (Join-Path $PSScriptRoot 'GalleryTouchpad.cs') }
$package = Join-Path $PSScriptRoot '../.nelyx/native-windows/current-bytecode'
if (!(Test-Path -LiteralPath "$package/native-package.json")) {
    throw 'Prepare the normal Demo first: npm.cmd run run:windows --workspace @nelyx/demo'
}
$manifest = Get-Content "$package/native-package.json" -Raw | ConvertFrom-Json
if ($manifest.app -ne 'NelyxDemoApp' -or $manifest.mode -ne 'bytecode' -or $manifest.appEntry -ne 'src/index.ts') {
    throw 'Expected the default Demo entry. Run npm.cmd run run:windows --workspace @nelyx/demo first.'
}

function Read-Gallery {
    $root = [Windows.Automation.AutomationElement]::FromHandle($window)
    $elements = $root.FindAll([Windows.Automation.TreeScope]::Descendants, [Windows.Automation.Condition]::TrueCondition)
    $visible = @{}
    foreach ($element in $elements) {
        try {
            $current = $element.Current
            $rect = $current.BoundingRectangle
            if ($current.AutomationId -and !$current.IsOffscreen -and !$rect.IsEmpty -and $rect.Height -gt 0) {
                $visible[$current.AutomationId] = $rect
            }
        } catch [Windows.Automation.ElementNotAvailableException] { continue }
    }
    return $visible
}

$device = [IntPtr]::Zero
$app = $null
$oldCursor = [GalleryTouchpad+Point]::new()
$restoreCursor = $false
$dpi = [GalleryTouchpad]::SetThreadDpiAwarenessContext([IntPtr](-4))
try {
    $device = [GalleryTouchpad]::Create()
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = (Resolve-Path "$package/NelyxHermesHost.exe").Path
    $start.WorkingDirectory = (Resolve-Path $package).Path
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardError = $true
    $start.RedirectStandardOutput = $true
    $start.Environment['NELYX_TRACKPAD_DIAGNOSTICS'] = '1'
    foreach ($arg in @('app.hbc','Assets','bytecode','1200000')) { $start.ArgumentList.Add($arg) }
    $app = [Diagnostics.Process]::Start($start)
    $stderr = $app.StandardError.ReadToEndAsync()
    $stdout = $app.StandardOutput.ReadToEndAsync()
    $startup = [Diagnostics.Stopwatch]::StartNew()
    do {
        if ($app.HasExited) { throw "Demo exited during startup: $($stderr.Result)" }
        Start-Sleep -Milliseconds 100
        $app.Refresh()
        $window = $app.MainWindowHandle
    } until ($window -ne 0 -or $startup.Elapsed.TotalSeconds -ge 45)
    if ($window -eq 0) { throw 'Timed out waiting for the Demo window.' }
    [void][GalleryTouchpad]::ShowWindowAsync($window, 3) # maximize to select the two-column layout
    [void][GalleryTouchpad]::SetForegroundWindow($window)
    do {
        Start-Sleep -Milliseconds 150
        $initial = Read-Gallery
        $columns = @($initial.Keys | Where-Object { $_ -like 'source-scroll-semantics-*' } |
            ForEach-Object { $initial[$_] } | Sort-Object Left)
        $ready = $columns.Count -eq 2 -and $columns[0].Right -le $columns[1].Left -and
            $initial.ContainsKey('demo-elevated') -and $initial.ContainsKey('favorite-standard')
    } until ($ready -or $startup.Elapsed.TotalSeconds -ge 45)
    if (!$ready) { throw 'All components must show both columns on this display (over 1000 logical px).' }
    if ([GalleryTouchpad]::GetForegroundWindow() -ne $window) { throw 'Demo could not acquire the foreground.' }
    $left = $columns[0]
    $x = [int]($left.Left + $left.Width * $CursorX)
    $y = [int]($left.Top + $left.Height * $CursorY)
    if (![GalleryTouchpad]::GetPhysicalCursorPos([ref]$oldCursor) -or ![GalleryTouchpad]::SetPhysicalCursorPos($x,$y)) {
        throw 'Could not position the mouse over the left column.'
    }
    $restoreCursor = $true
    Start-Sleep -Milliseconds 200

    $gaps = [Collections.Generic.List[double]]::new()
    $seen = [Collections.Generic.HashSet[string]]::new()
    $strokeCount = 0
    $fingersUp = $true
    foreach ($phase in 'down','back') {
        $arrived = $false
        for ($stroke = 1; $stroke -le 14; $stroke++) {
            # Shorter gestures keep both sections observable between UIA publications.
            $gaps.AddRange([GalleryTouchpad]::Swipe($device,$window,$x,$y,$fingersUp,3000,$InputIntervalMs))
            $strokeCount++
            # UIA publication is throttled by the Demo. Observe only between gestures.
            Start-Sleep -Milliseconds 500
            $now = Read-Gallery
            if (!$now.ContainsKey('favorite-standard') -or $now['favorite-standard'] -ne $initial['favorite-standard']) {
                throw 'The right-column anchor moved or disappeared.'
            }
            foreach ($id in 'slider-value','range-value-start','range-custom-start','field-filled','field-outlined') {
                if ($now.ContainsKey($id)) { [void]$seen.Add($id) }
            }
            if ($phase -eq 'down') {
                $arrived = $now.ContainsKey('field-outlined') -and
                    $now['field-outlined'].Bottom -le ($left.Top + $left.Height * 0.80)
                if ($stroke -eq 1 -and $now['demo-elevated'] -eq $initial['demo-elevated']) {
                    $fingersUp = !$fingersUp # respect a reversed touchpad scroll preference
                }
            } else {
                $arrived = $now['demo-elevated'] -eq $initial['demo-elevated']
            }
            Write-Verbose "$phase stroke $stroke; observed controls: $($seen -join ', ')"
            if ($arrived) { break }
        }
        if (!$arrived) { throw "The left column did not reach the $phase endpoint within 14 strokes." }
        $fingersUp = !$fingersUp
    }
    if (!$seen.Contains('field-outlined') -or !($seen -match '^(slider-value|range-)')) {
        throw 'Could not observe both the Sliders and Text fields sections during the trip.'
    }
    [void]$app.CloseMainWindow()
    if (!$app.WaitForExit(10000) -or $app.ExitCode -ne 0) { throw 'Demo did not shut down cleanly.' }
    $trace = $stderr.GetAwaiter().GetResult()
    foreach ($event in 'panZoomStart','panZoomUpdate','panZoomEnd') {
        if ($trace -notmatch "NELYX_TRACKPAD [\d.]+ $event ") { throw "Missing native DirectManipulation event: $event" }
    }
    $exitLine = $stdout.GetAwaiter().GetResult() -split '\r?\n' | Where-Object { $_ -like 'NELYX_NATIVE_EXIT *' } | Select-Object -Last 1
    if (!$exitLine) { throw 'Native input totals were not reported at shutdown.' }
    $native = $exitLine.Substring('NELYX_NATIVE_EXIT '.Length) | ConvertFrom-Json
    if ($native.inputRejected -ne 0 -or $native.inputAccepted -le 0) { throw "Unexpected input totals: $exitLine" }
    $gaps.Sort()
    [pscustomobject]@{
        Page = 'All components'; Column = 'left'; Input = 'PT_TOUCHPAD / panZoom'
        TargetIntervalMs = $InputIntervalMs; Strokes = $strokeCount; Intervals = $gaps.Count
        SendP50Ms = [math]::Round($gaps[[int][math]::Ceiling($gaps.Count * .50) - 1], 2)
        SendP95Ms = [math]::Round($gaps[[int][math]::Ceiling($gaps.Count * .95) - 1], 2)
        SendMaxMs = [math]::Round($gaps[$gaps.Count - 1], 2)
        HostInputAccepted = $native.inputAccepted; HostInputRejected = $native.inputRejected
        ObservedControls = ($seen -join ', '); ReturnedToStart = $true
    }
} finally {
    if ($device -ne 0) { [GalleryTouchpad]::Close($device) }
    if ($app) {
        if (!$app.HasExited) {
            [void]$app.CloseMainWindow()
            if (!$app.WaitForExit(5000)) { $app.Kill(); $app.WaitForExit() }
        }
        $app.Dispose()
    }
    $currentCursor = [GalleryTouchpad+Point]::new()
    if ($restoreCursor -and [GalleryTouchpad]::GetPhysicalCursorPos([ref]$currentCursor) -and
        $currentCursor.X -eq $x -and $currentCursor.Y -eq $y) {
        [void][GalleryTouchpad]::SetPhysicalCursorPos($oldCursor.X,$oldCursor.Y)
    }
    if ($dpi -ne 0) { [void][GalleryTouchpad]::SetThreadDpiAwarenessContext($dpi) }
}
