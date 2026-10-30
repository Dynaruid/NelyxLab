// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../../foundation/errors.ts';
import { ImageFilter } from '../../ui/image-filter.ts';
import { RenderImageFiltered } from '../rendering/filter.ts';
import { SingleChildRenderObjectWidget } from './framework.ts';
import type { Widget, WidgetOptions, BuildContext } from './framework.ts';
import type { RenderObject } from '../rendering/object.ts';
export interface ImageFilteredOptions extends WidgetOptions {
  readonly imageFilter: ImageFilter;
  readonly enabled?: boolean;
}
export class ImageFiltered extends SingleChildRenderObjectWidget {
  readonly imageFilter: ImageFilter;
  readonly enabled: boolean;
  constructor(child: Widget | undefined, options: ImageFilteredOptions) {
    super(child, options);
    invariant(
      options.imageFilter instanceof ImageFilter,
      'invalid-image-filter',
      'Expected ImageFilter',
    );
    invariant(
      options.enabled === undefined || typeof options.enabled === 'boolean',
      'invalid-filter-enabled',
      'enabled must be boolean',
    );
    this.imageFilter = options.imageFilter;
    this.enabled = options.enabled ?? true;
  }
  createRenderObject(): RenderImageFiltered {
    return new RenderImageFiltered({ imageFilter: this.imageFilter, enabled: this.enabled });
  }
  updateRenderObject(_context: BuildContext, render: RenderObject): void {
    invariant(
      render instanceof RenderImageFiltered,
      'invalid-filter-render',
      'ImageFiltered requires RenderImageFiltered',
    );
    render.imageFilter = this.imageFilter;
    render.enabled = this.enabled;
  }
}
