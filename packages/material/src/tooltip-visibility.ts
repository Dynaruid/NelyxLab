// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter material/tooltip_visibility.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { InheritedWidget, StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
class TooltipVisibilityScope extends InheritedWidget {
  constructor(
    readonly visible: boolean,
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: this): boolean {
    return this.visible !== old.visible;
  }
}
export class TooltipVisibility extends StatelessWidget {
  constructor(
    readonly visible: boolean,
    readonly child: Widget,
    options: WidgetOptions = {},
  ) {
    super(options.key ?? null);
  }
  static of(context: BuildContext): boolean {
    return context.maybeDependOn(TooltipVisibilityScope)?.visible ?? true;
  }
  build(): Widget {
    return new TooltipVisibilityScope(this.visible, this.child);
  }
}
