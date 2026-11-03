# SPDX-License-Identifier: BSD-3-Clause
# Dot-sourced by the owned OS-wheel helper after window discovery/activation.
function Invoke-GalleryFullRange {
  function Read-Range([string]$command='snapshot') {
    $button=Find-Action ('gallery-range-'+$command)
    if($null -eq $button){throw 'FAIL_WARMUP_NOT_COMPLETE: missing opt-in Gallery observation'}
    ([Windows.Automation.InvokePattern]$button.GetCurrentPattern([Windows.Automation.InvokePattern]::Pattern)).Invoke()
    $deadline=[DateTime]::UtcNow.AddSeconds(15)
    do {
      $status=Find-Action 'gallery-range-snapshot'
      if($null -ne $status){
        $value=$status.Current.Name
        if($value.StartsWith('{')){
          $snapshot=$value|ConvertFrom-Json
          if($snapshot.schema -eq 1 -and $snapshot.serial -gt $script:rangeSerial){$script:rangeSerial=$snapshot.serial;return $snapshot}
        }
      }
      Start-Sleep -Milliseconds 50
    }while([DateTime]::UtcNow -lt $deadline)
    throw 'FAIL_WARMUP_NOT_COMPLETE: Gallery snapshot did not publish'
  }
  $script:rangeSerial=0
  function Get-Column($snapshot,[string]$name){return $snapshot.columns.$name}
  function Move-Range([string]$name,[bool]$down) {
    $fraction=if($name -eq 'primary'){0.4}else{2.0/3.0}
    for($step=0;$step -lt 512;$step++) {
      $snapshot=Read-Range
      $column=Get-Column $snapshot $name
      if($null -eq $column -or $column.viewport -le 0){throw ('FAIL_WARMUP_NOT_COMPLETE: no two-column owner '+$name)}
      $remaining=if($down){$column.max-$column.offset}else{$column.offset-$column.min}
      if($remaining -le 0.5){return $snapshot}
      $distance=[Math]::Min($remaining,$column.viewport*0.65)
      $before=$column.offset
      [void][NelyxContinuousScroll]::WheelLogical($window,$fraction,$(if($down){$distance}else{-$distance}))
      Start-Sleep -Milliseconds 100
      $after=Read-Range
      $actual=(Get-Column $after $name).offset-$before
      if([Math]::Abs($actual) -lt 0.1){throw ('FAIL_WARMUP_NOT_COMPLETE: OS wheel did not move '+$name)}
      # Calibrate the real OS wheel mapping before allowing elapsed-time input.
      if(@($column.measured).Count -eq @($column.ids).Count -and [Math]::Abs((Get-Column $after $name).max-$column.max) -le 0.5 -and
        [Math]::Abs([Math]::Abs($actual)-$distance) -gt 2.0){throw ('FAIL_WARMUP_NOT_COMPLETE: wheel logical mapping differs '+$actual+'/'+$distance)}
    }
    throw 'FAIL_WARMUP_NOT_COMPLETE: bounded traversal exhausted'
  }
  $warming=[Diagnostics.Stopwatch]::StartNew();$complete=$false;$gate=@();$passes=0
  for($pass=1;$pass -le 3;$pass++) {
    $passes=$pass
    foreach($name in @('primary','secondary')) {
      $null=Move-Range $name $false
      $bottom=Move-Range $name $true
      $column=Get-Column $bottom $name
      if($column.visible -notcontains $column.ids[-1]){throw ('FAIL_WARMUP_NOT_COMPLETE: last section not in submitted frame '+$name)}
    }
    foreach($name in @('primary','secondary')){$null=Move-Range $name $false}
    $gate=@()
    for($observation=0;$observation -lt 3;$observation++){$gate+=Read-Range;Start-Sleep -Milliseconds 100}
    $complete=$true
    foreach($snapshot in $gate) {
      if($snapshot.includePlanned -or @($snapshot.resourceErrors).Count -ne 0 -or $snapshot.configuration -ne $gate[0].configuration){$complete=$false}
      foreach($name in @('primary','secondary')) {
        $column=Get-Column $snapshot $name;$first=Get-Column $gate[0] $name
        if($null -eq $column -or @($column.ids).Count -eq 0 -or
          @($column.loaded).Count -ne @($column.ids).Count -or @($column.measured).Count -ne @($column.ids).Count -or
          [Math]::Abs($column.offset-$column.min) -gt 0.5 -or [Math]::Abs($column.max-$first.max) -gt 0.5){$complete=$false}
      }
    }
    if($complete){break}
  }
  if(-not $complete){Write-Output ('GALLERY_WARMUP_FAILURE '+($gate[-1]|ConvertTo-Json -Depth 12 -Compress));throw 'FAIL_WARMUP_NOT_COMPLETE: maximum three passes'}
  $warmupMs=$warming.Elapsed.TotalMilliseconds
  $legs=@()
  foreach($name in @('primary','secondary')) {
    $start=Read-Range $name;$column=Get-Column $start $name
    if($start.configuration -ne $gate[0].configuration -or [Math]::Abs($column.offset-$column.min) -gt 0.5){throw 'FAIL_FULL_RANGE_COVERAGE: invalid start'}
    $fraction=if($name -eq 'primary'){0.4}else{2.0/3.0}
    $input=[NelyxContinuousScroll]::SweepDown($window,$fraction,($column.max-$column.min),$column.viewport)
    $end=Read-Range 'finish';$leg=$end.leg
    $legs+=@{column=$name;inputXFraction=$fraction;direction=-1;nativeBeginMs=$input.NativeBeginMs;nativeEndMs=$input.NativeEndMs;
      packets=$input.Packets;maxPacket=$input.MaxPacket;wheelUnits=$input.WheelUnits;wheelPixelsPerUnit=[NelyxContinuousScroll]::WheelPixelsPerUnit();
      physicalWidth=$input.PhysicalWidth;physicalHeight=$input.PhysicalHeight;dpi=$input.Dpi;
      surfaceFPS=$input.SurfaceFPS;surfaceUpdates=$input.SurfaceUpdates;surfaceDurationMs=$input.InputMs;travelMs=$input.TravelMs;
      endpointAllowanceMs=500;observation=$end;
      rangeScope='All components fully warmed; one original QPC-paced top-to-bottom leg; submitted-frame coverage; surface counter observations; scanout unobserved'}
  }
  return @{checks=$legs;warmup=@{passes=$passes;durationMs=$warmupMs;observations=$gate}}
}
