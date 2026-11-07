// SPDX-License-Identifier: BSD-3-Clause
import { MultiChildRenderObjectWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { SliverMultiBoxAdaptorParentData } from '@nelyx/core/framework/rendering/sliver-multi-box-adaptor';
import type { NodeOptions, NodeWidget } from './widgets.ts';
export interface NativeEditableBody {
  readonly text: NonNullable<NodeWidget['text']>;
  readonly editor: NonNullable<NodeWidget['editor']>;
  readonly flags: number;
  readonly maximumLength: number;
}
type NativeKind = NodeWidget['kind'];
/** Native configuration only. No Source layout/paint override runs on App. */
export class OriginalNativeRender extends RenderBox {
  constructor(
    public kind: NativeKind,
    public options: NodeOptions,
    public editable?: NativeEditableBody,
  ) {
    super();
  }
  override setupParentData(child: RenderObject): void {
    if (this.kind === 'sliver' || this.options.listItem) {
      if (!(child.parentData instanceof SliverMultiBoxAdaptorParentData))
        child.parentData = new SliverMultiBoxAdaptorParentData();
    } else super.setupParentData(child);
  }
}
export class OriginalNativeNode extends MultiChildRenderObjectWidget {
  constructor(
    readonly kind: NativeKind,
    children: readonly Widget[],
    readonly options: NodeOptions = {},
    readonly capture?: (render: OriginalNativeRender) => void,
    readonly editable?: NativeEditableBody,
  ) {
    super(children, { key: options.key ?? null });
  }
  createRenderObject(): OriginalNativeRender {
    const render = new OriginalNativeRender(this.kind, this.options, this.editable);
    this.capture?.(render);
    return render;
  }
  override updateRenderObject(_context: BuildContext, render: RenderObject): void {
    const node = render as OriginalNativeRender;
    node.kind = this.kind;
    node.options = this.options;
    node.editable = this.editable;
    this.capture?.(node);
  }
}
