// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = String.raw`
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path (Get-Location) 'Nelyx/eng/check-windows-scroll.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Parser failure'}
foreach($name in @('Gap-Summary','Record-ContinuousMovement')){
  $function=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
  Invoke-Expression $function.Extent.Text
}
$injection=[pscustomobject]@{Started=1.0;Ended=1.1}
function Row($stage,$at,$sequence,$a,$b){[pscustomobject]@{Stage=$stage;At=$at;Input=$sequence;A=$a;B=$b;Surface=9}}
function Check($rows,$goal,$reason){
  $script:events=@($rows);$script:movementChecks=New-Object 'Collections.Generic.List[object]'
  $null=Record-ContinuousMovement $injection -10 2
  $result=$script:movementChecks[0]
  if($result.goal -ne $goal -or $result.reason -ne $reason){throw ('Unexpected movement verdict: '+($result|ConvertTo-Json -Compress -Depth 5))}
}
$baseline=Row 28 0.9 0 0 0
$inputs=@((Row 7 1.0 1 4 2),(Row 7 1.01 2 4 2))
$NoTrace=$false
Check (@($baseline)+$inputs+@((Row 28 1.02 1 10 10),(Row 28 1.04 2 20 20))) 'PASS' 'complete'
Check (@($baseline)+$inputs+@((Row 28 1.02 1 0 10),(Row 28 1.2 2 20 20))) 'FAIL' 'complete'
Check (@($baseline)+$inputs+@((Row 28 1.02 1 10 10),(Row 28 1.04 2 10 20))) 'notVerified' 'incomplete-movement-or-trajectory'
Check (@($baseline)+$inputs+@((Row 28 1.02 1 10 10),(Row 28 1.04 2 20 25))) 'notVerified' 'incomplete-movement-or-trajectory'
Check (@($baseline)+@($inputs[0])+@((Row 28 1.02 1 10 10))) 'notVerified' 'incomplete-input-or-viewport'
$NoTrace=$true
Check @() 'notVerified' 'trace-disabled'
'Movement oracle: actual reflection, 200ms backlog failure, missing frames/input, trajectory mismatch and trace-off PASS'
`;
const result = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
  {
    cwd: path.resolve(import.meta.dirname, '../..'),
    encoding: 'utf8',
    timeout: 1_200_000,
    windowsHide: true,
  },
);
if (result.error || result.status)
  throw Error(`${result.error ?? result.status}\n${result.stdout}${result.stderr}`);
console.log(result.stdout.trim());
