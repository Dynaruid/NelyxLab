// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../../foundation/errors.ts';
import { ColorFilter } from '../../ui/color-filter.ts';
import { RenderColorFiltered } from '../rendering/filter.ts';
import { SingleChildRenderObjectWidget } from './framework.ts';
import type { Widget, WidgetOptions, BuildContext } from './framework.ts';
import type { RenderObject } from '../rendering/object.ts';
export interface ColorFilteredOptions extends WidgetOptions {
  readonly colorFilter: ColorFilter;
}
export class ColorFiltered extends SingleChildRenderObjectWidget {
  readonly colorFilter: ColorFilter;
  constructor(child: Widget | undefined, options: ColorFilteredOptions) {
    super(child, options);
    invariant(
      options.colorFilter instanceof ColorFilter,
      'invalid-color-filter',
      'Expected ColorFilter',
    );
    this.colorFilter = options.colorFilter;
  }
  createRenderObject(): RenderColorFiltered {
    return new RenderColorFiltered({ colorFilter: this.colorFilter });
  }
  updateRenderObject(_context: BuildContext, render: RenderObject): void {
    invariant(
      render instanceof RenderColorFiltered,
      'invalid-filter-render',
      'ColorFiltered requires RenderColorFiltered',
    );
    render.colorFilter = this.colorFilter;
  }
}
