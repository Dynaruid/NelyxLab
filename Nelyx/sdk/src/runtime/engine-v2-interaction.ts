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
  stateInspectionBody,
  browserObservationBody,
  keyBody,
} from '@nelyx/core/engine';
import type {
  EngineResponse,
  EngineNodeSnapshot,
  EditingSnapshot,
  NodeHandle,
  EditingUpdate,
  SemanticCustomAction,
} from '@nelyx/core/engine';
import { EngineV2BrowserSemantics } from './engine-v2-semantics.js';
import { setManagedStyles, setManagedAttribute, setManagedText } from './engine-v2-dom.js';
import { CheckedState, Tristate, readSemanticsFlagWord } from '@nelyx/core/ui/semantics';
import type { SemanticsFlagWord } from '@nelyx/core/ui/semantics';

const owner = { session: 1, app: 1, view: 1, generation: 1 };
const key = (n: NodeHandle) => `${n.slot}:${n.generation}`;
type Peer = {
  element: HTMLElement;
  node: EngineNodeSnapshot;
  publication: bigint;
  value: EditingSnapshot | null;
  installedValue?: EditingSnapshot;
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
  readonly counters = {
    edits: 0,
    actions: 0,
    snapshots: 0,
    skippedProjections: 0,
    domStyleWrites: 0,
    peers: 0,
    rejected: 0,
    routeAnnouncements: 0,
  };
  private layer: HTMLDivElement;
  private semantics: EngineV2BrowserSemantics;
  private routeAnnouncement: HTMLDivElement;
  private routeSequence = 0n;
  private peers = new Map<string, Peer>();
  private geometry = new Map<string, HTMLDivElement>();
  private closed = false;
  private syncing = false;
  private wanted = false;
  private tail: Promise<unknown> = Promise.resolve();
  private queued = 0;
  private queuedBytes = 0;
  private publication = 0n;
  private installedProjection: string | undefined;
  private active: Peer | undefined;
  private applying = false;
  private canonicalKeyboard = false;
  private readonly editorKeys = new Set<string>();
  private focusWork = 0n;
  private readonly keyboard = (event: KeyboardEvent): void => {
    const editorRelease = event.type === 'keyup' && this.editorKeys.delete(event.code);
    if (
      !this.canonicalKeyboard ||
      this.closed ||
      this.semantics.ownsAction(event.target) ||
      !(event.target === this.canvas || this.ownsTarget(event.target))
    )
      return;
    if (event.target instanceof HTMLElement && isInput(event.target) && !editorRelease) {
      // Keep IME/text ingress on its DOM carrier. Deletion and Enter use Source
      // editing policy after the selection updates already queued on this owner.
      if (
        event.type !== 'keydown' ||
        event.isComposing ||
        this.active?.composing ||
        event.altKey ||
        (event.key !== 'Enter' &&
          (event.ctrlKey || event.metaKey || (event.key !== 'Backspace' && event.key !== 'Delete')))
      )
        return;
      this.editorKeys.add(event.code);
    }
    const special: Record<string, number> = {
      Backspace: 8,
      Tab: 9,
      Enter: 13,
      Shift: 16,
      Control: 17,
      Alt: 18,
      Escape: 27,
      Space: 32,
      PageUp: 33,
      PageDown: 34,
      End: 35,
      Home: 36,
      ArrowLeft: 37,
      ArrowUp: 38,
      ArrowRight: 39,
      ArrowDown: 40,
      Insert: 45,
      Delete: 46,
      MetaLeft: 91,
      MetaRight: 92,
      ShiftLeft: 16,
      ShiftRight: 16,
      ControlLeft: 17,
      ControlRight: 17,
      AltLeft: 18,
      AltRight: 18,
      Pause: 19,
      CapsLock: 20,
      PrintScreen: 44,
      ContextMenu: 93,
      NumpadMultiply: 106,
      NumpadAdd: 107,
      NumpadSubtract: 109,
      NumpadDecimal: 110,
      NumpadDivide: 111,
      NumLock: 144,
      ScrollLock: 145,
      Semicolon: 186,
      Equal: 187,
      Comma: 188,
      Minus: 189,
      Period: 190,
      Slash: 191,
      Backquote: 192,
      BracketLeft: 219,
      Backslash: 220,
      BracketRight: 221,
      Quote: 222,
    };
    const code =
      special[event.code] ??
      special[event.key] ??
      (/^Key[A-Z]$/.test(event.code)
        ? event.code.charCodeAt(3)
        : /^Digit[0-9]$/.test(event.code)
          ? event.code.charCodeAt(5)
          : /^Numpad[0-9]$/.test(event.code)
            ? 96 + Number(event.code.slice(6))
            : /^F(?:[1-9]|1\d|2[0-4])$/.test(event.code)
              ? 111 + Number(event.code.slice(1))
              : 0);
    if (!event.key || !event.code) return;
    event.preventDefault();
    event.stopPropagation();
    const down = event.type === 'keydown',
      modifiers =
        Number(event.shiftKey) |
        (Number(event.ctrlKey) << 1) |
        (Number(event.altKey) << 2) |
        (Number(event.metaKey) << 3),
      repeat = event.repeat,
      identity = { key: event.key, code: event.code, location: event.location };
    void this.enqueue(async () => {
      let observed: EngineResponse | undefined;
      for (let attempt = 0; attempt < 3; ++attempt) {
        const state = await this.call(p.opcodes.semanticsSnapshot);
        if (
          !state.visible ||
          !state.focused ||
          !state.canonicalKeyboard ||
          state.publishedMetrics !== state.metrics ||
          state.publishedDevice !== state.device ||
          (observed &&
            (state.document !== observed.document ||
              state.metrics !== observed.metrics ||
              state.device !== observed.device ||
              state.focus?.session !== observed.focus?.session))
        ) {
          ++this.counters.rejected;
          return;
        }
        observed ??= state;
        const result = response(
          await this.exchange(
            packet(
              p.opcodes.key,
              owner,
              keyBody(state.publication, code, down, modifiers, repeat, 0n, identity),
            ),
          ),
        );
        if (result.status === p.statuses.ok) return;
        if (result.status !== p.statuses.stale)
          throw Error('Native canonical key rejected: ' + result.status);
      }
      // Resize/publication churn is a refused observation, not an App failure.
      ++this.counters.rejected;
    }).catch((error) => this.failed(String(error)));
  };
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
    this.counters.domStyleWrites += setManagedStyles(this.layer, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '1',
      overflow: 'hidden',
    });
    document.body.append(this.layer);
    this.semantics = new EngineV2BrowserSemantics(this.layer, (node, action) => {
      void this.enqueue(() => this.customAction(node, action)).catch((error) => {
        ++this.counters.rejected;
        if (!this.closed) this.failed(String(error));
      });
    });
    this.routeAnnouncement = document.createElement('div');
    this.routeAnnouncement.dataset.nelyxRouteAnnouncement = '';
    this.routeAnnouncement.setAttribute('role', 'status');
    this.routeAnnouncement.setAttribute('aria-live', 'polite');
    this.routeAnnouncement.setAttribute('aria-atomic', 'true');
    Object.assign(this.routeAnnouncement.style, {
      position: 'fixed',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clipPath: 'inset(50%)',
      whiteSpace: 'pre',
      pointerEvents: 'none',
    });
    document.body.append(this.routeAnnouncement);
    this.resize = () => this.position();
    window.addEventListener('scroll', this.resize, true);
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keyboard, true);
    window.addEventListener('keyup', this.keyboard, true);
    this.position();
  }
  private position(): void {
    const r = this.canvas.getBoundingClientRect();
    this.counters.domStyleWrites += setManagedStyles(this.layer, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
  }
  /** The canvas and its published DOM peers share one platform input surface. */
  ownsTarget(target: EventTarget | null): boolean {
    return !this.closed && target instanceof Node && this.layer.contains(target);
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
    if (op === p.opcodes.semanticsSnapshot && data === undefined) data = browserObservationBody();
    const result = response(await this.exchange(packet(op, owner, data)));
    if (result.status !== p.statuses.ok)
      throw new Error(`Browser interaction rejected (${result.status})`);
    return result;
  }
  private async dispatch(peer: Peer, action: 'focus' | 'activate'): Promise<EngineResponse | null> {
    for (let attempt = 0; attempt < 3; ++attempt) {
      const scene = response(
        await this.exchange(packet(p.opcodes.semanticsSnapshot, owner, browserObservationBody())),
      );
      if (scene.status !== p.statuses.ok) return null;
      const current = scene.nodes.find((n) => key(n.node) === key(peer.node.node));
      if (!current) return null;
      // This is a semantic/keyboard activation, identified by node generation.
      // A scroll or reflow does not change that target. Core still checks its
      // current route, enabled state and action source. Canvas pointer ingress
      // separately retains its collected coordinates/publication geometry.
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
  private async customAction(
    before: EngineNodeSnapshot,
    action: SemanticCustomAction,
  ): Promise<void> {
    const source = (node: EngineNodeSnapshot) =>
      node.semanticTraversal?.customSources.find((entry) => entry.id === action.id)?.source;
    const origin = source(before);
    if (!origin) return;
    for (let attempt = 0; attempt < 3; ++attempt) {
      const state = await this.call(p.opcodes.semanticsSnapshot),
        current = state.nodes.find((node) => key(node.node) === key(before.node)),
        next = current?.semantics?.customActions?.find((value) => value.id === action.id),
        nextOrigin = current && source(current);
      if (
        !current ||
        !next?.invokable ||
        !nextOrigin ||
        key(origin) !== key(nextOrigin) ||
        next.label !== action.label ||
        (next.hint ?? '') !== (action.hint ?? '') ||
        (next.overrideAction ?? 0) !== (action.overrideAction ?? 0) ||
        !(current.semantics!.actions & p.semanticsActions.custom) ||
        current.semantics!.flags & (p.semanticsFlags.hidden | p.semanticsFlags.disabled) ||
        current.matrix.some((value, index) => value !== before.matrix[index]) ||
        current.width !== before.width ||
        current.height !== before.height ||
        ['x', 'y', 'width', 'height'].some(
          (field) => current.clip[field as 'x'] !== before.clip[field as 'x'],
        )
      )
        return;
      const result = response(
        await this.exchange(
          packet(
            p.opcodes.semanticsAction,
            owner,
            semanticActionBody(current.node, state.publication, 'custom', 0n, action.id),
          ),
        ),
      );
      if (result.status === p.statuses.ok) {
        ++this.counters.actions;
        this.update();
        return;
      }
      if (result.status !== p.statuses.stale && result.status !== p.statuses.capabilityMissing)
        throw Error('Browser custom semantics action rejected: ' + result.status);
      if (result.status === p.statuses.capabilityMissing) return;
    }
  }
  /** App commands and pointer packets retain DOM focus/key collection order. */
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
      const entry: {
        bytes: Uint8Array;
        result: Promise<Uint8Array>;
        settled: boolean;
      } = {
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
    const result = await this.exchange(packet(p.opcodes.inspect, owner, stateInspectionBody())),
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
      // Content/builder/ACK notifications often leave the published geometry
      // unchanged. Inspect the small state first; live editing/focus/control
      // and metric/device changes still invalidate the projection.
      const current = await this.call(p.opcodes.inspect, stateInspectionBody());
      if (current.closed || this.closed) return;
      if (this.projectionKey(current) === this.installedProjection) {
        ++this.counters.skippedProjections;
        this.position();
        this.installFocus(current);
        return;
      }
      const state = response(
        await this.exchange(packet(p.opcodes.semanticsSnapshot, owner, browserObservationBody())),
      );
      if (state.status === p.statuses.notFound || state.closed) return;
      if (state.status !== p.statuses.ok)
        throw new Error(`Semantics snapshot rejected (${state.status})`);
      ++this.counters.snapshots;
      this.install(state);
      this.installedProjection = this.projectionKey(state);
    })
      .catch((e) => {
        if (!this.closed) this.failed(String(e));
      })
      .finally(() => {
        this.syncing = false;
        if (this.wanted && !this.closed) this.update();
      });
  }
  private projectionKey(state: EngineResponse): string {
    return [
      state.publication,
      state.property,
      state.metrics,
      state.device,
      state.fontRevision,
      state.editingWork,
      state.focusWork,
      state.controlWork,
      state.canonicalKeyboard,
      state.visible,
      state.focused,
    ].join('/');
  }
  private installValue(peer: Peer, value: EditingSnapshot): void {
    if (peer.value && value.revision < peer.value.revision) return;
    peer.value = value;
    const input = peer.element;
    if (!isInput(input) || peer.composing || peer.pending) return;
    // A repeated Core snapshot must not collapse a browser selection whose
    // asynchronous select event has not reached the input mailbox yet.
    const installed = peer.installedValue;
    if (
      installed?.revision === value.revision &&
      installed.base === value.base &&
      installed.extent === value.extent &&
      installed.text === value.text &&
      input.value === value.text
    )
      return;
    peer.installedValue = value;
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
    if (state.focusWork < this.focusWork) return;
    const changed = state.focusWork > this.focusWork;
    this.focusWork = state.focusWork;
    const focus = state.focus;
    const focusedPeer = focus?.peer ? this.peers.get(key(focus.peer)) : undefined;
    for (const peer of this.peers.values())
      peer.session = focus && peer === focusedPeer ? focus.session : 0n;
    // A virtual action uses the browser's accessible keyboard focus. Preserve
    // it across identical Core focus snapshots; a new Source focus still wins.
    if (!changed && this.semantics.ownsAction(document.activeElement)) return;
    if (focus) {
      const peer = focusedPeer;
      if (
        peer &&
        !peer.ending &&
        document.activeElement !== peer.element &&
        !this.semantics.ownsAction(document.activeElement, peer.node.node)
      ) {
        this.applying = true;
        try {
          peer.element.focus({ preventScroll: true });
          this.active = peer;
        } finally {
          this.applying = false;
        }
      } else if (!peer && this.canonicalKeyboard) {
        this.applying = true;
        try {
          this.canvas.focus({ preventScroll: true });
          this.active = undefined;
        } finally {
          this.applying = false;
        }
      }
    } else if (this.active) {
      this.applying = true;
      try {
        this.active.element.blur();
        this.active = undefined;
        if (this.canonicalKeyboard) this.canvas.focus({ preventScroll: true });
      } finally {
        this.applying = false;
      }
    }
  }
  private install(state: EngineResponse): void {
    if (this.closed || state.publication < this.publication) return;
    this.publication = state.publication;
    this.canonicalKeyboard = state.canonicalKeyboard;
    if (this.canonicalKeyboard && this.canvas.tabIndex !== 0) this.canvas.tabIndex = 0;
    this.position();
    const byNode = new Map(state.nodes.map((n) => [key(n.node), n]));
    const geometryWanted = new Set<string>();
    for (const node of state.nodes) {
      const id = key(node.node);
      geometryWanted.add(id);
      let wrapper = this.geometry.get(id);
      if (!wrapper) {
        wrapper = document.createElement('div');
        this.geometry.set(id, wrapper);
      }
      const parent = byNode.get(key(node.parent)),
        parentElement = parent ? this.geometry.get(key(parent.node))! : this.layer;
      if (wrapper.parentElement !== parentElement) parentElement.append(wrapper);
      const a = parent?.matrix ?? [1, 0, 0, 1, 0, 0],
        b = node.matrix,
        det = a[0]! * a[3]! - a[1]! * a[2]!;
      const m =
        Math.abs(det) < 1e-12
          ? [0, 0, 0, 0, 0, 0]
          : [
              (a[3]! * b[0] - a[2]! * b[1]) / det,
              (-a[1]! * b[0] + a[0]! * b[1]) / det,
              (a[3]! * b[2] - a[2]! * b[3]) / det,
              (-a[1]! * b[2] + a[0]! * b[3]) / det,
              (a[3]! * (b[4] - a[4]!) - a[2]! * (b[5] - a[5]!)) / det,
              (-a[1]! * (b[4] - a[4]!) + a[0]! * (b[5] - a[5]!)) / det,
            ];
      const path = node.graphics?.hasPath ? node.graphics.path : undefined;
      const commands = path
        ?.map(
          (segment) =>
            ({ move: 'M', line: 'L', quad: 'Q', cubic: 'C', close: 'Z' })[segment[0]] +
            ' ' +
            segment.slice(1).join(' '),
        )
        .join(' ');
      this.counters.domStyleWrites += setManagedStyles(wrapper, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: `${node.width}px`,
        height: `${node.height}px`,
        transformOrigin: '0 0',
        transform: `matrix(${m.join(',')})`,
        pointerEvents: 'none',
        visibility: node.flags & 16 ? 'visible' : 'hidden',
        overflow:
          node.kind === p.kinds.clip || node.kind === p.kinds.scrollViewport ? 'hidden' : 'visible',
        clipPath:
          node.kind === p.kinds.clip || node.kind === p.kinds.scrollViewport
            ? path
              ? `path(${node.graphics?.fillRule === 'evenOdd' ? 'evenodd' : 'nonzero'}, "${commands ?? ''}")`
              : `inset(0 round ${node.radius}px)`
            : 'none',
      });
    }
    const wanted = new Set<string>();
    const roles = [
      'none',
      'group',
      'button',
      'text',
      'textbox',
      'checkbox',
      'slider',
      'link',
      'radio',
      'radiogroup',
      'switch',
      'progressbar',
      'progressbar',
      'dialog',
    ];
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
        // The peer is the node's own surface. Descendant geometry must remain
        // above it even when this semantic owner is created after its children.
        this.geometry.get(id)!.prepend(element);
        this.listen(peer);
      }
      peer.node = node;
      peer.publication = state.publication;
      const element = peer.element;
      setManagedAttribute(element, 'data-nelyx-node', id);
      setManagedAttribute(element, 'data-nelyx-identifier', s.identifier || null);
      const focusBlocked = !!(s.flags & p.semanticsFlags.blockAccessibilityFocus);
      setManagedAttribute(
        element,
        'role',
        focusBlocked ? 'presentation' : (roles[s.role] ?? 'group'),
      );
      if (
        s.configuration &&
        readSemanticsFlagWord(s.configuration.flags as SemanticsFlagWord, 'isLiveRegion')
      )
        setManagedAttribute(element, 'aria-live', 'polite');
      else setManagedAttribute(element, 'aria-live', null);
      if (focusBlocked) {
        setManagedAttribute(element, 'aria-label', null);
        setManagedText(element, element.hasAttribute('aria-live') ? s.label : '');
      } else {
        if (!isInput(element)) setManagedText(element, '');
        setManagedAttribute(element, 'aria-label', s.label);
      }
      setManagedAttribute(
        element,
        'aria-description',
        [
          s.hint,
          ...(s.customActions ?? [])
            .filter((action) => action.hintOverride)
            .map((action) => action.hint ?? ''),
        ]
          .filter(Boolean)
          .join('\n'),
      );
      if (s.role === p.semanticsRoles.loadingSpinner)
        setManagedAttribute(element, 'aria-busy', 'true');
      else setManagedAttribute(element, 'aria-busy', null);
      const disabled =
        !!(s.flags & p.semanticsFlags.disabled) ||
        !!(node.editing?.flags && node.editing.flags & p.editFlags.disabled);
      setManagedAttribute(element, 'aria-disabled', String(disabled));
      const tabIndex =
        !disabled &&
        !focusBlocked &&
        !(s.flags & p.semanticsFlags.scopesRoute) &&
        (node.editing ||
          s.flags & p.semanticsFlags.focusable ||
          s.actions & p.semanticsActions.focus)
          ? 0
          : -1;
      if (element.tabIndex !== tabIndex) element.tabIndex = tabIndex;
      const sourceFlags = s.configuration?.flags as SemanticsFlagWord | undefined,
        checked =
          sourceFlags === undefined
            ? CheckedState.none
            : readSemanticsFlagWord(sourceFlags, 'isChecked'),
        selected =
          sourceFlags === undefined
            ? Tristate.none
            : readSemanticsFlagWord(sourceFlags, 'isSelected');
      if (selected !== Tristate.none)
        setManagedAttribute(element, 'aria-selected', String(selected === Tristate.isTrue));
      else setManagedAttribute(element, 'aria-selected', null);
      if (
        checked !== CheckedState.none ||
        s.role === p.semanticsRoles.checkbox ||
        s.role === p.semanticsRoles.radio ||
        s.role === p.semanticsRoles.switchControl
      )
        setManagedAttribute(
          element,
          'aria-checked',
          checked === CheckedState.mixed || s.flags & p.semanticsFlags.mixed
            ? 'mixed'
            : String(checked === CheckedState.isTrue || !!(s.flags & p.semanticsFlags.checked)),
        );
      else setManagedAttribute(element, 'aria-checked', null);
      if (s.range) {
        setManagedAttribute(element, 'aria-valuemin', String(s.range.minimum));
        setManagedAttribute(element, 'aria-valuemax', String(s.range.maximum));
        setManagedAttribute(element, 'aria-valuenow', String(s.range.value));
        if (s.role === p.semanticsRoles.progressBar)
          setManagedAttribute(element, 'aria-readonly', null);
        else setManagedAttribute(element, 'aria-readonly', String(!!s.range.readOnly));
      } else if (
        node.control &&
        (node.control.kind === p.controlKinds.slider ||
          node.control.kind === p.controlKinds.rangeSlider)
      ) {
        setManagedAttribute(element, 'aria-valuemin', String(node.control.minimum));
        setManagedAttribute(element, 'aria-valuemax', String(node.control.maximum));
        setManagedAttribute(element, 'aria-valuenow', String(node.control.value));
        setManagedAttribute(element, 'aria-readonly', null);
      } else {
        for (const name of ['aria-valuemin', 'aria-valuemax', 'aria-valuenow'])
          setManagedAttribute(element, name, null);
        if (!isInput(element)) setManagedAttribute(element, 'aria-readonly', null);
      }
      if (s.value !== undefined) setManagedAttribute(element, 'aria-valuetext', s.value);
      else setManagedAttribute(element, 'aria-valuetext', null);
      const geometry = isInput(element) ? null : node.semanticGeometry,
        bounds = geometry?.bounds ?? node.bounds,
        left = Math.max(bounds.x, node.clip.x),
        top = Math.max(bounds.y, node.clip.y),
        right = Math.min(bounds.x + bounds.width, node.clip.x + node.clip.width),
        bottom = Math.min(bounds.y + bounds.height, node.clip.y + node.clip.height);
      this.counters.domStyleWrites += setManagedStyles(element, {
        position: 'absolute',
        left: `${geometry?.x ?? 0}px`,
        top: `${geometry?.y ?? 0}px`,
        width: `${Math.max(0, geometry?.width ?? node.width)}px`,
        height: `${Math.max(0, geometry?.height ?? node.height)}px`,
        clipPath:
          node.kind === p.kinds.path && node.graphics?.path
            ? `path(${node.graphics.fillRule === 'evenOdd' ? 'evenodd' : 'nonzero'}, "${node.graphics.path.map((segment) => ({ move: 'M', line: 'L', quad: 'Q', cubic: 'C', close: 'Z' })[segment[0]] + ' ' + segment.slice(1).join(' ')).join(' ')}")`
            : 'none',
        pointerEvents:
          s.actions & ~p.semanticsActions.custom && !disabled && right > left && bottom > top
            ? 'auto'
            : 'none',
        userSelect: isInput(element) ? 'text' : 'none',
        touchAction: isInput(element) ? 'auto' : 'none',
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
        direction: s.textDirection ?? (node.textDirection ? 'rtl' : 'ltr'),
      });
      if (isInput(element) && node.editing) {
        if (element.disabled !== disabled) element.disabled = disabled;
        const readOnly = !!(node.editing.flags & p.editFlags.readOnly);
        if (element.readOnly !== readOnly) element.readOnly = readOnly;
        if (element.maxLength !== node.editing.maximumLength)
          element.maxLength = node.editing.maximumLength;
        setManagedAttribute(
          element,
          'aria-multiline',
          String(!!(node.editing.flags & p.editFlags.multiline)),
        );
        setManagedAttribute(element, 'aria-readonly', String(element.readOnly));
        if (element.autocomplete !== 'off') element.autocomplete = 'off';
        if (element.spellcheck) element.spellcheck = false;
        if (!peer.pending) this.installValue(peer, node.editing);
      }
    }
    for (const [id, peer] of this.peers)
      if (!wanted.has(id)) {
        // Removing a semantics peer does not revoke Core focus. Offstage can
        // keep a Source focus owner while its accessible peer is absent.
        peer.session = 0n;
        if (this.active === peer) this.active = undefined;
        peer.element.remove();
        this.peers.delete(id);
      }
    for (const [id, wrapper] of this.geometry)
      if (!geometryWanted.has(id)) {
        wrapper.remove();
        this.geometry.delete(id);
      }
    this.counters.peers = this.peers.size;
    this.semantics.update(this.peers);
    this.installFocus(state);
    const route = state.semanticRoute;
    // A resize can temporarily omit the current route publication. Only an
    // explicit empty route clears the last announcement; its sequence may stay
    // unchanged when the same scope is republished with the new metrics.
    if (route && !route.scope) {
      if (this.routeAnnouncement.hasChildNodes()) this.routeAnnouncement.replaceChildren();
    } else if (route && route.sequence > this.routeSequence) {
      this.routeSequence = route.sequence;
      this.routeAnnouncement.replaceChildren(
        ...(route.label ? [document.createTextNode(route.label)] : []),
      );
      if (route.label) ++this.counters.routeAnnouncements;
    }
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
      if (this.applying || (peer.node.semantics?.flags ?? 0) & p.semanticsFlags.scopesRoute) return;
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
          // Source may move focus or retire this peer while a DOM input waits
          // in the mailbox. Never re-focus it or report that cancellation as
          // an application failure (selection events can arrive after blur).
          if (!peer.session || this.peers.get(key(peer.node.node)) !== peer) {
            ++this.counters.rejected;
            return;
          }
          if (!peer.value)
            peer.value = (
              await this.call(
                p.opcodes.editSnapshot,
                body(8, (v) => writeHandle(v, 0, peer.node.node)),
              )
            ).nodes[0]!.editing;
          if (!peer.value) throw new Error('Editor snapshot has no editing value');
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
    this.editorKeys.clear();
    this.semantics.close();
    window.removeEventListener('scroll', this.resize, true);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyboard, true);
    window.removeEventListener('keyup', this.keyboard, true);
    this.layer.remove();
    this.routeAnnouncement.remove();
    await this.tail;
    await Promise.allSettled([...this.forced.values()].map((value) => value.result));
    this.forced.clear();
    this.peers.clear();
    this.geometry.clear();
    this.active = undefined;
    this.counters.peers = 0;
  }
}
