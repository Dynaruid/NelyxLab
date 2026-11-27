// SPDX-License-Identifier: BSD-3-Clause
import type { NativeFrameResource } from '@nelyx/core/ui/frame-wire';
import type { ResourceId, TextLayoutInput, ViewOwner } from '@nelyx/core/ui/types';
import type { PaintSnapshot } from '@nelyx/core/ui/paint';
import type { TextRunStyle } from '@nelyx/core/ui/text-styles';
import type { WebSkiaSurfaceOptions, WebSurfaceMetrics } from '@nelyx/skia-web/library';
import type { CanvasKitManifest } from './canvaskit-manifest.ts';
import type { PreparedCanvasKit } from './canvaskit-loader.ts';

export type WebRenderMode = 'auto' | 'direct' | 'worker-transfer' | 'worker-shared';
export type WebRenderPath = Exclude<WebRenderMode, 'auto'>;
export type RenderFailureStage =
  | 'canvas-ownership'
  | 'worker-budget'
  | 'worker-script'
  | 'worker-protocol'
  | 'worker-runtime'
  | 'worker-webgl2'
  | 'shared-memory'
  | 'canvas-transfer'
  | 'worker-attach'
  | 'worker-resources'
  | 'worker-frame'
  | 'worker-context-loss'
  | 'main-webgl2';

export const renderProtocolVersion = 3;
export const renderCapacity = 2;
export const sharedSlotBytes = 128 * 1024;
export const sharedHeaderWords = renderCapacity * 2;
export const sharedBufferBytes =
  sharedHeaderWords * Int32Array.BYTES_PER_ELEMENT + renderCapacity * sharedSlotBytes;
export const sharedProbeRequest = 0x4e4c5801;
export const sharedProbeReply = 0x4e4c5802;
export const workerResourceBytes = 96 * 1024 * 1024;
export const workerResourceCount = 8192;
export const workerBackingBytes = 112 * 1024 * 1024;
export const workerBackingPixelLimit = Math.floor(workerBackingBytes / 12);

export interface RenderSession {
  readonly owner: ViewOwner;
  readonly generation: number;
}

export type RenderResource = NativeFrameResource &
  (
    | { readonly kind: 'font'; readonly family: string; readonly bytes: Uint8Array<ArrayBuffer> }
    | {
        readonly kind: 'image';
        readonly encoding: 'encoded' | 'rgba8888-premul-srgb';
        readonly width: number;
        readonly height: number;
        readonly bytes: Uint8Array<ArrayBuffer>;
      }
    | {
        readonly kind: 'paragraph';
        readonly input: TextLayoutInput;
        readonly fonts: readonly NativeFrameResource[];
      }
    | {
        readonly kind: 'picture';
        readonly bytes: Uint8Array<ArrayBuffer>;
        readonly captureBytes: number;
      }
  );

export function renderResourceReservation(resource: RenderResource): number {
  switch (resource.kind) {
    case 'font':
      return resource.bytes.byteLength * 2;
    case 'image':
      return resource.bytes.byteLength + resource.width * resource.height * 4;
    case 'paragraph':
      return 1024 + JSON.stringify(resource.input).length * 4 + resource.fonts.length * 48;
    case 'picture':
      return resource.bytes.byteLength * 2 + resource.captureBytes;
  }
}

export interface RegisteredRenderResource extends NativeFrameResource {
  readonly cost: number;
  readonly nativeBytes?: number;
}

export function wireResourceId(resource: NativeFrameResource): ResourceId {
  return { id: String(resource.id), generation: resource.generation };
}

/** Immutable input metadata also retains image shaders in foreground/background paints. */
export function mapParagraphResources(
  input: TextLayoutInput,
  map: (resource: ResourceId, kind: 'font' | 'image') => ResourceId,
): TextLayoutInput {
  function paint(value: PaintSnapshot): PaintSnapshot {
    const shader = value.shader;
    return shader?.kind === 'image'
      ? { ...value, shader: { ...shader, image: map(shader.image, 'image') } }
      : value;
  }
  function style(value: TextRunStyle): TextRunStyle {
    return {
      ...value,
      ...(value.foreground ? { foreground: paint(value.foreground) } : {}),
      ...(value.background ? { background: paint(value.background) } : {}),
    };
  }
  return {
    ...input,
    font: map(input.font, 'font'),
    ...(input.style ? { style: style(input.style) } : {}),
    ...(input.runs ? { runs: input.runs.map((run) => ({ ...run, style: style(run.style) })) } : {}),
  };
}

export type RenderPacket =
  | { readonly transport: 'transfer'; readonly buffer: ArrayBuffer; readonly length: number }
  | { readonly transport: 'shared'; readonly slot: number; readonly ticket: number };
export type RenderRequest = RenderSession &
  (
    | {
        readonly kind: 'probe';
        readonly protocol: number;
        readonly frameWire: number;
        readonly webFrameWire: number;
        readonly root: string;
        readonly manifest: CanvasKitManifest;
        readonly assets: PreparedCanvasKit;
        readonly options: WebSkiaSurfaceOptions;
      }
    | {
        readonly kind: 'check-shared';
        readonly probe: SharedArrayBuffer;
        readonly buffer: SharedArrayBuffer;
      }
    | { readonly kind: 'attach'; readonly canvas: OffscreenCanvas; readonly useShared: boolean }
    | { readonly kind: 'metrics'; readonly metrics: WebSurfaceMetrics }
    | { readonly kind: 'visibility'; readonly visible: boolean }
    | { readonly kind: 'register'; readonly resources: readonly RenderResource[] }
    | { readonly kind: 'release'; readonly resource: NativeFrameResource }
    | (RenderPacket & {
        readonly kind: 'frame';
        readonly sequence: number;
        readonly viewport: number;
        readonly context: number | null;
        readonly resources?: readonly RenderResource[];
      })
    | { readonly kind: 'close' }
  );

export type RenderReply = RenderSession &
  (
    | { readonly kind: 'stage'; readonly stage: RenderFailureStage }
    | { readonly kind: 'ready'; readonly isolated: boolean }
    | { readonly kind: 'checked-shared'; readonly shared: boolean }
    | { readonly kind: 'attached' | 'closed' }
    | {
        readonly kind: 'registered';
        readonly resources: readonly RegisteredRenderResource[];
        readonly bytes: number;
        readonly sequence?: number;
        readonly durationMs: number;
      }
    | { readonly kind: 'released'; readonly resource: NativeFrameResource; readonly bytes: number }
    | {
        readonly kind: 'consumed';
        readonly sequence: number;
        readonly buffer?: ArrayBuffer;
        readonly slot?: number;
      }
    | {
        readonly kind: 'submitted';
        readonly sequence: number;
        readonly context: number | null;
        readonly decodeMs: number;
        readonly replayMs: number;
        readonly submitMs: number;
        readonly submittedAt: number;
      }
    | {
        readonly kind: 'retired';
        readonly sequence: number;
        readonly context: number | null;
        readonly result: 'gpu-retired' | 'discarded';
        readonly fenceMs: number;
      }
    | {
        readonly kind: 'fault';
        readonly stage: RenderFailureStage;
        readonly reason: string;
        readonly integrity?: true;
      }
  );

type WithoutSession<T> = T extends RenderSession ? Omit<T, keyof RenderSession> : never;
export type RenderCommand = WithoutSession<RenderRequest>;
export type RenderResponse = WithoutSession<RenderReply>;

export function sameRenderSession(a: RenderSession, b: RenderSession): boolean {
  return (
    a.generation === b.generation &&
    a.owner.id === b.owner.id &&
    a.owner.generation === b.owner.generation
  );
}
