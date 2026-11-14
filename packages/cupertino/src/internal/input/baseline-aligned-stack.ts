// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Selected _BaselineAlignedStack from pinned cupertino/text_field.dart on Core.
import { MultiChildRenderObjectWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { KeyedSubtree } from '@nelyx/core/framework/widgets/basic';
import { ValueKey } from '@nelyx/core/foundation/key';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import type { RenderObject, TextBaseline } from '@nelyx/core/framework/rendering/object';
import type { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { Size } from '@nelyx/core/ui/geometry';
import type { TextAlignVertical } from '@nelyx/core/framework/painting/text-align-vertical';
import { invariant } from '@nelyx/core/foundation/errors';
export interface BaselineStackConfiguration {
  readonly vertical: TextAlignVertical;
  readonly editorBaseline: TextBaseline;
  readonly placeholderBaseline: TextBaseline;
}
export class BaselineAlignedStack extends MultiChildRenderObjectWidget {
  readonly hasPlaceholder: boolean;
  constructor(
    editor: Widget,
    placeholder: Widget | null,
    readonly configuration: BaselineStackConfiguration,
  ) {
    super([
      ...(placeholder
        ? [new KeyedSubtree({ key: new ValueKey('placeholder'), child: placeholder })]
        : []),
      new KeyedSubtree({ key: new ValueKey('editor'), child: editor }),
    ]);
    this.hasPlaceholder = placeholder !== null;
  }
  createRenderObject(): RenderObject {
    return new RenderBaselineAlignedStack(this.hasPlaceholder, this.configuration);
  }
  override updateRenderObject(_context: BuildContext, render: RenderObject): void {
    invariant(
      render instanceof RenderBaselineAlignedStack,
      'invalid-cupertino-editor-stack',
      'Expected Cupertino baseline stack',
    );
    render.configure(this.hasPlaceholder, this.configuration);
  }
}
class RenderBaselineAlignedStack extends RenderBox {
  constructor(
    private hasPlaceholder: boolean,
    private configuration: BaselineStackConfiguration,
  ) {
    super();
  }
  protected override get childCountLimit(): number {
    return 2;
  }
  configure(hasPlaceholder: boolean, configuration: BaselineStackConfiguration): void {
    this.hasPlaceholder = hasPlaceholder;
    this.configuration = configuration;
    this.markNeedsLayout();
  }
  private get editor(): RenderBox<RenderObject> {
    return this.children[this.hasPlaceholder ? 1 : 0]!;
  }
  private get placeholder(): RenderBox<RenderObject> | undefined {
    return this.hasPlaceholder ? this.children[0] : undefined;
  }
  private measure(
    constraints: BoxConstraints,
    dry: boolean,
  ): { size: Size; editorBaseline: number; placeholderBaseline: number | null; editorSize: Size } {
    const editor = this.editor,
      placeholder = this.placeholder,
      c = this.configuration;
    const layout = (child: RenderBox<RenderObject>): Size =>
      dry
        ? child.getDryLayout(constraints)
        : (child.layout(constraints, { parentUsesSize: true }), child.size);
    const baseline = (child: RenderBox<RenderObject>, size: Size, kind: TextBaseline): number =>
      (dry ? child.getDryBaseline(constraints, kind) : child.getDistanceToBaseline(kind)) ??
      size.height;
    const editorSize = layout(editor),
      editorBaseline = baseline(editor, editorSize, c.editorBaseline);
    let width = Math.max(constraints.minWidth, editorSize.width),
      height = Math.max(constraints.minHeight, editorSize.height),
      placeholderBaseline: number | null = null;
    if (placeholder) {
      const size = layout(placeholder);
      placeholderBaseline = baseline(placeholder, size, c.placeholderBaseline);
      width = Math.max(width, size.width);
      height = Math.max(
        height,
        Math.max(editorBaseline, placeholderBaseline) +
          Math.max(editorSize.height - editorBaseline, size.height - placeholderBaseline),
      );
    }
    return {
      size: constraints.constrain({ width, height }),
      editorBaseline,
      placeholderBaseline,
      editorSize,
    };
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    invariant(
      constraints.hasTightWidth,
      'loose-cupertino-editor-stack',
      'Cupertino baseline stack requires tight width',
    );
    const value = this.measure(constraints, false),
      y = ((value.size.height - value.editorSize.height) * (this.configuration.vertical.y + 1)) / 2;
    this.editor.layoutOffset = { x: 0, y };
    if (this.placeholder)
      this.placeholder.layoutOffset = {
        x: 0,
        y: y + value.editorBaseline - value.placeholderBaseline!,
      };
    return value.size;
  }
  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return this.measure(constraints, true).size;
  }
  protected override computeMinIntrinsicWidth(height: number): number {
    return Math.max(
      this.editor.getMinIntrinsicWidth(height),
      this.placeholder?.getMinIntrinsicWidth(height) ?? 0,
    );
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return Math.max(
      this.editor.getMaxIntrinsicWidth(height),
      this.placeholder?.getMaxIntrinsicWidth(height) ?? 0,
    );
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    return Math.max(
      this.editor.getMinIntrinsicHeight(width),
      this.placeholder?.getMinIntrinsicHeight(width) ?? 0,
    );
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return Math.max(
      this.editor.getMaxIntrinsicHeight(width),
      this.placeholder?.getMaxIntrinsicHeight(width) ?? 0,
    );
  }
}
