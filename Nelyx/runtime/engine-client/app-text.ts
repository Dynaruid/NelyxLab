// SPDX-License-Identifier: BSD-3-Clause
import type {
  TextBoxGeometry,
  TextClusterInfo,
  TextGlyphInfo,
  TextHit,
  TextLayoutGeometry,
  TextRangeBounds,
} from '@nelyx/core/ui/types';
import type { ParagraphSnapshot } from './paragraph.ts';
import { paragraphOptionsBytes } from './paragraph.ts';
import { fontCatalogLimit } from './font-catalog.ts';
import type { AppImageBackend } from './app-images.ts';
import { httpHeaders } from './http-headers.ts';

export const appTextServiceVersion = 12;
/** A host reservation, not a claim about measured Wasm heap or RSS. */
export const appTextQuotaBytes = 320 * 1024 * 1024;
export interface AppTextInput {
  readonly text: string;
  readonly width: number;
  readonly fontSize: number;
  readonly color: number;
  readonly textDirection: 0 | 1;
  readonly paragraph: ParagraphSnapshot;
}
export interface AppTextSnapshot {
  readonly version: 12;
  readonly fontRevision: number;
  readonly fontFamilies: readonly string[];
  /** Optional thin font-cohort query, independently negotiated from counters. */
  readonly fontFamiliesVersion?: 1;
  readonly fontCatalogs: number;
  readonly fontStages: number;
  readonly fontBuffers: number;
  readonly fontBufferBytes: number;
  readonly assetBuffers: number;
  readonly assetBufferBytes: number;
  readonly assetDataBytes: number;
  readonly assetLoads: number;
  readonly assetNativeReads: number;
  readonly assetNativeReadBytes: number;
  readonly networkBuffers: number;
  readonly networkBufferBytes: number;
  readonly networkRequests: number;
  readonly networkReadBytes: number;
  readonly immutableBuffers: number;
  readonly immutableBufferBytes: number;
  readonly immutableBufferDataBytes: number;
  readonly immutableBufferCopies: number;
  readonly immutableBufferCopyBytes: number;
  readonly immutableBufferReads: number;
  readonly immutableBufferReadBytes: number;
  readonly immutableBufferFileReads: number;
  readonly immutableBufferFileBytes: number;
  readonly fontLoads: number;
  readonly layouts: number;
  readonly queries: number;
  readonly paragraphs: number;
  readonly reservedBytes: number;
  readonly heapBytes: number;
  readonly closed: boolean;
}
/** Private, synchronous C++ service on the App owner. Handles never cross to
 * UI/Content/Render. Only immutable configuration and copied geometry do. */
