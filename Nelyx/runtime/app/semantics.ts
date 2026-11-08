// SPDX-License-Identifier: BSD-3-Clause
import { SemanticsBinding } from '@nelyx/core/framework/semantics/binding';
import type { SemanticsHandle } from '@nelyx/core/framework/semantics/binding';
import type { BuildOwner } from '@nelyx/core/framework/widgets/framework';
import type { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { PlatformDispatcher } from '@nelyx/core/ui/platform-dispatcher';
import { SemanticsAction, SemanticsActionEvent } from '@nelyx/core/ui/semantics-action';
import { intersect } from '@nelyx/core/ui/geometry';
import type { SemanticsNode } from '@nelyx/core/ui/types';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import type { EngineEvent, EngineResponse } from '../engine-client/codec.ts';
import { protocol as p } from '../engine-client/schema.ts';

const sourceActions = new Map<number, SemanticsAction>([
  [p.semanticsActions.activate, SemanticsAction.tap],
  [p.semanticsActions.longPress, SemanticsAction.longPress],
  [p.semanticsActions.focus, SemanticsAction.focus],
  [p.semanticsActions.increment, SemanticsAction.increase],
  [p.semanticsActions.decrement, SemanticsAction.decrease],
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
    const nodes: SemanticsNode[] = [];
    if (publication) {
      this.handle ??= this.binding.ensureSemantics();
      for (const node of this.frame!.nodes) {
        const semantic = node.semantics;
        if (!semantic || semantic.flags & p.semanticsFlags.hidden) continue;
        const bounds = intersect(node.bounds, node.clip);
        if (bounds.width <= 0 || bounds.height <= 0) continue;
        // SemanticsBinding consumes ids and actual published rectangles. The
        // richer native roles/actions remain owned by the engine/host tree.
        nodes.push({
          id: `${node.node.slot}:${node.node.generation}`,
          role:
            semantic.role === p.semanticsRoles.textField
              ? 'text-field'
              : semantic.role === p.semanticsRoles.text
                ? 'text'
                : semantic.actions & p.semanticsActions.activate
                  ? 'button'
                  : 'group',
          name: semantic.label,
          enabled: !(semantic.flags & p.semanticsFlags.disabled),
          bounds,
        });
      }
    } else {
      this.handle?.dispose();
      this.handle = undefined;
    }
    this.binding.updateViewSemantics(this.viewId, nodes, this.legacyViewId);
    this.boundPublication = publication;
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
      this.binding.updateViewSemantics(this.viewId, [], this.legacyViewId);
      this.boundPublication = 0n;
    }
    try {
      this.binding.handleSemanticsActionEvent(
        new SemanticsActionEvent({
          viewId: this.viewId,
          nodeId: `${event.node.slot}:${event.node.generation}`,
          type: action,
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
