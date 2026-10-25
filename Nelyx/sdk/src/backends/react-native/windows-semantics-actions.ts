// SPDX-License-Identifier: BSD-3-Clause
import type {SemanticsNode} from '@nelyx/core/ui/types';
import type {ReactNativeInteraction} from './interaction.ts';
import {performWindowsSemanticsAction} from './windows-semantics-packet.ts';
import type {WindowsSemanticsAction,WindowsSemanticsPacket} from './windows-semantics-packet.ts';

interface Snapshot {readonly node:SemanticsNode;readonly packet:WindowsSemanticsPacket}
function sameEndpoint(a:WindowsSemanticsPacket,b:WindowsSemanticsPacket):boolean{
  return a.id===b.id&&a.source===b.source&&a.role===b.role&&a.owner.id===b.owner.id&&a.owner.generation===b.owner.generation&&
    a.surface===b.surface&&a.surfaceGeneration===b.surfaceGeneration&&a.viewport===b.viewport&&
    a.enabled===b.enabled&&a.focusable===b.focusable&&a.canActivate===b.canActivate&&a.isSlider===b.isSlider&&a.range?.readOnly===b.range?.readOnly&&
    (a.text===null)===(b.text===null)&&a.text?.generation===b.text?.generation&&a.text?.readOnly===b.text?.readOnly&&
    a.text?.obscured===b.text?.obscured&&a.text?.selectionEnabled===b.text?.selectionEnabled;
}

/** Native UI and React commit/event queues advance independently. Only committed
 * packets are kept, with the same 16-commit bound as the direct native host. */
export class WindowsSemanticsActions {
  private readonly snapshots=new Map<number,Snapshot>();
  private interaction:ReactNativeInteraction|undefined;
  private latest:Snapshot|undefined;
  publish(interaction:ReactNativeInteraction,node:SemanticsNode,packet:WindowsSemanticsPacket):void{
    if(!interaction.isLiveNodeSnapshot(node)){this.clear();return;}
    if(this.interaction!==interaction||this.latest&&!sameEndpoint(this.latest.packet,packet))this.clear();
    this.interaction=interaction;const snapshot={node,packet};this.latest=snapshot;this.snapshots.set(packet.commit,snapshot);
    while(this.snapshots.size>16)this.snapshots.delete(this.snapshots.keys().next().value!);
  }
  perform(event:WindowsSemanticsAction):boolean{
    const interaction=this.interaction,latest=this.latest;
    if(!event||!interaction||!latest||!interaction.isLiveNodeSnapshot(latest.node))return false;
    const snapshot=this.snapshots.get(event.commit);
    // The original packet still fences text revisions, ranges and control
    // lifetime. Current callbacks are resolved only after those checks pass.
    return !!snapshot&&snapshot.packet.enabled&&performWindowsSemanticsAction(interaction,snapshot.node,snapshot.packet,event);
  }
  clear():void{this.snapshots.clear();this.latest=undefined;this.interaction=undefined;}
}
