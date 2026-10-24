// SPDX-License-Identifier: BSD-3-Clause
/** Internal proof for SDK-owned static RNW containers. Unknown native effects
 * cannot be mapped using LayoutMetrics; Core transforms stay inside Skia. */
const layout=new Set(['flex','flexGrow','flexShrink','flexBasis','flexDirection','flexWrap','alignItems','alignSelf','alignContent','justifyContent','position','top','right','bottom','left','start','end','width','height','minWidth','minHeight','maxWidth','maxHeight','aspectRatio','direction','gap','rowGap','columnGap','margin','marginTop','marginRight','marginBottom','marginLeft','marginStart','marginEnd','marginHorizontal','marginVertical','padding','paddingTop','paddingRight','paddingBottom','paddingLeft','paddingStart','paddingEnd','paddingHorizontal','paddingVertical','backgroundColor','zIndex']);
export function windowsInputSurfaceId(owner:{readonly id:string;readonly generation:number}):string{return `nelyx:input-skia:v1:${owner.generation}:${owner.id}`;}
export function windowsSurfaceEnvelope(style:Readonly<Record<string,string|number|boolean|undefined>>|undefined):string|undefined {
  for(const [key,value]of Object.entries(style??{}))if(value!==undefined&&!layout.has(key)&&!(key==='overflow'&&(value==='visible'||value==='hidden'))&&!(key==='opacity'&&value===1)&&!(key==='display'&&(value==='flex'||value==='none')))return undefined;
  return style?.display==='none'?'nelyx:input-envelope:v1:hidden':style?.overflow==='hidden'?'nelyx:input-envelope:v1:clip':'nelyx:input-envelope:v1:visible';
}
