// SPDX-License-Identifier: BSD-3-Clause
import { InheritedWidget } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import type { Animation } from '../animation/animation.ts';

/** Locates route content on both sides of its visual transition. */
export class RouteContentGeometry extends InheritedWidget {
  constructor(
    readonly outside: BuildContext,
    readonly inside: BuildContext,
    readonly animation: Animation<number>,
    child: Widget,
  ) {
    super(child);
  }

  override updateShouldNotify(old: RouteContentGeometry): boolean {
    return (
      old.outside !== this.outside || old.inside !== this.inside || old.animation !== this.animation
    );
  }
}
