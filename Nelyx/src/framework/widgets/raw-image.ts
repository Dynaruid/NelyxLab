// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// RawImage borrows its widget input; each render object receives an owned clone.
import {LeafRenderObjectWidget} from './framework.ts';
import type {BuildContext} from './framework.ts';
import type {Key} from '../../foundation/key.ts';
import type {RenderObject} from '../rendering/object.ts';
import {RenderImage} from '../rendering/image.ts';
import type {RenderImageOptions} from '../rendering/image.ts';
import {Directionality} from './app-data.ts';
import {Alignment} from '../painting/alignment.ts';
export interface RawImageOptions extends Omit<RenderImageOptions,'textDirection'> {readonly key?:Key|null}
export class RawImage extends LeafRenderObjectWidget {
  readonly options:RawImageOptions;
  constructor(options:RawImageOptions={}){super(options.key??null);this.options=Object.freeze({...options});}
  get image(){return this.options.image??null;}get debugImageLabel(){return this.options.debugImageLabel??null;}get width(){return this.options.width??null;}get height(){return this.options.height??null;}get scale(){return this.options.scale??1;}get color(){return this.options.color??null;}get opacity(){return this.options.opacity??null;}get colorBlendMode(){return this.options.colorBlendMode??null;}get blendMode(){return this.options.blendMode??'srcOver';}get fit(){return this.options.fit??null;}get alignment(){return this.options.alignment??Alignment.center;}get repeat(){return this.options.repeat??'noRepeat';}get centerSlice(){return this.options.centerSlice??null;}get matchTextDirection(){return this.options.matchTextDirection??false;}get invertColors(){return this.options.invertColors??false;}get filterQuality(){return this.options.filterQuality??'medium';}get isAntiAlias(){return this.options.isAntiAlias??false;}
  createRenderObject(context:BuildContext):RenderImage{const image=this.image?.clone()??null;try{return new RenderImage({...this.options,image,textDirection:context.maybeDependOn(Directionality)?.direction??null});}catch(error){if(image&&!image.debugDisposed)try{image.dispose();}catch(cleanup){throw new AggregateError([error,cleanup],'RawImage creation and clone retirement failed');}throw error;}}
  updateRenderObject(context:BuildContext,object:RenderObject):void{const render=object as RenderImage,options=this.options;render.width=options.width??null;render.height=options.height??null;render.scale=options.scale??1;render.color=options.color??null;render.opacity=options.opacity??null;render.colorBlendMode=options.colorBlendMode??null;render.blendMode=options.blendMode??'srcOver';render.fit=options.fit??null;render.repeat=options.repeat??'noRepeat';render.centerSlice=options.centerSlice??null;render.matchTextDirection=options.matchTextDirection??false;render.textDirection=context.maybeDependOn(Directionality)?.direction??null;render.invertColors=options.invertColors??false;render.isAntiAlias=options.isAntiAlias??false;render.filterQuality=options.filterQuality??'medium';if(options.alignment)render.alignment=options.alignment;else render.alignment=defaultAlignment;render.debugImageLabel=options.debugImageLabel??null;render.image=options.image?.clone()??null;}
  override didUnmountRenderObject(object:RenderObject):void{(object as RenderImage).image=null;}
}
const defaultAlignment=Alignment.center;
