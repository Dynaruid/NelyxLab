// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/slider.dart; SHA256 fb534046016f1476936580595c46ce1ef4d7392e2284cf9a0f6040ed918ba115
const _dartTemporary0 = Symbol();
export class SliderInteraction {
  /**
   * @dartType int
   * @dartTypeOrigin explicit
   */
  readonly index: number;
  private readonly _dartTemporary1!: void;
  /**
   * @dartParam index int
   * @dartParamOrigin index explicit
   */
  private constructor(
    index: number,
    readonly name: string,
    token: typeof _dartTemporary0,
  ) {
    if (token !== _dartTemporary0) throw new TypeError('Enum values cannot be constructed');
    this.index = index;
    Object.freeze(this);
  }
  static readonly tapAndSlide: SliderInteraction = new SliderInteraction(
    0,
    'tapAndSlide',
    _dartTemporary0,
  );
  static readonly tapOnly: SliderInteraction = new SliderInteraction(1, 'tapOnly', _dartTemporary0);
  static readonly slideOnly: SliderInteraction = new SliderInteraction(
    2,
    'slideOnly',
    _dartTemporary0,
  );
  static readonly slideThumb: SliderInteraction = new SliderInteraction(
    3,
    'slideThumb',
    _dartTemporary0,
  );
  static readonly values: ReadonlyArray<SliderInteraction> = Object.freeze([
    SliderInteraction.tapAndSlide,
    SliderInteraction.tapOnly,
    SliderInteraction.slideOnly,
    SliderInteraction.slideThumb,
  ]);
  toString(): string {
    return 'SliderInteraction.' + this.name;
  }
}
Object.freeze(SliderInteraction.prototype);
Object.freeze(SliderInteraction);
