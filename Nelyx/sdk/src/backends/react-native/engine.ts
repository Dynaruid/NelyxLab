// SPDX-License-Identifier: BSD-3-Clause
import type {ProviderCohort} from '../../runtime/cohorts.ts';

export interface HermesRuntimeIdentity {
  readonly releaseVersion:string;
  readonly bytecodeVersion:number;
}
export interface V8RuntimeIdentity {readonly engine:'v8';readonly releaseVersion:string;readonly revision:string;readonly description:string}
export interface JscRuntimeIdentity {readonly engine:'jsc';readonly releaseVersion:string;readonly revision:string;readonly description:string;readonly mode:'jit'|'interpreter';readonly jitEnabled:boolean}
export function readJscRuntimeIdentity():JscRuntimeIdentity|undefined {
  const value=(globalThis as unknown as {__nelyxJscRuntimeIdentity?:JscRuntimeIdentity}).__nelyxJscRuntimeIdentity;
  if(value?.engine!=='jsc'||typeof value.releaseVersion!=='string'||typeof value.revision!=='string'||typeof value.description!=='string'||!value.description.includes('JSCRuntime')||!['jit','interpreter'].includes(value.mode)||value.jitEnabled!==(value.mode==='jit'))return undefined;
  return Object.freeze({...value});
}
export function readV8RuntimeIdentity():V8RuntimeIdentity|undefined {
  const value=(globalThis as unknown as {__nelyxV8RuntimeIdentity?:V8RuntimeIdentity}).__nelyxV8RuntimeIdentity;
  if(value?.engine!=='v8'||typeof value.releaseVersion!=='string'||typeof value.revision!=='string'||typeof value.description!=='string'||!value.description.includes('V8'))return undefined;
  return Object.freeze({...value});
}
export function validateNativeRuntimeIdentity(cohort:ProviderCohort,identity:HermesRuntimeIdentity|V8RuntimeIdentity|JscRuntimeIdentity|undefined):void {
  if(cohort.engine==='v8'){
    if(!identity||!('engine' in identity)||identity.engine!=='v8'||identity.releaseVersion!==cohort.engineVersion||identity.revision!==cohort.engineRevision)throw new Error('Owning V8 runtime identity differs from the selected cohort');
  }else if(cohort.engine==='jsc'){
    if(!identity||!('engine' in identity)||identity.engine!=='jsc'||identity.releaseVersion!==cohort.engineVersion||identity.revision!==cohort.engineRevision||!['jit','interpreter'].includes(identity.mode)||identity.jitEnabled!==(identity.mode==='jit'))throw new Error('Owning JSC runtime identity differs from the selected cohort');
  }else validateHermesRuntimeIdentity(cohort,identity&&'bytecodeVersion' in identity?identity:undefined);
}
/** Read the owning VM, independently of installed compiler package versions. */
export function readHermesRuntimeIdentity():HermesRuntimeIdentity|undefined {
  const engine=(globalThis as unknown as {HermesInternal?:{getRuntimeProperties?():unknown}}).HermesInternal;
  if(typeof engine?.getRuntimeProperties!=='function')return undefined;
  const value=engine.getRuntimeProperties();
  if(!value||typeof value!=='object')return undefined;
  const properties=value as Record<string,unknown>,release=properties['OSS Release Version'],bytecode=properties['Bytecode Version'];
  if(typeof release!=='string'||!release||!Number.isSafeInteger(bytecode)||(bytecode as number)<1)return undefined;
  return Object.freeze({releaseVersion:release,bytecodeVersion:bytecode as number});
}
/** Engine mismatches reject before installing native Skia or publishing assets. */
export function validateHermesRuntimeIdentity(cohort:ProviderCohort,identity:HermesRuntimeIdentity|undefined):void {
  if(!identity)throw new Error('Owning Hermes runtime identity is unavailable');
  if(identity.releaseVersion!==cohort.engineVersion)throw new Error(`Incompatible Hermes release: ${identity.releaseVersion}; requires ${cohort.engineVersion}`);
  if(identity.bytecodeVersion!==cohort.bytecodeVersion)throw new Error(`Incompatible Hermes bytecode: ${identity.bytecodeVersion}; requires ${cohort.bytecodeVersion}`);
}
