// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/popup_menu.dart, dropdown.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import type { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { SingleChildRenderObjectWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import type { Size } from '@nelyx/core/ui/geometry';

export class MenuItemMeasure extends SingleChildRenderObjectWidget {
  constructor(
    child: Widget,
    readonly onLayout: (size: Size) => void,
  ) {
    super(child);
  }
  override createRenderObject(): RenderMenuItemMeasure {
    return new RenderMenuItemMeasure(this.onLayout);
  }
  override updateRenderObject(_context: BuildContext, render: RenderObject): void {
    if (render instanceof RenderMenuItemMeasure) render.onLayout = this.onLayout;
  }
}
class RenderMenuItemMeasure extends RenderProxyBox {
  constructor(public onLayout: (size: Size) => void) {
    super();
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const size = super.performLayout(constraints);
    this.onLayout(size);
    return size;
  }
}
