// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../../foundation/errors.ts';
import { InheritedWidget, StatelessWidget, InheritedElement } from './framework.ts';
import type { Widget, BuildContext } from './framework.ts';

export abstract class InheritedTheme extends InheritedWidget {
  abstract wrap(context: BuildContext, child: Widget): Widget;
  static capture(from: BuildContext, to?: BuildContext): CapturedThemes {
    if (from === to) return new CapturedThemes([]);
    const themes: InheritedTheme[] = [],
      types = new Set<object>();
    let found = !to;
    from.visitAncestorElements((element) => {
      if (element === to) {
        found = true;
        return false;
      }
      if (
        element instanceof InheritedElement &&
        element.widget instanceof InheritedTheme &&
        !types.has(element.widget.typeToken)
      ) {
        types.add(element.widget.typeToken);
        themes.push(element.widget);
      }
      return true;
    });
    invariant(
      found,
      'theme-capture-ancestor',
      'Theme capture target must be an ancestor of the source',
    );
    return new CapturedThemes(themes);
  }
  static captureAll(context: BuildContext, child: Widget, to?: BuildContext): Widget {
    return this.capture(context, to).wrap(child);
  }
}
export class CapturedThemes {
  private readonly themes: readonly InheritedTheme[];
  constructor(themes: readonly InheritedTheme[]) {
    this.themes = Object.freeze([...themes]);
  }
  wrap(child: Widget): Widget {
    return new CapturedThemeWidget(this.themes, child);
  }
}
class CapturedThemeWidget extends StatelessWidget {
  constructor(
    readonly themes: readonly InheritedTheme[],
    readonly child: Widget,
  ) {
    super();
  }
  build(context: BuildContext): Widget {
    let child = this.child;
    for (const theme of this.themes) child = theme.wrap(context, child);
    return child;
  }
}
