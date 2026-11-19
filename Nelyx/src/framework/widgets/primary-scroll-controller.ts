// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Status bar handling follows Flutter's CupertinoPageScaffold and Scaffold at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { InheritedWidget } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { MetaData } from './basic.ts';
import type { Curve } from '../animation/curves.ts';
import type { HitTestResult } from '../gestures/hit-test.ts';
import { Axis } from '../painting/basic-types.ts';
import { RenderMetaData } from '../rendering/meta-data.ts';
import { HitTestBehavior } from '../rendering/pointer-listener.ts';
import { FoundationPlatform } from '../../foundation/platform.ts';
import type { TargetPlatform } from '../../foundation/platform.ts';
import { ScrollConfiguration } from './scroll-configuration.ts';
import type { ScrollController } from './scroll-controller.ts';
import { invariant } from '../../foundation/errors.ts';
import { protect } from '../../ui/value-math.ts';
export interface PrimaryScrollControllerOptions extends WidgetOptions {
  readonly controller: ScrollController | null;
  readonly automaticallyInheritForPlatforms?: ReadonlySet<TargetPlatform>;
  readonly scrollDirection?: Axis | null;
  readonly child: Widget;
}

class StatusBarScrollTarget {
  constructor(
    readonly controller: ScrollController | null,
    readonly duration: number,
    readonly curve: Curve,
  ) {}
}

export function withStatusBarScrollTarget(
  context: BuildContext,
  child: Widget,
  duration: number,
  curve: Curve,
): Widget {
  if (FoundationPlatform.defaultTargetPlatform !== 'iOS' || FoundationPlatform.isWeb) return child;
  return new MetaData(child, {
    behavior: HitTestBehavior.translucent,
    metaData: new StatusBarScrollTarget(PrimaryScrollController.maybeOf(context), duration, curve),
  });
}

export function scrollToTopFromStatusBar(hit: HitTestResult): Promise<void> | undefined {
  for (const { target } of hit.path) {
    if (!(target instanceof RenderMetaData) || !(target.metaData instanceof StatusBarScrollTarget))
      continue;
    const { controller, duration, curve } = target.metaData;
    return controller?.hasClients ? controller.animateTo(0, { duration, curve }) : undefined;
  }
  return undefined;
}
/** The nullable constructor field merges Source's ordinary and none named constructors. */
export class PrimaryScrollController extends InheritedWidget {
  readonly controller: ScrollController | null;
  readonly scrollDirection: Axis | null;
  readonly automaticallyInheritForPlatforms: ReadonlySet<TargetPlatform>;
  constructor({
    controller,
    automaticallyInheritForPlatforms = new Set<TargetPlatform>(['android', 'iOS', 'fuchsia']),
    scrollDirection = Axis.vertical,
    child,
    ...options
  }: PrimaryScrollControllerOptions) {
    super(child, options.key ?? null);
    this.controller = controller;
    this.scrollDirection = scrollDirection;
    this.automaticallyInheritForPlatforms = new Set(automaticallyInheritForPlatforms);
    protect(this, ['controller', 'scrollDirection', 'automaticallyInheritForPlatforms']);
  }
  static none({
    child,
    ...options
  }: WidgetOptions & { readonly child: Widget }): PrimaryScrollController {
    return new PrimaryScrollController({
      ...options,
      child,
      controller: null,
      automaticallyInheritForPlatforms: new Set(),
      scrollDirection: null,
    });
  }
  static shouldInherit(context: BuildContext, scrollDirection: Axis): boolean {
    const result = context.findAncestorWidgetOfExactType(PrimaryScrollController);
    return (
      result !== undefined &&
      result.automaticallyInheritForPlatforms.has(
        ScrollConfiguration.of(context).getPlatform(context),
      ) &&
      result.scrollDirection === scrollDirection
    );
  }
  static maybeOf(context: BuildContext): ScrollController | null {
    return context.maybeDependOn(PrimaryScrollController)?.controller ?? null;
  }
  static of(context: BuildContext): ScrollController {
    const controller = this.maybeOf(context);
    invariant(
      controller,
      'missing-primary-scroll-controller',
      'PrimaryScrollController.of requires an inherited controller',
    );
    return controller;
  }
  updateShouldNotify(old: this): boolean {
    return this.controller !== old.controller;
  }
}
