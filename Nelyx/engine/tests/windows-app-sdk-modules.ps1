param(
  [Parameter(Mandatory = $true)][int]$ProcessId,
  [Parameter(Mandatory = $true)][string]$AppSdkRoot
)
$ErrorActionPreference = 'Stop'
$taskRoot = [System.IO.Path]::GetFullPath($AppSdkRoot).TrimEnd('\') + '\'
$taskModules = (Get-Process -Id $ProcessId).Modules
$taskNames = @('Microsoft.UI.Windowing.dll', 'Microsoft.WindowsAppRuntime.dll', 'Microsoft.UI.Dispatching.dll', 'msvcp140.dll', 'vcruntime140.dll')
$taskObserved = @()
foreach ($taskName in $taskNames) {
  $taskModule = $taskModules | Where-Object { $_.ModuleName -eq $taskName }
  # Dispatching belongs to CoreMessagingXP in this SDK; only inspect its own DLL if present.
  if ($taskName -eq 'Microsoft.UI.Dispatching.dll' -and $null -eq $taskModule) { continue }
  if ($null -eq $taskModule) { throw "Required loaded module is missing: $taskName" }
  if (-not $taskModule.FileName.StartsWith($taskRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Runtime was loaded outside the app-local supply: $taskName"
  }
  $taskObserved += @{ name = $taskName; appLocal = $true; version = $taskModule.FileVersionInfo.ProductVersion }
}
@{ modules = $taskObserved; appLocal = $true } | ConvertTo-Json -Depth 5 -Compress
