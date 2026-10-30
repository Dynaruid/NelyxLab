// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// RenderProxySliver/RenderSliverAnimatedOpacity from pinned rendering/proxy_sliver.dart.
import { RenderSliver, SliverPhysicalParentData } from './sliver.ts';
import type { SliverConstraints, SliverHitTestResult, SliverHitPosition } from './sliver.ts';
import { RenderObject, SemanticsAnnotationsMixin } from './object.ts';
import type { SemanticsProperties } from '../semantics/semantics.ts';
import type { Locale } from '../../ui/locale.ts';
import type { PaintingContext } from '../painting/context.ts';
import { invariant } from '../../foundation/errors.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import type { Matrix4 } from '../../math/matrix4.ts';
import type { Rect } from '../../ui/types.ts';
import { RenderAnimatedOpacityMixin } from './animated-opacity.ts';
import type { Animation } from '../animation/animation.ts';

export abstract class RenderProxySliver extends RenderSliver {
  constructor(child: RenderSliver | null = null) {
    super();
    this.child = child;
  }
  protected override get childCountLimit(): number {
    return 1;
  }
  get child(): RenderSliver | null {
    return (this.children[0] as RenderSliver) ?? null;
  }
  set child(value: RenderSliver | null) {
    this.setChildren(value === null ? [] : [value]);
  }
  override setChildren(children: readonly RenderObject[]): void {
    invariant(
      children.every((child) => child instanceof RenderSliver),
      'invalid-proxy-sliver-child',
      'Proxy sliver requires a RenderSliver',
    );
    super.setChildren(children);
  }
  override insert(child: RenderObject, after?: RenderObject): void {
    invariant(
      child instanceof RenderSliver,
      'invalid-proxy-sliver-child',
      'Proxy sliver requires a RenderSliver',
    );
    super.insert(child, after);
  }
  override get semanticBounds(): Rect {
    return this.child?.semanticBounds ?? super.semanticBounds;
  }
  override setupParentData(child: RenderObject): void {
    if (!(child.parentData instanceof SliverPhysicalParentData))
      child.parentData = new SliverPhysicalParentData();
  }
  protected override performLayout(constraints: SliverConstraints): void {
    const child = this.child;
    invariant(
      child !== null,
      'missing-proxy-sliver-child',
      'Proxy sliver requires a child during layout',
    );
    child.layout(constraints, { parentUsesSize: true });
    this.geometry = child.geometry;
  }
  override paint(context: PaintingContext): void {
    if (this.child !== null) this.paintChild(context, this.child);
  }
  protected override hitTestChildren(
    result: SliverHitTestResult,
    position: SliverHitPosition,
  ): boolean {
    return (
      this.child !== null &&
      this.child.geometry!.hitTestExtent > 0 &&
      this.child.hitTest(result, position)
    );
  }
  protected override childMainAxisPosition(child: RenderSliver): number {
    if (FoundationBuildMode.debug)
      invariant(
        child === this.child,
        'invalid-proxy-sliver-child',
        'Main axis position requires the proxy child',
      );
    return 0;
  }
  applyPaintTransform(child: RenderObject, transform: Matrix4): void {
    const data = child.parentData;
    invariant(
      data instanceof SliverPhysicalParentData,
      'invalid-proxy-sliver-parent-data',
      'Proxy sliver child requires physical parent data',
    );
    data.applyPaintTransform(transform);
  }
}
export interface RenderSliverAnimatedOpacityOptions {
  readonly opacity: Animation<number>;
  readonly alwaysIncludeSemantics?: boolean;
  readonly sliver?: RenderSliver | null;
}
export interface RenderSliverSemanticsAnnotationsOptions {
  readonly child?: RenderSliver | null;
  readonly properties: SemanticsProperties;
  readonly container?: boolean;
  readonly explicitChildNodes?: boolean;
  readonly excludeSemantics?: boolean;
  readonly blockUserActions?: boolean;
  readonly localeForSubtree?: Locale | null;
  readonly textDirection?: 'ltr' | 'rtl' | null;
}
export class RenderSliverSemanticsAnnotations extends SemanticsAnnotationsMixin(RenderProxySliver) {
  constructor({
    child = null,
    properties,
    container = false,
    explicitChildNodes = false,
    excludeSemantics = false,
    blockUserActions = false,
    localeForSubtree = null,
    textDirection = null,
  }: RenderSliverSemanticsAnnotationsOptions) {
    super(child);
    this.initSemanticsAnnotations({
      properties,
      container,
      explicitChildNodes,
      excludeSemantics,
      blockUserActions,
      localeForSubtree,
      textDirection,
    });
  }
}
export class RenderSliverAnimatedOpacity extends RenderAnimatedOpacityMixin(RenderProxySliver) {
  constructor({
    opacity,
    alwaysIncludeSemantics = false,
    sliver = null,
  }: RenderSliverAnimatedOpacityOptions) {
    super();
    this.opacity = opacity;
    this.alwaysIncludeSemantics = alwaysIncludeSemantics;
    this.child = sliver;
  }
}
