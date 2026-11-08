// SPDX-License-Identifier: BSD-3-Clause
import { protocol as p } from './schema.ts';
import type { NodeHandle, GestureEvent, SemanticProperties } from './codec.ts';
import type { EngineViewClient } from './client.ts';
import { engineFailures } from './lifecycle.ts';
import { Key, sameKey as equalKey } from '@nelyx/core/foundation/key';
export { Key, LocalKey, UniqueKey, ValueKey, ObjectKey, KeyMap } from '@nelyx/core/foundation/key';
import {
  SceneWriter,
  SceneNode,
  SceneReference,
  ImageResource,
  EditingController,
} from './scene.ts';
import type { SceneNodeOptions, EngineExecutionSnapshot } from './scene.ts';
export { ImageResource, EditingController } from './scene.ts';
export type { EngineExecutionSnapshot } from './scene.ts';
export interface NodeOptions extends SceneNodeOptions {
  readonly key?: Key;
}
export class GlobalKey<T extends State = State> extends Key {
  /** @internal */ element: Element | undefined;
  equals(other: Key): boolean {
    return this === other;
  }
  override get hashCode(): unknown {
    return this;
  }
  get currentState(): T | null {
    return (this.element?.active ? this.element.state : null) as T | null;
  }
  get currentNode(): NodeHandle | null {
    return this.element?.active ? firstNode(this.element) : null;
  }
}
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
  /** @internal */ disposed = false;
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
  activate(): void {}
  dispose(): void {}
  abstract build(context: BuildContext): Widget;
  setState(change: () => void): void {
    if (!this.element) throw new Error('setState after dispose');
    this.element.host.checkStateChange(this.element);
    const result: unknown = change();
    if (result && typeof (result as PromiseLike<unknown>).then === 'function')
      throw new Error('setState callback must be synchronous');
    this.element.host.schedule(this.element);
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
export class Directionality extends InheritedWidget {
  constructor(
    readonly direction: 'ltr' | 'rtl',
    child: Widget,
  ) {
    super(child);
  }
  updateShouldNotify(old: Directionality): boolean {
    return old.direction !== this.direction;
  }
  static of(context: BuildContext): 'ltr' | 'rtl' {
    return context.dependOn(Directionality)?.direction ?? 'ltr';
  }
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
  /** Declarative App-side style resolution; native layout never calls this hook. */
  resolveOptions(_context: BuildContext): NodeOptions {
    return this.options;
  }
  resolveTextColor(_context: BuildContext): number {
    return this.text?.color ?? 0;
  }
  resolveTextDirection(_context: BuildContext): 'ltr' | 'rtl' {
    return this.text?.direction ?? 'ltr';
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
export class GestureDetector extends NodeWidget {
  constructor(
    child: Widget,
    mask: number,
    onGesture: (event: GestureEvent) => void,
    options: NodeOptions = {},
  ) {
    super('box', [child], { ...options, gestures: mask, onGesture });
  }
}
export class Text extends NodeWidget {
  private readonly explicitDirection: boolean;
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
    this.explicitDirection = options.direction !== undefined;
  }
  resolveTextDirection(context: BuildContext): 'ltr' | 'rtl' {
    return this.explicitDirection ? this.text!.direction : Directionality.of(context);
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
      control: { kind: 'button' },
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
function sameKey(a: Key | undefined, b: Key | undefined): boolean {
  return equalKey(a ?? null, b ?? null);
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
  parent?: Element | undefined;
  initialized?: boolean;
  state?: State;
  context?: BuildContext;
  reference?: SceneReference;
  dependencies: Map<WidgetType<InheritedWidget>, InheritedWidget | null>;
}
function firstNode(e: Element): NodeHandle | null {
  return e.reference?.currentNode ?? (e.children[0] ? firstNode(e.children[0]) : null);
}
/** Temporary data-Widget frontend. Native transactions belong to SceneWriter. */
export class WidgetHost {
  private readonly scene: SceneWriter;
  get hasPendingImageResources(): boolean {
    return this.scene.hasPendingImageResources;
  }
  get retainedImageResources(): ReadonlySet<ImageResource> {
    return this.scene.retainedImageResources;
  }
  get counters(): SceneWriter['counters'] {
    return this.scene.counters;
  }
  get execution(): EngineExecutionSnapshot {
    const native = this.scene.execution;
    return Object.freeze({
      ...native,
      rejectedFallbacks: this.rejectedFallbacks,
      rejectionReasons: Object.freeze({ ...this.rejectionReasons }),
    });
  }
  private root: Widget | undefined;
  private tree: Element | undefined;
  private building = false;
  private lifecycleElement: Element | undefined;
  private closed = false;
  private scheduled = false;
  private elements = new Set<Element>();
  private retired = new Set<Element>();
  private globals = new Map<GlobalKey, Element>();
  private used = new Set<Element>();
  private running: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private rerun = false;
  private rejectedFallbacks = 0;
  private readonly rejectionReasons: Record<string, number> = {};
  constructor(
    readonly view: EngineViewClient,
    private readonly options: NonNullable<ConstructorParameters<typeof SceneWriter>[1]> = {},
  ) {
    this.scene = new SceneWriter(view, {
      ...options,
      onInvalidate: () => this.schedule(),
      onExecution: () => options.onExecution?.(this.execution),
    });
  }
  async mount(root: Widget): Promise<void> {
    this.ensure();
    if (this.root) throw Error('WidgetHost is already mounted');
    this.root = root;
    await this.flush();
  }
  update(root: Widget): Promise<void> {
    this.ensure();
    this.root = root;
    return this.flush();
  }
  private ensure(): void {
    if (this.closed) throw Error('WidgetHost is closed');
  }
  /** @internal */ checkStateChange(source: Element): void {
    this.ensure();
    if (this.building && this.lifecycleElement !== source) throw new Error('setState during build');
  }
  /** @internal */ schedule(source?: Element): void {
    this.ensure();
    if (this.building) {
      if (source && this.lifecycleElement === source) return;
      throw new Error('setState during build');
    }
    if (this.scheduled) return;
    this.scheduled = true;
    void Promise.resolve()
      .then(() => {
        this.scheduled = false;
        if (!this.closed) return this.flush();
      })
      .catch((error) => {
        if (!this.closed) this.options.onError?.(error);
      });
  }
  private reconcile(
    widget: Widget,
    previous: Element | undefined,
    inherited: readonly InheritedWidget[],
    depth = 0,
    parent?: Element,
    reparenting = false,
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
        element.reference = new SceneReference();
      }
      if (widget instanceof StatefulWidget) {
        const state = widget.createState();
        if (state.element || state.disposed)
          throw new Error('State is already mounted or disposed');
        element.state = state;
        state.element = element;
      }
    }
    const reactivate =
      !!element.context && (reparenting || element.parent !== parent || !element.active);
    if (reactivate && element.active) {
      element.active = false;
      element.state?.deactivate();
    }
    element.parent = parent;
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
    let dependenciesChanged = !element.context || reactivate;
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
      this.lifecycleElement = element;
      try {
        if (!element.initialized) {
          element.initialized = true;
          state.initState();
        } else {
          if (reactivate) state.activate();
          if (old !== widget) state.didUpdateWidget(old as StatefulWidget);
        }
        if (dependenciesChanged) state.didChangeDependencies();
      } finally {
        this.lifecycleElement = undefined;
      }
      children = [state.build(element.context)];
    } else {
      ++this.rejectedFallbacks;
      this.rejectionReasons.unsupportedWidget = (this.rejectionReasons.unsupportedWidget ?? 0) + 1;
      throw new Error('Unsupported v2 Widget type; TypeScript renderer fallback is forbidden');
    }
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
        element,
        reactivate,
      ),
    );
    return element;
  }
  private snapshot(element: Element): SceneNode[] {
    const node = element.widget,
      children = element.children.flatMap((child) => this.snapshot(child));
    if (!(node instanceof NodeWidget)) return children;
    return [
      new SceneNode(
        element.reference!,
        node.kind,
        children,
        node.resolveOptions(element.context!),
        node.text
          ? {
              ...node.text,
              color: node.resolveTextColor(element.context!),
              direction: node.resolveTextDirection(element.context!),
            }
          : undefined,
        node.image,
        node.editor,
        node.editorFlags,
        node.maximumLength,
      ),
    ];
  }
  flush(): Promise<void> {
    this.ensure();
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = Promise.resolve()
      .then(() => this.perform())
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
  private async perform(): Promise<void> {
    do {
      this.rerun = false;
      if (!this.root) return;
      this.building = true;
      this.used.clear();
      let desired: SceneNode;
      const saved = new Map(
        [...this.elements].map((element) => [
          element,
          {
            ...element,
            dependencies: new Map(element.dependencies),
          },
        ]),
      );
      const globals = new Map(this.globals),
        retired = new Set(this.retired);
      try {
        const tree = this.reconcile(this.root, this.tree, []);
        const roots = this.snapshot(tree);
        if (roots.length !== 1) throw Error('WidgetHost requires one render root');
        desired = roots[0]!;
        this.tree = tree;
      } catch (error) {
        const errors: unknown[] = [error];
        for (const element of this.elements)
          if (!saved.has(element)) this.disposeElement(element, errors);
        for (const key of this.globals.keys())
          if (key.element?.host === this) key.element = undefined;
        for (const [element, value] of saved) Object.assign(element, value);
        this.elements = new Set(saved.keys());
        this.globals = globals;
        for (const [key, element] of globals) key.element = element;
        this.retired = retired;
        if (errors.length > 1) throw new AggregateError(errors, 'Widget build and cleanup failed');
        throw error;
      } finally {
        this.lifecycleElement = undefined;
        this.building = false;
      }
      const lifecycleErrors: unknown[] = [];
      for (const element of this.elements)
        if (!this.used.has(element) && element.active) {
          element.active = false;
          this.retired.add(element);
          try {
            element.state?.deactivate();
          } catch (error) {
            lifecycleErrors.push(error);
          }
        }
      await this.scene.update(desired);
      const errors: unknown[] = lifecycleErrors;
      for (const element of this.retired) {
        this.disposeElement(element, errors);
        this.elements.delete(element);
      }
      this.retired.clear();
      if (errors.length) throw new AggregateError(errors, 'Widget disposal failed');
    } while (this.rerun && !this.closed);
  }
  private disposeElement(element: Element, errors: unknown[]): void {
    const active = element.active;
    element.active = false;
    if (active) {
      try {
        element.state?.deactivate();
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      element.state?.dispose();
    } catch (error) {
      errors.push(error);
    } finally {
      if (element.state) {
        element.state.element = undefined;
        element.state.disposed = true;
      }
      const key = element.widget.key;
      if (key instanceof GlobalKey && key.element === element) {
        key.element = undefined;
        if (this.globals.get(key) === element) this.globals.delete(key);
      }
    }
  }
  notifyFocusPeer(node: NodeHandle): void {
    this.scene.notifyFocusPeer(node);
  }
  pollEvents(): Promise<void> {
    return this.scene.pollEvents();
  }
  async stop(): Promise<void> {
    this.closed = true;
    await this.scene.stop();
    await this.running;
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closing = this.disposeHost();
    return this.closing;
  }
  private async disposeHost(): Promise<void> {
    const errors: unknown[] = [];
    try {
      await this.stop();
    } catch (error) {
      errors.push(error);
    }
    for (const element of this.elements) this.disposeElement(element, errors);
    this.elements.clear();
    this.used.clear();
    this.retired.clear();
    this.globals.clear();
    this.tree = this.root = undefined;
    try {
      await this.scene.close();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw engineFailures('WidgetHost close failed', errors);
  }
}
