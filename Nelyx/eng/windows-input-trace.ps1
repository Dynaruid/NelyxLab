# SPDX-License-Identifier: BSD-3-Clause
param([Parameter(Mandatory=$true)][int]$TargetProcessId,[switch]$Raw,[ValidateRange(0,8192)][int]$Tail=0)
$ErrorActionPreference='Stop'
$taskNames=@('window-wheel','precision-state','precision-interaction','precision-tick','precision-content','precision-emit','precision-surface-drop','native-input','payload-written','wheel-suppressed','wheel-surface-drop','sdk-received','sdk-drop','sdk-queued','core-queued','core-dispatch-begin','core-dispatch-end','core-drop','frame-requested','clock-ready','js-frame-begin','js-frame-end','ui-queued','ui-begin','ui-end','frame-submitted','gpu-complete','surface-updated','frame-retired','frame-failed','focus','frame-superseded')
$taskMap=[System.IO.MemoryMappedFiles.MemoryMappedFile]::OpenExisting("Local\NelyxInputTrace.v1.$TargetProcessId")
$taskView=$null
try{
  $taskView=$taskMap.CreateViewAccessor(0,0,[System.IO.MemoryMappedFiles.MemoryMappedFileAccess]::Read)
  if($taskView.ReadInt64(0) -ne 0x4e4c585452414345L -or $taskView.ReadInt64(8) -ne 1 -or $taskView.ReadInt64(16) -ne $TargetProcessId -or $taskView.ReadInt64(32) -ne 64 -or $taskView.ReadInt64(40) -ne 8192){throw 'Native input recorder identity mismatch'}
  $taskProcess=Get-Process -Id $TargetProcessId -ErrorAction SilentlyContinue
  if($taskProcess -and $taskProcess.StartTime.ToUniversalTime().ToFileTimeUtc() -ne $taskView.ReadInt64(24)){throw 'Native process identity was reused'}
  function Read-Entry([long]$Offset,[long]$Expected=0){
    $taskSequence=$taskView.ReadInt64($Offset);if($taskSequence -le 0 -or ($Expected -ne 0 -and $taskSequence -ne $Expected)){return}
    $taskStage=$taskView.ReadInt64($Offset+16);if($taskStage -lt 0 -or $taskStage -ge $taskNames.Count){return}
    $taskEntry=[PSCustomObject]@{sequence=$taskSequence;qpcMs=$taskView.ReadDouble($Offset+8);stage=$taskNames[$taskStage];view=$taskView.ReadInt64($Offset+24);surface=$taskView.ReadInt64($Offset+32);input=$taskView.ReadInt64($Offset+40);a=$taskView.ReadDouble($Offset+48);b=$taskView.ReadDouble($Offset+56)}
    if($taskView.ReadInt64($Offset) -eq $taskSequence){return $taskEntry}
  }
  $taskStored=$taskView.ReadInt64(56);$taskLatest=@();$taskEntries=@()
  for($taskStage=0;$taskStage -lt 32;$taskStage++){$taskEntry=Read-Entry (128+$taskStage*64);if($taskEntry){$taskLatest+=$taskEntry}}
  for($taskIndex=[Math]::Max(1,$taskStored-8191);$taskIndex -le $taskStored;$taskIndex++){$taskEntry=Read-Entry (2176+(($taskIndex-1)%8192)*64) $taskIndex;if($taskEntry){$taskEntries+=$taskEntry}}
  $taskNow=[System.Diagnostics.Stopwatch]::GetTimestamp()*1000.0/[System.Diagnostics.Stopwatch]::Frequency
  $taskSummaries=@($taskLatest|ForEach-Object {[PSCustomObject]@{stage=$_.stage;count=$_.sequence;ageMs=[Math]::Round($taskNow-$_.qpcMs,2);qpcMs=[Math]::Round($_.qpcMs,3);view=$_.view;surface=$_.surface;input=$_.input;a=$_.a;b=$_.b}})
  $taskResult=[ordered]@{schema='nelyx.native-input-trace/v1';pid=$TargetProcessId;status=$taskView.ReadInt64(72);sampleEvery=$taskView.ReadInt64(48);observed=$taskView.ReadInt64(64);stored=$taskStored;retained=$taskEntries.Count;nowQpcMs=$taskNow;stages=$taskSummaries;scope='payload-written is not SDK receipt; native frame input is Core input counter, not native packet sequence; retired is not a display receipt'}
  if($Raw){$taskResult.entries=if($Tail -gt 0){@($taskEntries|Select-Object -Last $Tail)}else{$taskEntries}}else{
    $taskResult.recent=@($taskEntries|Select-Object -Last 48)
    $taskResult.exceptions=@($taskEntries|Where-Object {$_.stage -in @('sdk-drop','core-drop','precision-surface-drop','wheel-surface-drop','frame-failed') -or ($_.stage -eq 'js-frame-end' -and $_.b -ge 100) -or ($_.stage -eq 'sdk-received' -and $_.a -gt 0 -and $_.qpcMs-$_.a -ge 200) -or ($_.stage -in @('core-dispatch-begin','core-dispatch-end') -and $_.b -ge 200) -or ($_.stage -eq 'ui-begin' -and $_.a -ge 200)}|Select-Object -Last 48)
    $taskMoving=@($taskEntries|Where-Object {$_.stage -eq 'native-input' -and $_.a -in @(0,2) -and [Math]::Abs($_.b) -gt 0.01})
    $taskGaps=@()
    foreach($taskGroup in ($taskEntries|Where-Object {$_.stage -in @('precision-tick','precision-content','precision-emit','native-input','sdk-received','core-dispatch-begin','core-dispatch-end','frame-submitted','gpu-complete','surface-updated','frame-retired')}|Group-Object stage,view,surface)){
      $taskPrevious=$null
      foreach($taskEntry in ($taskGroup.Group|Sort-Object qpcMs)){
        if($taskPrevious -and $taskEntry.qpcMs-$taskPrevious.qpcMs -ge 500){
          $taskActive=@($taskMoving|Where-Object {$_.qpcMs -gt $taskPrevious.qpcMs -and $_.qpcMs -le $taskEntry.qpcMs}).Count
          $taskGaps+=[PSCustomObject]@{stage=$taskEntry.stage;fromQpcMs=$taskPrevious.qpcMs;toQpcMs=$taskEntry.qpcMs;gapMs=[Math]::Round($taskEntry.qpcMs-$taskPrevious.qpcMs,2);fromInput=$taskPrevious.input;toInput=$taskEntry.input;movingNativeSamples=$taskActive}
        }
        $taskPrevious=$taskEntry
      }
    }
    $taskResult.gaps=@($taskGaps|Sort-Object toQpcMs|Select-Object -Last 32)
    # Ring entries are sampled: a long interval between entries is not by itself
    # a frame outage. Consecutive native submission ids establish that interval.
    # Keep terminal input in the report; an end/cancel during continued physical
    # motion is a suspect transition, not evidence that the user stopped.
    $taskFrameGaps=@()
    $taskTerminals=@($taskEntries|Where-Object {$_.stage -eq 'native-input' -and $_.a -in @(1,3,4)})
    foreach($taskGroup in ($taskEntries|Where-Object {$_.stage -eq 'frame-submitted'}|Group-Object view,surface)){
      $taskPrevious=$null
      foreach($taskEntry in ($taskGroup.Group|Sort-Object qpcMs)){
        if($taskPrevious -and $taskEntry.qpcMs-$taskPrevious.qpcMs -ge 300){
          $taskTransitions=@($taskTerminals|Where-Object {$_.view -eq $taskEntry.view -and $_.surface -eq $taskEntry.surface -and $_.qpcMs -ge $taskPrevious.qpcMs-250 -and $_.qpcMs -le $taskEntry.qpcMs}|ForEach-Object {
            [PSCustomObject]@{qpcMs=$_.qpcMs;kind=if($_.a -eq 1){'panZoomStart'}elseif($_.a -eq 3){'panZoomEnd'}else{'inertiaCancel'};nativeInput=$_.input}
          })
          $taskSubmissionDelta=$taskEntry.b-$taskPrevious.b
          $taskFrameGaps+=[PSCustomObject]@{view=$taskEntry.view;surface=$taskEntry.surface;fromQpcMs=$taskPrevious.qpcMs;toQpcMs=$taskEntry.qpcMs;gapMs=[Math]::Round($taskEntry.qpcMs-$taskPrevious.qpcMs,2);fromSubmission=$taskPrevious.b;toSubmission=$taskEntry.b;submissionDelta=$taskSubmissionDelta;consecutiveSubmissions=$taskSubmissionDelta -eq 1;fromCoreInput=$taskPrevious.input;toCoreInput=$taskEntry.input;transitions=$taskTransitions}
        }
        $taskPrevious=$taskEntry
      }
    }
    $taskResult.frameGaps=@($taskFrameGaps|Sort-Object toQpcMs|Select-Object -Last 16)
    $taskResult.gapScope='gaps are sampled-stage intervals; frameGaps establish an actual submission gap only when consecutiveSubmissions=true; end/cancel does not establish physical finger lift or normal idle; submissions are not display receipts'
  }
  $taskResult|ConvertTo-Json -Depth 5 -Compress
}finally{if($taskView){$taskView.Dispose()};$taskMap.Dispose()}
