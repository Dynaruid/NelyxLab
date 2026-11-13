// SPDX-License-Identifier: BSD-3-Clause
import { SemanticsBinding } from '@nelyx/core/framework/semantics/binding';
import type { SemanticsHandle } from '@nelyx/core/framework/semantics/binding';
import type { BuildOwner } from '@nelyx/core/framework/widgets/framework';
import type { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { PlatformDispatcher } from '@nelyx/core/ui/platform-dispatcher';
import { SemanticsAction, SemanticsActionEvent } from '@nelyx/core/ui/semantics-action';
import { intersect } from '@nelyx/core/ui/geometry';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import type { Rect } from '@nelyx/core/ui/types';
import type { EngineEvent, EngineResponse, EngineNodeSnapshot } from '../engine-client/codec.ts';
import { protocol as p } from '../engine-client/schema.ts';
import { observationNode } from '../engine-client/node-index.ts';

const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now());
const noRect = () => null;

const sourceActions = new Map<number, SemanticsAction>([
  [p.semanticsActions.activate, SemanticsAction.tap],
  [p.semanticsActions.longPress, SemanticsAction.longPress],
  [p.semanticsActions.focus, SemanticsAction.focus],
  [p.semanticsActions.increment, SemanticsAction.increase],
  [p.semanticsActions.decrement, SemanticsAction.decrease],
  [p.semanticsActions.custom, SemanticsAction.customAction],
]);

/** Source action listeners and rectangles follow the actual native View publication.
 * This owner does not attach a TS semantics/layout pipeline or perform App hit tests. */
export class OriginalSemanticsBridge {
  readonly binding: SemanticsBinding;
  private readonly lease: Disposable;
  private readonly releaseClosing: (() => void) | undefined;
  private readonly legacyViewId: string;
  private handle: SemanticsHandle | undefined;
  private frame: EngineResponse | undefined;
  private state: EngineResponse | undefined;
  private boundPublication = 0n;
  private stopped = false;
  private closed = false;
  readonly counters = {
    publications: 0,
    invalidations: 0,
    refreshMs: 0,
    maxRefreshMs: 0,
    rectQueries: 0,
    resolvedRects: 0,
    queryMs: 0,
    visitedPublicationNodes: 0,
    temporarySemanticsNodes: 0,
  };
  constructor(
    private readonly viewId: number,
    owner: BuildOwner,
    scheduler: FrameScheduler,
  ) {
    this.legacyViewId = owner.services.owner.id;
    const messenger = owner.services.binaryMessenger,
      dispatcher = messenger ? PlatformDispatcher.maybeForMessenger(messenger) : undefined;
    this.binding = new SemanticsBinding({
      viewId,
      scheduler,
      ...(dispatcher ? { dispatcher } : {}),
    });
    try {
      this.lease = owner.bindSemanticsBinding(this.binding);
    } catch (error) {
      this.binding.dispose();
      throw error;
    }
    try {
      this.releaseClosing = dispatcher?.onClosing(() => this.stop());
    } catch (error) {
      try {
        this.lease.dispose();
      } finally {
        this.binding.dispose();
      }
      throw error;
    }
  }
  observePublication(frame: EngineResponse): void {
    if (this.stopped) return;
    this.frame = frame;
    this.refresh();
  }
  observeState(state: EngineResponse): void {
    if (this.stopped) return;
    this.state = state;
    this.refresh();
  }
  private get current(): boolean {
    const frame = this.frame,
      state = this.state;
    return !!(
      frame?.publication &&
      state?.visible &&
      !state.closed &&
      frame.publication === state.publication &&
      frame.publishedMetrics === state.metrics &&
      frame.publishedDevice === state.device
    );
  }
  private refresh(): void {
    if (this.stopped) return;
    const publication = this.current ? this.frame!.publication : 0n;
    if (publication === this.boundPublication) return;
    const started = now();
    if (publication) {
      this.handle ??= this.binding.ensureSemantics();
      // Geometry/focus/layers already share this cohort's generation-checked
      // index. No semantics list or eager rectangle Map is needed by App.
      const frame = this.frame!;
      let queriedRects: Map<EngineNodeSnapshot, Rect> | undefined;
      this.binding._updateViewSemanticsRectResolver(
        this.viewId,
        (id) => {
          const queryStarted = now();
          ++this.counters.rectQueries;
          try {
            if (typeof id !== 'string') return null;
            const match = /^(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(id);
            if (!match) return null;
            const slot = Number(match[1]),
              generation = Number(match[2]);
            if (slot > 0xffffffff || generation > 0xffffffff) return null;
            const node = observationNode(frame, { slot, generation });
            if (!node?.semantics || node.semantics.flags & p.semanticsFlags.hidden) return null;
            const queried = queriedRects?.get(node);
            if (queried) {
              ++this.counters.resolvedRects;
              return queried;
            }
            const bounds = intersect(node.semanticGeometry?.bounds ?? node.bounds, node.clip);
            if (bounds.width <= 0 || bounds.height <= 0) return null;
            ++this.counters.resolvedRects;
            const rect = Object.freeze(bounds);
            (queriedRects ??= new Map()).set(node, rect);
            return rect;
          } finally {
            this.counters.queryMs += now() - queryStarted;
          }
        },
        this.legacyViewId,
      );
      ++this.counters.publications;
    } else {
      this.handle?.dispose();
      this.handle = undefined;
      this.binding._updateViewSemanticsRectResolver(this.viewId, noRect, this.legacyViewId);
      ++this.counters.invalidations;
    }
    this.boundPublication = publication;
    const elapsed = now() - started;
    this.counters.refreshMs += elapsed;
    this.counters.maxRefreshMs = Math.max(this.counters.maxRefreshMs, elapsed);
  }
  action(event: EngineEvent, perform: () => void): void {
    if (this.stopped) return;
    const action = sourceActions.get(Number(event.detail));
    if (!action) {
      // Engine range/set-value and radio deselect have no matching Source
      // SemanticsAction. Preserve their existing callback without inventing one.
      perform();
      return;
    }
    if (!this.current || event.id !== this.frame!.publication) {
      this.binding._updateViewSemanticsRectResolver(this.viewId, noRect, this.legacyViewId);
      this.boundPublication = 0n;
    }
    try {
      this.binding.handleSemanticsActionEvent(
        new SemanticsActionEvent({
          viewId: this.viewId,
          nodeId: `${event.node.slot}:${event.node.generation}`,
          type: action,
          ...(action === SemanticsAction.customAction ? { arguments: event.x } : {}),
        }),
        () => perform(),
      );
    } finally {
      this.refresh();
    }
  }
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.frame = this.state = undefined;
    try {
      this.handle?.dispose();
    } finally {
      this.handle = undefined;
      this.binding.dispose();
    }
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.stop();
    } finally {
      try {
        this.releaseClosing?.();
      } finally {
        this.lease.dispose();
      }
    }
  }
}
