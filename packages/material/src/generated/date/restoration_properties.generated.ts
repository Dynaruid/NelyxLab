// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/restoration_properties.dart; SHA256 f39f24d36a49319ad1b7d2638ce128c90f288fb32f03ac95195bbab000ab41a9
import { protect } from '@nelyx/core/internal/ui/value-math';
import { checkedInteger } from '@nelyx/core/internal/ui/value-math';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { boxSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { castSourceDartInt } from '@nelyx/core/internal/foundation/dart-numeric';
import { DateTime } from '../../internal/date/date-time.ts';
import { SourceRestorableValue } from '../../internal/date/source-host.ts';
import { debugIsSerializableForRestoration } from '../../internal/date/source-host.ts';
export class RestorableDateTimeN extends SourceRestorableValue<DateTime | null> {
  readonly _dart_28c900461d797ad7_defaultValue: DateTime | null;
  constructor(defaultValue: DateTime | null) {
    const _initialField0 = defaultValue;
    super();
    this._dart_28c900461d797ad7_defaultValue = _initialField0;
    protect(this, ['_dart_28c900461d797ad7_defaultValue']);
  }
  override createDefaultValue(): DateTime | null {
    return this._dart_28c900461d797ad7_defaultValue;
  }
  override didUpdateValue(_oldValue: DateTime | null): void {
    if (FoundationBuildMode.debug)
      invariant(
        debugIsSerializableForRestoration(
          (() => {
            const _dartTemporary1 = (() => {
              const _dartTemporary0 = this.value;
              return _dartTemporary0 === null ? null : _dartTemporary0.millisecondsSinceEpoch;
            })();
            return _dartTemporary1 === null ? null : boxSourceDartInt(_dartTemporary1);
          })(),
        ),
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    void this.notifyListeners();
  }
  override fromPrimitives(data: {} | null): DateTime | null {
    return data !== null
      ? DateTime.fromMillisecondsSinceEpoch(checkedInteger(castSourceDartInt(data as {})))
      : null;
  }
  override toPrimitives(): {} | null {
    return (() => {
      const _dartTemporary3 = (() => {
        const _dartTemporary2 = this.value;
        return _dartTemporary2 === null ? null : _dartTemporary2.millisecondsSinceEpoch;
      })();
      return _dartTemporary3 === null ? null : boxSourceDartInt(_dartTemporary3);
    })();
  }
}
