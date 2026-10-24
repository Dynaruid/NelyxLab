// SPDX-License-Identifier: BSD-3-Clause
'use strict';
const fs=require('node:fs'),{createHash}=require('node:crypto');
const upstream=require('metro-transform-worker');
module.exports.getCacheKey=(config,options)=>createHash('sha256').update(fs.readFileSync(__filename)).update(upstream.getCacheKey(config,options)).digest('hex');
module.exports.transform=async(config,projectRoot,filename,data,options)=>{
  const transformer=require(config.babelTransformerPath);
  if(typeof transformer.withEvidence!=='function')throw Error('Native AOT worker requires its owning typed transformer');
  const {result,evidence}=await transformer.withEvidence(()=>upstream.transform(config,projectRoot,filename,data,options));
  if(evidence){
    const outputs=result.output.filter(output=>output.type.startsWith('js/'));
    if(outputs.length!==1)throw Error('Native AOT evidence requires one JS output');
    outputs[0].data.nelyxNativeEvidence=evidence;
  }else if(!filename.endsWith('.json')&&options.type!=='asset')throw Error('Native AOT worker did not capture frontend evidence: '+filename);
  return result;
};
