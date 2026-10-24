// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {prepareAppAssetConfiguration}=require('./assets.cjs');
const {createRequire}=require('node:module');
const runnerOutputPaths=require('./runner-output-paths.cjs');
const {assertInstalledSupply}=require('./installed-supply.cjs');
const cohorts=Object.freeze({
  android:{react:'19.2.0',rn:'0.83.10'},ios:{react:'19.2.0',rn:'0.83.10'},
  windows:{react:'19.2.0',rn:'0.83.10',framework:'react-native-windows',frameworkVersion:'0.83.2'},
  macos:{react:'19.2.0',rn:'0.83.10',framework:'react-native-macos',frameworkVersion:'0.83.0'},
  linux:{react:'19.1.4',rn:'0.81.6',framework:'@lucid-softworks/react-native-linux',frameworkVersion:'0.0.1'},
});
const inside=(file,directory)=>{const relative=path.relative(directory,file);return relative===''||(!relative.startsWith('..')&&!path.isAbsolute(relative));};
function inspectRunnerCohort(options){
  const expected=cohorts[options.target];if(!expected)throw new Error('Unknown RN runner target: '+options.target);
  const runnerRoot=fs.realpathSync(options.runnerRoot),packageFile=path.join(runnerRoot,'package.json');
  if(!fs.existsSync(packageFile))throw new Error('RN runner must own a package.json: '+runnerRoot);
  assertInstalledSupply(runnerRoot,options.packageRoots);
  const nodeModules=path.join(runnerRoot,'node_modules'),load=createRequire(packageFile);
  function owned(name,version){
    const file=load.resolve(name+'/package.json');
    if(!inside(file,nodeModules))throw new Error(`${name} resolved outside runner node_modules: ${file}; install this runner's independent cohort`);
    const actual=JSON.parse(fs.readFileSync(file,'utf8')).version;
    if(actual!==version)throw new Error(`${options.target} requires ${name}@${version}, resolved ${actual}`);
    return path.dirname(file);
  }
  const reactRoot=owned('react',expected.react),reactNativeRoot=owned('react-native',expected.rn);
  owned('@react-native/metro-config',expected.rn);
  const frameworkRoot=expected.framework?owned(expected.framework,expected.frameworkVersion):reactNativeRoot;
  if(options.target==='linux'){
    const provenance=JSON.parse(fs.readFileSync(path.join(frameworkRoot,'UPSTREAM.json'),'utf8'));
    if(provenance.commit!=='9412cf605c7cc77f920916401926ff9a9873ecd3'||provenance.hermesCommit!=='e0fc67142ec0763c6b6153ca2bf96df815539782')
      throw new Error('Linux runner requires the pinned RNL/Hermes source supply');
  }
  const rendererRoot=['windows','macos'].includes(options.target)?frameworkRoot:reactNativeRoot;
  const reactNativeFacadeRoot=['windows','macos'].includes(options.target)?frameworkRoot:reactNativeRoot;
  const facadePackage=JSON.parse(fs.readFileSync(path.join(reactNativeFacadeRoot,'package.json'),'utf8'));
  const reactNativeEntry=path.resolve(reactNativeFacadeRoot,facadePackage.main??'index.js');
  if(!inside(reactNativeEntry,reactNativeFacadeRoot)||!fs.existsSync(reactNativeEntry))throw new Error('RN facade main escapes its package or is absent');
  const renderer=fs.readFileSync(path.join(rendererRoot,'Libraries/Renderer/implementations/ReactFabric-dev.js'),'utf8');
  if(!renderer.includes(`version: "${expected.react}"`)&&!renderer.includes(`version: '${expected.react}'`))
    throw new Error('React does not match the compiled '+options.target+' Fabric renderer');
  return Object.freeze({target:options.target,runnerRoot,nodeModules,react:expected.react,reactNative:expected.rn,
    reactRoot,reactNativeRoot,reactNativeFacadeRoot,reactNativeEntry,framework:expected.framework??'react-native',frameworkVersion:expected.frameworkVersion??expected.rn,frameworkRoot});
}

