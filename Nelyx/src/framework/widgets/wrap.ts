// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../../foundation/errors.ts';
import { MultiChildRenderObjectWidget } from './framework.ts';
import type { Widget, BuildContext, WidgetOptions } from './framework.ts';
import { Directionality } from './app-data.ts';
import { RenderWrap } from '../rendering/wrap.ts';
import type {
  RenderWrapOptions,
  WrapAlignment,
  WrapCrossAlignment,
  WrapClipBehavior,
} from '../rendering/wrap.ts';
import type { RenderObject } from '../rendering/object.ts';
export interface WrapOptions extends Omit<RenderWrapOptions, 'children'>, WidgetOptions {}
export class Wrap extends MultiChildRenderObjectWidget {
  readonly direction: 'horizontal' | 'vertical';
  readonly alignment: WrapAlignment;
  readonly spacing: number;
  readonly runAlignment: WrapAlignment;
  readonly runSpacing: number;
  readonly crossAxisAlignment: WrapCrossAlignment;
  readonly textDirection: 'ltr' | 'rtl' | null;
  readonly verticalDirection: 'up' | 'down';
  readonly clipBehavior: WrapClipBehavior;
  constructor(children: readonly Widget[] = [], options: WrapOptions = {}) {
    super(children, options);
    this.direction = options.direction ?? 'horizontal';
    this.alignment = options.alignment ?? 'start';
    this.spacing = options.spacing ?? 0;
    this.runAlignment = options.runAlignment ?? 'start';
    this.runSpacing = options.runSpacing ?? 0;
    this.crossAxisAlignment = options.crossAxisAlignment ?? 'start';
    this.textDirection = options.textDirection ?? null;
    this.verticalDirection = options.verticalDirection ?? 'down';
    this.clipBehavior = options.clipBehavior ?? 'none';
  }
  private options(context: BuildContext): RenderWrapOptions {
    return {
      direction: this.direction,
      alignment: this.alignment,
      spacing: this.spacing,
      runAlignment: this.runAlignment,
      runSpacing: this.runSpacing,
      crossAxisAlignment: this.crossAxisAlignment,
      textDirection: this.textDirection ?? context.maybeDependOn(Directionality)?.direction ?? null,
      verticalDirection: this.verticalDirection,
      clipBehavior: this.clipBehavior,
    };
  }
  createRenderObject(context: BuildContext): RenderWrap {
    return new RenderWrap(this.options(context));
  }
  updateRenderObject(context: BuildContext, render: RenderObject): void {
    invariant(
      render instanceof RenderWrap,
      'invalid-wrap-render-object',
      'Wrap requires RenderWrap',
    );
    const options = this.options(context);
    render.direction = options.direction!;
    render.alignment = options.alignment!;
    render.spacing = options.spacing!;
    render.runAlignment = options.runAlignment!;
    render.runSpacing = options.runSpacing!;
    render.crossAxisAlignment = options.crossAxisAlignment!;
    render.textDirection = options.textDirection!;
    render.verticalDirection = options.verticalDirection!;
    render.clipBehavior = options.clipBehavior!;
  }
}
