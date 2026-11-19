// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/spell_check_suggestions_toolbar_layout_delegate.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import type { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { SingleChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { TextSelectionToolbarLayoutDelegate } from '@nelyx/core/framework/widgets/text-selection-toolbar-layout-delegate';
import type { Offset, Size } from '@nelyx/core/ui/geometry';

export class SpellCheckSuggestionsToolbarLayoutDelegate extends SingleChildLayoutDelegate {
  readonly anchor: Offset;
  constructor({ anchor }: { readonly anchor: Offset }) {
    super();
    this.anchor = anchor;
  }
  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    return constraints.loosen();
  }
  override getPositionForChild(size: Size, childSize: Size): Offset {
    return {
      x: TextSelectionToolbarLayoutDelegate.centerOn(this.anchor.x, childSize.width, size.width),
      y: Math.min(this.anchor.y, size.height - childSize.height),
    };
  }
  override shouldRelayout(old: SpellCheckSuggestionsToolbarLayoutDelegate): boolean {
    return this.anchor.x !== old.anchor.x || this.anchor.y !== old.anchor.y;
  }
}
