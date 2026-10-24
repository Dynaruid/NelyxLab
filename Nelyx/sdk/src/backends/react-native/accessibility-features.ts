// SPDX-License-Identifier: BSD-3-Clause
import type {PlatformAccessibility} from '@nelyx/core/services/binding';
import {PlatformException} from '@nelyx/core/services/message-codec';

/** Nelyx OS snapshot contract, independent of reader availability on Windows. */
export function readNativeAccessibilityFeatures(module:unknown,target:string):PlatformAccessibility|undefined {
  if(target!=='android'&&target!=='windows')return undefined;
  const port=module as {getAccessibilityFeatures?:()=>unknown}|undefined;
  if(typeof port?.getAccessibilityFeatures!=='function')throw new PlatformException({code:'native-accessibility-cohort',message:'Accessibility preferences require matching rebuilt SDK native sources'});
  const snapshot=port.getAccessibilityFeatures();
  if(!snapshot||typeof snapshot!=='object')throw new TypeError('Invalid native accessibility snapshot');
  const value=snapshot as Record<string,unknown>;
  if(value.error!==undefined)throw new PlatformException({code:'platform-error',message:String(value.error)});
  const {features,supportedFeatures,semanticsEnabled}=value,mask=target==='android'?1|4|16:4|16|32;
  if(value.protocol!==1||!Number.isSafeInteger(features)||(features as number)<0||supportedFeatures!==mask||
    (BigInt(features as number)&~BigInt(mask))!==0n||
    (target==='android'?typeof semanticsEnabled!=='boolean':semanticsEnabled!==null))throw new TypeError('Invalid native accessibility protocol, mask or reader policy');
  return Object.freeze({features:features as number,supportedFeatures:mask,semanticsEnabled:semanticsEnabled as boolean|null,source:'native',observation:'poll'});
}
