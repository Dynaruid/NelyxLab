// SPDX-License-Identifier: BSD-3-Clause
import {Scrollable,ScrollableState} from './scrollable.ts';
import type {ScrollableOptions} from './scrollable.ts';
import type {EnsureVisibleOptions} from './scroll-position.ts';
import type {ScrollPosition} from './scroll-position.ts';
import {StatefulWidget,InheritedWidget,State,Element} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
import type {RenderObject} from '../rendering/object.ts';
import type {Key} from '../../foundation/key.ts';
import {GlobalKey} from './global-key.ts';
import {DartMap} from '../../foundation/dart-collections.ts';
import type {DartRecord} from '../../foundation/dart-record.ts';
import {dartRecordRead} from '../../foundation/dart-record.ts';
import {GestureRecognizerFactory,GestureRecognizerFactoryWithHandlers} from './raw-gesture-detector.ts';
import type {GestureRecognizerType,RawGestureDetectorState,GestureRecognizerFactories} from './raw-gesture-detector.ts';
import {GestureRecognizer} from '../gestures/recognizer.ts';
import {PanGestureRecognizer} from '../gestures/monodrag.ts';
import type {PointerDeviceKind} from '../../ui/pointer.ts';
import {Axis} from '../painting/basic-types.ts';
import {invariant} from '../../foundation/errors.ts';

export class DiagonalDragBehavior{
  static readonly none=new DiagonalDragBehavior(0,'none');static readonly weightedEvent=new DiagonalDragBehavior(1,'weightedEvent');static readonly weightedContinuous=new DiagonalDragBehavior(2,'weightedContinuous');static readonly free=new DiagonalDragBehavior(3,'free');
  private constructor(readonly index:number,readonly name:string){Object.freeze(this);}toString():string{return 'DiagonalDragBehavior.'+this.name;}
}
export type SourceMutableList<T>=T[];
export type SourceFuture<T>=Promise<T>;
export type SourceGestureType=GestureRecognizerType;
type Factories=DartMap<SourceGestureType,GestureRecognizerFactory>;
const keyPolicy={accepts:(v:unknown):v is SourceGestureType=>typeof v==='function'&&(v===GestureRecognizer||v.prototype instanceof GestureRecognizer),hash:(v:unknown)=>v,equals:(a:SourceGestureType,b:unknown)=>a===b};
export function createSourceGestureFactories():Factories{return new DartMap(keyPolicy,(v):v is GestureRecognizerFactory=>v instanceof GestureRecognizerFactory);}
const emptyFactories=createSourceGestureFactories().freeze();
export function emptySourceGestureFactories():Factories{return emptyFactories;}
function nativeFactories(values:Factories):GestureRecognizerFactories{return new Map([...values.keys].map(key=>[key,values.get(key)!]));}
export function replaceSourceGestureRecognizers(state:RawGestureDetectorState,values:Factories):void{state.replaceGestureRecognizers(nativeFactories(values));}
export function createSourcePan(owner:State,options:{supportedDevices?:Set<PointerDeviceKind>|null}={}):PanGestureRecognizer{
  const context=owner.context;invariant(context instanceof Element,'invalid-two-axis-gesture-owner','Pan recognizer requires its live Element owner');return new PanGestureRecognizer({...options,binding:context.owner.gestureBinding});
}
export function createSourcePanFactory(create:()=>PanGestureRecognizer,initialize:(recognizer:PanGestureRecognizer)=>void):GestureRecognizerFactoryWithHandlers<PanGestureRecognizer>{return new GestureRecognizerFactoryWithHandlers(PanGestureRecognizer,create,initialize);}
export function createSourceScrollableKey():GlobalKey<ScrollableState>{return new GlobalKey(undefined,ScrollableState);}
export function sourceCurrentScrollable<S extends State>(key:GlobalKey<S>):S|null{return key.currentState??null;}
export function sourceCurrentGestureDetector(key:GlobalKey<RawGestureDetectorState>):RawGestureDetectorState|null{return key.currentState??null;}
export abstract class TwoAxisStatefulHost extends StatefulWidget{constructor({key=null}:{key?:Key|null}={}){super(key);}}
export abstract class TwoAxisInheritedHost extends InheritedWidget{constructor({child}:{child:Widget}){super(child);}}
export class TwoAxisScrollableHost extends Scrollable{constructor(options:ScrollableOptions){super(options);}}
interface RevealSnapshot{positions:Map<ScrollableState,ScrollPosition>;contexts:Map<ScrollPosition,BuildContext>}
let revealing:RevealSnapshot|null=null;
export function twoAxisSourcePosition(state:ScrollableState):ScrollPosition{return revealing?.positions.get(state)??state.position;}
export function twoAxisEnsureVisible(position:ScrollPosition,target:RenderObject,options:EnsureVisibleOptions={}):Promise<void>{
  // Position.context is a State that may already be detached by the first
  // axis's callback. Read the captured Element instead of that stale getter.
  const context=revealing?.contexts.get(position);
  if(context&&!context.mounted)return Promise.resolve();
  return position.ensureVisible(target,options);
}
/** Finite facade compatibility: keep existing x/y bucket names within its grid.
 * Direct source APIs retain the original Flutter role names. */
export class TwoAxisRestorationNames extends InheritedWidget{
  constructor(child:Widget){super(child);}
  updateShouldNotify():boolean{return false;}
}
export abstract class TwoAxisScrollableStateHost extends ScrollableState{
  protected override get restorationId():string|null{
    const original=super.restorationId;
    if(!this.context.maybeDependOn(TwoAxisRestorationNames))return original;
    return original==='OuterVerticalTwoDimensionalScrollable'?'y':original==='InnerHorizontalTwoDimensionalScrollable'?'x':original;
  }

  abstract sourcePerformEnsureVisible(target:RenderObject,options?:EnsureVisibleOptions):DartRecord<readonly[Promise<void>[],ScrollableState]>;
  get sourcePosition():ScrollPosition{return twoAxisSourcePosition(this);}
  override performEnsureVisible(target:RenderObject,options:EnsureVisibleOptions={}):readonly[readonly Promise<void>[],ScrollableState]{
    const context=this.context,outer=Scrollable.maybeOf(context,{axis:Axis.vertical}),snapshot:RevealSnapshot={positions:new Map(),contexts:new Map()};
    for(const state of new Set([this,...outer?[outer]:[]])){const position=state.position;snapshot.positions.set(state,position);snapshot.contexts.set(position,state.context);}
    const previous=revealing;revealing=snapshot;
    try{const result=this.sourcePerformEnsureVisible(target,options);return [dartRecordRead(result,0,2),dartRecordRead(result,1,2)];}finally{revealing=previous;}
  }
  get sourceGestureRecognizers():Factories{const result=createSourceGestureFactories();for(const[key,value]of this.recognizers)result.set(key,value);return result;}
  set sourceGestureRecognizers(value:Factories){this.recognizers=nativeFactories(value);}
  get sourceConfiguration(){return this.scrollConfiguration;}
  get sourcePhysics(){return this.physics;}
  get sourceGestureSettings(){return this.mediaGestureSettings;}
  get sourceGestureKey(){return this.gestureKey;}
  get sourceEffectiveController(){return this.effectiveController;}
  set sourceLastCanDrag(value:boolean|null){this.lastCanDrag=value;}
  set sourceLastAxis(value:Axis|null){this.lastAxis=value;}
}
export function sourceObjectString(value:{}|null):string{return value===null?'null':value.toString();}
