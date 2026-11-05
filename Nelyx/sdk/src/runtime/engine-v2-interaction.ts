// SPDX-License-Identifier: BSD-3-Clause
import {
  protocol as p,
  packet,
  response,
  body,
  writeHandle,
  editBody,
  focusBody,
  semanticActionBody,
  keyBody,
} from '@nelyx/core/v2';
import type {
  EngineResponse,
  EngineNodeSnapshot,
  EditingSnapshot,
  NodeHandle,
  EditingUpdate,
} from '@nelyx/core/v2';

const owner = { session: 1, app: 1, view: 1, generation: 1 };
const key = (n: NodeHandle) => `${n.slot}:${n.generation}`;
type Peer = {
  element: HTMLElement;
  node: EngineNodeSnapshot;
  publication: bigint;
  value: EditingSnapshot | null;
  composing: boolean;
  ending: boolean;
  compositionStart: number;
  session: bigint;
  pending: number;
};
function isInput(element: HTMLElement): element is HTMLTextAreaElement | HTMLInputElement {
  return element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement;
}
/** Main-thread DOM input/ARIA adapter. Scene bounds always come from Core publication. */
export class EngineV2BrowserInteraction {
  readonly profile = 'dom-textarea/aria';
  readonly counters = { edits: 0, actions: 0, snapshots: 0, peers: 0, rejected: 0 };
  private layer: HTMLDivElement;
  private peers = new Map<string, Peer>();
  private geometry=new Map<string,HTMLDivElement>();
  private closed = false;
  private syncing = false;
  private wanted = false;
  private tail: Promise<unknown> = Promise.resolve();
  private queued = 0;
  private queuedBytes = 0;
  private publication = 0n;
  private active: Peer | undefined;
  private applying = false;
  private forced = new Map<
    bigint,
    { bytes: Uint8Array; result: Promise<Uint8Array>; settled: boolean }
  >();
  private resize: () => void;
  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly exchange: (bytes: Uint8Array) => Promise<Uint8Array>,
    private readonly failed: (message: string) => void,
  ) {
    this.layer = document.createElement('div');
    this.layer.dataset.nelyxV2Semantics = '';
    Object.assign(this.layer.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '1',
      overflow: 'hidden',
    });
    document.body.append(this.layer);
    this.resize = () => this.position();
    window.addEventListener('scroll', this.resize, true);
    window.addEventListener('resize', this.resize);
    this.position();

  }
  private position(): void {
    const r = this.canvas.getBoundingClientRect();
    Object.assign(this.layer.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  }
  private enqueue<T>(work: () => Promise<T>, bytes = 0): Promise<T> {
    if (this.closed || this.queued >= 32 || this.queuedBytes + bytes > p.limits.packetBytes * 4)
      return Promise.reject(new Error('Browser interaction mailbox full/closed'));
    ++this.queued;
    this.queuedBytes += bytes;
    const result = this.tail.then(work);
    this.tail = result
      .catch(() => {})
      .finally(() => {
        --this.queued;
        this.queuedBytes -= bytes;
      });
    return result;
  }
  private async call(op: number, data?: Uint8Array): Promise<EngineResponse> {
    const result = response(await this.exchange(packet(op, owner, data)));
    if (result.status !== p.statuses.ok)
      throw new Error(`Browser interaction rejected (${result.status})`);
    return result;
  }
  private async dispatch(peer: Peer, action: 'focus' | 'activate'): Promise<EngineResponse | null> {
    for (let attempt = 0; attempt < 3; ++attempt) {
      const scene = response(await this.exchange(packet(p.opcodes.semanticsSnapshot, owner)));
      if (scene.status !== p.statuses.ok) return null;
      const current = scene.nodes.find((n) => key(n.node) === key(peer.node.node));
      if (!current) return null;
      if (
        action === 'activate' &&
        ['x', 'y', 'width', 'height'].some((k) => current[k as 'x'] !== peer.node[k as 'x'])
      )
        return null;
      const op = action === 'focus' ? p.opcodes.focus : p.opcodes.semanticsAction;
      const data =
        action === 'focus'
          ? focusBody(current.node, scene.publication)
          : semanticActionBody(current.node, scene.publication, 'activate', peer.session);
      const result = response(await this.exchange(packet(op, owner, data)));
      if (result.status === p.statuses.ok) {
        peer.publication = scene.publication;
        peer.node = current;
        return result;
      }
      if (result.status !== p.statuses.stale && result.status !== p.statuses.capabilityMissing)
        throw new Error(`Browser interaction rejected (${result.status})`);
      if (result.status === p.statuses.capabilityMissing) return null;
    }
    return null;
  }
  /** App edit/focus commands enter the same UI queue as trusted DOM events. */
  gateway(bytes: Uint8Array): Promise<Uint8Array> {
    const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      b = p.headerBytes;
    if (
      header.getUint16(p.headerFields.opcode, true) === p.opcodes.edit &&
      bytes.length >= b + 64 &&
      header.getUint32(b + 24, true) === p.editKinds.replace &&
      header.getUint32(b + 28, true) !== p.compositionPolicies.preserve
    ) {
      const id = header.getBigUint64(p.headerFields.id, true),
        prior = this.forced.get(id);
      if (!id) return this.reply(bytes, p.statuses.invalidValue);
      if (prior) {
        if (prior.bytes.length !== bytes.length || prior.bytes.some((v, i) => v !== bytes[i]))
          return this.reply(bytes, p.statuses.idReused);
        return prior.result.then((result) => result.slice());
      }
      let held = [...this.forced.values()].reduce((sum, value) => sum + value.bytes.length, 0);
      for (const [key, value] of this.forced)
        if (
          (this.forced.size >= 32 || held + bytes.length > p.limits.packetBytes) &&
          value.settled
        ) {
          this.forced.delete(key);
          held -= value.bytes.length;
        }
      if (this.forced.size >= 32 || held + bytes.length > p.limits.packetBytes)
        return this.reply(bytes, p.statuses.budgetExceeded);
      const owned = bytes.slice();
      const entry: { bytes: Uint8Array; result: Promise<Uint8Array>; settled: boolean } = {
        bytes: owned,
        result: Promise.resolve(new Uint8Array()),
        settled: false,
      };
      this.forced.set(id, entry);
      entry.result = this.finishComposition(owned.slice())
        .then((result) => {
          if (response(result).status === p.statuses.busy) this.forced.delete(id);
          return result;
        })
        .finally(() => {
          entry.settled = true;
        });
      return entry.result.then((result) => result.slice());
    }
    return this.enqueue(async () => {
      const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        op = v.getUint16(p.headerFields.opcode, true),
        b = p.headerBytes;
      if (op === p.opcodes.edit && bytes.length >= b + 64) {
        const peer = this.peers.get(`${v.getUint32(b, true)}:${v.getUint32(b + 4, true)}`);
        if (peer?.ending) return this.reply(bytes, p.statuses.busy);
      }
      if (
        op === p.opcodes.edit &&
        bytes.length >= b + 64 &&
        v.getUint32(b + 24, true) === p.editKinds.update
      )
        throw new Error('Platform input owns editing update commands');
      if (
        op === p.opcodes.edit &&
        bytes.length >= b + 64 &&
        this.active?.composing &&
        v.getUint32(b + 24, true) !== p.editKinds.selection
      ) {
        // Never replace a live browser composition before its compositionend acknowledgement.
        ++this.counters.rejected;
        throw new Error('Programmatic edit awaits browser compositionend');
      }
      const result = await this.exchange(bytes),
        state = response(result);
      if (state.status === p.statuses.ok) {
        if (op === p.opcodes.edit) {
          const node = state.nodes[0],
            peer = node && this.peers.get(key(node.node));
          if (peer && node.editing) this.installValue(peer, node.editing);
        }
        if (op === p.opcodes.focus || op === p.opcodes.semanticsAction) this.installFocus(state);
      }
      return result;
    }, bytes.length);
  }
  private async reply(bytes: Uint8Array, status: number): Promise<Uint8Array> {
    const result = await this.exchange(packet(p.opcodes.inspect, owner)),
      h = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      r = new DataView(result.buffer, result.byteOffset, result.byteLength);
    r.setUint16(p.headerFields.opcode, h.getUint16(p.headerFields.opcode, true) | 0x8000, true);
    r.setUint16(p.headerFields.status, status, true);
    r.setBigUint64(p.headerFields.id, h.getBigUint64(p.headerFields.id, true), true);
    return result;
  }
  private async finishComposition(bytes: Uint8Array): Promise<Uint8Array> {
    await this.tail;
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      b = p.headerBytes,
      peer = this.peers.get(`${v.getUint32(b, true)}:${v.getUint32(b + 4, true)}`);
    if (peer?.ending) return this.reply(bytes, p.statuses.busy);
    if (!peer?.composing) return this.enqueue(() => this.exchange(bytes), bytes.length);
    if (
      !isInput(peer.element) ||
      !peer.value ||
      peer.value.revision !== v.getBigUint64(b + 16, true) ||
      peer.session !== v.getBigUint64(b + 8, true)
    )
      return this.reply(bytes, p.statuses.baseConflict);
    peer.ending = true;
    let timer: ReturnType<typeof setTimeout> | undefined, end: (() => void) | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        end = () => resolve();
        peer.element.addEventListener('compositionend', end, { once: true });
        timer = setTimeout(() => reject(new Error('Browser composition end timed out')), 1000);
        peer.element.blur();
      });
      await this.tail;
      if (
        this.closed ||
        !peer.session ||
        peer.session !== v.getBigUint64(b + 8, true) ||
        peer.composing
      )
        return this.reply(bytes, p.statuses.canceled);
      const result = await this.enqueue(async () => {
          if (
            this.closed ||
            !peer.session ||
            peer.session !== v.getBigUint64(b + 8, true) ||
            peer.composing
          )
            return this.reply(bytes, p.statuses.canceled);
          v.setBigUint64(b + 16, peer.value!.revision, true);
          return this.exchange(bytes);
        }, bytes.length),
        state = response(result);
      if (state.status === p.statuses.ok && state.nodes[0]?.editing)
        this.installValue(peer, state.nodes[0].editing);
      return result;
    } catch {
      ++this.counters.rejected;
      return this.reply(bytes, p.statuses.timedOut);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (end) peer.element.removeEventListener('compositionend', end);
      peer.ending = false;
      if (!this.closed && this.active === peer) {
        this.applying = true;
        try {
          peer.element.focus({ preventScroll: true });
        } finally {
          this.applying = false;
        }
      }
    }
  }
  update(): void {
    if (this.closed) return;
    this.wanted = true;
    if (this.syncing) return;
    this.syncing = true;
    void this.enqueue(async () => {
      this.wanted = false;
      const state = response(await this.exchange(packet(p.opcodes.semanticsSnapshot, owner)));
      if (state.status === p.statuses.notFound || state.closed) return;
      if (state.status !== p.statuses.ok)
        throw new Error(`Semantics snapshot rejected (${state.status})`);
      ++this.counters.snapshots;
      this.install(state);
    })
      .catch((e) => {
        if (!this.closed) this.failed(String(e));
      })
      .finally(() => {
        this.syncing = false;
        if (this.wanted && !this.closed) this.update();
      });
  }
  private installValue(peer: Peer, value: EditingSnapshot): void {
    if (peer.value && value.revision < peer.value.revision) return;
    peer.value = value;
    const input = peer.element;
    if (!isInput(input) || peer.composing) return;
    this.applying = true;
    try {
      if (input.value !== value.text) input.value = value.text;
      const start = Math.min(value.base, value.extent),
        end = Math.max(value.base, value.extent),
        direction = value.base > value.extent ? 'backward' : 'forward';
      if (
        input.selectionStart !== start ||
        input.selectionEnd !== end ||
        input.selectionDirection !== direction
      )
        input.setSelectionRange(start, end, direction);
    } finally {
      this.applying = false;
    }
  }
  private installFocus(state: EngineResponse): void {
    const focus = state.focus;
    for (const peer of this.peers.values())
      peer.session = focus && key(focus.node) === key(peer.node.node) ? focus.session : 0n;
    if (focus) {
      const peer = this.peers.get(key(focus.node));
      if (peer && !peer.ending && document.activeElement !== peer.element) {
        this.applying = true;
        try {
          peer.element.focus({ preventScroll: true });
          this.active = peer;
        } finally {
          this.applying = false;
        }
      }
    } else if (this.active) {
      this.applying = true;
      try {
        this.active.element.blur();
        this.active = undefined;
      } finally {
        this.applying = false;
      }
    }
  }
  private install(state: EngineResponse): void {
    if (state.publication < this.publication) return;
    this.publication = state.publication;
    this.position();
    const byNode=new Map(state.nodes.map(n=>[key(n.node),n]));
    const geometryWanted=new Set<string>();
    for(const node of state.nodes){
      const id=key(node.node);geometryWanted.add(id);
      let wrapper=this.geometry.get(id);if(!wrapper){wrapper=document.createElement('div');this.geometry.set(id,wrapper);}
      const parent=byNode.get(key(node.parent)),parentElement=parent?this.geometry.get(key(parent.node))!:this.layer;
      if(wrapper.parentElement!==parentElement)parentElement.append(wrapper);
      const a=parent?.matrix??[1,0,0,1,0,0],b=node.matrix,det=a[0]!*a[3]!-a[1]!*a[2]!;
      const m=Math.abs(det)<1e-12?[0,0,0,0,0,0]:[
        (a[3]!*b[0]-a[2]!*b[1])/det,(-a[1]!*b[0]+a[0]!*b[1])/det,
        (a[3]!*b[2]-a[2]!*b[3])/det,(-a[1]!*b[2]+a[0]!*b[3])/det,
        (a[3]!*(b[4]-a[4]!)-a[2]!*(b[5]-a[5]!))/det,
        (-a[1]!*(b[4]-a[4]!)+a[0]!*(b[5]-a[5]!))/det];
      const path=node.graphics?.hasPath?node.graphics.path:undefined;
      const commands=path?.map(segment=>({move:'M',line:'L',quad:'Q',cubic:'C',close:'Z'})[segment[0]]+' '+segment.slice(1).join(' ')).join(' ');
      Object.assign(wrapper.style,{position:'absolute',left:'0',top:'0',width:`${node.width}px`,height:`${node.height}px`,
        transformOrigin:'0 0',transform:`matrix(${m.join(',')})`,pointerEvents:'none',
        visibility:node.flags&16?'visible':'hidden',
        clipPath:node.kind===p.kinds.clip||node.kind===p.kinds.scrollViewport
          ?path?`path(${node.graphics?.fillRule==='evenOdd'?'evenodd':'nonzero'}, "${commands??''}")`:`inset(0 round ${node.radius}px)`:'none'});
    }
    const wanted = new Set<string>();
    const roles = ['none', 'group', 'button', 'text', 'textbox', 'checkbox', 'slider', 'link'];
    for (const node of state.nodes) {
      const s = node.semantics;
      if (!s || s.flags & p.semanticsFlags.hidden) continue;
      const id = key(node.node);
      wanted.add(id);
      let peer = this.peers.get(id);
      const password = !!(node.editing?.flags && node.editing.flags & p.editFlags.password);
      if (peer && node.editing && password !== peer.element instanceof HTMLInputElement) {
        peer.session = 0n;
        if (this.active === peer) this.active = undefined;
        peer.element.remove();
        this.peers.delete(id);
        peer = undefined;
      }
      if (!peer) {
        const password = !!(node.editing?.flags && node.editing.flags & p.editFlags.password),
          element = node.editing
            ? document.createElement(password ? 'input' : 'textarea')
            : document.createElement('div');
        if (element instanceof HTMLInputElement) element.type = 'password';
        peer = {
          element,
          node,
          publication: state.publication,
          value: null,
          composing: false,
          ending: false,
          compositionStart: -1,
          session: 0n,
          pending: 0,
        };
        this.peers.set(id, peer);
        this.geometry.get(id)!.append(element);
        this.listen(peer);
      }
      peer.node = node;
      peer.publication = state.publication;
      const element = peer.element;
      element.dataset.nelyxNode = id;
      element.setAttribute('role', roles[s.role] ?? 'group');
      element.setAttribute('aria-label', s.label);
      element.setAttribute('aria-description', s.hint);
      const disabled =
        !!(s.flags & p.semanticsFlags.disabled) ||
        !!(node.editing?.flags && node.editing.flags & p.editFlags.disabled);
      element.setAttribute('aria-disabled', String(disabled));
      element.tabIndex =
        !disabled &&
        (node.editing ||
          s.flags & p.semanticsFlags.focusable ||
          s.actions & p.semanticsActions.focus)
          ? 0
          : -1;
      if (s.role === p.semanticsRoles.checkbox)
        element.setAttribute('aria-checked', String(!!(s.flags & p.semanticsFlags.checked)));
      if (
        node.control &&
        (node.control.kind === p.controlKinds.slider ||
          node.control.kind === p.controlKinds.rangeSlider)
      ) {
        element.setAttribute('aria-valuemin', String(node.control.minimum));
        element.setAttribute('aria-valuemax', String(node.control.maximum));
        element.setAttribute('aria-valuenow', String(node.control.value));
      }
      const left = Math.max(node.bounds.x, node.clip.x),
        top = Math.max(node.bounds.y, node.clip.y),
        right = Math.min(node.bounds.x + node.bounds.width, node.clip.x + node.clip.width),
        bottom = Math.min(node.bounds.y + node.bounds.height, node.clip.y + node.clip.height);
      Object.assign(element.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: `${Math.max(0, node.width)}px`,
        height: `${Math.max(0, node.height)}px`,
        clipPath: node.kind===p.kinds.path&&node.graphics?.path?`path(${node.graphics.fillRule==='evenOdd'?'evenodd':'nonzero'}, "${node.graphics.path.map(segment=>({move:'M',line:'L',quad:'Q',cubic:'C',close:'Z'})[segment[0]]+' '+segment.slice(1).join(' ')).join(' ')}")`:'none',
        pointerEvents: s.actions && !disabled && right > left && bottom > top ? 'auto' : 'none',
        opacity: '0',
        margin: '0',
        padding: isInput(element)
          ? `${node.content.y}px ${Math.max(0, node.width - node.content.x - node.content.width)}px ${Math.max(0, node.height - node.content.y - node.content.height)}px ${node.content.x}px`
          : '0',
        border: '0',
        resize: 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontSize: `${node.fontSize}px`,
        lineHeight: 'normal',
        fontFamily: 'sans-serif',
        whiteSpace:
          node.editing?.flags && node.editing.flags & p.editFlags.multiline ? 'pre-wrap' : 'pre',
        direction: node.textDirection ? 'rtl' : 'ltr',
      });
      if (isInput(element) && node.editing) {
        element.disabled = disabled;
        element.readOnly = !!(node.editing.flags & p.editFlags.readOnly);
        element.maxLength = node.editing.maximumLength;
        element.setAttribute(
          'aria-multiline',
          String(!!(node.editing.flags & p.editFlags.multiline)),
        );
        element.setAttribute('aria-readonly', String(element.readOnly));
        element.autocomplete = 'off';
        element.spellcheck = false;
        if (!peer.pending) this.installValue(peer, node.editing);
      }
    }
    for (const [id, peer] of this.peers)
      if (!wanted.has(id)) {
        if (this.active === peer) this.active = undefined;
        peer.element.remove();
        this.peers.delete(id);
      }
    for(const [id,wrapper] of this.geometry)if(!geometryWanted.has(id)){wrapper.remove();this.geometry.delete(id);}
    this.counters.peers = this.peers.size;
    this.installFocus(state);
  }
  private listen(peer: Peer): void {
    const element = peer.element;
    const report = (promise: Promise<unknown>) => {
      void promise.catch((error) => {
        ++this.counters.rejected;
        if (!this.closed) this.failed(String(error));
        this.update();
      });
    };
    element.addEventListener('focus', () => {
      if (this.applying) return;
      report(
        this.enqueue(async () => {
          const state = await this.dispatch(peer, 'focus');
          if (!state) {
            this.update();
            return;
          }
          this.active = peer;
          this.installFocus(state);
        }),
      );
    });
    element.addEventListener('blur', () => {
      if (this.applying || peer.ending) return;
      report(
        this.enqueue(async () => {
          if (peer.session) {
            await this.call(p.opcodes.focus, focusBody(null, 0n, peer.session));
            peer.session = 0n;
          }
          if (this.active === peer) this.active = undefined;
        }),
      );
    });
    if (!isInput(element)) {
      const activate = () =>
        report(
          this.enqueue(async () => {
            if (await this.dispatch(peer, 'activate')) ++this.counters.actions;
            else this.update();
          }),
        );
      element.addEventListener('click', (event) => {
        if (!event.detail) activate();
      });
      element.addEventListener('keydown', (e) => {
        const code = (
          {
            Enter: 13,
            ' ': 32,
            ArrowLeft: 37,
            ArrowRight: 39,
            ArrowUp: 38,
            ArrowDown: 40,
            Home: 36,
            End: 35,
          } as Record<string, number>
        )[e.key];
        if (code) {
          e.preventDefault();
          report(
            this.enqueue(async () => {
              for (let i = 0; i < 3; ++i) {
                const state = await this.call(p.opcodes.semanticsSnapshot);
                const result = response(
                  await this.exchange(
                    packet(p.opcodes.key, owner, keyBody(state.publication, code)),
                  ),
                );
                if (result.status === p.statuses.ok) return;
                if (result.status !== p.statuses.stale)
                  throw new Error('Native key rejected: ' + result.status);
              }
              throw new Error('Native key publication changed repeatedly');
            }),
          );
        }
      });
      return;
    }
    const send = (kind: EditingUpdate['kind'] = 'update') => {
      if (this.applying || this.closed) return;
      const text = element.value,
        base =
          (element.selectionDirection === 'backward'
            ? element.selectionEnd
            : element.selectionStart) ?? 0,
        extent =
          (element.selectionDirection === 'backward'
            ? element.selectionStart
            : element.selectionEnd) ?? 0;
      const start = peer.composing ? peer.compositionStart : -1,
        end = peer.composing ? Math.max(peer.compositionStart, Math.max(base, extent)) : -1;
      ++peer.pending;
      report(
        this.enqueue(async () => {
          if (!peer.value)
            peer.value = (
              await this.call(
                p.opcodes.editSnapshot,
                body(8, (v) => writeHandle(v, 0, peer.node.node)),
              )
            ).nodes[0]!.editing;
          if (!peer.value || !peer.session) throw new Error('Editor lost focus before input');
          const result = await this.call(
            p.opcodes.edit,
            editBody(peer.node.node, {
              kind,
              revision: peer.value.revision,
              session: peer.session,
              publication: peer.publication,
              text,
              base,
              extent,
              composingStart: start,
              composingEnd: end,
            }),
          );
          peer.value = result.nodes[0]!.editing;
          ++this.counters.edits;
        }, text.length * 2).finally(() => {
          --peer.pending;
          this.update();
        }),
      );
    };
    element.addEventListener('compositionstart', () => {
      peer.composing = true;
      peer.compositionStart = element.selectionStart ?? 0;
      send();
    });
    element.addEventListener('compositionend', () => {
      peer.composing = false;
      peer.compositionStart = -1;
      send();
    });
    element.addEventListener('input', () => send());
    element.addEventListener('select', () => {
      if (!peer.composing && document.activeElement === element && peer.session) send('selection');
    });
    element.addEventListener('beforeinput', (raw) => {
      const event = raw as InputEvent;
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        event.preventDefault();
        send(event.inputType === 'historyUndo' ? 'undo' : 'redo');
      } else if (
        !(peer.value?.flags && peer.value.flags & p.editFlags.multiline) &&
        (event.inputType === 'insertLineBreak' || event.inputType === 'insertParagraph')
      )
        event.preventDefault();
    });
    element.addEventListener('copy', (event) => {
      if (peer.value?.flags && peer.value.flags & p.editFlags.password) event.preventDefault();
    });
    element.addEventListener('cut', (event) => {
      if (peer.value?.flags && peer.value.flags & p.editFlags.password) event.preventDefault();
    });
  }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    window.removeEventListener('scroll', this.resize, true);
    window.removeEventListener('resize', this.resize);
    this.layer.remove();
    await this.tail;
    await Promise.allSettled([...this.forced.values()].map((value) => value.result));
    this.forced.clear();
    this.peers.clear();
    this.geometry.clear();
    this.active = undefined;
    this.counters.peers = 0;
  }
}
