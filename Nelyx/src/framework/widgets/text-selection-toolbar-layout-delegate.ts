// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { SingleChildLayoutDelegate } from '../rendering/custom-layout.ts';
import { BoxConstraints } from '../rendering/constraints.ts';
import { RenderProxyBox } from '../rendering/boxes.ts';
import { Offset } from '../../ui/offset.ts';
import type { Size } from '../../ui/geometry.ts';
import { FocusNode } from './focus.ts';
import { Focus } from './focus-scope.ts';
import { SingleChildRenderObjectWidget, State, StatefulWidget } from './framework.ts';
import type { Widget } from './framework.ts';

/** @internal Restricts focus to the items the selection toolbar lays out on the current page. */
export class TextSelectionToolbarItem extends StatefulWidget {
  constructor(readonly child: Widget) {
    super();
  }

  override createState(): State<TextSelectionToolbarItem> {
    return new TextSelectionToolbarItemState();
  }
}

class TextSelectionToolbarItemState extends State<TextSelectionToolbarItem> {
  private readonly focusNode = new FocusNode({
    canRequestFocus: false,
    skipTraversal: true,
    descendantsAreFocusable: false,
  });

  override build(): Widget {
    return new ToolbarItemFocus(
      Focus.withExternalFocusNode(this.widget.child, {
        focusNode: this.focusNode,
        includeSemantics: false,
      }),
      this.focusNode,
    );
  }

  override dispose(): void {
    this.focusNode.dispose();
    super.dispose();
  }
}

class ToolbarItemFocus extends SingleChildRenderObjectWidget {
  constructor(
    child: Widget,
    private readonly focusNode: FocusNode,
  ) {
    super(child);
  }

  override createRenderObject(): RenderTextSelectionToolbarItem {
    return new RenderTextSelectionToolbarItem(this.focusNode);
  }
}

/** @internal The toolbar calls this after determining which children it can display. */
export class RenderTextSelectionToolbarItem extends RenderProxyBox {
  private visible = false;
  constructor(private readonly focusNode: FocusNode) {
    super();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.focusNode.descendantsAreFocusable = visible;
  }
  override get isDisplayed(): boolean {
    return this.visible && super.isDisplayed;
  }
}

export class TextSelectionToolbarLayoutDelegate extends SingleChildLayoutDelegate {
  readonly anchorAbove: Offset;
  readonly anchorBelow: Offset;
  readonly fitsAbove: boolean | null;
  constructor({
    anchorAbove,
    anchorBelow,
    fitsAbove = null,
  }: {
    readonly anchorAbove: Offset;
    readonly anchorBelow: Offset;
    readonly fitsAbove?: boolean | null;
  }) {
    super();
    this.anchorAbove = anchorAbove;
    this.anchorBelow = anchorBelow;
    this.fitsAbove = fitsAbove;
  }
  static centerOn(position: number, width: number, max: number): number {
    if (position - width / 2 < 0) return 0;
    if (position + width / 2 > max) return max - width;
    return position - width / 2;
  }
  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    return constraints.loosen();
  }
  override getPositionForChild(size: Size, childSize: Size): Offset {
    const above = this.fitsAbove ?? this.anchorAbove.dy >= childSize.height,
      anchor = above ? this.anchorAbove : this.anchorBelow;
    return new Offset(
      TextSelectionToolbarLayoutDelegate.centerOn(anchor.dx, childSize.width, size.width),
      Math.min(
        Math.max(0, size.height - childSize.height),
        Math.max(0, above ? anchor.dy - childSize.height : anchor.dy),
      ),
    );
  }
  override shouldRelayout(old: SingleChildLayoutDelegate): boolean {
    return (
      !(old instanceof TextSelectionToolbarLayoutDelegate) ||
      !old.anchorAbove.equals(this.anchorAbove) ||
      !old.anchorBelow.equals(this.anchorBelow) ||
      old.fitsAbove !== this.fitsAbove
    );
  }
}
