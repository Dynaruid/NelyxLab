// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/spacer.dart; SHA256 a9976fdb3d621e44ea017543d47168841c0e4a7ac09f01a96a08e4c77a2ef009
import { protect } from '@nelyx/core/internal/ui/value-math';
import { checkedInteger } from '@nelyx/core/internal/ui/value-math';
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { Widget } from '@nelyx/core/framework/widgets/framework';
import { Key } from '@nelyx/core/foundation/key';
import { ScrollbarStatelessHost } from '@nelyx/core/internal/framework/widgets/scrollbar-themed-source-adapter';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { dateExpanded } from '../../internal/date/source-host.ts';
import { constDateSizedBoxShrink } from '../../internal/date/source-host.ts';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
export class Spacer extends ScrollbarStatelessHost {
  /**
   * @dartType int
   * @dartTypeOrigin explicit
   */
  readonly flex: number;
  /**
   * @dartParam flex int
   * @dartParamOrigin flex inferred
   */
  constructor({
    key = null,
    flex = 1,
  }: {
    readonly key?: Key | null;
    readonly flex?: number;
  } = {}) {
    checkedInteger(flex);
    /**
     * @dartType int
     * @dartTypeOrigin inferred
     */
    const _initialField0 = flex;
    if (FoundationBuildMode.debug)
      invariant(
        checkedInteger(flex) > 0,
        'generated-source-assert',
        'Pinned Dart assertion failed',
      );
    super({ key: key });
    this.flex = _initialField0;
    protect(this, ['flex']);
  }
  override build(_context: BuildContext): Widget {
    return dateExpanded({
      flex: checkedInteger(this.flex),
      child: constDateSizedBoxShrink(SizedBox),
    });
  }
}
