// SPDX-License-Identifier: BSD-3-Clause
import { CanvasKitProvider, canvasKitSupply } from '../../render/canvaskit-web/provider.ts';
import type { AppFontCatalog, AppImmutableData } from '../../render/canvaskit-web/provider.ts';
import {
  readFontCatalog,
  bundledFontFamilies,
} from '../../../runtime/engine-client/font-catalog.ts';
import { lineNumberAtUTF16 } from '../../render/canvaskit-web/paragraph.ts';
import {
  appTextQuotaBytes,
  appTextServiceVersion,
} from '../../../runtime/engine-client/app-text.ts';
import type {
  AppTextBackend,
  AppTextInput,
  AppTextSnapshot,
} from '../../../runtime/engine-client/app-text.ts';
import type { ProviderMemoryBudget } from './memory.ts';
import type { Paragraph } from 'canvaskit-wasm';
import {
  paragraphOptionsBytes,
  readParagraphOptions,
} from '../../../runtime/engine-client/paragraph.ts';
import { encodeUtf8 } from '../../../runtime/engine-client/utf8.ts';
import { protocol as p } from '../../../runtime/engine-client/schema.ts';
import { validateParagraphRuns } from '../../../runtime/engine-client/paragraph-runs.ts';
import { validateParagraphPlaceholders } from '../../../runtime/engine-client/paragraph-extras.ts';
import { WebAppImages } from './app-images.ts';
export const version = appTextServiceVersion;
export const bootstrapVersion = 1;

/** Synchronous local admission within a quota already held by the host. The
 * reservation remains at the host until this entire App worker is terminated. */
export class AppTextBudget implements ProviderMemoryBudget {
  private accounts = [0, 0, 0, 0, 0, 0];
  private closed = false;
  constructor(readonly quota: number) {
    if (quota !== appTextQuotaBytes) throw Error('App paragraph quota/version differs');
  }
  get bytes(): number {
    return this.accounts.reduce((sum, value) => sum + value, 0);
  }
  set(kind: number, bytes: number): void {
    if (
      this.closed ||
      !Number.isInteger(kind) ||
      kind < 1 ||
      kind > 5 ||
      !Number.isSafeInteger(bytes) ||
      bytes < 0 ||
      (kind === 1 && bytes > canvasKitSupply.maximumMemoryBytes) ||
      this.bytes - this.accounts[kind]! + bytes > this.quota ||
      // Reserve for the binary's entire possible linear heap before a C++
      // operation, so irreversible growth cannot outrun the host's credit.
      this.bytes -
        this.accounts[1]! -
        (kind === 1 ? 0 : this.accounts[kind]!) +
        (kind === 1 ? 0 : bytes) +
        canvasKitSupply.maximumMemoryBytes >
        this.quota
    )
      throw Error('App paragraph memory quota exceeded/closed');
    this.accounts[kind] = bytes;
  }
  reserve(kind: number, bytes: number): () => void {
    if (!Number.isSafeInteger(bytes) || bytes < 0) throw Error('Invalid App paragraph reservation');
    this.set(kind, this.accounts[kind]! + bytes);
    let held = true;
    return () => {
      if (!held) return;
      held = false;
      if (!this.closed) this.set(kind, this.accounts[kind]! - bytes);
    };
  }
  adjust(kind: number, delta: number): void {
    if (!Number.isSafeInteger(delta)) throw Error('Invalid App credit adjustment');
    this.set(kind, this.accounts[kind]! + delta);
  }
  close(): void {
    if (this.closed) return;
    // delete() retires objects, not the committed Wasm memory. Keep that real
    // heap visible and the fixed host quota held until worker termination.
    // Delivered asset buffers can still be referenced by caller JS. Their
    // staging credit, like committed Wasm memory, retires at worker termination.
    this.accounts = [0, this.accounts[1]!, 0, 0, this.accounts[4]!, 0];
    this.closed = true;
  }
}
type Entry = {
  readonly generation: Generation;
  readonly paragraph: Paragraph;
  readonly input: AppTextInput;
  readonly release: () => void;
};
type Generation = { revision: number; readonly catalog?: AppFontCatalog; holds: number };
type ImmutableData = {
  allocation: AppImmutableData;
  bytes: number;
  release: () => void;
  handles: number;
};
type FontStage = {
  readonly token: number;
  active: boolean;
  readonly candidate: Generation;
  readonly previous: Generation;
  readonly bytes: Uint8Array;
  readonly releaseBytes: () => void;
};
let nextFontStage = 0,
  nextFontBuffer = 0;
