import fs from 'node:fs';
import path from 'node:path';
import {verifyAppAssets} from '@nelyx/metro/assets';
import {defineConfig} from '@nelyx/sdk/runtime/config';
import {createProviderRegistry} from '@nelyx/sdk/runtime/providers';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {coreVersion} from '@nelyx/core/version';
import {sdkVersion} from '@nelyx/sdk/version';
const template=path.resolve(import.meta.dirname,'../templates/nelyx-app');
export async function createApp(destination, sdkReference=sdkVersion, name='NelyxApp', coreReference=coreVersion, skiaReferences={}) {
  if(!/^[A-Z][A-Za-z0-9]*$/.test(name)) throw new Error('App name must start with an uppercase letter and contain letters/digits.');
  const selectedDesigns=skiaReferences.designs??['material','cupertino'];
  if(!Array.isArray(selectedDesigns)||new Set(selectedDesigns).size!==selectedDesigns.length||selectedDesigns.some(name=>!['material','cupertino'].includes(name)))throw new Error('Designs must select material, cupertino, both, or none');
  const androidTemplate=JSON.parse(fs.readFileSync(path.join(template,'android/runner/package.json'),'utf8')),webTemplate=JSON.parse(fs.readFileSync(path.join(template,'web/runner/package.json'),'utf8'));
  skiaReferences={...skiaReferences,native:skiaReferences.native??androidTemplate.dependencies['@nelyx/skia-native'],rn:skiaReferences.rn??androidTemplate.dependencies['@nelyx/skia-rn'],web:skiaReferences.web??webTemplate.dependencies['@nelyx/skia-web'],metro:skiaReferences.metro??androidTemplate.devDependencies['@nelyx/metro'],cli:skiaReferences.cli??androidTemplate.devDependencies['@nelyx/cli']};
  const staticAotReference=skiaReferences['static-aot']??JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname,'../package.json'),'utf8')).dependencies['@nelyx/static-aot'];
  const registry=createProviderRegistry();
  for(const id of skiaReferences.targets??['android','web']) {const profile=registry.profile(id,skiaReferences.profiles?.[id]);if(profile.status!=='implemented'&&!['ios','macos'].includes(id))throw new Error(`Template target ${id} requires an implemented RN provider; Deno/raw templates were retired`);}
  const target=path.resolve(destination);
  if(fs.existsSync(target) && fs.readdirSync(target).length) throw new Error('Destination must be empty.');
  fs.cpSync(template,target,{recursive:true});
  const manifest=JSON.parse(fs.readFileSync(path.join(target,'package.json.template'),'utf8'));
  manifest.name=name.toLowerCase(); manifest.dependencies['@nelyx/sdk']=sdkReference; manifest.dependencies['@nelyx/core']=coreReference;
  manifest.dependencies['@nelyx/skia-rn']=skiaReferences.rn;delete manifest.dependencies['@nelyx/skia-deno'];manifest.dependencies['@nelyx/skia-web']=skiaReferences.web;
  manifest.devDependencies['@nelyx/metro']=skiaReferences.metro;
  if(skiaReferences.cli)manifest.devDependencies['@nelyx/cli']=skiaReferences.cli;
  const desktopOnly=skiaReferences.targets?.length===1&&skiaReferences.targets[0]==='windows';
  const webOnly=skiaReferences.targets?.length===1&&skiaReferences.targets[0]==='web';
  const appleOnly=skiaReferences.targets?.length===1&&['ios','macos'].includes(skiaReferences.targets[0]);
  const linuxOnly=skiaReferences.targets?.length===1&&skiaReferences.targets[0]==='linux';
  delete manifest.optionalDependencies;
  if(webOnly){for(const name of ['react-native','@nelyx/skia-rn','@nelyx/skia-deno','react-native-skia-graphite-android'])delete manifest.dependencies[name];for(const name of Object.keys(manifest.devDependencies))if(!['@nelyx/metro','@nelyx/cli','@types/react'].includes(name))delete manifest.devDependencies[name];manifest.scripts={'build:web':'node web/runner/build.mjs'};}
  if(desktopOnly){manifest.dependencies={};manifest.devDependencies={};delete manifest.optionalDependencies;manifest.scripts={'build:windows':'npm --prefix windows/runner run build','run:windows':'npm --prefix windows/runner run run','check:windows':'npm --prefix windows/runner run check','bundle:windows':'npm --prefix windows/runner run bundle'};}
  if(appleOnly){const target=skiaReferences.targets[0];manifest.dependencies={};manifest.devDependencies={};manifest.scripts=Object.fromEntries(['check','bundle','build','run'].map(command=>[command+':'+target,`npm --prefix ${target}/runner run ${command}`]));}
  if(linuxOnly){manifest.dependencies={};manifest.devDependencies={};manifest.scripts=Object.fromEntries(['check','bundle','build','run'].map(command=>[command+':linux',`npm --prefix linux/runner run ${command}`]));}
  // The application root owns shared source/configuration, never a hoisted
  // runtime tree. Each selected runner below owns its explicit package inputs.
  manifest.dependencies={};manifest.devDependencies={};manifest.scripts={};
  for(const id of skiaReferences.targets??['android','ios','windows','macos','linux','web'])for(const operation of (id==='web'?['check','build','dev']:['windows','linux'].includes(id)?['check','bundle','build','run','dev']:['check','bundle','build','run']))manifest.scripts[operation+':'+id]=`npm --prefix ${id}/runner run ${operation}${id==='windows'&&operation==='build'?' --':''}`;
  for(const id of ['android','web'])if(!skiaReferences.targets||skiaReferences.targets.includes(id)){
    const file=path.join(target,id,'runner/package.json'),runner=JSON.parse(fs.readFileSync(file,'utf8')),reference=value=>value.startsWith('file:')&&path.isAbsolute(value.slice(5))?'file:'+path.relative(path.dirname(file),value.slice(5)).replaceAll('\\','/'):value;
    for(const [name,value]of Object.entries({'@nelyx/core':coreReference,'@nelyx/sdk':sdkReference,[id==='android'?'@nelyx/skia-rn':'@nelyx/skia-web']:id==='android'?(skiaReferences.rn):(skiaReferences.web),...(id==='android'?{'react-native-skia-graphite-android':skiaReferences.android??'154.1.0'}:{})}))runner.dependencies[name]=reference(value);
    for(const [name,value]of Object.entries({'@nelyx/metro':skiaReferences.metro,'@nelyx/cli':skiaReferences.cli}))runner.devDependencies[name]=reference(value);
    fs.writeFileSync(file,JSON.stringify(runner,null,2)+'\n');
  }
  if(!skiaReferences.targets||skiaReferences.targets.includes('windows')){
    const runnerFile=path.join(target,'windows/runner/package.json'),runner=JSON.parse(fs.readFileSync(runnerFile,'utf8'));
    const fromRunner=reference=>reference.startsWith('file:')&&path.isAbsolute(reference.slice(5))?'file:'+path.relative(path.dirname(runnerFile),reference.slice(5)).replaceAll('\\','/'):reference;
    for(const [name,reference]of Object.entries({'@nelyx/core':coreReference,'@nelyx/sdk':sdkReference,'@nelyx/skia-rn':skiaReferences.rn}))runner.dependencies[name]=fromRunner(reference);
    runner.devDependencies['@nelyx/metro']=fromRunner(skiaReferences.metro);fs.writeFileSync(runnerFile,JSON.stringify(runner,null,2)+'\n');
    runner.devDependencies['@nelyx/cli']=fromRunner(skiaReferences.cli);fs.writeFileSync(runnerFile,JSON.stringify(runner,null,2)+'\n');
  }
  for(const id of ['ios','macos'])if(!skiaReferences.targets||skiaReferences.targets.includes(id)){
    const file=path.join(target,id,'runner/package.json'),runner=JSON.parse(fs.readFileSync(file,'utf8'));
    const reference=value=>value.startsWith('file:')&&path.isAbsolute(value.slice(5))?'file:'+path.relative(path.dirname(file),value.slice(5)).replaceAll('\\','/'):value;
    for(const [name,value]of Object.entries({'@nelyx/core':coreReference,'@nelyx/sdk':sdkReference,'@nelyx/skia-rn':skiaReferences.rn,['react-native-skia-graphite-apple-'+id]:skiaReferences[id]??'154.1.0'}))runner.dependencies[name]=reference(value);
    for(const [name,value]of Object.entries({'@nelyx/metro':skiaReferences.metro,'@nelyx/cli':skiaReferences.cli}))runner.devDependencies[name]=reference(value);
    fs.writeFileSync(file,JSON.stringify(runner,null,2)+'\n');
  }
  if(!skiaReferences.targets||skiaReferences.targets.includes('linux')){
    const file=path.join(target,'linux/runner/package.json'),runner=JSON.parse(fs.readFileSync(file,'utf8'));
    const reference=value=>value.startsWith('file:')&&path.isAbsolute(value.slice(5))?'file:'+path.relative(path.dirname(file),value.slice(5)).replaceAll('\\','/'):value;
    for(const [name,value]of Object.entries({'@nelyx/core':coreReference,'@nelyx/sdk':sdkReference,'@nelyx/skia-rn':skiaReferences.rn,...(skiaReferences.linuxPackages??{})}))runner.dependencies[name]=reference(value);
    for(const [name,value]of Object.entries({'@nelyx/metro':skiaReferences.metro,'@nelyx/cli':skiaReferences.cli}))runner.devDependencies[name]=reference(value);
    fs.writeFileSync(file,JSON.stringify(runner,null,2)+'\n');
  }
  fs.writeFileSync(path.join(target,'package.json'),JSON.stringify(manifest,null,2)+'\n');
  const designs=Object.fromEntries(selectedDesigns.map(name=>['@nelyx/'+name,skiaReferences[name]??androidTemplate.dependencies['@nelyx/'+name]]));
  for(const [name,value]of Object.entries(designs))if(!value)throw new Error('Template design reference missing: '+name);
  for(const id of ['android','web','windows','ios','macos','linux']){
    const file=path.join(target,id,'runner/package.json'),runner=JSON.parse(fs.readFileSync(file,'utf8'));
    if(id==='web')delete runner.dependencies['@nelyx/skia-native'];
    else{const value=skiaReferences.native;if(!value)throw new Error('Template native Engine reference missing');runner.dependencies['@nelyx/skia-native']=value.startsWith('file:')&&path.isAbsolute(value.slice(5))?'file:'+path.relative(path.dirname(file),value.slice(5)).replaceAll('\\','/'):value;}
    runner.devDependencies['@nelyx/static-aot']=staticAotReference.startsWith('file:')&&path.isAbsolute(staticAotReference.slice(5))?'file:'+path.relative(path.dirname(file),staticAotReference.slice(5)).replaceAll('\\','/'):staticAotReference;
    for(const name of ['material','cupertino'])delete runner.dependencies['@nelyx/'+name];
    for(const [name,value]of Object.entries(designs))runner.dependencies[name]=value.startsWith('file:')&&path.isAbsolute(value.slice(5))?'file:'+path.relative(path.dirname(file),value.slice(5)).replaceAll('\\','/'):value;
    fs.writeFileSync(file,JSON.stringify(runner,null,2)+'\n');
  }
  if(selectedDesigns.length<2){
    const sourceRoot=path.resolve(target,'src');
    if(path.dirname(sourceRoot)!==target||fs.lstatSync(sourceRoot).isSymbolicLink())throw new Error('Generated source owner differs');
    for(const entry of fs.readdirSync(sourceRoot,{withFileTypes:true}))if(!['app.ts','index.ts'].includes(entry.name)){
      const file=path.resolve(sourceRoot,entry.name);if(path.dirname(file)!==sourceRoot||entry.isSymbolicLink()||!entry.isFile())throw new Error('Unexpected generated source entry');fs.unlinkSync(file);
    }
    const design=selectedDesigns[0];
    const importDesign=design==='material'?"import {MaterialApp,Scaffold} from '@nelyx/material/widgets';\n":design==='cupertino'?"import {CupertinoTheme,CupertinoPageScaffold} from '@nelyx/cupertino/widgets';\n":'';
    const body=design==='material'?"new MaterialApp(new Scaffold('Nelyx',new Text(state.initialText)))":design==='cupertino'?"new CupertinoTheme(new CupertinoPageScaffold('Nelyx',new Text(state.initialText)))":"new DecoratedBox(new Padding(allInsets(24),new Text(state.initialText,{color:0xffe5e7eb})),0xff101827)";
    fs.writeFileSync(path.join(sourceRoot,'app.ts'),"// SPDX-License-Identifier: BSD-3-Clause\nimport type {ApplicationDefinition} from '@nelyx/core/hosting/runtime';\nimport {widgetApplication} from '@nelyx/core/framework/widgets/root';\nimport {Text,DecoratedBox,Padding} from '@nelyx/core/framework/widgets/basic';\nimport {Directionality} from '@nelyx/core/framework/widgets/app-data';\nimport {allInsets} from '@nelyx/core/ui/geometry';\n"+importDesign+"export interface ApplicationState {readonly initialText:string}\nexport function createApplicationState():ApplicationState{return {initialText:'Hello Nelyx'};}\nexport function defineApplication(state:ApplicationState):ApplicationDefinition{return widgetApplication({id:'nelyx.generated',defaultFont:'sample-font',createRoot:()=>new Directionality('ltr',"+body+")});}\n");
  }
  fs.unlinkSync(path.join(target,'package.json.template'));
  const androidPackage=`com.${name.toLowerCase()}`;
  const visit=(directory)=>{for(const item of fs.readdirSync(directory,{withFileTypes:true})) {const file=path.join(directory,item.name); if(item.isDirectory()) visit(file); else if(/\.(?:js|mjs|cjs|ts|tsx|json|kt|xml|gradle|properties|swift|plist|pbxproj|xcscheme|storyboard|xcprivacy|entitlements)$/.test(file)||item.name==='Podfile') fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('NelyxTestbed',name).replaceAll('com.nelyxtestbed',androidPackage));}};
  visit(target);
  for(const id of ['ios','macos']){
    const native=path.join(target,id);
    const rename=directory=>{for(const item of fs.readdirSync(directory,{withFileTypes:true})){
      const file=path.join(directory,item.name);if(item.isSymbolicLink())throw new Error('Generated Apple native symlink');if(item.isDirectory())rename(file);
      if(item.name.includes('NelyxTestbed')){const destination=path.join(directory,item.name.replaceAll('NelyxTestbed',name));for(const candidate of [file,destination]){const relative=path.relative(target,path.resolve(candidate));if(relative.startsWith('..')||path.isAbsolute(relative)||!relative)throw new Error('Generated Apple rename outside app');}if(file!==destination){if(fs.existsSync(destination))throw new Error('Generated Apple rename collision');fs.renameSync(file,destination);}}
    }};rename(native);
  }
  const javaRoot=path.join(target,'android/app/src/main/java/com'),oldPackage=path.join(javaRoot,'nelyxtestbed'),newPackage=path.join(javaRoot,name.toLowerCase());
  for(const file of [oldPackage,newPackage]) {const relative=path.relative(target,path.resolve(file));if(relative.startsWith('..') || path.isAbsolute(relative))throw new Error('Generated Android path outside app');}
  if(oldPackage!==newPackage)fs.renameSync(oldPackage,newPackage);
  const packageFile=path.join(target,'package.json'),applicationPackage=JSON.parse(fs.readFileSync(packageFile,'utf8'));
  const baseline=applicationPackage.nelyx;
  const targets=Object.fromEntries(Object.entries(baseline.targets).filter(([id])=>!skiaReferences.targets||skiaReferences.targets.includes(id)).map(([id,settings])=>[id,{...settings,profile:skiaReferences.profiles?.[id]??settings.profile}]));
  const configuration=defineConfig({...baseline,name,displayName:name,targets});
  // All template assets are packaged inputs. Verify them without downloads or a second manifest.
  verifyAppAssets(target,configuration.assets);
  fs.writeFileSync(packageFile,JSON.stringify({...applicationPackage,nelyx:configuration},null,2)+'\n');
  // Debug keys are local generated state, never included in the template source.
  if(!desktopOnly&&!webOnly&&!appleOnly&&!linuxOnly){const key=spawnSync('keytool',['-genkeypair','-keystore',path.join(target,'android/app/debug.keystore'),'-storepass','android','-keypass','android','-alias','androiddebugkey','-keyalg','RSA','-keysize','2048','-validity','3650','-dname','CN=Android Debug,O=Android,C=US'],{encoding:'utf8',timeout:30000});
  if(key.error || key.status!==0) throw new Error(`Debug key generation needs an installed JDK: ${key.error??key.stderr}`);}
  return target;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [destination,sdkReference,name,coreReference,rnReference]=process.argv.slice(2);
  if(!destination || !sdkReference) throw new Error('Usage: node create-app.mjs <empty-directory> <SDK tgz or package version> [AppName] [core reference]');
  console.log(await createApp(destination,sdkReference,name,coreReference,{rn:rnReference}));
}
