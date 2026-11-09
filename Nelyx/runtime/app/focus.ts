// SPDX-License-Identifier: BSD-3-Clause
import {
  StatefulWidget,
  State,
  registerNativeWidgetAdapter,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildOwner, Widget } from '@nelyx/core/framework/widgets/framework';
import { NativeFocusConfiguration } from '@nelyx/core/framework/widgets/focus-scope';
import { bindNativeFocusNode } from '@nelyx/core/framework/widgets/focus';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import {
  Actions,
  ActivateIntent,
  ButtonActivateIntent,
} from '@nelyx/core/framework/widgets/actions';
import { Rect } from '@nelyx/core/ui/rect';
import { ObjectKey } from '@nelyx/core/foundation/key';
import { Offset } from '@nelyx/core/ui/offset';
import type { KeyEvent } from '@nelyx/core/ui/input';
import { OriginalNativeNode } from './native-node.ts';
import { OriginalNativeRender } from './native-node.ts';
import type { EngineEvent, EngineResponse, NodeHandle } from '../engine-client/codec.ts';
import type { EngineViewClient } from '../engine-client/client.ts';
import { EngineError } from '../engine-client/client.ts';
import { protocol as p } from '../engine-client/schema.ts';

type Binding = {
  node: FocusNode;
  render?: OriginalNativeRender;
  active: boolean;
  release: () => void;
};
type Pending =
  | { kind: 'focus'; binding: Binding; focused: boolean; peer?: NodeHandle }
  | { kind: 'editorFocus'; apply: () => void }
  | { kind: 'input'; event: EngineEvent; perform: () => void }
  | { kind: 'key'; event: EngineEvent };
const specialKeys: Readonly<Record<number, readonly [string, string]>> = {
  8: ['Backspace', 'Backspace'],
  9: ['Tab', 'Tab'],
  13: ['Enter', 'Enter'],
  16: ['Shift', 'ShiftLeft'],
  17: ['Control', 'ControlLeft'],
  18: ['Alt', 'AltLeft'],
  19: ['Pause', 'Pause'],
  20: ['CapsLock', 'CapsLock'],
  27: ['Escape', 'Escape'],
  32: [' ', 'Space'],
  33: ['PageUp', 'PageUp'],
  34: ['PageDown', 'PageDown'],
  35: ['End', 'End'],
  36: ['Home', 'Home'],
  37: ['ArrowLeft', 'ArrowLeft'],
  38: ['ArrowUp', 'ArrowUp'],
  39: ['ArrowRight', 'ArrowRight'],
  40: ['ArrowDown', 'ArrowDown'],
  44: ['PrintScreen', 'PrintScreen'],
  45: ['Insert', 'Insert'],
  46: ['Delete', 'Delete'],
  91: ['Meta', 'MetaLeft'],
  92: ['Meta', 'MetaRight'],
  93: ['ContextMenu', 'ContextMenu'],
  106: ['*', 'NumpadMultiply'],
  107: ['+', 'NumpadAdd'],
  109: ['-', 'NumpadSubtract'],
  110: ['.', 'NumpadDecimal'],
  111: ['/', 'NumpadDivide'],
  144: ['NumLock', 'NumLock'],
  145: ['ScrollLock', 'ScrollLock'],
  160: ['Shift', 'ShiftLeft'],
  161: ['Shift', 'ShiftRight'],
  162: ['Control', 'ControlLeft'],
  163: ['Control', 'ControlRight'],
  164: ['Alt', 'AltLeft'],
  165: ['Alt', 'AltRight'],
  186: [';', 'Semicolon'],
  187: ['=', 'Equal'],
  188: [',', 'Comma'],
  189: ['-', 'Minus'],
  190: ['.', 'Period'],
  191: ['/', 'Slash'],
  192: ['`', 'Backquote'],
  219: ['[', 'BracketLeft'],
  220: ['\\', 'Backslash'],
  221: [']', 'BracketRight'],
  222: ["'", 'Quote'],
};
function transportKey(event: EngineEvent): KeyEvent {
  const code = Number(event.detail & 0xffff_ffffn),
    modifiers = Number(event.detail >> 32n),
    pair =
      specialKeys[code] ??
      (code >= 65 && code <= 90
        ? [String.fromCharCode(code).toLowerCase(), 'Key' + String.fromCharCode(code)]
        : code >= 48 && code <= 57
          ? [String.fromCharCode(code), 'Digit' + String.fromCharCode(code)]
          : code >= 96 && code <= 105
            ? [String(code - 96), 'Numpad' + (code - 96)]
            : code >= 112 && code <= 135
              ? ['F' + (code - 111), 'F' + (code - 111)]
              : ['NativeVirtualKey' + code, 'NativeVirtualKey' + code]);
  if (
    code > 65535 ||
    modifiers > 15 ||
    !Object.values(p.keyKinds).some((value) => value === event.status) ||
    event.x < 0
  )
    throw Error('Original native keyboard identity is unsupported or malformed');
  return {
    kind: event.status === p.keyKinds.up ? 'up' : 'down',
    key:
      event.keyIdentity?.key === 'Unidentified' ? pair[0]! : (event.keyIdentity?.key ?? pair[0]!),
    code:
      event.keyIdentity?.code === 'Unidentified' ? pair[1]! : (event.keyIdentity?.code ?? pair[1]!),
    ...(event.keyIdentity ? { location: event.keyIdentity.location } : {}),
    shift: !!(modifiers & 1),
    control: !!(modifiers & 2),
    alt: !!(modifiers & 4),
    meta: !!(modifiers & 8),
    repeat: event.status === p.keyKinds.repeat,
    timestamp: event.x * 1000,
  };
}

