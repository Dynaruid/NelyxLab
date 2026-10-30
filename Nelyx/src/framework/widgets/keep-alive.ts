// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Separate the parent-data widget from sliver delegates to avoid an ESM initialization cycle.
import { ParentDataWidget } from './framework.ts';
import type { Widget } from './framework.ts';
import type { Key } from '../../foundation/key.ts';
import { ParentData } from '../rendering/object.ts';
import type { RenderObject } from '../rendering/object.ts';
import { isKeepAliveParentData } from '../rendering/sliver-multi-box-adaptor.ts';
import type { KeepAliveParentDataMixin } from '../rendering/sliver-multi-box-adaptor.ts';
import { invariant } from '../../foundation/errors.ts';
import { protect } from '../../ui/value-math.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
abstract class _KeepAliveParentDataType extends ParentData implements KeepAliveParentDataMixin {
  static [Symbol.hasInstance](value: unknown): boolean {
    return value instanceof ParentData && isKeepAliveParentData(value);
  }
  abstract keepAlive: boolean;
  abstract readonly keptAlive: boolean;
}
export class KeepAlive extends ParentDataWidget<ParentData & KeepAliveParentDataMixin> {
  readonly parentDataType = _KeepAliveParentDataType;
  readonly keepAlive: boolean;
  constructor({
    keepAlive,
    child,
    key = null,
  }: {
    readonly keepAlive: boolean;
    readonly child: Widget;
    readonly key?: Key | null;
  }) {
    super(child, { key });
    this.keepAlive = keepAlive;
    protect(this, ['keepAlive', 'parentDataType']);
  }
  applyParentData(renderObject: RenderObject): void {
    const parentData = renderObject.parentData;
    invariant(
      isKeepAliveParentData(parentData),
      'invalid-keep-alive-parent-data',
      'KeepAlive requires a render parent with KeepAliveParentDataMixin',
    );
    if (parentData.keepAlive !== this.keepAlive) {
      parentData.keepAlive = this.keepAlive;
      if (!this.keepAlive) renderObject.parent?.markNeedsLayout();
    }
  }
  override debugCanApplyOutOfTurn(): boolean {
    return this.keepAlive;
  }
  get debugTypicalAncestorWidgetClass(): Function {
    throw new FlutterError(
      'Multiple Types are supported, use debugTypicalAncestorWidgetDescription.',
    );
  }
  override get debugTypicalAncestorWidgetDescription(): string {
    return 'SliverWithKeepAliveWidget or TwoDimensionalViewport';
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('keepAlive', this.keepAlive));
  }
}
