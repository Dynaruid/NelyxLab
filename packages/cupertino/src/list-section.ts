// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Managed resolved public API projection; behavior uses canonical Core owners.
import { Widget, StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { WidgetOptions, BuildContext } from '@nelyx/core/framework/widgets/framework';
import '@nelyx/core/framework/widgets/basic';
import { Color } from '@nelyx/core/ui/color';
import {
  EdgeInsets,
  EdgeInsetsDirectional,
  EdgeInsetsGeometry,
} from '@nelyx/core/framework/painting/edge-insets';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import type { Clip } from '@nelyx/core/ui/clip';
import { invariant } from '@nelyx/core/foundation/errors';
import '@nelyx/core/foundation/flutter-error';
import '@nelyx/core/foundation/assertions';
import '@nelyx/core/foundation/diagnostics';
import { CupertinoColors } from './colors.ts';
import { CupertinoListSectionType } from './generated/list/list-section-types.ts';
import { buildCupertinoListSection } from './internal/list/list-build.ts';
export { CupertinoListSectionType } from './generated/list/list-section-types.ts';
const defaultRowsMargin = EdgeInsets.only({ bottom: 8 }),
  defaultInsetRowsMargin = EdgeInsetsDirectional.fromSTEB(20, 20, 20, 10),
  defaultInsetRowsMarginWithHeader = EdgeInsetsDirectional.fromSTEB(20, 0, 20, 10);
export interface CupertinoListSectionOptions extends WidgetOptions {
  readonly children?: readonly Widget[] | null;
  readonly header?: Widget | null;
  readonly footer?: Widget | null;
  readonly margin?: EdgeInsetsGeometry;
  readonly backgroundColor?: Color;
  readonly decoration?: BoxDecoration | null;
  readonly clipBehavior?: Clip;
  /** @dartType double */ readonly dividerMargin?: number;
  /** @dartType double? */ readonly additionalDividerMargin?: number | null;
  /** @dartType double? */ readonly topMargin?: number | null;
  readonly hasLeading?: boolean;
  readonly separatorColor?: Color | null;
}
export interface CupertinoListSectionInsetGroupedOptions extends Omit<
  CupertinoListSectionOptions,
  'margin'
> {
  readonly margin?: EdgeInsetsGeometry | null;
}
export class CupertinoListSection extends StatelessWidget {
  readonly type: CupertinoListSectionType;
  readonly header: Widget | null;
  readonly footer: Widget | null;
  readonly margin: EdgeInsetsGeometry;
  readonly children: readonly Widget[] | null;
  readonly decoration: BoxDecoration | null;
  readonly backgroundColor: Color;
  readonly clipBehavior: Clip;
  /** @dartType double */ readonly dividerMargin: number;
  /** @dartType double */ readonly additionalDividerMargin: number;
  /** @dartType double? */ readonly topMargin: number | null;
  readonly separatorColor: Color | null;
  /**
   * @dartParam dividerMargin double
   * @dartParam additionalDividerMargin double?
   * @dartParam topMargin double?
   */
  constructor(o: CupertinoListSectionOptions = {}) {
    super(o.key ?? null);
    this.type = CupertinoListSectionType.base;
    this.header = o.header ?? null;
    this.footer = o.footer ?? null;
    this.children = o.children ?? null;
    this.margin = o.margin ?? defaultRowsMargin;
    this.backgroundColor = o.backgroundColor ?? CupertinoColors.systemGroupedBackground;
    this.decoration = o.decoration ?? null;
    this.clipBehavior = o.clipBehavior ?? 'none';
    this.dividerMargin = o.dividerMargin ?? 20;
    this.additionalDividerMargin = o.additionalDividerMargin ?? ((o.hasLeading ?? true) ? 44 : 0);
    this.topMargin = o.topMargin === undefined ? 22 : o.topMargin;
    this.separatorColor = o.separatorColor ?? null;
    invariant(
      (this.children !== null && this.children.length > 0) || this.header !== null,
      'empty-cupertino-list-section',
      'CupertinoListSection requires nonempty children or a header',
    );
  }
  /**
   * @dartParam dividerMargin double
   * @dartParam additionalDividerMargin double?
   * @dartParam topMargin double?
   */
  static insetGrouped(o: CupertinoListSectionInsetGroupedOptions = {}): CupertinoListSection {
    const section = new CupertinoListSection({
      ...o,
      margin:
        o.margin ?? (o.header == null ? defaultInsetRowsMargin : defaultInsetRowsMarginWithHeader),
      clipBehavior: o.clipBehavior ?? 'hardEdge',
      dividerMargin: o.dividerMargin ?? 14,
      additionalDividerMargin: o.additionalDividerMargin ?? ((o.hasLeading ?? true) ? 42 : 14),
      topMargin: o.topMargin ?? null,
    });
    Object.defineProperty(section, 'type', {
      value: CupertinoListSectionType.insetGrouped,
      enumerable: true,
    });
    return section;
  }
  build(context: BuildContext): Widget {
    return buildCupertinoListSection(this, context);
  }
}
