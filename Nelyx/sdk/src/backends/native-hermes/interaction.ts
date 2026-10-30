// SPDX-License-Identifier: BSD-3-Clause
import type { ViewMetrics, SemanticsNode } from '@nelyx/core/ui/types';
import type { NativeHermesBridge } from './bridge.ts';
import type { NativeInteraction } from '../../runtime/native-interaction.ts';
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
export function connectNativeInteraction(
  interaction: NativeInteraction,
  bridge: NativeHermesBridge,
  metrics: () => ViewMetrics,
) {
  let semanticSnapshots = new Map<
      string,
      { node: SemanticsNode; packet: WindowsSemanticsPacket; parent: number }
    >(),
    queued = false,
    previousFocus = '';
  let live = true,
    publishing = false,
    publishAgain = false;
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
        const surface = {
            surfaceId: 1,
            nativeSurfaceGeneration: m.nativeSurfaceGeneration,
            viewportGeneration: m.viewportGeneration,
          },
          records: unknown[] = [],
          order: string[] = [],
          next = new Map<
            string,
            { node: SemanticsNode; packet: WindowsSemanticsPacket; parent: number }
          >();
        const walk = (nodes: readonly SemanticsNode[], parent = -1) => {
          for (const node of nodes) {
            if (order.length >= 4096) throw new Error('Native semantics node budget exceeded');
            const index = order.length,
              packet = windowsSemanticsPacket(
                node,
                interaction.owner,
                surface,
                interaction.snapshot(),
              ),
              previous = semanticSnapshots.get(node.id);
            order.push(node.id);
            if (
              previous?.node !== node ||
              previous.parent !== parent ||
              previous.packet.viewport !== packet.viewport ||
              previous.packet.surfaceGeneration !== packet.surfaceGeneration
            )
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
            next.set(node.id, { node, packet, parent });
            if (node.children) walk(node.children, index);
          }
        };
        walk(interaction.semanticNodes);
        const removed = [...semanticSnapshots.keys()].filter((id) => !next.has(id));
        semanticSnapshots = next;
        const actions = new Map<string, NativeSemanticSnapshot>();
        for (const [id, snapshot] of next)
          if (
            snapshot.packet.range !== null ||
            snapshot.packet.canActivate ||
            snapshot.packet.focusable ||
            snapshot.packet.text !== null
          )
            actions.set(id, snapshot);
        if (actions.size) actionSnapshots.set(interaction.snapshot(), actions);
        while (actionSnapshots.size > 16)
          actionSnapshots.delete(actionSnapshots.keys().next().value!);
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
          commit: interaction.snapshot(),
          viewport: m.viewportGeneration,
          surface: m.nativeSurfaceGeneration,
          upserts: records,
          removed,
          order,
        });
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
          upserts: [],
          removed: [...semanticSnapshots.keys()],
          order: [],
        });
      semanticSnapshots.clear();
      actionSnapshots.clear();
    },
  };
}
