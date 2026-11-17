param([Parameter(Mandatory)][string]$Package,[Parameter(Mandatory)][string]$StopPath,[Parameter(Mandatory)][string]$ReadyPath,[Parameter(Mandatory)][string]$OutputPath,[ValidateSet('NelyxHermesHost.exe','NelyxJscHost.exe')][string]$HostExecutable='NelyxHermesHost.exe')
$ErrorActionPreference='Stop'
if($PSVersionTable.PSVersion.Major -lt 7){throw 'Screen observation requires PowerShell 7'}
Add-Type -Path (Join-Path $PSScriptRoot 'windows-jank-screen.cs')
$targetExe=Join-Path ([IO.Path]::GetFullPath($Package)) $HostExecutable
$owned=@(Get-CimInstance Win32_Process -Filter "Name='$HostExecutable'"|Where-Object {$_.ExecutablePath -eq $targetExe})
if($owned.Count -ne 1){throw 'One owned screen target is required'}
$window=(Get-Process -Id $owned[0].ProcessId).MainWindowHandle
$observation=[JankScreen]::Capture($window,$StopPath,$ReadyPath)
[IO.File]::WriteAllText($OutputPath,($observation|ConvertTo-Json -Depth 5 -Compress))