/** Consumer runner tooling; SDK/runtime source never resolves a global cohort. */
function createRunnerConfig(options,overrides={}){
  if(options.javaScriptEngine!==undefined&&!['hermes','v8','jsc'].includes(options.javaScriptEngine))throw Error('Choose runner JavaScript engine hermes, v8 or jsc');
  if(['v8','jsc'].includes(options.javaScriptEngine)&&options.target!=='windows')throw Error('The native source compiler requires the Windows cohort');
  const cohort=inspectRunnerCohort(options),load=createRequire(path.join(cohort.runnerRoot,'package.json'));
  const {getDefaultConfig,mergeConfig}=load('@react-native/metro-config'),{FileStore}=load('metro-cache');
  const appRoot=fs.realpathSync(options.appRoot??cohort.runnerRoot);
  prepareAppAssetConfiguration(appRoot,cohort.runnerRoot);
  const packages={};
  for(const [name,root]of Object.entries(options.packageRoots??{})){
    if(!name.startsWith('@nelyx/'))throw new Error('Only explicit Nelyx source packages may be mapped: '+name);
    const directory=fs.realpathSync(root);
    if(JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8')).name!==name)throw new Error('Mapped package name mismatch: '+name);
    packages[name]=directory;
  }
  const extra={...overrides.resolver?.extraNodeModules,...packages,react:cohort.reactRoot,'react-native':cohort.reactNativeFacadeRoot,
    [cohort.framework]:cohort.frameworkRoot};
  const upstreamDefaults=getDefaultConfig(cohort.runnerRoot);
  // RNL is a selective overlay, not a complete react-native package. Compose
  // its installed resolver inside the owning-cohort guard below.
  const defaults=cohort.target==='linux'?load('@lucid-softworks/react-native-linux/metro').withLinuxRuntime(upstreamDefaults,cohort.runnerRoot):upstreamDefaults;
  const nativeSource=['v8','jsc'].includes(options.javaScriptEngine),nativeV8=path.join(__dirname,options.javaScriptEngine==='jsc'?'native-jsc-transformer.cjs':'native-v8-transformer.cjs');
  if(nativeSource&&overrides.transformer?.babelTransformerPath&&![defaults.transformer.babelTransformerPath,nativeV8].includes(overrides.transformer.babelTransformerPath))
    throw Error('Windows source engine owns the RN Babel transformer; configure custom Babel plugins in babel.config.cjs');
  const supplied=overrides.resolver?.blockList??defaults.resolver.blockList??[];
  // Metro must not watch atomically published native packages or its own
  // mutable output/cache trees. Windows native projects live beside runner/.
  const blockList=runnerOutputPaths({appRoot,target:cohort.target,blockList:supplied});
  const previous=overrides.resolver?.resolveRequest??defaults.resolver.resolveRequest;
  const beforeMain=overrides.serializer?.getModulesRunBeforeMainModule??defaults.serializer.getModulesRunBeforeMainModule;
  const initializeCore=path.join(cohort.reactNativeFacadeRoot,'Libraries/Core/InitializeCore.js');
  const upstreamInitializeCore=path.join(cohort.reactNativeRoot,'Libraries/Core/InitializeCore.js');
  const serializer=cohort.reactNativeFacadeRoot===cohort.reactNativeRoot?{}:{getModulesRunBeforeMainModule(entry){
    // Metro compares these absolute paths to the dependency graph directly;
    // resolveRequest cannot redirect RN's pre-main initializer to RNW/RN-macOS.
    // Running the facade only when Fabric is first required is too late for
    // AppRegistry's performance logger and other application initialization.
    return [...new Set([initializeCore,...beforeMain(entry).map(file=>path.relative(upstreamInitializeCore,file)===''?initializeCore:file)])];
  }};
  const nativeRoots={react:cohort.reactRoot,'react-native':cohort.reactNativeRoot,[cohort.framework]:cohort.frameworkRoot};
  const nativePackage=/\/node_modules\/(react|react-native(?:-windows|-macos)?|@lucid-softworks\/react-native-linux)(?=\/|$)/g;
  function dependencyPaths(origin) {
    const paths=[];let directory=origin?path.dirname(origin):cohort.runnerRoot;
    // npm may nest compatible dependencies inside the runner. Source aliases
    // outside that runner must never gain the repository's hierarchical roots.
    while(inside(directory,cohort.runnerRoot)) {
      const candidate=path.join(directory,'node_modules');
      if(path.basename(directory)!=='node_modules'&&inside(candidate,cohort.nodeModules))paths.push(candidate);
      const parent=path.dirname(directory);if(parent===directory)break;directory=parent;
    }
    return [...new Set([...paths,cohort.nodeModules])];
  }
  return mergeConfig(defaults,overrides,{
    projectRoot:cohort.runnerRoot,
    watchFolders:[...new Set([appRoot,cohort.runnerRoot,...Object.values(packages),...(overrides.watchFolders??[])])],
    cacheStores:[new FileStore({root:path.join(cohort.runnerRoot,'.metro-cache')})],
    serializer,
    ...(nativeSource?{transformer:{babelTransformerPath:nativeV8}}:{}),
    resolver:{blockList,disableHierarchicalLookup:true,nodeModulesPaths:[cohort.nodeModules],extraNodeModules:extra,
      resolveRequest(context,name,platform){
        if(platform&&platform!==cohort.target)throw new Error(`Runner target ${cohort.target} cannot resolve platform ${platform}`);
        const scoped={...context,disableHierarchicalLookup:true,nodeModulesPaths:dependencyPaths(context.originModulePath)};
        // A nested React/RN copy is never an alternate provider for this cohort.
        const anchor=name==='react'||name.startsWith('react/')?cohort.reactRoot:name==='react-native'||name.startsWith('react-native/')?cohort.reactNativeFacadeRoot:undefined;
        const request=name==='react-native'?cohort.reactNativeEntry:anchor?path.join(anchor,name.includes('/')?name.slice(name.indexOf('/')+1):'index.js'):name;
        const resolution=previous?previous(scoped,request,platform):context.resolveRequest(scoped,request,platform);
        if(resolution.type==='sourceFile') {
          const file=resolution.filePath.replaceAll('\\','/'),matches=[...file.matchAll(nativePackage)],nearest=matches.at(-1);
          if(nearest) {
            const actual=file.slice(0,nearest.index+nearest[0].length),expected=nativeRoots[nearest[1]];
            if(!expected||path.relative(expected,actual)!=='')throw new Error('RN/React module escaped the runner cohort: '+resolution.filePath);
          }
        }
        return resolution;
      }},
  });
}
/** Resolve shared app source types through the runner's actual public package exports. */
function createRunnerTypeScriptConfig(options) {
  const cohort=inspectRunnerCohort(options),load=createRequire(path.join(cohort.runnerRoot,'package.json')),paths={};
  for(const name of ['@nelyx/core','@nelyx/sdk']) {
    let directory=options.packageRoots?.[name];
    if(!directory) {
      directory=path.dirname(load.resolve(name+'/version'));
      while(inside(directory,cohort.runnerRoot)&&(!fs.existsSync(path.join(directory,'package.json'))||JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8')).name!==name))directory=path.dirname(directory);
      if(!inside(directory,cohort.nodeModules))throw new Error('Type package resolved outside runner: '+name);
    }
    directory=fs.realpathSync(directory);
    const manifest=JSON.parse(fs.readFileSync(path.join(directory,'package.json'),'utf8'));
    if(manifest.name!==name)throw new Error('Mapped type package name mismatch: '+name);
    for(const [subpath,entry]of Object.entries(manifest.exports)) {
      if(typeof entry!=='object'||typeof entry.types!=='string')continue;
      const file=path.resolve(directory,entry.types);
      if(!inside(file,directory)||!fs.existsSync(file))throw new Error('Missing public type entry: '+name+'/'+subpath);
      paths[name+subpath.slice(1)]=[path.relative(cohort.runnerRoot,file).replaceAll('\\','/')];
    }
  }
  const appRoot=fs.realpathSync(options.appRoot??cohort.runnerRoot);
  prepareAppAssetConfiguration(appRoot,cohort.runnerRoot);
  return {compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',jsx:'react-jsx',strict:true,noEmit:true,resolveJsonModule:true,allowImportingTsExtensions:true,skipLibCheck:true,lib:['ES2022','DOM'],types:['node'],baseUrl:'.',paths},include:['./**/*.ts','./**/*.tsx',path.relative(cohort.runnerRoot,path.join(appRoot,'src')).replaceAll('\\','/')+'/**/*.ts'],exclude:['node_modules']};
}
module.exports={inspectRunnerCohort,createRunnerConfig,createRunnerTypeScriptConfig};
