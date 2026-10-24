// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from widgets/raw_keyboard_listener.dart at the recorded Flutter pin.
import {StatefulWidget,State,Element} from './framework.ts';
import type {Widget,BuildContext,WidgetOptions} from './framework.ts';
import {Focus} from './focus-scope.ts';
import type {FocusNode} from './focus.ts';
import type {RawKeyboard} from '../../services/raw-keyboard.ts';
import type {RawKeyEvent} from '../../services/raw-key-event.ts';
import type {ValueChanged} from '../../foundation/basic-types.ts';
import {invariant} from '../../foundation/errors.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
export interface RawKeyboardListenerOptions extends WidgetOptions {readonly focusNode:FocusNode;readonly autofocus?:boolean;readonly includeSemantics?:boolean;readonly onKey?:ValueChanged<RawKeyEvent>|null}
/** @deprecated Use KeyboardListener for modern focus-path key events. */
export class RawKeyboardListener extends StatefulWidget {
  readonly focusNode:FocusNode;readonly autofocus:boolean;readonly includeSemantics:boolean;readonly onKey:ValueChanged<RawKeyEvent>|null;
  constructor(readonly child:Widget,{focusNode,autofocus=false,includeSemantics=true,onKey=null,key=null}:RawKeyboardListenerOptions){super(key);this.focusNode=focusNode;this.autofocus=autofocus;this.includeSemantics=includeSemantics;this.onKey=onKey;}
  createState():State{return new RawKeyboardListenerState();}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('focusNode',this.focusNode));}
}
class RawKeyboardListenerState extends State<RawKeyboardListener> {
  private keyboard!:RawKeyboard;private listening=false;
  private readonly handleFocusChanged=()=>{if(this.widget.focusNode.hasFocus)this.attachKeyboardIfDetached();else this.detachKeyboardIfAttached();};
  private readonly handleRawKeyEvent=(event:RawKeyEvent)=>{this.widget.onKey?.(event);};
  override initState():void{super.initState();invariant(this.context instanceof Element,'invalid-keyboard-context','RawKeyboardListener requires an owning Element');this.keyboard=this.context.owner.rawKeyboard;this.widget.focusNode.addListener(this.handleFocusChanged);}
  override didUpdateWidget(old:RawKeyboardListener):void{super.didUpdateWidget(old);if(this.widget.focusNode!==old.focusNode){old.focusNode.removeListener(this.handleFocusChanged);this.widget.focusNode.addListener(this.handleFocusChanged);}}
  private attachKeyboardIfDetached():void{if(this.listening)return;this.keyboard.addListener(this.handleRawKeyEvent);this.listening=true;}
  private detachKeyboardIfAttached():void{if(!this.listening)return;this.keyboard.removeListener(this.handleRawKeyEvent);this.listening=false;}
  build(_context:BuildContext):Widget{return new Focus(this.widget.child,{focusNode:this.widget.focusNode,autofocus:this.widget.autofocus,includeSemantics:this.widget.includeSemantics});}
  override dispose():void{try{this.widget.focusNode.removeListener(this.handleFocusChanged);}finally{try{this.detachKeyboardIfAttached();}finally{super.dispose();}}}
}
