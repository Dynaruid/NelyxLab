// SPDX-License-Identifier: BSD-3-Clause
import type { ResourceId } from '../ui/types.ts';
import type { ResourceRegistry, ResourceLease } from './resources.ts';
import { invariant } from '../foundation/errors.ts';
import { resourceKey, copyResourceId } from '../ui/resource-retention.ts';
import { textInputSerializationIsPlain } from '../ui/text-input-data.ts';
export interface ParagraphFont {
  readonly resource: ResourceId;
  readonly family: string;
  readonly sourceBytes?: number;
}
export interface CapturedParagraphFont<T> {
  readonly source: T;
  readonly resource: ResourceId;
  readonly family: string;
  readonly sourceBytes: number;
}
export interface ParagraphFontSnapshot<T> {
  readonly revision: number;
  readonly fonts: readonly CapturedParagraphFont<T>[];
  readonly families: readonly string[];
}
type FontKey = readonly [string, number, string, number];
/** One captured catalog per layout boundary. Cache identity and provider creation
 * consume these same values, including when admission invokes caller code.
 * This owner retains metadata only; provider leases retain the native fonts. */
export class ParagraphFontCatalog<T extends ParagraphFont = ParagraphFont> {
  private current: ParagraphFontSnapshot<T> | undefined;
  private keys: readonly FontKey[] = [];
  private serialized: string | undefined;
  private capturing = false;
  constructor(private readonly resources: ResourceRegistry) {}
  get captureRevision(): number {
    return this.current?.revision ?? 0;
  }
  checkRegistry(resources: ResourceRegistry): void {
    invariant(
      resources === this.resources,
      'foreign-font-catalog',
      'Font catalog belongs to another resource registry',
    );
  }
  assertCurrent(snapshot: ParagraphFontSnapshot<T>): void {
    invariant(
      snapshot === this.current,
      'text-cache-catalog-changed',
      'Paragraph font catalog changed during the layout transaction',
    );
  }
  capture(source: Iterable<T>): ParagraphFontSnapshot<T> {
    invariant(!this.capturing, 'reentrant-font-capture', 'Font catalog capture cannot reenter');
    this.capturing = true;
    try {
      const previous = this.current;
      let fonts: CapturedParagraphFont<T>[] | undefined,
        keys: FontKey[] | undefined,
        count = 0;
      for (const font of source) {
        const resource = font.resource;
        if (!this.resources.has(resource)) continue;
        invariant(
          count < 64,
          'font-provider-budget',
          'Paragraph font catalog exceeds64 live fonts',
        );
        const captured = copyResourceId(resource),
          family = font.family,
          sourceBytes = font.sourceBytes ?? 0;
        invariant(
          typeof family === 'string' && family.length > 0,
          'invalid-font-family',
          'Paragraph font family must be nonempty',
        );
        invariant(
          Number.isSafeInteger(sourceBytes) && sourceBytes >= 0,
          'font-provider-budget',
          'Invalid font backing-source byte count',
        );
        const old = previous?.fonts[count],
          same =
            old &&
            font === old.source &&
            captured.id === old.resource.id &&
            captured.generation === old.resource.generation &&
            family === old.family &&
            sourceBytes === old.sourceBytes;
        if (!same && fonts === undefined) {
          fonts = previous?.fonts.slice(0, count) ?? [];
          keys = this.keys.slice(0, count);
        }
        if (fonts) {
          fonts.push(
            same ? old : Object.freeze({ source: font, resource: captured, family, sourceBytes }),
          );
          keys!.push(
            same
              ? this.keys[count]!
              : Object.freeze([captured.id, captured.generation, family, sourceBytes] as const),
          );
        }
        count++;
      }
      if (previous && fonts === undefined && count === previous.fonts.length) return previous;
      fonts ??= previous?.fonts.slice(0, count) ?? [];
      keys ??= this.keys.slice(0, count);
      const revision = (previous?.revision ?? 0) + 1;
      invariant(
        Number.isSafeInteger(revision),
        'text-cache-revision-exhausted',
        'Paragraph font catalog revision exhausted',
      );
      const snapshot = Object.freeze({
        revision,
        fonts: Object.freeze(fonts),
        families: Object.freeze([...new Set(fonts.map((font) => font.family))]),
      });
      this.keys = Object.freeze(keys);
      this.serialized = undefined;
      this.current = snapshot;
      return snapshot;
    } finally {
      this.capturing = false;
    }
  }
  /** Only owned plain metadata may skip repeated JSON. Caller/prototype hooks
   * still use the complete input/catalog serialization in TextLayoutCache. */
  serialization(snapshot: ParagraphFontSnapshot<T>): string {
    this.assertCurrent(snapshot);
    if (textInputSerializationIsPlain() && this.serialized !== undefined) return this.serialized;
    const serialized = JSON.stringify(this.keys);
    this.assertCurrent(snapshot);
    if (textInputSerializationIsPlain()) this.serialized = serialized;
    return serialized;
  }
  keyValues(snapshot: ParagraphFontSnapshot<T>): readonly FontKey[] {
    this.assertCurrent(snapshot);
    return this.keys;
  }
}
export interface FontProviderLease<T, P> {
  readonly provider: P;
  readonly fonts: readonly CapturedParagraphFont<T>[];
  readonly families: readonly string[];
  release(): void;
}
interface Entry<T, P> {
  provider: P;
  fonts: readonly CapturedParagraphFont<T>[];
  families: readonly string[];
  lease: ResourceLease;
  retire(): void;
  references: number;
  sourceBytes: number;
  retiring: boolean;
}
/** One app registry, shared providers for live paragraphs; no idle producer/cache. */
export class ParagraphFontProviders<T extends ParagraphFont, P> {
  private readonly entries = new Map<ParagraphFontSnapshot<T>, Entry<T, P>>();
  private failed = false;
  private bytes = 0;
  private creating = false;
  private readonly uncertain: unknown[] = [];
  constructor(
    private readonly resources: ResourceRegistry,
    private readonly catalog: ParagraphFontCatalog<T>,
    private readonly create: (fonts: readonly CapturedParagraphFont<T>[]) => {
      provider: P;
      retire(): void;
    },
  ) {
    catalog.checkRegistry(resources);
  }
  acquire(primary: ResourceId, snapshot: ParagraphFontSnapshot<T>): FontProviderLease<T, P> {
    invariant(!this.failed, 'font-provider-failed', 'Paragraph font provider retirement failed');
    invariant(
      !this.creating,
      'reentrant-font-provider',
      'Paragraph font provider creation cannot reenter',
    );
    this.catalog.assertCurrent(snapshot);
    const fonts = snapshot.fonts;
    invariant(
      fonts.length > 0 &&
        fonts.length <= 64 &&
        fonts.some((font) => resourceKey(font.resource) === resourceKey(primary)),
      'stale-font',
      'Primary paragraph font is not declared in this app registry',
    );
    let entry = this.entries.get(snapshot);
    invariant(
      !entry?.retiring,
      'retiring-font-provider',
      'Cannot borrow a retiring paragraph font provider',
    );
    if (!entry) {
      const sourceBytes = fonts.reduce((n, font) => n + font.sourceBytes, 0);
      invariant(
        Number.isSafeInteger(sourceBytes) &&
          sourceBytes >= 0 &&
          this.bytes + sourceBytes <= 128 * 1024 * 1024,
        'font-provider-budget',
        'Live paragraph font providers exceed128MiB backing-source budget',
      );
      const lease = this.resources.acquire(fonts.map((f) => f.resource));
      let created: { provider: P; retire(): void } | undefined;
      this.creating = true;
      try {
        created = this.create(fonts);
        entry = {
          provider: created.provider,
          retire: () => created!.retire(),
          fonts,
          families: snapshot.families,
          lease,
          references: 0,
          sourceBytes,
          retiring: false,
        };
        this.catalog.assertCurrent(snapshot);
      } catch (error) {
        const errors = [error];
        let retired = true;
        if (created)
          try {
            created.retire();
          } catch (cleanup) {
            retired = false;
            this.failed = true;
            this.bytes += sourceBytes;
            this.uncertain.push({ created, lease, fonts });
            errors.push(cleanup);
          }
        if (retired)
          try {
            lease.returnBy('caller');
          } catch (cleanup) {
            this.failed = true;
            errors.push(cleanup);
          }
        if (errors.length > 1)
          throw new AggregateError(errors, 'Paragraph font provider creation/retirement failed');
        throw error;
      } finally {
        this.creating = false;
      }
      this.entries.set(snapshot, entry!);
      this.bytes += sourceBytes;
    }
    entry.references++;
    const current = entry;
    let released = false;
    return {
      provider: entry.provider,
      fonts: entry.fonts,
      families: entry.families,
      release: () => {
        if (released) return;
        released = true;
        if (--current.references !== 0) return;
        current.retiring = true;
        try {
          current.retire();
        } catch (error) {
          this.failed = true;
          throw error;
        }
        this.entries.delete(snapshot);
        this.bytes -= current.sourceBytes;
        try {
          current.lease.returnBy('caller');
        } catch (error) {
          this.failed = true;
          throw error;
        }
      },
    };
  }
  get debugProviderCount(): number {
    return this.entries.size + this.uncertain.length;
  }
  get debugSourceBytes(): number {
    return this.bytes;
  }
}
