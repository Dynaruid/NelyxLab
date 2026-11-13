// SPDX-License-Identifier: BSD-3-Clause
import { commands as c, protocol as p, eventValue } from './codec.ts';
import { SceneBlobJournal } from './scene-blobs.ts';
import type { SceneBlobPlan } from './scene-blobs.ts';
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
import { observationNode } from './node-index.ts';
import { engineFailures } from './lifecycle.ts';
import type { EngineViewClient } from './client.ts';
import type { NativePaintOptions } from './native-paint.ts';
import type { ImageStyleOptions } from './image-style.ts';
import type { NativeSnapshotConfiguration } from './snapshot.ts';
import type { LayoutBuilderOptions } from './layout-builder.ts';
import type { NativeLayoutProgram } from '@nelyx/core/framework/rendering/object';
import type { NativeBoxConfiguration } from '@nelyx/core/framework/rendering/object';
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
    const state = await b.host.view.inspectState();
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
    if (this.binding?.node === node) return;
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
/** @internal Fixed Source configuration has the same own fields/prototype as
 * SceneNode. Its empty public constructor adds no policy; constructing the
 * owned record directly avoids one lowered class-field helper per field on
 * Hermes. Public producers retain their normal constructor and validation. */
export function sceneConfiguration(
  reference: SceneReference,
  kind: keyof typeof p.kinds,
  children: readonly SceneNode[] = [],
  options: SceneNodeOptions = {},
  text?: SceneText,
  image?: ImageResource,
  editor?: EditingController,
  editorFlags = 0,
  maximumLength: number = p.limits.textBytes,
): SceneNode {
  const node = {
    __proto__: SceneNode.prototype,
    reference,
    kind,
    children,
    options,
    text,
    image,
    editor,
    editorFlags,
    maximumLength,
  };
  return node;
}
/** @internal A sealed Source binding, with commands captured by its module's
 * fixed projection procedure. It carries edges/callbacks, not a Scene options
 * tree. Native handles are still allocated by the writer's normal checkpoint. */
export class RenderBinding implements SceneNode {
  declare readonly reference: SceneReference;
  declare readonly kind: SceneNode['kind'];
  declare readonly children: readonly SceneNode[];
  declare readonly options: SceneNodeOptions;
  declare readonly text: undefined;
  declare readonly image: undefined;
  declare readonly editor: undefined;
  declare readonly editorFlags: number;
  declare readonly maximumLength: number;
}
const bindingPrograms = new WeakMap<SceneNode, readonly Uint8Array[]>();
// One private, destination-free program per live Source reference. Callback
// records and child edges still belong to each newly sealed configuration.
const recentBindingPrograms = new WeakMap<
  SceneReference,
  {
    readonly kind: SceneNode['kind'];
    readonly program: readonly Uint8Array[];
    readonly parts: readonly BindingPart[];
  }
>();
type BindingPart = {
  readonly kind: number;
  readonly key: readonly unknown[];
  readonly bytes: Uint8Array;
};
export interface RenderBindingProjectionCounters {
  partEncodes: number;
  partReuses: number;
}
type BindingPartJournal = {
  readonly previous: readonly BindingPart[] | undefined;
  readonly parts: BindingPart[];
  readonly counters: RenderBindingProjectionCounters | undefined;
};
function bindingPartJournal(
  reference: SceneReference,
  kind: SceneNode['kind'],
  counters?: RenderBindingProjectionCounters,
): BindingPartJournal {
  const before = recentBindingPrograms.get(reference);
  return {
    previous: before?.kind === kind ? before.parts : undefined,
    parts: [],
    counters,
  };
}
function sameBindingPartInput(args: readonly unknown[], before: BindingPart): boolean {
  if (args.length !== before.key.length) return false;
  for (let index = 0; index < args.length; ++index)
    if (!Object.is(args[index], before.key[index])) return false;
  return true;
}
/** Field parts are Source values, never a second native/ACK registry. A failed
 * encode does not install a candidate journal. Keep live references and opaque
 * receivers on their ordinary encoder path. Public Scene inputs do not use it. */
function bindingPart<T extends unknown[]>(
  journal: BindingPartJournal,
  kind: number,
  args: T,
  encode: (...args: T) => Uint8Array,
): Uint8Array {
  let scalar = true;
  for (let index = 1; index < args.length; ++index) {
    const value = args[index];
    if (
      value !== null &&
      (typeof value === 'object' || typeof value === 'function' || typeof value === 'symbol')
    ) {
      scalar = false;
      break;
    }
  }
  const before = scalar ? journal.previous?.find((part) => part.kind === kind) : undefined;
  if (before && sameBindingPartInput(args, before)) {
    journal.parts.push(before);
    if (journal.counters) ++journal.counters.partReuses;
    return before.bytes;
  }
  if (journal.counters) ++journal.counters.partEncodes;
  const bytes = Reflect.apply(encode, c, args);
  // This internal argument tuple owns only scalar values and the frozen
  // destination placeholder. Objects/arrays keep their ordinary codec path;
  // no extra graph probe, clone, revision or freezing is needed to retain it.
  if (scalar) journal.parts.push({ kind, key: args, bytes });
  return bytes;
}
// A sealed command owns its body, but not a destination. Only diff addresses
// commands that actually change the document. Accepted records can therefore
// retain these same bodies through NACK recovery and handle regeneration.
const bindingTemplates = new WeakSet<Uint8Array>();
type BindingFixup = { readonly offset: number; readonly reference: SceneReference };
const bindingFixups = new WeakMap<Uint8Array, readonly BindingFixup[]>();
const referenceTokens = new WeakMap<object, SceneReference>();
const referenceHandles = new WeakMap<SceneReference, NodeHandle>();
const sourceReferenceOptions = new WeakSet<SceneNodeOptions>();
/** @internal Only host-built adapter options may contain binding tokens.
 * Public mutable/accessor producers keep the original encoder read sequence. */
export function sceneReferenceConfiguration<T extends SceneNodeOptions>(options: T): T {
  sourceReferenceOptions.add(options);
  return options;
}
/** @internal A data-only reference to a Source binding. The placeholder never
 * reaches Core: the writer resolves it after allocating the whole batch. */
export function sceneReferenceHandle(reference: SceneReference): NodeHandle {
  let token = referenceHandles.get(reference);
  if (!token) {
    token = Object.freeze({ slot: 1, generation: 1 });
    referenceHandles.set(reference, token);
    referenceTokens.set(token, reference);
  }
  return token;
}
function resolveSceneHandle(
  value: NativePaintOptions['reference'],
): NativePaintOptions['reference'] {
  if (value && typeof value === 'object') {
    const reference = referenceTokens.get(value);
    if (reference) return () => reference.currentNode;
  }
  return value;
}
const bindingKinds = new Set<SceneNode['kind']>([
  'box',
  'stack',
  'paragraph',
  'clip',
  'flex',
  'wrap',
  'transform',
]);
const bindingFields = new Set([
  'properties',
  'color',
  'radius',
  'layout',
  'horizontal',
  'vertical',
  'paragraph',
  'paragraphFont',
  'clipStyle',
  'semantics',
  'graphics',
  'nativePaint',
  'listItem',
  'gestures',
  'gestureDevices',
  'layoutProgram',
  'modal',
  'pointerHitTest',
  'canonicalGestures',
  'dragStartDown',
  'freePan',
  'dragThreshold',
  'mouseRegion',
  'roundedHitTest',
  'nativeFocus',
  'canonicalKeyboard',
  'semanticsPolicy',
  'pointerBlock',
  'paintPlacement',
  'layerLink',
  'tapRegion',
  'snapshot',
  'layoutBuilder',
  'tooltipPosition',
  'childAnchor',
  'intrinsicSizing',
]);
const unboundHandle = Object.freeze({ slot: 0, generation: 0 });
const encodeBindingText = (
  handle: NodeHandle,
  value: string,
  size: number,
  color: number,
  direction: 'ltr' | 'rtl',
): Uint8Array => c.text(handle, value, size, color, { direction });
/** Inspect descriptors before reading a value: an accessor/subclass/executable
 * reference uses the existing adapter without executing an eligibility probe.
 * Mutable plain data is encoded now, so later writes cannot change this batch. */
function bindingData(value: unknown, ancestors?: Set<object>): boolean {
  if (value === null || typeof value !== 'object') return typeof value !== 'function';
  if (referenceTokens.has(value)) return true;
  if (immutableSceneValues.has(value)) return true;
  ancestors ??= new Set<object>();
  if (ancestors.has(value)) return false;
  const array = Array.isArray(value),
    prototype = Object.getPrototypeOf(value);
  if (prototype !== (array ? Array.prototype : Object.prototype) && prototype !== null)
    return false;
  ancestors.add(value);
  try {
    for (const key of Reflect.ownKeys(value)) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string') return false;
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!('value' in descriptor) || !bindingData(descriptor.value, ancestors)) return false;
    }
    return true;
  } finally {
    ancestors.delete(value);
  }
}
/** @internal Fixed common render-module projection. Unsupported capabilities
 * return undefined; the public Scene producer keeps its full mutable semantics. */
