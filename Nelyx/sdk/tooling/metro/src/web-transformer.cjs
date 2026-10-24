'use strict';
const babel=require('@babel/core');
const {createHash}=require('node:crypto');
module.exports.transform=({src,filename,options})=>{
  // Metro 0.83 passes dev to Babel transformers; its hot option is only passed
  // to getTransformOptions. Editable app and SDK components need signatures.
  const normalized=filename.replaceAll('\\','/'),refresh=options.dev&&(!normalized.includes('/node_modules/')||normalized.includes('/node_modules/@nelyx/sdk/'));
  // Metro's browser fallback calls location.reload directly. Route its pinned
  // development module system through the SDK close ACK before navigation.
  if(options.dev&&normalized.endsWith('/metro-runtime/src/polyfills/require.js')){
    const original=src.replaceAll('\r\n','\n'),anchor='const performFullRefresh = (reason, modules) => {';
    if(createHash('sha256').update(original).digest('hex')!=='95bda41a2332b06fc9b000761e96ca745dcfc127a4ab2d7e194696b8baca9a05'||original.split(anchor).length!==2)throw Error('Web Metro module-system source differs from pinned 0.83.8');
    src=original.replace(anchor,anchor+'\n    const owner = requireRefresh();\n    if (owner != null && typeof owner.performFullRefresh === "function") {\n      owner.performFullRefresh(reason);\n      return;\n    }');
  }
  const environment=({types:t})=>({visitor:{MemberExpression(path){const node=path.node;if(t.isIdentifier(node.property,{name:'NODE_ENV'})&&t.isMemberExpression(node.object)&&t.isIdentifier(node.object.object,{name:'process'})&&t.isIdentifier(node.object.property,{name:'env'}))path.replaceWith(t.stringLiteral(options.dev?'development':'production'));}}});
  // Babel preserves named imports as module-property reads. Metro's experimental
  // ESM lowering snapshots named values before circular modules finish loading.
  const result=babel.transformSync(src,{filename,ast:true,code:false,babelrc:false,configFile:false,envName:options.dev?'development':'production',sourceType:'unambiguous',plugins:[[require('@babel/plugin-transform-typescript'),{allExtensions:true,isTSX:/\.tsx$/.test(filename)}],[require('@babel/plugin-transform-react-jsx'),{runtime:'automatic'}],environment,...(refresh?[require('react-refresh/babel')]:[]),[require('@babel/plugin-transform-modules-commonjs'),{loose:false}]]});
  return {ast:result.ast};
};
