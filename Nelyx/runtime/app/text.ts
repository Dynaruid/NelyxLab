// SPDX-License-Identifier: BSD-3-Clause
import { resourceOwner } from '@nelyx/core/ui/resource-retention';
import { TextLayoutBudget } from '@nelyx/core/hosting/text-layout-budget';
import { registerTextFontRevision } from '@nelyx/core/hosting/text-fonts';
import type { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { freezeTextInput, freezeTextLayout, freezeTextRect, textRange } from '@nelyx/core/ui/text';
import type {
  ResourceId,
  TextBoxQuery,
  TextClusterInfo,
  TextLayout,
  TextLayoutInput,
  TextLayoutRequest,
  TextLayoutService,
  TextHit,
} from '@nelyx/core/ui/types';
import type {
  AppTextBackend,
  AppTextExecution,
  AppTextInput,
  AppTextSnapshot,
} from '../engine-client/app-text.ts';
import { appTextServiceVersion } from '../engine-client/app-text.ts';
import { originalParagraphInput } from './paragraph.ts';
import { encodeUtf8 } from '../engine-client/utf8.ts';
import type { FontResourceBinding } from '../engine-client/font-resource.ts';

export interface AppParagraphFontLease {
  /** Keeps this Core producer live for Source recordings or unacknowledged scenes. */
  readonly binding: Pick<FontResourceBinding, 'resource' | 'fontRevision'>;
  release(): void;
}
type Entry = {
  readonly handle: number;
  readonly fontRevision: number;
  readonly layout: TextLayout;
  readonly input: AppTextInput;
  readonly fontLease?: AppParagraphFontLease;
};
const integer = (value: number, maximum = 0xffffffff) => {
  if (!Number.isInteger(value) || value < 0 || value > maximum)
    throw new RangeError('App text offset outside its bounded ABI');
};
const point = (x: number, y: number) => {
  if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e12 || Math.abs(y) > 1e12)
    throw new RangeError('Invalid App text point');
};
/** Source resource accounting and synchronous API, without TS shaping/layout. */
export class AppTextLayoutService implements TextLayoutService {
  private readonly budget: TextLayoutBudget;
  private readonly entries = new Map<TextLayout, Entry>();
  private readonly paintEntries = new Map<string, Entry>();
  private sdkPaintCaptures = 0;
  private closed = false;
  private failed = false;
  private fontCurrent = true;
  private observedFontRevision: number;
  private closeFailure: { error: unknown } | undefined;
  private sdkLayouts = 0;
  private sdkQueries = 0;
  private closedSnapshot: AppTextSnapshot | undefined;
  constructor(
    private readonly backend: AppTextBackend,
    private readonly resources: ResourceRegistry,
    private readonly font: ResourceId,
    private readonly unsupported: (reason: string) => never,
    private readonly retainFont?: (revision: number) => AppParagraphFontLease,
    private readonly ownsBackend = true,
  ) {
    this.budget = new TextLayoutBudget(resources);
    const state = backend.snapshot();
    if (
      state.version !== appTextServiceVersion ||
      !Number.isSafeInteger(state.fontRevision) ||
      state.fontRevision < 1 ||
      state.closed
    )
      throw Error('App paragraph service version/font cohort unavailable');
    this.observedFontRevision = state.fontRevision;
    registerTextFontRevision(this, () => this.fontRevision);
  }
  get fontRevision(): number {
    this.ensure();
    return this.observedFontRevision;
  }
  get execution(): AppTextExecution {
    return Object.freeze({
      ...(this.closedSnapshot ?? this.backend.snapshot()),
      sdkLayouts: this.sdkLayouts,
      sdkQueries: this.sdkQueries,
      sdkPaintCaptures: this.sdkPaintCaptures,
      tsFallbacks: 0,
    });
  }
  observeFontRevision(revision: bigint): void {
    // An earlier publication may arrive after a newer Core revision. During
    // activation the backend also keeps the previous cohort available for App.
    if (
      revision < BigInt(this.observedFontRevision) &&
      revision !== BigInt(this.backend.snapshot().fontRevision)
    )
      return;
    let available = false;
    if (revision >= 1n && revision <= BigInt(Number.MAX_SAFE_INTEGER)) {
      try {
        available = this.backend.snapshot(Number(revision)).fontRevision === Number(revision);
      } catch {
        // A foreign/retired revision also latches the existing fail-closed guard.
      }
    }
    if (!available) {
      this.fontCurrent = false;
      this.unsupported('App-text-font-revision');
    }
    this.observedFontRevision = Number(revision);
  }
  private ensure(): void {
    if (this.closed || this.failed || !this.fontCurrent)
      throw Error('App paragraph owner is closed, its font is stale or retirement failed');
  }
  fontFamily(font: ResourceId): string {
    this.ensure();
    if (
      font.id !== this.font.id ||
      font.generation !== this.font.generation ||
      !this.resources.has(font)
    )
      return this.unsupported('foreign-provider-font');
    return 'NelyxDefault';
  }
  private input(input: TextLayoutInput): AppTextInput {
    encodeUtf8(input.text, 16384);
    const state = this.backend.snapshot(this.observedFontRevision);
    return originalParagraphInput(
      input,
      this.unsupported,
      false,
      false,
      new Set(state.fontFamilies),
    );
  }
  get fontFamilies(): ReadonlySet<string> {
    this.ensure();
    return new Set(this.backend.snapshot(this.observedFontRevision).fontFamilies);
  }
  layout(input: TextLayoutInput, request?: TextLayoutRequest): TextLayout {
    this.ensure();
    const snapshot = freezeTextInput(input);
    this.fontFamily(snapshot.font);
    const data = this.input(snapshot);
    this.budget.admit(snapshot, request);
    const fontHold = this.resources.acquire([snapshot.font]);
    let handle: number | undefined;
    let fontLease: AppParagraphFontLease | undefined;
    let registered = false;
    try {
      const acquired = this.retainFont?.(this.observedFontRevision);
      if (acquired) {
        const { resource, fontRevision } = acquired.binding;
        fontLease = {
          binding: Object.freeze({
            resource: resource ? Object.freeze({ ...resource }) : null,
            fontRevision,
          }),
          release: () => acquired.release(),
        };
        if (fontRevision !== BigInt(this.observedFontRevision))
          throw Error('App paragraph font binding revision differs');
      }
      const result = this.backend.layout(data, this.observedFontRevision);
      handle = result.handle;
      ++this.sdkLayouts;
      if (
        !Number.isSafeInteger(result.handle) ||
        result.handle <= 0 ||
        result.fontRevision !== this.observedFontRevision
      )
        throw Error('Invalid App paragraph handle');
      const resource = this.resources.allocateId('engine-v2-App-paragraph'),
        layout = freezeTextLayout(resource, snapshot, result.geometry),
        entry: Entry = {
          handle: result.handle,
          fontRevision: result.fontRevision,
          layout,
          input: data,
          ...(fontLease ? { fontLease } : {}),
        },
        paintKey = JSON.stringify([layout.resource.id, layout.resource.generation]);
      this.resources.register(
        { ...resource, kind: 'paragraph' },
        () => {
          try {
            this.backend.release(entry.handle);
            fontHold.returnBy('caller');
            entry.fontLease?.release();
            this.entries.delete(layout);
            this.paintEntries.delete(paintKey);
          } catch (error) {
            this.failed = true;
            throw error;
          }
        },
        this.budget.registration(layout, snapshot),
      );
      registered = true;
      this.entries.set(layout, entry);
      this.paintEntries.set(paintKey, entry);
      try {
        this.resources.bindResource(layout.resource);
      } catch (error) {
        try {
          this.resources.releaseProducer(resource);
        } catch (cleanup) {
          throw new AggregateError([error, cleanup], 'App paragraph binding and retirement failed');
        }
        throw error;
      }
      return layout;
    } catch (error) {
      if (registered) throw error;
      const failures = [error];
      let retired = false;
      try {
        if (handle !== undefined) this.backend.release(handle);
        retired = true;
      } catch (cleanup) {
        this.failed = true;
        failures.push(cleanup);
      }
      if (retired) {
        try {
          fontHold.returnBy('caller');
          fontLease?.release();
        } catch (cleanup) {
          this.failed = true;
          failures.push(cleanup);
        }
      }
      if (failures.length > 1)
        throw new AggregateError(failures, 'App paragraph construction and retirement failed');
      throw error;
    }
  }
  /** A live Source recording can outlive its painter producer. Copy only its
   * immutable configuration; the App paragraph/handle never enters a packet. */
  capturePaint(resource: ResourceId) {
    const entry = this.paintEntry(resource);
    const layout = entry.layout,
      width = Number.isFinite(layout.width) ? layout.width : layout.maxIntrinsicWidth;
    if (
      !Number.isFinite(width) ||
      width < 0 ||
      !Number.isFinite(layout.height) ||
      entry.input.fontSize <= 0
    )
      return this.unsupported('App-text-paint-geometry');
    ++this.sdkPaintCaptures;
    return Object.freeze({
      input: Object.freeze({ ...entry.input, width }),
      ...(entry.fontLease ? { fontBinding: entry.fontLease.binding } : {}),
      fontRevision: BigInt(entry.fontRevision),
      unbounded: entry.input.width === Infinity,
      width,
      height: layout.height,
      baseline: layout.alphabeticBaseline,
    });
  }
  /** Captured input no longer needs the App paragraph, but a later document
   * transaction must still be able to acquire its Core font producer. */
  retainPaintFont(resource: ResourceId): AppParagraphFontLease | undefined {
    return this.retainFont?.(this.paintEntry(resource).fontRevision);
  }
  /** A retained Source projection owns the immutable font revision even after
   * the paragraph producer that recorded it has retired. */
  retainCapturedFont(revision: bigint): AppParagraphFontLease | undefined {
    const value = Number(revision);
    if (!Number.isSafeInteger(value) || value <= 0) throw Error('Invalid captured font revision');
    return this.retainFont?.(value);
  }
  private paintEntry(resource: ResourceId): Entry {
    this.ensure();
    // A foreign Proxy is rejected before any field access.
    if (resourceOwner(resource) !== this.resources)
      throw Error('Foreign App paragraph paint resource');
    const entry = this.paintEntries.get(JSON.stringify([resource.id, resource.generation]));
    if (!entry || !this.resources.isRetained(resource))
      throw Error('Retired App paragraph paint resource');
    return entry;
  }
  private current(layout: TextLayout): Entry {
    this.ensure();
    // Exact local identity is checked before reading any caller-controlled field.
    const entry = this.entries.get(layout);
    if (!entry || !this.resources.hasInitialProducer(entry.layout.resource))
      throw Error('Foreign or retired App paragraph');
    return entry;
  }
  private cluster<T extends TextClusterInfo>(layout: TextLayout, value: T | null): T | null {
    if (!value) return null;
    textRange(layout, value.start, value.end);
    if (value.direction !== 'ltr' && value.direction !== 'rtl')
      throw Error('Invalid App paragraph direction');
    return Object.freeze({ ...value, bounds: freezeTextRect(value.bounds) });
  }
  range(layout: TextLayout, start: number, end: number) {
    this.current(layout);
    textRange(layout, start, end);
    return Object.freeze(this.boxes(layout, start, end).map((box) => box.rect));
  }
  boxes(layout: TextLayout, start: number, end: number, options: TextBoxQuery = {}) {
    const entry = this.current(layout);
    integer(start);
    integer(end);
    const height = [
        'tight',
        'max',
        'includeLineSpacingMiddle',
        'includeLineSpacingTop',
        'includeLineSpacingBottom',
        'strut',
      ].indexOf(options.heightStyle ?? 'tight'),
      width = ['tight', 'max'].indexOf(options.widthStyle ?? 'tight');
    if (height < 0 || width < 0) throw Error('Invalid App text box style');
    const boxes = this.backend.boxes(entry.handle, start, end, height, width);
    ++this.sdkQueries;
    if (boxes.length > 32768 / 40) throw Error('App text box geometry budget exceeded');
    return Object.freeze(
      boxes.map((box) => {
        if (box.direction !== 'ltr' && box.direction !== 'rtl')
          throw Error('Invalid App text box direction');
        return Object.freeze({ rect: freezeTextRect(box.rect), direction: box.direction });
      }),
    );
  }
  hit(layout: TextLayout, x: number, y: number): TextHit {
    const entry = this.current(layout);
    point(x, y);
    const hit = this.backend.hit(entry.handle, x, y);
    ++this.sdkQueries;
    textRange(layout, hit.position, hit.position);
    if (hit.affinity !== 'upstream' && hit.affinity !== 'downstream')
      throw Error('Invalid App text hit affinity');
    return Object.freeze({ ...hit });
  }
  glyphAt(layout: TextLayout, offset: number) {
    const entry = this.current(layout);
    integer(offset, layout.input.text.length);
    const value = this.backend.glyph(entry.handle, offset);
    ++this.sdkQueries;
    if (value && typeof value.isEllipsis !== 'boolean') throw Error('Invalid App ellipsis flag');
    return this.cluster(layout, value);
  }
  closestGlyph(layout: TextLayout, x: number, y: number) {
    const entry = this.current(layout);
    point(x, y);
    const value = this.backend.closest(entry.handle, x, y);
    ++this.sdkQueries;
    return this.cluster(layout, value);
  }
  wordBoundary(layout: TextLayout, offset: number) {
    const entry = this.current(layout);
    integer(offset);
    const value = this.backend.word(entry.handle, offset);
    ++this.sdkQueries;
    textRange(layout, value.start, value.end);
    return Object.freeze({ start: value.start, end: value.end });
  }
  lineNumberAt(layout: TextLayout, offset: number): number | null {
    const entry = this.current(layout);
    integer(offset);
    const value = this.backend.line(entry.handle, offset);
    ++this.sdkQueries;
    if (value !== null && (!Number.isInteger(value) || value < 0 || value >= layout.lines.length))
      throw Error('Invalid App paragraph line number');
    return value;
  }
  close(): void {
    if (this.closed) {
      if (this.closeFailure) throw this.closeFailure.error;
      return;
    }
    this.closed = true;
    // OriginalWidgetHost disposes its registry first. A surviving external
    // resource holder is an owner failure, never permission to retire it early.
    try {
      if (this.entries.size || this.failed)
        throw Error('App paragraph resources have surviving or uncertain holders');
      if (this.ownsBackend) this.backend.close();
      this.closedSnapshot = this.backend.snapshot();
    } catch (error) {
      this.closeFailure = { error };
      throw error;
    }
  }
}
