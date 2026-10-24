// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const path=require('node:path');
const {createRequire}=require('node:module');

// Native engines share RN Flow/TS/JSX/module ownership and ES2022 classes.
// The qualified Static Hermes pin needs RN async-generator and block-scope
// lowering. TDZ checks stay enabled; raw loop captures are not sound in this pin.
module.exports=(api,options)=>{
  const load=createRequire(path.join(options.projectRoot,'package.json'));
  if(load('@react-native/babel-preset/package.json').version!=='0.83.10')throw Error('Native ES2022 requires the pinned RN0.83.10 preset');
  const preset=load('@react-native/babel-preset'),presetLoad=createRequire(load.resolve('@react-native/babel-preset/package.json'));
  const allNativeFeatureNames=['private-methods','private-property-in-object','arrow-functions','spread',
    'computed-properties','parameters','shorthand-properties','optional-catch-binding','function-name','literals','numeric-separator','sticky-regex',
    'destructuring','object-rest-spread','async-generator-functions','async-to-generator','optional-chaining','nullish-coalescing-operator','logical-assignment-operators','block-scoping'];
  const nativeFeatureNames=allNativeFeatureNames.filter(name=>options.nativeJavaScriptEngine!=='hermes'||name!=='async-generator-functions');
  const nativeFeatures=new Set(nativeFeatureNames.map(name=>presetLoad('@babel/plugin-transform-'+name)));
  const value=preset(api,{...options,unstable_transformProfile:'default',customTransformOptions:{...options.customTransformOptions,unstable_preserveClasses:true}});
  let removed=0;
  const blockScoping=presetLoad('@babel/plugin-transform-block-scoping');
  const retain=entries=>entries?.filter(entry=>{if(nativeFeatures.has(Array.isArray(entry)?entry[0]:entry)){removed++;return false;}return true;}).map(entry=>{
    if(options.nativeJavaScriptEngine==='hermes'&&(Array.isArray(entry)?entry[0]:entry)===blockScoping)return [blockScoping,{...(Array.isArray(entry)?entry[1]:{}),tdz:true},...(Array.isArray(entry)?entry.slice(2):[])];
    return entry;
  });
  const result={...value,plugins:retain(value.plugins),overrides:value.overrides?.map(override=>({...override,plugins:retain(override.plugins)}))};
  if(removed!==nativeFeatureNames.length)throw Error('Pinned RN native ES2022 feature policy changed: '+removed+'/'+nativeFeatureNames.length);
  return result;
};