export interface AppTextBackend {
  readonly networkVersion?: 2;
  readonly images?: AppImageBackend;
  /** Credit acquired before SDK-owned queued bytes or catalog copies allocate. */
  reserveFontBytes(bytes: number): number;
  releaseFontBytes(token: number): void;
  /** Decode/query the intrinsic family without publishing a font generation. */
  fontFamily(bytes: Uint8Array): string;
  /** Delivered ByteData remains caller-owned until the App realm terminates. */
  reserveAssetBytes(size: number): number;
  resizeAssetBytes(token: number, size: number): void;
  finishAssetLoad(token: number, delivered: boolean, expectedSize?: number): void;
  /** Web transport credit; Native requests admit their own callback storage. */
  reserveNetworkBytes?(bytes: number): () => void;
  openNetwork?(baseUrl: string, key: string, headers?: Readonly<Record<string, string>>): number;
  pollNetwork?(handle: number): AppNetworkState;
  readNetwork?(handle: number): void;
  networkChunk?(handle: number): Uint8Array;
  cancelNetwork?(handle: number): void;
  retireNetwork?(handle: number): boolean;
  /** Native-only packaged file IO, guarded by the same owner/credit. */
  assetSize?(key: string): number;
  readAsset?(token: number, key: string): Uint8Array;
  createBuffer(bytes: Uint8Array): { readonly handle: number; readonly length: number };
  bufferFromAsset?(key: string): { readonly handle: number; readonly length: number };
  bufferFromFile?(path: string): { readonly handle: number; readonly length: number };
  retainBuffer(handle: number): number;
  releaseBuffer(handle: number): void;
  bufferChunk(handle: number, offset: number, length: number): Uint8Array;
  layout(
    input: AppTextInput,
    fontRevision?: number,
  ): {
    readonly handle: number;
    readonly fontRevision: number;
    readonly geometry: TextLayoutGeometry;
  };
  /** One pending candidate per owner. Activation is reversible until finish. */
  prepareFonts(catalog: Uint8Array): number;
  /** Copied bytes from the same immutable stage that C++ decoded. */
  fontChunk(stage: number, offset: number, length: number): Uint8Array;
  activateFonts(stage: number): number;
  finishFonts(stage: number, committed: boolean): void;
  boxes(
    handle: number,
    start: number,
    end: number,
    height: number,
    width: number,
  ): TextBoxGeometry[];
  hit(handle: number, x: number, y: number): TextHit;
  glyph(handle: number, offset: number): TextGlyphInfo | null;
  closest(handle: number, x: number, y: number): TextClusterInfo | null;
  word(handle: number, offset: number): TextRangeBounds;
  line(handle: number, offset: number): number | null;
  release(handle: number): void;
  snapshot(fontRevision?: number): AppTextSnapshot;
  /** Validates the same live revision as snapshot, without accounting counters. */
  fontFamilies?(fontRevision: number): readonly string[];
  close(): void;
}
export interface AppTextExecution extends AppTextSnapshot {
  readonly sdkLayouts: number;
  readonly sdkQueries: number;
  readonly sdkPaintCaptures: number;
  readonly tsFallbacks: 0;
}
export interface NativeAppTextService {
  readonly appImageVersion?: number;
  readonly appNetworkVersion?: number;
  readonly appTextVersion?: number;
  appText?(operation: string, owner: number, handle: number, payload: unknown): unknown;
}
export interface AppNetworkState {
  /** pending, headers, reading, chunk, done, failed */
  readonly phase: 0 | 1 | 2 | 3 | 4 | 5;
  readonly status: number;
  readonly size: number;
  readonly closed: boolean;
  readonly bytes: number;
  readonly requests: number;
  readonly error: number;
}
/** Adapts host functions without exposing JSI paragraphs or native pointers. */
export function nativeAppTextBackend(native: NativeAppTextService): AppTextBackend {
  if (native.appTextVersion !== appTextServiceVersion || typeof native.appText !== 'function')
    throw Error('Required synchronous App paragraph service is unavailable');
  const invoke = native.appText.bind(native),
    owner = invoke('open', 0, 0, undefined) as number;
  if (!Number.isSafeInteger(owner) || owner <= 0) throw Error('Invalid App paragraph owner');
  const revision = (value: number | undefined) => {
    if (value === undefined) return 0;
    if (!Number.isSafeInteger(value) || value <= 0) throw Error('Invalid App font revision');
    return value;
  };
  return {
    ...(native.appNetworkVersion === 2 ? { networkVersion: 2 as const } : {}),
    ...(native.appImageVersion === 2
      ? {
          images: {
            reserveScene: (size) => invoke('reserveImageScene', owner, 0, size),
            releaseScene: (handle) => {
              invoke('releaseImageScene', owner, handle, undefined);
            },
            reserveReadback: (size) => invoke('reserveImageReadback', owner, 0, size),
            finishReadback: (handle, delivered) => {
              invoke('finishImageReadback', owner, handle, delivered);
            },
            createDescriptor: (buffer, raw) =>
              invoke('imageDescriptor', owner, buffer, { raw: raw ?? null }),
            instantiateCodec: (handle, width, height) =>
              invoke('imageCodec', owner, handle, { width, height }),
            nextFrame: (handle) => invoke('imageNextFrame', owner, handle, undefined),
            frameChunk: (handle, offset, length) =>
              new Uint8Array(
                invoke('imageFrameChunk', owner, handle, { offset, length }) as ArrayBuffer,
              ),
            releaseDescriptor: (handle) => {
              invoke('releaseImageDescriptor', owner, handle, undefined);
            },
            releaseCodec: (handle) => {
              invoke('releaseImageCodec', owner, handle, undefined);
            },
            releaseFrame: (handle) => {
              invoke('releaseImageFrame', owner, handle, undefined);
            },
            snapshot: () => invoke('imageSnapshot', owner, 0, undefined),
          } as AppImageBackend,
        }
      : {}),
    reserveFontBytes: (bytes) => {
      const token = invoke('reserveFontBytes', owner, 0, bytes) as number;
      if (!Number.isSafeInteger(token) || token <= 0) throw Error('Invalid App font buffer credit');
      return token;
    },
    releaseFontBytes: (token) => {
      invoke('releaseFontBytes', owner, token, undefined);
    },
    reserveAssetBytes: (size) => {
      const token = invoke('reserveAssetBytes', owner, 0, size) as number;
      if (!Number.isSafeInteger(token) || token <= 0) throw Error('Invalid App asset credit');
      return token;
    },
    resizeAssetBytes: (token, size) => {
      invoke('resizeAssetBytes', owner, token, size);
    },
    finishAssetLoad: (token, delivered, expectedSize) => {
      invoke('finishAssetLoad', owner, token, { delivered, size: expectedSize ?? null });
    },
    openNetwork: (baseUrl, key, headers = {}) =>
      invoke('openNetwork', owner, 0, {
        baseUrl,
        key,
        ...(Object.keys(headers).length
          ? {
              headers: Object.entries(httpHeaders(headers))
                .map(([name, value]) => name + ': ' + value + '\r\n')
                .join(''),
            }
          : {}),
      }) as number,
    pollNetwork: (handle) => invoke('pollNetwork', owner, handle, undefined) as AppNetworkState,
    readNetwork: (handle) => {
      invoke('readNetwork', owner, handle, undefined);
    },
    networkChunk: (handle) =>
      new Uint8Array(invoke('networkChunk', owner, handle, undefined) as ArrayBuffer),
    cancelNetwork: (handle) => {
      invoke('cancelNetwork', owner, handle, undefined);
    },
    retireNetwork: (handle) => invoke('retireNetwork', owner, handle, undefined) as boolean,
    assetSize: (key) => invoke('assetSize', owner, 0, key) as number,
    readAsset: (token, key) =>
      new Uint8Array(invoke('readAsset', owner, token, key) as ArrayBuffer),
    createBuffer: (bytes) => {
      if (
        !(bytes instanceof Uint8Array) ||
        !(bytes.buffer instanceof ArrayBuffer) ||
        bytes.length > 32 * 1024 * 1024
      )
        throw Error('Invalid immutable buffer input');
      return invoke('createBuffer', owner, 0, {
        bytes: bytes.buffer,
        offset: bytes.byteOffset,
        length: bytes.length,
      }) as { handle: number; length: number };
    },
    bufferFromAsset: (key) =>
      invoke('bufferFromAsset', owner, 0, key) as { handle: number; length: number },
    bufferFromFile: (path) =>
      invoke('bufferFromFile', owner, 0, path) as { handle: number; length: number },
    retainBuffer: (handle) => invoke('retainBuffer', owner, handle, undefined) as number,
    releaseBuffer: (handle) => {
      invoke('releaseBuffer', owner, handle, undefined);
    },
    bufferChunk: (handle, offset, length) =>
      new Uint8Array(invoke('bufferChunk', owner, handle, { offset, length }) as ArrayBuffer),
    fontFamily: (bytes) => {
      if (
        !(bytes instanceof Uint8Array) ||
        !(bytes.buffer instanceof ArrayBuffer) ||
        bytes.length < 12 ||
        bytes.length > fontCatalogLimit
      )
        throw Error('Invalid font family input');
      const family = invoke('fontFamily', owner, 0, {
        bytes: bytes.buffer,
        offset: bytes.byteOffset,
        length: bytes.byteLength,
      });
      if (typeof family !== 'string') throw Error('Invalid decoded font family');
      return family;
    },
    prepareFonts: (catalog) => {
      if (!(catalog instanceof Uint8Array) || catalog.length > fontCatalogLimit)
        throw Error('Invalid font catalog input');
      if (!(catalog.buffer instanceof ArrayBuffer)) throw Error('Shared font catalog input');
      return invoke('prepareFonts', owner, 0, {
        bytes: catalog.buffer,
        offset: catalog.byteOffset,
        length: catalog.byteLength,
      }) as number;
    },
    fontChunk: (stage, offset, length) =>
      new Uint8Array(invoke('fontChunk', owner, stage, { offset, length }) as ArrayBuffer),
    activateFonts: (stage) => invoke('activateFonts', owner, stage, undefined) as number,
    finishFonts: (stage, committed) => {
      invoke('finishFonts', owner, stage, committed);
    },
    layout: (input, fontRevision) => {
      const { height, ...paragraph } = input.paragraph;
      return invoke('layout', owner, revision(fontRevision), {
        ...input,
        paragraphData: Array.from(
          paragraphOptionsBytes({ ...paragraph, ...(height === null ? {} : { height }) }),
        ),
        width: input.width === Infinity ? 0 : input.width,
        unbounded: input.width === Infinity,
      }) as ReturnType<AppTextBackend['layout']>;
    },
    boxes: (handle, start, end, height, width) =>
      invoke('boxes', owner, handle, { start, end, height, width }) as TextBoxGeometry[],
    hit: (handle, x, y) => invoke('hit', owner, handle, { x, y }) as TextHit,
    glyph: (handle, offset) => invoke('glyph', owner, handle, { offset }) as TextGlyphInfo | null,
    closest: (handle, x, y) => invoke('closest', owner, handle, { x, y }) as TextClusterInfo | null,
    word: (handle, offset) => invoke('word', owner, handle, { offset }) as TextRangeBounds,
    line: (handle, offset) => invoke('line', owner, handle, { offset }) as number | null,
    release: (handle) => {
      invoke('release', owner, handle, undefined);
    },
    snapshot: (fontRevision) =>
      invoke('snapshot', owner, revision(fontRevision), undefined) as AppTextSnapshot,
    fontFamilies: (fontRevision) =>
      invoke('fontFamilies', owner, revision(fontRevision), undefined) as readonly string[],
    close: () => {
      invoke('close', owner, 0, undefined);
    },
  };
}
