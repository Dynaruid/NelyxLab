// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/indexed_stack.dart at the recorded pin.
import { invariant } from '../../foundation/errors.ts';
import { identity } from '../../ui/geometry.ts';
import type { TransformMatrix } from '../../ui/geometry.ts';
import type { Rect, SemanticsNode } from '../../ui/types.ts';
import { RenderProxyBox } from '../rendering/boxes.ts';
import type { RenderBox, RenderObject } from '../rendering/object.ts';
import type { PaintingContext } from '../painting/context.ts';
import { StatelessWidget, SingleChildRenderObjectWidget } from './framework.ts';
import type { Widget, WidgetOptions, BuildContext, InheritedElement } from './framework.ts';
import { SizedBox } from './basic.ts';
import { ExcludeFocus } from './focus-scope.ts';
import { TickerMode } from './ticker-mode.ts';
import { Offstage } from './offstage.ts';
import { IgnorePointer } from './pointer-blocking.ts';
import { _VisibilityScope } from './visibility-scope.ts';
export interface VisibilityOptions extends WidgetOptions {
  readonly replacement?: Widget;
  readonly visible?: boolean;
  readonly maintainState?: boolean;
  readonly maintainAnimation?: boolean;
  readonly maintainSize?: boolean;
  readonly maintainSemantics?: boolean;
  readonly maintainInteractivity?: boolean;
  readonly maintainFocusability?: boolean;
}
export class Visibility extends StatelessWidget {
  readonly replacement: Widget;
  readonly visible: boolean;
  readonly maintainState: boolean;
  readonly maintainAnimation: boolean;
  readonly maintainSize: boolean;
  readonly maintainSemantics: boolean;
  readonly maintainInteractivity: boolean;
  readonly maintainFocusability: boolean;
  constructor(
    readonly child: Widget,
    {
      key = null,
      replacement = new SizedBox(0, 0),
      visible = true,
      maintainState = false,
      maintainAnimation = false,
      maintainSize = false,
      maintainSemantics = false,
      maintainInteractivity = false,
      maintainFocusability = false,
    }: VisibilityOptions = {},
  ) {
    super(key);
    for (const value of [
      visible,
      maintainState,
      maintainAnimation,
      maintainSize,
      maintainSemantics,
      maintainInteractivity,
      maintainFocusability,
    ])
      invariant(
        typeof value === 'boolean',
        'invalid-visibility',
        'Visibility flags must be boolean',
      );
    invariant(
      maintainState || !maintainAnimation,
      'invalid-visibility',
      'Cannot maintain animations without state',
    );
    invariant(
      maintainAnimation || !maintainSize,
      'invalid-visibility',
      'Cannot maintain size without animations',
    );
    invariant(
      maintainSize || !maintainSemantics,
      'invalid-visibility',
      'Cannot maintain semantics without size',
    );
    invariant(
      maintainSize || !maintainInteractivity,
      'invalid-visibility',
      'Cannot maintain interactivity without size',
    );
    invariant(
      maintainState || !maintainFocusability,
      'invalid-visibility',
      'Cannot maintain focusability without state',
    );
    this.replacement = replacement;
    this.visible = visible;
    this.maintainState = maintainState;
    this.maintainAnimation = maintainAnimation;
    this.maintainSize = maintainSize;
    this.maintainSemantics = maintainSemantics;
    this.maintainInteractivity = maintainInteractivity;
    this.maintainFocusability = maintainFocusability;
  }
  static maintain(
    child: Widget,
    { key = null, visible = true }: Pick<VisibilityOptions, 'key' | 'visible'> = {},
  ): Visibility {
    return new Visibility(child, {
      key,
      visible,
      maintainState: true,
      maintainAnimation: true,
      maintainSize: true,
      maintainSemantics: true,
      maintainInteractivity: true,
      maintainFocusability: true,
    });
  }
  static of(context: BuildContext): boolean {
    let visible = true,
      ancestor: InheritedElement | undefined =
        context.getElementForInheritedWidgetOfExactType(_VisibilityScope);
    while (visible && ancestor) {
      visible = context.dependOnInheritedElement<_VisibilityScope>(ancestor).isVisible;
      ancestor = ancestor.getElementForInheritedWidgetOfExactType(_VisibilityScope);
    }
    return visible;
  }
  build(_context?: BuildContext): Widget {
    let result: Widget = new ExcludeFocus(this.child, {
      excluding: !this.visible && !this.maintainFocusability,
    });
    if (this.maintainSize)
      result = new _Visibility(
        this.visible,
        this.maintainSemantics,
        new IgnorePointer(result, { ignoring: !this.visible && !this.maintainInteractivity }),
      );
    else if (this.maintainState) {
      if (!this.maintainAnimation) result = new TickerMode(this.visible, result);
      result = new Offstage(result, { offstage: !this.visible });
    } else result = this.visible ? this.child : this.replacement;
    return new _VisibilityScope(this.visible, result);
  }
}
class _Visibility extends SingleChildRenderObjectWidget {
  constructor(
    readonly visible: boolean,
    readonly maintainSemantics: boolean,
    child: Widget,
  ) {
    super(child);
  }
  createRenderObject(_context: BuildContext): _RenderVisibility {
    return new _RenderVisibility(this.visible, this.maintainSemantics);
  }
  override updateRenderObject(_context: BuildContext, render: RenderBox): void {
    invariant(
      render instanceof _RenderVisibility,
      'invalid-visibility-render',
      'Visibility requires its own render object',
    );
    render.visible = this.visible;
    render.maintainSemantics = this.maintainSemantics;
  }
}
class _RenderVisibility extends RenderProxyBox {
  private _visible: boolean;
  private _maintainSemantics: boolean;
  constructor(visible: boolean, maintainSemantics: boolean) {
    super();
    this._visible = visible;
    this._maintainSemantics = maintainSemantics;
  }
  get visible(): boolean {
    return this._visible;
  }
  set visible(value: boolean) {
    this.assertCanMutateLayoutProperty();
    invariant(typeof value === 'boolean', 'invalid-visibility', 'visible must be boolean');
    if (value === this._visible) return;
    this._visible = value;
    this.markNeedsPaint();
  }
  get maintainSemantics(): boolean {
    return this._maintainSemantics;
  }
  set maintainSemantics(value: boolean) {
    this.assertCanMutateLayoutProperty();
    invariant(
      typeof value === 'boolean',
      'invalid-visibility',
      'maintainSemantics must be boolean',
    );
    if (value === this._maintainSemantics) return;
    this._maintainSemantics = value;
    this.markNeedsPaint();
  }
  visitChildrenForSemantics(visitor: (child: RenderObject) => void): void {
    if ((this.maintainSemantics || this.visible) && this.child) visitor(this.child);
  }
  override collectSemantics(
    output: SemanticsNode[],
    matrix: TransformMatrix = identity,
    clip?: Rect,
  ): void {
    if (this.maintainSemantics || this.visible) super.collectSemantics(output, matrix, clip);
  }
  override paint(context: PaintingContext): void {
    if (this.visible) super.paint(context);
  }
}
