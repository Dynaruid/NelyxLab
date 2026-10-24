// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/ticker_provider.dart at the recorded pin.
import {invariant} from '../../foundation/errors.ts';
import {ValueNotifier} from '../../foundation/notifier.ts';
import type {ValueListenable} from '../../foundation/notifier.ts';
import {StatefulWidget,State,InheritedWidget} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {Builder} from './basic.ts';
import type {Key} from '../../foundation/key.ts';
export interface TickerModeTarget {setMuted(owner:object,muted:boolean):void}
export interface TickerModeOptions extends WidgetOptions {readonly forceFrames?:boolean;readonly targets?:readonly TickerModeTarget[]}
export class TickerModeData {
  readonly #enabled:boolean;readonly #forceFrames:boolean;
  constructor({enabled,forceFrames}:{readonly enabled:boolean;readonly forceFrames:boolean}){invariant(typeof enabled==='boolean'&&typeof forceFrames==='boolean','invalid-ticker-mode','Ticker mode values must be boolean');this.#enabled=enabled;this.#forceFrames=forceFrames;}
  get enabled():boolean{return this.#enabled;}get forceFrames():boolean{return this.#forceFrames;}
  static get fallback():TickerModeData{return fallbackData;}
  equals(other:unknown):boolean{return other===this||other instanceof TickerModeData&&other.constructor===this.constructor&&other.enabled===this.enabled&&other.forceFrames===this.forceFrames;}
  /** Deterministic local hash; Dart VM Object.hash is not a cross-host ABI. */
  get hashCode():number{return (this.enabled?1:0)*31+(this.forceFrames?1:0);}
}
const fallbackData=new TickerModeData({enabled:true,forceFrames:false});
class ConstantValueListenable<T> implements ValueListenable<T>{constructor(readonly value:T){}addListener(_listener:()=>void):void{}removeListener(_listener:()=>void):void{}}
const fallbackEnabled:ValueListenable<boolean>=Object.freeze(new ConstantValueListenable(true)),fallbackValues:ValueListenable<TickerModeData>=Object.freeze(new ConstantValueListenable(fallbackData));
class EffectiveTickerMode extends InheritedWidget {
  constructor(readonly values:TickerModeData,readonly notifier:ValueListenable<boolean>,readonly valuesNotifier:ValueListenable<TickerModeData>,child:Widget){super(child);}
  override updateShouldNotify(old:this):boolean{return !this.values.equals(old.values);}
}
/** Inherited automatic provider policy, with the W5 explicit-target constructor retained. */
export class TickerMode extends StatefulWidget {
  readonly enabled:boolean;readonly child:Widget;readonly forceFrames:boolean;readonly targets:readonly TickerModeTarget[];
  constructor(enabled:boolean,child:Widget,options?:TickerModeOptions);
  constructor(enabled:boolean,child:Widget,targets?:readonly TickerModeTarget[],key?:Key|null);
  constructor(enabled:boolean,child:Widget,optionsOrTargets:TickerModeOptions|readonly TickerModeTarget[]=[],key:Key|null=null){const options:TickerModeOptions=Array.isArray(optionsOrTargets)?{targets:optionsOrTargets as readonly TickerModeTarget[],key}:optionsOrTargets as TickerModeOptions;super(options.key??null);invariant(typeof enabled==='boolean'&&(options.forceFrames===undefined||typeof options.forceFrames==='boolean'),'invalid-ticker-mode','Ticker mode options must be boolean');this.enabled=enabled;this.child=child;this.forceFrames=options.forceFrames??false;this.targets=Object.freeze([...(options.targets??[])]);}
  static of(context:BuildContext):boolean{return context.maybeDependOn(EffectiveTickerMode)?.values.enabled??true;}
  static valuesOf(context:BuildContext):TickerModeData{return context.maybeDependOn(EffectiveTickerMode)?.values??fallbackData;}
  static getNotifier(context:BuildContext):ValueListenable<boolean>{return (context.getElementForInheritedWidgetOfExactType(EffectiveTickerMode)?.widget as EffectiveTickerMode|undefined)?.notifier??fallbackEnabled;}
  static getValuesNotifier(context:BuildContext):ValueListenable<TickerModeData>{if(!context.mounted)return fallbackValues;return (context.getElementForInheritedWidgetOfExactType(EffectiveTickerMode)?.widget as EffectiveTickerMode|undefined)?.valuesNotifier??fallbackValues;}
  static merge(child:Widget,{key=null,enabled=null,forceFrames=null}:{readonly key?:Key|null;readonly enabled?:boolean|null;readonly forceFrames?:boolean|null}={}):Widget{return new Builder(context=>{const parent=TickerMode.valuesOf(context);return new TickerMode(enabled??parent.enabled,child,{key,forceFrames:forceFrames??parent.forceFrames});});}
  createState():State{return new TickerModeState();}
}
class TickerModeState extends State<TickerMode> {
  private readonly token={};private ancestor=fallbackData;
  private readonly effectiveMode=new ValueNotifier(true);
  private readonly effectiveValues=new ValueNotifier(fallbackData,(a,b)=>a.equals(b));
  override didChangeDependencies():void{super.didChangeDependencies();this.ancestor=TickerMode.valuesOf(this.context);this.updateEffectiveMode();}
  private updateEffectiveMode():void{const values=new TickerModeData({enabled:this.ancestor.enabled&&this.widget.enabled,forceFrames:this.ancestor.forceFrames||this.widget.forceFrames});this.effectiveMode.value=values.enabled;this.effectiveValues.value=values;for(const target of this.widget.targets)target.setMuted(this.token,!values.enabled);}
  override didUpdateWidget(old:TickerMode):void{super.didUpdateWidget(old);for(const target of old.targets)if(!this.widget.targets.includes(target))target.setMuted(this.token,false);this.updateEffectiveMode();}
  override dispose():void{const errors:unknown[]=[];for(const dispose of [...this.widget.targets.map(target=>()=>target.setMuted(this.token,false)),()=>this.effectiveMode.dispose(),()=>this.effectiveValues.dispose(),()=>super.dispose()])try{dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'TickerMode teardown failed');}
  override deactivate():void{for(const target of this.widget.targets)target.setMuted(this.token,true);super.deactivate();}
  override activate():void{super.activate();this.ancestor=TickerMode.valuesOf(this.context);this.updateEffectiveMode();}
  build():Widget{return new EffectiveTickerMode(this.effectiveValues.value,this.effectiveMode,this.effectiveValues,this.widget.child);}
}
