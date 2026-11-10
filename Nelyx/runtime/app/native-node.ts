// SPDX-License-Identifier: BSD-3-Clause
import { MultiChildRenderObjectWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { RenderBox, RenderObject } from '@nelyx/core/framework/rendering/object';
import { SliverMultiBoxAdaptorParentData } from '@nelyx/core/framework/rendering/sliver-multi-box-adaptor';
import type { SceneNodeOptions, SceneNode } from '../engine-client/scene.ts';
import type { Key } from '@nelyx/core/foundation/key';
interface NodeOptions extends SceneNodeOptions {
  readonly key?: Key;
  /** Source box adapters retain their non-box RenderObjects under this owner. */
  readonly sliverChildren?: boolean;
  /** A source sliver delegate keeps its actual KeepAlive parent-data contract. */
  readonly keepAliveChildren?: boolean;
  readonly sourceCollectionIndex?: number;
  /** Retain the Source element/state while excluding its children from Content. */
  readonly parkedChildren?: boolean;
  readonly onChildrenInvalidated?: () => void;
}
export interface NativeEditableBody {
  readonly text: NonNullable<SceneNode['text']>;
  readonly editor: NonNullable<SceneNode['editor']>;
  readonly flags: number;
  readonly maximumLength: number;
}
type NativeKind = SceneNode['kind'];
/** Native configuration only. No Source layout/paint override runs on App. */
export class OriginalNativeRender extends RenderBox<RenderObject> {
  constructor(
    public kind: NativeKind,
    public options: NodeOptions,
    public editable?: NativeEditableBody,
  ) {
    super(kind === 'scrollViewport' || options.sliverChildren ? { childType: RenderObject } : {});
  }
  override setupParentData(child: RenderObject): void {
    if (this.kind === 'sliver' || this.options.listItem || this.options.keepAliveChildren) {
      if (!(child.parentData instanceof SliverMultiBoxAdaptorParentData))
        child.parentData = new SliverMultiBoxAdaptorParentData();
    } else super.setupParentData(child);
  }
  override paintsChild(child: RenderObject): boolean {
    // Ink features inspect the Source ancestor chain even when their State is
    // kept alive. It must describe the same children as the native projection.
    return super.paintsChild(child) && !this.options.parkedChildren;
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
    // This bridge has no TS PipelineOwner. Retained scene capture must still
    // observe native configuration/callback replacement on the render object.
    node.markNeedsLayout();
    this.capture?.(node);
  }
}
