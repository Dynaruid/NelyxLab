import { finite, generation } from '../foundation/numbers.ts';
import { invariant } from '../foundation/errors.ts';
import {freezePaint} from './paint.ts';
import {freezePath} from './path.ts';
import {freezeRRect} from './rrect-data.ts';
import {paintEffectRecordCount} from './paint-effects-wire.ts';
import {resourceKey,copyResourceId,retainCommandResources,releaseCommandResources,ownFrameResources,releaseFrameResources,resourceOwner,canTransferCommandResources} from './resource-retention.ts';
export {resourceKey} from './resource-retention.ts';
import {GestureSettings} from './gesture-settings.ts';
import {isCapturedTransform} from './geometry.ts';
import type { FrameBuildToken, PaintCommand, PaintFrame, Rect, ResourceId, ViewMetrics, ViewOwner,ViewEnvironment } from "./types.ts";
import type {Canvas} from './canvas.ts';
export function sameOwner(a: ViewOwner, b: ViewOwner): boolean { return a.id === b.id && a.generation === b.generation; }
export function sameResource(a: ResourceId, b: ResourceId): boolean { return a.id === b.id && a.generation === b.generation; }
export function freezeEnvironment(environment:ViewEnvironment):ViewEnvironment {
  for(const key of ['top','right','bottom','left'] as const){if(!(finite(environment.safeArea[key],'safe area')>=0))invariant(false,'invalid-metrics','Negative safe area');}
  if(!(finite(environment.keyboardInset,'keyboard inset')>=0&&finite(environment.textScale,'text scale')>0))invariant(false,'invalid-metrics','Invalid environment geometry/scale');
  if(!(['native','css','application'].includes(environment.safeAreaSource)&&['native-ime','visual-viewport-occlusion','unavailable'].includes(environment.keyboardSource)))invariant(false,'invalid-metrics','Unknown environment source');
  if(!(environment.keyboardSource!=='unavailable'||environment.keyboardInset===0))invariant(false,'invalid-metrics','Unobserved keyboard inset must be zero');
  if(!(environment.textScaleSource===undefined||['native','application'].includes(environment.textScaleSource)))invariant(false,'invalid-metrics','Unknown text scale source');
  const settings=new GestureSettings(environment.gestureSettings),source=environment.gestureSettingsSource??(environment.gestureSettings?'application':'unavailable');
  for(const value of [settings.physicalTouchSlop,settings.physicalDoubleTapSlop]){if(!(value===null||finite(value,'physical gesture slop')>=0))invariant(false,'invalid-metrics','Invalid physical gesture slop');}
  if(!(['native','application','unavailable'].includes(source)))invariant(false,'invalid-metrics','Unknown gesture settings source');
  if(!(source!=='unavailable'||settings.physicalTouchSlop===null&&settings.physicalDoubleTapSlop===null))invariant(false,'invalid-metrics','Unavailable gesture settings cannot carry observed values');
  return Object.freeze({...environment,textScaleSource:environment.textScaleSource??'application',safeArea:Object.freeze({...environment.safeArea}),gestureSettings:settings,gestureSettingsSource:source});
}
export function captureMetrics(metrics: ViewMetrics): ViewMetrics {
  for (const key of ["logicalWidth", "logicalHeight", "physicalWidth", "physicalHeight", "scale"] as const) finite(metrics[key], key);
  if(!(metrics.logicalWidth >= 0 && metrics.logicalHeight >= 0 && metrics.physicalWidth >= 0 && metrics.physicalHeight >= 0 && metrics.scale > 0))invariant(false,"invalid-metrics","size must be nonnegative and scale positive");
  if(!(Number.isInteger(metrics.physicalWidth) && Number.isInteger(metrics.physicalHeight)))invariant(false,"invalid-metrics","physical size must be integral");
  generation(metrics.viewportGeneration); generation(metrics.rendererGeneration);
  if (metrics.nativeContextGeneration !== null) generation(metrics.nativeContextGeneration);
  if (metrics.nativeSurfaceGeneration !== null) generation(metrics.nativeSurfaceGeneration);
  return Object.freeze({...metrics,...(metrics.environment?{environment:freezeEnvironment(metrics.environment)}:{})});
}
function rect(value: Rect): Rect {
  const {x,y,width,height}=value;
  finite(x,'x');finite(y,'y');finite(width,'width');finite(height,'height');
  if(!(width >= 0 && height >= 0))invariant(false,"invalid-rect","negative size"); return Object.freeze({x,y,width,height});
}
function resource(value: ResourceId): ResourceId { generation(value.generation); if(!(value.id.length > 0))invariant(false,"invalid-resource","empty resource id"); return copyResourceId(value); }
export const paintFrameLimits=Object.freeze({commands:4096,bytes:512*1024,layers:32});
/** Expanded wire records, shared by picture batching and final frame admission. */
export function paintCommandRecordCount(command:PaintCommand):number {
  const pathRecords=command.op==='drawPath'||command.op==='clipPath'||command.op==='drawShadow'?command.path.operations.reduce((count,item)=>count+(item.verb==='addRRect'?2:1),0):0;
  return (command.op==='drawImageRect'||command.op==='drawImageNine'?3:command.op==='transform'&&command.matrix.length===16?3:command.op==='drawPath'||command.op==='drawShadow'?2+pathRecords:command.op==='clipPath'?1+pathRecords:(command.op==='drawRRect'||command.op==='clipRRect')&&'rrect'in command?'paint'in command?3:2:'paint'in command?2:1)+('paint'in command?paintEffectRecordCount(command.paint):0);
}
// Weak identity tags keep no matrices alive. Only our own immutable storage can
// reuse SkScalar validation; caller iterators and frozen arrays still snapshot.
const paintTransforms=new WeakSet<readonly number[]>();
/** Capture value arguments at recording time; frame admission revalidates untrusted commands. */
function freezePaintCommandValue(command:PaintCommand):PaintCommand {
  const point=(value:{readonly x:number;readonly y:number})=>Object.freeze({x:finite(value.x,'x'),y:finite(value.y,'y')});
  const clip=(value:{readonly clipOp:string;readonly doAntiAlias:boolean})=>{if(!(['intersect','difference'].includes(value.clipOp)&&typeof value.doAntiAlias==='boolean'))invariant(false,'invalid-clip','Unknown clip operation or anti-alias value');};
  switch(command.op){
    case 'clear':if(!(Number.isInteger(command.color)&&command.color>=0&&command.color<=0xffffffff))invariant(false,'invalid-color','ARGB must be uint32');return Object.freeze({...command});
    case 'save':case 'restore':return Object.freeze({...command});
    case 'drawPicture':return Object.freeze({...command,resource:resource(command.resource)});
    case 'transform':{
      // A stateful caller iterator must not supply different values after validation.
      let matrix=command.matrix;
      if(!paintTransforms.has(matrix)){
        if(!isCapturedTransform(matrix))matrix=Array.from(matrix);
        if(!(matrix.length===6||matrix.length===16))invariant(false,'invalid-transform','Transform needs six affine or sixteen column-major values');
        for(let index=0;index<matrix.length;index++){const value=matrix[index]!;finite(value,'matrix');if(!(Number.isFinite(Math.fround(value))))invariant(false,'invalid-transform','Matrix values must fit finite SkScalar');}
        Object.freeze(matrix);paintTransforms.add(matrix);
      }
      return Object.freeze({...command,matrix});
    }
    case 'clip':return Object.freeze({...command,rect:rect(command.rect)});
    case 'rect':case 'rrect':if(!(Number.isInteger(command.color)&&command.color>=0&&command.color<=0xffffffff))invariant(false,'invalid-color','ARGB must be uint32');if(command.op==='rrect'){if(!(finite(command.radius,'radius')>=0))invariant(false,'invalid-radius','negative radius');}return Object.freeze({...command,rect:rect(command.rect)});
    case 'image':return Object.freeze({...command,resource:resource(command.resource),rect:rect(command.rect)});
    case 'drawImageRect':return Object.freeze({...command,resource:resource(command.resource),src:rect(command.src),dst:rect(command.dst),paint:freezePaint(command.paint)});
    case 'drawImageNine':{const center=rect(command.center);if(!(Object.values(center).every(x=>Number.isSafeInteger(x)&&Math.abs(x)<=16777216)))invariant(false,'invalid-image-center','Nine-patch center must fit integer SkScalar coordinates');return Object.freeze({...command,resource:resource(command.resource),center,dst:rect(command.dst),paint:freezePaint(command.paint)});}
    case 'paragraph':finite(command.x,'x');finite(command.y,'y');return Object.freeze({...command,resource:resource(command.resource)});
    case 'drawRect':case 'drawOval':return Object.freeze({...command,rect:rect(command.rect),paint:freezePaint(command.paint)});
    case 'drawRRect':if('rrect'in command){if(!(!('rect'in command)&&!('radius'in command)))invariant(false,'invalid-rrect','Ambiguous rounded geometry');return Object.freeze({...command,rrect:freezeRRect(command.rrect),paint:freezePaint(command.paint)});}if(!(finite(command.radius,'radius')>=0))invariant(false,'invalid-radius','negative radius');return Object.freeze({...command,rect:rect(command.rect),paint:freezePaint(command.paint)});
    case 'drawLine':return Object.freeze({...command,from:point(command.from),to:point(command.to),paint:freezePaint(command.paint)});
    case 'saveLayer':return Object.freeze({...command,bounds:command.bounds===null?null:rect(command.bounds),paint:freezePaint(command.paint)});
    case 'saveBackdropFilter':return Object.freeze({...command,paint:freezePaint(command.paint)});
    case 'clipRect':clip(command);return Object.freeze({...command,rect:rect(command.rect)});
    case 'clipRRect':clip(command);if('rrect'in command){if(!(!('rect'in command)&&!('radius'in command)))invariant(false,'invalid-rrect','Ambiguous rounded geometry');return Object.freeze({...command,rrect:freezeRRect(command.rrect)});}if(!(finite(command.radius,'radius')>=0))invariant(false,'invalid-radius','negative radius');return Object.freeze({...command,rect:rect(command.rect)});
    case 'drawPath':return Object.freeze({...command,path:freezePath(command.path),paint:freezePaint(command.paint)});
    case 'drawPaint':return Object.freeze({...command,paint:freezePaint(command.paint)});
    case 'drawShadow':if(!(Number.isInteger(command.color)&&command.color>=0&&command.color<=0xffffffff))invariant(false,'invalid-color','ARGB must be uint32');if(!(finite(command.elevation,'elevation')>=0&&Number.isFinite(Math.fround(command.elevation))&&finite(command.devicePixelRatio,'devicePixelRatio')>0&&Math.fround(command.devicePixelRatio)>0&&Number.isFinite(Math.fround(command.devicePixelRatio))&&Number.isFinite(Math.fround(Math.fround(command.devicePixelRatio)*Math.fround(command.elevation)))&&typeof command.transparentOccluder==='boolean'))invariant(false,'invalid-shadow','Shadow elevation/DPR must fit SkScalar and the occluder flag must be boolean');return Object.freeze({...command,path:freezePath(command.path)});
    case 'clipPath':clip(command);return Object.freeze({...command,path:freezePath(command.path)});
    default:throw new Error(`unsupported paint command: ${String((command as {op:string}).op)}`);
  }
}
const capturedCommands=new WeakSet<PaintCommand>();
/** Internal identity check; freezing an external object alone does not validate its fields. */
export function isCapturedPaintCommand(command:PaintCommand):boolean{return capturedCommands.has(command);}
export function freezePaintCommand(command:PaintCommand):PaintCommand{return capturePaintCommand(command,true);}
function capturePaintCommand(command:PaintCommand,copyBindings:boolean):PaintCommand{
  // Only snapshots created here have deeply validated, immutable value fields.
  // Public resource copies keep independent IDs. Borrowed internal recordings
  // share sealed ID/style values and acquire their own command holds. Pure
  // values have no ownership sidecar and can be shared as a whole.
  let copy:PaintCommand;
  if(capturedCommands.has(command)){
    if(!('resource'in command)&&!('paint'in command&&command.paint.shader?.kind==='image'))return command;
    const next={...command};
    if(copyBindings&&'resource'in next)next.resource=resource(next.resource);
    if(copyBindings&&'paint'in next&&next.paint.shader?.kind==='image')next.paint=Object.freeze({...next.paint,shader:Object.freeze({...next.paint.shader,image:resource(next.paint.shader.image)})});
    copy=Object.freeze(next);
  }else copy=freezePaintCommandValue(command);
  retainCommandResources(copy);capturedCommands.add(copy);return copy;
}
/** Dispose a frozen frame that will not be admitted by a ResourceRegistry. */
export function disposeFrame(frame:PaintFrame):void{releaseFrameResources(frame.resources);}
/** Validate captured commands without copying them or acquiring resource holds. */
class PaintFrameAdmission {
  readonly resources=new Map<string,ResourceId>();
  private readonly stack:boolean[]=[];
  private layers=0;
  private records=0;
  estimatedBytes=96;
  constructor(length:number){if(!(Number.isSafeInteger(length)&&length>=0))invariant(false,'invalid-command-list','Paint command count must be a nonnegative safe integer');if(!(length<=paintFrameLimits.commands))invariant(false,'oversize','Paint command budget exceeded');}
  private addResource(value:ResourceId):void{
    const key=resourceKey(value),previous=this.resources.get(key),owner=resourceOwner(value),oldOwner=previous?resourceOwner(previous):null;
    if(!(oldOwner===null||owner===null||owner===oldOwner))invariant(false,'mixed-resource-owners','A frame cannot mix registries for the same resource ID');
    if(!previous||oldOwner===null)this.resources.set(key,value);
  }
  add(command:PaintCommand):void{
    if(command.op==='save'||command.op==='saveLayer'||command.op==='saveBackdropFilter'){
      const layer=command.op!=='save';this.stack.push(layer);if(layer){if(!(++this.layers<=paintFrameLimits.layers))invariant(false,'oversize','Layer nesting budget exceeded');}
    }else if(command.op==='restore'){
      if(!(this.stack.length>0))invariant(false,'unbalanced-save','restore without save');if(this.stack.pop())this.layers--;
    }
    if('resource'in command)this.addResource(command.resource);
    if('paint'in command&&command.paint.shader?.kind==='image')this.addResource(command.paint.shader.image);
    const expanded=paintCommandRecordCount(command);this.records+=expanded;this.estimatedBytes+=expanded*64;
    if(!(this.records<=paintFrameLimits.commands&&this.estimatedBytes+this.resources.size*32<=paintFrameLimits.bytes))invariant(false,'oversize','Serialized paint frame budget exceeded');
  }
  finish():void{
    if(!(this.stack.length===0))invariant(false,'unbalanced-save','unclosed save');this.estimatedBytes+=this.resources.size*32;
    if(!(this.records<=paintFrameLimits.commands&&this.estimatedBytes<=paintFrameLimits.bytes))invariant(false,'oversize','Serialized paint frame budget exceeded');
  }
}
/** Internal scene replay has already captured immutable command values through Canvas. */
export function validateCapturedPaintCommands(source:readonly PaintCommand[],start=0):void{
  const admission=new PaintFrameAdmission(source.length-start);for(let index=start;index<source.length;index++)admission.add(source[index]!);admission.finish();
}
export function freezeFrame(token: FrameBuildToken, source: readonly PaintCommand[]): PaintFrame {return captureFrame(token,source,'copy');}
/** @internal Keep independent command holds while sharing captured immutable
 * values/IDs. Raw commands still cross the complete validation boundary. */
