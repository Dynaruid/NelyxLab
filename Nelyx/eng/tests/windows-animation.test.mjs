// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {spawnSync} from 'node:child_process';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import {verifyWindowsInputs} from '../../sdk/tooling/cli/src/native-inputs.mjs';
import {windowsHermesProfileFlags} from './windows-hermes-profile.mjs';
import {verifyWindowsV8} from '../../sdk/tooling/cli/src/windows-v8.mjs';
import {summarizeNativeV8Profile} from './windows-v8-profile.mjs';
import {verifyWindowsStaticHermes,windowsStaticHermesPin,windowsCompilerEnvironment} from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import {nativeCohort} from '../../sdk/dist/runtime/cohorts.js';
import {researchResult,researchFailures,fullRuntimeResult} from './windows-research-results.mjs';
import {buildStaticAotMetroBundle,compileWindowsStaticAot,staticAotBootstrap} from '../../sdk/tooling/cli/src/windows-static-aot.mjs';
import {bindNativeCoverage} from '../../sdk/tooling/static-aot/src/execution-plan.mjs';
import {nativePcSources} from './windows-pc-results.mjs';
const timeout=1_200_000,root=path.resolve(import.meta.dirname,'../../..');
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
function run(file,args,options={}){const {nativeDiagnostics=false,expectedStatus=0,...execution}=options;const result=spawnSync(file,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:4*1024*1024,...execution});if(nativeDiagnostics)process.stdout.write((result.stdout??'')+(result.stderr??''));if(result.error)throw result.error;assert.equal(result.status,expectedStatus,((result.stdout??'')+(result.stderr??'')).split('\n').map(line=>line.slice(0,500)).slice(-45).join('\n'));return result.stdout;}
test('Windows sample actions preserve native completion or the expected first failure; ablations are diagnostic only'+(process.env.NELYX_ANIMATION_PREFLIGHT_ONLY==='1'?' [source preflight only]':process.env.NELYX_ANIMATION_BUILD_ONLY==='1'?' [build only]':''),{timeout,skip:process.platform!=='win32'},async(t)=>{
  const runner=fs.realpathSync(process.env.NELYX_WINDOWS_TEST_RUNNER??path.join(root,'sample/nelyx-testbed-app-2/windows/runner')),rnw=path.join(runner,'node_modules/react-native-windows');
  assert(fs.statfsSync(root).bavail*fs.statfsSync(root).bsize>=20*1024**3,'Need 20 GiB for native build');
  const app=path.resolve(runner,'../..'),engine=process.env.NELYX_ANIMATION_ENGINE??'hermes';assert(['hermes','v8'].includes(engine));
  const hermesMode=process.env.NELYX_ANIMATION_HERMES_MODE??'bytecode';assert(['bytecode','static-aot'].includes(hermesMode));
  const aot=hermesMode!=='bytecode',typed=hermesMode==='static-aot';if(aot)assert.equal(engine,'hermes');
  const staticToolchain=engine==='hermes'&&process.env.NELYX_STATIC_HERMES_INPUTS?verifyWindowsStaticHermes(process.env.NELYX_STATIC_HERMES_INPUTS):undefined;
  if(aot)assert(staticToolchain,'Set NELYX_STATIC_HERMES_INPUTS for native AOT');
  const v8Profile=process.env.NELYX_ANIMATION_V8_PROFILE==='1';
  const sourceCompiler=process.env.NELYX_ANIMATION_SOURCE_COMPILER==='1';if(sourceCompiler)assert.equal(engine,'v8','Source compiler comparison requires V8');
  const inlineSetting=process.env.NELYX_ANIMATION_INLINE_REQUIRES;
  assert(inlineSetting===undefined||inlineSetting==='0'||inlineSetting==='1');
  const inlineRequires=inlineSetting===undefined?null:inlineSetting==='1';if(inlineRequires!==null)assert(sourceCompiler,'Require policy is a source-compiler comparison');
  if(v8Profile){assert.equal(engine,'v8');assert.equal(process.env.NELYX_ANIMATION_MODE,'research-engine');assert.notEqual(process.env.NELYX_ANIMATION_DIAGNOSTIC,'1');assert.notEqual(process.env.NELYX_ANIMATION_TRACE,'1');assert.notEqual(process.env.NELYX_ANIMATION_VIEWPORT,'both');assert.notEqual(process.env.NELYX_ANIMATION_ITERATE,'1');}
  const startupBaseline=process.env.NELYX_ANIMATION_STARTUP_BASELINE;
  if(startupBaseline){assert.equal(startupBaseline,'8d05c221','Only the recorded pre-change host is a startup baseline');assert.equal(process.env.NELYX_ANIMATION_MODE,'startup-probe');assert.equal(engine,'v8');assert.notEqual(process.env.NELYX_ANIMATION_SOURCE,'1');}
  const inputs=verifyWindowsInputs({runner,input:process.env.NELYX_WINDOWS_NATIVE_INPUTS??JSON.parse(fs.readFileSync(path.join(app,'.nelyx/windows/native-inputs.json'),'utf8')).input});
  const v8=engine==='v8'?verifyWindowsV8(process.env.NELYX_ANIMATION_V8_INPUTS??JSON.parse(fs.readFileSync(path.join(app,'.nelyx/windows/v8-inputs.json'),'utf8')).directory):undefined;
  const vs=run(path.join(process.env['ProgramFiles(x86)'],'Microsoft Visual Studio/Installer/vswhere.exe'),['-latest','-products','*','-requires','Microsoft.VisualStudio.Component.VC.Tools.x86.x64','-property','installationPath']).trim();assert(vs);
  const binding=process.env.NELYX_ANIMATION_SOURCE==='1'?path.join(root,'Nelyx/skia/packages/rn'):path.join(runner,'node_modules/@nelyx/skia-rn'),sdk=process.env.NELYX_ANIMATION_SOURCE==='1'?path.join(root,'Nelyx/sdk/native/windows'):path.join(runner,'node_modules/@nelyx/sdk/native/windows');
  const include=[binding,path.join(inputs.root,inputs.manifest.headers),...['native/windows','generated/core','generated/gpu','generated/vulkan','generated/host','generated/jsi','generated/native-vulkan','generated/jsi/rnskia','generated/jsi/api','generated/jsi/jsi','generated/jsi/utils','generated/sdk/skia'].map(name=>path.join(binding,name))];
  for(const name of fs.readdirSync(path.join(root,'Nelyx/sdk/native/windows')).filter(name=>name.endsWith('.h')))assert.deepEqual(fs.readFileSync(path.join(sdk,name)),fs.readFileSync(path.join(root,'Nelyx/sdk/native/windows',name)),name);
  for(const name of ['RNSkWindowsHost.h','SkiaView.h','RuntimeServices.h','WindowsKeyboardState.h','CompositionSurface.h','RNSkWindowsWindowSurface.h','WindowsResizeCoordinator.h','CompositionSession.h','CompositionDevice.h','WindowsFrameTrace.h'])assert.deepEqual(fs.readFileSync(path.join(binding,'native/windows',name)),fs.readFileSync(path.join(root,'Nelyx/skia/packages/rn/native/windows',name)),name);
  for(const name of ['CompositorFrameClock.h','WindowsKeyboardInput.h','ObservedKeyboardState.h','WindowsCharacterObservation.h'])assert.deepEqual(fs.readFileSync(path.join(binding,'generated/host/windows',name)),fs.readFileSync(path.join(root,'Nelyx/skia/native/host/windows',name)),name);
  for(const name of ['JsiSkParagraphBuilder.h','JsiSkParagraphBuilderFactory.h','JsiSkTypefaceFontProvider.h'])assert.deepEqual(fs.readFileSync(path.join(binding,'generated/jsi/api',name)),fs.readFileSync(path.join(root,'Nelyx/skia/packages/rn/generated/jsi/api',name)),name);
    const libraries=inputs.manifest.libraries.map(name=>path.join(inputs.root,name));libraries.push('uiautomationcore.lib','comctl32.lib');
  const directory=process.env.NELYX_WINDOWS_ANIMATION_DIRECTORY?fs.realpathSync(process.env.NELYX_WINDOWS_ANIMATION_DIRECTORY):fs.mkdtempSync(path.join(os.tmpdir(),'nelyx-windows-animation-')),tag=process.env.NELYX_WINDOWS_ANIMATION_TAG??String(process.pid);
  assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-windows-animation-'));assert.equal(fs.readdirSync(directory).length,0);assert(/^\d+$/.test(tag));
  const entry=path.join(runner,'nelyx-animation-'+tag+'.tsx'),configFile=path.join(runner,'nelyx-animation-'+tag+'.cjs'),mainFile=path.join(runner,'nelyx-animation-main-'+tag+'.tsx');let entryOwned=false,configOwned=false,mainOwned=false;
  const buildOnly=process.env.NELYX_ANIMATION_BUILD_ONLY==='1';let preparedExported=false;
  if(buildOnly)assert(process.env.NELYX_WINDOWS_ANIMATION_DIRECTORY&&process.env.NELYX_ANIMATION_MODE==='research-engine','Prepared output needs an explicit comparison owner');
  try{
    if(startupBaseline){
      // Isolated host-only comparison: all Core/Skia/bundle inputs remain
      // current. This is not a qualification of the entire historical engine.
      fs.writeFileSync(path.join(directory,'WindowsAppHost.h'),run('git',['show',startupBaseline+':Nelyx/sdk/native/windows/WindowsAppHost.h'],{cwd:root}));
    }
    let nativeCoreSource='';
    const expectAllocationFailure=process.env.NELYX_ANIMATION_EXPECT_ALLOCATION_FAILURE==='1';
    if(expectAllocationFailure){assert.equal(process.env.NELYX_ANIMATION_ALLOCATIONS,'1');assert.equal(process.env.NELYX_ANIMATION_MODE,'editing-resize');}
    if(process.env.NELYX_ANIMATION_ALLOCATIONS==='1'){
      assert.notEqual(process.env.NELYX_ANIMATION_NATIVE_CORE_TRACE,'1','Choose allocation diagnostics or CPU timing');
      for(const name of ['device.cpp','device.h','frame_lease_gate.h','win32_import.inc']){
        const original=path.join(binding,'generated/vulkan',name);assert.deepEqual(fs.readFileSync(original),fs.readFileSync(path.join(root,'Nelyx/skia/native/platforms/vulkan',name)),name);if(name!=='device.cpp')fs.copyFileSync(original,path.join(directory,name));
      }
      let source=fs.readFileSync(path.join(binding,'generated/vulkan/device.cpp'),'utf8');
      const budget='if(total>256*1024*1024||requirements.size>256*1024*1024-total)return reject("budget",VK_ERROR_OUT_OF_DEVICE_MEMORY,requirements,flags,image);';
      assert.equal(source.split(budget).length,2);
      source=source.replace(budget,'if(total>256*1024*1024||requirements.size>256*1024*1024-total){std::fprintf(stderr,"ALLOCATION_REJECT budget total=%llu request=%llu count=%zu flags=%u image=%d\\n",static_cast<unsigned long long>(total),static_cast<unsigned long long>(requirements.size),live.size(),flags,image!=VK_NULL_HANDLE);return reject("budget",VK_ERROR_OUT_OF_DEVICE_MEMORY,requirements,flags,image);}');
      const allocation='if(result!=VK_SUCCESS)return reject("vkAllocateMemory",result,requirements,flags,image);\n    value.persistent=';assert.equal(source.split(allocation).length,2);
      source=source.replace(allocation,'if(result!=VK_SUCCESS){std::fprintf(stderr,"ALLOCATION_REJECT driver result=%d total=%llu request=%llu count=%zu\\n",int(result),static_cast<unsigned long long>(total),static_cast<unsigned long long>(requirements.size),live.size());return reject("vkAllocateMemory",result,requirements,flags,image);}\n    value.persistent=');
      source=source.replace('uint64_t next=1,total=0;','uint64_t next=1,total=0,reported=0;');
      source=source.replace('total+=value.size;*output=id;', 'total+=value.size;if(total>reported+1024*1024){reported=total;std::fprintf(stderr,"ALLOCATION_PEAK bytes=%llu count=%zu request=%llu image=%d\\n",static_cast<unsigned long long>(total),live.size(),static_cast<unsigned long long>(value.size),image!=VK_NULL_HANDLE);}*output=id;');
      if(expectAllocationFailure){const limit='total>256*1024*1024||requirements.size>256*1024*1024-total';assert.equal(source.split(limit).length,2);source=source.replace(limit,'total>64*1024*1024||requirements.size>64*1024*1024-total');}
      nativeCoreSource=path.join(directory,'allocation-device.cpp');fs.writeFileSync(nativeCoreSource,'#include <cstdio>\n'+source);
      // Observe the exact supplied replay path without modifying the package.
      // Only size mismatches are logged, so normal per-frame pacing is intact.
      const viewFile=path.join(binding,'generated/jsi/rnskia/RNSkView.h');
      assert.deepEqual(fs.readFileSync(viewFile),fs.readFileSync(path.join(root,'Nelyx/skia/packages/rn/generated/jsi/rnskia/RNSkView.h')));
      let viewSource=fs.readFileSync(viewFile,'utf8');
      const retirement='if(_lastPresented&&_lastPresented->nelyxRetired()&&!_lastPresented->hasSizeOf(targetInfo))_lastPresented.reset();';
      assert.equal(viewSource.split(retirement).length,2);
      viewSource=viewSource.replace(retirement,'if(_lastPresented&&!_lastPresented->hasSizeOf(targetInfo))std::fprintf(stderr,"BACKING_RECORDING old=%dx%d target=%dx%d managed=%d retired=%d\\n",_lastPresented->getTarget().width,_lastPresented->getTarget().height,targetInfo.width,targetInfo.height,_lastPresented->nelyxManaged(),_lastPresented->nelyxRetired());'+retirement);
      const replay='const auto &size = recording->getTarget();';assert.equal(viewSource.split(replay).length,2);
      viewSource=viewSource.replace(replay,replay+'std::fprintf(stderr,"BACKING_REPLAY old=%dx%d target=%dx%d managed=%d retired=%d\\n",size.width,size.height,surface.getWidth(),surface.getHeight(),recording->nelyxManaged(),recording->nelyxRetired());');
      fs.mkdirSync(path.join(directory,'rnskia'));fs.writeFileSync(path.join(directory,'rnskia/RNSkView.h'),'#include <cstdio>\n'+viewSource);
    }
    if(process.env.NELYX_ANIMATION_NATIVE_CORE_TRACE==='1'){
      assert.equal(process.env.NELYX_ANIMATION_NATIVE_TRACE,'1','Core timing also requires the surface timing overlay');
      // Link one instrumented copy of the exact supplied Device translation unit.
      // The static archive's Device object is not pulled; vendor Skia/Graphite remains unchanged.
      for(const name of ['device.cpp','device.h','frame_lease_gate.h','win32_import.inc'])assert.deepEqual(fs.readFileSync(path.join(binding,'generated/vulkan',name)),fs.readFileSync(path.join(root,'Nelyx/skia/native/platforms/vulkan',name)),name);
      let source=fs.readFileSync(path.join(binding,'generated/vulkan/win32_import.inc'),'utf8');
      const replace=(before,after)=>{assert.equal(source.split(before).length,2,'Native core diagnostic anchor changed: '+before);source=source.replace(before,after);};
      replace('  try {\n    importWin32Frame(*data);','  NelyxAnimationDiagnostics::Scope animationScope{"NativeCore.frame"};auto animationPrevious=NelyxAnimationDiagnostics::Clock::now();\n  try {\n    importWin32Frame(*data);\n    NelyxAnimationDiagnostics::step("NativeCore.import",animationPrevious);');
      replace('target.waitValue!=0,false,"Windows acquire submission",false);','target.waitValue!=0,false,"Windows acquire submission",false);\n    if(std::getenv("NELYX_QUEUE_FAIL_AFTER_ACQUIRE"))throw std::runtime_error("Queue test failure after acquire submission");\n    NelyxAnimationDiagnostics::step("NativeCore.acquireQueued",animationPrevious);');
      replace('auto finalState=skgpu::MutableTextureStates::MakeVulkan(VK_IMAGE_LAYOUT_GENERAL,graphics);','NelyxAnimationDiagnostics::step("NativeCore.wrapAndBaseRecording",animationPrevious);\n    auto finalState=skgpu::MutableTextureStates::MakeVulkan(VK_IMAGE_LAYOUT_GENERAL,graphics);');
      replace('    if(!context->submit())throw std::runtime_error("Windows Graphite submit unconfirmed");','    NelyxAnimationDiagnostics::step("NativeCore.insertRecordings",animationPrevious);\n    if(!context->submit())throw std::runtime_error("Windows Graphite submit unconfirmed");\n    NelyxAnimationDiagnostics::step("NativeCore.submit",animationPrevious);');
      replace('false,true,"Windows EXTERNAL release submission");','false,true,"Windows EXTERNAL release submission");\n    NelyxAnimationDiagnostics::step("NativeCore.releaseSubmitted",animationPrevious);');
      replace('  void awaitProducer() {','  void awaitProducer() {\n    NelyxAnimationDiagnostics::Scope wait{"NativeCore.producerWait"};');
      replace('  void finishProducer() {','  void finishProducer() {\n    NelyxAnimationDiagnostics::Scope finish{"NativeCore.graphiteRetirement"};');
      replace('if(!wrapperReleased->load())context->freeGpuResources();','if(!wrapperReleased->load()){NelyxAnimationDiagnostics::Scope fallback{"NativeCore.cacheFallback"};context->freeGpuResources();}');
      fs.writeFileSync(path.join(directory,'win32_import.inc'),source);
      source=fs.readFileSync(path.join(binding,'generated/vulkan/device.cpp'),'utf8');
      const allocation='const auto result=api.get<PFN_vkAllocateMemory>("vkAllocateMemory")(api.device,&info,nullptr,&value.memory);';assert.equal(source.split(allocation).length,2);source=source.replace(allocation,'const auto allocationStart=NelyxAnimationDiagnostics::Clock::now();'+allocation+'NelyxAnimationDiagnostics::record("NativeCore.vkAllocateMemory",std::chrono::duration<double,std::milli>(NelyxAnimationDiagnostics::Clock::now()-allocationStart).count());');
      const accepted='total+=value.size;*output=id;';assert.equal(source.split(accepted).length,2);source=source.replace(accepted,'total+=value.size;NelyxAnimationDiagnostics::record("NativeMemory.allocationBytes",static_cast<double>(value.size));NelyxAnimationDiagnostics::record("NativeMemory.liveBytes",static_cast<double>(total));*output=id;');
      const anchor='void Device::retire(){';assert.equal(source.split(anchor).length,2);source=source.replace(anchor,anchor+'NelyxAnimationDiagnostics::Scope animationScope{"NativeCore.retire"};');
      nativeCoreSource=path.join(directory,'animation-device.cpp');fs.writeFileSync(nativeCoreSource,'#include <cstdlib>\n#include '+JSON.stringify(path.join(import.meta.dirname,'windows-animation-diagnostics.h').replaceAll('\\','/'))+'\n'+source);
    }
    // Optional, isolated timing overlay. The installed native supplier remains untouched.
    if(process.env.NELYX_ANIMATION_NATIVE_TRACE==='1'){
      for(const name of ['RNSkWindowsHost.h','SkiaView.h','RNSkWindowsWindowSurface.h'])fs.copyFileSync(path.join(binding,'native/windows',name),path.join(directory,name));
      let source=fs.readFileSync(path.join(binding,'native/windows/CompositionSurface.h'),'utf8');
      const replace=(before,after)=>{assert.equal(source.split(before).length,2,'Native diagnostic anchor changed: '+before);source=source.replace(before,after);};
      replace('void render(){','void render(){NelyxAnimationDiagnostics::Scope render{"Native.workerRender"};');
      replace('void retire(){','void retire(){NelyxAnimationDiagnostics::Scope retire{"Native.workerRetire"};');
      replace('    requireOwner();if(busy||(!admitted&&!data->ready()))return {};','    NelyxAnimationDiagnostics::Scope prepare{"Native.prepare"};\n    requireOwner();if(busy||(!admitted&&!data->ready()))return {};');
      replace('  void publish(const std::shared_ptr<Prepared>& packet,bool current){','  void publish(const std::shared_ptr<Prepared>& packet,bool current){\n    NelyxAnimationDiagnostics::Scope publish{"Native.publish"};');
      fs.writeFileSync(path.join(directory,'CompositionSurface.h'),source);
      source=fs.readFileSync(path.join(directory,'SkiaView.h'),'utf8');
      const wheelGuard='    requireUi();if(!data||data->failed||!data->status.bound||!data->status.visible||!data->emitter||!pointerGeometryReady())return;';
      const wheelStart=source.indexOf('  void wheel('),guardStart=source.indexOf(wheelGuard,wheelStart),wheelEnd=source.indexOf('\n  void ',wheelStart+1);
      assert(wheelStart>=0&&guardStart>wheelStart&&wheelEnd>guardStart,'Native wheel diagnostic guard changed');
      source=source.slice(0,guardStart)+'    requireUi();NelyxAnimationDiagnostics::record("Input.wheelCallback",1);if(!data||data->failed||!data->status.bound||!data->status.visible||!data->emitter){NelyxAnimationDiagnostics::record("Input.wheelStateRejected",1);return;}if(!pointerGeometryReady()){NelyxAnimationDiagnostics::record("Input.wheelGeometryRejected",1);return;}'+source.slice(guardStart+wheelGuard.length);
      const wheelDelta='    const auto delta=-double(properties.MouseWheelDelta())/120.0*extent;';
      assert.equal(source.split(wheelDelta).length,2,'Native wheel diagnostic delta changed');
      source=source.replace(wheelDelta,wheelDelta+'\n    NelyxAnimationDiagnostics::record("Input.nativeWheelAbsoluteDelta",std::abs(delta));NelyxAnimationDiagnostics::record("Input.nativeWheelNetDelta",delta);');
      fs.writeFileSync(path.join(directory,'SkiaView.h'),source);
    }
    fs.writeFileSync(path.join(directory,'pch.h'),'#pragma once\n#include <windows.h>\n#undef GetCurrentTime\n#include <CppWinRTIncludes.h>\n#include <NativeModules.h>\n');
    fs.writeFileSync(path.join(directory,'pch.cpp'),'#include "pch.h"\n');
    fs.writeFileSync(path.join(directory,'InputSurface.vcxproj'),`<Project DefaultTargets="Build" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
<PropertyGroup><ProjectGuid>{89581F39-BDB2-442A-BF44-6C4F3D31F187}</ProjectGuid><ProjectName>InputSurface</ProjectName><ReactNativeWindowsDir>${xml(rnw)}\\</ReactNativeWindowsDir><RnwNewArch>true</RnwNewArch><UseExperimentalNuget>true</UseExperimentalNuget><WindowsTargetPlatformVersion>10.0.26100.0</WindowsTargetPlatformVersion><AppxPackage>false</AppxPackage><UseBundle>false</UseBundle><WindowsAppSDKSelfContained>true</WindowsAppSDKSelfContained><RunAutolinkCheck>false</RunAutolinkCheck><RunCodegenWindows>false</RunCodegenWindows></PropertyGroup>
<Import Project="$(ReactNativeWindowsDir)PropertySheets/External/Microsoft.ReactNative.WindowsSdk.Default.props"/><Import Project="$(VCTargetsPath)Microsoft.Cpp.Default.props"/>
<ItemGroup Label="ProjectConfigurations"><ProjectConfiguration Include="Release|x64"><Configuration>Release</Configuration><Platform>x64</Platform></ProjectConfiguration></ItemGroup>
<PropertyGroup Label="Configuration"><ConfigurationType>Application</ConfigurationType><PlatformToolset>v145</PlatformToolset><CharacterSet>Unicode</CharacterSet><UseDebugLibraries>false</UseDebugLibraries></PropertyGroup>
<Import Project="$(VCTargetsPath)Microsoft.Cpp.props"/><Import Project="$(ReactNativeWindowsDir)PropertySheets/External/Microsoft.ReactNative.Composition.CppApp.props"/>
<PropertyGroup><OutDir>$(ProjectDir)out\\</OutDir><IntDir>$(ProjectDir)obj\\</IntDir><AutolinkCommandWorkingDir>${xml(runner)}</AutolinkCommandWorkingDir><CodegenCommandWorkingDir>${xml(runner)}</CodegenCommandWorkingDir></PropertyGroup>
<ItemDefinitionGroup><ClCompile><LanguageStandard>stdcpp20</LanguageStandard><PrecompiledHeader>Use</PrecompiledHeader><PrecompiledHeaderFile>pch.h</PrecompiledHeaderFile><PrecompiledHeaderOutputFile>$(IntDir)pch.pch</PrecompiledHeaderOutputFile><ForcedIncludeFiles>pch.h;%(ForcedIncludeFiles)</ForcedIncludeFiles><RuntimeLibrary>MultiThreadedDLL</RuntimeLibrary><Optimization>MaxSpeed</Optimization><DebugInformationFormat>ProgramDatabase</DebugInformationFormat><AdditionalIncludeDirectories>$(ProjectDir);${xml(sdk)};${xml(include.join(';'))};%(AdditionalIncludeDirectories)</AdditionalIncludeDirectories><PreprocessorDefinitions>NDEBUG;_ITERATOR_DEBUG_LEVEL=0;SK_GRAPHITE;SK_VULKAN;SK_USE_INTERNAL_VULKAN_HEADERS;VK_NO_PROTOTYPES;VK_USE_PLATFORM_WIN32_KHR;SK_SHAPER_PRIMITIVE_AVAILABLE;SK_SHAPER_HARFBUZZ_AVAILABLE;SK_SHAPER_UNICODE_AVAILABLE;SK_UNICODE_ICU_IMPLEMENTATION;NELYX_SKOTTIE_PROPERTY_IMPLEMENTED=1;NOMINMAX;WIN32_LEAN_AND_MEAN;%(PreprocessorDefinitions)</PreprocessorDefinitions><AdditionalOptions>/bigobj %(AdditionalOptions)</AdditionalOptions></ClCompile><Link><SubSystem>Console</SubSystem><GenerateDebugInformation>true</GenerateDebugInformation><AdditionalDependencies>${xml(libraries.join(';'))};windowsapp.lib;user32.lib;gdi32.lib;d3d11.lib;dxgi.lib;dwrite.lib;usp10.lib;shlwapi.lib;ole32.lib;oleaut32.lib;uuid.lib;shell32.lib;dbghelp.lib;dwmapi.lib;%(AdditionalDependencies)</AdditionalDependencies></Link></ItemDefinitionGroup>
<ItemGroup><ClCompile Include="${xml(path.join(directory,'pch.cpp'))}"><PrecompiledHeader>Create</PrecompiledHeader></ClCompile><ClCompile Include="${xml(path.join(import.meta.dirname,'windows-animation.cpp'))}"/>${nativeCoreSource?`<ClCompile Include="${xml(nativeCoreSource)}"/>`:''}</ItemGroup>
<Import Project="$(VCTargetsPath)Microsoft.Cpp.targets"/><Import Project="$(ReactNativeWindowsDir)PropertySheets/External/Microsoft.ReactNative.Composition.CppApp.targets"/>
</Project>`);
    fs.writeFileSync(path.join(directory,'InputSurface.sln'),`Microsoft Visual Studio Solution File, Format Version 12.00
Project("{BC8A1FFA-BEE3-4634-8014-F334798102B3}") = "InputSurface", "InputSurface.vcxproj", "{89581F39-BDB2-442A-BF44-6C4F3D31F187}"
EndProject
Global
 GlobalSection(SolutionConfigurationPlatforms) = preSolution
  Release|x64 = Release|x64
 EndGlobalSection
 GlobalSection(ProjectConfigurationPlatforms) = postSolution
  {89581F39-BDB2-442A-BF44-6C4F3D31F187}.Release|x64.ActiveCfg = Release|x64
  {89581F39-BDB2-442A-BF44-6C4F3D31F187}.Release|x64.Build.0 = Release|x64
 EndGlobalSection
EndGlobal
`);
    const assets=path.join(directory,'out/Assets');fs.mkdirSync(assets,{recursive:true});fs.copyFileSync(path.join(inputs.root,inputs.manifest.icu),path.join(assets,'icudtl.dat'));fs.cpSync(path.join(root,'sample/nelyx-testbed-app-2/assets'),path.join(assets,'assets'),{recursive:true});
    const roots=process.env.NELYX_ANIMATION_SOURCE==='1'?{'@nelyx/core':path.join(root,'Nelyx'),'@nelyx/material':path.join(root,'packages/material'),'@nelyx/cupertino':path.join(root,'packages/cupertino')}:{};
    fs.writeFileSync(configFile,"const roots="+JSON.stringify(roots)+";module.exports=require('@nelyx/metro/runner-config').createRunnerConfig("+JSON.stringify({target:'windows',runnerRoot:runner,appRoot:path.resolve(runner,'../..'),packageRoots:roots,javaScriptEngine:engine})+",{resolver:{resolveRequest(context,name,platform){const owner=Object.keys(roots).find(key=>name===key||name.startsWith(key+'/'));if(owner)return {type:'sourceFile',filePath:require('node:module').createRequire(require('node:path').join(roots[owner],'package.json')).resolve(name)};return context.resolveRequest(context,name,platform);}}});\n",{flag:'wx'});configOwned=true;
    const load=createRequire(path.join(runner,'package.json')),{runBuild,loadConfig}=load('metro'),bundle=path.join(directory,'out/Bundle');fs.mkdirSync(bundle,{recursive:true});const config=await loadConfig({cwd:runner,config:configFile,maxWorkers:2});
    if(process.env.NELYX_ANIMATION_SAME_FRONTEND==='1'){
      assert(engine==='hermes'&&!aot,'Same-frontend bytecode preflight requires Hermes bytecode');
      config.transformer={...config.transformer,babelTransformerPath:path.join(runner,'node_modules/@nelyx/metro/src/native-hermes-transformer.cjs')};
    }
    if(sourceCompiler)config.transformer={...config.transformer,babelTransformerPath:path.join(root,'Nelyx/sdk/tooling/metro/src/native-v8-transformer.cjs')};
    if(inlineRequires!==null){const previous=config.transformer.getTransformOptions;config.transformer.getTransformOptions=async function(...args){const value=await previous.apply(this,args);return {...value,transform:{...value.transform,inlineRequires}};};}
    let nativeBuilt=false;
    const main=fs.readFileSync(path.join(runner,'main.tsx'),'utf8'),register=/registerApplication\(config\.name,App,\{[^\n]+\}\);\s*$/;assert(register.test(main),'Sample registration changed');
    const registration=`registerApplication(config.name,App,{profile:'${v8?'rn-v8-graphite-vulkan':'rn-graphite-vulkan'}',cohort:'${v8?'rn-0.83.10-v8':'rn-0.83.10'}',assets:{manifest,sources}});\n`;
    const startupRegistration=process.env.NELYX_ANIMATION_MODE==='startup-probe';
    fs.writeFileSync(mainFile,(startupRegistration?"import {NativeModules as NelyxStartupModules} from 'react-native';\n":'')+main.replace(register,startupRegistration?"NelyxStartupModules.NelyxAnimation.startupStage('js-register-start');\n"+registration+"NelyxStartupModules.NelyxAnimation.startupStage('js-registered');\n":registration),{flag:'wx'});mainOwned=true;
    const both=process.env.NELYX_ANIMATION_VIEWPORT==='both',iterative=process.env.NELYX_ANIMATION_ITERATE==='1';assert(!both||!iterative,'Choose batch viewports or interactive iteration');
    const repetitions=Number(process.env.NELYX_ANIMATION_REPETITIONS??1);assert(Number.isSafeInteger(repetitions)&&repetitions>=1&&repetitions<=3);
    const reuseBundle=repetitions>1;assert(!reuseBundle||both&&!iterative&&process.env.NELYX_ANIMATION_MODE==='research-engine','Repeated comparison requires bounded research viewports');
    const requestedViewports=Array.from({length:repetitions},()=>both?['default','maximized',...(process.env.NELYX_ANIMATION_RESIZE==='1'?['fixed']:[])]:[process.env.NELYX_ANIMATION_VIEWPORT??'fixed']).flat();
    let bundleBuilt=false,partition;
    let completed=0,lastError;for(let pass=0;pass<(iterative?10:requestedViewports.length);pass++){try{lastError=undefined;
      const viewport=iterative?(process.env.NELYX_ANIMATION_VIEWPORT??'fixed'):requestedViewports[pass],resize=process.env.NELYX_ANIMATION_RESIZE==='1'&&(!both||viewport==='fixed');assert(['fixed','default','maximized'].includes(viewport));
      const wheelInputMode=process.env.NELYX_ANIMATION_WHEEL_INPUT==='queued'?'queued':process.env.NELYX_ANIMATION_WHEEL_INPUT==='1'?'os':'none';
      const wheelInterval=Number(process.env.NELYX_ANIMATION_WHEEL_INTERVAL_MS??8),wheelDelta=Number(process.env.NELYX_ANIMATION_WHEEL_DELTA??6);assert(Number.isInteger(wheelInterval)&&wheelInterval>=1&&wheelInterval<=16);assert(Number.isInteger(wheelDelta)&&wheelDelta>=1&&wheelDelta<=120);
      const semanticsInterval=process.env.NELYX_ANIMATION_SEMANTICS_INTERVAL===undefined?null:Number(process.env.NELYX_ANIMATION_SEMANTICS_INTERVAL);assert(semanticsInterval===null||Number.isFinite(semanticsInterval)&&semanticsInterval>=0);const diagnostic=process.env.NELYX_ANIMATION_DIAGNOSTIC==='1',mode=process.env.NELYX_ANIMATION_MODE??'standard',optimization=process.env.NELYX_ANIMATION_HERMES_OPT??'optimized';assert(['standard','cpu-timing','renderer-clear','host-semantics-static','editing-resize','gallery-regression','full-runtime-regression','research-engine','live-resize','startup-probe','interactive'].includes(mode));const compilerFlags=windowsHermesProfileFlags(optimization);assert(mode==='standard'||mode==='cpu-timing'||mode==='editing-resize'||mode==='gallery-regression'||mode==='full-runtime-regression'||mode==='research-engine'||mode==='live-resize'||mode==='startup-probe'||mode==='interactive'||diagnostic,'Ablation requires diagnostic mode');
      if(mode==='cpu-timing')assert(!diagnostic&&process.env.NELYX_ANIMATION_TRACE!=='1','Minimal CPU timing requires per-method diagnostics and trace disabled');
      console.log('ANIMATION_CONFIG '+JSON.stringify({engine,hermesMode,hermesRuntime:staticToolchain?'source-hook':'stock',viewport,v8Profile,sourceCompiler,inlineRequires,nativeClasses:engine==='v8',wheelInput:wheelInputMode!=='none',wheelInputMode,wheelInterval,wheelDelta,trace:process.env.NELYX_ANIMATION_TRACE==='1',diagnostic,nativeTrace:process.env.NELYX_ANIMATION_NATIVE_TRACE==='1',nativeCoreTrace:process.env.NELYX_ANIMATION_NATIVE_CORE_TRACE==='1',allocationTrace:process.env.NELYX_ANIMATION_ALLOCATIONS==='1',mode,minified:!v8&&!staticToolchain,optimization:v8?'source-js':optimization,compilerFlags:v8?[]:compilerFlags,sourceAlias:process.env.NELYX_ANIMATION_SOURCE==='1',semanticsIntervalOverride:semanticsInterval,resize:resize||mode==='editing-resize'||mode==='full-runtime-regression'||mode==='research-engine'||mode==='live-resize'}));
      if(!bundleBuilt&&process.env.NELYX_ANIMATION_REUSE_CURRENT_INPUT){
        assert(buildOnly&&reuseBundle&&process.env.NELYX_ANIMATION_NATIVE_TRACE==='1'&&process.env.NELYX_ANIMATION_NATIVE_CORE_TRACE==='1','Current input reuse is a diagnostic host only');
        const admitted=JSON.parse(process.env.NELYX_ANIMATION_REUSE_CURRENT_INPUT),supplied=fs.realpathSync(admitted.directory),hash=file=>createRequire(import.meta.url)('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        assert.equal(path.dirname(supplied),fs.realpathSync(os.tmpdir()));assert(path.basename(supplied).startsWith('nelyx-windows-animation-'));assert.notEqual(supplied,directory);assert(!fs.lstatSync(supplied).isSymbolicLink());
        const names=['Bundle/input-surface.js','Bundle/input-surface.bundle',...(aot?['NelyxApp.aot.dll','Bundle/index.windows.typed.ts','Bundle/index.windows.rnw-pal.js','Bundle/native-pc-map.json']:[])];
        assert.deepEqual(Object.keys(admitted.files).sort(),[...names].sort());assert.equal(admitted.engine,engine);assert.equal(admitted.hermesMode,hermesMode);
        for(const name of names){const expected=admitted.files[name],file=path.join(supplied,'out',name),target=path.join(directory,'out',name);assert(/^[a-f0-9]{64}$/.test(expected));assert(!fs.lstatSync(file).isSymbolicLink());assert.equal(hash(file),expected);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target,fs.constants.COPYFILE_EXCL);}
        if(aot){assert(Array.isArray(admitted.bindings)&&admitted.bindings.length>0);partition={bindings:admitted.bindings};}
        console.log('ANIMATION_REUSED '+JSON.stringify({sourceSha256:hash(path.join(bundle,'input-surface.js')),entrySha256:hash(path.join(bundle,'input-surface.bundle')),scope:'same execution-owned compiler output; diagnostic native host only'}));bundleBuilt=true;
      }
      if(!bundleBuilt&&process.env.NELYX_ANIMATION_REUSE_AOT_INPUT){
        assert(aot&&buildOnly&&reuseBundle&&process.env.NELYX_ANIMATION_NATIVE_TRACE==='1'&&process.env.NELYX_ANIMATION_NATIVE_CORE_TRACE==='1'&&process.env.NELYX_ANIMATION_PREFLIGHT_ONLY!=='1','Current native input reuse is a prepared diagnostic host only');
        const supplied=fs.realpathSync(process.env.NELYX_ANIMATION_REUSE_AOT_INPUT),hash=file=>createRequire(import.meta.url)('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex');
        assert.equal(path.dirname(supplied),fs.realpathSync(os.tmpdir()));assert(path.basename(supplied).startsWith('nelyx-windows-aot-input-'));assert(!fs.lstatSync(supplied).isSymbolicLink());
        const admitted=[['NelyxApp.aot.dll',process.env.NELYX_ANIMATION_REUSE_AOT_LIBRARY_SHA],['Bundle/input-surface.js',process.env.NELYX_ANIMATION_REUSE_AOT_SOURCE_SHA],['Bundle/index.windows.typed.ts',process.env.NELYX_ANIMATION_REUSE_AOT_TYPED_SHA],['Bundle/index.windows.rnw-pal.js','33b3511fb792121ec490c30de532e436312262808697317764e513ae6ecff3d3'],['Bundle/input-surface.bundle','edfee46e6065c4331f319982fbfd34933a93ccb5d00f9c3937291532c4d3e03f']];
        for(const [name,sha]of admitted){assert(/^[a-f0-9]{64}$/.test(sha??''),'Explicit current input identity required');const file=path.join(supplied,name);assert(!fs.lstatSync(file).isSymbolicLink());assert.equal(hash(file),sha);const target=path.join(directory,'out',name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target,fs.constants.COPYFILE_EXCL);}
        const globals=[...fs.readFileSync(path.join(bundle,'index.windows.typed.ts'),'utf8').matchAll(/globalThis\["(__nelyxTyped_[a-f0-9]{16})"\]=boundary\d+;/g)].map(match=>match[1]);assert(globals.length>0);assert.equal(new Set(globals).size,globals.length);partition={bindings:globals.map(globalName=>({id:globalName,globalName}))};
        console.log('ANIMATION_REUSED '+JSON.stringify({stage:'reuse-current-native-image',sourceSha256:hash(path.join(bundle,'input-surface.js')),librarySha256:hash(path.join(directory,'out/NelyxApp.aot.dll')),typedSourceSha256:hash(path.join(bundle,'index.windows.typed.ts')),bindings:globals.length,scope:'same current matrix compiler output; native host instrumentation only'}));bundleBuilt=true;
      }
      if(!reuseBundle||!bundleBuilt){
      const bundleStarted=performance.now();let metroFinished;
      fs.writeFileSync(entry,fs.readFileSync(path.join(import.meta.dirname,'windows-animation.tsx'),'utf8').replace("import './main.tsx'","import './"+path.basename(mainFile)+"'").replace('__TRACE__',process.env.NELYX_ANIMATION_TRACE==='1'?'true':'false').replace('__DIAGNOSTIC__',diagnostic?'true':'false').replace('__V8_PROFILE__',v8Profile?'true':'false').replace('__MODE__',reuseBundle?'NativeModules.NelyxAnimation.mode()':JSON.stringify(mode)).replace('__RESIZE__',resize||mode==='editing-resize'||mode==='full-runtime-regression'||mode==='research-engine'?'true':'false').replace('__RESIZE_CASE__',JSON.stringify(process.env.NELYX_ANIMATION_RESIZE_CASE??'initial')).replace('__SEMANTICS_INTERVAL__',JSON.stringify(semanticsInterval)).replace('__WHEEL_INPUT__',wheelInputMode!=='none'?'true':'false').replace('__WHEEL_INPUT_MODE__',JSON.stringify(wheelInputMode)).replace('__VIEWPORT__',reuseBundle?'NativeModules.NelyxAnimation.viewport()':JSON.stringify(viewport)).replace('__WHEEL_INTERVAL__',String(wheelInterval)).replace('__WHEEL_DELTA__',String(wheelDelta)).replace('/*__WHEEL_WARMUP__*/false',process.env.NELYX_ANIMATION_WHEEL_WARMUP==='1'?'true':'false').replace('__WHEEL_HOVER__',process.env.NELYX_ANIMATION_OWNED_HOVER==='1'?'true':'false'));entryOwned=true;
      fs.appendFileSync(entry,'\n'+fs.readFileSync(path.join(import.meta.dirname,'windows-frame-terminals.ts'),'utf8'));
      fs.appendFileSync(entry,'\n'+fs.readFileSync(path.join(import.meta.dirname,'windows-context-diagnostics.ts'),'utf8').replace('export function timedNativeContext','function timedNativeContext'));
      if(aot)fs.appendFileSync(entry,"\nPromise.resolve().then(()=>{if(!(globalThis as any).__nelyxStaticHermes?.initialized)throw Error('Native SHUnit initialization missing');NativeModules.NelyxAnimation.report('AOT_NATIVE initialized=true');});\n");
      if(process.env.NELYX_ANIMATION_PREFLIGHT_ONLY==='1'){
        assert(typed,'Source preflight selects the typed product graph');
        const {productPartition}=await import(pathToFileURL(load.resolve('@nelyx/static-aot/product-partition'))),checked=productPartition({runner,entry});
        console.log('ANIMATION_PREPARED '+JSON.stringify({directory,bundle,engine,hermesMode,preflight:true,modules:checked.graph.modules.length,sourceSha256:checked.sourceSha256,bindings:checked.bindings.map(({id,globalName})=>({id,globalName}))}));completed++;break;
      }
      if(typed)partition=await buildStaticAotMetroBundle({runner,entry,source:path.join(bundle,'input-surface.js'),map:path.join(bundle,'input-surface.js.map'),config,signal:t.signal});
      else {const sourceMap=v8Profile||diagnostic;await runBuild(config,{entry:path.basename(entry),platform:'windows',dev:false,minify:!v8&&!staticToolchain,maxWorkers:2,out:path.join(bundle,'input-surface.js'),sourceMap,...(sourceMap?{sourceMapOut:path.join(bundle,'input-surface.js.map'),sourceMapUrl:'input-surface.js.map'}:{})});}
      if(process.env.NELYX_ANIMATION_FRONTEND_ONLY==='1'){
        assert(typed,'Frontend evidence preflight requires Static Hermes');const sources=nativePcSources(partition);
        console.log('ANIMATION_FRONTEND_PREFLIGHT '+JSON.stringify({typed:sources.typed.length,sourceOwners:sources.owners.length,compilerInvoked:false}));completed++;break;
      }
      metroFinished=performance.now();
      if(v8Profile){assert(fs.existsSync(path.join(bundle,'input-surface.js.map')),'Explicit native profile map is missing');assert(!fs.readFileSync(path.join(bundle,'input-surface.js'),'utf8').includes('sourceMappingURL=data:'),'An inline map would change the profiled VM heap');}
      if(v8)fs.copyFileSync(path.join(bundle,'input-surface.js'),path.join(bundle,'input-surface.bundle'));
      else{
        const hermesDirectory=path.join(process.env.USERPROFILE,'.nuget/packages/microsoft.javascript.hermes/0.0.0-2604.21001-94aa5e1d'),compiler=path.join(hermesDirectory,'tools/native/release/x64/hermes.exe');
        let source=path.join(bundle,'input-surface.js');
        if(aot){
          assert.equal(optimization,'optimized','AOT uses the qualified compiler policy');
          const compilation={toolchain:staticToolchain.directory,source,output:path.join(directory,'out',windowsStaticHermesPin.library),hermesDirectory,cohort:nativeCohort('windows'),signal:t.signal};
          const pcSources=nativePcSources(partition);
          const metadata=await compileWindowsStaticAot({...compilation,typedSource:path.join(bundle,'index.windows.typed.ts'),partitionSha256:partition.irSha256,diagnosticMap:partition});
          const coverage=bindNativeCoverage(partition.executionPlan,metadata.build,metadata);console.log('ANIMATION_AOT_COVERAGE '+JSON.stringify(coverage.summary));assert.equal(coverage.summary.wholeAppNativeAot,true,'Research requires full-runtime native coverage');
          const {build,...identity}=metadata;
          fs.writeFileSync(path.join(bundle,'native-pc-map.json'),JSON.stringify({...build.nativePcMap,...pcSources}));
          console.log('ANIMATION_STATIC_HERMES '+JSON.stringify({...identity,runtimeSha256:staticToolchain.manifest.runtimeSha256,build:{buildMs:build.buildMs,nativePcFunctions:build.nativePcMap.functions.length,units:build.units.map(({nativeFunctions,...unit})=>({...unit,nativeFunctions:nativeFunctions?.functions.length}))}}));
          fs.writeFileSync(path.join(bundle,'input-surface.bundle'),staticAotBootstrap);
        }
        if(!aot){run(compiler,[...compilerFlags,'-emit-binary','-out',path.join(bundle,'input-surface.bundle'),source]);assert.equal(fs.readFileSync(path.join(bundle,'input-surface.bundle')).readUInt32LE(8),99);}
      }
      console.log('ANIMATION_BUILD '+JSON.stringify({stage:'bundle',metroMs:metroFinished-bundleStarted,compilerMs:performance.now()-metroFinished,totalMs:performance.now()-bundleStarted,sourceBytes:fs.statSync(path.join(bundle,'input-surface.js')).size,entryBytes:fs.statSync(path.join(bundle,'input-surface.bundle')).size,libraryBytes:aot?fs.statSync(path.join(directory,'out',windowsStaticHermesPin.library)).size:0,typedBytes:typed?fs.statSync(path.join(bundle,'index.windows.typed.ts')).size:0}));
      bundleBuilt=true;
      }
      // Reject a broken JS compiler before building the native fixture. The
      // matching DLL supplier is copied after MSBuild, once for this execution.
      if(!nativeBuilt){
        const nativeStarted=performance.now();
        run(path.join(vs,'MSBuild/Current/Bin/MSBuild.exe'),[path.join(directory,'InputSurface.sln'),'/restore','/m:2','/nodeReuse:false','/verbosity:minimal','/p:Configuration=Release','/p:Platform=x64',`/p:AutolinkCommandWorkingDir=${runner}`,`/p:CodegenCommandWorkingDir=${runner}`],{cwd:runner});
        if(v8)for(const record of v8.manifest.files){const destination=path.join(directory,'out',record.path);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(v8.directory,record.path),destination);}
        if(staticToolchain)fs.copyFileSync(path.join(staticToolchain.directory,'build/API/hermes_shared/hermes.dll'),path.join(directory,'out/hermes.dll'));
        console.log('ANIMATION_BUILD '+JSON.stringify({stage:'host',totalMs:performance.now()-nativeStarted}));
        nativeBuilt=true;
      }
      if(process.env.NELYX_ANIMATION_NATIVE_PC==='1'){
        assert(diagnostic&&process.env.NELYX_ANIMATION_NATIVE_TRACE==='1','PC snapshots are diagnostic only');
        const executable=path.join(directory,'out/ScrollProfile.exe');
        const profilerConfig=path.join(directory,'profile-config.h');fs.writeFileSync(profilerConfig,'#define NELYX_PC_MAPPER_PATH L'+JSON.stringify(path.join(import.meta.dirname,'windows-pc-results.mjs').replaceAll('\\','/'))+'\n#define NELYX_NODE_PATH L'+JSON.stringify(process.execPath.replaceAll('\\','/'))+'\n');
        if(!fs.existsSync(executable))run('cl.exe',['/nologo','/std:c++20','/EHsc','/MD','/O2','/Zi','/DNOMINMAX','/FI'+profilerConfig,'/Fe:'+executable,'/Fo:'+path.join(directory,'profile.obj'),'/Fd:'+path.join(directory,'profile-compile.pdb'),path.join(import.meta.dirname,'windows-scroll-profile.cpp'),'/link','dbghelp.lib','/DEBUG','/PDB:'+path.join(directory,'out/ScrollProfile.pdb')],{cwd:directory,env:windowsCompilerEnvironment()});
      }
      if(buildOnly){console.log('ANIMATION_PREPARED '+JSON.stringify({directory,bundle,engine,hermesMode,...(fs.existsSync(path.join(directory,'out/ScrollProfile.exe'))?{pcProfiler:path.join(directory,'out/ScrollProfile.exe')}:{}),sourceSha256:createRequire(import.meta.url)('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(bundle,'input-surface.js'))).digest('hex'),bindings:partition?.bindings.map(({id,globalName})=>({id,globalName}))??[]}));preparedExported=true;completed++;break;}
      const output=run(path.join(directory,'out/InputSurface.exe'),[bundle,...(mode==='interactive'?['manual']:[])],{cwd:path.join(directory,'out'),env:{...process.env,NELYX_ANIMATION_VIEWPORT:viewport},nativeDiagnostics:!reuseBundle,expectedStatus:expectAllocationFailure?2:0});
      if(aot)assert.match(output,/ANIMATION_JS AOT_NATIVE initialized=true/,'The native SHUnit must initialize before accepting frame evidence');
      if(typed){const line=output.split('\n').find(line=>line.startsWith('ANIMATION_JS TYPED_EXECUTION '));assert(line,'Missing actual selected body call evidence');const counts=JSON.parse(line.slice('ANIMATION_JS TYPED_EXECUTION '.length));for(const binding of partition.bindings)assert(Number.isSafeInteger(counts[binding.globalName])&&counts[binding.globalName]>=0,'Missing selected body counter: '+binding.id);assert(partition.bindings.some(binding=>counts[binding.globalName]>0),'No specialized product body executed');}
      if(v8Profile){
        const logfile=path.join(directory,'out/v8-profile.log');assert(fs.statSync(logfile).size<=64*1024**2,'Bounded diagnostic V8 log exceeded64MiB');
        const rawLogText=fs.readFileSync(logfile,'utf8');
        for(const phase of ['list-warm','list-entry-revisit','list-resize'])console.log('ANIMATION_V8_SAMPLING '+JSON.stringify(summarizeNativeV8Profile({logfile,rawLogText,output,phase,sourceMap:path.join(bundle,'input-surface.js.map'),runner,nativeSymbolImage:process.env.NELYX_ANIMATION_V8_SYMBOL_IMAGE,nativeImageSha256:v8?.manifest.files.find(file=>file.path==='v8jsi.dll')?.sha256})));
      }
      if(expectAllocationFailure){assert.match(output,/Windows Graphite replay rejected status=3:/);const rejected=output.match(/allocator stage=budget result=-2 total=(\d+) request=(\d+) count=\d+ flags=\d+ image=[01]/);assert(rejected);assert(Number(rejected[1])+Number(rejected[2])>64*1024*1024);assert.match(output,/terminating exitCode=2 gpuDrained=0 ownersRetainedUntilProcessExit=1/);assert.doesNotMatch(output,/closed views=0|watchdog/);completed++;break;}
      assert.doesNotMatch(output,/ANIMATION_JS ERROR/);assert.match(output,/closed views=0 consumers=0 gpuDrained=1 inputRetired=1/);
      if(mode==='startup-probe'){
        const executable=path.join(directory,'out/InputSurface.exe');const observations=[];
        for(let index=0;index<3;index++){
          const result=index===0?output:run(executable,[bundle],{cwd:path.join(directory,'out'),nativeDiagnostics:true});
          assert.match(result,/ANIMATION_JS startup-probe PASS/);assert.doesNotMatch(result,/ANIMATION_JS ERROR|watchdog/);assert.match(result,/closed views=0 consumers=0 gpuDrained=1 inputRetired=1/);
          const milestones=result.split('\n').filter(line=>line.startsWith('ANIMATION_STARTUP ')).map(line=>JSON.parse(line.slice('ANIMATION_STARTUP '.length)));
          const at=name=>{const matches=milestones.filter(value=>value.stage===name);assert.equal(matches.length,1,name);return matches[0];};
          const entry=at('process-entry'),install=at('host-install-start'),prepared=at('host-prepared'),loaded=at('instance-loaded'),surface=at('first-surface-updated'),shown=at('first-shown');
          const registering=at('js-register-start'),registered=at('js-registered'),assets=at('asset-load-start'),assetReady=at('asset-font-ready'),build=at('core-first-build-start'),built=at('core-first-build-finished');
          for(const value of milestones)assert(Number.isFinite(value.nativeMs)&&Number.isFinite(value.elapsedMs)&&value.elapsedMs>=0);
          assert(install.nativeMs>=entry.nativeMs&&prepared.nativeMs>=install.nativeMs&&loaded.nativeMs>=prepared.nativeMs&&surface.nativeMs>=loaded.nativeMs);
          assert(registering.nativeMs>=prepared.nativeMs&&registered.nativeMs>=registering.nativeMs&&assets.nativeMs>=registered.nativeMs&&assetReady.nativeMs>=assets.nativeMs&&build.nativeMs>=assetReady.nativeMs&&built.nativeMs>=build.nativeMs&&surface.nativeMs>=built.nativeMs);
          if(startupBaseline){assert.equal(shown.surfaceFrames,0);assert(shown.nativeMs<surface.nativeMs);assert.doesNotMatch(result,/first-content-ready/);}
          else{const ready=at('first-content-ready');assert(shown.surfaceFrames>=1);assert(surface.nativeMs<=ready.nativeMs&&ready.nativeMs<=shown.nativeMs);assert.match(result,/first-content-ready displayed=unobserved visibleBefore=0/);}
          observations.push({processToPrepared:prepared.elapsedMs,hostInstall:prepared.nativeMs-install.nativeMs,preparedToJsRegister:registering.nativeMs-prepared.nativeMs,jsRegister:registered.nativeMs-registering.nativeMs,preparedToInstanceLoaded:loaded.nativeMs-prepared.nativeMs,assetFontLoad:assetReady.nativeMs-assets.nativeMs,assetReadyToCoreBuild:build.nativeMs-assetReady.nativeMs,coreFirstBuild:built.nativeMs-build.nativeMs,coreBuildToSurface:surface.nativeMs-built.nativeMs,instanceLoadedToSurface:surface.nativeMs-loaded.nativeMs,processToSurface:surface.processElapsedMs??null,processToShown:shown.processElapsedMs??null,entryToSurface:surface.elapsedMs,entryToShown:shown.elapsedMs,blankVisibleInterval:Math.max(0,surface.nativeMs-shown.nativeMs),firstShownSurfaceFrames:shown.surfaceFrames});
        }
        console.log('ANIMATION_STARTUP_SUMMARY '+JSON.stringify({baselineHost:startupBaseline??'current',scope:'host-only same-current-Core-Skia; OS process creation when supplied, native entry reported separately; OS file cache uncontrolled; displayed unobserved',runs:observations}));
        if(!startupBaseline){const began=Date.now();const expired=run(executable,[bundle,'startup-timeout'],{cwd:path.join(directory,'out'),nativeDiagnostics:true,expectedStatus:2});const elapsed=Date.now()-began;
          assert.match(expired,/instance-loaded/);assert.match(expired,/close-failed First content startup deadline exceeded/);assert.match(expired,/terminating exitCode=2 .*ownersRetainedUntilProcessExit=1/);assert.doesNotMatch(expired,/first-surface-updated|first-content-ready|first-shown|closed views=0|watchdog|ANIMATION_JS ERROR/);assert(elapsed>=29000&&elapsed<60000,'Actual native startup deadline must expire near 30s');console.log('ANIMATION_STARTUP_DEADLINE '+JSON.stringify({elapsedMs:elapsed,exit:2,displayed:'unobserved'}));
        }
        completed++;break;
      }
      if(mode==='interactive'){assert.match(output,/ANIMATION_JS interactive-ready/);completed++;break;}
      // Interactive repair may rebundle changed Core sources after a failed
      // diagnostic pass; only a fully successful current pass clears it.
      if(mode==='live-resize'){assert.match(output,/ANIMATION_JS live-resize PASS/);assert.match(output,/ANIMATION_DRAG entered=1 exited=1 sizing=[1-9]\d*/);completed++;lastError=undefined;break;}
      assert.match(output,/ANIMATION_JS font-collection PASS registration\/rollover\/dispose\/live-builder/);
      assert.match(output,/ANIMATION_JS text-reuse-budget PASS idle-owner\/released-query-rejection\/retained-full\/reuse\/new-rejection\/retirement/);
      if(mode==='editing-resize'){assert.match(output,/ANIMATION_JS editing-resize PASS/);completed++;break;}
      if(mode==='research-engine'){
        const result=researchResult(output,{engine,hermesMode,viewport,run:Math.floor(pass/(both?2:1))+1,sourceSha256:createRequire(import.meta.url)('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(bundle,'input-surface.js'))).digest('hex'),bindings:partition?.bindings??[]});
        if(pass===0)researchFailures({directory,bundle,run});
        console.log('ANIMATION_RESULT '+JSON.stringify(result));completed++;continue;}
      if(mode==='gallery-regression'||mode==='full-runtime-regression'){fullRuntimeResult(output,{editing:mode==='full-runtime-regression',aot:typed});
        const failure=run(path.join(directory,'out/InputSurface.exe'),[bundle,'failed-close'],{cwd:path.join(directory,'out'),nativeDiagnostics:true,expectedStatus:2});
        assert.match(failure,/ANIMATION_EXPECT_FAILED_CLOSE presentedFrame=[1-9]\d*/);assert.match(failure,/terminating exitCode=2 gpuDrained=0 ownersRetainedUntilProcessExit=1/);assert.doesNotMatch(failure,/closed views=0|watchdog/);completed++;break;}
      if(!resize){
        const line=output.split('\n').find(line=>line.startsWith('ANIMATION_JS view-metrics '));assert(line,'Missing actual Core viewport metrics');const metrics=JSON.parse(line.slice('ANIMATION_JS view-metrics '.length));assert(Number.isFinite(metrics.scale)&&metrics.scale>0);if(viewport==='fixed')assert(Math.abs(metrics.logicalWidth-800)*metrics.scale<=.5&&Math.abs(metrics.logicalHeight-600)*metrics.scale<=.5,'Performance viewport must be 800x600 logical, independent of desktop DPI');assert.equal(Math.round(metrics.logicalWidth*metrics.scale),metrics.physicalWidth);assert.equal(Math.round(metrics.logicalHeight*metrics.scale),metrics.physicalHeight);
        const selected=output.split('\n').find(line=>line.startsWith('ANIMATION_JS window-selected '));assert(selected,'Missing selected native window state');const window=JSON.parse(selected.slice('ANIMATION_JS window-selected '.length));assert.equal(window.maximized,viewport==='maximized');assert(window.visible&&!window.minimized);assert.equal(window.clientWidth,metrics.physicalWidth);assert.equal(window.clientHeight,metrics.physicalHeight);
      }
      if(resize){
        assert.match(output,/ANIMATION_RESIZE count=19/);assert.match(output,/ANIMATION_DRAG entered=1 exited=1 sizing=[1-9]\d*/);assert.match(output,/ANIMATION_QUEUE_FAILURE primary=1 retained=1/);assert.match(output,/ANIMATION_JS resize-settled count=19/);
        const failure=run(path.join(directory,'out/InputSurface.exe'),[bundle,'failed-close'],{cwd:path.join(directory,'out'),nativeDiagnostics:true,expectedStatus:2});
        assert.match(failure,/ANIMATION_EXPECT_FAILED_CLOSE presentedFrame=[1-9]\d*/);assert.match(failure,/close-failed Native Composition session failed/);assert.match(failure,/terminating exitCode=2 gpuDrained=0 ownersRetainedUntilProcessExit=1/);assert.doesNotMatch(failure,/closed views=0|watchdog/);
        if(process.env.NELYX_ANIMATION_NATIVE_CORE_TRACE==='1'){
          const uncertain=run(path.join(directory,'out/InputSurface.exe'),[bundle],{cwd:path.join(directory,'out'),nativeDiagnostics:true,expectedStatus:2,env:{...process.env,NELYX_QUEUE_FAIL_AFTER_ACQUIRE:'1'}});
          assert.match(uncertain,/Queue test failure after acquire submission/);assert.match(uncertain,/terminating exitCode=2 gpuDrained=0 ownersRetainedUntilProcessExit=1/);assert.doesNotMatch(uncertain,/closed views=0|watchdog/);
        }
      }
      if(process.env.NELYX_ANIMATION_NATIVE_TRACE==='1'){
        const stages=output.split('\n').filter(line=>line.startsWith('ANIMATION_STAGES ')).map(line=>JSON.parse(line.slice('ANIMATION_STAGES '.length)));assert.equal(stages.length,4,'Missing native timing phases');
        for(const phase of stages){for(const summary of Object.values(phase.stages)){assert(summary.n>0);assert(['sum','p50','p95','max'].every(key=>Number.isFinite(summary[key])&&summary[key]>=0));}assert(phase.stages['Native.publish']);if(nativeCoreSource)assert(phase.stages['NativeCore.frame'],'Device timing object was not linked');}
        if(process.env.NELYX_ANIMATION_NATIVE_CORE_TRACE==='1')assert(stages.every(phase=>!phase.stages['NativeCore.cacheFallback']),'Selected frames must confirm wrapper retirement without a full cache purge');
      }
      if(mode==='cpu-timing'){
        const samples=output.split('\n').filter(line=>line.startsWith('ANIMATION_JS {"phase"')).map(line=>JSON.parse(line.slice('ANIMATION_JS '.length)));assert.equal(samples.length,4,'Missing whole-frame CPU phases');
        for(const sample of samples){assert.equal(sample.engine,engine,'Actual native VM must match the selected backend');const cpu=sample['Frame.cpu'];assert(cpu?.n>1&&['p50','p95','max'].every(key=>Number.isFinite(cpu[key])&&cpu[key]>=0),'Missing active-frame CPU distribution: '+sample.phase);assert(cpu.max>=cpu.p95&&cpu.p95>=cpu.p50);assert(Number.isSafeInteger(sample.transportCaptures)&&sample.transportCaptures>=0);assert.equal(sample.trace,false);assert.equal(sample.diagnostic,false);}
        const route=samples.find(sample=>sample.phase==='cupertino-route');assert.equal(route['Frame.routeFirst.push']?.n,3);assert.equal(route['Frame.routeFirst.pop']?.n,3);assert.equal(route['Frame.routeContinuation']?.n+6,route['Frame.cpu'].n,'First route builds remain in the full frame distribution');
      }
      const summaries=output.split('\n').filter(line=>line.startsWith('ANIMATION_NATIVE ')).map(line=>JSON.parse(line.slice('ANIMATION_NATIVE '.length)));assert.deepEqual(summaries.map(summary=>summary.phase),['material-progress','material-scroll','cupertino-activity','cupertino-route']);for(const summary of summaries){assert(summary.frames>1,summary.phase);assert(Number.isFinite(summary.elapsedMs)&&summary.elapsedMs>0);assert.equal(summary.intervals.length,summary.frames-1);assert(summary.intervals.every(value=>Number.isFinite(value)&&value>0));const intervals=[...summary.intervals].sort((a,b)=>a-b);console.log(JSON.stringify({phase:summary.phase,completedHz:summary.frames*1000/summary.elapsedMs,frames:summary.frames,p50:intervals[Math.floor(intervals.length*.5)],p95:intervals[Math.floor(intervals.length*.95)]}));}
      completed++;}catch(error){lastError=error;if(process.env.NELYX_ANIMATION_ITERATE!=='1')throw error;console.log('ANIMATION_FAILURE '+String(error));}
      if(!iterative||pass===9)continue;console.log('ANIMATION_READY: r repeat, f fixed viewport, w default window, m maximized, b minimal CPU, i immediate accessibility, h 50ms accessibility, z resize/failure regression, u no JS wrappers, t trace, d diagnostics, c clear replay, s static semantics, o Hermes -O, n -O -fno-inline, v no-CFG diagnostic, g -Og, a gallery regression, p 4ms/24-unit wheel stress, l loaded 4ms/1-unit wheel, e OS wheel, q finish/clean');const control=path.join(directory,'control');console.log('ANIMATION_CONTROL '+control);const response=await new Promise(resolve=>{let settled=false;const finish=command=>{if(settled)return;settled=true;watcher.close();t.signal.removeEventListener('abort',aborted);resolve(command);},aborted=()=>finish('q');const receive=()=>{if(!fs.existsSync(control))return;const command=fs.readFileSync(control,'utf8').trim();if(!command)return;fs.unlinkSync(control);finish(command);};const watcher=fs.watch(directory,receive);t.signal.addEventListener('abort',aborted,{once:true});if(t.signal.aborted)aborted();else receive();});const command=String(response).trim();if(command==='f'||command==='w'||command==='m'){process.env.NELYX_ANIMATION_VIEWPORT=command==='f'?'fixed':command==='w'?'default':'maximized';}else if(command==='b'||command==='z'||command==='i'||command==='h'){if(command==='i'||command==='h')process.env.NELYX_ANIMATION_SEMANTICS_INTERVAL=command==='i'?'0':'50';process.env.NELYX_ANIMATION_TRACE='0';process.env.NELYX_ANIMATION_DIAGNOSTIC='0';process.env.NELYX_ANIMATION_MODE='cpu-timing';process.env.NELYX_ANIMATION_RESIZE=command==='z'?'1':'0';}else if(command==='a'){process.env.NELYX_ANIMATION_MODE='gallery-regression';process.env.NELYX_ANIMATION_TRACE='0';process.env.NELYX_ANIMATION_DIAGNOSTIC='0';process.env.NELYX_ANIMATION_RESIZE='0';if(process.env.NELYX_ANIMATION_WHEEL_INPUT!=='queued')process.env.NELYX_ANIMATION_WHEEL_INPUT='1';process.env.NELYX_ANIMATION_VIEWPORT='maximized';}else if(command==='u'){process.env.NELYX_ANIMATION_TRACE='0';process.env.NELYX_ANIMATION_DIAGNOSTIC='0';process.env.NELYX_ANIMATION_MODE='standard';}else if(command==='t'){process.env.NELYX_ANIMATION_TRACE='1';process.env.NELYX_ANIMATION_DIAGNOSTIC='0';process.env.NELYX_ANIMATION_MODE='standard';}else if(command==='d'){process.env.NELYX_ANIMATION_DIAGNOSTIC='1';process.env.NELYX_ANIMATION_MODE='standard';}else if(command==='c'){process.env.NELYX_ANIMATION_DIAGNOSTIC='1';process.env.NELYX_ANIMATION_MODE='renderer-clear';}else if(command==='s'){process.env.NELYX_ANIMATION_DIAGNOSTIC='1';process.env.NELYX_ANIMATION_MODE='host-semantics-static';}else if(command==='o')process.env.NELYX_ANIMATION_HERMES_OPT='O';else if(command==='n')process.env.NELYX_ANIMATION_HERMES_OPT='O-no-inline';else if(command==='v')process.env.NELYX_ANIMATION_HERMES_OPT='O-no-cfg';else if(command==='g')process.env.NELYX_ANIMATION_HERMES_OPT='Og';else if(command==='p'){process.env.NELYX_ANIMATION_WHEEL_INTERVAL_MS='4';process.env.NELYX_ANIMATION_WHEEL_DELTA='24';}else if(command==='l'){process.env.NELYX_ANIMATION_WHEEL_INTERVAL_MS='4';process.env.NELYX_ANIMATION_WHEEL_DELTA='1';process.env.NELYX_ANIMATION_WHEEL_WARMUP='1';}else if(command==='e'){process.env.NELYX_ANIMATION_WHEEL_INPUT='1';}else if(command!=='r')break;
    }if(lastError)throw lastError;assert(completed>0,'No complete animation scenario run');
  }finally{if(mainOwned){assert.equal(path.dirname(mainFile),runner);assert(!fs.lstatSync(mainFile).isSymbolicLink());fs.unlinkSync(mainFile);}if(entryOwned){assert.equal(path.dirname(entry),runner);assert(!fs.lstatSync(entry).isSymbolicLink());fs.unlinkSync(entry);}if(configOwned){assert(!fs.lstatSync(configFile).isSymbolicLink());fs.unlinkSync(configFile);}assert.equal(path.dirname(directory),fs.realpathSync(os.tmpdir()));assert(path.basename(directory).startsWith('nelyx-windows-animation-'));assert(!fs.lstatSync(directory).isSymbolicLink());if(!preparedExported)fs.rmSync(directory,{recursive:true,force:true,maxRetries:20,retryDelay:250});}
});
