// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {RenderObjectWidget} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
import type {Key} from '../../foundation/key.ts';
import {RenderPointerListener,HitTestBehavior} from '../rendering/pointer-listener.ts';
import type {PointerListenerCallbacks} from '../rendering/pointer-listener.ts';
import type {RenderBox} from '../rendering/object.ts';
import {IterableProperty,EnumProperty} from '../../foundation/diagnostic-properties.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
export interface ListenerOptions extends PointerListenerCallbacks {readonly behavior?:HitTestBehavior;readonly key?:Key|null}
/** Source Listener callbacks receive concrete events, including local/global
 * positions and pan/zoom. The old gesture-detector Listener is a legacy DTO API. */
export class Listener extends RenderObjectWidget {
  constructor(readonly child:Widget|null=null,readonly options:ListenerOptions={}){super(options.key??null);}
  get onPointerDown():ListenerOptions['onPointerDown']{return this.options.onPointerDown;}get onPointerMove():ListenerOptions['onPointerMove']{return this.options.onPointerMove;}get onPointerUp():ListenerOptions['onPointerUp']{return this.options.onPointerUp;}get onPointerHover():ListenerOptions['onPointerHover']{return this.options.onPointerHover;}get onPointerCancel():ListenerOptions['onPointerCancel']{return this.options.onPointerCancel;}
  get onPointerPanZoomStart():ListenerOptions['onPointerPanZoomStart']{return this.options.onPointerPanZoomStart;}get onPointerPanZoomUpdate():ListenerOptions['onPointerPanZoomUpdate']{return this.options.onPointerPanZoomUpdate;}get onPointerPanZoomEnd():ListenerOptions['onPointerPanZoomEnd']{return this.options.onPointerPanZoomEnd;}get onPointerSignal():ListenerOptions['onPointerSignal']{return this.options.onPointerSignal;}
  get behavior():HitTestBehavior{return this.options.behavior??HitTestBehavior.deferToChild;}
  get childWidgets():readonly Widget[]{return this.child?[this.child]:[];}
  createRenderObject():RenderPointerListener{return new RenderPointerListener({...this.options,behavior:this.behavior});}
  updateRenderObject(_context:BuildContext,render:RenderBox):void{const listener=render as RenderPointerListener;listener.updateCallbacks(this.options);listener.behavior=this.behavior;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);const names=['Down','Move','Up','Hover','Cancel','PanZoomStart','PanZoomUpdate','PanZoomEnd','Signal'] as const;properties.add(new IterableProperty('listeners',names.filter(name=>this.options[('onPointer'+name) as keyof PointerListenerCallbacks]!==undefined).map(name=>name[0]!.toLowerCase()+name.slice(1)),{ifEmpty:'<none>',elementType:'String'}));properties.add(new EnumProperty('behavior',this.behavior));}
}
