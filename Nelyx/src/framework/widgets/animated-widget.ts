// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// AnimatedWidget and _AnimatedState from pinned widgets/transitions.dart.
import type {Listenable} from '../../foundation/notifier.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
import {StatefulWidget,State} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import {protect} from '../../ui/value-math.ts';
export interface AnimatedWidgetOptions extends WidgetOptions {readonly listenable:Listenable}
export abstract class AnimatedWidget extends StatefulWidget {
  readonly listenable:Listenable;
  constructor({listenable,key=null}:AnimatedWidgetOptions){super(key);this.listenable=listenable;protect(this,['listenable']);}
  abstract build(context:BuildContext):Widget;
  createState():State<AnimatedWidget>{return new AnimatedState();}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('listenable',this.listenable));}
}
class AnimatedState extends State<AnimatedWidget> {
  private readonly handleChange=():void=>{if(this.mounted)this.setState(()=>{});};
  override initState():void{super.initState();this.widget.listenable.addListener(this.handleChange);}
  override didUpdateWidget(old:AnimatedWidget):void{super.didUpdateWidget(old);if(old.listenable!==this.widget.listenable){old.listenable.removeListener(this.handleChange);this.widget.listenable.addListener(this.handleChange);}}
  override dispose():void{this.widget.listenable.removeListener(this.handleChange);super.dispose();}
  build(context:BuildContext):Widget{return this.widget.build(context);}
}
