// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {Offset} from '../../ui/offset.ts';
import {invariant} from '../../foundation/errors.ts';
/** Source abstract positional contract with real immutable value storage. */
export abstract class PositionedGestureDetails {
  readonly globalPosition:Offset;readonly localPosition:Offset;
  constructor({globalPosition,localPosition}:{readonly globalPosition:Offset;readonly localPosition:Offset}){invariant(globalPosition instanceof Offset&&localPosition instanceof Offset,'invalid-gesture-position','Gesture positions require Offset values');this.globalPosition=globalPosition;this.localPosition=localPosition;}
}
