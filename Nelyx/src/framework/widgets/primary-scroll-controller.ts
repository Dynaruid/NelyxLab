// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InheritedWidget } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { Axis } from '../painting/basic-types.ts';
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
