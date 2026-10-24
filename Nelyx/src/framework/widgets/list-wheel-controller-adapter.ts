// SPDX-License-Identifier: BSD-3-Clause
// Explicit collection/Future and constructor boundaries for the pinned controller.
import {invariant} from '../../foundation/errors.ts';
import {ScrollController} from './scroll-controller.ts';
import type {ScrollControllerOptions} from './scroll-controller.ts';
import {ChangeNotifier} from '../../foundation/notifier.ts';
import type {ScrollPosition} from './scroll-position.ts';
import type {ScrollPhysics} from './scroll-physics.ts';
import type {ScrollContext} from './scroll-context.ts';
import {WheelPosition,castWheelPosition} from './list-wheel-physics-adapter.ts';
import {_getItemFromOffset} from './list-wheel-physics.generated.ts';
import {GeneratedFixedExtentScrollPosition} from './list-wheel-position.generated.ts';
import {bindWheelContext,wheelContextItemExtent} from './list-wheel-position-adapter.ts';
export type HostFuture<T>=Promise<T>;
/** Positions keep Dart growable-list iteration's length check and live index reads. */
export class WheelPositions implements Iterable<ScrollPosition> {
  constructor(private readonly current:()=>readonly ScrollPosition[]){}
  get length():number{return this.current().length;}
  get isNotEmpty():boolean{return this.length!==0;}
  *[Symbol.iterator]():Iterator<ScrollPosition>{const length=this.length;let index=0;for(;;){const values=this.current();invariant(values.length===length,'modified-wheel-positions','Wheel attachments changed during iteration');if(index===length)return;const value=values[index++]!;yield value;
    // A synchronous View close can retire the yielded position and detach all
    // clients. Cancel that completed owner operation; live mutations still fail.
    if(value instanceof SourceWheelPosition&&value.sourceWheelRetired&&this.current().length===0)return;
  }}
}
export class WheelControllerHost extends ScrollController {
  private extent=0;private initial=0;
  constructor(options:ScrollControllerOptions={}){super(options,true);}
  get itemExtent():number{return this.extent;}
  protected configureWheel(itemExtent:number,initialItem:number):void{this.extent=itemExtent;this.initial=initialItem;ChangeNotifier.maybeDispatchObjectCreation(this);}
  override get initialScrollOffset():number{return this.extent*this.initial;}
  get sourcePositions():WheelPositions{return new WheelPositions(()=>Array.from(super.positions));}
}
export function* castWheelPositions(values:Iterable<ScrollPosition>):Iterable<WheelPosition>{for(const value of values)yield castWheelPosition(value);}
/** Future.wait<void> default: wait for every operation, then propagate the first observed error. */
export async function waitForWheelMotions(futures:readonly Promise<void>[]):Promise<void[]>{
  let failed=false,firstError:unknown;
  const results=await Promise.all(futures.map(future=>future.catch(error=>{if(!failed){failed=true;firstError=error;}})));
  if(failed)throw firstError;return results;
}
export class SourceWheelPosition extends GeneratedFixedExtentScrollPosition {
  constructor(itemExtent:number,options:{physics:ScrollPhysics;context:ScrollContext;initialItem:number;oldPosition:ScrollPosition|null;keepScrollOffset:boolean;debugLabel:string|null}){bindWheelContext(options.context,itemExtent);super(options);}
  /** Preserve Nelyx's pre-layout selection policy; laid-out indices use the complete source getter. */
  override get itemIndex():number{return this.hasContentDimensions?super.itemIndex:_getItemFromOffset({offset:this.pixels,itemExtent:this.itemExtent,minScrollExtent:0,maxScrollExtent:Number.MAX_SAFE_INTEGER});}
  get sourceWheelRetired():boolean{return this.scrollDisposed;}
}
export function createWheelPosition(owner:WheelControllerHost,options:ConstructorParameters<typeof SourceWheelPosition>[1]):WheelPosition{return new SourceWheelPosition(owner.itemExtent>0?owner.itemExtent:wheelContextItemExtent(options.context),options);}