/** Source focus/shortcut execution stays on App. Native input never waits for it. */
export class OriginalFocusBridge {
  private readonly bindings = new Set<Binding>();
  private queue: Pending[] = [];
  private draining: Pending[] | undefined;
  private insertion = 0;
  private nativeSession: bigint | undefined;
  private inputSession: bigint | undefined;
  private publication: EngineResponse | undefined;
  private state: EngineResponse | undefined;
  private request: { version: number; binding: Binding | null; session: bigint } | undefined;
  private version = 0;
  private syncing = false;
  private pumping = false;
  private refreshing = false;
  private closed = false;
  constructor(
    private readonly owner: BuildOwner,
    private readonly view: EngineViewClient,
    private readonly handle: (render: OriginalNativeRender) => NodeHandle | null,
    private readonly stable: () => boolean,
    private readonly error: (error: unknown) => void,
    private readonly notifyPeer: (peer: NodeHandle) => void,
    private readonly dispatchNativeKey?: (event: EngineEvent, dispatch?: () => void) => void,
  ) {
    registerNativeWidgetAdapter(owner, 'focus', (widget) => {
      if (Object.getPrototypeOf(widget) !== NativeFocusConfiguration.prototype)
        throw Error('Original native focus configuration identity differs');
      return new FocusBoundary(this, widget as NativeFocusConfiguration);
    });
  }
  bind(node: FocusNode): Binding {
    const binding: Binding = { node, active: true, release: () => {} };
    binding.release = bindNativeFocusNode(node, this, {
      geometry: () => this.geometry(binding),
      focus: () => this.requestFocus(binding),
      blur: () => this.requestFocus(null),
      reveal: () => this.requestFocus(binding),
    });
    this.bindings.add(binding);
    return binding;
  }
  unbind(binding: Binding): void {
    binding.active = false;
    binding.release();
    this.bindings.delete(binding);
    this.queue = this.queue.filter((value) => value.kind !== 'focus' || value.binding !== binding);
    if (this.request?.binding === binding) this.request = undefined;
  }
  observePublication = (state: EngineResponse): void => {
    this.publication = state;
  };
  observeState = (state: EngineResponse): void => {
    this.state = state;
  };
  key = (event: EngineEvent): void => {
    this.enqueue({ kind: 'key', event });
  };
  focus(binding: Binding, focused: boolean, peer?: NodeHandle): void {
    if (!binding.active) return;
    this.enqueue({
      kind: 'focus',
      binding,
      focused,
      ...(peer ? { peer } : {}),
    });
  }
  input(event: EngineEvent, perform: () => void): void {
    this.enqueue({ kind: 'input', event, perform });
  }
  editingFocus(apply: () => void): void {
    this.enqueue({ kind: 'editorFocus', apply });
  }
  private enqueue(value: Pending): void {
    if (this.closed) {
      if (value.kind === 'key') this.dispatchNativeKey?.(value.event);
      return;
    }
    if (this.queue.length + (this.draining?.length ?? 0) >= p.limits.interactionEvents) {
      if (value.kind === 'key') this.dispatchNativeKey?.(value.event);
      throw Error('Original native focus/keyboard mailbox exceeded');
    }
    // A native focus notification can enqueue editor/source notifications.
    // Preserve their order before the next admitted input, without recursion.
    if (this.draining) this.draining.splice(this.insertion++, 0, value);
    else this.queue.push(value);
  }
  private geometryReady(): boolean {
    const state = this.state,
      frame = this.publication;
    return !!(
      state &&
      frame &&
      frame.publishedDocument === state.document &&
      frame.publishedMetrics === state.metrics &&
      frame.publishedDevice === state.device &&
      frame.publication === state.publication
    );
  }
  private ready(): boolean {
    return this.geometryReady() && this.stable() && !!this.state?.visible && !!this.state?.focused;
  }
  private geometry(binding: Binding): { rect: Rect; offset: Offset } {
    const handle = binding.render && this.handle(binding.render),
      frame = this.publication;
    const node =
      handle &&
      frame?.nodes.find(
        (n) => n.node.slot === handle.slot && n.node.generation === handle.generation,
      );
    if (!binding.active || this.closed || !this.geometryReady() || !node)
      throw Error('Original native focus geometry is not currently published');
    return {
      rect: Rect.fromLTRB(
        node.bounds.x,
        node.bounds.y,
        node.bounds.x + node.bounds.width,
        node.bounds.y + node.bounds.height,
      ),
      offset: new Offset(node.matrix[4], node.matrix[5]),
    };
  }
  private requestFocus(binding: Binding | null): void {
    if (this.closed || this.syncing || (binding && !binding.active)) return;
    this.request = {
      version: ++this.version,
      binding,
      session: this.inputSession ?? this.state?.focus?.session ?? 0n,
    };
    void Promise.resolve()
      .then(() => this.pump())
      .catch(this.error);
  }
  private async pump(): Promise<void> {
    if (this.pumping || this.closed || !this.request || !this.ready()) return;
    const request = this.request,
      target = request.binding?.render ? this.focusTarget(request.binding.render) : null;
    if (request.binding && !target) return;
    this.pumping = true;
    try {
      const state = await this.view.semanticsSnapshot();
      if (this.closed || this.request?.version !== request.version) return;
      if ((state.focus?.session ?? 0n) !== request.session) {
        this.request = undefined;
        return;
      }
      if (
        !this.stable() ||
        !state.visible ||
        !state.focused ||
        state.document !== state.publishedDocument ||
        state.metrics !== state.publishedMetrics ||
        state.device !== state.publishedDevice
      )
        return;
      const current = request.binding?.render ? this.focusTarget(request.binding.render) : null;
      if (
        request.binding &&
        (!request.binding.active ||
          !current ||
          !target ||
          current.slot !== target.slot ||
          current.generation !== target.generation)
      ) {
        this.request = undefined;
        return;
      }
      await this.view.focus(target, state.publication, request.session, true);
      if (this.request?.version === request.version) this.request = undefined;
    } catch (error) {
      if (!(error instanceof EngineError) || error.status !== p.statuses.stale) throw error;
      if (
        (error.result?.focus?.session ?? 0n) !== request.session &&
        this.request?.version === request.version
      )
        this.request = undefined;
    } finally {
      this.pumping = false;
    }
  }
  private focusTarget(root: OriginalNativeRender): NodeHandle | null {
    const editors: OriginalNativeRender[] = [];
    const visit = (render: import('@nelyx/core/framework/rendering/object').RenderObject): void => {
      if (render !== root && render instanceof OriginalNativeRender && render.options.nativeFocus)
        return;
      if (render instanceof OriginalNativeRender && render.editable) editors.push(render);
      for (const child of render.children) visit(child);
    };
    visit(root);
    // Source Focus retains its lifecycle, while the actual Core editor owns IME focus.
    return this.handle(editors.length === 1 ? editors[0]! : root);
  }
  private refreshForKeys(): void {
    if (this.refreshing) return;
    this.refreshing = true;
    void this.view
      .semanticsSnapshot()
      .then((frame) => {
        if (this.closed) return;
        // A later poll may have observed a newer publication during this query.
        if (!this.state || frame.publication >= this.state.publication) {
          this.publication = frame;
          this.state = frame;
        }
        this.refreshing = false;
        // Missing geometry waits for the next publication, without a query loop.
        if (this.geometryReady()) this.finishPoll();
      })
      .catch(this.error)
      .finally(() => {
        this.refreshing = false;
      });
  }
  finishPoll = (): void => {
    if (this.closed || this.draining) return;
    if (this.state && (!this.state.visible || !this.state.focused)) {
      for (const value of this.queue)
        if (value.kind === 'key') this.dispatchNativeKey?.(value.event);
      this.queue = [];
      this.request = undefined;
      this.nativeSession = this.state.focus?.session ?? 0n;
      this.owner.keyboard.releaseAllKeys(
        undefined,
        (event) => this.owner.focus.dispatchKeyEvents([event]) === 'handled',
      );
      this.syncing = true;
      try {
        this.owner.focus.focus(this.owner.focus.rootScope);
      } finally {
        this.syncing = false;
      }
      return;
    }
    // Core already admitted this input. A compositor publication can advance
    // between the semantics query and event poll. Refresh that observation for
    // synchronous Source traversal reads instead of waiting for a quiet frame.
    if (!this.stable() || !this.state?.visible || !this.state?.focused) return;
    if (!this.geometryReady() && this.queue.some((value) => value.kind === 'key')) {
      this.refreshForKeys();
      return;
    }
    const queued = this.queue;
    this.queue = [];
    this.draining = queued;
    const errors: unknown[] = [];
    try {
      while (queued.length) {
        const value = queued.shift()!;
        this.insertion = 0;
        try {
          if (this.closed) {
            if (value.kind === 'key') this.dispatchNativeKey?.(value.event);
            continue;
          }
          if (value.kind === 'focus') {
            if (!value.binding.active) continue;
            const next = queued[0];
            if (!value.focused && next?.kind === 'focus' && next.focused && next.binding.active)
              continue;
            this.syncing = true;
            this.inputSession = this.nativeSession;
            try {
              if (value.focused) {
                this.owner.focus.focus(value.binding.node);
                if (value.peer) this.notifyPeer(value.peer);
              } else if (value.binding.node.hasPrimaryFocus)
                this.owner.focus.focus(this.owner.focus.rootScope);
            } finally {
              this.syncing = false;
              this.owner.focus.applyFocusChangesIfNeeded();
              this.inputSession = undefined;
            }
          } else if (value.kind === 'editorFocus') {
            this.syncing = true;
            this.inputSession = this.nativeSession;
            try {
              value.apply();
              this.owner.focus.applyFocusChangesIfNeeded();
            } finally {
              this.syncing = false;
              this.owner.focus.applyFocusChangesIfNeeded();
              this.inputSession = undefined;
            }
          } else if (value.kind === 'input') {
            if (value.event.kind === p.events.focusChanged) {
              this.nativeSession = value.event.status === p.statuses.ok ? value.event.id : 0n;
              if (this.request && this.request.session !== this.nativeSession)
                this.request = undefined;
            }
            this.inputSession = this.nativeSession ?? this.state.focus?.session ?? 0n;
            try {
              value.perform();
            } finally {
              this.owner.focus.applyFocusChangesIfNeeded();
              this.inputSession = undefined;
            }
          } else {
            this.inputSession = value.event.epoch;
            const dispatch = () => {
              const event = transportKey(value.event),
                result = this.owner.focus.dispatchKeyEvent(event);
              this.owner.focus.applyFocusChangesIfNeeded();
              if (result !== 'ignored' || event.kind !== 'down') return;
              if (event.key === 'Tab' && !event.control && !event.alt && !event.meta)
                this.owner.focus.next(event.shift);
              else if (
                !event.repeat &&
                !event.control &&
                !event.alt &&
                !event.meta &&
                (event.key === 'Enter' || event.key === ' ')
              ) {
                const context = this.owner.focus.primaryFocus?.context;
                if (context)
                  Actions.handler(
                    context,
                    event.key === 'Enter' ? new ButtonActivateIntent() : new ActivateIntent(),
                  )?.();
              }
              this.owner.focus.applyFocusChangesIfNeeded();
            };
            try {
              if (this.dispatchNativeKey) this.dispatchNativeKey(value.event, dispatch);
              else dispatch();
            } finally {
              this.inputSession = undefined;
            }
          }
        } catch (error) {
          errors.push(error);
        }
      }
    } finally {
      this.draining = undefined;
      this.insertion = 0;
      this.inputSession = undefined;
    }
    void this.pump().catch(this.error);
    if (errors.length) throw new AggregateError(errors, 'Original input dispatch failed');
  };
  close(): void {
    this.closed = true;
    for (const value of this.queue) if (value.kind === 'key') this.dispatchNativeKey?.(value.event);
    this.queue = [];
    for (const value of this.draining ?? [])
      if (value.kind === 'key') this.dispatchNativeKey?.(value.event);
    if (this.draining) this.draining.length = 0;
    this.request = undefined;
    this.publication = undefined;
    this.state = undefined;
    for (const binding of this.bindings) this.unbind(binding);
  }
}

