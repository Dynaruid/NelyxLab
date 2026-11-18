// SPDX-License-Identifier: BSD-3-Clause
import type { ViewMetrics, SemanticsNode } from '@nelyx/core/ui/types';
import type { NativeHermesBridge } from './bridge.ts';
import { sameSemantics, type NativeInteraction } from '../../runtime/native-interaction.ts';
import {
  windowsSemanticsPacket,
  performWindowsSemanticsAction,
} from '../../platforms/windows/semantics-packet.ts';
import type {
  WindowsSemanticsAction,
  WindowsSemanticsPacket,
} from '../../platforms/windows/semantics-packet.ts';
interface NativeSemanticSnapshot {
  readonly node: SemanticsNode;
  readonly packet: WindowsSemanticsPacket;
  readonly parent: number;
}
// The receiver stamps retained records with the new commit while applying order.
// Compare the projected values only. Descendants have their own records.
function sameWindowsRecord(previous: NativeSemanticSnapshot, next: NativeSemanticSnapshot) {
  const a = previous.packet, b = next.packet;
  if (previous.parent !== next.parent) return false;
  if (previous.node === next.node) return true;
  const old = previous.node, node = next.node;
  return a.source === b.source && a.role === b.role &&
    a.bounds.x === b.bounds.x && a.bounds.y === b.bounds.y &&
    a.bounds.width === b.bounds.width && a.bounds.height === b.bounds.height &&
    a.enabled === b.enabled && a.focused === b.focused && a.focusable === b.focusable &&
    a.canActivate === b.canActivate && a.isSlider === b.isSlider &&
    old.name === node.name && (old.tooltip ?? '') === (node.tooltip ?? '') &&
    (old.semanticsIdentifier ?? old.id) === (node.semanticsIdentifier ?? node.id) &&
    (old.isLink === true) === (node.isLink === true) &&
    (old.selected ?? null) === (node.selected ?? null) &&
    (old.checked ?? null) === (node.checked ?? null) &&
    (b.text !== null || (old.value ?? null) === (node.value ?? null)) &&
    sameSemantics(a.range, b.range) && sameSemantics(a.text, b.text);
}
export function connectNativeInteraction(
  interaction: NativeInteraction,
  bridge: NativeHermesBridge,
  metrics: () => ViewMetrics,
) {
  let semanticSnapshots = new Map<string, NativeSemanticSnapshot>(),
    queued = false,
    previousFocus = '';
  let live = true,
    publishing = false,
    publishAgain = false;
  let semanticScope: { viewport: number; surface: number } | undefined;
  // UI publishes and runtime events have different queues. Keep only actionable
  // controls from at most 16 published commits, so an action from the actual
  // native tree can be matched while a newer delta is still waiting on UI.
  const actionSnapshots = new Map<number, Map<string, NativeSemanticSnapshot>>();
  const publish = () => {
    if (!live) return;
    if (publishing) {
      publishAgain = true;
      return;
    }
    publishing = true;
    try {
      do {
        publishAgain = false;
        const m = metrics();
        if (m.nativeSurfaceGeneration === null) return;
        // UI can discard queued deltas for an obsolete viewport. The runtime
        // cannot diff the first new generation against those unacknowledged
        // snapshots: native may still own an earlier tree.
        const reset =
          semanticScope?.viewport !== m.viewportGeneration ||
          semanticScope?.surface !== m.nativeSurfaceGeneration;
        const surface = {
            surfaceId: 1,
            nativeSurfaceGeneration: m.nativeSurfaceGeneration,
            viewportGeneration: m.viewportGeneration,
          },
          records: unknown[] = [],
          order: string[] = [],
          next = new Map<string, NativeSemanticSnapshot>();
        const commit = interaction.snapshot();
        const walk = (nodes: readonly SemanticsNode[], parent = -1) => {
          for (const node of nodes) {
            if (order.length >= 4096) throw new Error('Native semantics node budget exceeded');
            const index = order.length,
              packet = windowsSemanticsPacket(
                node,
                interaction.owner,
                surface,
                commit,
              ),
              previous = semanticSnapshots.get(node.id),
              snapshot = { node, packet, parent };
            order.push(node.id);
            if (reset || !previous || !sameWindowsRecord(previous, snapshot))
              records.push({
                packet,
                name: node.name,
                parent,
                selected: node.selected ?? null,
                checked: node.checked ?? null,
                value: node.role === 'text-field' ? null : (node.value ?? null),
                tooltip: node.tooltip ?? '',
                automationId: node.semanticsIdentifier ?? node.id,
                isLink: node.isLink === true,
              });
            next.set(node.id, snapshot);
            if (node.children) walk(node.children, index);
          }
        };
        walk(interaction.semanticNodes);
        const removed = reset ? [] : [...semanticSnapshots.keys()].filter((id) => !next.has(id));
        const actions = new Map<string, NativeSemanticSnapshot>();
        for (const [id, snapshot] of next)
          if (
            snapshot.packet.range !== null ||
            snapshot.packet.canActivate ||
            snapshot.packet.focusable ||
            snapshot.packet.text !== null
          )
            actions.set(id, snapshot);
        if (bridge.diagnostics) {
          const focused = [...next.values()]
            .filter((value) => value.packet.focused)
            .map((value) => value.packet.id)
            .join(',');
          if (focused !== previousFocus) {
            previousFocus = focused;
            bridge.log('NELYX_NATIVE_SEMANTICS_FOCUS ' + JSON.stringify({ focused }));
          }
        }
        bridge.publishSemantics({
          protocol: 1,
          owner: interaction.owner,
          commit,
          viewport: m.viewportGeneration,
          surface: m.nativeSurfaceGeneration,
          reset,
          upserts: records,
          removed,
          order,
        });
        semanticSnapshots = next;
        if (actions.size) actionSnapshots.set(commit, actions);
        while (actionSnapshots.size > 16)
          actionSnapshots.delete(actionSnapshots.keys().next().value!);
        semanticScope = { viewport: m.viewportGeneration, surface: m.nativeSurfaceGeneration };
      } while (publishAgain);
    } finally {
      publishing = false;
    }
  };
  const unsubscribe = interaction.subscribe(() => {
    if (!live || queued) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      publish();
    });
  });
  publish();
  return {
    event(kind: string, value: unknown) {
      if (!live) return;
      if (kind === 'semantics') {
        const event = value as WindowsSemanticsAction,
          snapshot = actionSnapshots.get(event.commit)?.get(event.id),
          m = metrics();
        const accepted =
          !!snapshot &&
          snapshot.packet.viewport === m.viewportGeneration &&
          snapshot.packet.surfaceGeneration === m.nativeSurfaceGeneration &&
          performWindowsSemanticsAction(interaction, snapshot.node, snapshot.packet, event);
        if (bridge.diagnostics)
          bridge.log(
            'NELYX_NATIVE_SEMANTICS_ACTION ' +
              JSON.stringify({ event, accepted, expected: snapshot?.packet.commit }),
          );
        return accepted;
      }
    },
    dispose() {
      if (!live) return;
      live = false;
      unsubscribe();
      const m = metrics();
      if (m.nativeSurfaceGeneration !== null)
        bridge.publishSemantics({
          protocol: 1,
          owner: interaction.owner,
          commit: interaction.snapshot() + 1,
          viewport: m.viewportGeneration,
          surface: m.nativeSurfaceGeneration,
          reset: true,
          upserts: [],
          removed: [],
          order: [],
        });
      semanticSnapshots.clear();
      actionSnapshots.clear();
    },
  };
}
