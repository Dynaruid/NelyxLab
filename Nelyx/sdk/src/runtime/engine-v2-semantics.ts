// SPDX-License-Identifier: BSD-3-Clause
import { setManagedAttribute, setManagedText } from './engine-v2-dom.js';
import { protocol as p } from '@nelyx/core/engine';
import type { EngineNodeSnapshot, NodeHandle, SemanticCustomAction } from '@nelyx/core/engine';

const key = (node: NodeHandle) => `${node.slot}:${node.generation}`;
let nextOwner = 0;
type Peer = {
  readonly element: HTMLElement;
  readonly node: EngineNodeSnapshot;
};
type ActionPeer = {
  readonly element: HTMLButtonElement;
  node: EngineNodeSnapshot;
  action: SemanticCustomAction;
};
/** ARIA ownership consumes Core's published tree without moving geometry carriers. */
export class EngineV2BrowserSemantics {
  private readonly prefix = `nelyx-semantics-${++nextOwner}-`;
  private readonly groups = new Map<string, HTMLDivElement>();
  private readonly actions = new Map<string, ActionPeer>();
  constructor(
    private readonly layer: HTMLDivElement,
    private readonly invoke: (node: EngineNodeSnapshot, action: SemanticCustomAction) => void,
  ) {
    layer.setAttribute('role', 'group');
  }
  ownsAction(target: EventTarget | null, node?: NodeHandle): boolean {
    const element = target instanceof Element ? target.closest('button') : null;
    const peer = element ? this.actions.get(element.id) : undefined;
    return !!peer && peer.element === element && (!node || key(peer.node.node) === key(node));
  }
  update(peers: ReadonlyMap<string, Peer>): void {
    const ordered = [...peers.values()]
      .filter((peer) => peer.node.semanticTraversal)
      .sort((a, b) => a.node.semanticTraversal!.index - b.node.semanticTraversal!.index);
    const children = new Map<string, string[]>(),
      targets = new Map<string, string>();
    const wantedGroups = new Set<string>(),
      wantedActions = new Set<string>();
    const actionIds = new Map<string, string[]>();
    for (const peer of ordered) {
      const node = peer.node,
        id = key(node.node),
        parent = node.semanticTraversal!.parent;
      const owner = parent.slot && peers.has(key(parent)) ? key(parent) : '';
      if (!children.has(owner)) children.set(owner, []);
      children.get(owner)!.push(id);
      setManagedAttribute(peer.element, 'id', this.prefix + id);
      const semantics = node.semantics!;
      const ids: string[] = [];
      for (const action of semantics.customActions ?? []) {
        if (!action.invokable || !(semantics.actions & p.semanticsActions.custom)) continue;
        const actionId = `${this.prefix}${id}-action-${action.id}`;
        wantedActions.add(actionId);
        ids.push(actionId);
        let value = this.actions.get(actionId);
        if (!value) {
          const element = document.createElement('button');
          element.type = 'button';
          element.id = actionId;
          element.dataset.nelyxCustomAction = String(action.id);
          element.dataset.nelyxCustomOwner = id;
          Object.assign(element.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: '1px',
            height: '1px',
            opacity: '0',
            padding: '0',
            border: '0',
            pointerEvents: 'none',
            overflow: 'hidden',
          });
          value = { element, node, action };
          const retained = value;
          element.addEventListener('click', (event) => {
            event.stopPropagation();
            if (this.actions.get(actionId) === retained && !element.disabled)
              this.invoke(retained.node, retained.action);
          });
          this.actions.set(actionId, value);
          this.layer.append(element);
        }
        value.node = node;
        value.action = action;
        setManagedText(value.element, action.label || action.hint || '');
        const disabled = !!(semantics.flags & p.semanticsFlags.disabled);
        if (value.element.disabled !== disabled) value.element.disabled = disabled;
      }
      actionIds.set(id, ids);
    }
    // Button, checkbox, slider and text roles flatten their descendants in ARIA.
    // A transparent group keeps both the original control and its named actions
    // reachable by assistive technology through ordinary accessible buttons.
    for (const peer of ordered) {
      const id = key(peer.node.node),
        hasChildren = !!children.get(id)?.length;
      const groupNeeded =
        !!actionIds.get(id)?.length ||
        (hasChildren &&
          peer.node.semantics!.role !== p.semanticsRoles.group &&
          peer.node.semantics!.role !== p.semanticsRoles.radioGroup);
      if (groupNeeded) {
        wantedGroups.add(id);
        let group = this.groups.get(id);
        if (!group) {
          group = document.createElement('div');
          group.id = this.prefix + id + '-group';
          setManagedAttribute(group, 'role', 'group');
          Object.assign(group.style, {
            position: 'absolute',
            width: '1px',
            height: '1px',
            pointerEvents: 'none',
          });
          this.groups.set(id, group);
          this.layer.append(group);
        }
        targets.set(id, group.id);
      } else targets.set(id, peer.element.id);
    }
    for (const peer of ordered) {
      const id = key(peer.node.node),
        group = wantedGroups.has(id) ? this.groups.get(id) : undefined;
      const owns = [
        ...(actionIds.get(id) ?? []),
        ...(children.get(id) ?? []).map((child) => targets.get(child)!),
      ];
      if (group) {
        setManagedAttribute(peer.element, 'aria-owns', null);
        setManagedAttribute(group, 'aria-owns', [peer.element.id, ...owns].join(' '));
      } else if (owns.length) setManagedAttribute(peer.element, 'aria-owns', owns.join(' '));
      else setManagedAttribute(peer.element, 'aria-owns', null);
    }
    const roots = (children.get('') ?? []).map((id) => targets.get(id)!);
    if (roots.length) setManagedAttribute(this.layer, 'aria-owns', roots.join(' '));
    else setManagedAttribute(this.layer, 'aria-owns', null);
    for (const [id, element] of this.groups)
      if (!wantedGroups.has(id)) {
        element.remove();
        this.groups.delete(id);
      }
    for (const [id, peer] of this.actions)
      if (!wantedActions.has(id)) {
        peer.element.remove();
        this.actions.delete(id);
      }
  }
  close(): void {
    for (const element of this.groups.values()) element.remove();
    for (const peer of this.actions.values()) peer.element.remove();
    this.groups.clear();
    this.actions.clear();
    setManagedAttribute(this.layer, 'aria-owns', null);
  }
}
