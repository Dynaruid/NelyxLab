// SPDX-License-Identifier: BSD-3-Clause
import { invariant } from '../foundation/errors.ts';
import type { Disposable } from '../foundation/disposable.ts';
import type { TransformMatrix } from '../ui/geometry.ts';
import { isCapturedTransform } from '../ui/geometry.ts';
import type { CoreEditingGeometry, Rect, ViewMetrics, ViewOwner } from '../ui/types.ts';
import type { Matrix4Storage } from '../ui/matrix4.ts';
import type { FrameDiagnostics } from '../ui/frame-diagnostics.ts';
import type { FrameBuildToken } from '../ui/types.ts';

/** Internal numeric snapshot protocol. No RenderObject, callback or VM value. */
export const inputGeometryProtocol = Object.freeze({
  version: 1,
  magic: 0x4e4c4947,
  resultMagic: 0x4e4c494f,
  headerWords: 16,
  nodeWords: 24,
  editorWords: 12,
  resultWords: 35,
  maxBytes: 4 * 1024 * 1024,
  nodes: 8192,
  editors: 256,
  selections: 16384,
  editorSelections: 4096,
  depth: 128,
});
export interface InputGeometryNode {
  readonly parent: number;
  readonly local: TransformMatrix;
  /** Clip on this edge, in the parent's local space. */
  readonly clip: Rect | null;
}
export interface InputGeometryEditor {
  readonly node: number;
  readonly core: CoreEditingGeometry;
}
export interface InputGeometryProjection {
  readonly transform: Matrix4Storage;
  readonly bounds: Rect;
  readonly clip: Rect;
  readonly caret: Rect;
  readonly caretBaseline: { readonly x: number; readonly y: number };
  readonly selectionRects: readonly Rect[];
}
export interface InputGeometryFrame {
  readonly owner: ViewOwner;
  readonly metrics: ViewMetrics;
  readonly geometryDiagnostics?: {
    readonly diagnostics: FrameDiagnostics;
    readonly token: FrameBuildToken;
  };
}
export interface InputGeometryService extends Disposable {
  project(
    frame: InputGeometryFrame,
    nodes: readonly InputGeometryNode[],
    editors: readonly InputGeometryEditor[],
  ): readonly (InputGeometryProjection | null)[];
}
const writeRect = (out: number[], rect: Rect) => out.push(rect.x, rect.y, rect.width, rect.height);
export function encodeInputGeometry(
  frame: InputGeometryFrame,
  session: number,
  revision: number,
  nodes: readonly InputGeometryNode[],
  editors: readonly InputGeometryEditor[],
): Float64Array {
  const protocol = inputGeometryProtocol,
    selections: number[] = [],
    words = [
      protocol.magic,
      protocol.version,
      session,
      frame.owner.generation,
      revision,
      frame.metrics.viewportGeneration,
      frame.metrics.nativeSurfaceGeneration ?? -1,
      frame.metrics.scale,
      frame.metrics.logicalWidth,
      frame.metrics.logicalHeight,
      nodes.length,
      editors.length,
      0,
      0,
      frame.geometryDiagnostics ? 1 : 0,
      0,
    ];
  invariant(
    nodes.length <= protocol.nodes && editors.length <= protocol.editors,
    'input-geometry-budget',
    'Input geometry snapshot exceeds its node/editor budget',
  );
  for (const node of nodes) {
    words.push(node.parent, node.local.length);
    for (let i = 0; i < 16; i++) words.push(node.local[i] ?? 0);
    words.push(node.clip === null ? 0 : 1);
    writeRect(words, node.clip ?? { x: 0, y: 0, width: 0, height: 0 });
    // Ownership decides the existing affine fast projection versus the dense
    // Matrix4 path; finite raw arrays alone do not establish that fast path.
    words.push(isCapturedTransform(node.local) ? 1 : 0);
  }
  for (const { node, core } of editors) {
    invariant(
      core.selectionRects.length <= protocol.editorSelections,
      'input-geometry-budget',
      'Input geometry selection exceeds the existing editor budget',
    );
    words.push(node, core.epoch, core.width, core.height);
    writeRect(words, core.caret);
    words.push(
      core.caretBaseline.x,
      core.caretBaseline.y,
      selections.length / 4,
      core.selectionRects.length,
    );
    for (const rect of core.selectionRects) writeRect(selections, rect);
  }
  words[12] = selections.length / 4;
  words[13] = words.length + selections.length;
  invariant(
    words[12] <= protocol.selections && words[13] * 8 <= protocol.maxBytes,
    'input-geometry-budget',
    'Input geometry snapshot exceeds its byte/selection budget',
  );
  const packet = new Float64Array(words[13]);
  packet.set(words);
  packet.set(selections, words.length);
  return packet;
}
export function decodeInputGeometry(
  packet: Float64Array,
  output: Float64Array,
): readonly (InputGeometryProjection | null)[] {
  const p = inputGeometryProtocol,
    editors = packet[11]!,
    selections = packet[12]!,
    selectionAt = p.headerWords + editors * p.resultWords;
  const valid = () =>
    invariant(
      false,
      'input-geometry-protocol',
      'Native input geometry result is stale or malformed',
    );
  if (
    output.length !== selectionAt + selections * 4 ||
    output[0] !== p.resultMagic ||
    output[13] !== output.length
  )
    valid();
  for (let i = 1; i < p.headerWords; i++)
    if (i !== 13 && i !== 14 && i !== 15 && output[i] !== packet[i]) valid();
  if (
    packet[14] === 0
      ? output[14] !== 0 || output[15] !== 0
      : !Number.isFinite(output[14]) ||
        output[14]! < 0 ||
        !Number.isFinite(output[15]) ||
        output[15]! < 0
  )
    valid();
  const readRect = (at: number): Rect => ({
    x: output[at]!,
    y: output[at + 1]!,
    width: output[at + 2]!,
    height: output[at + 3]!,
  });
  const result: (InputGeometryProjection | null)[] = [];
  let nextSelection = 0;
  // Validate the complete result before publishing any editor.
  for (let i = 0; i < editors; i++) {
    const at = p.headerWords + i * p.resultWords,
      inputAt = p.headerWords + packet[10]! * p.nodeWords + i * p.editorWords,
      count = packet[inputAt + 11]!;
    if (
      (output[at] !== 0 && output[at] !== 1) ||
      output[at + 1] !== i ||
      output[at + 2] !== packet[inputAt + 1] ||
      output[at + 33] !== nextSelection ||
      output[at + 34] !== count
    )
      valid();
    for (let n = 3; n < 33; n++) if (!Number.isFinite(output[at + n])) valid();
    for (let n = 0; n < count * 4; n++)
      if (!Number.isFinite(output[selectionAt + nextSelection * 4 + n])) valid();
    if (output[at] === 0) result.push(null);
    else {
      const rects: Rect[] = [];
      for (let n = 0; n < count; n++) rects.push(readRect(selectionAt + (nextSelection + n) * 4));
      const bounds = readRect(at + 19),
        clip = readRect(at + 23),
        caret = readRect(at + 27);
      if (
        [bounds, clip, caret, ...rects].some((r) => r.width < 0 || r.height < 0) ||
        clip.width === 0 ||
        clip.height === 0
      )
        valid();
      result.push({
        transform: Array.from(output.subarray(at + 3, at + 19)) as unknown as Matrix4Storage,
        bounds,
        clip,
        caret,
        caretBaseline: { x: output[at + 31]!, y: output[at + 32]! },
        selectionRects: rects,
      });
    }
    nextSelection += count;
  }
  if (nextSelection !== selections) valid();
  return result;
}
