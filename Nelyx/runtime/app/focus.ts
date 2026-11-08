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
    key: pair[0]!,
    code: pair[1]!,
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
  private publication: EngineResponse | undefined;
  private state: EngineResponse | undefined;
  private request: { version: number; binding: Binding | null; session: bigint } | undefined;
  private version = 0;
  private syncing = false;
  private pumping = false;
  private closed = false;
  constructor(
    private readonly owner: BuildOwner,
    private readonly view: EngineViewClient,
    private readonly handle: (render: OriginalNativeRender) => NodeHandle | null,
    private readonly stable: () => boolean,
    private readonly error: (error: unknown) => void,
    private readonly notifyPeer: (peer: NodeHandle) => void,
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
    this.enqueue({ kind: 'focus', binding, focused, ...(peer ? { peer } : {}) });
  }
  editingFocus(apply: () => void): void {
    this.enqueue({ kind: 'editorFocus', apply });
  }
  private enqueue(value: Pending): void {
    if (this.closed) return;
    if (this.queue.length >= p.limits.interactionEvents)
      throw Error('Original native focus/keyboard mailbox exceeded');
    this.queue.push(value);
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
        node.matrix[4],
        node.matrix[5],
        node.matrix[0] * node.width + node.matrix[2] * node.height + node.matrix[4],
        node.matrix[1] * node.width + node.matrix[3] * node.height + node.matrix[5],
      ),
      offset: new Offset(node.matrix[4], node.matrix[5]),
    };
  }
  private requestFocus(binding: Binding | null): void {
    if (this.closed || this.syncing || (binding && !binding.active)) return;
    this.request = { version: ++this.version, binding, session: this.state?.focus?.session ?? 0n };
    void Promise.resolve()
      .then(() => this.pump())
      .catch(this.error);
  }
  private async pump(): Promise<void> {
    if (this.pumping || this.closed || !this.request || !this.ready()) return;
    const request = this.request,
      frame = this.publication!,
      state = this.state!,
      target = request.binding?.render ? this.focusTarget(request.binding.render) : null;
    if (request.binding && !target) return;
    if ((state.focus?.session ?? 0n) !== request.session) {
      this.request = undefined;
      return;
    }
    this.pumping = true;
    try {
      await this.view.focus(target, frame.publication, state.focus?.session ?? 0n, true);
      if (this.request?.version === request.version) this.request = undefined;
    } catch (error) {
      if (!(error instanceof EngineError) || error.status !== p.statuses.stale) throw error;
      if (
        error.result?.focus?.session !== state.focus?.session &&
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
  finishPoll = (): void => {
    if (this.closed) return;
    if (this.state && (!this.state.visible || !this.state.focused)) {
      this.queue = [];
      this.request = undefined;
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
    if (!this.ready()) return;
    const queued = this.queue;
    this.queue = [];
    for (const [index, value] of queued.entries()) {
      if (this.closed) break;
      if (value.kind === 'focus') {
        if (!value.binding.active) continue;
        const next = queued[index + 1];
        if (!value.focused && next?.kind === 'focus' && next.focused && next.binding.active)
          continue;
        this.syncing = true;
        try {
          if (value.focused) {
            this.owner.focus.focus(value.binding.node);
            if (value.peer) this.notifyPeer(value.peer);
          } else if (value.binding.node.hasPrimaryFocus)
            this.owner.focus.focus(this.owner.focus.rootScope);
        } finally {
          this.syncing = false;
        }
      } else if (value.kind === 'editorFocus') {
        this.syncing = true;
        try {
          value.apply();
          this.owner.focus.applyFocusChangesIfNeeded();
        } finally {
          this.syncing = false;
        }
      } else {
        const event = transportKey(value.event),
          result = this.owner.focus.dispatchKeyEvent(event);
        this.owner.focus.applyFocusChangesIfNeeded();
        if (result !== 'ignored' || event.kind !== 'down') continue;
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
      }
    }
    void this.pump().catch(this.error);
  };
  close(): void {
    this.closed = true;
    this.queue = [];
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
      node = this.widget.source.node;
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
        onFocusChanged: (focused, event) =>
          this.widget.bridge.focus(binding, focused, event?.focusPeer),
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
