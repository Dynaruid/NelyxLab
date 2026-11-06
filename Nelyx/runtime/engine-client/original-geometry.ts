// SPDX-License-Identifier: BSD-3-Clause
import { bindNativePublishedGeometry } from '@nelyx/core/framework/rendering/object';
import type { NativePublishedGeometry, RenderObject } from '@nelyx/core/framework/rendering/object';
import { fullTransform } from '@nelyx/core/ui/geometry';
import type { EngineResponse, NodeHandle } from './codec.ts';

/** A single published observation, fenced by native owner, handle and device/metrics. */
export class OriginalGeometryBridge {
  private frame: EngineResponse | undefined;
  private state: EngineResponse | undefined;
  private closed = false;
  constructor(
    private readonly owner: object,
    private readonly handle: (render: RenderObject) => NodeHandle | null,
  ) {}
  observePublication(state: EngineResponse): void {
    if (!this.closed) this.frame = state;
  }
  observeState(state: EngineResponse): void {
    if (!this.closed) this.state = state;
  }
  bind(render: RenderObject): void {
    bindNativePublishedGeometry(render, this.owner, () => this.read(render));
  }
  private read(render: RenderObject): NativePublishedGeometry | undefined {
    const frame = this.frame,
      state = this.state,
      handle = this.handle(render);
    if (
      this.closed ||
      render.debugDisposed ||
      !handle ||
      !frame ||
      !state ||
      !state.visible ||
      frame.publishedMetrics !== state.metrics ||
      frame.publishedDevice !== state.device ||
      !frame.publication
    )
      return undefined;
    const node = frame.nodes.find(
      (node) => node.node.slot === handle.slot && node.node.generation === handle.generation,
    );
    if (!node) return undefined;
    return Object.freeze({
      owner: this.owner,
      snapshot: frame,
      publication: frame.publication,
      size: Object.freeze({ width: node.width, height: node.height }),
      transform: fullTransform(node.matrix),
      ...(node.layerComposition
        ? {
            layer: Object.freeze({
              kind: node.layerComposition.kind,
              linked: node.layerComposition.linked,
              showWhenUnlinked: node.layerComposition.showWhenUnlinked,
              transform: node.layerComposition.transform
                ? fullTransform(node.layerComposition.transform)
                : null,
              linkedOffset: node.layerComposition.linkedOffset,
            }),
          }
        : {}),
    });
  }
  close(): void {
    this.closed = true;
    this.frame = this.state = undefined;
  }
}
