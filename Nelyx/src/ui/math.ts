// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
import {FoundationBuildMode} from '../foundation/constants.ts';
import {invariant} from '../foundation/errors.ts';
/** Pinned dart:ui double clamp; transport validation remains at the host boundary. */
export function clampDouble(x:number,min:number,max:number):number{
  if(FoundationBuildMode.debug)invariant(min<=max&&!Number.isNaN(max)&&!Number.isNaN(min),'invalid-double-clamp','Clamp bounds must be ordered and not NaN');
  if(x<min)return min;if(x>max)return max;if(Number.isNaN(x))return max;return x;
}
