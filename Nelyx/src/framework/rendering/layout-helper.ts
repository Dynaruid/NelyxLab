// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type {RenderBox,RenderObject,TextBaseline} from './object.ts';
import type {BoxConstraints} from './constraints.ts';
import type {Size} from '../../ui/geometry.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
export type ChildLayouter=(child:RenderBox<RenderObject>,constraints:BoxConstraints)=>Size;
export type ChildBaselineGetter=(child:RenderBox<RenderObject>,constraints:BoxConstraints,baseline:TextBaseline)=>number|null;
export class ChildLayoutHelper {
  private constructor(){}
  static dryLayoutChild(child:RenderBox<RenderObject>,constraints:BoxConstraints):Size{return child.getDryLayout(constraints);}
  static layoutChild(child:RenderBox<RenderObject>,constraints:BoxConstraints):Size{child.layout(constraints,{parentUsesSize:true});return child.size;}
  static getDryBaseline(child:RenderBox<RenderObject>,constraints:BoxConstraints,baseline:TextBaseline):number|null{return child.getDryBaseline(constraints,baseline);}
  static getBaseline(child:RenderBox<RenderObject>,constraints:BoxConstraints,baseline:TextBaseline):number|null{if(FoundationBuildMode.debug){invariant(!child.debugNeedsLayout,'unlaid-inline-child','Inline child must be laid out before querying its baseline');invariant(child.constraints.equals(constraints),'inline-child-constraints','Inline baseline constraints must match layout');}return child.getDistanceToBaseline(baseline,{onlyReal:true});}
}
