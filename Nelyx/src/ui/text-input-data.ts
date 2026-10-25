// SPDX-License-Identifier: BSD-3-Clause
// Shared data schema; validation alone does not establish engine ownership.
type DataCheck=(value:unknown)=>boolean;
interface DataSchema {readonly fields:ReadonlySet<string>;readonly children:Readonly<Record<string,DataCheck>>|undefined;readonly invalid:object}
// JSON omits callbacks, symbols and hidden class state. They must not acquire
// an idle cache owner whose byte charge only measures the serialized data.
// Cache the static schema token itself. Each new immutable descriptor need not
// allocate another {tag,valid} object merely to remember this check's result.
const dataChecks=new WeakMap<object,object>();
const invalidArrayChecks=new WeakMap<DataCheck,object>();
const capturedRecords=new WeakSet<object>();
const capturedArrays=new WeakSet<readonly unknown[]>();
/** @internal Only object literals just constructed by the text capture owners.
 * Never register caller objects, frozen proxies or records with accessors. */
export function markCapturedTextRecord(value:object):void{capturedRecords.add(value);}
export function isCapturedTextRecord(value:object):boolean{return capturedRecords.has(value);}
/** @internal Only array literals constructed by text capture owners. */
export function captureTextArray<T>(value:readonly T[]):readonly T[]{Object.freeze(value);capturedArrays.add(value);return value;}
export function isCapturedTextArray(value:readonly unknown[]):boolean{return capturedArrays.has(value);}
function schema(fields:string,children?:Readonly<Record<string,DataCheck>>):DataSchema{return {fields:new Set(fields.split(' ')),children,invalid:{}};}
function recordData(value:unknown,shape:DataSchema):boolean{
  if(value===undefined)return true;
  if(value===null||typeof value!=='object'||!Object.isFrozen(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
  const known=dataChecks.get(value);if(known===shape)return true;if(known===shape.invalid)return false;
  const captured=capturedRecords.has(value);
  let valid=true;
  for(const key of Reflect.ownKeys(value)){
    if(typeof key!=='string'||!shape.fields.has(key)){valid=false;break;}
    let item:unknown;
    if(captured)item=(value as Record<string,unknown>)[key];
    else{const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!('value'in descriptor)){valid=false;break;}item=descriptor.value;}
    const child=shape.children?.[key];
    if(child){if(!child(item)){valid=false;break;}}
    else if(item!==null&&typeof item==='object'||typeof item==='function'||typeof item==='symbol'){valid=false;break;}
  }
  dataChecks.set(value,valid?shape:shape.invalid);return valid;
}
function arrayData(value:unknown,check:DataCheck):boolean{
  if(value===undefined)return true;
  if(!Array.isArray(value)||!Object.isFrozen(value)||Object.getPrototypeOf(value)!==Array.prototype)return false;
  const known=dataChecks.get(value);if(known===check)return true;if(known!==undefined&&known===invalidArrayChecks.get(check))return false;
  const captured=capturedArrays.has(value);let valid=captured||Reflect.ownKeys(value).length===value.length+1;
  for(let i=0;valid&&i<value.length;i++){if(captured)valid=check(value[i]);else{const descriptor=Object.getOwnPropertyDescriptor(value,String(i));valid=!!descriptor&&'value'in descriptor&&check(descriptor.value);}}
  if(valid)dataChecks.set(value,check);else{let invalid=invalidArrayChecks.get(check);if(invalid===undefined){invalid={};invalidArrayChecks.set(check,invalid);}dataChecks.set(value,invalid);}return valid;
}
const stringData:DataCheck=value=>typeof value==='string',noPaintData:DataCheck=value=>value===undefined;
const stringsData:DataCheck=value=>arrayData(value,stringData);
const resourceShape=schema('id generation'),offsetShape=schema('x y');
const featureShape=schema('name value'),variationShape=schema('axis value');
const featureData:DataCheck=value=>recordData(value,featureShape),variationData:DataCheck=value=>recordData(value,variationShape);
const shadowShape=schema('color offset blurSigma',{offset:value=>recordData(value,offsetShape)}),shadowData:DataCheck=value=>recordData(value,shadowShape);
const styleShape=schema('color backgroundColor fontFamilies fontSize fontWeight fontStyle letterSpacing wordSpacing height leadingDistribution locale decoration decorationColor decorationThickness decorationStyle fontFeatures fontVariations shadows textBaseline foreground background',{
  fontFamilies:stringsData,fontFeatures:value=>arrayData(value,featureData),fontVariations:value=>arrayData(value,variationData),shadows:value=>arrayData(value,shadowData),foreground:noPaintData,background:noPaintData,
});
const styleData:DataCheck=value=>recordData(value,styleShape);
const runShape=schema('start end style',{style:styleData}),runData:DataCheck=value=>recordData(value,runShape);
const placeholderShape=schema('offset width height alignment baseline baselineOffset'),placeholderData:DataCheck=value=>recordData(value,placeholderShape);
const strutShape=schema('fontFamilies fontSize fontWeight fontStyle height leading leadingDistribution forceStrutHeight',{fontFamilies:stringsData});
const heightShape=schema('applyHeightToFirstAscent applyHeightToLastDescent leadingDistribution');
const inputShape=schema('text width font fontSize locale direction scale textScale color maxLines ellipsis unlimitedLines hyphens textAlign style runs placeholders strutStyle textHeightBehavior',{
  font:value=>recordData(value,resourceShape),style:styleData,runs:value=>arrayData(value,runData),placeholders:value=>arrayData(value,placeholderData),strutStyle:value=>recordData(value,strutShape),textHeightBehavior:value=>recordData(value,heightShape),
});
export function textInputSerializationIsPlain():boolean{return !('toJSON' in Object.prototype)&&!('toJSON' in Array.prototype);}
export function isCacheableTextInput(value:unknown):boolean{return textInputSerializationIsPlain()&&recordData(value,inputShape);}