const rect = (value: Float32Array | readonly number[]) => ({
  x: value[0]!,
  y: value[1]!,
  width: value[2]! - value[0]!,
  height: value[3]! - value[1]!,
});
const offset = (value: number) => {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff)
    throw Error('Invalid App paragraph offset');
};
const point = (x: number, y: number) => {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e12 || Math.abs(y) > 1e12)
    throw Error('Invalid App paragraph point');
};
/** Internal factory, loaded only in the App worker from its verified supply. */
export class WebAppTextBackend implements AppTextBackend {
  readonly networkVersion = 2 as const;
  readonly images: WebAppImages;
  private readonly entries = new Map<number, Entry>();
  private next = 0;
  private queries = 0;
  private closed = false;
  private readonly initialLayouts: number;
  private generation: Generation = { revision: 1, holds: 1 };
  private readonly generations = new Set<Generation>([this.generation]);
  private nextRevision = 1;
  private stage: FontStage | undefined;
  private readonly fontBuffers = new Map<number, { bytes: number; release: () => void }>();
  private readonly assetBuffers = new Map<
    number,
    {
      size: number;
      bytes: number;
      delivered: boolean;
      release: () => void;
    }
  >();
  private assetLoads = 0;
  private readonly networkCredits = new Map<number, { bytes: number; release: () => void }>();
  private readonly buffers = new Map<number, ImmutableData>();
  private readonly bufferAllocations = new Set<ImmutableData>();
  constructor(
    private readonly provider: CanvasKitProvider,
    private readonly budget: AppTextBudget,
  ) {
    this.initialLayouts = provider.counters.paragraphLayouts;
    this.images = new WebAppImages(
      provider,
      (id) => {
        const value = this.buffer(id);
        ++value.handles;
        let held = true;
        return {
          allocation: value.allocation,
          dispose: () => {
            if (held) {
              this.dropBuffer(value);
              held = false;
            }
          },
        };
      },
      (bytes) => this.budget.reserve(4, bytes),
      () => {
        if (nextFontBuffer >= Number.MAX_SAFE_INTEGER)
          throw Error('App image handle budget exceeded');
        return ++nextFontBuffer;
      },
      () => {
        if (this.closed) throw Error('App image owner is closed');
      },
    );
  }
  private fontGeneration(revision: number): Generation {
    if (this.closed || !Number.isSafeInteger(revision) || revision <= 0)
      throw Error('App font revision is foreign/retired');
    const generation = [...this.generations].find((value) => value.revision === revision);
    if (!generation) throw Error('App font revision is foreign/retired');
    return generation;
  }
  snapshot(revision?: number): AppTextSnapshot {
    const generation = revision === undefined ? this.generation : this.fontGeneration(revision);
    return {
      version: appTextServiceVersion,
      fontRevision: generation.revision,
      fontFamilies: [...(generation.catalog?.families ?? bundledFontFamilies)],
      fontFamiliesVersion: 1,
      fontCatalogs:
        (this.closed ? 0 : 1) + [...this.generations].filter((value) => value.catalog).length,
      fontStages: this.stage ? 1 : 0,
      fontBuffers: this.fontBuffers.size,
      fontBufferBytes: [...this.fontBuffers.values()].reduce((sum, value) => sum + value.bytes, 0),
      assetBuffers: this.assetBuffers.size,
      assetBufferBytes: [...this.assetBuffers.values()].reduce(
        (sum, value) => sum + value.bytes,
        0,
      ),
      assetDataBytes: [...this.assetBuffers.values()].reduce((sum, value) => sum + value.size, 0),
      assetLoads: this.assetLoads,
      assetNativeReads: 0,
      assetNativeReadBytes: 0,
      networkBuffers: this.networkCredits.size,
      networkBufferBytes: [...this.networkCredits.values()].reduce(
        (sum, value) => sum + value.bytes,
        0,
      ),
      networkRequests: 0,
      networkReadBytes: 0,
      immutableBuffers: this.buffers.size,
      immutableBufferBytes: [...this.bufferAllocations].reduce(
        (sum, value) => sum + value.bytes,
        0,
      ),
      immutableBufferDataBytes: [...this.bufferAllocations].reduce(
        (sum, value) => sum + value.allocation.length,
        0,
      ),
      immutableBufferCopies: this.provider.counters.immutableBufferCopies,
      immutableBufferCopyBytes: this.provider.counters.immutableBufferCopyBytes,
      immutableBufferReads: this.provider.counters.immutableBufferReads,
      immutableBufferReadBytes: this.provider.counters.immutableBufferReadBytes,
      immutableBufferFileReads: 0,
      immutableBufferFileBytes: 0,
      fontLoads: this.provider.counters.dynamicFontLoads,
      layouts: this.provider.counters.paragraphLayouts - this.initialLayouts,
      queries: this.queries,
      paragraphs: this.entries.size,
      reservedBytes: this.budget.bytes,
      heapBytes: this.provider.counters.heapBytes,
      closed: this.closed,
    };
  }
  fontFamilies(revision: number): readonly string[] {
    return [...(this.fontGeneration(revision).catalog?.families ?? bundledFontFamilies)];
  }
  private retain(generation: Generation): void {
    ++generation.holds;
  }
  reserveFontBytes(bytes: number): number {
    if (
      this.closed ||
      this.fontBuffers.size >= 64 ||
      nextFontBuffer >= Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(bytes) ||
      bytes <= 0 ||
      bytes > 2 * p.limits.fontCatalogBytes + 4 * p.limits.fontChunkBytes + 65536
    )
      throw Error('App font buffer credit is invalid/budget exceeded/closed');
    const release = this.budget.reserve(4, bytes),
      token = ++nextFontBuffer;
    this.fontBuffers.set(token, { bytes, release });
    return token;
  }
  reserveAssetBytes(size: number): number {
    if (
      this.closed ||
      this.assetBuffers.size >= 64 ||
      nextFontBuffer >= Number.MAX_SAFE_INTEGER ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > p.limits.resourceBytes ||
      [...this.assetBuffers.values()].reduce((sum, value) => sum + value.size, 0) + size >
        p.limits.resourceBytes
    )
      throw Error('App asset input/count/byte budget exceeded/closed');
    const bytes = 3 * size + 65536,
      token = ++nextFontBuffer;
    this.budget.adjust(4, bytes);
    const entry = {
      size,
      bytes,
      delivered: false,
      release: () => this.budget.adjust(4, -entry.bytes),
    };
    this.assetBuffers.set(token, entry);
    return token;
  }
  resizeAssetBytes(token: number, size: number): void {
    const entry = this.assetBuffers.get(token);
    if (
      this.closed ||
      !entry ||
      entry.delivered ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      size > p.limits.resourceBytes ||
      [...this.assetBuffers.values()].reduce((sum, value) => sum + value.size, 0) -
        entry.size +
        size >
        p.limits.resourceBytes
    )
      throw Error('App asset resize is foreign/delivered/outside budget');
    const bytes = 3 * size + 65536;
    this.budget.adjust(4, bytes - entry.bytes);
    entry.size = size;
    entry.bytes = bytes;
  }
  reserveNetworkBytes(bytes: number): () => void {
    if (
      this.closed ||
      bytes !== 512 * 1024 ||
      this.networkCredits.size >= 32 ||
      nextFontBuffer >= Number.MAX_SAFE_INTEGER
    )
      throw Error('App network transport budget exceeded/closed');
    const release = this.budget.reserve(4, bytes),
      token = ++nextFontBuffer;
    this.networkCredits.set(token, { bytes, release });
    return () => {
      const entry = this.networkCredits.get(token);
      if (!entry || this.closed) throw Error('App network credit is foreign/retired/closed');
      entry.release();
      this.networkCredits.delete(token);
    };
  }
  finishAssetLoad(token: number, delivered: boolean, expectedSize?: number): void {
    const entry = this.assetBuffers.get(token);
    if (this.closed || !entry || entry.delivered)
      throw Error('App asset credit is foreign/already delivered/closed');
    if (expectedSize !== undefined && expectedSize !== entry.size)
      throw Error('App asset final size differs from admitted credit');
    if (delivered) {
      // Transport/verification has retired before this terminal. Keep the one
      // caller-owned ArrayBuffer admitted until realm termination, not its
      // completed native/stream/digest staging copies.
      const bytes = entry.size + 65536;
      this.budget.adjust(4, bytes - entry.bytes);
      entry.bytes = bytes;
      entry.delivered = true;
      ++this.assetLoads;
    } else {
      entry.release();
      this.assetBuffers.delete(token);
    }
  }
  releaseFontBytes(token: number): void {
    const entry = this.fontBuffers.get(token);
    if (this.closed || !entry) throw Error('App font buffer credit is foreign/retired');
    entry.release();
    this.fontBuffers.delete(token);
  }
  createBuffer(input: Uint8Array): { handle: number; length: number } {
    if (
      this.closed ||
      !(input instanceof Uint8Array) ||
      !(input.buffer instanceof ArrayBuffer) ||
      input.length > p.limits.resourceBytes ||
      this.buffers.size >= 64 ||
      this.bufferAllocations.size >= 64 ||
      nextFontBuffer >= Number.MAX_SAFE_INTEGER ||
      [...this.bufferAllocations].reduce((sum, value) => sum + value.allocation.length, 0) +
        input.length >
        p.limits.resourceBytes
    )
      throw Error('App immutable buffer count/byte budget exceeded/closed');
    const bytes = 2 * input.length + 65536,
      release = this.budget.reserve(4, bytes);
    let allocation: AppImmutableData | undefined,
      value: ImmutableData | undefined,
      handle = 0;
    try {
      allocation = this.provider.createImmutableBuffer(input);
      handle = ++nextFontBuffer;
      value = { allocation, bytes, release, handles: 1 };
      this.bufferAllocations.add(value);
      this.buffers.set(handle, value);
      return { handle, length: input.length };
    } catch (error) {
      if (handle) this.buffers.delete(handle);
      if (value) this.bufferAllocations.delete(value);
      allocation?.close();
      release();
      throw error;
    }
  }
  private buffer(handle: number): ImmutableData {
    const value = this.buffers.get(handle);
    if (this.closed || !value) throw Error('ImmutableBuffer handle is foreign/retired');
    return value;
  }
  retainBuffer(handle: number): number {
    const value = this.buffer(handle);
    if (this.buffers.size >= 64 || nextFontBuffer >= Number.MAX_SAFE_INTEGER)
      throw Error('ImmutableBuffer handle budget exceeded');
    const id = ++nextFontBuffer;
    this.buffers.set(id, value);
    ++value.handles;
    return id;
  }
  releaseBuffer(handle: number): void {
    const value = this.buffer(handle);
    this.dropBuffer(value);
    this.buffers.delete(handle);
  }
  private dropBuffer(value: ImmutableData): void {
    if (value.handles === 1) {
      value.allocation.close();
      value.release();
      this.bufferAllocations.delete(value);
    }
    --value.handles;
  }
  bufferChunk(handle: number, offset: number, length: number): Uint8Array {
    const value = this.buffer(handle);
    ++value.handles;
    try {
      return value.allocation.read(offset, length);
    } finally {
      this.dropBuffer(value);
    }
  }
  fontFamily(bytes: Uint8Array): string {
    if (
      this.closed ||
      !(bytes instanceof Uint8Array) ||
      !(bytes.buffer instanceof ArrayBuffer) ||
      bytes.length < 12 ||
      bytes.length > p.limits.fontCatalogBytes
    )
      throw Error('App font family input is invalid/closed');
    return this.provider.appFontFamily(bytes);
  }
  private drop(generation: Generation): void {
    if (--generation.holds === 0) {
      generation.catalog?.close();
      this.generations.delete(generation);
    }
  }
  private stageFor(token: number): FontStage {
    if (this.closed || !this.stage || this.stage.token !== token)
      throw Error('App font stage is foreign/retired');
    return this.stage;
  }
  prepareFonts(bytes: Uint8Array): number {
    if (this.closed || this.stage || nextFontStage >= Number.MAX_SAFE_INTEGER)
      throw Error('App font stage already pending/budget exceeded/closed');
    if (
      !(bytes instanceof Uint8Array) ||
      !(bytes.buffer instanceof ArrayBuffer) ||
      bytes.length < 32 ||
      bytes.length > p.limits.fontCatalogBytes
    )
      throw Error('Invalid App font catalog input');
    // One caller/SDK catalog and our immutable copy, plus bounded transport.
    const releaseBytes = this.budget.reserve(
      4,
      2 * bytes.length + 4 * p.limits.fontChunkBytes + 65536,
    );
    let copied: Uint8Array, catalog: AppFontCatalog;
    try {
      copied = bytes.slice();
      catalog = this.provider.makeAppFontCatalog(readFontCatalog(copied));
    } catch (error) {
      releaseBytes();
      throw error;
    }
    const candidate: Generation = { revision: 0, catalog, holds: 1 };
    this.generations.add(candidate);
    this.retain(this.generation);
    this.stage = {
      token: ++nextFontStage,
      active: false,
      candidate,
      previous: this.generation,
      bytes: copied,
      releaseBytes,
    };
    return nextFontStage;
  }
  fontChunk(token: number, at: number, length: number): Uint8Array {
    const stage = this.stageFor(token);
    if (
      !Number.isInteger(at) ||
      !Number.isInteger(length) ||
      at < 0 ||
      length <= 0 ||
      length > p.limits.fontChunkBytes ||
      at > stage.bytes.length - length
    )
      throw Error('Invalid App font chunk');
    return stage.bytes.slice(at, at + length);
  }
  activateFonts(token: number): number {
    const stage = this.stageFor(token);
    if (stage.active || this.nextRevision >= Number.MAX_SAFE_INTEGER)
      throw Error('App font stage activation is stale/budget exceeded');
    stage.candidate.revision = ++this.nextRevision;
    stage.active = true;
    this.retain(stage.candidate);
    this.drop(this.generation);
    this.generation = stage.candidate;
    return this.generation.revision;
  }
  finishFonts(token: number, committed: boolean): void {
    const stage = this.stageFor(token);
    if (typeof committed !== 'boolean' || (committed && !stage.active))
      throw Error('Unactivated App font stage cannot commit');
    if (!committed && stage.active) {
      this.retain(stage.previous);
      this.drop(this.generation);
      this.generation = stage.previous;
    }
    this.drop(stage.previous);
    this.drop(stage.candidate);
    stage.releaseBytes();
    this.stage = undefined;
  }
  private current(handle: number): Entry {
    const entry = this.entries.get(handle);
    if (this.closed || !entry) throw Error('App paragraph handle is foreign/retired');
    return entry;
  }
  layout(input: AppTextInput, revision?: number) {
    if (this.closed || this.entries.size >= 1024 || this.next >= Number.MAX_SAFE_INTEGER)
      throw Error('App paragraph resource budget exceeded/closed');
    // Work/input was validated by Source; independently bound this factory's
    // native allocation even if a caller bypasses that adapter.
    const generation = revision === undefined ? this.generation : this.fontGeneration(revision);
    const allowedFamily = (family: string) =>
      (generation.catalog?.families ?? bundledFontFamilies).includes(family);
    if (
      typeof input.text !== 'string' ||
      input.text.length > 4096 ||
      !(
        (Number.isFinite(input.width) && input.width >= 0 && input.width <= 16777216) ||
        input.width === Infinity
      ) ||
      !Number.isFinite(input.fontSize) ||
      input.fontSize < 0 ||
      input.fontSize > 512 ||
      !Number.isInteger(input.color) ||
      input.color < 0 ||
      input.color > 0xffffffff ||
      (input.textDirection !== 0 && input.textDirection !== 1)
    )
      throw Error('Invalid App paragraph configuration');
    const { height, ...options } = input.paragraph,
      paragraphOptions = readParagraphOptions(
        paragraphOptionsBytes({ ...options, ...(height === null ? {} : { height }) }),
      );
    if (
      paragraphOptions.maxLines > 128 ||
      paragraphOptions.inlineChildren ||
      (paragraphOptions.fontFamily && !allowedFamily(paragraphOptions.fontFamily)) ||
      paragraphOptions.strut?.fontFamilies.some((family) => !allowedFamily(family)) ||
      paragraphOptions.runs?.some((run) =>
        run.fontFamilies.some((family) => !allowedFamily(family)),
      )
    )
      throw Error('Invalid App paragraph options');
    const encoded = encodeUtf8(input.text, 16384);
    validateParagraphRuns(input.text, paragraphOptions.runs);
    validateParagraphPlaceholders(input.text, paragraphOptions.placeholders);
    input = Object.freeze({ ...input, paragraph: paragraphOptions });
    const release = this.budget.reserve(
      2,
      65536 +
        encoded.length * 256 +
        paragraphOptionsBytes({ ...options, ...(height === null ? {} : { height }) }).length,
    );
    let paragraph: Paragraph | undefined;
    try {
      paragraph = this.provider.appParagraph(input, generation.catalog);
      const lines = paragraph.getLineMetrics();
      if (lines.length > 128) throw Error('App paragraph line geometry budget exceeded');
      const placeholders = paragraph.getRectsForPlaceholders();
      if (placeholders.length > (paragraphOptions.placeholders?.length ?? 0))
        throw Error('Unexpected App placeholder geometry');
      const geometry = {
        ...(paragraphOptions.placeholders?.length
          ? {
              placeholderBoxes: placeholders.map((box) => rect(box.rect)),
              placeholderDirections: placeholders.map((box) =>
                box.dir === this.provider.ck.TextDirection.RTL
                  ? ('rtl' as const)
                  : ('ltr' as const),
              ),
            }
          : {}),
        width: paragraph.getMaxWidth(),
        height: paragraph.getHeight(),
        alphabeticBaseline: paragraph.getAlphabeticBaseline(),
        ideographicBaseline: paragraph.getIdeographicBaseline(),
        minIntrinsicWidth: paragraph.getMinIntrinsicWidth(),
        maxIntrinsicWidth: paragraph.getMaxIntrinsicWidth(),
        longestLine: paragraph.getLongestLine(),
        overflow: paragraph.didExceedMaxLines(),
        unresolvedGlyphs: paragraph.unresolvedCodepoints().length,
        lines: lines.map((line) => ({
          start: line.startIndex,
          end: line.endIndex,
          baseline: line.baseline,
          height: line.height,
          bounds: {
            x: line.left,
            y: line.baseline - line.ascent,
            width: line.width,
            height: line.ascent + line.descent,
          },
          metrics: {
            hardBreak: line.isHardBreak,
            ascent: line.ascent,
            descent: line.descent,
            unscaledAscent: (line as typeof line & { unscaledAscent: number }).unscaledAscent,
            height: line.height,
            width: line.width,
            left: line.left,
            baseline: line.baseline,
            lineNumber: line.lineNumber,
          },
        })),
      };
      const handle = ++this.next;
      this.retain(generation);
      this.entries.set(handle, { generation, paragraph, input, release });
      return { handle, fontRevision: generation.revision, geometry };
    } catch (error) {
      paragraph?.delete();
      release();
      throw error;
    }
  }
  boxes(handle: number, start: number, end: number, height: number, width: number) {
    const { paragraph } = this.current(handle);
    if (
      ![start, end, height, width].every(Number.isInteger) ||
      start < 0 ||
      end < 0 ||
      start > 0xffffffff ||
      end > 0xffffffff ||
      height < 0 ||
      height > 5 ||
      width < 0 ||
      width > 1
    )
      throw Error('Invalid App text box query');
    return this.provider.appTextGuard(32768, () => {
      const { ck } = this.provider,
        boxes = paragraph.getRectsForRange(
          start,
          end,
          [
            ck.RectHeightStyle.Tight,
            ck.RectHeightStyle.Max,
            ck.RectHeightStyle.IncludeLineSpacingMiddle,
            ck.RectHeightStyle.IncludeLineSpacingTop,
            ck.RectHeightStyle.IncludeLineSpacingBottom,
            ck.RectHeightStyle.Strut,
          ][height]!,
          width ? ck.RectWidthStyle.Max : ck.RectWidthStyle.Tight,
        );
      ++this.queries;
      if (boxes.length > 32768 / 40) throw Error('App text box geometry budget exceeded');
      return boxes.map((box) => ({
        rect: rect(box.rect),
        direction: box.dir === ck.TextDirection.RTL ? ('rtl' as const) : ('ltr' as const),
      }));
    });
  }
  hit(handle: number, x: number, y: number) {
    const { paragraph } = this.current(handle);
    point(x, y);
    return this.provider.appTextGuard(128, () => {
      const hit = paragraph.getGlyphPositionAtCoordinate(x, y);
      ++this.queries;
      return {
        position: hit.pos,
        affinity:
          hit.affinity === this.provider.ck.Affinity.Upstream
            ? ('upstream' as const)
            : ('downstream' as const),
      };
    });
  }
  private glyphInfo(info: ReturnType<Paragraph['getGlyphInfoAt']>) {
    if (!info) return null;
    return {
      start: info.graphemeClusterTextRange.start,
      end: info.graphemeClusterTextRange.end,
      bounds: rect(info.graphemeLayoutBounds),
      direction:
        info.dir === this.provider.ck.TextDirection.RTL ? ('rtl' as const) : ('ltr' as const),
      isEllipsis: info.isEllipsis,
    };
  }
  glyph(handle: number, offset: number) {
    const { paragraph } = this.current(handle);
    if (!Number.isInteger(offset) || offset < 0 || offset > 0xffffffff)
      throw Error('Invalid App paragraph offset');
    return this.provider.appTextGuard(128, () => {
      const info = paragraph.getGlyphInfoAt(offset);
      ++this.queries;
      return this.glyphInfo(info);
    });
  }
  closest(handle: number, x: number, y: number) {
    const { paragraph } = this.current(handle);
    point(x, y);
    return this.provider.appTextGuard(128, () => {
      const info = paragraph.getClosestGlyphInfoAtCoordinate(x, y);
      ++this.queries;
      return this.glyphInfo(info);
    });
  }
  word(handle: number, position: number) {
    const { paragraph } = this.current(handle);
    offset(position);
    return this.provider.appTextGuard(128, () => {
      const result = paragraph.getWordBoundary(position);
      ++this.queries;
      return result;
    });
  }
  line(handle: number, position: number) {
    const { paragraph, input } = this.current(handle);
    offset(position);
    return this.provider.appTextGuard(128, () => {
      // Keep end-of-document a caret-only position while still observing the
      // C++ paragraph in this query, including empty text.
      paragraph.getNumberOfLines();
      const result =
        position >= input.text.length
          ? null
          : lineNumberAtUTF16(
              paragraph,
              input.text,
              position,
              this.provider.textCapabilities.lineIndexUnit,
            );
      ++this.queries;
      return result;
    });
  }
  release(handle: number): void {
    const entry = this.current(handle);
    entry.paragraph.delete();
    entry.release();
    this.entries.delete(handle);
    this.drop(entry.generation);
  }
  close(): void {
    if (this.closed) return;
    this.images.assertDrained();
    if (this.entries.size || this.stage || this.fontBuffers.size)
      throw Error('App paragraph owner still has live resources/stage/font buffers');
    if (this.networkCredits.size) throw Error('App HTTP transports are still pending');
    if ([...this.assetBuffers.values()].some((entry) => !entry.delivered))
      throw Error('App asset loads are still pending');
    if (this.buffers.size || this.bufferAllocations.size)
      throw Error('App immutable buffers still have live handles/readers');
    this.drop(this.generation);
    this.provider.close();
    this.closed = true;
  }
}
export async function loadAppText(
  root: string,
  quota: number,
  signal?: AbortSignal,
): Promise<AppTextBackend> {
  const budget = new AppTextBudget(quota);
  const provider = await CanvasKitProvider.load(root, budget, signal);
  try {
    signal?.throwIfAborted();
    return new WebAppTextBackend(provider, budget);
  } catch (error) {
    provider.close();
    throw error;
  }
}
