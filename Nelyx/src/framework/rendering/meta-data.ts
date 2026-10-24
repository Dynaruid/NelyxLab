// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {RenderProxyBoxWithHitTestBehavior} from './pointer-listener.ts';
import type {HitTestBehavior} from './pointer-listener.ts';
import type {RenderBox,RenderObject} from './object.ts';
import {DiagnosticsProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder} from '../../foundation/diagnostics.ts';
export class RenderMetaData extends RenderProxyBoxWithHitTestBehavior {
  metaData:unknown;
  constructor({metaData=null,behavior,child}:{readonly metaData?:unknown;readonly behavior?:HitTestBehavior;readonly child?:RenderBox<RenderObject>}={}){super({...(behavior?{behavior}:{}),...(child?{child}:{})});this.metaData=metaData;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('metaData',this.metaData));}
}
