// SPDX-License-Identifier: BSD-3-Clause
import { commands as c, protocol as p, eventValue } from './codec.ts';
import type {
  NodeHandle,
  NodeLayout,
  NodeProperties,
  AxisBound,
  SemanticProperties,
  EditingSnapshot,
  EditingUpdate,
  ListOptions,
  EditorViewportOptions,
  EngineResponse,
  EngineNodeSnapshot,
  ControlOptions,
  GestureEvent,
  RawInputSample,
  PointerSample,
  TooltipPositionOptions,
  IntrinsicSizingOptions,
  EngineEvent,
  GraphicsOptions,
  ParagraphOptions,
  ClipStyleOptions,
  LayerLinkOptions,
  NativeTapRegionOptions,
} from './codec.ts';
import { EngineError } from './client.ts';
import { engineFailures } from './lifecycle.ts';
import type { EngineViewClient } from './client.ts';
import type { NativePaintOptions } from './native-paint.ts';
import type { ImageStyleOptions } from './image-style.ts';
import type { NativeSnapshotConfiguration } from './snapshot.ts';
import type { LayoutBuilderOptions } from './layout-builder.ts';
import type { NativeLayoutProgram } from '@nelyx/core/framework/rendering/object';
export class ImageResource {
  readonly bytes: Uint8Array;
  constructor(bytes: Uint8Array) {
    this.bytes = bytes.slice();
  }
}
export interface SceneNodeOptions {
  readonly layoutProgram?: NativeLayoutProgram;
  readonly childAnchor?: readonly [number, number, number, number, number, number];
  readonly intrinsicSizing?: IntrinsicSizingOptions;
  readonly tooltipPosition?: TooltipPositionOptions;
  readonly snapshot?: NativeSnapshotConfiguration;
  readonly layoutBuilder?: LayoutBuilderOptions;
  readonly tapRegion?: NativeTapRegionOptions | (() => NativeTapRegionOptions);
  readonly onTapRegion?: (event: EngineEvent) => void;
  readonly imageStyle?: ImageStyleOptions | null;
  readonly layerLink?: LayerLinkOptions | (() => LayerLinkOptions);
  readonly nativeFocus?: { readonly enabled: boolean; readonly skipTraversal: boolean };
  readonly canonicalKeyboard?: boolean;
  readonly onKey?: (event: EngineEvent) => void;
  /** Source policy only. Content resolves boundaries, blocking and annotation merging. */
  readonly semanticsPolicy?: {
    readonly boundary?: boolean;
    readonly blockPrevious?: boolean;
    readonly mergeDescendants?: boolean;
    readonly mergeIntoParent?: boolean;
    readonly excludeChildren?: boolean;
    readonly blockActions?: boolean;
    readonly explicitChildren?: boolean;
    readonly forceMergeDescendants?: boolean;
  };
  readonly nativePaint?: readonly NativePaintOptions[];
  readonly paintPlacement?: import('./paint-placement.ts').PaintPlacementOptions;
  readonly paragraphFont?: Pick<
    import('./font-resource.ts').FontResourceBinding,
    'resource' | 'fontRevision'
  >;
  readonly paragraph?: ParagraphOptions;
  /** Explicit App geometry boundary: all descendant nodes must declare both finite sizes. */
  readonly appDrivenGeometry?: boolean;
  readonly nativeSparkline?: {
    readonly width: number;
    readonly height: number;
    readonly values: readonly number[];
  };
  readonly graphics?: GraphicsOptions;
  readonly clipStyle?: ClipStyleOptions;
  readonly onScrollTerminal?: (event: EngineEvent) => void;
  readonly onRawInput?: (sample: RawInputSample) => void;
  readonly onPointerSample?: (sample: PointerSample) => void;
  readonly onRawGap?: (first: bigint, last: bigint) => void;
  /** App response required for each sample; one outstanding request/stream, 100 ms timeout. */
  readonly appControlled?: (sample: RawInputSample) => boolean | PromiseLike<boolean>;
  readonly modal?: boolean;
  /** Canonical RenderBox hit policy; omitted preserves the data API's existing hit geometry. */
  readonly pointerHitTest?: 'proxy' | 'self' | 'deferToChild' | 'translucent';
  readonly pointerBlock?: 'ignore' | 'absorb';
  readonly canonicalGestures?: boolean;
  readonly dragStartDown?: boolean;
  readonly freePan?: boolean;
  readonly dragThreshold?: boolean;
  readonly mouseRegion?: { readonly opaque: boolean; readonly exclusive?: boolean };
  readonly roundedHitTest?: boolean;
  readonly onFocusChanged?: (focused: boolean, event?: EngineEvent) => void;
  readonly gestures?: number;
  readonly gestureDevices?: number;
  readonly control?: ControlOptions;
  readonly onGesture?: (event: GestureEvent) => void;
  readonly onValue?: (value: number, second: number) => void;
  readonly list?: ListOptions;
  readonly editorViewport?: EditorViewportOptions;
  readonly listItem?: { readonly index: number; readonly key: bigint };
  readonly onLayout?: (node: EngineNodeSnapshot, snapshot: EngineResponse) => void;
  readonly properties?: NodeProperties;
  readonly layout?: NodeLayout | false;
  readonly horizontal?: AxisBound;
  readonly vertical?: AxisBound;
  readonly color?: number;
  readonly radius?: number;
  readonly semantics?: SemanticProperties;
  readonly onAction?: (action: keyof typeof p.semanticsActions, event?: EngineEvent) => void;
  readonly motion?: {
    readonly id: bigint;
    readonly revision?: bigint;
    readonly opacity: number;
    readonly seconds: number;
  };
}
/** Core owns the value after attachment. Programmatic writes require an explicit revision. */
export class EditingController {
  private binding: { host: SceneWriter; node: NodeHandle } | undefined;
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
  /** @internal */ attach(host: SceneWriter, node: NodeHandle): void {
    if (this.binding && (this.binding.host !== host || id(this.binding.node) !== id(node)))
      throw new Error('An EditingController may attach to one editor');
    this.binding = { host, node };
  }
  /** @internal */ detach(host: SceneWriter): void {
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
export interface SceneText {
  readonly value: string;
  readonly size: number;
  readonly color: number;
  readonly direction: 'ltr' | 'rtl';
}
/** Stable native handle reference. It has no Widget or lifecycle semantics. */
export class SceneReference {
  private binding: { writer: SceneWriter; node: NodeHandle } | undefined;
  get currentNode(): NodeHandle | null {
    return this.binding?.node ?? null;
  }
  /** @internal */ bind(writer: SceneWriter, node: NodeHandle): void {
    if (this.binding && this.binding.writer !== writer)
      throw Error('A scene reference belongs to another writer');
    this.binding = { writer, node };
  }
  /** @internal */ release(writer: SceneWriter, node?: NodeHandle): void {
    if (this.binding?.writer === writer && (!node || id(this.binding.node) === id(node)))
      this.binding = undefined;
  }
}
/** Engine document configuration, never a second UI tree. */
export class SceneNode {
  constructor(
    readonly reference: SceneReference,
    readonly kind: keyof typeof p.kinds,
    readonly children: readonly SceneNode[] = [],
    readonly options: SceneNodeOptions = {},
    readonly text?: SceneText,
    readonly image?: ImageResource,
    readonly editor?: EditingController,
    readonly editorFlags = 0,
    readonly maximumLength: number = p.limits.textBytes,
  ) {}
}
function id(h: NodeHandle): string {
  return `${h.slot}:${h.generation}`;
}
const commandKind = (bytes: Uint8Array) => bytes[0]! | (bytes[1]! << 8);
interface NativeRecord {
  readonly node: SceneNode;
  readonly handle: NodeHandle;
  readonly parent: NodeHandle | null;
  readonly children: readonly NodeHandle[];
  readonly config: readonly Uint8Array[];
}
export interface EngineExecutionSnapshot {
  readonly selected: 'engine-v2-cpp';
  readonly fallbackPolicy: 'reject-unported';
  /** True only after a transaction ACK, never inferred from the selected option. */
  readonly observed: boolean;
  readonly acknowledgedTransactions: number;
  readonly acknowledgedCommands: number;
  readonly appGeometryNodes: number;
  readonly rejectedFallbacks: number;
  readonly rejectionReasons: Readonly<Record<string, number>>;
}
const equalBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((n, i) => n === b[i]);

/** ACK-based engine document writer shared by all App producers. */
export class SceneWriter {
  get hasPendingImageResources(): boolean {
    return (
      !!this.uploading || [...this.uploadedResources].some((r) => !this.acceptedResources.has(r))
    );
  }
  get retainedImageResources(): ReadonlySet<ImageResource> {
    const resources = new Set([...this.resources.keys(), ...this.acceptedResources]);
    if (this.uploading) resources.add(this.uploading.resource);
    // Rejected producer input can still be the desired root. Resource
    // retirement must remain readable even when that graph has a cycle or
    // exceeds the native depth budget.
    const pending = this.root ? [this.root] : [];
    const visited = new Set<SceneNode>();
    while (pending.length) {
      const node = pending.pop()!;
      if (visited.has(node)) continue;
      visited.add(node);
      if (node.image) resources.add(node.image);
      for (const child of node.children) pending.push(child);
    }
    return resources;
  }
  private rawSubscribed = false;
  private root: SceneNode | undefined;
  private mounted = false;
  private eventsStarted = false;
  private closed = false;
  private accepted = new Map<string, NativeRecord>();
  private handles = new Map<SceneReference, { kind: SceneNode['kind']; handle: NodeHandle }>();
  private allocations = new Map<string, { reference: SceneReference; handle: NodeHandle }>();
  private free: NodeHandle[] = [];
  private nextSlot = 0;
  private resources = new Map<ImageResource, NodeHandle>();
  private acceptedResources = new Set<ImageResource>();
  private uploadedResources = new Set<ImageResource>();
  private nextImageUpload = 0n;
  private uploading:
    | { resource: ImageResource; handle: NodeHandle; token: bigint; bytes: Uint8Array }
    | undefined;
  private pending:
    | { desired: Map<string, NativeRecord>; changes: readonly Uint8Array[] }
    | undefined;
  private running: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private rerun = false;
  private eventTimer: ReturnType<typeof setTimeout> | undefined;
  private polling = false;
  private focusHandle = '';
  private focusCallback: SceneNodeOptions['onFocusChanged'];
  private semanticPublication: EngineResponse | undefined;
  private semanticState: EngineResponse | undefined;
  private appGeometryNodes = 0;
  private readonly controlRevisions = new Map<string, bigint>();
  readonly counters = {
    builds: 0,
    transactions: 0,
    commands: 0,
    created: 0,
    destroyed: 0,
    moved: 0,
    gestures: 0,
    controls: 0,
  };
  get execution(): EngineExecutionSnapshot {
    return Object.freeze({
      selected: 'engine-v2-cpp',
      fallbackPolicy: 'reject-unported',
      observed: this.counters.transactions > 0,
      acknowledgedTransactions: this.counters.transactions,
      acknowledgedCommands: this.counters.commands,
      appGeometryNodes: this.appGeometryNodes,
      rejectedFallbacks: 0,
      rejectionReasons: Object.freeze({}),
    });
  }
  constructor(
    readonly view: EngineViewClient,
    private readonly options: {
      onInvalidate?: () => void;
      onError?: (error: unknown) => void;
      pollEvents?: boolean;
      /** Core observations share the existing bounded event poll. */
      onState?: (state: EngineResponse) => void;
      onPublication?: (state: EngineResponse) => void;
      /** The frontend runs its Source listeners before the accepted node callback. */
      onSemanticAction?: (event: EngineEvent, perform: () => void) => void;
      /** Source input callbacks share the frontend's focus/key mailbox. */
      onInputEvent?: (event: EngineEvent, perform: () => void) => void;
      onAfterEvents?: () => void;
      onAppFrame?: (timestampSeconds: number, serial: bigint) => void;
      /** Published only after adoption of a known native ACK, including ACK recovery. */
      onExecution?: (execution: EngineExecutionSnapshot) => void;
    } = {},
  ) {}
  async mount(root: SceneNode): Promise<void> {
    if (this.mounted) throw new Error('SceneWriter is already mounted');
    this.ensure();
    this.mounted = true;
    this.root = root;
    await this.flush();
    this.startEvents();
  }
  update(root: SceneNode): Promise<void> {
    this.ensure();
    this.mounted = true;
    this.root = root;
    const result = this.flush();
    void result.then(
      () => this.startEvents(),
      () => {},
    );
    return result;
  }
  private startEvents(): void {
    if (this.eventsStarted || this.closed || this.options.pollEvents === false) return;
    this.eventsStarted = true;
    this.pollSoon();
  }
  private schedule(): void {
    this.options.onInvalidate?.();
  }
  private ensure(): void {
    if (this.closed) throw new Error('SceneWriter is closed');
  }
  private allocate(): NodeHandle {
    const h = this.free.pop();
    if (h) return h;
    if (this.nextSlot >= p.limits.nodes)
      throw new EngineError(p.statuses.budgetExceeded, 'Scene node budget');
    return { slot: ++this.nextSlot, generation: 1 };
  }
  private records(root: SceneNode): Map<string, NativeRecord> {
    const records = new Map<string, NativeRecord>();
    const seen = new Set<SceneReference>();
    const allocate = (node: SceneNode, depth: number): void => {
      if (depth > p.limits.depth || seen.size >= p.limits.nodes)
        throw Error('Scene node/depth budget');
      if (seen.has(node.reference)) throw Error('Duplicate scene reference');
      seen.add(node.reference);
      let binding = this.handles.get(node.reference);
      if (!binding || binding.kind !== node.kind) {
        const handle = this.allocate();
        binding = { kind: node.kind, handle };
        this.handles.set(node.reference, binding);
        this.allocations.set(id(handle), { reference: node.reference, handle });
      }
      node.reference.bind(this, binding.handle);
      for (const child of node.children) allocate(child, depth + 1);
    };
    allocate(root, 0);
    const visit = (
      node: SceneNode,
      parent: NodeHandle | null,
      appGeometry = false,
    ): NodeHandle[] => {
      const h = this.handles.get(node.reference)!.handle,
        o = node.options;
      appGeometry ||= !!o.appDrivenGeometry;
      if (appGeometry) ++this.appGeometryNodes;
      if (
        appGeometry &&
        (!Number.isFinite(o.properties?.width) || !Number.isFinite(o.properties?.height))
      )
        throw new Error(
          'AppDrivenBoundary requires explicit finite width and height on every node',
        );
      const children = node.children.flatMap((child) => visit(child, h, appGeometry));
      const config = [
        c.properties(h, o.properties ?? {}),
        c.paint(h, o.color ?? 0, o.radius ?? 0),
        c.layout(h, appGeometry || o.layout === false ? { enabled: false } : (o.layout ?? {})),
        c.constraints(
          h,
          o.horizontal ?? { kind: 'unbounded' },
          o.vertical ?? { kind: 'unbounded' },
        ),
      ];
      const before = this.accepted.get(id(h));
      const optional = (enabled: unknown, command: Uint8Array) => {
        const previous = before?.config.find(
          (value) => commandKind(value) === commandKind(command),
        );
        // Never spend a command on an absent default. An explicit reset is
        // retained until ACK; NACK/retry still sees the old immutable bytes.
        if (enabled || (previous && !equalBytes(previous, command))) config.push(command);
      };
      if (node.text)
        config.push(
          c.text(
            h,
            node.editor && this.accepted.has(id(h)) ? '' : node.text.value,
            node.text.size,
            node.text.color,
            {
              direction: node.text.direction,
              ...(node.editor && this.accepted.has(id(h)) ? { styleOnly: true } : {}),
            },
          ),
        );
      if (node.kind === 'paragraph' || node.kind === 'editable')
        config.push(
          c.paragraphOptions(h, o.paragraph ?? null),
          c.paragraphFont(h, o.paragraphFont),
        );
      else if (o.paragraph) throw Error('Paragraph options require a native paragraph node');
      else if (o.paragraphFont) throw Error('Paragraph fonts require a native paragraph node');
      if (node.kind === 'clip') config.push(c.clipStyle(h, o.clipStyle ?? null));
      else if (o.clipStyle) throw Error('Clip styles require a native clip node');
      if (node.editor)
        config.push(c.editor(h, node.editorFlags, node.maximumLength, o.editorViewport));
      optional(o.semantics, c.semantics(h, o.semantics ?? null));
      if (node.kind === 'sliver') config.push(c.list(h, o.list ?? null));
      optional(o.graphics, c.graphics(h, o.graphics));
      optional(o.nativePaint?.length, c.nativePaint(h, o.nativePaint));
      optional(o.paintPlacement, c.paintPlacement(h, o.paintPlacement));
      optional(
        o.layerLink,
        c.layerLink(h, typeof o.layerLink === 'function' ? o.layerLink() : o.layerLink),
      );
      optional(
        o.tapRegion,
        c.tapRegion(h, typeof o.tapRegion === 'function' ? o.tapRegion() : o.tapRegion),
      );
      optional(o.snapshot, c.snapshot(h, o.snapshot));
      optional(o.layoutBuilder, c.layoutBuilder(h, o.layoutBuilder));
      optional(o.tooltipPosition, c.tooltipPosition(h, o.tooltipPosition));
      optional(o.childAnchor, c.childAnchor(h, o.childAnchor));
      optional(o.intrinsicSizing, c.intrinsicSizing(h, o.intrinsicSizing));
      optional(o.layoutProgram, c.layoutProgram(h, o.layoutProgram));
      if (o.nativeSparkline)
        config.push(
          c.nativeExtension(
            h,
            o.nativeSparkline.width,
            o.nativeSparkline.height,
            o.nativeSparkline.values,
          ),
        );
      optional(o.listItem, c.listItem(h, o.listItem ?? null));
      optional(o.gestures, c.gesture(h, o.gestures ?? 0, o.gestureDevices));
      optional(
        o.control,
        c.control(
          h,
          o.control
            ? {
                ...o.control,
                revision: o.control.revision ?? this.controlRevisions.get(id(h)) ?? 0n,
              }
            : null,
        ),
      );
      config.push(
        c.eventPolicy(
          h,
          (o.onRawInput ? p.eventPolicies.observeRaw : 0) |
            (o.appControlled ? p.eventPolicies.appControlled : 0) |
            (o.modal ? p.eventPolicies.modal : 0) |
            (o.pointerHitTest ? p.eventPolicies.canonicalHitTest : 0) |
            (o.canonicalGestures ? p.eventPolicies.canonicalGestures : 0) |
            (o.dragStartDown ? p.eventPolicies.dragStartDown : 0) |
            (o.freePan ? p.eventPolicies.freePan : 0) |
            (o.dragThreshold ? p.eventPolicies.dragThreshold : 0) |
            (o.mouseRegion ? p.eventPolicies.mouseRegion : 0) |
            (o.onPointerSample ? p.eventPolicies.pointerListener : 0) |
            (o.mouseRegion?.opaque ? p.eventPolicies.mouseOpaque : 0) |
            (o.mouseRegion?.exclusive ? p.eventPolicies.exclusiveMouseRegion : 0) |
            (o.roundedHitTest ? p.eventPolicies.roundedHitTest : 0) |
            (o.nativeFocus ? p.eventPolicies.focusOwner : 0) |
            (o.nativeFocus?.enabled ? p.eventPolicies.focusEnabled : 0) |
            (o.nativeFocus?.skipTraversal ? p.eventPolicies.skipTraversal : 0) |
            (o.canonicalKeyboard ? p.eventPolicies.canonicalKeyboard : 0) |
            (o.semanticsPolicy?.boundary ? p.eventPolicies.semanticsBoundary : 0) |
            (o.semanticsPolicy?.blockPrevious ? p.eventPolicies.blockPreviousSemantics : 0) |
            (o.semanticsPolicy?.mergeDescendants ? p.eventPolicies.mergeSemanticsDescendants : 0) |
            (o.semanticsPolicy?.mergeIntoParent ? p.eventPolicies.mergeSemanticsIntoParent : 0) |
            (o.semanticsPolicy?.excludeChildren ? p.eventPolicies.excludeChildSemantics : 0) |
            (o.semanticsPolicy?.blockActions ? p.eventPolicies.blockSemanticActions : 0) |
            (o.semanticsPolicy?.explicitChildren ? p.eventPolicies.explicitChildSemantics : 0) |
            (o.semanticsPolicy?.forceMergeDescendants ? p.eventPolicies.forceMergeSemantics : 0) |
            (o.pointerBlock === 'ignore' ? p.eventPolicies.ignorePointer : 0) |
            (o.pointerBlock === 'absorb' ? p.eventPolicies.absorbPointer : 0) |
            (o.pointerHitTest === 'self' ? p.eventPolicies.hitTestSelf : 0) |
            (o.pointerHitTest === 'deferToChild' ? p.eventPolicies.deferToChild : 0) |
            (o.pointerHitTest === 'translucent' ? p.eventPolicies.translucent : 0),
        ),
      );
      if (node.kind === 'image') {
        let resource = node.image ? this.resources.get(node.image) : undefined;
        if (node.image && !resource) {
          resource = this.view.allocateResource();
          this.resources.set(node.image, resource);
        }
        config.push(c.bindResource(h, resource ?? null));
        if (
          o.imageStyle !== undefined ||
          this.accepted.get(id(h))?.node.options.imageStyle !== undefined
        )
          config.push(c.imageStyle(h, o.imageStyle ?? null));
      }
      if (o.motion)
        config.push(
          c.motion(h, o.motion.id, o.motion.revision ?? 0n, o.motion.opacity, o.motion.seconds),
        );
      records.set(id(h), { node, handle: h, parent, children, config });
      return [h];
    };
    const roots = visit(root, null);
    if (roots.length !== 1) throw new Error('SceneWriter requires one render root');
    return records;
  }
  private diff(desired: Map<string, NativeRecord>): Uint8Array[] {
    const changes: Uint8Array[] = [],
      wantedResources = new Set(
        [...desired.values()].flatMap((r) => (r.node.image ? [r.node.image] : [])),
      );
    for (const resource of wantedResources)
      if (!this.acceptedResources.has(resource) && !this.uploadedResources.has(resource))
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
        detach(r);
      }
    for (const r of [...this.accepted.values()].reverse())
      if (!desired.has(id(r.handle))) changes.push(c.destroy(r.handle, !!r.parent));
    const preorder: NativeRecord[] = [],
      indices = new Map<string, number>(),
      creationFlags = new Map<string, number>(),
      attached = new Set<string>();
    const visit = (record: NativeRecord): void => {
      preorder.push(record);
      record.children.forEach((child, index) => {
        indices.set(id(child), index);
        visit(desired.get(id(child))!);
      });
    };
    for (const record of desired.values()) if (!record.parent) visit(record);
    // Parents precede new children so construction can also place one child.
    // Configuration follows all creation; paint/reference targets then exist.
    for (const r of preorder) {
      const before = this.accepted.get(id(r.handle));
      let initialFlags = 0;
      if (!before) {
        const layout = r.config.find((value) => commandKind(value) === p.commands.layout),
          policy = r.config.find((value) => commandKind(value) === p.commands.eventPolicy);
        if (layout && equalBytes(layout, c.layout(r.handle)))
          initialFlags |= p.nodeCreationFlags.layoutEnabled;
        else if (layout && equalBytes(layout, c.layout(r.handle, { childConstraints: 'inherit' })))
          initialFlags |=
            p.nodeCreationFlags.layoutEnabled | p.nodeCreationFlags.inheritChildConstraints;
        if (policy && equalBytes(policy, c.eventPolicy(r.handle, p.eventPolicies.canonicalHitTest)))
          initialFlags |= p.nodeCreationFlags.canonicalHitTest;
        creationFlags.set(id(r.handle), initialFlags);
        const siblings = r.parent ? topology.get(id(r.parent))! : undefined,
          index = siblings ? Math.min(indices.get(id(r.handle))!, siblings.length) : 0;
        changes.push(
          c.create(
            r.handle,
            r.node.kind,
            initialFlags,
            r.parent ? { parent: r.parent, index } : undefined,
          ),
        );
        if (siblings) {
          siblings.splice(index, 0, id(r.handle));
          attached.add(id(r.handle));
        }
        topology.set(id(r.handle), []);
      }
    }
    for (const r of desired.values()) {
      const before = this.accepted.get(id(r.handle)),
        initialFlags = creationFlags.get(id(r.handle)) ?? 0;
      // Creation already establishes these exact Core defaults. Keep their
      // immutable records for later resets, while omitting redundant writes
      // from the atomic transaction (large route replacement uses this path).
      const initial = before
        ? undefined
        : [
            c.properties(r.handle, {}),
            c.paint(r.handle, 0),
            c.constraints(r.handle, { kind: 'unbounded' }, { kind: 'unbounded' }),
            c.layout(r.handle, {
              enabled: !!(initialFlags & p.nodeCreationFlags.layoutEnabled),
              childConstraints:
                initialFlags & p.nodeCreationFlags.inheritChildConstraints ? 'inherit' : 'loose',
            }),
            c.eventPolicy(
              r.handle,
              initialFlags & p.nodeCreationFlags.canonicalHitTest
                ? p.eventPolicies.canonicalHitTest
                : 0,
            ),
          ];
      r.config.forEach((config) => {
        const previous = (before?.config ?? initial)?.find(
          (value) => commandKind(value) === commandKind(config),
        );
        if (!previous || !equalBytes(config, previous)) changes.push(config);
      });
    }
    // Every parent exists. Populate siblings in declaration order against the
    // topology produced by preceding moves, including cross-parent moves.
    for (const r of desired.values()) {
      const list = topology.get(id(r.handle))!;
      r.children.forEach((h, index) => {
        const old = this.accepted.get(id(h));
        if (
          ((old?.parent && id(old.parent) === id(r.handle)) || attached.has(id(h))) &&
          list.indexOf(id(h)) === index
        )
          return;
        if (old?.parent || attached.has(id(h))) {
          changes.push(c.move(h, r.handle, index));
          detach(old ?? desired.get(id(h))!);
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
    this.running = Promise.resolve()
      .then(() => this.perform())
      .finally(() => {
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
        throw new EngineError(known.status, 'Scene transaction rejected', known);
      }
      this.adopt(pending.desired, pending.changes);
      this.pending = undefined;
    }
    // An ambiguous upload owns its slot and snapshot until replay proves its
    // terminal. Never recycle a candidate on transport failure alone.
    if (this.uploading) await this.uploadImage(this.uploading);
    do {
      this.rerun = false;
      if (!this.root) return;
      this.appGeometryNodes = 0;
      const handles = new Map(this.handles),
        allocations = new Map(this.allocations),
        free = [...this.free],
        nextSlot = this.nextSlot,
        resources = new Map(this.resources);
      let desired: Map<string, NativeRecord>;
      try {
        desired = this.records(this.root);
        ++this.counters.builds;
      } catch (error) {
        for (const reference of this.handles.keys()) reference.release(this);
        this.handles = handles;
        this.allocations = allocations;
        this.free = free;
        this.nextSlot = nextSlot;
        for (const [reference, binding] of handles) reference.bind(this, binding.handle);
        for (const [resource, handle] of this.resources)
          if (!resources.has(resource)) this.view.recycleResource(handle, false);
        this.resources = resources;
        throw error;
      }
      const wanted = new Set(
        [...desired.values()].flatMap((record) => (record.node.image ? [record.node.image] : [])),
      );
      for (const [resource, handle] of this.resources)
        if (!this.acceptedResources.has(resource) && !wanted.has(resource)) {
          if (this.uploadedResources.has(resource)) {
            await this.imageRetry(() => this.view.releaseImageResource(handle));
            this.uploadedResources.delete(resource);
            this.view.recycleResource(handle, true);
          } else this.view.recycleResource(handle, false);
          this.resources.delete(resource);
        }
      // Keep ordinary small transactions atomic. Stream when the combined
      // payload could consume the document packet; no image bytes then enter it.
      const candidates = [...wanted].filter((resource) => !this.acceptedResources.has(resource));
      if (
        candidates.reduce((total, resource) => total + resource.bytes.length, 0) >
        p.limits.imageChunkBytes
      ) {
        for (const resource of candidates) {
          if (this.closed) throw Error('SceneWriter closed during image upload');
          if (this.uploadedResources.has(resource)) continue;
          if (!resource.bytes.length || resource.bytes.length > p.limits.resourceBytes)
            throw Error('Image resource exceeds the byte budget');
          const upload = {
            resource,
            handle: this.resources.get(resource)!,
            token: ++this.nextImageUpload,
            bytes: resource.bytes.slice(),
          };
          this.uploading = upload;
          await this.uploadImage(upload);
        }
      }
      const changes = this.diff(desired);
      if (changes.length > p.limits.commands) {
        const kinds = new Map<number, number>();
        for (const change of changes) {
          const kind = commandKind(change);
          kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
        }
        throw new RangeError(
          `Scene command budget ${changes.length}/${p.limits.commands} for ${desired.size} nodes: ` +
            [...kinds].map(([kind, count]) => `${kind}=${count}`).join(','),
        );
      }
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
            throw new EngineError(known.status, 'Scene transaction rejected', known);
        }
      }
      this.adopt(desired, changes);
      if (!this.rawSubscribed && [...desired.values()].some((r) => r.node.options.onRawInput)) {
        await this.view.subscribeRaw();
        this.rawSubscribed = true;
      }
      this.pending = undefined;
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
        this.controlRevisions.delete(key);
      }
    }
    for (const [key, allocation] of this.allocations) {
      if (desired.has(key)) continue;
      const { reference, handle } = allocation;
      this.free.push({
        slot: handle.slot,
        generation: handle.generation + (this.accepted.has(key) ? 1 : 0),
      });
      if (this.handles.get(reference)?.handle === handle) {
        this.handles.delete(reference);
        reference.release(this, handle);
      }
      this.allocations.delete(key);
    }
    const resources = new Set(
      [...desired.values()].flatMap((r) => (r.node.image ? [r.node.image] : [])),
    );
    for (const resource of this.acceptedResources)
      if (!resources.has(resource)) {
        const h = this.resources.get(resource)!;
        this.resources.delete(resource);
        this.uploadedResources.delete(resource);
        this.view.recycleResource(h, true);
      }
    this.accepted = desired;
    this.acceptedResources = resources;
    for (const r of desired.values()) r.node.editor?.attach(this, r.handle);
    if (changes.length) {
      try {
        this.options.onExecution?.(this.execution);
      } catch (error) {
        this.options.onError?.(error);
      }
    }
  }
  private async imageRetry<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof EngineError && error.result && error.status !== p.statuses.timedOut)
        throw error;
      return operation();
    }
  }
  private async uploadImage(upload: NonNullable<SceneWriter['uploading']>): Promise<void> {
    const { resource, handle, token, bytes } = upload,
      state = await this.imageRetry(() => this.view.beginImageUpload(handle, bytes.length, token));
    if (state.phase !== 'committed') {
      for (let offset = state.filled; offset < bytes.length; offset += p.limits.imageChunkBytes) {
        if (this.closed) throw Error('SceneWriter closed during image upload');
        const chunk = bytes.subarray(offset, offset + p.limits.imageChunkBytes);
        await this.imageRetry(() => this.view.appendImageUpload(token, offset, chunk));
      }
      await this.imageRetry(() => this.view.finishImageUpload(token, true));
    }
    this.uploadedResources.add(resource);
    this.uploading = undefined;
  }
  /** Follow Content's published merge decisions; blocked annotations have no event target. */
  semanticsTarget(node: NodeHandle): NodeHandle | null {
    const frame = this.semanticPublication,
      state = this.semanticState;
    if (
      this.closed ||
      !this.accepted.has(id(node)) ||
      !frame?.publication ||
      !state?.visible ||
      state.closed ||
      frame.publication !== state.publication ||
      frame.publishedMetrics !== state.metrics ||
      frame.publishedDevice !== state.device
    )
      return null;
    let current = frame.nodes.find((value) => id(value.node) === id(node));
    for (let depth = 0; current && depth <= p.limits.depth; ++depth) {
      if (current.flags & p.nodeFlags.semanticsBlocked) return null;
      const semantic = current.semantics;
      if (semantic && !(semantic.flags & p.semanticsFlags.mergedIntoParent)) {
        if (semantic.flags & p.semanticsFlags.hidden) return null;
        const { bounds, clip } = current;
        return Math.min(bounds.x + bounds.width, clip.x + clip.width) >
          Math.max(bounds.x, clip.x) &&
          Math.min(bounds.y + bounds.height, clip.y + clip.height) > Math.max(bounds.y, clip.y)
          ? current.node
          : null;
      }
      const parent = current.parent;
      current = frame.nodes.find((value) => id(value.node) === id(parent));
    }
    return null;
  }
  /** @internal Original Focus runs this callback after its source focus path is current. */
  notifyFocusPeer(node: NodeHandle): void {
    if (!this.closed) this.accepted.get(id(node))?.node.options.onFocusChanged?.(true);
  }
  private inputEvent(
    event: EngineEvent,
    record: NativeRecord | undefined,
    run: (current: NativeRecord | undefined) => void,
  ): void {
    const perform = () => {
      if (this.closed) return;
      const current = record ? this.accepted.get(id(record.handle)) : undefined;
      if (record && (!current || current.node.reference !== record.node.reference)) return;
      run(current);
    };
    if (this.options.onInputEvent) this.options.onInputEvent(event, perform);
    else perform();
  }
  async pollEvents(): Promise<void> {
    if (this.closed || this.polling) return;
    this.polling = true;
    try {
      if (this.options.onPublication) {
        const publication = await this.view.request(p.opcodes.semanticsSnapshot);
        if (this.closed) return;
        if (publication.status === p.statuses.ok) {
          this.semanticPublication = publication;
          this.options.onPublication(publication);
        } else if (publication.status === p.statuses.notFound) this.semanticPublication = undefined;
        else
          throw new EngineError(
            publication.status,
            'Scene publication observation failed',
            publication,
          );
      }
      const observers = [...this.accepted.values()].filter((r) => r.node.options.onLayout);
      if (observers.length) {
        const snapshot = await this.view.request(p.opcodes.layoutSnapshot);
        // Mount acknowledgement can precede the first activated layout, in
        // particular during cold native-DPR browser startup. Keep polling
        // terminal/input events without reporting normal preparation as an error.
        if (
          snapshot.status !== p.statuses.ok &&
          !(
            snapshot.status === p.statuses.notFound &&
            snapshot.activeDocument === 0n &&
            !snapshot.closed
          )
        )
          throw new EngineError(snapshot.status, 'Scene layout observation failed', snapshot);
        if (snapshot.status === p.statuses.ok)
          for (const record of observers) {
            const node = snapshot.nodes.find((n) => id(n.node) === id(record.handle));
            if (node && !this.closed) record.node.options.onLayout!(node, snapshot);
          }
      }
      const state = await this.view.pollInteractionEvents();
      if (this.closed) return;
      this.semanticState = state;
      this.options.onState?.(state);
      for (const sample of state.gestureRequests) {
        const record = this.accepted.get(id(sample.node));
        const decision = record?.node.options.appControlled;
        if (!decision) continue;
        void Promise.resolve()
          .then(() => (this.closed ? undefined : decision(sample)))
          .then((accept) => (this.closed ? undefined : this.view.replyGesture(sample, !!accept)))
          .catch((error) => {
            if (
              !this.closed &&
              (!(error instanceof EngineError) || error.status !== p.statuses.stale)
            )
              this.options.onError?.(error);
          });
      }
      if (this.rawSubscribed) {
        const raw = await this.view.pollRaw();
        if (this.closed) return;
        for (const sample of raw.rawInputs)
          if (!this.closed) this.accepted.get(id(sample.node))?.node.options.onRawInput?.(sample);
        for (const gap of raw.events)
          if (gap.kind === p.events.rawGap)
            for (const record of this.accepted.values())
              record.node.options.onRawGap?.(gap.epoch, gap.detail);
      }
      for (const event of state.events) {
        if (this.closed) break;
        if (event.kind === p.events.appFrame) {
          this.options.onAppFrame?.(event.x, event.id);
          continue;
        }
        if (event.kind === p.events.focusChanged) {
          this.inputEvent(event, undefined, () => {
            const next =
                event.status === p.statuses.ok && event.id
                  ? this.accepted.get(id(event.node))
                  : undefined,
              handle = next ? id(next.handle) : '';
            if (handle !== this.focusHandle) {
              (
                this.accepted.get(this.focusHandle)?.node.options.onFocusChanged ??
                this.focusCallback
              )?.(false, event);
              this.focusHandle = handle;
              this.focusCallback = next?.node.options.onFocusChanged;
              this.focusCallback?.(true, event);
            }
          });
          continue;
        }
        const record = this.accepted.get(id(event.node));
        if (!record) {
          if (event.kind === p.events.semanticAction && event.tapRegion)
            this.inputEvent(event, undefined, () =>
              this.options.onSemanticAction?.(event, () => {}),
            );
          continue;
        }
        if (event.kind === p.events.scrollTerminal)
          this.inputEvent(event, record, (current) =>
            current?.node.options.onScrollTerminal?.(event),
          );
        else if (event.kind === p.events.key) record.node.options.onKey?.(event);
        else if (event.kind === p.events.pointer && event.pointer)
          this.inputEvent(event, record, (current) =>
            current?.node.options.onPointerSample?.(event.pointer!),
          );
        else if (event.kind === p.events.tapRegion)
          this.inputEvent(event, record, (current) => current?.node.options.onTapRegion?.(event));
        else if (event.kind === p.events.controlChanged) {
          ++this.counters.controls;
          this.inputEvent(event, record, (current) => {
            const callback = current?.node.options.onValue;
            if (callback) {
              const key = id(record.handle);
              this.controlRevisions.set(key, (this.controlRevisions.get(key) ?? 0n) + 1n);
              try {
                callback(eventValue(event.detail), event.x);
              } finally {
                if (!this.closed) this.schedule();
              }
            }
          });
        } else if (event.kind === p.events.gesture) {
          ++this.counters.gestures;
          const kind = Object.entries(p.gestureKinds).find(
            ([, value]) => value === event.status,
          )?.[0] as GestureEvent['kind'] | undefined;
          if (kind)
            this.inputEvent(event, record, (current) =>
              current?.node.options.onGesture?.({
                kind,
                sequence: event.id,
                x: event.x,
                y: event.y,
                value: eventValue(event.detail),
                ...(event.gesture ? { details: event.gesture } : {}),
              }),
            );
        } else if (event.kind === p.events.editingChanged && record.node.editor) {
          const editing = await this.view.editSnapshot(event.node);
          if (!this.closed)
            this.inputEvent(event, record, (current) => current?.node.editor?.publish(editing));
        } else if (event.kind === p.events.semanticAction) {
          const action = Object.entries(p.semanticsActions).find(
            ([, v]) => BigInt(v) === event.detail,
          )?.[0] as keyof typeof p.semanticsActions | undefined;
          if (action) {
            const source = event.semanticSource
              ? this.accepted.get(id(event.semanticSource))
              : record;
            const perform = () => {
              if (
                !this.closed &&
                this.accepted.get(id(event.node)) === record &&
                source &&
                this.accepted.get(id(source.handle)) === source
              )
                source.node.options.onAction?.(action, event);
            };
            this.inputEvent(event, record, () => {
              if (this.options.onSemanticAction) this.options.onSemanticAction(event, perform);
              else perform();
            });
          }
        }
      }
      this.options.onAfterEvents?.();
    } finally {
      this.polling = false;
    }
  }
  private pollSoon(): void {
    if (this.closed) return;
    this.eventTimer = setTimeout(() => {
      void this.pollEvents()
        .catch((error) => {
          if (!this.closed) this.options.onError?.(error);
        })
        .finally(() => this.pollSoon());
    }, 16);
  }
  /** @internal Stop event-driven builds before the owner retires scene resources. */
  async stop(): Promise<void> {
    this.closed = true;
    this.semanticPublication = this.semanticState = undefined;
    if (this.eventTimer !== undefined) clearTimeout(this.eventTimer);
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
    if (this.uploading) {
      const upload = this.uploading;
      try {
        const state = await this.imageRetry(() =>
          this.view.beginImageUpload(upload.handle, upload.bytes.length, upload.token),
        );
        if (state.phase === 'committed') this.uploadedResources.add(upload.resource);
        else await this.imageRetry(() => this.view.finishImageUpload(upload.token, false));
        this.uploading = undefined;
      } catch (error) {
        errors.push(error);
      }
    }
    for (const resource of this.uploadedResources) {
      const handle = this.resources.get(resource)!;
      try {
        await this.imageRetry(() => this.view.releaseImageResource(handle));
        this.view.recycleResource(handle, true);
      } catch (error) {
        errors.push(error);
      }
    }
    for (const r of this.accepted.values()) r.node.editor?.detach(this);
    for (const reference of this.handles.keys()) reference.release(this);
    this.handles.clear();
    this.allocations.clear();
    this.accepted.clear();
    this.controlRevisions.clear();
    this.focusCallback = undefined;
    this.focusHandle = '';
    this.resources.clear();
    this.acceptedResources.clear();
    this.uploadedResources.clear();
    this.free.length = 0;
    this.pending = this.root = undefined;
    try {
      await this.view.close();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw engineFailures('SceneWriter close failed', errors);
  }
}
