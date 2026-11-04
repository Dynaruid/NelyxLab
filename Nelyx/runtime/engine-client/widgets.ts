// SPDX-License-Identifier: BSD-3-Clause
import { commands as c, protocol as p } from './codec.ts';
import type {
  NodeHandle,
  NodeLayout,
  NodeProperties,
  AxisBound,
  SemanticProperties,
  EditingSnapshot,
  EditingUpdate,
} from './codec.ts';
import { EngineError } from './client.ts';
import type { EngineViewClient } from './client.ts';

export class ValueKey {
  constructor(readonly value: string | number) {}
}
export class GlobalKey<T extends State = State> {
  /** @internal */ element: Element | undefined;
  get currentState(): T | null {
    return (this.element?.active ? this.element.state : null) as T | null;
  }
  get currentNode(): NodeHandle | null {
    return this.element?.active ? firstNode(this.element) : null;
  }
}
export type Key = ValueKey | GlobalKey;
export abstract class Widget {
  constructor(readonly key?: Key) {}
}
export abstract class StatelessWidget extends Widget {
  abstract build(context: BuildContext): Widget;
}
export abstract class StatefulWidget extends Widget {
  abstract createState(): State;
}
export abstract class State<W extends StatefulWidget = StatefulWidget> {
  /** @internal */ element: Element | undefined;
  get mounted(): boolean {
    return !!this.element;
  }
  get widget(): W {
    if (!this.element) throw new Error('State is disposed');
    return this.element.widget as W;
  }
  get context(): BuildContext {
    if (!this.element?.context) throw new Error('No build context');
    return this.element.context;
  }
  initState(): void {}
  didUpdateWidget(_old: W): void {}
  didChangeDependencies(): void {}
  deactivate(): void {}
  dispose(): void {}
  abstract build(context: BuildContext): Widget;
  setState(change: () => void): void {
    if (!this.element) throw new Error('setState after dispose');
    const result: unknown = change();
    if (result && typeof (result as PromiseLike<unknown>).then === 'function')
      throw new Error('setState callback must be synchronous');
    this.element.host.schedule();
  }
}
export abstract class InheritedWidget extends Widget {
  constructor(
    readonly child: Widget,
    key?: Key,
  ) {
    super(key);
  }
  abstract updateShouldNotify(old: InheritedWidget): boolean;
}
type WidgetType<T extends Widget> = abstract new (...args: never[]) => T;
export class BuildContext {
  /** @internal */ constructor(
    private readonly element: Element,
    private readonly inherited: readonly InheritedWidget[],
  ) {}
  dependOn<T extends InheritedWidget>(type: WidgetType<T>): T | null {
    for (let i = this.inherited.length - 1; i >= 0; --i) {
      const item = this.inherited[i]!;
      if (item instanceof type) {
        this.element.dependencies.set(type, item);
        return item;
      }
    }
    this.element.dependencies.set(type, null);
    return null;
  }
}
export class ImageResource {
  readonly bytes: Uint8Array;
  constructor(bytes: Uint8Array) {
    this.bytes = bytes.slice();
  }
}
export interface NodeOptions {
  readonly key?: Key;
  readonly properties?: NodeProperties;
  readonly layout?: NodeLayout | false;
  readonly horizontal?: AxisBound;
  readonly vertical?: AxisBound;
  readonly color?: number;
  readonly radius?: number;
  readonly semantics?: SemanticProperties;
  readonly onAction?: (action: keyof typeof p.semanticsActions) => void;
  readonly motion?: {
    readonly id: bigint;
    readonly revision?: bigint;
    readonly opacity: number;
    readonly seconds: number;
  };
}
export class NodeWidget extends Widget {
  constructor(
    readonly kind: keyof typeof p.kinds,
    readonly children: readonly Widget[] = [],
    readonly options: NodeOptions = {},
    readonly text?: {
      readonly value: string;
      readonly size: number;
      readonly color: number;
      readonly direction: 'ltr' | 'rtl';
    },
    readonly image?: ImageResource,
    readonly editor?: EditingController,
    readonly editorFlags = 0,
    readonly maximumLength: number = p.limits.textBytes,
  ) {
    super(options.key);
  }
}
export class Box extends NodeWidget {
  constructor(children: readonly Widget[] = [], options: NodeOptions = {}) {
    super('box', children, options);
  }
}
export class Stack extends NodeWidget {
  constructor(children: readonly Widget[] = [], options: NodeOptions = {}) {
    super('stack', children, options);
  }
}
export class Row extends NodeWidget {
  constructor(children: readonly Widget[] = [], options: NodeOptions = {}) {
    super('flex', children, {
      ...options,
      layout: { ...options.layout, direction: 'horizontal' },
    });
  }
}
export class Column extends NodeWidget {
  constructor(children: readonly Widget[] = [], options: NodeOptions = {}) {
    super('flex', children, {
      ...options,
      layout: { ...options.layout, direction: 'vertical' },
    });
  }
}
export class Wrap extends NodeWidget {
  constructor(children: readonly Widget[] = [], options: NodeOptions = {}) {
    super('wrap', children, options);
  }
}
export class Grid extends NodeWidget {
  constructor(children: readonly Widget[] = [], options: NodeOptions = {}) {
    super('grid', children, options);
  }
}
export class Clip extends NodeWidget {
  constructor(child: Widget, options: NodeOptions = {}) {
    super('clip', [child], options);
  }
}
export class ScrollView extends NodeWidget {
  constructor(child: Widget, options: NodeOptions = {}) {
    super('scrollViewport', [child], options);
  }
}
export class Text extends NodeWidget {
  constructor(
    value: string,
    options: NodeOptions & {
      readonly fontSize?: number;
      readonly textColor?: number;
      readonly direction?: 'ltr' | 'rtl';
    } = {},
  ) {
    super('paragraph', [], options, {
      value,
      size: options.fontSize ?? 18,
      color: options.textColor ?? 0xff172033,
      direction: options.direction ?? 'ltr',
    });
  }
}
export class Image extends NodeWidget {
  constructor(resource: ImageResource, options: NodeOptions = {}) {
    super('image', [], options, undefined, resource);
  }
}
export class Semantics extends NodeWidget {
  constructor(child: Widget, semantics: SemanticProperties, options: NodeOptions = {}) {
    super('box', [child], { ...options, semantics });
  }
}
export class Button extends NodeWidget {
  constructor(label: string, onPressed: () => void, options: NodeOptions = {}) {
    super('box', [new Text(label, { textColor: 0xffffffff })], {
      color: 0xff286ee9,
      radius: 8,
      layout: { padding: { left: 12, right: 12, top: 8, bottom: 8 } },
      ...options,
      semantics: {
        role: 'button',
        label,
        flags: p.semanticsFlags.focusable,
        actions: p.semanticsActions.activate | p.semanticsActions.focus,
        ...options.semantics,
      },
      onAction: (action) => {
        if (action === 'activate') onPressed();
        options.onAction?.(action);
      },
    });
  }
}
/** Core owns the value after attachment. Programmatic writes require an explicit revision. */
export class EditingController {
  private binding: { host: WidgetHost; node: NodeHandle } | undefined;
  private listeners = new Set<(value: EditingSnapshot) => void>();
  private current: EditingSnapshot | null = null;
  constructor(readonly initialText = '') {}
  get value(): EditingSnapshot | null {
    return this.current;
  }
  subscribe(callback: (value: EditingSnapshot) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  /** @internal */ attach(host: WidgetHost, node: NodeHandle): void {
    if (this.binding && (this.binding.host !== host || id(this.binding.node) !== id(node)))
      throw new Error('An EditingController may attach to one editor');
    this.binding = { host, node };
  }
  /** @internal */ detach(host: WidgetHost): void {
    if (this.binding?.host === host) this.binding = undefined;
  }
  /** @internal */ publish(value: EditingSnapshot): void {
    if (this.current && value.revision <= this.current.revision) return;
    this.current = value;
    for (const f of this.listeners) f(value);
  }
  async refresh(): Promise<EditingSnapshot> {
    const b = this.binding;
    if (!b) throw new Error('Editor is detached');
    const value = await b.host.view.editSnapshot(b.node);
    this.publish(value);
    return value;
  }
  async edit(update: EditingUpdate): Promise<EditingSnapshot> {
    const b = this.binding;
    if (!b) throw new Error('Editor is detached');
    const state = await b.host.view.request(p.opcodes.inspect);
    const session = state.focus && id(state.focus.node) === id(b.node) ? state.focus.session : 0n;
    const value = await b.host.view.edit(b.node, { ...update, session });
    this.publish(value);
    return value;
  }
}
export class EditableText extends NodeWidget {
  constructor(
    controller: EditingController,
    options: NodeOptions & {
      readonly fontSize?: number;
      readonly textColor?: number;
      readonly direction?: 'ltr' | 'rtl';
      readonly flags?: number;
      readonly maximumLength?: number;
    } = {},
  ) {
    super(
      'editable',
      [],
      {
        ...options,
        semantics: {
          role: 'textField',
          label: '',
          flags: p.semanticsFlags.focusable,
          actions:
            p.semanticsActions.focus |
            p.semanticsActions.setValue |
            p.semanticsActions.setSelection,
          ...options.semantics,
        },
      },
      {
        value: controller.initialText,
        size: options.fontSize ?? 18,
        color: options.textColor ?? 0xff172033,
        direction: options.direction ?? 'ltr',
      },
      undefined,
      controller,
      options.flags ?? 0,
      options.maximumLength ?? p.limits.textBytes,
    );
  }
}
function id(h: NodeHandle): string {
  return `${h.slot}:${h.generation}`;
}
function sameKey(a: Key | undefined, b: Key | undefined): boolean {
  return a === b || (a instanceof ValueKey && b instanceof ValueKey && a.value === b.value);
}
function compatible(e: Element, w: Widget): boolean {
  return (
    e.widget.constructor === w.constructor &&
    sameKey(e.widget.key, w.key) &&
    (!(w instanceof NodeWidget) || !(e.widget instanceof NodeWidget) || e.widget.kind === w.kind)
  );
}
interface Element {
  widget: Widget;
  host: WidgetHost;
  children: Element[];
  active: boolean;
  state?: State;
  context?: BuildContext;
  handle?: NodeHandle;
  dependencies: Map<WidgetType<InheritedWidget>, InheritedWidget | null>;
}
function firstNode(e: Element): NodeHandle | null {
  return e.handle ?? (e.children[0] ? firstNode(e.children[0]) : null);
}
interface NativeRecord {
  readonly element: Element;
  readonly node: NodeWidget;
  readonly handle: NodeHandle;
  readonly parent: NodeHandle | null;
  readonly children: readonly NodeHandle[];
  readonly config: readonly Uint8Array[];
}
const equalBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((n, i) => n === b[i]);

/** Widget/Element reconciliation runs on App. All standard layout remains in C++ Content. */
export class WidgetHost {
  private root: Widget | undefined;
  private tree: Element | undefined;
  private building = false;
  private closed = false;
  private scheduled = false;
  private accepted = new Map<string, NativeRecord>();
  private elements = new Set<Element>();
  private retired = new Set<Element>();
  private globals = new Map<GlobalKey, Element>();
  private used = new Set<Element>();
  private allocations = new Set<Element>();
  private free: NodeHandle[] = [];
  private nextSlot = 0;
  private resourceSlot = 0;
  private resources = new Map<ImageResource, NodeHandle>();
  private acceptedResources = new Set<ImageResource>();
  private freeResources: NodeHandle[] = [];
  private pending:
    | { desired: Map<string, NativeRecord>; changes: readonly Uint8Array[] }
    | undefined;
  private running: Promise<void> | undefined;
  private rerun = false;
  private eventTimer: ReturnType<typeof setTimeout> | undefined;
  private polling = false;
  readonly counters = {
    builds: 0,
    transactions: 0,
    commands: 0,
    created: 0,
    destroyed: 0,
    moved: 0,
    fallbacks: 0,
  };
  constructor(
    readonly view: EngineViewClient,
    private readonly options: { onError?: (error: unknown) => void; pollEvents?: boolean } = {},
  ) {}
  async mount(root: Widget): Promise<void> {
    if (this.root) throw new Error('WidgetHost is already mounted');
    this.root = root;
    await this.flush();
    if (this.options.pollEvents !== false) this.pollSoon();
  }
  update(root: Widget): Promise<void> {
    this.ensure();
    this.root = root;
    return this.flush();
  }
  private ensure(): void {
    if (this.closed) throw new Error('WidgetHost is closed');
  }
  /** @internal */ schedule(): void {
    this.ensure();
    if (this.building) throw new Error('setState during build');
    if (this.scheduled) return;
    this.scheduled = true;
    void Promise.resolve()
      .then(() => {
        this.scheduled = false;
        return this.flush();
      })
      .catch((error) => this.options.onError?.(error));
  }
  private allocate(): NodeHandle {
    const h = this.free.pop();
    if (h) return h;
    if (++this.nextSlot > p.limits.nodes)
      throw new EngineError(p.statuses.budgetExceeded, 'Widget node budget');
    return { slot: this.nextSlot, generation: 1 };
  }
  private reconcile(
    widget: Widget,
    previous: Element | undefined,
    inherited: readonly InheritedWidget[],
    depth = 0,
  ): Element {
    if (depth > p.limits.depth) throw new Error('Widget depth budget');
    const key = widget.key;
    if (key instanceof GlobalKey) {
      const global = this.globals.get(key);
      if (global && compatible(global, widget)) previous = global;
      if (key.element && key.element.host !== this)
        throw new Error('GlobalKey belongs to another host');
    }
    let element: Element;
    if (previous && compatible(previous, widget) && !this.used.has(previous)) element = previous;
    else {
      element = { widget, host: this, children: [], active: true, dependencies: new Map() };
      this.elements.add(element);
      if (widget instanceof NodeWidget) {
        element.handle = this.allocate();
        this.allocations.add(element);
      }
      if (widget instanceof StatefulWidget) {
        const state = widget.createState();
        if (state.element) throw new Error('State is already mounted');
        element.state = state;
        state.element = element;
      }
    }
    if (this.used.has(element)) throw new Error('Duplicate GlobalKey');
    if (key instanceof GlobalKey) {
      if (this.used.has(this.globals.get(key)!)) throw new Error('Duplicate GlobalKey');
      this.globals.set(key, element);
      key.element = element;
    }
    this.used.add(element);
    element.active = true;
    this.retired.delete(element);
    const old = element.widget;
    let dependenciesChanged = !element.context;
    for (const [type, before] of element.dependencies) {
      const now = [...inherited].reverse().find((w) => w instanceof type) ?? null;
      if (now !== before && (!now || !before || now.updateShouldNotify(before)))
        dependenciesChanged = true;
    }
    element.widget = widget;
    element.context = new BuildContext(element, inherited);
    element.dependencies.clear();
    let children: readonly Widget[];
    if (widget instanceof NodeWidget) children = widget.children;
    else if (widget instanceof InheritedWidget) {
      children = [widget.child];
      inherited = [...inherited, widget];
    } else if (widget instanceof StatelessWidget) children = [widget.build(element.context)];
    else if (widget instanceof StatefulWidget) {
      const state = element.state!;
      if (!('initialized' in element)) {
        Object.assign(element, { initialized: true });
        state.initState();
      } else if (old !== widget) state.didUpdateWidget(old as StatefulWidget);
      if (dependenciesChanged) state.didChangeDependencies();
      children = [state.build(element.context)];
    } else throw new Error('Unsupported v2 Widget type');
    const localKeys: Key[] = [];
    for (const child of children)
      if (child.key) {
        if (localKeys.some((k) => sameKey(k, child.key))) throw new Error('Duplicate sibling key');
        localKeys.push(child.key);
      }
    const oldChildren = element.children;
    element.children = children.map((child, index) =>
      this.reconcile(
        child,
        child.key ? oldChildren.find((e) => sameKey(e.widget.key, child.key)) : oldChildren[index],
        inherited,
        depth + 1,
      ),
    );
    return element;
  }
  private records(root: Element): Map<string, NativeRecord> {
    const records = new Map<string, NativeRecord>();
    const visit = (e: Element, parent: NodeHandle | null): NodeHandle[] => {
      if (!(e.widget instanceof NodeWidget))
        return e.children.flatMap((child) => visit(child, parent));
      const node = e.widget,
        h = e.handle!,
        children = e.children.flatMap((child) => visit(child, h)),
        o = node.options;
      const config = [
        c.properties(h, o.properties ?? {}),
        c.paint(h, o.color ?? 0, o.radius ?? 0),
        c.layout(h, o.layout === false ? { enabled: false } : (o.layout ?? {})),
        c.constraints(
          h,
          o.horizontal ?? { kind: 'unbounded' },
          o.vertical ?? { kind: 'unbounded' },
        ),
      ];
      if (node.text)
        config.push(
          c.text(h, node.text.value, node.text.size, node.text.color, {
            direction: node.text.direction,
          }),
        );
      if (node.editor) config.push(c.editor(h, node.editorFlags, node.maximumLength));
      config.push(c.semantics(h, o.semantics ?? null));
      if (node.kind === 'image') {
        let resource = node.image ? this.resources.get(node.image) : undefined;
        if (node.image && !resource) {
          resource = this.freeResources.pop();
          if (!resource) {
            if (++this.resourceSlot > p.limits.resources) throw new Error('Widget resource budget');
            resource = { slot: this.resourceSlot, generation: 1 };
          }
          this.resources.set(node.image, resource);
        }
        config.push(c.bindResource(h, resource ?? null));
      }
      if (o.motion)
        config.push(
          c.motion(h, o.motion.id, o.motion.revision ?? 0n, o.motion.opacity, o.motion.seconds),
        );
      records.set(id(h), { element: e, node, handle: h, parent, children, config });
      return [h];
    };
    const roots = visit(root, null);
    if (roots.length !== 1) throw new Error('WidgetHost requires one render root');
    return records;
  }
  private diff(desired: Map<string, NativeRecord>): Uint8Array[] {
    const changes: Uint8Array[] = [],
      wantedResources = new Set(
        [...desired.values()].flatMap((r) => (r.node.image ? [r.node.image] : [])),
      );
    for (const resource of wantedResources)
      if (!this.acceptedResources.has(resource))
        changes.push(c.acquireResource(this.resources.get(resource)!, resource.bytes));
    const topology = new Map<string, string[]>();
    for (const r of this.accepted.values()) topology.set(id(r.handle), r.children.map(id));
    const detach = (r: NativeRecord) => {
      if (r.parent) {
        const a = topology.get(id(r.parent));
        if (a) {
          const index = a.indexOf(id(r.handle));
          if (index >= 0) a.splice(index, 1);
        }
      }
    };
    for (const r of this.accepted.values())
      if (!desired.has(id(r.handle))) {
        if (r.parent) changes.push(c.detach(r.handle));
        detach(r);
      }
    for (const r of [...this.accepted.values()].reverse())
      if (!desired.has(id(r.handle))) changes.push(c.destroy(r.handle));
    for (const r of desired.values()) {
      const before = this.accepted.get(id(r.handle));
      if (!before) {
        changes.push(c.create(r.handle, r.node.kind));
        topology.set(id(r.handle), []);
      }
      r.config.forEach((config, index) => {
        if (!before || !before.config[index] || !equalBytes(config, before.config[index]!))
          changes.push(config);
      });
    }
    // Every parent exists. Populate siblings in declaration order against the
    // topology produced by preceding moves, including cross-parent moves.
    for (const r of desired.values()) {
      const list = topology.get(id(r.handle))!;
      r.children.forEach((h, index) => {
        const old = this.accepted.get(id(h));
        if (old?.parent && id(old.parent) === id(r.handle) && list.indexOf(id(h)) === index) return;
        if (old?.parent) {
          changes.push(c.move(h, r.handle, index));
          detach(old);
        } else changes.push(c.attach(h, r.handle, index));
        list.splice(index, 0, id(h));
      });
    }
    for (const r of desired.values())
      if (!r.parent) {
        const old = this.accepted.get(id(r.handle));
        if (old?.parent) {
          changes.push(c.detach(r.handle));
          detach(old);
        }
      }
    for (const resource of this.acceptedResources)
      if (!wantedResources.has(resource))
        changes.push(c.releaseResource(this.resources.get(resource)!));
    return changes;
  }
  flush(): Promise<void> {
    this.ensure();
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.perform().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }
  private async perform(): Promise<void> {
    if (this.pending) {
      const pending = this.pending;
      const known = await this.view.queryCommitResult();
      if (known.status === p.statuses.notFound) await this.view.retryCommit();
      else if (known.status !== p.statuses.accepted) {
        this.pending = undefined;
        throw new EngineError(known.status, 'Widget transaction rejected', known);
      }
      this.adopt(pending.desired, pending.changes);
      this.pending = undefined;
    }
    for (const [resource, handle] of this.resources)
      if (!this.acceptedResources.has(resource)) {
        this.resources.delete(resource);
        this.freeResources.push(handle);
      }
    do {
      this.rerun = false;
      if (!this.root) return;
      this.building = true;
      this.used.clear();
      let desired: Map<string, NativeRecord>;
      try {
        this.tree = this.reconcile(this.root, this.tree, []);
        desired = this.records(this.tree);
        ++this.counters.builds;
      } finally {
        this.building = false;
      }
      for (const element of this.elements)
        if (!this.used.has(element) && element.active) {
          element.active = false;
          element.state?.deactivate();
          this.retired.add(element);
        }
      const changes = this.diff(desired);
      if (changes.length) {
        this.pending = { desired, changes };
        try {
          await this.view.commit(changes);
        } catch (error) {
          if (!(error instanceof EngineError) || error.status !== p.statuses.timedOut) {
            if (!this.view.hasPendingTransaction) this.pending = undefined;
            throw error;
          }
          const known = await this.view.queryCommitResult();
          if (known.status === p.statuses.notFound) await this.view.retryCommit();
          else if (known.status !== p.statuses.accepted)
            throw new EngineError(known.status, 'Widget transaction rejected', known);
        }
      }
      this.adopt(desired, changes);
      this.pending = undefined;
      for (const element of this.retired) {
        element.state?.dispose();
        if (element.state) element.state.element = undefined;
        if (element.widget.key instanceof GlobalKey && element.widget.key.element === element) {
          element.widget.key.element = undefined;
          this.globals.delete(element.widget.key);
        }
        if (element.handle && this.allocations.delete(element)) this.free.push(element.handle);
        this.elements.delete(element);
      }
      this.retired.clear();
    } while (this.rerun && !this.closed);
  }
  private adopt(desired: Map<string, NativeRecord>, changes: readonly Uint8Array[]): void {
    if (changes.length) {
      ++this.counters.transactions;
      this.counters.commands += changes.length;
      for (const change of changes) {
        const op = new DataView(change.buffer, change.byteOffset, change.byteLength).getUint16(
          0,
          true,
        );
        if (op === p.commands.create) ++this.counters.created;
        if (op === p.commands.destroy) ++this.counters.destroyed;
        if (op === p.commands.move) ++this.counters.moved;
      }
    }
    for (const [key, before] of this.accepted) {
      const after = desired.get(key);
      if (before.node.editor !== after?.node.editor) before.node.editor?.detach(this);
      if (!after) {
        this.free.push({ slot: before.handle.slot, generation: before.handle.generation + 1 });
        this.allocations.delete(before.element);
      }
    }
    const resources = new Set(
      [...desired.values()].flatMap((r) => (r.node.image ? [r.node.image] : [])),
    );
    for (const resource of this.acceptedResources)
      if (!resources.has(resource)) {
        const h = this.resources.get(resource)!;
        this.resources.delete(resource);
        this.freeResources.push({ slot: h.slot, generation: h.generation + 1 });
      }
    this.accepted = desired;
    this.acceptedResources = resources;
    for (const r of desired.values()) r.node.editor?.attach(this, r.handle);
  }
  async pollEvents(): Promise<void> {
    if (this.closed || this.polling) return;
    this.polling = true;
    try {
      const state = await this.view.pollInteractionEvents();
      for (const event of state.events) {
        const record = this.accepted.get(id(event.node));
        if (!record) continue;
        if (event.kind === p.events.editingChanged && record.node.editor)
          record.node.editor.publish(await this.view.editSnapshot(event.node));
        else if (event.kind === p.events.semanticAction) {
          const action = Object.entries(p.semanticsActions).find(
            ([, v]) => BigInt(v) === event.detail,
          )?.[0] as keyof typeof p.semanticsActions | undefined;
          if (action) record.node.options.onAction?.(action);
        }
      }
    } finally {
      this.polling = false;
    }
  }
  private pollSoon(): void {
    if (this.closed) return;
    this.eventTimer = setTimeout(() => {
      void this.pollEvents()
        .catch((error) => this.options.onError?.(error))
        .finally(() => this.pollSoon());
    }, 16);
  }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.eventTimer !== undefined) clearTimeout(this.eventTimer);
    await this.running;
    for (const r of this.accepted.values()) r.node.editor?.detach(this);
    for (const element of this.elements) {
      if (element.active) element.state?.deactivate();
      element.state?.dispose();
      if (element.state) element.state.element = undefined;
      if (element.widget.key instanceof GlobalKey && element.widget.key.element === element)
        element.widget.key.element = undefined;
    }
    this.elements.clear();
    this.globals.clear();
    this.accepted.clear();
    await this.view.close();
  }
}
