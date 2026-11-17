param(
  [ValidateSet('calendar','gallery','boundaries','testbed','list')][string]$Scenario = 'calendar',
  [ValidateRange(1,30)][int]$Runs = 3,
  [switch]$RunOnce, [switch]$NoScreen, [string]$SummaryPath = '',
  [ValidateSet('demo','testbed')][string]$App = 'demo',
  [ValidateSet('bytecode','static-aot')][string]$HermesMode = 'bytecode',
  [ValidateSet('hermes','jsc')][string]$Engine = 'hermes',
  [ValidateSet('interpreter','jit')][string]$JscMode = 'interpreter',
  [ValidateSet('legacy','split')][string]$Preparation = 'legacy',
  [switch]$Diagnostic,
  [string]$CompilerCache = ''
)
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'Run this check with PowerShell 7 (pwsh).' }
Push-Location -LiteralPath (Join-Path $PSScriptRoot '../..')
try {
  $taskArguments = @((Join-Path $PSScriptRoot 'check-windows-jank.mjs'), '--scenario', $Scenario, '--runs', $Runs, '--app', $App, '--hermes-mode', $HermesMode)
  $taskArguments += @('--engine', $Engine, '--jsc-mode', $JscMode)
  $taskArguments += @('--preparation', $Preparation)
  if ($Diagnostic) { $taskArguments += '--diagnostic' }
  if ($RunOnce) { $taskArguments += '--child' }
  if ($NoScreen) { $taskArguments += '--no-screen' }
  if ($SummaryPath) { $taskArguments += @('--summary-file', $SummaryPath) }
  if ($CompilerCache) { $taskArguments += @('--compiler-cache', $CompilerCache) }
  & node @taskArguments
  if ($LASTEXITCODE -ne 0) { throw "Windows $Scenario check failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }
