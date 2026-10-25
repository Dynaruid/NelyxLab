import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=path.resolve(import.meta.dirname,'../../..');
const skia=path.join(root,'Nelyx/skia'),rn=path.join(skia,'packages/rn'),native=path.join(skia,'packages/native');
const ownLicense=fs.readFileSync(path.join(root,'Nelyx/LICENSE.md'));
for(const directory of [path.join(root,'Nelyx/sdk'),skia,rn,native]) {
 const file=path.join(directory,'LICENSE.md');
 if(!fs.existsSync(file)||!fs.readFileSync(file).equals(ownLicense))fs.writeFileSync(file,ownLicense);
}
for(const packageOwner of [rn,native]){
fs.mkdirSync(path.join(packageOwner,'licenses'),{recursive:true});
for(const relative of ['THIRD_PARTY_NOTICES.md','licenses/react-native-skia-MIT.md','licenses/skia-BSD-3-Clause.txt',
 'licenses/libwebp-COPYING.txt','licenses/libwebp-PATENTS.txt','licenses/libwebp-AUTHORS.txt']) {
 const file=path.join(packageOwner,relative);
 const packageNotice=relative==='THIRD_PARTY_NOTICES.md'?'\nThe Windows keyboard pairing kernel in `generated/host/windows/WindowsKeyboardInput.h`\n'+
  'adapts the Flutter engine Windows KeyboardManager session at Flutter revision\n'+
  '`71e4717a61786faab4c7aa39825989305ed29e8a`. Its original 2013 Flutter Authors\n'+
  'BSD-3-Clause notice is retained in `licenses/FlutterEngine-LICENSE.md`.\n'+
  'The RNW event, focus and lifetime integration is an Nelyx adaptation; this\n'+
  'retained notice does not qualify the full native dependency notice inventory.\n'+
  '\nThe contact/inertia protocol in `generated/host/windows/WindowsPrecisionTrackpad.h`\n'+
  'adapts Flutter engine `shell/platform/windows/direct_manipulation.cc`, reviewed\n'+
  'source SHA-256 `fa9ce84227c9096bc9a214569854d3ff49822e85d885e1dacb76d514341b955b`.\n'+
  'Its 2013 Flutter Authors BSD-3-Clause notice is retained in the same license.\n':'';
 const notice=Buffer.concat([fs.readFileSync(path.join(skia,relative)),Buffer.from(packageNotice)]);
 if(!fs.existsSync(file)||!fs.readFileSync(file).equals(notice))fs.writeFileSync(file,notice);
}
fs.copyFileSync(path.join(root,'Nelyx/licenses/FlutterEngine-LICENSE.md'),path.join(packageOwner,'licenses/FlutterEngine-LICENSE.md'));
}
const prepared=spawnSync('python',[path.join(skia,'eng/prepare-artifacts.py'),'--artifact','rn-graphite-154.1-sdk',...(process.argv.includes('--offline')?['--offline']:[])],{encoding:'utf8',timeout:240000});
if(prepared.status!==0||prepared.error)throw new Error(`Pinned SDK preparation failed: ${prepared.error??prepared.stderr}`);
const externalSdk=JSON.parse(prepared.stdout).sdk;
function files(directory){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(item=>{if(item.isSymbolicLink())throw new Error('Unexpected native source symlink');const file=path.join(directory,item.name);return item.isDirectory()?files(file):[file];});}
function mirror(source,target,owner) {
 const relative=path.relative(owner,path.resolve(target));if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Native generated path outside package');
 const wanted=new Set(files(source).map(file=>path.relative(source,file)));
 if(fs.existsSync(target))for(const file of files(target))if(!wanted.has(path.relative(target,file)))fs.unlinkSync(file);
 for(const file of files(source)) {
  const destination=path.join(target,path.relative(source,file)),bytes=fs.readFileSync(file);
  if(fs.existsSync(destination)&&fs.readFileSync(destination).equals(bytes))continue;
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
 }
}
mirror(externalSdk,path.join(rn,'generated/sdk'),rn);
for(const owner of [rn,native]){
 mirror(path.join(skia,'native/core'),path.join(owner,'generated/core'),owner);
 mirror(path.join(skia,'native/host'),path.join(owner,'generated/host'),owner);
 mirror(path.join(skia,'native/rendering/nelyx_skia'),path.join(owner,'generated/gpu/nelyx_skia'),owner);
 mirror(path.join(skia,'native/platforms/vulkan'),path.join(owner,'generated/vulkan'),owner);
 const binding=path.join(skia,'native/adapters/jsi'),cpp=path.join(owner,owner===rn?'generated/jsi':'cpp');
 mirror(path.join(binding,'cpp'),cpp,owner);
 mirror(path.join(binding,'vulkan'),path.join(owner,owner===rn?'generated/native-vulkan':'native/vulkan'),owner);
 const recipe=path.join(owner,owner===rn?'generated/jsi/engine.cmake':'native/jsi/engine.cmake');fs.mkdirSync(path.dirname(recipe),{recursive:true});fs.copyFileSync(path.join(binding,'engine.cmake'),recipe);
}
for(const owner of [rn,native]){const vulkanSdk=path.join(owner,'native/vulkan/sdk');
for(const relative of ['vendor/artifacts.lock.json','vendor/windows-rn-supplier.lock.json','vendor/linux-graphite-probe.lock.json','eng/prepare-artifacts.py',
  'eng/source-build/prepare-rn-modules.py','eng/source-build/rn-modules.cmake','eng/source-build/libwebp.lock.json']) {
 const destination=path.join(vulkanSdk,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});
 fs.copyFileSync(path.join(skia,relative),destination);
}
}
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const core=Object.fromEntries(files(path.join(skia,'native/core')).sort().map(file=>[path.relative(path.join(skia,'native/core'),file).replaceAll('\\','/'),digest(file)]));
const wire=Number(fs.readFileSync(path.join(root,'Nelyx/src/ui/frame-wire.ts'),'utf8').match(/export const frameWireVersion=(\d+);/)?.[1]);
const nativeWire=Number(fs.readFileSync(path.join(skia,'native/core/core.cpp'),'utf8').match(/frameWireVersion\(\) noexcept \{ return (\d+); \}/)?.[1]);
if(!Number.isSafeInteger(wire)||wire<1||wire!==nativeWire)throw new Error('Core/native frame wire version mismatch');
const common={schema:'nelyx.skia-native/v1',abi:1,wire,supportedWireVersions:Array.from({length:wire},(_,i)=>i+1),core,source:'Nelyx/skia/native',referenceSnapshot:JSON.parse(fs.readFileSync(path.join(skia,'upstream.json'),'utf8')).referenceSnapshot};
const sdkLock=JSON.parse(fs.readFileSync(path.join(skia,'vendor/artifacts.lock.json'),'utf8'));
const sdkInput=sdkLock.artifacts.find(item=>item.id==='rn-graphite-154.1-sdk');
const appleSupply=path.join(skia,'vendor/apple-rn-binaries.lock.json');
fs.copyFileSync(appleSupply,path.join(rn,'apple/native-supply.json'));
const profiles={rn:{...common,profile:'android-m154-graphite',headers:{package:'react-native-skia',version:'3.0.8',archiveSha256:sdkInput.archiveSha256,treeSha256:sdkInput.treeSha256,root:'generated/sdk',artifact:sdkInput.id},binaries:{package:'react-native-skia-graphite-android',version:'154.1.0'},binarySourceIdentity:'notVerified'}};
profiles.rn.appleSupply='apple/native-supply.json';
profiles.rn.windowsPointer={protocol:1,component:'native/windows/SkiaView.h',coordinates:'logical-local',clock:'SDK monotonic receipt time',lifetime:'view and surface generation',qualification:'notVerified'};
profiles.rn.nativeVulkan={recipe:'native/vulkan/CMakeLists.txt',platformContext:'generated/native-vulkan/RNSkVulkanPlatformContext.h',
  bindingSources:'generated/jsi',gpuSources:'generated/vulkan',gpuContract:'generated/gpu/nelyx_skia/gpu_context.h',
  profiles:['windows-x64-graphite-text-probe','linux-x64-graphite-text-probe'],
  matchingModules:'Full RN API additionally needs the explicit matching SVG/Skottie/SG/resources/JSON/WebP module supplement',
  sdkPrepare:'native/vulkan/sdk/eng/prepare-artifacts.py',sdkLock:'native/vulkan/sdk/vendor/artifacts.lock.json',
  linuxSdkLock:'native/vulkan/sdk/vendor/linux-graphite-probe.lock.json',
  moduleSourceBuild:'native/vulkan/sdk/eng/source-build/prepare-rn-modules.py',
  admission:'Requires an SDK hardware host, exact cohort and owner generation; platform qualification notVerified'};
profiles.native={...common,renderer:'skia-graphite',binding:'native/jsi/engine.cmake',jsi:[21],host:'embedder-provided',qualification:'experimental',performanceAccepted:false};
for(const [name,manifest]of Object.entries(profiles))fs.writeFileSync(path.join(skia,'packages',name,'native-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Prepared native sources and pinned SDK headers.');
