// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './codec.ts';
import type { EngineNodeSnapshot, EngineResponse } from './codec.ts';
import { State, StatefulWidget, NodeWidget, ScrollView, Box, Text, ValueKey } from './widgets.ts';
import type { Widget, NodeOptions } from './widgets.ts';

/** Portable cancellation, including hosts without DOM globals. Use nativeSignal with fetch on Web. */
export interface ListBuildSignal {
  readonly aborted: boolean;
  readonly nativeSignal: AbortSignal | undefined;
  addEventListener(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: 'abort', listener: () => void): void;
  throwIfAborted(): void;
}
class BuildCancellation {
  private listeners = new Set<() => void>();
  private native = typeof AbortController === 'undefined' ? undefined : new AbortController();
  readonly signal: ListBuildSignal;
  constructor() {
    const owner = this;
    this.signal = {
      aborted: false,
      nativeSignal: this.native?.signal,
      addEventListener(_type, listener) {
        if (owner.listeners.size >= 32) throw new Error('List abort listener budget');
        owner.listeners.add(listener);
      },
      removeEventListener(_type, listener) {
        owner.listeners.delete(listener);
      },
      throwIfAborted() {
        if (this.aborted) throw new Error('List builder canceled');
      },
    };
  }
  abort(): void {
    if (this.signal.aborted) return;
    (this.signal as { aborted: boolean }).aborted = true;
    this.native?.abort();
    for (const listener of this.listeners) listener();
    this.listeners.clear();
  }
}

