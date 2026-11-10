// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/form.dart; SHA256 9d6771d8cabee20dd995dc4921e35481da8ff09acbeca3b73f87382580aac47b
const _dartTemporary0 = Symbol();
export class AutovalidateMode {
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
  static readonly disabled: AutovalidateMode = new AutovalidateMode(0, 'disabled', _dartTemporary0);
  static readonly always: AutovalidateMode = new AutovalidateMode(1, 'always', _dartTemporary0);
  static readonly onUserInteraction: AutovalidateMode = new AutovalidateMode(
    2,
    'onUserInteraction',
    _dartTemporary0,
  );
  static readonly onUnfocus: AutovalidateMode = new AutovalidateMode(
    3,
    'onUnfocus',
    _dartTemporary0,
  );
  static readonly onUserInteractionIfError: AutovalidateMode = new AutovalidateMode(
    4,
    'onUserInteractionIfError',
    _dartTemporary0,
  );
  static readonly values: ReadonlyArray<AutovalidateMode> = Object.freeze([
    AutovalidateMode.disabled,
    AutovalidateMode.always,
    AutovalidateMode.onUserInteraction,
    AutovalidateMode.onUnfocus,
    AutovalidateMode.onUserInteractionIfError,
  ]);
  toString(): string {
    return 'AutovalidateMode.' + this.name;
  }
}
Object.freeze(AutovalidateMode.prototype);
Object.freeze(AutovalidateMode);

import { registerDateEnumValues } from '../../internal/date/source-values.ts';
registerDateEnumValues(AutovalidateMode);
