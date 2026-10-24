// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
import {SingleChildRenderObjectWidget} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import type {RenderObject} from '../rendering/object.ts';
import {RenderOpacity} from '../rendering/opacity.ts';
export interface OpacityOptions extends WidgetOptions {readonly opacity:number;readonly alwaysIncludeSemantics?:boolean}
export class Opacity extends SingleChildRenderObjectWidget {
  readonly opacity:number;readonly alwaysIncludeSemantics:boolean;
  constructor(child:Widget|undefined,options:OpacityOptions){super(child,options);this.opacity=options.opacity;this.alwaysIncludeSemantics=options.alwaysIncludeSemantics??false;invariant(Number.isFinite(this.opacity)&&this.opacity>=0&&this.opacity<=1,'invalid-opacity','Opacity must be between zero and one');}
  createRenderObject(_context:BuildContext):RenderOpacity{return new RenderOpacity({opacity:this.opacity,alwaysIncludeSemantics:this.alwaysIncludeSemantics});}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderOpacity,'invalid-opacity-render','Opacity requires RenderOpacity');render.opacity=this.opacity;render.alwaysIncludeSemantics=this.alwaysIncludeSemantics;}
}