export function renderBindingConfiguration(
  reference: SceneReference,
  kind: SceneNode['kind'],
  children: readonly SceneNode[],
  options: SceneNodeOptions,
  text?: SceneText,
  closedData = false,
  counters?: RenderBindingProjectionCounters,
): RenderBinding | undefined {
  if (!bindingKinds.has(kind)) return;
  if (!closedData) {
    const prototype = Object.getPrototypeOf(options);
    if (prototype !== Object.prototype && prototype !== null) return;
  }
  const callbacks: Record<string, unknown> = {};
  for (const key of closedData ? Object.keys(options) : Reflect.ownKeys(options)) {
    if (typeof key !== 'string') return;
    let value: unknown;
    if (closedData) value = (options as Record<string, unknown>)[key];
    else {
      const descriptor = Object.getOwnPropertyDescriptor(options, key)!;
      if (!('value' in descriptor)) return;
      value = descriptor.value;
    }
    if (sourceCallbacks.has(key)) callbacks[key] = value;
    else if (!bindingFields.has(key) || (!closedData && !bindingData(value))) return;
  }
  if (!closedData && !bindingData(text)) return;
  // Native paint can carry cross-node handles as well as live closures. Both
  // require the existing dependency/handle-resolution path after allocation.
  if (
    options.nativePaint?.some(
      (entry) =>
        entry.reference !== undefined &&
        (typeof entry.reference !== 'object' || !referenceTokens.has(entry.reference)),
    )
  )
    return;
  if (typeof options.layerLink === 'function' || typeof options.tapRegion === 'function') return;
  const o = options,
    h = unboundHandle,
    journal = bindingPartJournal(reference, kind, counters);
  const layout = o.layout === false ? { enabled: false } : o.layout;
  const layoutDefault =
    layout === undefined
      ? defaultLayouts[1]
      : Object.keys(layout).length === 1 && layout.childConstraints === 'inherit'
        ? defaultLayouts[2]
        : Object.keys(layout).length === 1 && layout.enabled === false
          ? defaultLayouts[0]
          : undefined;
  const policy = sceneEventPolicy(o);
  const config = [
    o.properties === undefined ? defaultProperties : c.properties(h, o.properties),
    Object.is(o.color ?? 0, 0) && Object.is(o.radius ?? 0, 0)
      ? defaultPaint
      : bindingPart(journal, p.commands.paint, [h, o.color ?? 0, o.radius ?? 0], c.paint),
    layoutDefault ?? c.layout(h, layout ?? {}),
    o.horizontal === undefined && o.vertical === undefined
      ? defaultConstraints
      : c.constraints(
          h,
          o.horizontal ?? { kind: 'unbounded' },
          o.vertical ?? { kind: 'unbounded' },
        ),
  ];
  if (text)
    config.push(
      bindingPart(
        journal,
        p.commands.text,
        [h, text.value, text.size, text.color, text.direction],
        encodeBindingText,
      ),
    );
  if (kind === 'paragraph')
    config.push(c.paragraphOptions(h, o.paragraph ?? null), c.paragraphFont(h, o.paragraphFont));
  else if (o.paragraph || o.paragraphFont) return;
  if (kind === 'clip') config.push(c.clipStyle(h, o.clipStyle ?? null));
  else if (o.clipStyle) return;
  if (o.semantics) config.push(c.semantics(h, o.semantics));
  if (o.graphics) config.push(c.graphics(h, o.graphics));
  if (o.nativePaint?.length) {
    const command = c.nativePaint(h, o.nativePaint),
      fixups: BindingFixup[] = [];
    o.nativePaint.forEach((entry, index) => {
      const reference =
        entry.reference && typeof entry.reference === 'object'
          ? referenceTokens.get(entry.reference)
          : undefined;
      if (reference)
        fixups.push({
          offset: 16 + p.nativePaintHeaderBytes + index * p.nativePaintBytes + 16,
          reference,
        });
    });
    if (fixups.length) bindingFixups.set(command, fixups);
    config.push(command);
  }
  if (o.paintPlacement) {
    const command = c.paintPlacement(h, o.paintPlacement),
      target = o.paintPlacement.reference,
      reference = target && typeof target === 'object' ? referenceTokens.get(target) : undefined;
    if (reference) bindingFixups.set(command, [{ offset: 16 + 32, reference }]);
    config.push(command);
  }
  if (o.layerLink && typeof o.layerLink !== 'function') config.push(c.layerLink(h, o.layerLink));
  if (o.tapRegion && typeof o.tapRegion !== 'function') config.push(c.tapRegion(h, o.tapRegion));
  if (o.snapshot) config.push(c.snapshot(h, o.snapshot));
  if (o.layoutBuilder) config.push(c.layoutBuilder(h, o.layoutBuilder));
  if (o.tooltipPosition) config.push(c.tooltipPosition(h, o.tooltipPosition));
  if (o.childAnchor) config.push(c.childAnchor(h, o.childAnchor));
  if (o.intrinsicSizing) config.push(c.intrinsicSizing(h, o.intrinsicSizing));
  if (o.layoutProgram) config.push(c.layoutProgram(h, o.layoutProgram));
  if (o.listItem) config.push(c.listItem(h, o.listItem));
  if (o.gestures)
    config.push(
      bindingPart(journal, p.commands.gesture, [h, o.gestures, o.gestureDevices], c.gesture),
    );
  config.push(
    policy === 0
      ? defaultPolicies[0]!
      : policy === p.eventPolicies.canonicalHitTest
        ? defaultPolicies[1]!
        : bindingPart(journal, p.commands.eventPolicy, [h, policy], c.eventPolicy),
  );
  return sealRenderBinding(reference, kind, children, callbacks, config, journal.parts);
}
function sealRenderBinding(
  reference: SceneReference,
  kind: SceneNode['kind'],
  children: readonly SceneNode[],
  callbacks: SceneNodeOptions,
  config: readonly Uint8Array[],
  parts: readonly BindingPart[],
): RenderBinding {
  for (const command of config) bindingTemplates.add(command);
  const previous = recentBindingPrograms.get(reference);
  const same =
    previous?.kind === kind &&
    previous.program.length === config.length &&
    config.every((command, index) => {
      const before = previous.program[index]!;
      if (command === before) return true;
      const fixups = bindingFixups.get(command),
        oldFixups = bindingFixups.get(before);
      return (
        fixups?.length === oldFixups?.length &&
        (!fixups ||
          fixups.every(
            (fixup, at) =>
              fixup.offset === oldFixups![at]!.offset &&
              fixup.reference === oldFixups![at]!.reference,
          )) &&
        sameRecordConfig(command, before)
      );
    });
  const program = same ? previous.program : config;
  const sameParts =
    previous?.parts.length === parts.length &&
    parts.every((part, index) => part === previous.parts[index]);
  if (!same || !sameParts) recentBindingPrograms.set(reference, { kind, program, parts });
  const binding = Object.freeze({
    __proto__: RenderBinding.prototype,
    reference,
    kind,
    children: Object.freeze(children.slice()),
    options: Object.freeze(callbacks),
    text: undefined,
    image: undefined,
    editor: undefined,
    editorFlags: 0,
    maximumLength: p.limits.textBytes,
  }) as RenderBinding;
  bindingPrograms.set(binding, program);
  retainedConfigurations.add(binding);
  return binding;
}
/** @internal A canonical module's opted-in data goes straight to the codecs.
 * No Scene options, descriptor eligibility walk, or generic input snapshot is
 * built. This capability is separate from mutable/public Scene producers. */
export function boxRenderBindingConfiguration(
  reference: SceneReference,
  children: readonly SceneNode[],
  source: NativeBoxConfiguration,
  layout: NodeLayout,
  listItem?: SceneNodeOptions['listItem'],
  counters?: RenderBindingProjectionCounters,
): RenderBinding {
  if (
    source.paint ||
    source.foreground ||
    source.children ||
    source.layoutBuilder ||
    source.tooltipPosition ||
    source.snapshot
  )
    throw Error('Direct box data capability contains executable or synthetic work');
  const h = unboundHandle,
    journal = bindingPartJournal(reference, source.kind, counters),
    constraint = source.constraints;
  const axis = (min: number, max: number): AxisBound =>
    min === Infinity && max === Infinity
      ? { kind: 'expand' }
      : max === Infinity
        ? { kind: 'unbounded', min }
        : { kind: 'finite', min, max };
  const config = [
    source.opacity === undefined ? defaultProperties : c.properties(h, { opacity: source.opacity }),
    Object.is(source.color ?? 0, 0)
      ? defaultPaint
      : bindingPart(journal, p.commands.paint, [h, source.color!], c.paint),
    Object.keys(layout).length === 1 && layout.childConstraints === 'inherit'
      ? defaultLayouts[2]!
      : c.layout(h, layout),
    constraint
      ? c.constraints(
          h,
          axis(constraint.minWidth, constraint.maxWidth),
          axis(constraint.minHeight, constraint.maxHeight),
        )
      : defaultConstraints,
  ];
  if (source.kind === 'clip') config.push(c.clipStyle(h, source.clipStyle ?? null));
  if (source.semantics) config.push(c.semantics(h, source.semantics));
  if (source.graphics) config.push(c.graphics(h, source.graphics));
  if (source.childAnchor) config.push(c.childAnchor(h, source.childAnchor));
  if (source.intrinsicSizing) config.push(c.intrinsicSizing(h, source.intrinsicSizing));
  if (source.layoutProgram) config.push(c.layoutProgram(h, source.layoutProgram));
  if (listItem) config.push(c.listItem(h, listItem));
  const policy = sceneEventPolicy({
    pointerHitTest: source.hitTest ?? 'proxy',
    pointerBlock: source.pointerBlock,
    semanticsPolicy: source.semanticsPolicy,
    onPointerSample: source.onPointerSample,
  });
  config.push(
    policy === p.eventPolicies.canonicalHitTest
      ? defaultPolicies[1]!
      : bindingPart(journal, p.commands.eventPolicy, [h, policy], c.eventPolicy),
  );
  return sealRenderBinding(
    reference,
    source.kind,
    children,
    source.onPointerSample ? { onPointerSample: source.onPointerSample } : {},
    config,
    journal.parts,
  );
}
/** @internal Reconnect changed edges without re-projecting retained fields. */
export function relinkRenderBinding(
  node: SceneNode,
  children: readonly SceneNode[],
): RenderBinding | undefined {
  const program = bindingPrograms.get(node);
  if (!program) return;
  const next = Object.freeze({
    __proto__: RenderBinding.prototype,
    reference: node.reference,
    kind: node.kind,
    children: Object.freeze(children.slice()),
    options: node.options,
    text: undefined,
    image: undefined,
    editor: undefined,
    editorFlags: 0,
    maximumLength: p.limits.textBytes,
  }) as RenderBinding;
  bindingPrograms.set(next, program);
  retainedConfigurations.add(next);
  return next;
}
function bindingReset(kind: number, handle: NodeHandle): Uint8Array | undefined {
  switch (kind) {
    case p.commands.semantics:
      return c.semantics(handle, null);
    case p.commands.graphics:
      return c.graphics(handle, undefined);
    case p.commands.nativePaint:
      return c.nativePaint(handle, undefined);
    case p.commands.listItem:
      return c.listItem(handle, null);
    case p.commands.gesture:
      return c.gesture(handle, 0, undefined);
    case p.commands.layoutProgram:
      return c.layoutProgram(handle, undefined);
    case p.commands.paintPlacement:
      return c.paintPlacement(handle, undefined);
    case p.commands.layerLink:
      return c.layerLink(handle, undefined);
    case p.commands.tapRegion:
      return c.tapRegion(handle, undefined);
    case p.commands.snapshot:
      return c.snapshot(handle, undefined);
    case p.commands.layoutBuilder:
      return c.layoutBuilder(handle, undefined);
    case p.commands.tooltipPosition:
      return c.tooltipPosition(handle, undefined);
    case p.commands.childAnchor:
      return c.childAnchor(handle, undefined);
    case p.commands.intrinsicSizing:
      return c.intrinsicSizing(handle, undefined);
    case p.commands.control:
      return c.control(handle, null);
  }
}
const bindingCommandOrder = new Map<number, number>(
  [
    p.commands.properties,
    p.commands.paint,
    p.commands.layout,
    p.commands.constraints,
    p.commands.text,
    p.commands.paragraphOptions,
    p.commands.paragraphFont,
    p.commands.clipStyle,
    p.commands.semantics,
    p.commands.graphics,
    p.commands.nativePaint,
    p.commands.paintPlacement,
    p.commands.layerLink,
    p.commands.tapRegion,
    p.commands.snapshot,
    p.commands.layoutBuilder,
    p.commands.tooltipPosition,
    p.commands.childAnchor,
    p.commands.intrinsicSizing,
    p.commands.layoutProgram,
    p.commands.listItem,
    p.commands.gesture,
    p.commands.control,
    p.commands.eventPolicy,
  ].map((kind, index) => [kind, index]),
);
const retainedConfigurations = new WeakSet<SceneNode>();
type RetainedPayload = {
  readonly identity: unknown;
  readonly inputs: WeakMap<object, unknown>;
};
const retainedPayloads = new WeakMap<SceneNode, RetainedPayload>();
const immutableSceneValues = new WeakSet<object>();
/** @internal Own an independent, deeply immutable data value. Source modules
 * may share compiled numeric policy between configurations without repeatedly
 * snapshotting it. Mutable/public producer inputs keep their usual checks. */
