// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {RenderObjectWidget} from './framework.ts';import type {Widget,BuildContext} from './framework.ts';import type {Key} from '../../foundation/key.ts';
import {RenderMouseRegion} from '../rendering/mouse-region.ts';import type {RenderMouseRegionOptions} from '../rendering/mouse-region.ts';import type {RenderBox} from '../rendering/object.ts';
import {MouseCursor} from '../../services/mouse-cursor.ts';
export interface MouseRegionOptions extends Omit<RenderMouseRegionOptions,'child'> {readonly key?:Key|null}
export class MouseRegion extends RenderObjectWidget {
  constructor(readonly child:Widget|null=null,readonly options:MouseRegionOptions={}){super(options.key??null);}
  get onEnter():MouseRegionOptions['onEnter']{return this.options.onEnter;}
  get onExit():MouseRegionOptions['onExit']{return this.options.onExit;}
  get onHover():MouseRegionOptions['onHover']{return this.options.onHover;}
  get cursor():MouseCursor{return this.options.cursor??MouseCursor.defer;}
  get opaque():boolean{return this.options.opaque??true;}
  get hitTestBehavior():MouseRegionOptions['hitTestBehavior']{return this.options.hitTestBehavior;}
  get childWidgets():readonly Widget[]{return this.child?[this.child]:[];}
  createRenderObject():RenderMouseRegion{return new RenderMouseRegion(this.options);}
  updateRenderObject(_context:BuildContext,object:RenderBox):void{const render=object as RenderMouseRegion;render.onEnter=this.options.onEnter;render.onExit=this.options.onExit;render.onHover=this.options.onHover;render.cursor=this.cursor;render.opaque=this.options.opaque??true;render.hitTestBehavior=this.options.hitTestBehavior??null;}
}
