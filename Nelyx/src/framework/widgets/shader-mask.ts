// SPDX-License-Identifier: BSD-3-Clause
import {invariant} from '../../foundation/errors.ts';
import {blendModes} from '../../ui/paint.ts';
import type {BlendMode} from '../../ui/paint.ts';
import {RenderShaderMask} from '../rendering/shader-mask.ts';
import type {ShaderCallback} from '../rendering/shader-mask.ts';
import {SingleChildRenderObjectWidget} from './framework.ts';
import type {Widget,WidgetOptions,BuildContext} from './framework.ts';
import type {RenderObject} from '../rendering/object.ts';

export interface ShaderMaskOptions extends WidgetOptions {readonly shaderCallback:ShaderCallback;readonly blendMode?:BlendMode;readonly child?:Widget}
/** Masks the painted child, including retained child layers, without changing
 * its layout or hit testing. The callback borrows its shader; see ShaderCallback. */
export class ShaderMask extends SingleChildRenderObjectWidget {
  readonly shaderCallback:ShaderCallback;
  readonly blendMode:BlendMode;
  constructor({child,shaderCallback,blendMode='modulate',...options}:ShaderMaskOptions){
    super(child,options);invariant(typeof shaderCallback==='function','invalid-shader-callback','Shader mask requires a callback');invariant(blendModes.includes(blendMode),'invalid-blend-mode','Unknown blend mode');this.shaderCallback=shaderCallback;this.blendMode=blendMode;
  }
  createRenderObject():RenderShaderMask{return new RenderShaderMask({shaderCallback:this.shaderCallback,blendMode:this.blendMode});}
  updateRenderObject(_context:BuildContext,render:RenderObject):void{invariant(render instanceof RenderShaderMask,'invalid-shader-mask-render','ShaderMask requires RenderShaderMask');render.shaderCallback=this.shaderCallback;render.blendMode=this.blendMode;}
}