export function immutableSceneData<T>(value: T): T {
  const captured = captureConfigInput(value);
  if (captured === uncacheableInput) throw Error('Scene data must contain only plain data');
  const seal = (data: unknown): void => {
    if (!data || typeof data !== 'object' || immutableSceneValues.has(data)) return;
    for (const key of Object.keys(data)) seal((data as Record<string, unknown>)[key]);
    Object.freeze(data);
    immutableSceneValues.add(data);
  };
  seal(captured);
  return captured as T;
}
const sourceCallbacks = new Set([
  'onTapRegion',
  'onKey',
  'onScrollTerminal',
  'onRawInput',
  'onPointerSample',
  'onRawGap',
  'appControlled',
  'onFocusChanged',
  'onGesture',
  'onValue',
  'onLayout',
  'onAction',
]);
function sceneEventPolicy(o: {
  readonly [K in keyof SceneNodeOptions]?: SceneNodeOptions[K] | undefined;
}): number {
  return (
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
    (o.pointerHitTest === 'translucent' ? p.eventPolicies.translucent : 0)
  );
}
/** @internal Source capture owns invalidation and immutable configuration
 * identity. Public SceneNode producers still get mutation-safe input diffing. */
export function retainSceneConfiguration(node: SceneNode, previous?: SceneNode): void {
  if (retainedConfigurations.has(node)) return;
  retainedConfigurations.add(node);
  const before = previous && retainedPayloads.get(previous);
  if (before && previous?.options === node.options && previous.text === node.text) {
    retainedPayloads.set(node, before);
    return;
  }
  const options = node.options;
  if (
    Object.getPrototypeOf(options) !== Object.prototype &&
    Object.getPrototypeOf(options) !== null
  )
    return;
  const data: Record<string, unknown> = Object.create(null);
  data.onRawInput = false;
  data.onPointerSample = false;
  data.appControlled = false;
  for (const key of Object.getOwnPropertyNames(options)) {
    const descriptor = Object.getOwnPropertyDescriptor(options, key)!;
    if (!('value' in descriptor)) return;
    if (key === 'onRawInput' || key === 'onPointerSample' || key === 'appControlled')
      data[key] = !!descriptor.value;
    else if (!sourceCallbacks.has(key)) data[key] = descriptor.value;
  }
  // These callbacks also select native event-policy bits. Their identities
  // stay in the callback record, but their presence belongs to the wire data.
  const input = { options: data, text: node.text };
  const inputs = new WeakMap<object, unknown>();
  const identity =
    before && sameConfigInput(input, before.identity, inputs)
      ? before.identity
      : captureConfigInput(input, new Set(), inputs);
  if (identity !== uncacheableInput) retainedPayloads.set(node, { identity, inputs });
}
function id(h: NodeHandle): string {
  return `${h.slot}:${h.generation}`;
}
const commandKind = (bytes: Uint8Array) => bytes[0]! | (bytes[1]! << 8);
interface NativeRecord {
  readonly appGeometry: boolean;
  readonly node: SceneNode;
  readonly handle: NodeHandle;
  readonly parent: NodeHandle | null;
  readonly children: readonly NodeHandle[];
  readonly config: readonly Uint8Array[];
  readonly configByKind: ReadonlyMap<number, Uint8Array>;
  readonly fullyCacheable: boolean;
  readonly configInputs: ReadonlyMap<number, unknown>;
}
const recordBindingPrograms = new WeakMap<NativeRecord, readonly Uint8Array[]>();
type BindingTarget = {
  readonly reference: SceneReference;
  readonly slot: number;
  readonly generation: number;
};
const recordBindingTargets = new WeakMap<NativeRecord, readonly BindingTarget[]>();
/** A transaction's private write set over the accepted registry. The base is
 * changed only after a terminal ACK; in-flight edits never mutate it. */
class RecordPatch {
  readonly changed = new Map<string, NativeRecord>();
  readonly removed = new Map<string, NativeRecord>();
  constructor(readonly base: Map<string, NativeRecord>) {}
  get size(): number {
    let count = this.base.size - this.removed.size;
    for (const key of this.changed.keys()) if (!this.base.has(key)) ++count;
    return count;
  }
  get(key: string): NativeRecord | undefined {
    return this.removed.has(key) ? undefined : (this.changed.get(key) ?? this.base.get(key));
  }
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
  set(key: string, record: NativeRecord): void {
    if (record !== this.base.get(key)) this.changed.set(key, record);
  }
  *values(): IterableIterator<NativeRecord> {
    for (const [key, record] of this.base)
      if (!this.removed.has(key)) yield this.changed.get(key) ?? record;
    for (const [key, record] of this.changed) if (!this.base.has(key)) yield record;
  }
  *[Symbol.iterator](): IterableIterator<[string, NativeRecord]> {
    for (const record of this.values()) yield [id(record.handle), record];
  }
  reconcile(root: NodeHandle, previousRoot?: NodeHandle): void {
    const candidates: NativeRecord[] = [];
    for (const record of this.changed.values()) {
      const before = this.base.get(id(record.handle));
      if (!before) continue;
      const children = new Set(record.children.map(id));
      for (const child of before.children)
        if (!children.has(id(child))) candidates.push(this.base.get(id(child))!);
    }
    // A Source root replacement is also a removal edge.
    if (previousRoot && id(previousRoot) !== id(root))
      candidates.push(this.base.get(id(previousRoot))!);
    const remove = (before: NativeRecord): void => {
      const key = id(before.handle);
      if (this.removed.has(key)) return;
      const after = this.changed.get(key);
      if (after) return; // Reparented/reused elsewhere in this batch.
      this.removed.set(key, before);
      for (const child of before.children) remove(this.base.get(id(child))!);
    };
    for (const before of candidates) remove(before);
    // Validate the affected edge closure, including edges into skipped subtrees.
    // This catches duplicate references without visiting those subtrees.
    for (const record of this.changed.values()) {
      const before = this.base.get(id(record.handle));
      if (before?.parent && (!record.parent || id(before.parent) !== id(record.parent))) {
        const oldParent = this.get(id(before.parent));
        if (oldParent?.children.some((child) => id(child) === id(record.handle)))
          throw Error('Duplicate scene reference in retained subtree');
      }
      if (record.parent) {
        const parent = this.get(id(record.parent));
        if (!parent?.children.some((child) => id(child) === id(record.handle)))
          throw Error('Scene parent edge is absent');
      }
      const children = new Set<string>();
      for (const child of record.children) {
        const key = id(child),
          next = this.get(key);
        if (children.has(key) || !next?.parent || id(next.parent) !== id(record.handle))
          throw Error('Duplicate scene reference or inconsistent child edge');
        children.add(key);
      }
    }
  }
}
type RecordSet = Map<string, NativeRecord> | RecordPatch;
type RetainedSubtree = {
  record: NativeRecord;
  count: number;
  height: number;
  geometry: number;
  cacheable: boolean;
  dependencies: RetainedDependencies | undefined;
};
// Persistent concatenation shares single-child dependency groups. No ancestor
// copies a whole descendant reference map; one batch memoizes validation.
type RetainedDependencies = {
  readonly targets?: readonly BindingTarget[];
  readonly owner?: NativeRecord;
  readonly children?: readonly RetainedDependencies[];
};
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
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) if (a[i] !== b[i]) return false;
  return true;
}
// Creation defaults are handle-independent. Encode them once, then compare
// header/body while excluding only the destination handle at bytes 8..15.
// Accepted records may use it only with a private shared template and after
// diff has selected the same generational record. Never compare references this way.
const defaultHandle = { slot: 1, generation: 1 };
const defaultProperties = c.properties(defaultHandle, {});
const defaultPaint = c.paint(defaultHandle, 0);
const defaultConstraints = c.constraints(
  defaultHandle,
  { kind: 'unbounded' },
  { kind: 'unbounded' },
);
const defaultLayouts = [
  c.layout(defaultHandle, { enabled: false, childConstraints: 'loose' }),
  c.layout(defaultHandle),
  c.layout(defaultHandle, { childConstraints: 'inherit' }),
];
const defaultPolicies = [
  c.eventPolicy(defaultHandle, 0),
  c.eventPolicy(defaultHandle, p.eventPolicies.canonicalHitTest),
];
function sameCreationDefault(value: Uint8Array, template: Uint8Array): boolean {
  if (value === template) return true;
  if (value.length !== template.length) return false;
  for (let i = 0; i < value.length; ++i) {
    if (i === 8) i = 16;
    if (value[i] !== template[i]) return false;
  }
  return true;
}
function creationDefault(kind: number, flags: number): Uint8Array | undefined {
  switch (kind) {
    case p.commands.properties:
      return defaultProperties;
    case p.commands.paint:
      return defaultPaint;
    case p.commands.constraints:
      return defaultConstraints;
    case p.commands.layout:
      return defaultLayouts[
        flags & p.nodeCreationFlags.layoutEnabled
          ? flags & p.nodeCreationFlags.inheritChildConstraints
            ? 2
            : 1
          : 0
      ];
    case p.commands.eventPolicy:
      return defaultPolicies[flags & p.nodeCreationFlags.canonicalHitTest ? 1 : 0];
    default:
      return undefined;
  }
}
// Fixed Source defaults share an immutable command and comparison input. The
// placeholder destination never leaves this module: only commands actually
// emitted by diff receive the current generational handle. The pool is fixed,
// not a cache of arbitrary producer data or detached nodes.
const sharedDefaults = new Map<number, readonly { input: unknown; bytes: Uint8Array }[]>([
  [
    p.commands.properties,
    [
      { input: undefined, bytes: defaultProperties },
      { input: {}, bytes: defaultProperties },
    ],
  ],
  [
    p.commands.paint,
    [
      { input: [undefined, undefined], bytes: defaultPaint },
      { input: [0, undefined], bytes: defaultPaint },
    ],
  ],
  [p.commands.constraints, [{ input: [undefined, undefined], bytes: defaultConstraints }]],
  [
    p.commands.layout,
    [
      { input: {}, bytes: defaultLayouts[1]! },
      { input: { childConstraints: 'inherit' }, bytes: defaultLayouts[2]! },
      { input: { enabled: false }, bytes: defaultLayouts[0]! },
    ],
  ],
  [
    p.commands.eventPolicy,
    [
      { input: 0, bytes: defaultPolicies[0]! },
      { input: p.eventPolicies.canonicalHitTest, bytes: defaultPolicies[1]! },
    ],
  ],
]);
const sharedDefaultCommands = new Set([
  defaultProperties,
  defaultPaint,
  defaultConstraints,
  ...defaultLayouts,
  ...defaultPolicies,
]);
function sameRecordConfig(a: Uint8Array, b: Uint8Array): boolean {
  return bindingTemplates.has(a) ||
    bindingTemplates.has(b) ||
    sharedDefaultCommands.has(a) ||
    sharedDefaultCommands.has(b)
    ? sameCreationDefault(a, b)
    : equalBytes(a, b);
}
function addressedConfig(config: Uint8Array, handle: NodeHandle): Uint8Array {
  if (!bindingTemplates.has(config) && !sharedDefaultCommands.has(config)) return config;
  const bytes = config.slice();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  view.setUint32(8, handle.slot, true);
  view.setUint32(12, handle.generation, true);
  return bytes;
}
const uncacheableInput = Symbol('uncacheable scene input');
/** Keep independent data snapshots. Reusing a mutable options object must not
 * hide a later change; executable/accessor values always run through encoding. */
