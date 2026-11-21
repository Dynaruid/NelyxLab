// SPDX-License-Identifier: BSD-3-Clause
import { LayerHandle, OffsetLayer } from './layer.ts';
import type { RenderObject } from './object.ts';
import type { PaintingContext } from '../painting/context.ts';

// PaintingContext owns boundary recording for every Source RenderObject,
// including viewports and user-defined boundaries. The render owner retires
// its recording on detach; submitted frames retain their independent leases.
const boundaries = new WeakMap<RenderObject, RetainedPaint>();
class RetainedPaint {
  private version = -1;
  private contentsVersion = -1;
  private nested: RetainedPaint[] = [];
  readonly retained = new LayerHandle<OffsetLayer>();
  constructor(readonly render: RenderObject) {}
  get currentLayer(): OffsetLayer | null {
    return this.version === this.render.paintVersion ? this.retained.layer : null;
  }
  refresh(context: PaintingContext): void {
    const render = this.render,
      diagnostics = context.diagnosticCounts;
    if (diagnostics) diagnostics.boundaryVisits++;
    render._finishPaintInvalidationBatch();
    // A paint hook may invalidate another frame. Never acknowledge the
    // versions after that hook as if its unseen changes had been painted.
    const version = render.paintVersion,
      contentsVersion = render.paintContentsVersion;
    if (this.contentsVersion !== contentsVersion || !this.retained.layer) {
      if (diagnostics) diagnostics.boundaryRecordings++;
      const layer = this.retained.layer ?? new OffsetLayer(),
        hold = new LayerHandle(layer);
      try {
        context._recordLayerContents(
          layer,
          (recording) => render.paint(recording),
          render.paintBounds,
        );
        if (render.owner && !context.recordsLayers && !layer.attached) layer.attach(render.owner);
        this.retained.layer = layer;
        this.contentsVersion = contentsVersion;
        const nested: RetainedPaint[] = [];
        const visit = (parent: RenderObject): void => {
          parent.visitChildren((child) => {
            if (!parent.paintsChild(child)) return;
            if (child.isRepaintBoundary) {
              const boundary = boundaries.get(child);
              if (boundary) nested.push(boundary);
            } else visit(child);
          });
        };
        visit(render);
        this.nested = nested;
      } finally {
        hold.dispose();
      }
    } else {
      if (diagnostics) diagnostics.boundaryReuses++;
      if (this.version !== version)
        for (const child of this.nested)
          if (child.version !== child.render.paintVersion) child.refresh(context);
    }
    this.version = version;
    render._didPaint();
  }
  retireHidden(): void {
    if (!this.retained.layer || this.contentsVersion === this.render.paintContentsVersion) return;
    for (let node = this.render; node.parent; node = node.parent)
      if (!node.parent.paintsChild(node)) {
        this.version = this.contentsVersion = -1;
        this.nested = [];
        this.retained.layer.removeAllChildren();
        this.retained.layer._discardRetainedScene();
        return;
      }
  }
  dispose(): void {
    const old = this.retained.layer;
    this.version = this.contentsVersion = -1;
    this.nested = [];
    const errors: unknown[] = [];
    for (const retire of [
      () => old?.remove(),
      () => {
        if (old?.attached) old.detach();
      },
      () => this.retained.dispose(),
    ])
      try {
        retire();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Render boundary retirement failed');
  }
}
/** The View root has the same implicit recording boundary as a Source RenderView. */
export function paintRenderObject(
  render: RenderObject,
  context: PaintingContext,
  root = false,
): void {
  if (root || render.isRepaintBoundary) paintRepaintBoundary(render, context, 0, 0);
  else {
    // A dynamic boundary can become an ordinary render object on this frame.
    disposeRetainedPaint(render);
    render.paint(context);
    render._didPaint();
  }
}
/** @internal A Source repaint boundary can move independently of its recording. */
export function paintRepaintBoundary(
  render: RenderObject,
  context: PaintingContext,
  x: number,
  y: number,
): void {
  let boundary = boundaries.get(render);
  if (!boundary) boundaries.set(render, (boundary = new RetainedPaint(render)));
  boundary.refresh(context);
  const layer = boundary.retained.layer!;
  if (layer.offset.x !== x || layer.offset.y !== y) layer.offset = { x, y };
  context.addLayer(layer);
}
export function retainedPaintLayer(render: RenderObject): OffsetLayer | null {
  return boundaries.get(render)?.currentLayer ?? null;
}
export function invalidateRetainedPaint(render: RenderObject): void {
  if (boundaries.get(render)?.retained.layer) render.owner?._schedulePaintRetirement(render);
}
export function retireHiddenPaint(render: RenderObject): void {
  boundaries.get(render)?.retireHidden();
}
export function disposeRetainedPaint(render: RenderObject): void {
  const boundary = boundaries.get(render);
  if (!boundary) return;
  render.owner?._forgetPaintRetirement(render);
  boundary.dispose();
  boundaries.delete(render);
}
