// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedTheme } from './inherited-theme.ts';
import { StatelessWidget } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import { TextStyle } from '../painting/text-style.ts';
import type { TextAlign, TextHeightBehavior } from '../../ui/typography.ts';
import type { TextOverflow, TextWidthBasis } from '../painting/text-painter.ts';
import { invariant } from '../../foundation/errors.ts';
export interface DefaultTextStyleOptions {
  readonly textAlign?: TextAlign | null;
  readonly softWrap?: boolean;
  readonly overflow?: TextOverflow;
  readonly maxLines?: number | null;
  readonly textWidthBasis?: TextWidthBasis;
  readonly textHeightBehavior?: TextHeightBehavior | null;
}
export class DefaultTextStyle extends InheritedTheme {
  readonly options: Readonly<DefaultTextStyleOptions>;
  constructor(
    readonly style: TextStyle,
    child: Widget,
    options: DefaultTextStyleOptions = {},
  ) {
    super(child);
    invariant(
      options.maxLines == null || (Number.isSafeInteger(options.maxLines) && options.maxLines > 0),
      'invalid-default-text-lines',
      'DefaultTextStyle maxLines must be positive',
    );
    this.options = Object.freeze({
      softWrap: true,
      overflow: 'clip',
      textWidthBasis: 'parent',
      ...options,
    });
  }
  get textAlign(): TextAlign | null {
    return this.options.textAlign ?? null;
  }
  get softWrap(): boolean {
    return this.options.softWrap!;
  }
  get overflow(): TextOverflow {
    return this.options.overflow!;
  }
  get maxLines(): number | null {
    return this.options.maxLines ?? null;
  }
  get textWidthBasis(): TextWidthBasis {
    return this.options.textWidthBasis!;
  }
  get textHeightBehavior(): TextHeightBehavior | null {
    return this.options.textHeightBehavior ?? null;
  }
  static of(context: BuildContext): DefaultTextStyle | null {
    return context.maybeDependOn(DefaultTextStyle) ?? null;
  }
  static merge(child: Widget, style: TextStyle, options: DefaultTextStyleOptions = {}): Widget {
    return new MergedDefaultTextStyle(child, style, options);
  }
  wrap(_context: BuildContext, child: Widget): Widget {
    return new DefaultTextStyle(this.style, child, this.options);
  }
  updateShouldNotify(old: this): boolean {
    return (
      !this.style.equals(old.style) || JSON.stringify(this.options) !== JSON.stringify(old.options)
    );
  }
}
class MergedDefaultTextStyle extends StatelessWidget {
  constructor(
    readonly child: Widget,
    readonly style: TextStyle,
    readonly options: DefaultTextStyleOptions,
  ) {
    super();
  }
  build(context: BuildContext): Widget {
    const old = DefaultTextStyle.of(context);
    return new DefaultTextStyle((old?.style ?? new TextStyle()).merge(this.style), this.child, {
      ...old?.options,
      ...this.options,
    });
  }
}
