// SPDX-License-Identifier: BSD-3-Clause
import {StatefulWidget,State,Element} from '@nelyx/core/framework/widgets/framework';
import type {Widget,BuildContext} from '@nelyx/core/framework/widgets/framework';
import {Column,Text,SizedBox,DecoratedBox} from '@nelyx/core/framework/widgets/basic';
import {GestureDetector} from '@nelyx/core/framework/widgets/gesture-detector';
import type {GestureOptions} from '@nelyx/core/framework/widgets/gesture-detector';
import {RawGestureDetector,GestureRecognizerFactoryWithHandlers} from '@nelyx/core/framework/widgets/raw-gesture-detector';
import {MultiTapGestureRecognizer,SerialTapGestureRecognizer} from '@nelyx/core/framework/gestures/multitap';
import {HitTestBehavior} from '@nelyx/core/framework/rendering/pointer-listener';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {Scaffold,FilledButton} from '@nelyx/material/widgets';
import {AppTheme} from '@nelyx/core/framework/widgets/app-data';
type Mode='Double tap'|'Long press'|'Scale'|'Multiple taps'|'Serial taps';
export class GestureFamilyLab extends StatefulWidget {
  constructor(readonly onBack:()=>void){super();}
  createState():State{return new GestureFamilyLabState();}
}
class GestureFamilyLabState extends State<GestureFamilyLab> {
  private mode:Mode='Double tap';private singles=0;private doubles=0;private longs=0;private downs=0;private ups=0;private cancels=0;private starts=0;private updates=0;private ends=0;private multiple=0;private serial=0;private pointerCount=0;private scale=1;private rotation=0;
  private change(callback:()=>void):void{if(this.mounted&&this.context.mounted)this.setState(callback);}
  build(context:BuildContext):Widget {
    if(!(context instanceof Element))throw new Error('Gesture families require the actual Element binding');const color=AppTheme.of(context).foreground,binding=context.owner.gestureBinding;
    const child=new DecoratedBox(new SizedBox(500,180,new Text('Press, hold, or use two fingers here',{fontSize:19,color:0xffffffff})),0xff244c74,8);let pad:Widget;
    if(this.mode==='Multiple taps')pad=new RawGestureDetector(child,{behavior:HitTestBehavior.opaque,gestures:new Map([[MultiTapGestureRecognizer,new GestureRecognizerFactoryWithHandlers(MultiTapGestureRecognizer,()=>new MultiTapGestureRecognizer({binding}),r=>{r.onTapDown=()=>this.change(()=>{this.downs++;});r.onTapUp=()=>this.change(()=>{this.ups++;});r.onTap=()=>this.change(()=>{this.multiple++;});r.onTapCancel=()=>this.change(()=>{this.cancels++;});})]])});
    else if(this.mode==='Serial taps')pad=new RawGestureDetector(child,{behavior:HitTestBehavior.opaque,gestures:new Map([[SerialTapGestureRecognizer,new GestureRecognizerFactoryWithHandlers(SerialTapGestureRecognizer,()=>new SerialTapGestureRecognizer({binding}),r=>{r.onSerialTapDown=d=>this.change(()=>{this.downs++;this.serial=d.count;});r.onSerialTapUp=d=>this.change(()=>{this.ups++;this.serial=d.count;});r.onSerialTapCancel=()=>this.change(()=>{this.cancels++;});})]])});
    else {
      let options:GestureOptions;
      if(this.mode==='Double tap')options={onTap:()=>this.change(()=>{this.singles++;}),onDoubleTapDown:()=>this.change(()=>{this.downs++;}),onDoubleTap:()=>this.change(()=>{this.doubles++;}),onDoubleTapCancel:()=>this.change(()=>{this.cancels++;})};
      else if(this.mode==='Long press')options={onLongPressDown:()=>this.change(()=>{this.downs++;}),onLongPressStart:()=>this.change(()=>{this.starts++;}),onLongPress:()=>this.change(()=>{this.longs++;}),onLongPressMoveUpdate:()=>this.change(()=>{this.updates++;}),onLongPressEnd:()=>this.change(()=>{this.ends++;}),onLongPressUp:()=>this.change(()=>{this.ups++;}),onLongPressCancel:()=>this.change(()=>{this.cancels++;})};
      else options={onScaleStart:d=>this.change(()=>{this.starts++;this.pointerCount=d.pointerCount;}),onScaleUpdate:d=>this.change(()=>{this.updates++;this.pointerCount=d.pointerCount;this.scale=d.scale;this.rotation=d.rotation;}),onScaleEnd:d=>this.change(()=>{this.ends++;this.pointerCount=d.pointerCount;})};
      pad=new GestureDetector(child,{...options,behavior:HitTestBehavior.opaque});
    }
    pad=new Semantics(pad,{id:'gesture-family-target',role:'text',name:'Gesture family target',enabled:true});
    return new Scaffold('Gesture families',new Column([
      new Text(`Family ${this.mode}`,{fontSize:21,color}),
      new Text(`Single ${this.singles} · Double ${this.doubles} · Long ${this.longs}`,{fontSize:16,color}),
      new Text(`Down ${this.downs} · Up ${this.ups} · Cancel ${this.cancels}`,{fontSize:16,color}),
      new Text(`Start ${this.starts} · Update ${this.updates} · End ${this.ends}`,{fontSize:16,color}),
      new Text(`Pointers ${this.pointerCount} · Scale ${this.scale.toFixed(2)} · Rotation ${this.rotation.toFixed(2)}`,{fontSize:16,color}),
      new Text(`Multiple ${this.multiple} · Serial count ${this.serial}`,{fontSize:16,color}),pad,
      ...(['Double tap','Long press','Scale','Multiple taps','Serial taps'] as const).map(mode=>new FilledButton('family-'+mode,mode+' family',()=>this.change(()=>{this.mode=mode;}))),
      new FilledButton('family-back','Back',this.widget.onBack),
    ],{spacing:8}));
  }
}