function captureConfigInput(
  value: unknown,
  parents = new Set<object>(),
  inputs?: WeakMap<object, unknown>,
): unknown {
  if (value === null || typeof value !== 'object')
    return typeof value === 'function' || typeof value === 'symbol' ? uncacheableInput : value;
  if (referenceTokens.has(value)) return uncacheableInput;
  if (immutableSceneValues.has(value)) return value;
  if (inputs?.has(value)) return inputs.get(value);
  const array = Array.isArray(value);
  if (
    (!array &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    parents.has(value)
  )
    return uncacheableInput;
  parents.add(value);
  const copy: Record<string, unknown> | unknown[] = array ? [] : Object.create(null);
  for (const key of Object.keys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!('value' in descriptor)) return uncacheableInput;
    const captured = captureConfigInput(descriptor.value, parents, inputs);
    if (captured === uncacheableInput) return uncacheableInput;
    (copy as Record<string, unknown>)[key] = captured;
  }
  if (array) (copy as unknown[]).length = value.length;
  parents.delete(value);
  inputs?.set(value, copy);
  return copy;
}
function sameConfigInput(
  value: unknown,
  captured: unknown,
  inputs?: WeakMap<object, unknown>,
): boolean {
  if (Object.is(value, captured)) return true;
  if (!value || !captured || typeof value !== 'object' || typeof captured !== 'object')
    return false;
  const array = Array.isArray(value);
  if (
    array !== Array.isArray(captured) ||
    (array && value.length !== (captured as unknown[]).length)
  )
    return false;
  if (
    !array &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    return false;
  const keys = Object.keys(value);
  const capturedKeys = Object.keys(captured);
  if (keys.length !== capturedKeys.length) return false;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (
      !('value' in descriptor) ||
      !Object.hasOwn(captured, key) ||
      !sameConfigInput(descriptor.value, (captured as Record<string, unknown>)[key], inputs)
    )
      return false;
  }
  inputs?.set(value, captured);
  return true;
}

