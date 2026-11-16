param(
  [ValidateSet('calendar','gallery','boundaries','testbed')][string]$Scenario = 'calendar',
  [ValidateRange(1,30)][int]$Runs = 3,
  [switch]$RunOnce,
  [ValidateSet('demo','testbed')][string]$App = 'demo'
)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Run this check with PowerShell 7 (pwsh).' }
Push-Location -LiteralPath (Join-Path $PSScriptRoot '../..')
try {
  $taskArguments = @((Join-Path $PSScriptRoot 'check-windows-jank.mjs'), '--scenario', $Scenario, '--runs', $Runs, '--app', $App)
  if ($RunOnce) { $taskArguments += '--child' }
  & node @taskArguments
  if ($LASTEXITCODE -ne 0) { throw "Windows $Scenario check failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }
