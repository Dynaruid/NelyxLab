// SPDX-License-Identifier: BSD-3-Clause
import type { BuildContext, Widget } from './framework.ts';
import { Navigator } from './navigation.ts';
import { PageRouteBuilder, RouteSettings } from './pages.ts';
import { Center, Builder } from './basic.ts';
import { Color } from '../../ui/color.ts';
import { InheritedTheme } from './inherited-theme.ts';
import { TraversalEdgeBehavior } from './focus-traversal-policy.ts';
import { FadeTransition } from './transitions.ts';
export interface DialogRouteOptions {
  readonly builder: (context: BuildContext) => Widget;
  readonly barrierDismissible?: boolean;
  readonly barrierColor?: number;
  readonly barrierLabel?: string | null;
  readonly name?: string;
  readonly requestFocus?: boolean;
  readonly transitionDuration?: number;
  readonly reverseTransitionDuration?: number;
}
export interface DialogOptions extends DialogRouteOptions {
  readonly useRootNavigator?: boolean;
}
/** Shared presentation policy for Core and design APIs that already own a Navigator. */
export function createDialogRoute<T = unknown>({
  builder,
  barrierDismissible = true,
  barrierColor = 0x88000000,
  barrierLabel = null,
  name = 'dialog',
  requestFocus = true,
  transitionDuration = 150,
  reverseTransitionDuration = 150,
}: DialogRouteOptions): PageRouteBuilder<T> {
  return new PageRouteBuilder<T>({
    settings: new RouteSettings({ name }),
    opaque: false,
    barrierDismissible,
    barrierColor: new Color(barrierColor),
    barrierLabel,
    requestFocus,
    traversalEdgeBehavior: TraversalEdgeBehavior.closedLoop,
    transitionDuration,
    reverseTransitionDuration,
    pageBuilder: () => new Center(new Builder(builder)),
    transitionsBuilder: (_context, animation, _secondary, child) =>
      new FadeTransition({ opacity: animation, child }),
  });
}
/** Dialogs are non-opaque routes, so Back/results/focus and State retention have one owner. */
export function showDialog<T = unknown>(
  context: BuildContext,
  { builder, useRootNavigator = true, ...options }: DialogOptions,
): Promise<T | undefined> {
  const navigator = Navigator.of(context, { rootNavigator: useRootNavigator }),
    themes = InheritedTheme.capture(context);
  return navigator.push(
    createDialogRoute<T>({ ...options, builder: () => themes.wrap(new Builder(builder)) }),
  );
}
