# SPDX-License-Identifier: BSD-3-Clause
<#
.SYNOPSIS
Prepare, build and launch the Windows x64 Release Testbed (Static Hermes, V8 or JSC).
.PARAMETER RefreshSdk
Build the current SDK, supply Windows packages and reinstall the runner first.
.PARAMETER DisableAccessibility
Build the Testbed with accessibility processing disabled.
.PARAMETER NativeInputs
Renderer supplier inputs.json. Omit to reuse the prepared native inputs.
.PARAMETER EngineInputs
Verified selected engine supplier directory. Omit to reuse or prepare it.
.PARAMETER Engine
hermes (Static Hermes AOT, the existing default), v8 or jsc.
.PARAMETER JscMode
JSC execution mode: jit (default) or interpreter. Requires -Engine jsc.
#>
[CmdletBinding()]
param(
    [switch]$RefreshSdk,
    [switch]$DisableAccessibility,
    [ValidateNotNullOrEmpty()][string]$NativeInputs,
    [ValidateNotNullOrEmpty()][string]$EngineInputs,
    [ValidateSet('hermes', 'v8', 'jsc')][string]$Engine = 'hermes',
    [ValidateSet('jit', 'interpreter')][string]$JscMode = 'jit'
)

$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
if ($PSBoundParameters.ContainsKey('JscMode') -and $Engine -ne 'jsc') {
    throw '-JscMode requires -Engine jsc.'
}
$null = Get-Command npm.cmd -ErrorAction Stop
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$runner = Join-Path $PSScriptRoot 'windows/runner'

# Resolve caller-relative paths before changing the working directory.
if ($NativeInputs) { $NativeInputs = (Resolve-Path -LiteralPath $NativeInputs).Path }
if ($EngineInputs) { $EngineInputs = (Resolve-Path -LiteralPath $EngineInputs).Path }

function Invoke-NpmStep {
    param([string]$Label, [string[]]$Arguments)
    Write-Host "`n==> $Label" -ForegroundColor Cyan
    & npm.cmd @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed (npm exit code $LASTEXITCODE)."
    }
}

Push-Location -LiteralPath $repositoryRoot
$previousAccessibility = [Environment]::GetEnvironmentVariable('NELYX_ACCESSIBILITY_ENABLED', 'Process')
$hasPreviousAccessibility = -not [string]::IsNullOrEmpty($previousAccessibility)
try {
    if ($DisableAccessibility) { $env:NELYX_ACCESSIBILITY_ENABLED = 'false' }
    elseif (-not $hasPreviousAccessibility) {
        # An empty value is not an override. Clear residue from older launches.
        Remove-Item -LiteralPath Env:NELYX_ACCESSIBILITY_ENABLED -ErrorAction SilentlyContinue
    }
    if ($RefreshSdk) {
        Invoke-NpmStep -Label 'Build SDK' -Arguments @('run', 'build:sdk')
        Invoke-NpmStep -Label 'Supply Windows packages' -Arguments @('run', 'prepare:sample', '--', 'windows')
        Invoke-NpmStep -Label 'Install Windows runner' -Arguments @('--prefix', $runner, 'install', '--ignore-scripts', '--workspaces=false')
    }

    if (!(Test-Path -LiteralPath (Join-Path $runner 'node_modules/.bin/nelyx.cmd') -PathType Leaf)) {
        throw 'Windows runner dependencies are missing. Run npm.cmd ci at the repository root, then rerun this script with -RefreshSdk.'
    }

    $engineArguments = @('--engine', $Engine)
    if ($Engine -eq 'hermes') { $engineArguments += @('--hermes-mode', 'static-aot') }
    if ($Engine -eq 'jsc') { $engineArguments += @('--jsc-mode', $JscMode) }
    $prepareArguments = @('--prefix', $runner, 'run', 'prepare:native', '--') + $engineArguments
    if ($NativeInputs) { $prepareArguments += @('--native-inputs', $NativeInputs) }
    if ($EngineInputs) { $prepareArguments += @('--engine-inputs', $EngineInputs) }
    Invoke-NpmStep -Label "Prepare $Engine supplier" -Arguments $prepareArguments

    $buildArguments = @('--prefix', $runner, 'run', 'build', '--') + $engineArguments + @('--configuration', 'Release')
    if ($Engine -eq 'hermes') { $buildArguments += @('--hermes-profile', 'optimized') }
    if ($EngineInputs) { $buildArguments += @('--engine-inputs', $EngineInputs) }
    Invoke-NpmStep -Label "Build $Engine Release" -Arguments $buildArguments
    if ($DisableAccessibility) {
        $runtimeConfig = Get-Content -LiteralPath (Join-Path $runner 'app-config.json') -Raw | ConvertFrom-Json
        if ($runtimeConfig.accessibilityEnabled -isnot [bool] -or $runtimeConfig.accessibilityEnabled) {
            throw 'Accessibility disablement was not supplied by the installed CLI. Rerun with -RefreshSdk.'
        }
    }
    Invoke-NpmStep -Label "Launch $Engine Testbed" -Arguments @('run', 'run:windows', '--workspace', '@nelyx/testbed-2')
}
finally {
    if ($hasPreviousAccessibility) {
        [Environment]::SetEnvironmentVariable('NELYX_ACCESSIBILITY_ENABLED', $previousAccessibility, 'Process')
    }
    else {
        # PowerShell can convert $null to an empty .NET string here. Delete the
        # variable explicitly so the next launch does not receive an invalid ''.
        Remove-Item -LiteralPath Env:NELYX_ACCESSIBILITY_ENABLED -ErrorAction SilentlyContinue
    }
    Pop-Location
}
