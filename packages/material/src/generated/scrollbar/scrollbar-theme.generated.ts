// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/scrollbar_theme.dart; SHA256 3da34fe5ede449faf1e28cc7587a8b7f1379935702c8ff8f273e1e47f3f7733d
import { protect } from '@nelyx/core/internal/ui/value-math';
import { Widget } from '@nelyx/core/framework/widgets/framework';
import { Key } from '@nelyx/core/foundation/key';
import { applyDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { captureDartType } from '@nelyx/core/internal/foundation/dart-type-witness';
import { ScrollbarMaterialTheme } from '../../internal/scrollbar/scrollbar-source-adapter.ts';
import { ScrollbarInheritedThemeHost } from '@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter';
import { scrollbarInheritedThemeType } from '@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter';
import { sourceScrollbarThemeOf } from '../../internal/scrollbar/scrollbar-theme-lookup.ts';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { SourceScrollbarThemeData } from './scrollbar-theme-data.generated.ts';
export {
  SourceScrollbarThemeData,
  constScrollbarThemeData,
  _lerpBool,
} from './scrollbar-theme-data.generated.ts';

export class SourceScrollbarTheme extends ScrollbarInheritedThemeHost {
  readonly data: SourceScrollbarThemeData;
  constructor({
    key = null,
    data,
    child,
  }: {
    readonly key?: Key | null;
    readonly data: SourceScrollbarThemeData;
    readonly child: Widget;
  }) {
    const _initialField0 = data;
    super({ key: key, child: child });
    captureDartType(
      this,
      applyDartType<SourceScrollbarTheme>(
        SourceScrollbarTheme,
        'ScrollbarTheme',
        [],
        [scrollbarInheritedThemeType],
      ),
    );
    this.data = _initialField0;
    protect(this, ['data']);
  }
  static of(context: BuildContext): SourceScrollbarThemeData {
    const scrollbarTheme: SourceScrollbarTheme | null = sourceScrollbarThemeOf(
      context,
      SourceScrollbarTheme,
    );
    return (
      (() => {
        const _dartTemporary49 = scrollbarTheme;
        return _dartTemporary49 === null ? null : _dartTemporary49.data;
      })() ?? ScrollbarMaterialTheme.of(context).scrollbarTheme
    );
  }
  override wrap(context: BuildContext, child: Widget): Widget {
    return new SourceScrollbarTheme({ data: this.data, child: child });
  }
  override updateShouldNotify(oldWidget: SourceScrollbarTheme): boolean {
    if (!(oldWidget instanceof SourceScrollbarTheme))
      throw new TypeError('Invalid covariant argument: oldWidget');
    return !this.data.equals(oldWidget.data);
  }
}
