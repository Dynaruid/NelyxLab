// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';
const timeout=1_200_000,root=path.resolve(import.meta.dirname,'../../..');
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function run(file,args,options={}){const result=spawnSync(file,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:4*1024*1024,...options});if(result.error)throw result.error;assert.equal(result.status,0,(result.stdout??'')+(result.stderr??''));return result.stdout;}
test('Windows ContentIsland pre-translation uses the actual input HWND and preserves native message ownership',{timeout,skip:process.platform!=='win32'},async()=>{
  const runner=fs.realpathSync(process.env.NELYX_WINDOWS_TEST_RUNNER??path.join(root,'sample/nelyx-testbed-app-2/windows/runner')),rnw=path.join(runner,'node_modules/react-native-windows');
  assert.equal(JSON.parse(fs.readFileSync(path.join(rnw,'package.json'))).version,'0.83.2');assert(fs.statfsSync(root).bavail*fs.statfsSync(root).bsize>=20*1024**3,'Need 20 GiB for native build');
  const vs=run(path.join(process.env['ProgramFiles(x86)'],'Microsoft Visual Studio/Installer/vswhere.exe'),['-latest','-products','*','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath']).trim();assert(vs);
  const binding=path.join(runner,'node_modules/@nelyx/skia-rn'),include=[binding,...['native/windows','generated/core','generated/gpu','generated/vulkan','cpp','cpp/rnskia','cpp/api','cpp/jsi','cpp/utils','generated/sdk/skia'].map(name=>path.join(binding,name))];
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-windows-input-island-')),entry=path.join(runner,'nelyx-input-bridge-'+process.pid+'.tsx');let entryOwned=false;
  try{
    fs.writeFileSync(path.join(directory,'pch.h'),'#pragma once\n#include <windows.h>\n#undef GetCurrentTime\n#include <CppWinRTIncludes.h>\n#include <NativeModules.h>\n');
    fs.writeFileSync(path.join(directory,'pch.cpp'),'#include "pch.h"\n');
    fs.writeFileSync(path.join(directory,'InputIsland.vcxproj'),`<Project DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
<PropertyGroup><ProjectGuid>{D727BB7D-04C5-4633-BD7D-E83E6D862E04}</ProjectGuid><ProjectName>InputIsland</ProjectName><ReactNativeWindowsDir>${xml(rnw)}\\</ReactNativeWindowsDir><RnwNewArch>true</RnwNewArch><UseExperimentalNuget>true</UseExperimentalNuget><WindowsTargetPlatformVersion>10.0.26100.0</WindowsTargetPlatformVersion><AppxPackage>false</AppxPackage><UseBundle>false</UseBundle><WindowsAppSDKSelfContained>true</WindowsAppSDKSelfContained><RunAutolinkCheck>false</RunAutolinkCheck><RunCodegenWindows>false</RunCodegenWindows></PropertyGroup>
<Import Project="$(ReactNativeWindowsDir)PropertySheets/External/Microsoft.ReactNative.WindowsSdk.Default.props"/><Import Project="$(VCTargetsPath)Microsoft.Cpp.Default.props"/>
<ItemGroup Label="ProjectConfigurations"><ProjectConfiguration Include="Release|x64"><Configuration>Release</Configuration><Platform>x64</Platform></ProjectConfiguration></ItemGroup>
<PropertyGroup Label="Configuration"><ConfigurationType>Application</ConfigurationType><PlatformToolset>v145</PlatformToolset><CharacterSet>Unicode</CharacterSet><UseDebugLibraries>false</UseDebugLibraries></PropertyGroup>
<Import Project="$(VCTargetsPath)Microsoft.Cpp.props"/><Import Project="$(ReactNativeWindowsDir)PropertySheets/External/Microsoft.ReactNative.Composition.CppApp.props"/>
<PropertyGroup><OutDir>$(ProjectDir)out\\</OutDir><IntDir>$(ProjectDir)obj\\</IntDir><AutolinkCommandWorkingDir>${xml(runner)}</AutolinkCommandWorkingDir><CodegenCommandWorkingDir>${xml(runner)}</CodegenCommandWorkingDir></PropertyGroup>
<ItemDefinitionGroup><ClCompile><LanguageStandard>stdcpp20</LanguageStandard><PrecompiledHeader>Use</PrecompiledHeader><PrecompiledHeaderFile>pch.h</PrecompiledHeaderFile><PrecompiledHeaderOutputFile>$(IntDir)pch.pch</PrecompiledHeaderOutputFile><ForcedIncludeFiles>pch.h;%(ForcedIncludeFiles)</ForcedIncludeFiles><RuntimeLibrary>MultiThreadedDLL</RuntimeLibrary><Optimization>Disabled</Optimization><DebugInformationFormat>ProgramDatabase</DebugInformationFormat><AdditionalIncludeDirectories>$(ProjectDir);${xml(path.join(root,'Nelyx/sdk/native/windows'))};${xml(include.join(';'))};%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories><PreprocessorDefinitions>SK_GRAPHITE;SK_VULKAN;SK_USE_INTERNAL_VULKAN_HEADERS;VK_NO_PROTOTYPES;VK_USE_PLATFORM_WIN32_KHR;SK_SHAPER_PRIMITIVE_AVAILABLE;SK_SHAPER_HARFBUZZ_AVAILABLE;SK_SHAPER_UNICODE_AVAILABLE;SK_UNICODE_ICU_IMPLEMENTATION;NELYX_SKOTTIE_PROPERTY_IMPLEMENTED=1;NOMINMAX;WIN32_LEAN_AND_MEAN;%(PreprocessorDefinitions)</PreprocessorDefinitions><AdditionalOptions>/bigobj %(AdditionalOptions)</AdditionalOptions></ClCompile><Link><SubSystem>Console</SubSystem><GenerateDebugInformation>true</GenerateDebugInformation><AdditionalDependencies>windowsapp.lib;user32.lib;ole32.lib;oleaut32.lib;uuid.lib;shell32.lib;dbghelp.lib;dwmapi.lib;%(AdditionalDependencies)</AdditionalDependencies></Link></ItemDefinitionGroup>
<ItemGroup><ClCompile Include="${xml(path.join(directory,'pch.cpp'))}"><PrecompiledHeader>Create</PrecompiledHeader></ClCompile><ClCompile Include="${xml(path.join(import.meta.dirname,'windows-input-island.cpp'))}"/><ClCompile Include="${xml(path.join(import.meta.dirname,'windows-input-session.cpp'))}"/><ClCompile Include="${xml(path.join(import.meta.dirname,'windows-input-protocol.cpp'))}"/><ClCompile Include="${xml(path.join(import.meta.dirname,'windows-input-service.cpp'))}"/><ClCompile Include="${xml(path.join(import.meta.dirname,'windows-input-bridge.cpp'))}"/><ClCompile Include="${xml(path.join(import.meta.dirname,'windows-composition-coordinates.cpp'))}"/></ItemGroup>
<Import Project="$(VCTargetsPath)Microsoft.Cpp.targets"/><Import Project="$(ReactNativeWindowsDir)PropertySheets/External/Microsoft.ReactNative.Composition.CppApp.targets"/>
</Project>`);
    fs.writeFileSync(path.join(directory,'InputIsland.sln'),`Microsoft Visual Studio Solution File, Format Version 12.00
Project("{BC8A1FFA-BEE3-4634-8014-F334798102B3}") = "InputIsland", "InputIsland.vcxproj", "{D727BB7D-04C5-4633-BD7D-E83E6D862E04}"
EndProject
Global
 GlobalSection(SolutionConfigurationPlatforms) = preSolution
  Release|x64 = Release|x64
 EndGlobalSection
 GlobalSection(ProjectConfigurationPlatforms) = postSolution
  {D727BB7D-04C5-4633-BD7D-E83E6D862E04}.Release|x64.ActiveCfg = Release|x64
  {D727BB7D-04C5-4633-BD7D-E83E6D862E04}.Release|x64.Build.0 = Release|x64
 EndGlobalSection
EndGlobal
`);
    fs.writeFileSync(entry,fs.readFileSync(path.join(import.meta.dirname,'windows-input-bridge.tsx')),{flag:'wx'});entryOwned=true;
    const load=createRequire(path.join(runner,'package.json')),{runBuild,loadConfig}=load('metro'),bundle=path.join(directory,'out/Bundle');fs.mkdirSync(bundle,{recursive:true});
    const config=await loadConfig({cwd:runner,config:path.join(runner,'metro.config.cjs'),maxWorkers:2});await runBuild(config,{entry:path.basename(entry),platform:'windows',dev:false,minify:false,maxWorkers:2,out:path.join(bundle,'input.bundle'),sourceMap:false});
    if(!fs.existsSync(path.join(bundle,'input.bundle')))fs.renameSync(path.join(bundle,'input.bundle.js'),path.join(bundle,'input.bundle'));
    run(path.join(vs,'MSBuild/Current/Bin/MSBuild.exe'),[path.join(directory,'InputIsland.sln'),'/restore','/m:2','/nodeReuse:false','/verbosity:minimal','/p:Configuration=Release','/p:Platform=x64',`/p:AutolinkCommandWorkingDir=${runner}`,`/p:CodegenCommandWorkingDir=${runner}`],{cwd:runner});
    const output=run(path.join(directory,'out/InputIsland.exe'),[],{cwd:path.join(directory,'out')});assert.match(output,/PASS-scoped/);assert.match(output,/PASS-session/);assert.match(output,/PASS-protocol/);assert.match(output,/PASS-service/);process.stdout.write(output);
    const bridge=run(path.join(directory,'out/InputIsland.exe'),[bundle],{cwd:path.join(directory,'out')});assert.match(bridge,/PASS-input-bridge/);process.stdout.write(bridge);
  }finally{if(entryOwned){assert.equal(path.dirname(entry),runner);assert(!fs.lstatSync(entry).isSymbolicLink());fs.unlinkSync(entry);}assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-windows-input-island-'));assert(!fs.lstatSync(directory).isSymbolicLink());fs.rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
});