/** ACK-based engine document writer shared by all App producers. */
type ObservationLane = {
  pending: EngineResponse | undefined;
  running: Promise<void> | undefined;
};
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
  private acceptedRoot: NodeHandle | undefined;
  private retainedSubtrees = new WeakMap<SceneNode, RetainedSubtree>();
  private readonly layoutObservers = new Map<string, NativeRecord>();
  private readonly imageCounts = new Map<ImageResource, number>();
  private readonly provisional = new Set<string>();
  private recordCheckpoint:
    | {
        nextSlot: number;
        popped: NodeHandle[];
        bindings: {
          reference: SceneReference;
          before: { kind: SceneNode['kind']; handle: NodeHandle } | undefined;
          handle: NodeHandle;
        }[];
        resources: ImageResource[];
      }
    | undefined;
  private hovered = new Map<string, GestureEvent>();
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
  private readonly blobJournal = new SceneBlobJournal();
  private pending:
    | { desired: RecordSet; changes: readonly Uint8Array[]; blobPlan?: SceneBlobPlan | undefined }
    | undefined;
  private running: Promise<void> | undefined;
  private closing: Promise<void> | undefined;
  private rerun = false;
  private eventTimer: ReturnType<typeof setTimeout> | undefined;
  private unsubscribeChanges: (() => void) | undefined;
  private eventRequested = false;
  private eventRunning = false;
  private polling = false;
  private readonly observationLanes: Record<'layout' | 'publication', ObservationLane> = {
    layout: { pending: undefined, running: undefined },
    publication: { pending: undefined, running: undefined },
  };
  private focusHandle = '';
  private focusCallback: SceneNodeOptions['onFocusChanged'];
  private semanticPublication: EngineResponse | undefined;
  private semanticState: EngineResponse | undefined;
  private layoutObservation: EngineResponse | undefined;
  private layoutDemand = 0;
  private observedLayoutDemand = 0;
  private appGeometryNodes = 0;
  private readonly controlRevisions = new Map<string, bigint>();
  readonly counters = {
    blobRegistrations: 0,
    blobBindings: 0,
    blobRetired: 0,
    blobRegisteredBytes: 0,
    blobReferencedBytes: 0,
    blobRetainedBytes: 0,
    recordsMs: 0,
    sharedDefaultConfigs: 0,
    diffMs: 0,
    topologyReused: 0,
    publicationObservations: 0,
    publicationObservationMs: 0,
    maxPublicationObservationMs: 0,
    layoutObservations: 0,
    layoutObservationMs: 0,
    maxLayoutObservationMs: 0,
    reusedRecords: 0,
    builds: 0,
    transactions: 0,
    commands: 0,
    created: 0,
    destroyed: 0,
    moved: 0,
    allocatedVisits: 0,
    recordVisits: 0,
    skippedSubtreeNodes: 0,
    journalRecords: 0,
    bindingRecords: 0,
    bindingCommands: 0,
    bindingProgramReuses: 0,
    referenceDependencyChecks: 0,
    referenceSubtreeReuses: 0,
    fullRecordBuilds: 0,
    topologyRecords: 0,
    creationDepthVisits: 0,
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
      /** Internal App bridges consume geometry/semantics, not renderer payloads. */
      appObservations?: boolean;
      /** Internal Source producer supplies immutable, invalidated Scene configs. */
      retainedScene?: boolean;
      immutableBlobs?: boolean;
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
    this.unsubscribeChanges = this.view.subscribeChanges(() => this.requestEvents());
    if (this.unsubscribeChanges) this.requestEvents();
    else this.pollSoon();
  }
  private schedule(): void {
    this.options.onInvalidate?.();
  }
  private ensure(): void {
    if (this.closed) throw new Error('SceneWriter is closed');
  }
  private allocate(): NodeHandle {
    const h = this.free.pop();
    if (h) {
      this.recordCheckpoint?.popped.push(h);
      return h;
    }
    if (this.nextSlot >= p.limits.nodes)
      throw new EngineError(p.statuses.budgetExceeded, 'Scene node budget');
    return { slot: ++this.nextSlot, generation: 1 };
  }
  private records(root: SceneNode): RecordSet {
    const records: RecordSet = this.options.retainedScene
      ? new RecordPatch(this.accepted)
      : new Map<string, NativeRecord>();
    if (!(records instanceof RecordPatch)) ++this.counters.fullRecordBuilds;
    const seen = new Set<SceneReference>();
    const checkedDependencies = new Map<RetainedDependencies, boolean>();
    const validDependencies = (dependencies: RetainedDependencies): boolean => {
      const checked = checkedDependencies.get(dependencies);
      if (checked !== undefined) return checked;
      const valid = dependencies.targets
        ? this.accepted.get(id(dependencies.owner!.handle)) === dependencies.owner &&
          dependencies.targets.every((target) => {
            ++this.counters.referenceDependencyChecks;
            const handle = this.handles.get(target.reference)?.handle;
            return handle?.slot === target.slot && handle.generation === target.generation;
          })
        : dependencies.children!.every(validDependencies);
      checkedDependencies.set(dependencies, valid);
      return valid;
    };
    const reusable = (node: SceneNode, allocating = false): RetainedSubtree | undefined => {
      if (!(records instanceof RecordPatch) || !retainedConfigurations.has(node)) return;
      const cached = this.retainedSubtrees.get(node);
      if (
        cached?.cacheable &&
        this.handles.get(node.reference)?.handle === cached.record.handle &&
        this.accepted.get(id(cached.record.handle)) === cached.record &&
        (allocating || !cached.dependencies || validDependencies(cached.dependencies))
      )
        return cached;
    };
    const allocate = (node: SceneNode, depth: number): void => {
      if (depth > p.limits.depth || seen.size >= p.limits.nodes)
        throw Error('Scene node/depth budget');
      if (seen.has(node.reference)) throw Error('Duplicate scene reference');
      seen.add(node.reference);
      ++this.counters.allocatedVisits;
      // Destination allocation precedes dependency validation. A target later
      // in this batch may change kind/generation outside this retained subtree.
      if (reusable(node, true)) return;
      let binding = this.handles.get(node.reference);
      if (!binding || binding.kind !== node.kind) {
        const handle = this.allocate();
        this.recordCheckpoint?.bindings.push({
          reference: node.reference,
          before: binding,
          handle,
        });
        binding = { kind: node.kind, handle };
        this.handles.set(node.reference, binding);
        this.allocations.set(id(handle), { reference: node.reference, handle });
        this.provisional.add(id(handle));
      }
      node.reference.bind(this, binding.handle);
      for (const child of node.children) allocate(child, depth + 1);
    };
    allocate(root, 0);
    const visit = (
      node: SceneNode,
      parent: NodeHandle | null,
      appGeometry = false,
      depth = 0,
    ): NodeHandle => {
      const h = this.handles.get(node.reference)!.handle,
        o = node.options,
        key = id(h);
      appGeometry ||= !!o.appDrivenGeometry;
      const cached = reusable(node);
      if (cached && cached.record.appGeometry === appGeometry) {
        if (depth + cached.height > p.limits.depth) throw Error('Scene node/depth budget');
        const sameParent =
          cached.record.parent === parent ||
          (!!cached.record.parent && !!parent && id(cached.record.parent) === id(parent));
        const record = sameParent ? cached.record : { ...cached.record, parent };
        records.set(key, record);
        this.retainedSubtrees.set(node, { ...cached, record });
        this.appGeometryNodes += cached.geometry;
        this.counters.skippedSubtreeNodes += cached.count;
        if (cached.dependencies) ++this.counters.referenceSubtreeReuses;
        return h;
      }
      ++this.counters.recordVisits;
      if (appGeometry) ++this.appGeometryNodes;
      if (
        appGeometry &&
        (!Number.isFinite(o.properties?.width) || !Number.isFinite(o.properties?.height))
      )
        throw new Error(
          'AppDrivenBoundary requires explicit finite width and height on every node',
        );
      const children = node.children.map((child) => visit(child, h, appGeometry, depth + 1));
      const retainSubtree = (record: NativeRecord): void => {
        const descendants = node.children.map((child) => this.retainedSubtrees.get(child)!);
        const targets = recordBindingTargets.get(record);
        let dependencies: RetainedDependencies[] | undefined;
        if (targets?.length) dependencies = [{ targets, owner: record }];
        for (const child of descendants)
          if (child.dependencies) (dependencies ??= []).push(child.dependencies);
        this.retainedSubtrees.set(node, {
          record,
          count: 1 + descendants.reduce((sum, child) => sum + child.count, 0),
          height: descendants.reduce((height, child) => Math.max(height, child.height + 1), 0),
          geometry:
            Number(appGeometry) + descendants.reduce((sum, child) => sum + child.geometry, 0),
          cacheable:
            retainedConfigurations.has(node) &&
            (record.fullyCacheable || targets !== undefined) &&
            !o.control &&
            descendants.every((child) => child.cacheable),
          dependencies:
            dependencies?.length === 1
              ? dependencies[0]
              : dependencies
                ? { children: dependencies }
                : undefined,
        });
      };
      const before = this.accepted.get(key);
      const program = bindingPrograms.get(node);
      if (program) {
        if (appGeometry) throw Error('Direct render binding requires Core-owned geometry');
        const references = program.some((command) => bindingFixups.has(command));
        const reused = before && !references && recordBindingPrograms.get(before) === program;
        const projected = reused
          ? undefined
          : program.map((template) => {
              const fixups = bindingFixups.get(template);
              if (fixups) {
                const bytes = template.slice(),
                  view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                for (const fixup of fixups) {
                  const target = this.handles.get(fixup.reference)?.handle;
                  if (!target) throw Error('Direct render reference is not mounted');
                  view.setUint32(fixup.offset, target.slot, true);
                  view.setUint32(fixup.offset + 4, target.generation, true);
                }
                bindingTemplates.add(bytes);
                const previous = before?.configByKind.get(commandKind(bytes));
                return previous && sameRecordConfig(previous, bytes) ? previous : bytes;
              }
              const previous = before?.configByKind.get(commandKind(template));
              return previous && sameRecordConfig(previous, template) ? previous : template;
            });
        const config = projected ?? before!.config;
        if (projected && before) {
          let resetAdded = false;
          const present = new Set(projected.map(commandKind));
          for (const [kind, previous] of before.configByKind) {
            if (present.has(kind)) continue;
            const reset = bindingReset(kind, h);
            if (reset && !sameRecordConfig(previous, reset)) {
              projected.push(reset);
              resetAdded = true;
            }
          }
          if (resetAdded)
            projected.sort(
              (a, b) =>
                bindingCommandOrder.get(commandKind(a))! - bindingCommandOrder.get(commandKind(b))!,
            );
        }
        // Accepted bindings own only their callback record and handle edges.
        // The sealed program is private; patching a provisional handle above
        // never mutates an accepted/in-flight command or the Source batch.
        const ownNode =
          reused && before.node.options === node.options
            ? before.node
            : (Object.freeze({
                __proto__: RenderBinding.prototype,
                reference: node.reference,
                kind: node.kind,
                children: Object.freeze([]),
                options: node.options,
                text: undefined,
                image: undefined,
                editor: undefined,
                editorFlags: 0,
                maximumLength: p.limits.textBytes,
              }) as RenderBinding);
        retainedConfigurations.add(ownNode);
        const sameEdges =
          reused &&
          ((!before.parent && !parent) ||
            (before.parent && parent && id(before.parent) === id(parent))) &&
          before.children.length === children.length &&
          before.children.every((child, index) => id(child) === id(children[index]!));
        const record: NativeRecord =
          sameEdges && ownNode === before.node
            ? before
            : {
                node: ownNode,
                handle: h,
                parent,
                children,
                config,
                configByKind: reused
                  ? before.configByKind
                  : new Map(config.map((bytes) => [commandKind(bytes), bytes])),
                fullyCacheable: !references,
                configInputs: reused ? before.configInputs : new Map(),
                appGeometry: false,
              };
        recordBindingPrograms.set(record, program);
        if (references) {
          const targets: BindingTarget[] = [];
          for (const command of program)
            for (const fixup of bindingFixups.get(command) ?? []) {
              const handle = this.handles.get(fixup.reference)!.handle;
              targets.push({
                reference: fixup.reference,
                slot: handle.slot,
                generation: handle.generation,
              });
            }
          recordBindingTargets.set(record, targets);
        }
        records.set(key, record);
        retainSubtree(record);
        ++this.counters.bindingRecords;
        if (reused) ++this.counters.bindingProgramReuses;
        else this.counters.bindingCommands += config.length;
        return h;
      }
      const payload = retainedPayloads.get(node);
      // Resolve executable configuration every time: a retained follower or
      // paint reference may point to a newly allocated native handle. Records
      // with native control revisions likewise require live encoding.
      if (
        before &&
        (before.node === node ||
          (retainedConfigurations.has(before.node) &&
            ((before.node.options === o && before.node.text === node.text) ||
              (payload !== undefined &&
                retainedPayloads.get(before.node)?.identity === payload.identity)) &&
            before.node.image === node.image &&
            before.node.editor === node.editor &&
            before.node.editorFlags === node.editorFlags &&
            before.node.maximumLength === node.maximumLength)) &&
        retainedConfigurations.has(node) &&
        before.appGeometry === appGeometry &&
        !o.control &&
        before.fullyCacheable
      ) {
        const sameParent =
          before.parent === parent ||
          (!!before.parent && !!parent && id(before.parent) === id(parent));
        const sameChildren =
          before.children.length === children.length &&
          before.children.every(
            (child, index) => child === children[index] || id(child) === id(children[index]!),
          );
        let ownNode = before.node;
        if (ownNode.options !== o || ownNode.text !== node.text) {
          ownNode = sceneConfiguration(
            node.reference,
            node.kind,
            [],
            o,
            node.text,
            node.image,
            node.editor,
            node.editorFlags,
            node.maximumLength,
          );
          retainedConfigurations.add(ownNode);
          if (payload !== undefined) retainedPayloads.set(ownNode, payload);
        }
        const record =
          sameParent && sameChildren && ownNode === before.node
            ? before
            : { ...before, node: ownNode, parent, children };
        records.set(key, record);
        retainSubtree(record);
        ++this.counters.reusedRecords;
        return h;
      }
      const previousConfig = before?.configByKind;
      const owned = retainedConfigurations.has(node);
      const configInputs = new Map<number, unknown>();
      const encode = (kind: number, input: unknown, make: () => Uint8Array): Uint8Array => {
        const defaults = owned ? sharedDefaults.get(kind) : undefined;
        if (defaults) {
          for (const shared of defaults) {
            if (!sameConfigInput(input, shared.input)) continue;
            configInputs.set(kind, shared.input);
            ++this.counters.sharedDefaultConfigs;
            return shared.bytes;
          }
        }
        const previous = previousConfig?.get(kind);
        if (
          previous &&
          before!.configInputs.has(kind) &&
          sameConfigInput(input, before!.configInputs.get(kind))
        ) {
          configInputs.set(kind, before!.configInputs.get(kind));
          return previous;
        }
        const bytes = make();
        const captured = captureConfigInput(input, new Set(), payload?.inputs);
        if (captured !== uncacheableInput) configInputs.set(kind, captured);
        return bytes;
      };
      const layout = appGeometry || o.layout === false ? { enabled: false } : (o.layout ?? {});
      const config = [
        encode(p.commands.properties, o.properties, () => c.properties(h, o.properties ?? {})),
        encode(p.commands.paint, [o.color, o.radius], () =>
          c.paint(h, o.color ?? 0, o.radius ?? 0),
        ),
        encode(p.commands.layout, layout, () => c.layout(h, layout)),
        encode(p.commands.constraints, [o.horizontal, o.vertical], () =>
          c.constraints(
            h,
            o.horizontal ?? { kind: 'unbounded' },
            o.vertical ?? { kind: 'unbounded' },
          ),
        ),
      ];
      const optional = (
        kind: number,
        enabled: unknown,
        make: () => Uint8Array,
        input: unknown = enabled,
      ) => {
        const previous = previousConfig?.get(kind);
        // Never spend a command on an absent default. An explicit reset is
        // retained until ACK; NACK/retry still sees the old immutable bytes.
        if (!enabled && !previous) return;
        const command = encode(kind, input, make);
        if (enabled || (previous && !equalBytes(previous, command))) config.push(command);
      };
      const text = node.text;
      if (text)
        config.push(
          encode(
            p.commands.text,
            [
              node.editor && before ? '' : text.value,
              text.size,
              text.color,
              text.direction,
              !!node.editor && !!before,
            ],
            () =>
              c.text(
                h,
                node.editor && this.accepted.has(id(h)) ? '' : text.value,
                text.size,
                text.color,
                {
                  direction: text.direction,
                  ...(node.editor && this.accepted.has(id(h)) ? { styleOnly: true } : {}),
                },
              ),
          ),
        );
      if (node.kind === 'paragraph' || node.kind === 'editable')
        config.push(
          encode(p.commands.paragraphOptions, o.paragraph, () =>
            c.paragraphOptions(h, o.paragraph ?? null),
          ),
          encode(p.commands.paragraphFont, o.paragraphFont, () =>
            c.paragraphFont(h, o.paragraphFont),
          ),
        );
      else if (o.paragraph) throw Error('Paragraph options require a native paragraph node');
      else if (o.paragraphFont) throw Error('Paragraph fonts require a native paragraph node');
      if (node.kind === 'clip')
        config.push(
          encode(p.commands.clipStyle, o.clipStyle, () => c.clipStyle(h, o.clipStyle ?? null)),
        );
      else if (o.clipStyle) throw Error('Clip styles require a native clip node');
      if (node.editor)
        config.push(c.editor(h, node.editorFlags, node.maximumLength, o.editorViewport));
      optional(p.commands.semantics, o.semantics, () => c.semantics(h, o.semantics ?? null));
      if (node.kind === 'sliver')
        config.push(encode(p.commands.list, o.list, () => c.list(h, o.list ?? null)));
      optional(p.commands.graphics, o.graphics, () => c.graphics(h, o.graphics));
      optional(
        p.commands.nativePaint,
        o.nativePaint?.length,
        () =>
          c.nativePaint(
            h,
            sourceReferenceOptions.has(o)
              ? o.nativePaint?.map((entry) => {
                  const reference = resolveSceneHandle(entry.reference);
                  return reference === undefined || reference === entry.reference
                    ? entry
                    : { ...entry, reference };
                })
              : o.nativePaint,
          ),
        o.nativePaint,
      );
      optional(p.commands.paintPlacement, o.paintPlacement, () =>
        c.paintPlacement(
          h,
          sourceReferenceOptions.has(o) && o.paintPlacement?.reference
            ? {
                ...o.paintPlacement,
                reference: resolveSceneHandle(o.paintPlacement.reference)!,
              }
            : o.paintPlacement,
        ),
      );
      optional(p.commands.layerLink, o.layerLink, () =>
        c.layerLink(h, typeof o.layerLink === 'function' ? o.layerLink() : o.layerLink),
      );
      optional(p.commands.tapRegion, o.tapRegion, () =>
        c.tapRegion(h, typeof o.tapRegion === 'function' ? o.tapRegion() : o.tapRegion),
      );
      optional(p.commands.snapshot, o.snapshot, () => c.snapshot(h, o.snapshot));
      optional(p.commands.layoutBuilder, o.layoutBuilder, () =>
        c.layoutBuilder(h, o.layoutBuilder),
      );
      optional(p.commands.tooltipPosition, o.tooltipPosition, () =>
        c.tooltipPosition(h, o.tooltipPosition),
      );
      optional(p.commands.childAnchor, o.childAnchor, () => c.childAnchor(h, o.childAnchor));
      optional(p.commands.intrinsicSizing, o.intrinsicSizing, () =>
        c.intrinsicSizing(h, o.intrinsicSizing),
      );
      optional(p.commands.layoutProgram, o.layoutProgram, () =>
        c.layoutProgram(h, o.layoutProgram),
      );
      if (o.nativeSparkline)
        config.push(
          c.nativeExtension(
            h,
            o.nativeSparkline.width,
            o.nativeSparkline.height,
            o.nativeSparkline.values,
          ),
        );
      optional(p.commands.listItem, o.listItem, () => c.listItem(h, o.listItem ?? null));
      optional(
        p.commands.gesture,
        o.gestures,
        () => c.gesture(h, o.gestures ?? 0, o.gestureDevices),
        [o.gestures, o.gestureDevices],
      );
      const control = o.control
        ? { ...o.control, revision: o.control.revision ?? this.controlRevisions.get(id(h)) ?? 0n }
        : null;
      optional(p.commands.control, control, () => c.control(h, control));
      const eventPolicy = sceneEventPolicy(o);
      config.push(encode(p.commands.eventPolicy, eventPolicy, () => c.eventPolicy(h, eventPolicy)));
      if (node.kind === 'image') {
        let resource = node.image ? this.resources.get(node.image) : undefined;
        if (node.image && !resource) {
          resource = this.view.allocateResource();
          this.resources.set(node.image, resource);
          this.recordCheckpoint?.resources.push(node.image);
        }
        config.push(
          encode(p.commands.bindResource, resource, () => c.bindResource(h, resource ?? null)),
        );
        if (
          o.imageStyle !== undefined ||
          this.accepted.get(id(h))?.node.options.imageStyle !== undefined
        )
          config.push(
            encode(p.commands.imageStyle, o.imageStyle, () =>
              c.imageStyle(h, o.imageStyle ?? null),
            ),
          );
      }
      if (o.motion)
        config.push(
          c.motion(h, o.motion.id, o.motion.revision ?? 0n, o.motion.opacity, o.motion.seconds),
        );
      const configByKind = new Map(config.map((value) => [commandKind(value), value]));
      // Accepted callback/configuration records do not own the Scene subtree.
      // Topology is already represented by generational handles. Keeping only
      // this node's configuration lets relinked ancestors reuse a record without
      // retaining detached children (including old image/paragraph resources).
      const ownNode = sceneConfiguration(
        node.reference,
        node.kind,
        [],
        node.options,
        node.text,
        node.image,
        node.editor,
        node.editorFlags,
        node.maximumLength,
      );
      if (retainedConfigurations.has(node)) {
        retainedConfigurations.add(ownNode);
        if (payload !== undefined) retainedPayloads.set(ownNode, payload);
      }
      const record: NativeRecord = {
        node: ownNode,
        handle: h,
        parent,
        children,
        config,
        configByKind,
        fullyCacheable: config.every((bytes) => configInputs.has(commandKind(bytes))),
        configInputs,
        appGeometry,
      };
      records.set(key, record);
      retainSubtree(record);
      return h;
    };
    visit(root, null);
    if (records instanceof RecordPatch) {
      records.reconcile(this.handles.get(root.reference)!.handle, this.acceptedRoot);
      this.counters.journalRecords += records.changed.size + records.removed.size;
    }
    return records;
  }
  private wantedResources(desired: RecordSet): Set<ImageResource> {
    if (!(desired instanceof RecordPatch))
      return new Set([...desired.values()].flatMap((r) => (r.node.image ? [r.node.image] : [])));
    const counts = new Map(this.imageCounts);
    const adjust = (resource: ImageResource | undefined, amount: number) => {
      if (resource) counts.set(resource, (counts.get(resource) ?? 0) + amount);
    };
    for (const before of desired.removed.values()) adjust(before.node.image, -1);
    for (const [key, after] of desired.changed) {
      adjust(this.accepted.get(key)?.node.image, -1);
      adjust(after.node.image, 1);
    }
    return new Set([...counts].filter(([, count]) => count > 0).map(([resource]) => resource));
  }
  private diff(desired: RecordSet): Uint8Array[] {
    const changes: Uint8Array[] = [],
      wantedResources = this.wantedResources(desired),
      changed = desired instanceof RecordPatch ? desired.changed : desired;
    for (const resource of wantedResources)
      if (!this.acceptedResources.has(resource) && !this.uploadedResources.has(resource))
        changes.push(c.acquireResource(this.resources.get(resource)!, resource.bytes));
    // Paint-only updates keep the exact handle/parent/child order. Avoid building
    // a shadow topology, preorder and detach/move indexes for that common case.
    const sameHandle = (a: NodeHandle | null, b: NodeHandle | null) =>
      a === b || (!!a && !!b && a.slot === b.slot && a.generation === b.generation);
    let sameTopology =
      desired instanceof RecordPatch
        ? desired.removed.size === 0
        : desired.size === this.accepted.size;
    if (sameTopology)
      for (const [key, record] of changed) {
        const before = this.accepted.get(key);
        if (
          !before ||
          !sameHandle(before.parent, record.parent) ||
          before.children.length !== record.children.length ||
          !before.children.every((child, i) => sameHandle(child, record.children[i]!))
        ) {
          sameTopology = false;
          break;
        }
      }
    if (sameTopology) {
      ++this.counters.topologyReused;
      for (const [key, record] of changed) {
        const before = this.accepted.get(key)!;
        if (before === record) continue;
        for (const config of record.config) {
          const previous = before.configByKind.get(commandKind(config));
          if (!previous || !sameRecordConfig(config, previous))
            changes.push(addressedConfig(config, record.handle));
        }
      }
      for (const resource of this.acceptedResources)
        if (!wantedResources.has(resource))
          changes.push(c.releaseResource(this.resources.get(resource)!));
      return changes;
    }
    const topology = new Map<string, string[]>();
    const siblingsOf = (parent: NodeHandle): string[] => {
      const key = id(parent);
      let children = topology.get(key);
      if (!children) {
        children = this.accepted.get(key)?.children.map(id) ?? [];
        topology.set(key, children);
        this.counters.topologyRecords += children.length + 1;
      }
      return children;
    };
    const detach = (r: NativeRecord) => {
      if (r.parent) {
        const a = siblingsOf(r.parent),
          index = a.indexOf(id(r.handle));
        if (index >= 0) a.splice(index, 1);
      }
    };
    const removed =
      desired instanceof RecordPatch
        ? [...desired.removed.values()]
        : [...this.accepted.values()].filter((r) => !desired.has(id(r.handle)));
    for (const r of removed) detach(r);
    for (const r of removed.reverse()) changes.push(c.destroy(r.handle, !!r.parent));
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
    if (desired instanceof RecordPatch) {
      // New siblings share long retained ancestor paths. Sorting must not walk
      // that same path twice for every comparison (calendar/lazy-list inserts).
      // This memo belongs to this immutable desired patch and expires after diff.
      const depths = new Map<string, number>();
      const depth = (r: NativeRecord): number => {
        const key = id(r.handle),
          cached = depths.get(key);
        if (cached !== undefined) return cached;
        const chain: NativeRecord[] = [];
        let at: NativeRecord | undefined = r;
        while (at && !depths.has(id(at.handle))) {
          if (chain.length > p.limits.depth) throw Error('Scene node/depth budget');
          chain.push(at);
          ++this.counters.creationDepthVisits;
          const parent: NodeHandle | null = at.parent;
          at = parent ? desired.get(id(parent)) : undefined;
          if (parent && !at) throw Error('Scene parent is absent from the desired patch');
        }
        let value = at ? depths.get(id(at.handle))! : -1;
        for (let i = chain.length - 1; i >= 0; --i) {
          if (++value > p.limits.depth) throw Error('Scene node/depth budget');
          depths.set(id(chain[i]!.handle), value);
        }
        return depths.get(key)!;
      };
      for (const record of [...changed.values()]
        .filter((r) => !this.accepted.has(id(r.handle)))
        .sort((a, b) => depth(a) - depth(b))) {
        preorder.push(record);
        record.children.forEach((child, index) => indices.set(id(child), index));
      }
      // Existing parents can introduce new children too.
      for (const record of changed.values())
        record.children.forEach((child, index) => indices.set(id(child), index));
    } else for (const record of desired.values()) if (!record.parent) visit(record);
    // Parents precede new children so construction can also place one child.
    // Configuration follows all creation; paint/reference targets then exist.
    for (const r of preorder) {
      const before = this.accepted.get(id(r.handle));
      let initialFlags = 0;
      if (!before) {
        const layout = r.configByKind.get(p.commands.layout),
          policy = r.configByKind.get(p.commands.eventPolicy);
        if (layout && sameCreationDefault(layout, defaultLayouts[1]!))
          initialFlags |= p.nodeCreationFlags.layoutEnabled;
        else if (layout && sameCreationDefault(layout, defaultLayouts[2]!))
          initialFlags |=
            p.nodeCreationFlags.layoutEnabled | p.nodeCreationFlags.inheritChildConstraints;
        if (policy && sameCreationDefault(policy, defaultPolicies[1]!))
          initialFlags |= p.nodeCreationFlags.canonicalHitTest;
        creationFlags.set(id(r.handle), initialFlags);
        const siblings = r.parent ? siblingsOf(r.parent) : undefined,
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
    for (const r of changed.values()) {
      const before = this.accepted.get(id(r.handle)),
        initialFlags = creationFlags.get(id(r.handle)) ?? 0;
      if (before === r) continue;
      // Creation already establishes these exact Core defaults. Keep their
      // immutable records for later resets, while omitting redundant writes
      // from the atomic transaction (large route replacement uses this path).
      for (const config of r.config) {
        const kind = commandKind(config);
        const previous = before
          ? before.configByKind.get(kind)
          : creationDefault(kind, initialFlags);
        if (
          !previous ||
          !(before ? sameRecordConfig(config, previous) : sameCreationDefault(config, previous))
        )
          changes.push(addressedConfig(config, r.handle));
      }
    }
    // Every parent exists. Populate siblings in declaration order against the
    // topology produced by preceding moves, including cross-parent moves.
    for (const r of changed.values()) {
      const list = siblingsOf(r.handle);
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
    for (const r of changed.values())
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
      })
      .then(() => {
        if (this.rerun && !this.closed) return this.flush();
      });
    return this.running;
  }
  private async perform(): Promise<void> {
    if (this.pending) {
      const pending = this.pending;
      const known = await this.view.queryCommitResult();
      if (known.status === p.statuses.notFound) await this.view.retryCommit();
      else if (known.status !== p.statuses.accepted) {
        pending.blobPlan?.reject();
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
      const checkpoint: NonNullable<SceneWriter['recordCheckpoint']> = {
        nextSlot: this.nextSlot,
        popped: [],
        bindings: [],
        resources: [],
      };
      this.recordCheckpoint = checkpoint;
      let desired: RecordSet;
      const recordsStarted = typeof performance === 'undefined' ? Date.now() : performance.now();
      try {
        desired = this.records(this.root);
        this.counters.recordsMs +=
          (typeof performance === 'undefined' ? Date.now() : performance.now()) - recordsStarted;
        ++this.counters.builds;
      } catch (error) {
        for (const { reference, before, handle } of checkpoint.bindings.reverse()) {
          reference.release(this, handle);
          this.allocations.delete(id(handle));
          this.provisional.delete(id(handle));
          if (before) {
            this.handles.set(reference, before);
            reference.bind(this, before.handle);
          } else this.handles.delete(reference);
        }
        this.free.push(...checkpoint.popped.reverse());
        this.nextSlot = checkpoint.nextSlot;
        for (const resource of checkpoint.resources) {
          this.view.recycleResource(this.resources.get(resource)!, false);
          this.resources.delete(resource);
        }
        throw error;
      } finally {
        this.recordCheckpoint = undefined;
      }
      const wanted = this.wantedResources(desired);
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
      const diffStarted = typeof performance === 'undefined' ? Date.now() : performance.now();
      const rawChanges = this.diff(desired);
      const blobPlan = this.options.immutableBlobs
        ? this.blobJournal.prepare(rawChanges)
        : undefined;
      const changes = blobPlan?.commands ?? rawChanges;
      this.counters.diffMs +=
        (typeof performance === 'undefined' ? Date.now() : performance.now()) - diffStarted;
      if (changes.length > p.limits.commands) {
        blobPlan?.reject();
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
        this.pending = { desired, changes, blobPlan };
        try {
          await this.view.commit(changes);
        } catch (error) {
          if (error instanceof EngineError && error.status === p.statuses.budgetExceeded) {
            if (!this.view.hasPendingTransaction) {
              blobPlan?.reject();
              this.pending = undefined;
            }
            const semantics = [...desired.values()].filter(
              (record) => record.node.options.semantics !== undefined,
            ).length;
            throw new EngineError(
              error.status,
              `Scene budget exceeded: nodes=${desired.size}/${p.limits.nodes}, semantics=${semantics}/${p.limits.semanticsNodes}, commands=${changes.length}/${p.limits.commands}, bytes=${changes.reduce((sum, command) => sum + command.byteLength, 0)}/${p.limits.packetBytes}`,
              error.result,
            );
          }
          if (!(error instanceof EngineError) || error.status !== p.statuses.timedOut) {
            if (!this.view.hasPendingTransaction) {
              blobPlan?.reject();
              this.pending = undefined;
            }
            throw error;
          }
          const known = await this.view.queryCommitResult();
          if (known.status === p.statuses.notFound) await this.view.retryCommit();
          else if (known.status !== p.statuses.accepted)
            throw new EngineError(known.status, 'Scene transaction rejected', known);
        }
      }
      this.adopt(desired, changes);
      if (
        !this.rawSubscribed &&
        [...(desired instanceof RecordPatch ? desired.changed : desired).values()].some(
          (r) => r.node.options.onRawInput,
        )
      ) {
        await this.view.subscribeRaw();
        this.rawSubscribed = true;
      }
      this.pending = undefined;
    } while (this.rerun && !this.closed);
  }
  private adopt(desired: RecordSet, changes: readonly Uint8Array[]): void {
    this.pending?.blobPlan?.accept();
    const blobs = this.blobJournal.diagnostics();
    Object.assign(this.counters, {
      blobRegistrations: blobs.registrations,
      blobBindings: blobs.bindings,
      blobRetired: blobs.retired,
      blobRegisteredBytes: blobs.registeredBytes,
      blobReferencedBytes: blobs.referencedBytes,
      blobRetainedBytes: blobs.bytes,
    });
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
    const affected =
      desired instanceof RecordPatch
        ? new Map(
            [...desired.changed.keys(), ...desired.removed.keys()].flatMap((key) =>
              this.accepted.has(key) ? [[key, this.accepted.get(key)!] as const] : [],
            ),
          )
        : this.accepted;
    for (const [key, before] of affected) {
      const after = desired.get(key);
      if (before.node.editor !== after?.node.editor) before.node.editor?.detach(this);
      if (!after) {
        this.controlRevisions.delete(key);
        const hover = this.hovered.get(key);
        this.hovered.delete(key);
        // A kept-alive Source subtree may leave the native scene without being
        // disposed. Core cannot address it after removal, so complete its last
        // delivered hover before releasing the handle (disposed Sources ignore it).
        if (hover) before.node.options.onGesture?.({ ...hover, kind: 'mouseExit' });
      }
    }
    const retiring =
      desired instanceof RecordPatch
        ? new Set([...this.provisional, ...desired.removed.keys()])
        : this.allocations.keys();
    for (const key of retiring) {
      const allocation = this.allocations.get(key)!;
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
    const resources = this.wantedResources(desired);
    for (const resource of this.acceptedResources)
      if (!resources.has(resource)) {
        const h = this.resources.get(resource)!;
        this.resources.delete(resource);
        this.uploadedResources.delete(resource);
        this.view.recycleResource(h, true);
      }
    const updated = desired instanceof RecordPatch ? desired.changed : desired;
    let observersChanged = false;
    const adjustImage = (resource: ImageResource | undefined, amount: number) => {
      if (!resource) return;
      const count = (this.imageCounts.get(resource) ?? 0) + amount;
      if (count) this.imageCounts.set(resource, count);
      else this.imageCounts.delete(resource);
    };
    for (const [key, before] of affected) {
      this.layoutObservers.delete(key);
      adjustImage(before.node.image, -1);
    }
    for (const [key, record] of updated) {
      if (record.node.options.onLayout) {
        observersChanged ||=
          affected.get(key)?.node.options.onLayout !== record.node.options.onLayout;
        this.layoutObservers.set(key, record);
      }
      adjustImage(record.node.image, 1);
    }
    if (desired instanceof RecordPatch) {
      for (const key of desired.removed.keys()) this.accepted.delete(key);
      for (const [key, record] of desired.changed) this.accepted.set(key, record);
    } else this.accepted = desired;
    this.provisional.clear();
    for (const record of updated.values()) if (!record.parent) this.acceptedRoot = record.handle;
    this.acceptedResources = resources;
    for (const r of updated.values()) r.node.editor?.attach(this, r.handle);
    if (observersChanged) {
      ++this.layoutDemand;
      if (this.eventsStarted) this.requestEvents();
    }
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
    let current = observationNode(frame, node);
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
      current = observationNode(frame, parent);
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
  async pollEvents(waitForObservation = true): Promise<void> {
    if (this.closed || this.polling) return;
    this.polling = true;
    let state: EngineResponse;
    try {
      // Drain the bounded input queue before optional scene observations. The
      // latter can be large and must not hold admitted input behind two RPCs.
      state = await this.view.pollInteractionEvents();
      if (this.closed) return;
      // A seek can request new children without moving the published offset.
      // Keep this demand across coalesced polls until geometry is observed.
      if (state.events.some((event) => event.kind === p.events.needChildren)) ++this.layoutDemand;
      this.semanticState = state;
      this.options.onState?.(state);
      await this.deliverInput(state);
      if (state.interactionCount > 0) this.eventRequested = true;
      if (this.closed) return;
    } finally {
      this.polling = false;
    }
    // Two consistency roles, each with one in-flight read and one newest
    // demand. A large published tree never queues ahead of selected Source
    // layout. Their base/version sequences remain independent in the client.
    this.observationLanes.layout.pending = state;
    this.observationLanes.publication.pending = state;
    const layout = this.drainObservations('layout');
    const publication = this.drainObservations('publication');
    if (waitForObservation) await Promise.all([layout, publication]);
  }
  private drainObservations(kind: 'layout' | 'publication'): Promise<void> {
    const lane = this.observationLanes[kind];
    if (!lane.running) {
      lane.running = Promise.resolve()
        .then(async () => {
          while (lane.pending && !this.closed) {
            const pending = lane.pending;
            lane.pending = undefined;
            if (kind === 'layout') await this.observeLayout(pending);
            else await this.observeScene(pending);
          }
        })
        .finally(() => {
          lane.running = undefined;
        })
        .then(() => {
          // Completion can race the last poll after the loop's final check.
          // Preserve that last demand without waiting for another OS input.
          if (lane.pending && !this.closed) return this.drainObservations(kind);
        });
      void lane.running.catch((error) => {
        if (!this.closed) this.options.onError?.(error);
      });
    }
    return lane.running;
  }
  private async observeScene(state: EngineResponse): Promise<void> {
    let observed = state;
    const publication = this.semanticPublication;
    if (
      this.options.onPublication &&
      (!publication ||
        publication.publication !== state.publication ||
        publication.metrics !== state.metrics ||
        publication.device !== state.device ||
        publication.visible !== state.visible ||
        publication.focused !== state.focused ||
        publication.focusWork !== state.focusWork ||
        publication.editingWork !== state.editingWork ||
        publication.controlWork !== state.controlWork ||
        (!this.options.appObservations && publication.consumedThrough !== state.consumedThrough))
    ) {
      const started = typeof performance === 'undefined' ? Date.now() : performance.now();
      const publication = await (this.options.appObservations
        ? this.view.observeApp(p.opcodes.semanticsSnapshot)
        : this.view.request(p.opcodes.semanticsSnapshot));
      const elapsed =
        (typeof performance === 'undefined' ? Date.now() : performance.now()) - started;
      ++this.counters.publicationObservations;
      this.counters.publicationObservationMs += elapsed;
      this.counters.maxPublicationObservationMs = Math.max(
        this.counters.maxPublicationObservationMs,
        elapsed,
      );
      if (this.closed) return;
      observed = publication;
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
    // A newer input poll may already have advanced focus/metrics/control
    // state. An older observation must not rewind those fences.
    if (this.semanticState === state) {
      this.semanticState = observed;
      this.options.onState?.(observed);
    }
    this.options.onAfterEvents?.();
  }
  private async observeLayout(state: EngineResponse): Promise<void> {
    let observed = state;
    const observers = [...this.layoutObservers.values()];
    const layout = this.layoutObservation;
    const demand = this.layoutDemand;
    if (
      observers.length &&
      (!layout ||
        this.observedLayoutDemand !== demand ||
        layout.activePreparation !== observed.activePreparation ||
        layout.metrics !== observed.metrics ||
        layout.device !== observed.device ||
        layout.publishedDocument !== observed.publishedDocument ||
        layout.publishedMetrics !== observed.publishedMetrics ||
        layout.publishedDevice !== observed.publishedDevice ||
        layout.property !== observed.property ||
        (!this.options.appObservations &&
          (layout.lastInput !== observed.lastInput ||
            layout.consumedThrough !== observed.consumedThrough)) ||
        layout.focusWork !== observed.focusWork ||
        layout.editingWork !== observed.editingWork ||
        layout.controlWork !== observed.controlWork ||
        layout.fontRevision !== observed.fontRevision ||
        layout.visible !== observed.visible ||
        layout.focused !== observed.focused)
    ) {
      const started = typeof performance === 'undefined' ? Date.now() : performance.now();
      const snapshot = await (this.options.appObservations
        ? this.view.observeApp(
            p.opcodes.layoutSnapshot,
            observers.map((record) => record.handle),
          )
        : this.view.request(p.opcodes.layoutSnapshot));
      const elapsed =
        (typeof performance === 'undefined' ? Date.now() : performance.now()) - started;
      ++this.counters.layoutObservations;
      this.counters.layoutObservationMs += elapsed;
      this.counters.maxLayoutObservationMs = Math.max(
        this.counters.maxLayoutObservationMs,
        elapsed,
      );
      if (this.closed) return;
      observed = snapshot;
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
      if (snapshot.status === p.statuses.ok) {
        this.layoutObservation = snapshot;
        this.observedLayoutDemand = demand;
        for (const record of observers) {
          const node = observationNode(snapshot, record.handle);
          const current = this.accepted.get(id(record.handle));
          if (
            node &&
            !this.closed &&
            current?.node.reference === record.node.reference &&
            current.node.options.onLayout === record.node.options.onLayout
          )
            record.node.options.onLayout!(node, snapshot);
        }
      }
    }
    // A newer input poll may already have advanced focus/metrics/control
    // state. An older observation must not rewind those fences.
    if (this.semanticState === state) {
      this.semanticState = observed;
      this.options.onState?.(observed);
    }
    this.options.onAfterEvents?.();
  }
  private async deliverInput(state: EngineResponse): Promise<void> {
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
              this.accepted.get(this.focusHandle)?.node.options.onFocusChanged ?? this.focusCallback
            )?.(false, event);
            this.focusHandle = handle;
            this.focusCallback = next?.node.options.onFocusChanged;
            this.focusCallback?.(true, event);
          }
        });
        continue;
      }
      if (event.kind === p.events.semanticAction) {
        const action = Object.entries(p.semanticsActions).find(
          ([, v]) => BigInt(v) === event.detail,
        )?.[0] as keyof typeof p.semanticsActions | undefined;
        if (action)
          this.inputEvent(event, undefined, () => {
            // Core can publish the accepted document before this App receives
            // its commit ACK. Resolve both handles at the Source checkpoint,
            // after that ACK has installed new callbacks in accepted. Looking
            // them up during the poll can permanently discard admitted input.
            const record = this.accepted.get(id(event.node)),
              source = this.accepted.get(id(event.semanticSource ?? event.node));
            if (!record && !event.tapRegion) return;
            const perform = () => {
              const current = this.accepted.get(id(event.node)),
                currentSource = source && this.accepted.get(id(source.handle));
              if (
                !this.closed &&
                record &&
                current?.node.reference === record.node.reference &&
                source &&
                currentSource?.node.reference === source.node.reference
              )
                currentSource.node.options.onAction?.(action, event);
            };
            if (this.options.onSemanticAction) this.options.onSemanticAction(event, perform);
            else perform();
          });
        continue;
      }
      const record = this.accepted.get(id(event.node));
      if (!record) continue;
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
          this.inputEvent(event, record, (current) => {
            const gesture: GestureEvent = {
              kind,
              sequence: event.id,
              x: event.x,
              y: event.y,
              value: eventValue(event.detail),
              ...(event.gesture ? { details: event.gesture } : {}),
            };
            const key = id(record.handle);
            if (kind === 'mouseEnter') this.hovered.set(key, gesture);
            else if (kind === 'mouseExit') this.hovered.delete(key);
            current?.node.options.onGesture?.(gesture);
          });
      } else if (event.kind === p.events.editingChanged && record.node.editor) {
        const editing = await this.view.editSnapshot(event.node);
        if (!this.closed)
          this.inputEvent(event, record, (current) => current?.node.editor?.publish(editing));
      }
    }
    this.options.onAfterEvents?.();
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
  private requestEvents(): void {
    if (this.closed) return;
    this.eventRequested = true;
    if (this.eventRunning) return;
    this.eventRunning = true;
    void (async () => {
      try {
        do {
          this.eventRequested = false;
          await this.pollEvents(false);
        } while (this.eventRequested && !this.closed);
      } catch (error) {
        if (!this.closed) this.options.onError?.(error);
      } finally {
        this.eventRunning = false;
      }
    })();
  }
  /** @internal Stop event-driven builds before the owner retires scene resources. */
  async stop(): Promise<void> {
    this.closed = true;
    this.unsubscribeChanges?.();
    this.semanticPublication = this.semanticState = undefined;
    this.layoutObservation = undefined;
    this.observationLanes.layout.pending = undefined;
    this.observationLanes.publication.pending = undefined;
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
    this.blobJournal.clear();
    this.retainedSubtrees = new WeakMap();
    this.layoutObservers.clear();
    this.imageCounts.clear();
    this.provisional.clear();
    this.acceptedRoot = undefined;
    this.hovered.clear();
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