export interface ListViewOptions {
  readonly itemCount: number;
  /** Change generation when data, ordering, or extent estimates change. */
  readonly generation: bigint;
  readonly estimatedExtent: number;
  readonly itemKey: (index: number) => string | number;
  readonly findChildIndex?: (key: string | number) => number | null;
  readonly itemBuilder: (index: number, signal: ListBuildSignal) => Widget | PromiseLike<Widget>;
  /** Explicit prepared placeholder required for an asynchronous builder. */
  readonly placeholder?: (index: number) => Widget;
  readonly errorBuilder?: (index: number, error: unknown) => Widget;
  readonly keepAlive?: (index: number) => boolean;
  readonly cacheItems?: number;
  readonly onError?: (error: unknown) => void;
}
type Entry = {
  index: number;
  key: string;
  token: bigint;
  abort: BuildCancellation;
  widget: Widget;
  pending: boolean;
};
function keyOf(value: string | number): string {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid list key');
  return `${typeof value}:${value}`;
}
function token(value: string): bigint {
  let hash = 14695981039346656037n;
  for (let i = 0; i < value.length; ++i)
    hash = BigInt.asUintN(64, (hash ^ BigInt(value.charCodeAt(i))) * 1099511628211n);
  return hash || 1n;
}
/** A bounded App builder; item geometry, extent and anchor correction belong to C++. */
export class ListView extends StatefulWidget {
  constructor(
    readonly items: ListViewOptions,
    readonly options: NodeOptions = {},
  ) {
    super(options.key);
    const n = items.cacheItems ?? 96;
    if (
      !Number.isInteger(items.itemCount) ||
      items.itemCount < 0 ||
      items.itemCount > 1_000_000 ||
      items.generation <= 0n ||
      !Number.isFinite(items.estimatedExtent) ||
      items.estimatedExtent <= 0 ||
      items.itemCount * items.estimatedExtent > 1e12 ||
      !Number.isInteger(n) ||
      n < 8 ||
      n > p.limits.listChildren
    )
      throw new RangeError('Invalid native ListView bounds');
  }
  createState(): State {
    return new ListViewState();
  }
}
export class ListViewState extends State<ListView> {
  private entries = new Map<number, Entry>();
  private begin = 0;
  private end = 0;
  private focusedIndex: number | undefined;
  private generation = 0n;
  private anchorKey: string | number | undefined;
  private anchorIndex = 0;
  private focusedKey: string | number | undefined;
  private working = 0;
  private requests: Entry[] = [];
  readonly counters = { built: 0, canceled: 0, failed: 0, peakItems: 0, stale: 0 };
  initState(): void {
    this.reset();
  }
  didUpdateWidget(old: ListView): void {
    if (old.items.generation !== this.widget.items.generation) this.reset();
    else if (
      old.items.itemCount !== this.widget.items.itemCount ||
      old.items.estimatedExtent !== this.widget.items.estimatedExtent
    )
      throw new Error('List data changes require a new generation');
  }
  private reset(): void {
    for (const e of this.entries.values()) e.abort.abort();
    this.entries.clear();
    this.requests.length = 0;
    this.generation = this.widget.items.generation;
    this.focusedIndex =
      this.focusedKey === undefined
        ? undefined
        : (this.widget.items.findChildIndex?.(this.focusedKey) ?? undefined);
    const anchor =
      this.anchorKey === undefined ? null : this.widget.items.findChildIndex?.(this.anchorKey);
    const count = Math.min(
      this.widget.items.itemCount,
      (this.widget.items.cacheItems ?? 96) - 4,
      Math.max(
        8,
        Math.ceil(
          ((this.widget.options.properties?.height ?? 600) * 3) / this.widget.items.estimatedExtent,
        ),
      ),
    );
    this.begin =
      anchor === null || anchor === undefined
        ? Math.max(0, Math.min(this.anchorIndex - 2, this.widget.items.itemCount - count))
        : Math.max(0, Math.min(anchor - 2, this.widget.items.itemCount - count));
    this.end = this.begin + count;
    this.fill();
  }
  private fill(): void {
    const options = this.widget.items,
      wanted = new Set<number>();
    for (let i = this.begin; i < this.end; ++i) wanted.add(i);
    if (
      this.focusedIndex !== undefined &&
      this.focusedIndex >= 0 &&
      this.focusedIndex < options.itemCount
    )
      wanted.add(this.focusedIndex);
    for (const [index] of this.entries)
      if (index === this.focusedIndex || options.keepAlive?.(index)) wanted.add(index);
    if (wanted.size > (options.cacheItems ?? 96))
      throw new Error('List keep-alive budget exceeded');
    for (const [index, e] of this.entries)
      if (!wanted.has(index)) {
        if (e.pending) ++this.counters.canceled;
        e.abort.abort();
        this.entries.delete(index);
      }
    const keys = new Map<bigint, string>();
    for (const e of this.entries.values()) keys.set(e.token, e.key);
    for (const index of wanted)
      if (!this.entries.has(index)) {
        const key = keyOf(options.itemKey(index)),
          hash = token(key);
        if (keys.has(hash)) throw new Error('Duplicate list key or key hash collision');
        keys.set(hash, key);
        const entry: Entry = {
          index,
          key,
          token: hash,
          abort: new BuildCancellation(),
          pending: true,
          widget:
            options.placeholder?.(index) ??
            new Box([], { properties: { height: options.estimatedExtent } }),
        };
        this.entries.set(index, entry);
        this.requests.push(entry);
      }
    this.counters.peakItems = Math.max(this.counters.peakItems, this.entries.size);
    this.pump();
  }
  private pump(): void {
    while (this.working < 4 && this.requests.length) {
      const entry = this.requests.shift()!;
      if (entry.abort.signal.aborted) continue;
      ++this.working;
      const generation = this.generation;
      try {
        const result = this.widget.items.itemBuilder(entry.index, entry.abort.signal);
        ++this.counters.built;
        if (result && typeof (result as PromiseLike<Widget>).then === 'function') {
          if (!this.widget.items.placeholder) {
            void Promise.resolve(result).catch(() => {});
            throw new Error('Async ListView requires an explicit placeholder');
          }
          let timer: ReturnType<typeof setTimeout> | undefined;
          let abort: (() => void) | undefined;
          const stopped = new Promise<never>((_, reject) => {
            abort = () => reject(new Error('List builder canceled'));
            entry.abort.signal.addEventListener('abort', abort, { once: true });
            timer = setTimeout(
              () => reject(new Error('List builder timed out')),
              p.limits.commandTimeoutMs,
            );
          });
          void Promise.race([Promise.resolve(result), stopped])
            .then(
              (widget) => this.resolve(entry, generation, widget),
              (error) => this.fail(entry, generation, error),
            )
            .finally(() => {
              if (timer !== undefined) clearTimeout(timer);
              if (abort) entry.abort.signal.removeEventListener('abort', abort);
              --this.working;
              this.pump();
            });
        } else {
          entry.widget = result as Widget;
          entry.pending = false;
          --this.working;
        }
      } catch (error) {
        --this.working;
        this.fail(entry, generation, error);
      }
    }
  }
  private resolve(entry: Entry, generation: bigint, widget: Widget): void {
    if (
      !this.mounted ||
      entry.abort.signal.aborted ||
      generation !== this.generation ||
      this.entries.get(entry.index) !== entry
    ) {
      ++this.counters.stale;
      return;
    }
    this.setState(() => {
      entry.widget = widget;
      entry.pending = false;
    });
  }
  private fail(entry: Entry, generation: bigint, error: unknown): void {
    if (!this.mounted || entry.abort.signal.aborted || generation !== this.generation) return;
    ++this.counters.failed;
    entry.pending = false;
    entry.widget =
      this.widget.items.errorBuilder?.(entry.index, error) ?? new Text('Item unavailable');
    this.widget.items.onError?.(error);
    this.setState(() => {});
  }
  private observe = (node: EngineNodeSnapshot, snapshot: EngineResponse): void => {
    const list = node.list;
    if (!list || list.generation !== this.generation) return;
    const parent = snapshot.nodes.find(
      (n) => n.node.slot === node.parent.slot && n.node.generation === node.parent.generation,
    );
    const anchor = list.items.find((r) => r.offset + r.extent > (parent?.offset ?? 0) - node.y);
    if (anchor) {
      this.anchorKey = this.widget.items.itemKey(anchor.index);
      this.anchorIndex = anchor.index;
    }
    this.focusedIndex = undefined;
    this.focusedKey = undefined;
    if (snapshot.focus) {
      let current = snapshot.nodes.find(
        (n) =>
          n.node.slot === snapshot.focus!.node.slot &&
          n.node.generation === snapshot.focus!.node.generation,
      );
      for (let depth = 0; current && depth <= p.limits.depth; ++depth) {
        const row = list.items.find(
          (r) =>
            r.node.slot === current!.node.slot && r.node.generation === current!.node.generation,
        );
        if (row) {
          this.focusedIndex = row.index;
          this.focusedKey = this.widget.items.itemKey(row.index);
          break;
        }
        current = snapshot.nodes.find(
          (n) =>
            n.node.slot === current!.parent.slot &&
            n.node.generation === current!.parent.generation,
        );
      }
    }
    if (list.demandBegin >= this.begin && list.demandEnd <= this.end) return;
    const limit = (this.widget.items.cacheItems ?? 96) - 4;
    const begin = Math.min(list.demandBegin, Math.max(0, this.widget.items.itemCount - limit));
    const end = Math.min(this.widget.items.itemCount, begin + limit);
    if (list.demandEnd > end) throw new Error('List viewport exceeds item budget');
    if (begin === this.begin && end === this.end) return;
    this.setState(() => {
      this.begin = begin;
      this.end = end;
      this.fill();
    });
  };
  build(): Widget {
    const items = [...this.entries.values()].sort((a, b) => a.index - b.index);
    return new ScrollView(
      new NodeWidget(
        'sliver',
        items.map(
          (e) =>
            new Box([e.widget], {
              key: new ValueKey(e.key),
              listItem: { index: e.index, key: e.token },
            }),
        ),
        {
          layout: { direction: 'vertical' },
          list: {
            generation: this.generation,
            count: this.widget.items.itemCount,
            begin: this.begin,
            end: this.end,
            estimate: this.widget.items.estimatedExtent,
          },
          onLayout: this.observe,
        },
      ),
      { ...this.widget.options, key: new ValueKey('viewport') },
    );
  }
  dispose(): void {
    for (const e of this.entries.values()) e.abort.abort();
    this.entries.clear();
    this.requests.length = 0;
  }
}
