$ErrorActionPreference = 'Stop'
$taskRepo = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$taskSource = Join-Path $taskRepo 'Nelyx/.cache/vendor/skia'
$taskRevision = & git -C $taskSource rev-parse HEAD
if ($taskRevision -ne '2466dcf3937437e217e7f284afe0e1aae15891ce') { throw 'Selected Skia source revision required' }
$taskLock = Get-Content (Join-Path $PSScriptRoot 'source-lock.json') -Raw | ConvertFrom-Json
$taskDepsHash = & python -c 'import hashlib,pathlib,sys; print(hashlib.sha256(pathlib.Path(sys.argv[1]).read_bytes()).hexdigest())' (Join-Path $taskSource 'DEPS')
if ($taskDepsHash -ne $taskLock.skia.depsSha256) { throw 'Skia DEPS hash mismatch' }
$taskVswhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
$taskVs = & $taskVswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $taskVs) { throw 'MSVC C++ toolchain unavailable' }
Import-Module (Join-Path $taskVs 'Common7/Tools/Microsoft.VisualStudio.DevShell.dll')
Enter-VsDevShell -VsInstallPath $taskVs -SkipAutomaticLocation -DevCmdArguments '-arch=x64 -host_arch=x64'
$env:VSLANG = '1033'
$taskBuild = Join-Path $taskSource 'out/nelyx-windows-dawn'
New-Item -ItemType Directory -Path $taskBuild -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'windows-dawn.args.gn') -Destination (Join-Path $taskBuild 'args.gn')
$taskVc = (Join-Path $taskVs 'VC').Replace('\','/')
Add-Content -LiteralPath (Join-Path $taskBuild 'args.gn') -Value ('win_vc = "' + $taskVc + '"')
$taskPython = & python -c 'import sys; print(sys.executable)'
$taskNinja = (Get-Command ninja.exe).Source
$taskTools = Join-Path $taskRepo 'Nelyx/.cache/vendor/bin'
New-Item -ItemType Directory -Path $taskTools -Force | Out-Null
Set-Content -LiteralPath (Join-Path $taskTools 'python3.cmd') -Value ('@"' + $taskPython + '" %*') -Encoding Ascii
Set-Content -LiteralPath (Join-Path $taskTools 'ninja.cmd') -Value ('@"' + $taskNinja + '" -j 8 %*') -Encoding Ascii
$env:PATH = $taskTools + ';' + $env:PATH
Push-Location $taskSource
try {
  & (Join-Path $taskSource 'bin/gn.exe') gen out/nelyx-windows-dawn "--script-executable=$taskPython"
  if ($LASTEXITCODE -ne 0) { throw 'Dawn Skia GN generation failed' }
  & $taskPython (Join-Path $PSScriptRoot 'ninja-msvc-prefix.py') $taskBuild
  if ($LASTEXITCODE -ne 0) { throw 'MSVC include dependency prefix detection failed' }
  if ($args -notcontains '--configure-only') {
    & ninja -C out/nelyx-windows-dawn -j 8 skia skparagraph skshaper skunicode_core skunicode_icu
    if ($LASTEXITCODE -ne 0) { throw 'Dawn Skia build failed' }
  }
} finally { Pop-Location }