export function captureBorrowedFrame(token:FrameBuildToken,source:readonly PaintCommand[]):PaintFrame{return captureFrame(token,source,'borrowed');}
/** One finished CPU recording and its resource holds. take transfers ownership
 * once to the matching View build; dispose cancels an unconsumed recording. */
export class FrameRecording {
  private constructor(private frame:PaintFrame|undefined,private token:FrameBuildToken|undefined){}
  static capture(token:FrameBuildToken,canvas:Canvas):FrameRecording{
    invariant(!canvas.debugDisposed,'closed-canvas','Cannot finish a closed Canvas');
    const errors:unknown[]=[];let frame:PaintFrame|undefined;
    try{frame=captureFrame(token,canvas.commands,'owned');}catch(error){errors.push(error);}
    try{canvas.dispose();}catch(error){errors.push(error);}
    if(errors.length){try{if(frame)disposeFrame(frame);}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];throw new AggregateError(errors,'Frame recording capture/retirement failed');}
    return new FrameRecording(frame,token);
  }
  get commands():readonly PaintCommand[]{invariant(this.frame,'closed-frame-recording','Frame recording has been consumed or disposed');return this.frame.commands;}
  get debugDisposed():boolean{return this.frame===undefined;}
  take(token:FrameBuildToken):PaintFrame{
    invariant(this.frame,'closed-frame-recording','Frame recording has been consumed or disposed');
    invariant(this.token===token,'foreign-frame-recording','Frame recording belongs to another View build token');
    const frame=this.frame;this.frame=undefined;this.token=undefined;return frame;
  }
  dispose():void{const frame=this.frame;this.frame=undefined;this.token=undefined;if(frame)disposeFrame(frame);}
}
export type SceneFrameSource=readonly PaintCommand[]|FrameRecording;
/** Public array scenes cross normal capture; completed recordings transfer their owned buffer. */
export function captureSceneFrame(token:FrameBuildToken,source:SceneFrameSource):PaintFrame{return source instanceof FrameRecording?source.take(token):freezeFrame(token,source);}
export function releaseSceneFrameSource(source:SceneFrameSource):void{if(source instanceof FrameRecording)source.dispose();else releaseCommandResources(source);}
function captureFrame(token: FrameBuildToken, source: readonly PaintCommand[],ownership:'copy'|'borrowed'|'owned'): PaintFrame {
 const captured:PaintCommand[]=[],errors:unknown[]=[];let result:PaintFrame|undefined;try{
  generation(token.owner.generation); generation(token.sequence); if(!(token.owner.id.length > 0))invariant(false,"invalid-owner","empty owner");
  if(token.inputSequence!==undefined){if(!(Number.isSafeInteger(token.inputSequence)&&token.inputSequence>=0))invariant(false,'invalid-input-sequence','Frame input sequence must be a nonnegative safe integer');}
  if(token.inputTimestamp!==undefined)finite(token.inputTimestamp,'input timestamp');
  if(token.timing){if(!(Object.values(token.timing).every(Number.isFinite)&&token.timing.queueDelay>=0&&token.timing.clockUncertainty>=0))invariant(false,'invalid-frame-timing','Frame timing must retain finite observed clock values');}
   const length=source.length,admission=new PaintFrameAdmission(length);captured.length=length;
   // The rollback list is also the final command list. Reserve it once rather
   // than growing a second list alongside Array.map's equally large output.
   for(let index=0;index<length;index++){if(!(index in source))invariant(false,'invalid-command-list','Paint command list must not contain holes');const command=source[index]!,copy=ownership==='owned'&&capturedCommands.has(command)&&canTransferCommandResources(command)?command:capturePaintCommand(command,ownership!=='borrowed');captured[index]=copy;admission.add(copy);}admission.finish();
   result=Object.freeze({token:Object.freeze({owner:Object.freeze({...token.owner}),metrics:captureMetrics(token.metrics),sequence:token.sequence,...(token.inputSequence!==undefined?{inputSequence:token.inputSequence}:{}),...(token.inputTimestamp!==undefined?{inputTimestamp:token.inputTimestamp}:{}),...(token.timing?{timing:Object.freeze({...token.timing})}:{})}),commands:Object.freeze(captured),resources:Object.freeze([...admission.resources.values()]),estimatedBytes:admission.estimatedBytes});ownFrameResources(result.resources,captured);
 }catch(error){errors.push(error);try{releaseCommandResources(captured);}catch(cleanup){errors.push(cleanup);}}
 if(ownership!=='borrowed')try{releaseCommandResources(source);}catch(cleanup){errors.push(cleanup);}if(errors.length){if(result)try{disposeFrame(result);}catch(cleanup){errors.push(cleanup);}if(errors.length===1)throw errors[0];throw new AggregateError(errors,'Frame capture and rollback failed');}return result!;
}
export function isCurrent(frame: PaintFrame, owner: ViewOwner, metrics: ViewMetrics): boolean {
  const m = frame.token.metrics;
  return sameOwner(frame.token.owner, owner) && m.viewportGeneration === metrics.viewportGeneration && m.rendererGeneration === metrics.rendererGeneration && m.nativeContextGeneration === metrics.nativeContextGeneration && m.nativeSurfaceGeneration === metrics.nativeSurfaceGeneration;
}
