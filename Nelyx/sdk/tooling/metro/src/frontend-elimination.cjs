// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const path=require('node:path'),{createHash}=require('node:crypto'),{createRequire}=require('node:module');
const hash=value=>createHash('sha256').update(value).digest('hex');
const kinds=new Set(['FunctionDeclaration','FunctionExpression','ArrowFunctionExpression','ClassMethod','ObjectMethod','ClassDeclaration','ClassExpression','ClassProperty','ClassPrivateProperty','StaticBlock']);
/** Replay the pinned Metro release elimination solely as provenance. The real
 * worker still owns its normal inline-require/wrapping/optimization passes.
 * A removed source range is used only if it also has no emitted counterpart. */
module.exports=(ast,src,filename,options)=>{
  const load=createRequire(path.join(options.projectRoot,'package.json'));
  if(load('metro-transform-plugins/package.json').version!=='0.83.8')throw Error('Native elimination requires pinned Metro transform plugins');
  const babel=load('@babel/core'),plugins=load('metro-transform-plugins');
  const collect=node=>{const values=new Map();const visit=node=>{if(!node||typeof node!=='object')return;if(kinds.has(node.type)&&node.loc){const range={kind:node.type,start:node.loc.start,end:node.loc.end};values.set(JSON.stringify(range),range);}for(const [key,value]of Object.entries(node))if(!['loc','comments','tokens','extra'].includes(key)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}};visit(node);return values;};
  const before=collect(ast);
  const config={ast:true,code:false,configFile:false,babelrc:false,cloneInputAst:true,filename};
  const inlined=babel.transformFromAstSync(ast,src,{...config,plugins:[[plugins.inlinePlugin,{dev:false,inlinePlatform:options.inlinePlatform,isWrapped:false,platform:options.platform}]]});
  const folded=babel.transformFromAstSync(inlined.ast,src,{...config,plugins:[plugins.constantFoldingPlugin]});
  const after=collect(folded.ast),removed=[...before].filter(([key])=>!after.has(key)).map(([,range])=>range);
  const record={schema:'nelyx.metro-elimination/v1',sourceSha256:hash(src),policy:'metro-0.83.8-release-replay',removed};
  return record;
};