class FocusBoundary extends StatefulWidget {
  constructor(
    readonly bridge: OriginalFocusBridge,
    readonly source: NativeFocusConfiguration,
  ) {
    super();
  }
  createState(): State<FocusBoundary> {
    return new FocusBoundaryState();
  }
}
class FocusBoundaryState extends State<FocusBoundary> {
  private binding: Binding | undefined;
  private bind(): Binding {
    return (this.binding ??= this.widget.bridge.bind(this.widget.source.node));
  }
  build(): Widget {
    const binding = this.bind(),
      node = this.widget.source.node,
      bridge = this.widget.bridge;
    return new OriginalNativeNode(
      'box',
      [this.widget.source.child],
      {
        key: new ObjectKey(node),
        layout: { childConstraints: 'inherit' },
        nativeFocus: {
          enabled: node.canRequestFocus,
          skipTraversal: node.skipTraversal,
        },
        onFocusChanged: (focused, event) => bridge.focus(binding, focused, event?.focusPeer),
      },
      (render) => {
        binding.render = render;
      },
    );
  }
  override didUpdateWidget(old: FocusBoundary): void {
    super.didUpdateWidget(old);
    if (old.source.node !== this.widget.source.node && this.binding) {
      this.widget.bridge.unbind(this.binding);
      this.binding = undefined;
    }
  }
  override deactivate(): void {
    if (this.binding) {
      this.widget.bridge.unbind(this.binding);
      this.binding = undefined;
    }
    super.deactivate();
  }
  override dispose(): void {
    if (this.binding) this.widget.bridge.unbind(this.binding);
    this.binding = undefined;
    super.dispose();
  }
}
