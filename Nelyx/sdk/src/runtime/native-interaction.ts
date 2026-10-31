// SPDX-License-Identifier: BSD-3-Clause
import {
  PublicNativeEditingSession,
  EditingSession,
  freezeEditing,
  freezeEditingGeometry,
  freezeTextInputGeometry,
  validateEditingContent,
} from '@nelyx/core/ui/editing';
import { freezeEditingConfiguration } from '@nelyx/core/hosting/interaction';
import type { EditingConfiguration, EditingInputState } from '@nelyx/core/hosting/interaction';
const defaultConfiguration = freezeEditingConfiguration();
function throwRetirementFailures(errors: readonly unknown[]): void {
  if (errors.length === 1) throw errors[0];
  if (errors.length) throw new AggregateError(errors, 'Native interaction retirement failed');
}
import { sameOwner } from '@nelyx/core/ui/frame';
import type {
  EditingBinding,
  EditingHost,
  SemanticsHost,
  EditingOptions,
  TextInputAction,
} from '@nelyx/core/hosting/interaction';
import type { SemanticsInputObserver } from '@nelyx/core/hosting/interaction';
import type { PointerEvent, InputFocusRequest } from '@nelyx/core/ui/input';
import type {
  SemanticsNode,
  TextEditingValue,
  ViewOwner,
  EditingGeometry,
  Rect,
  TextInputGeometry,
  TextInputCharacterBounds,
  TextInputGeometryStamp,
  TextInputRangeBounds,
  TextInputHitOptions,
  TextInputHitTest,
} from '@nelyx/core/ui/types';
import type {
  SemanticsAction,
  SemanticsTextAction,
  SemanticsRangeAction,
} from '@nelyx/core/ui/types';
import { freezeSemantics, flattenSemantics } from '@nelyx/core/framework/semantics/semantics';

/** Native props depend on action availability, not the identity of a freshly
 * captured Core callback. Dispatch always resolves the current node below. */
function sameSemantics(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'function' && typeof b === 'function') return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a))
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((value, index) => sameSemantics(value, b[index]))
    );
  if (
    Object.getPrototypeOf(a) !== Object.prototype ||
    Object.getPrototypeOf(b) !== Object.prototype
  )
    return false;
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>,
    keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) && sameSemantics(left[key], right[key]))
  );
}
export interface NativeTextPositionRequest {
  readonly request: number;
  readonly point: { readonly x: number; readonly y: number };
  readonly options: TextInputHitOptions;
  readonly layoutEpoch: number;
  readonly nativeRevision: number;
}
export interface NativeEditorPort {
  readNativeTag?(): number | null;
  replace(
    text: string,
    selection: { start: number; end: number },
    revision?: number,
    request?: number,
  ): void;
  replaceComposing?(
    text: string,
    selection: { start: number; end: number },
    revision: number,
    request?: number,
  ): void;
  updateGeometry?(
    geometry: TextInputGeometry | null,
    text: string,
    characters: TextInputCharacterBounds | null,
    nativeRevision: number,
    selection: Readonly<{ anchor: number; focus: number }>,
  ): void;
  updateCaretBounds?(bounds: TextInputRangeBounds, nativeRevision: number): void;
  updateTextPosition?(request: number, position: TextInputHitTest, nativeRevision: number): void;
  focus(request?: InputFocusRequest): void;
  blur(): void;
  revealCaret?(): void;
}
export interface NativeInteractionPolicy {
  readonly commands: boolean;
  readonly selectionEvents: boolean;
  readonly semantics: 'native-controls' | 'unavailable';
  readonly nativeSnapshots?: boolean;
  readonly compositionReplacement?: boolean;
  readonly geometry?: 'observed' | 'unavailable';
  /** Nonvisual input consumes Core geometry directly, without positioning a backing control. */ readonly inputControl?:
    | 'visual'
    | 'nonvisual';
}
interface AttachedEditor {
  token: object;
  commands: NativeEditorPort;
  generation: number;
}
interface PendingReplacement {
  readonly value: TextEditingValue;
  readonly base: TextEditingValue;
  readonly request: number | undefined;
  readonly cancelComposition: boolean;
  readonly selectionOnly?: boolean;
  retries: number;
}
function sendReplacement(
  port: NativeEditorPort,
  request: PendingReplacement,
  revision: number,
): void {
  const send = request.cancelComposition ? port.replaceComposing : port.replace;
  if (!send) throw new Error('Native composition replacement unavailable');
  const selection = { start: request.value.selection.anchor, end: request.value.selection.focus };
  if (request.request === undefined) send.call(port, request.value.text, selection, revision);
  else send.call(port, request.value.text, selection, revision, request.request);
}
type Editor = (
  | { kind: 'public'; session: PublicNativeEditingSession }
  | { kind: 'observed'; session: EditingSession }
) & {
  changed: (value: TextEditingValue) => void;
  nativeRevision: number;
  nativeFocused?: boolean;
  options: EditingOptions | undefined;
  configuration: EditingConfiguration;
  geometry: EditingGeometry;
  generation: number;
  inputStateKey?: string;
  inputBounds?: Rect;
  pendingReplacement?: PendingReplacement;
  inputGeometry?: TextInputGeometry;
  geometryPublication?: {
    readonly token: object;
    readonly epoch: number | null;
    readonly revision: number;
  };
  inputGeometryValue?: Pick<TextEditingValue, 'text' | 'selection'>;
  characterRequest?: {
    readonly start: number;
    readonly end: number;
    readonly nativeRevision: number;
    readonly layoutEpoch?: number;
  };
  hitRequest?: NativeTextPositionRequest;
  hitRequestSequence?: number;
};
export interface NativeEditingSnapshot {
  readonly text: string;
  readonly anchor: number;
  readonly focus: number;
  readonly revision: number;
  readonly request?: number;
  readonly source: 'native' | 'programmatic';
  readonly composingStart: number;
  readonly composingEnd: number;
  readonly focused?: boolean;
  readonly rejection?: 'stale' | 'composing';
  readonly action?: TextInputAction;
  readonly geometry?: {
    readonly width: number;
    readonly height: number;
    readonly caret: Rect;
    readonly selectionRects: readonly Rect[];
  };
}
/** Each control owns a session and counter; providers declare observed native capabilities. */
export class NativeInteraction {
  private closed = false;
  private lifetime: object | undefined;
  private releaseLifetime: ((errors: unknown[]) => boolean) | undefined;
  private editors = new Map<string, Editor>();
  private ports = new Map<string, AttachedEditor>();
  private nodes = new Map<string, SemanticsNode>();
  private nodeLifetimes = new Map<string, object>();
  private readonly semanticsPorts = new Map<
    string,
    { token: object; readTag: () => number | null }
  >();
  private readonly nodeSnapshots = new WeakMap<SemanticsNode, object>();
  private roots: readonly SemanticsNode[] = [];
  private semanticsNeedsPublish = false;
  private semanticsToken: object | undefined;
  private inputObserver: SemanticsInputObserver | undefined;
  private listeners = new Set<() => void>();
  private version = 0;
  private desiredFocus: string | undefined;
  private desiredFocusRequest:
    | { readonly request: InputFocusRequest | undefined; delivered: boolean }
    | undefined;
  private editorSequence = 0;
  readonly editing: EditingHost;
  readonly semantics: SemanticsHost;
  readonly policy: NativeInteractionPolicy;
  constructor(
    readonly owner: ViewOwner,
    policy: NativeInteractionPolicy,
  ) {
    this.owner = Object.freeze({ ...owner });
    this.policy = Object.freeze({ ...policy });
    this.editing = {
      capabilities: {
        indexUnit: 'utf16',
        composing: policy.nativeSnapshots ? 'observed' : 'unavailable',
        selectionDirection: policy.nativeSnapshots ? 'observed' : 'unavailable',
        geometry: policy.geometry ?? (policy.nativeSnapshots ? 'observed' : 'unavailable'),
      },
      bind: (owner, initial, changed, options) =>
        this.bindEditing(owner, initial, changed, options?.id ?? 'editor', options),
      dispose: () => this.dispose(),
    };
    this.semantics = {
      capability: policy.semantics,
      bind: (nodes, observer) => this.bindSemantics(nodes, observer),
      dispose: () => this.dispose(),
    };
  }
  readonly subscribe = (listener: () => void) => {
    if (this.closed) throw new Error('Native interaction is closed');
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly snapshot = () => this.version;
  /** Native backing/viewport stamps can change while every control stays put. */
  surfaceChanged(): void {
    if (!this.closed) this.publish();
  }
  private publish(): void {
    this.version++;
    // Synchronous native React commits can unsubscribe/remount controls during
    // notification. Iterating the live Set would revisit a re-added listener
    // indefinitely and prevent pointer input and native close from draining.
    const snapshot1 = [...this.listeners];
    for (const listener of snapshot1) if (this.listeners.has(listener)) listener();
  }
  /** Retirement is one publication after all endpoint maps have been cleared.
   * A failing observer cannot leave a later native endpoint on the old owner. */
  private publishRetirement(errors: unknown[]): void {
    this.version++;
    const snapshot2 = [...this.listeners];
    for (const listener of snapshot2)
      if (this.listeners.has(listener))
        try {
          listener();
        } catch (error) {
          errors.push(error);
        }
  }
  private retireEditors(errors: unknown[]): void {
    for (const editor of this.editors.values())
      try {
        editor.session.dispose();
      } catch (error) {
        errors.push(error);
      }
    this.editors.clear();
  }
  get semanticNodes(): readonly SemanticsNode[] {
    return this.roots;
  }
  /** Native input endpoints follow Core bindings, even when clipping removes their semantics nodes. */
  get editorClients(): readonly { readonly id: string; readonly generation: number }[] {
    return [...this.editors].map(([id, editor]) => ({ id, generation: editor.generation }));
  }
  editorInputState(id: string): EditingInputState {
    const editor = this.editors.get(id),
      state = editor?.options?.readInputState?.(),
      node = this.nodes.get(id);
    return (
      state ?? {
        enabled: !!editor && !!node?.enabled,
        focusable: node?.focusable !== false,
        label: node?.name ?? '',
      }
    );
  }
  /** Last successfully committed Core control bounds; unavailable IME geometry is still withdrawn separately. */
  editorInputBounds(id: string): Rect | undefined {
    return this.editors.get(id)?.inputBounds;
  }
  editorNativeTag(id: string): number | null {
    const tag = this.currentPort(id)?.commands.readNativeTag?.();
    return tag !== undefined && tag !== null && Number.isSafeInteger(tag) && tag > 0 ? tag : null;
  }
  private refreshInputState(id: string, editor: Editor): void {
    if (!editor.options?.readInputState) return;
    const state = this.editorInputState(id),
      key = JSON.stringify([state.enabled, state.focusable, state.label]);
    if (editor.inputStateKey !== key) {
      editor.inputStateKey = key;
      this.publish();
    }
  }
  editorValue(id: string): TextEditingValue | undefined {
    return this.editors.get(id)?.session.value;
  }
  editorCoreValue(id: string): ReturnType<NonNullable<EditingOptions['readValue']>> | undefined {
    return this.editors.get(id)?.options?.readValue?.();
  }
  private canAdmitEditorInput(id: string, editor: Editor, port?: AttachedEditor): boolean {
    if (this.closed || this.editors.get(id) !== editor || (port && this.ports.get(id) !== port))
      return false;
    const enabled = editor.options?.readInputState?.().enabled !== false;
    return (
      enabled &&
      !this.closed &&
      this.editors.get(id) === editor &&
      (!port || this.ports.get(id) === port)
    );
  }
  private publishInputGeometry(id: string, editor: Editor): void {
    const attached = this.currentPort(id),
      port = attached?.commands;
    if (!attached || !port?.updateGeometry) return;
    // A clipped eager editor may be visited on every scroll frame. Once this
    // port/revision has withdrawn its coordinates, there is no geometry to
    // validate or query again until Core supplies a new packet. Reattaching a
    // port or observing a native revision still requires a fresh withdrawal.
    const published = editor.geometryPublication;
    if (
      !editor.inputGeometry &&
      published?.token === attached.token &&
      published.epoch === null &&
      published.revision === editor.nativeRevision
    )
      return;
    const revision = editor.nativeRevision,
      basicLive = () =>
        !this.closed &&
        this.editors.get(id) === editor &&
        this.currentPort(id) === attached &&
        editor.nativeRevision === revision;
    const isPublished = (epoch: number | null) => {
      const published = editor.geometryPublication;
      return (
        published?.token === attached.token &&
        published.epoch === epoch &&
        published.revision === revision
      );
    };
    const sendGeometry = (
      value: TextInputGeometry | null,
      text: string,
      characters: TextInputCharacterBounds | null,
      selection: Readonly<{ anchor: number; focus: number }>,
    ) => {
      if (!basicLive()) return;
      const publication = { token: attached.token, epoch: value?.layoutEpoch ?? null, revision };
      editor.geometryPublication = publication;
      try {
        port.updateGeometry!(value, text, characters, revision, selection);
      } catch (error) {
        if (editor.geometryPublication === publication) delete editor.geometryPublication;
        throw error;
      }
    };
    const withdraw = () => {
      if (basicLive() && !isPublished(null))
        sendGeometry(null, editor.session.value.text, null, editor.session.value.selection);
    };
    const geometry = editor.inputGeometry,
      core = editor.options?.readValue?.(),
      snapshot = editor.inputGeometryValue;
    if (!basicLive()) return;
    if (
      !this.canAdmitEditorInput(id, editor, attached) ||
      !geometry ||
      !core ||
      !snapshot ||
      core.text !== editor.session.value.text ||
      core.selection.anchor !== editor.session.value.selection.anchor ||
      core.selection.focus !== editor.session.value.selection.focus ||
      snapshot.text !== core.text ||
      snapshot.selection.anchor !== core.selection.anchor ||
      snapshot.selection.focus !== core.selection.focus
    ) {
      withdraw();
      return;
    }
    const live = () => {
      if (
        !basicLive() ||
        editor.inputGeometry !== geometry ||
        !this.canAdmitEditorInput(id, editor, attached)
      )
        return false;
      const now = editor.options?.readValue?.();
      return (
        basicLive() &&
        this.canAdmitEditorInput(id, editor, attached) &&
        now?.text === core.text &&
        now.selection.anchor === core.selection.anchor &&
        now.selection.focus === core.selection.focus
      );
    };
    const defer = () => {
      if (editor.inputGeometry === geometry) withdraw();
    };
    const matches = (
      value: (TextInputGeometryStamp & { readonly coordinates?: string }) | null | undefined,
    ) =>
      !!value &&
      value.coordinates === 'view-logical' &&
      sameOwner(value.owner, this.owner) &&
      value.layoutEpoch === geometry.layoutEpoch &&
      value.viewportGeneration === geometry.viewportGeneration;
    const current = editor.options?.readCharacterBounds?.(0, 0, geometry);
    if (!live()) {
      defer();
      return;
    }
    if (!matches(current)) {
      withdraw();
      return;
    }
    let characters: TextInputCharacterBounds | null = null,
      caret: TextInputRangeBounds | null = null,
      request = editor.characterRequest,
      hit = editor.hitRequest,
      position: TextInputHitTest | null = null;
    if (
      request &&
      (request.nativeRevision !== revision ||
        request.end > core.text.length ||
        (request.layoutEpoch !== undefined && request.layoutEpoch !== geometry.layoutEpoch))
    ) {
      delete editor.characterRequest;
      request = undefined;
    }
    if (hit && (hit.nativeRevision !== revision || hit.layoutEpoch !== geometry.layoutEpoch)) {
      delete editor.hitRequest;
      hit = undefined;
    }
    if (request) {
      if (request.start === request.end && port.updateCaretBounds) {
        caret = editor.options?.readRangeBounds?.(request.start, request.end, geometry) ?? null;
        if (!live()) {
          defer();
          return;
        }
        if (!matches(caret)) {
          withdraw();
          return;
        }
        if (
          caret!.rangeStart !== request.start ||
          caret!.rangeEnd !== request.end ||
          ![caret!.rect.x, caret!.rect.y, caret!.rect.width, caret!.rect.height].every(
            Number.isFinite,
          ) ||
          caret!.rect.width < 0 ||
          caret!.rect.height < 0
        )
          throw new Error('Core caret bounds differ from the requested UTF-16 position');
      } else {
        characters =
          editor.options?.readCharacterBounds?.(request.start, request.end, geometry) ?? null;
        if (!live()) {
          defer();
          return;
        }
        if (!matches(characters)) {
          withdraw();
          return;
        }
        if (
          characters!.rangeStart !== request.start ||
          characters!.rects.length !== request.end - request.start
        )
          throw new Error('Core character bounds differ from the requested UTF-16 range');
      }
    }
    if (hit) {
      position = editor.options?.readTextPosition?.(hit.point, hit.options, geometry) ?? null;
      if (!live()) {
        defer();
        return;
      }
      if (!matches(position)) {
        withdraw();
        return;
      }
      if (position!.status === 'hit') {
        const offset = position!.position,
          high = core.text.charCodeAt(offset - 1),
          low = core.text.charCodeAt(offset);
        if (
          !Number.isSafeInteger(offset) ||
          offset < 0 ||
          offset > core.text.length ||
          (high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff) ||
          !['upstream', 'downstream'].includes(position!.affinity)
        )
          throw new Error('Core text hit is outside its UTF-16 boundary');
      } else if (position!.status !== 'miss') throw new Error('Invalid Core text hit result');
    }
    if (!isPublished(geometry.layoutEpoch) || characters !== null) {
      sendGeometry(geometry, core.text, characters, Object.freeze({ ...core.selection }));
      if (!live()) {
        defer();
        return;
      }
    }
    if (request && editor.characterRequest === request) {
      if (caret) {
        port.updateCaretBounds!(caret, revision);
        if (!live()) {
          defer();
          return;
        }
      }
      if (editor.characterRequest === request) delete editor.characterRequest;
    }
    if (hit && position && editor.hitRequest === hit) {
      port.updateTextPosition!(hit.request, position, revision);
      if (!live()) {
        defer();
        return;
      }
      if (editor.hitRequest === hit) delete editor.hitRequest;
    }
  }
  private inputRequestTarget(token: object, nativeRevision: number, layoutEpoch?: number) {
    const entry = [...this.ports].find(([, port]) => port.token === token),
      editor = entry ? this.editors.get(entry[0]) : undefined;
    if (
      this.closed ||
      !entry ||
      !editor ||
      entry[1].generation !== editor.generation ||
      nativeRevision !== editor.nativeRevision ||
      !this.canAdmitEditorInput(entry[0], editor) ||
      this.ports.get(entry[0]) !== entry[1] ||
      nativeRevision !== editor.nativeRevision
    )
      return;
    if (layoutEpoch !== undefined) {
      if (!Number.isSafeInteger(layoutEpoch) || layoutEpoch <= 0)
        throw new Error('Invalid native input geometry epoch');
      if (editor.inputGeometry?.layoutEpoch !== layoutEpoch) return;
    }
    return { id: entry[0], editor, port: entry[1].commands };
  }
  requestCharacterBounds(
    token: object,
    start: number,
    end: number,
    nativeRevision: number,
    layoutEpoch?: number,
  ): boolean {
    const target = this.inputRequestTarget(token, nativeRevision, layoutEpoch);
    if (!target) return false;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      end > target.editor.session.value.text.length
    )
      throw new Error('Native character bounds request is outside its UTF-16 buffer');
    target.editor.characterRequest = {
      start,
      end,
      nativeRevision,
      ...(layoutEpoch === undefined ? {} : { layoutEpoch }),
    };
    this.publishInputGeometry(target.id, target.editor);
    return true;
  }
  requestTextPosition(token: object, query: NativeTextPositionRequest): boolean {
    const target = this.inputRequestTarget(token, query.nativeRevision, query.layoutEpoch);
    if (!target || !target.port.updateTextPosition || !target.editor.options?.readTextPosition)
      return false;
    if (
      !Number.isSafeInteger(query.request) ||
      query.request <= 0 ||
      ![query.point.x, query.point.y].every(Number.isFinite) ||
      (query.options.nearest !== undefined && typeof query.options.nearest !== 'boolean') ||
      (query.options.roundNearest !== undefined && typeof query.options.roundNearest !== 'boolean')
    )
      throw new Error('Invalid native text position request');
    if (query.request <= (target.editor.hitRequestSequence ?? 0)) return false;
    target.editor.hitRequestSequence = query.request;
    target.editor.hitRequest = Object.freeze({
      ...query,
      point: Object.freeze({ ...query.point }),
      options: Object.freeze({ ...query.options }),
    });
    this.publishInputGeometry(target.id, target.editor);
    return true;
  }
  editorAction(id: string): TextInputAction {
    const editor = this.editors.get(id);
    return editor?.options?.action ?? (editor?.configuration.multiline ? 'enter' : 'done');
  }
  editorConfiguration(id: string): EditingConfiguration {
    return this.editors.get(id)?.configuration ?? defaultConfiguration;
  }
  editorGeneration(id: string): number {
    return this.editors.get(id)?.generation ?? 0;
  }
  isCurrentNode(node: SemanticsNode): boolean {
    return !this.closed && this.nodes.get(node.id) === node;
  }
  /** Native actions can arrive after another paint snapshot of the same control. */
  isLiveNodeSnapshot(node: SemanticsNode): boolean {
    const token = this.nodeSnapshots.get(node);
    return (
      !this.closed &&
      token !== undefined &&
      this.nodes.has(node.id) &&
      this.nodeLifetimes.get(node.id) === token
    );
  }
  private currentPort(id: string) {
    const port = this.ports.get(id);
    return port && port.generation === this.editors.get(id)?.generation ? port : undefined;
  }
  node(id: string, role: SemanticsNode['role']): SemanticsNode | undefined {
    const node = this.nodes.get(id);
    if (node && node.role !== role) throw new Error('Native semantics role mismatch');
    return node;
  }
  acquireServices(): { editing: EditingHost; semantics: SemanticsHost; release(): void } {
    if (this.closed || this.lifetime || this.editors.size || this.semanticsToken)
      throw new Error('Native interaction services already owned');
    const token = {};
    this.lifetime = token;
    let live = true;
    const current = () => {
      if (!live || this.closed || this.lifetime !== token)
        throw new Error('Native interaction service lifetime closed');
    };
    const retire = (errors: unknown[]): boolean => {
      if (!live) return false;
      live = false;
      if (this.lifetime !== token) return false;
      this.lifetime = undefined;
      this.releaseLifetime = undefined;
      this.desiredFocus = undefined;
      this.desiredFocusRequest = undefined;
      this.retireEditors(errors);
      this.nodes.clear();
      this.nodeLifetimes.clear();
      this.roots = [];
      this.semanticsToken = undefined;
      this.inputObserver = undefined;
      this.semanticsNeedsPublish = false;
      return true;
    };
    const release = () => {
      const errors: unknown[] = [];
      if (retire(errors)) this.publishRetirement(errors);
      throwRetirementFailures(errors);
    };
    this.releaseLifetime = retire;
    return {
      release,
      editing: {
        capabilities: this.editing.capabilities,
        bind: (owner, initial, changed, options) => {
          current();
          return this.bindEditing(owner, initial, changed, options?.id ?? 'editor', options);
        },
        dispose: release,
      },
      semantics: {
        capability: this.semantics.capability,
        bind: (nodes, observer) => {
          current();
          return this.bindSemantics(nodes, observer);
        },
        dispose: release,
      },
    };
  }
  private bindEditing(
    owner: ViewOwner,
    initial: TextEditingValue,
    changed: (value: TextEditingValue) => void,
    id: string,
    options?: EditingOptions,
  ): EditingBinding {
    if (
      this.closed ||
      !id ||
      this.editors.has(id) ||
      !sameOwner(owner, this.owner) ||
      !sameOwner(owner, initial.session)
    )
      throw new Error('Duplicate/mismatched native editor session');
    const configuration = freezeEditingConfiguration(options?.configuration),
      geometry: EditingGeometry = Object.freeze({ status: 'unavailable' }),
      generation = ++this.editorSequence;
    const editor: Editor = this.policy.nativeSnapshots
      ? {
          kind: 'observed',
          session: new EditingSession(owner, freezeEditing(initial)),
          changed,
          nativeRevision: 0,
          options,
          configuration,
          geometry,
          generation,
        }
      : {
          kind: 'public',
          session: new PublicNativeEditingSession(owner, freezeEditing(initial)),
          changed,
          nativeRevision: 0,
          options,
          configuration,
          geometry,
          generation,
        };
    this.editors.set(id, editor);
    const current = () => {
      if (this.closed || this.editors.get(id) !== editor)
        throw new Error('Native editor session closed');
      return editor.session;
    };
    const replaceControl = (value: TextEditingValue) =>
      this.currentPort(id)?.commands.replace(value.text, {
        start: Math.min(value.selection.anchor, value.selection.focus),
        end: Math.max(value.selection.anchor, value.selection.focus),
      });
    if (this.policy.commands && editor.kind === 'public') replaceControl(initial);
    const binding: EditingBinding = {
      read: () => current().value,
      updateGeometry: (geometry) => {
        current();
        this.refreshInputState(id, editor);
        current();
        if (geometry === null) {
          delete editor.inputGeometry;
          delete editor.inputGeometryValue;
          delete editor.characterRequest;
          delete editor.hitRequest;
          this.publishInputGeometry(id, editor);
          return;
        }
        const snapshot = freezeTextInputGeometry(geometry);
        if (!sameOwner(snapshot.owner, this.owner)) throw new Error('Foreign Core input geometry');
        // Core snapshots cross this boundary without copying their immutable
        // rectangles again. Reused mutable caller objects still require capture.
        if (editor.inputGeometry === snapshot) {
          this.publishInputGeometry(id, editor);
          return;
        }
        editor.inputGeometry = snapshot;
        const previous = editor.inputBounds,
          bounds = snapshot.bounds,
          moved =
            !previous ||
            previous.x !== bounds.x ||
            previous.y !== bounds.y ||
            previous.width !== bounds.width ||
            previous.height !== bounds.height;
        editor.inputBounds = bounds;
        const core = editor.options?.readValue?.();
        if (core)
          editor.inputGeometryValue = {
            text: core.text,
            selection: Object.freeze({ ...core.selection }),
          };
        this.publishInputGeometry(id, editor);
        // Windows TSF receives coordinates above. Its accessibility tree is
        // published by the completed semantics snapshot, once for the frame.
        // Publishing here rerenders that whole tree once per moving editor,
        // including intermediate snapshots with the previous frame's nodes.
        if (moved && this.policy.inputControl !== 'nonvisual') this.publish();
      },
      readGeometry: () => {
        current();
        return editor.geometry;
      },
      revealCaret: () => {
        current();
        this.currentPort(id)?.commands.revealCaret?.();
      },
      replace: (value, synchronizationRequest) => {
        if (
          synchronizationRequest !== undefined &&
          (!Number.isSafeInteger(synchronizationRequest) || synchronizationRequest <= 0)
        )
          throw new Error('Invalid native synchronization request');
        if (!this.policy.commands) throw new Error('Native replacement unavailable');
        const session = current();
        if (!sameOwner(value.session, owner) || value.revision !== session.value.revision)
          throw new Error('Stale native replacement');
        if (editor.kind === 'observed') {
          const selectionOnly =
            session.value.composing.status === 'active' &&
            value.text === session.value.text &&
            JSON.stringify(value.composing) === JSON.stringify(session.value.composing);
          if (session.value.composing.status === 'active' && !selectionOnly)
            throw new Error('Native composition is active; replacement rejected');
          const snapshot = freezeEditing(value),
            port = this.currentPort(id);
          const request: PendingReplacement = {
            value: snapshot,
            base: session.value,
            request: synchronizationRequest,
            cancelComposition: false,
            selectionOnly,
            retries: 0,
          };
          editor.pendingReplacement = request;
          if (port)
            try {
              sendReplacement(port.commands, request, editor.nativeRevision);
            } catch (error) {
              if (editor.pendingReplacement === request) delete editor.pendingReplacement;
              throw error;
            }
        } else {
          const next = freezeEditing({
            ...value,
            revision: value.revision + 1,
            source: 'programmatic',
          });
          if (editor.session.replace(next)) {
            replaceControl(next);
            editor.changed(editor.session.value);
          }
        }
      },
      focus: (request) => {
        current();
        const port = this.currentPort(id);
        if (!this.policy.commands) throw new Error('Native focus command unavailable');
        if (
          editor.options?.readInputState?.().enabled === false ||
          this.nodes.get(id)?.focusable === false
        ) {
          if (this.desiredFocus === id) {
            this.desiredFocus = undefined;
            this.desiredFocusRequest = undefined;
          }
          return;
        }
        this.desiredFocus = id;
        const intent = {
          request: request ? Object.freeze({ ...request }) : undefined,
          delivered: false,
        };
        this.desiredFocusRequest = intent;
        if (port) {
          port.commands.focus(intent.request);
          intent.delivered = true;
        }
      },
      blur: () => {
        current();
        if (this.desiredFocus === id) {
          this.desiredFocus = undefined;
          this.desiredFocusRequest = undefined;
        }
        if (!this.policy.commands) throw new Error('Native blur command unavailable');
        this.currentPort(id)?.commands.blur();
      },
      dispose: () => {
        if (this.editors.get(id) !== editor) return;
        // Blur while the native ref is still mounted. Removing the Core binding
        // first fences synchronous native callbacks; a newer focus owner wins.
        const port = this.currentPort(id),
          focused =
            this.desiredFocus === id ||
            (this.desiredFocus === undefined && editor.nativeFocused === true);
        this.editors.delete(id);
        if (this.desiredFocus === id) {
          this.desiredFocus = undefined;
          this.desiredFocusRequest = undefined;
        }
        try {
          if (focused && this.policy.commands) port?.commands.blur();
        } finally {
          editor.session.dispose();
          this.publish();
        }
      },
    };
    if (editor.kind === 'observed' && this.policy.compositionReplacement !== false)
      binding.replaceComposing = (value, synchronizationRequest) => {
        if (
          synchronizationRequest !== undefined &&
          (!Number.isSafeInteger(synchronizationRequest) || synchronizationRequest <= 0)
        )
          throw new Error('Invalid native synchronization request');
        if (!this.policy.commands) throw new Error('Native replacement unavailable');
        const session = current();
        if (!sameOwner(value.session, owner) || value.revision !== session.value.revision)
          throw new Error('Stale native replacement');
        const snapshot = freezeEditing(value),
          port = this.currentPort(id);
        if (snapshot.composing.status !== 'none')
          throw new Error('Replacement must end composition');
        if (port && !port.commands.replaceComposing)
          throw new Error('Native composition replacement unavailable');
        const request: PendingReplacement = {
          value: snapshot,
          base: session.value,
          request: synchronizationRequest,
          cancelComposition: true,
          retries: 0,
        };
        editor.pendingReplacement = request;
        if (port)
          try {
            sendReplacement(port.commands, request, editor.nativeRevision);
          } catch (error) {
            if (editor.pendingReplacement === request) delete editor.pendingReplacement;
            throw error;
          }
      };
    try {
      this.publish();
    } catch (error) {
      this.editors.delete(id);
      editor.session.dispose();
      throw error;
    }
    return binding;
  }
  attachEditor(id: string, token: object, commands: NativeEditorPort): () => void {
    if (this.closed || this.ports.has(id)) throw new Error('Native editor already attached');
    const editor = this.editors.get(id),
      attached = { token, commands, generation: editor?.generation ?? 0 };
    this.ports.set(id, attached);
    try {
      if (editor) {
        editor.geometry = Object.freeze({ status: 'unavailable' });
        delete editor.nativeFocused;
        delete editor.characterRequest;
        delete editor.hitRequest;
        delete editor.hitRequestSequence;
        delete editor.geometryPublication;
        if (editor.kind === 'observed') editor.nativeRevision = 0;
        else editor.session.beginNativeEpoch();
      }
      const value = this.editorValue(id);
      if (value && this.policy.commands && !this.policy.nativeSnapshots)
        commands.replace(value.text, {
          start: Math.min(value.selection.anchor, value.selection.focus),
          end: Math.max(value.selection.anchor, value.selection.focus),
        });
      if (editor?.kind === 'observed' && editor.pendingReplacement)
        sendReplacement(commands, editor.pendingReplacement, editor.nativeRevision);
      if (editor) this.publishInputGeometry(id, editor);
      if (
        this.desiredFocus === id &&
        this.currentPort(id) &&
        editor?.options?.readInputState?.().enabled !== false &&
        this.nodes.get(id)?.focusable !== false
      ) {
        const intent = this.desiredFocusRequest;
        commands.focus(
          intent?.delivered === false ? intent.request : { ...intent?.request, restore: true },
        );
        if (intent) intent.delivered = true;
      }
      if (commands.readNativeTag) this.publish();
    } catch (error) {
      if (this.ports.get(id) === attached) this.ports.delete(id);
      throw error;
    }
    return () => {
      if (this.ports.get(id) === attached) {
        this.ports.delete(id);
        if (commands.readNativeTag) this.publish();
      }
    };
  }
  observe(
    token: object,
    event:
      | { kind: 'text'; text: string; eventCount: number }
      | { kind: 'selection'; start: number; end: number }
      | { kind: 'focus' | 'blur' | 'submit' },
  ): boolean {
    if (this.closed) return false;
    const entry = [...this.ports].find(([, port]) => port.token === token);
    if (!entry) return false;
    const editor = this.editors.get(entry[0]);
    if (!editor || editor.kind !== 'public' || entry[1].generation !== editor.generation)
      return false;
    if (
      (event.kind !== 'blur' && !this.canAdmitEditorInput(entry[0], editor, entry[1])) ||
      this.closed ||
      this.editors.get(entry[0]) !== editor ||
      this.ports.get(entry[0]) !== entry[1]
    )
      return false;
    if (
      (event.kind === 'selection' && !this.policy.selectionEvents) ||
      (event.kind === 'text' && editor.configuration.readOnly)
    )
      return false;
    const accepted =
      event.kind === 'text'
        ? editor.session.nativeText(event.text, event.eventCount)
        : event.kind === 'selection'
          ? editor.session.nativeSelection(event.start, event.end)
          : true;
    if (accepted && (event.kind === 'text' || event.kind === 'selection'))
      editor.changed(editor.session.value);
    if (accepted && (event.kind === 'focus' || event.kind === 'blur')) {
      if (event.kind === 'focus') {
        if (this.desiredFocus !== entry[0]) this.desiredFocusRequest = undefined;
        this.desiredFocus = entry[0];
      } else if (this.desiredFocus === entry[0]) {
        this.desiredFocus = undefined;
        this.desiredFocusRequest = undefined;
      }
      editor.options?.focusChanged?.(event.kind === 'focus');
    }
    if (accepted && event.kind === 'submit') editor.options?.onAction?.(editor.session.value);
    return accepted;
  }
  observeSnapshot(token: object, snapshot: NativeEditingSnapshot): boolean {
    if (this.closed) return false;
    const entry = [...this.ports].find(([, port]) => port.token === token),
      editor = entry ? this.editors.get(entry[0]) : undefined;
    if (
      !editor ||
      editor.kind !== 'observed' ||
      entry![1].generation !== editor.generation ||
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < editor.nativeRevision
    )
      return false;
    const admitted = this.canAdmitEditorInput(entry![0], editor, entry![1]);
    if (
      this.closed ||
      this.editors.get(entry![0]) !== editor ||
      this.ports.get(entry![0]) !== entry![1]
    )
      return false;
    const pending = editor.pendingReplacement,
      request =
        pending && (snapshot.request === undefined || snapshot.request === pending.request)
          ? pending
          : undefined;
    // A retired/disabled input owner may finish its admitted command, including
    // a negative receipt carrying native state. It cannot admit another edit.
    if (
      !admitted &&
      !(request && (snapshot.source === 'programmatic' || snapshot.rejection !== undefined))
    )
      return false;
    if (snapshot.geometry && this.policy.geometry === 'unavailable')
      throw new Error('Native editing geometry is unavailable in this host');
    if (
      snapshot.request !== undefined &&
      (!Number.isSafeInteger(snapshot.request) || snapshot.request <= 0)
    )
      throw new Error('Invalid native synchronization request');
    if (
      snapshot.rejection !== undefined &&
      snapshot.rejection !== 'stale' &&
      snapshot.rejection !== 'composing'
    )
      throw new Error('Invalid native synchronization rejection');
    if (
      !['native', 'programmatic'].includes(snapshot.source) ||
      !(
        (snapshot.composingStart === -1 && snapshot.composingEnd === -1) ||
        (Number.isInteger(snapshot.composingStart) &&
          Number.isInteger(snapshot.composingEnd) &&
          snapshot.composingStart >= 0 &&
          snapshot.composingEnd >= snapshot.composingStart)
      )
    )
      throw new Error('Invalid native composing/source snapshot');
    const value = freezeEditing({
      text: snapshot.text,
      selection: { anchor: snapshot.anchor, focus: snapshot.focus },
      revision: editor.session.value.revision + 1,
      session: this.owner,
      source: snapshot.source,
      composing:
        snapshot.composingStart < 0
          ? { status: 'none' }
          : { status: 'active', start: snapshot.composingStart, end: snapshot.composingEnd },
    });
    const geometry = freezeEditingGeometry(
      snapshot.geometry
        ? {
            ...snapshot.geometry,
            status: 'observed',
            coordinates: 'control-local',
            nativeRevision: snapshot.revision,
          }
        : { status: 'unavailable' },
    );
    if (snapshot.action !== undefined && snapshot.action !== this.editorAction(entry![0]))
      throw new Error('Unexpected native input action');
    const previous = editor.session.value;
    const documentChanged =
        value.text !== previous.text ||
        value.selection.anchor !== previous.selection.anchor ||
        value.selection.focus !== previous.selection.focus,
      compositionChanged = JSON.stringify(value.composing) !== JSON.stringify(previous.composing);
    const contentChanged = documentChanged || compositionChanged;
    // The first OS observation resolves an unavailable composition capability
    // to none. It advances native observation state without replacing newer
    // Core commands. Active begin/end/range changes remain real native input.
    const nativeInputChanged =
      documentChanged ||
      (compositionChanged &&
        (previous.composing.status === 'active' || value.composing.status === 'active'));
    if (
      request &&
      snapshot.source === 'programmatic' &&
      snapshot.rejection === undefined &&
      (value.text !== request.value.text ||
        value.selection.anchor !== request.value.selection.anchor ||
        value.selection.focus !== request.value.selection.focus)
    )
      throw new Error('Native synchronization acknowledgement differs from the requested value');
    const unchanged =
      !!request &&
      value.text === request.base.text &&
      value.selection.anchor === request.base.selection.anchor &&
      value.selection.focus === request.base.selection.focus;
    const retry =
      admitted &&
      !!request &&
      snapshot.rejection === 'stale' &&
      unchanged &&
      request.retries < 3 &&
      (request.cancelComposition ||
        (request.selectionOnly &&
          JSON.stringify(value.composing) === JSON.stringify(request.base.composing)) ||
        value.composing.status === 'none');
    if (snapshot.revision === editor.nativeRevision) {
      // A TSF rejection is a receipt, not another document edit. It can carry
      // the revision that the focused endpoint has already reported.
      if (
        !pending ||
        snapshot.request !== pending.request ||
        snapshot.source !== 'programmatic' ||
        snapshot.rejection === undefined
      )
        return false;
      if (
        contentChanged ||
        snapshot.action !== undefined ||
        snapshot.geometry !== undefined ||
        (snapshot.focused ?? false) !== (editor.nativeFocused ?? false)
      )
        throw new Error('Native rejection changed its document without a revision');
      if (retry) {
        request!.retries++;
        const port = this.currentPort(entry![0]);
        if (port) sendReplacement(port.commands, request!, editor.nativeRevision);
      } else {
        delete editor.pendingReplacement;
        if (request!.request !== undefined)
          editor.options?.synchronizationRejected?.(
            request!.request,
            snapshot.rejection === 'stale' && unchanged && request!.retries >= 3
              ? 'retry-limit'
              : snapshot.rejection,
          );
      }
      return true;
    }
    if (
      request &&
      !retry &&
      (snapshot.rejection !== undefined || snapshot.source === 'programmatic')
    )
      delete editor.pendingReplacement;
    editor.nativeRevision = snapshot.revision;
    if (
      editor.configuration.readOnly &&
      snapshot.source === 'native' &&
      snapshot.text !== editor.session.value.text
    )
      return false;
    const accepted = editor.session.update(value);
    if (accepted) {
      editor.geometry = geometry;
      if (
        (nativeInputChanged &&
          snapshot.source === 'native' &&
          this.canAdmitEditorInput(entry![0], editor, entry![1])) ||
        (snapshot.source === 'programmatic' &&
          snapshot.rejection === undefined &&
          (snapshot.request === undefined || request !== undefined))
      )
        editor.changed(editor.session.value);
      // Initial/unmodified false geometry is not a rejection of an in-flight
      // focus request. Only actual native focus transitions change Core focus.
      if (
        this.editors.get(entry![0]) === editor &&
        this.ports.get(entry![0]) === entry![1] &&
        snapshot.focused !== undefined &&
        (!snapshot.focused || this.canAdmitEditorInput(entry![0], editor, entry![1]))
      ) {
        const previous = editor.nativeFocused;
        editor.nativeFocused = snapshot.focused;
        if (previous !== snapshot.focused && (previous !== undefined || snapshot.focused)) {
          if (snapshot.focused) {
            if (this.desiredFocus !== entry![0]) this.desiredFocusRequest = undefined;
            this.desiredFocus = entry![0];
          } else if (this.desiredFocus === entry![0]) {
            this.desiredFocus = undefined;
            this.desiredFocusRequest = undefined;
          }
          editor.options?.focusChanged?.(snapshot.focused);
        }
      }
      if (
        snapshot.action !== undefined &&
        value.composing.status !== 'active' &&
        this.canAdmitEditorInput(entry![0], editor, entry![1])
      )
        editor.options?.onAction?.(value);
    }
    // Geometry/focus also advances Android's snapshot revision. Retry only an
    // unchanged editing value; intervening text/selection always wins. A retry
    // remains a command, never an optimistic controller acknowledgement.
    if (
      retry &&
      accepted &&
      this.canAdmitEditorInput(entry![0], editor, entry![1]) &&
      editor.pendingReplacement === request
    ) {
      const port = this.currentPort(entry![0]);
      request!.retries++;
      if (port) sendReplacement(port.commands, request!, editor.nativeRevision);
    } else if (
      accepted &&
      request?.request !== undefined &&
      snapshot.rejection !== undefined &&
      this.editors.get(entry![0]) === editor
    )
      editor.options?.synchronizationRejected?.(
        request.request,
        snapshot.rejection === 'stale' && unchanged && request.retries >= 3
          ? 'retry-limit'
          : snapshot.rejection,
      );
    if (accepted && this.editors.get(entry![0]) === editor)
      this.publishInputGeometry(entry![0], editor);
    // Negative receipts complete synchronization separately from Core content.
    return accepted;
  }
  private validated(nodes: readonly SemanticsNode[]): Map<string, SemanticsNode> {
    return new Map(flattenSemantics(nodes).map((node) => [node.id, node]));
  }
  private replaceNodes(next: Map<string, SemanticsNode>): void {
    const lifetimes = new Map<string, object>();
    for (const [id, node] of next) {
      const previous = this.nodes.get(id),
        token =
          previous?.role === node.role &&
          previous.sourceNodeId === node.sourceNodeId &&
          previous.textInputGeneration === node.textInputGeneration
            ? (this.nodeLifetimes.get(id) ?? {})
            : {};
      lifetimes.set(id, token);
      this.nodeSnapshots.set(node, token);
    }
    this.nodeLifetimes = lifetimes;
    this.nodes = next;
  }
  private publishSemantics(): void {
    this.semanticsNeedsPublish = false;
    try {
      this.publish();
    } catch (error) {
      this.semanticsNeedsPublish = true;
      throw error;
    }
  }
  private bindSemantics(nodes: readonly SemanticsNode[], observer?: SemanticsInputObserver) {
    if (this.closed || this.semanticsToken || this.policy.semantics === 'unavailable')
      throw new Error('Native semantics unavailable or already bound');
    const roots = freezeSemantics(nodes),
      next = this.validated(roots),
      token = {};
    this.semanticsToken = token;
    this.inputObserver = observer;
    this.roots = roots;
    this.replaceNodes(next);
    this.publishSemantics();
    return {
      update: (values: readonly SemanticsNode[]) => {
        if (this.semanticsToken !== token) throw new Error('Native semantics closed');
        this.updateSemantics(values);
      },
      dispose: () => {
        if (this.semanticsToken !== token) return;
        this.semanticsToken = undefined;
        this.inputObserver = undefined;
        this.nodes.clear();
        this.nodeLifetimes.clear();
        this.roots = [];
        this.publish();
      },
    };
  }
  updateSemantics(nodes: readonly SemanticsNode[]): void {
    if (this.closed || !this.semanticsToken) throw new Error('Native semantics binding missing');
    const roots = freezeSemantics(nodes),
      next = this.validated(roots),
      changed = this.semanticsNeedsPublish || !sameSemantics(this.roots, roots);
    // Refresh callbacks even when native metadata is unchanged. Mounted controls
    // retain their lifetime token and dispatch through this current node map.
    this.roots = roots;
    this.replaceNodes(next);
    if (changed) this.publishSemantics();
  }
  observeControlPointer(
    snapshot: SemanticsNode,
    event: Omit<PointerEvent, 'viewportGeneration'>,
  ): void {
    if (!this.isLiveNodeSnapshot(snapshot)) return;
    const node = this.nodes.get(snapshot.id);
    if (!node?.enabled) return;
    this.inputObserver?.observePointer?.({
      ...event,
      x: node.bounds.x + event.x,
      y: node.bounds.y + event.y,
    });
  }
  /** One request may wait for a fresh snapshot, but its delivery is consumed
   * before user code or validation can reenter. Invalid deliveries stay retired. */
  performAction(id: string, action: SemanticsAction): boolean {
    const node = this.nodes.get(id);
    if (this.closed || !node?.enabled) return false;
    if (!(node.actions?.[action] ?? (action === 'activate' ? node.activate : undefined)))
      return false;
    const lifetime = this.nodeLifetimes.get(id);
    let performed = false,
      delivered = false;
    const perform = () => {
      if (delivered) return;
      delivered = true;
      const current = this.nodes.get(id);
      if (this.closed || !current?.enabled || this.nodeLifetimes.get(id) !== lifetime) return;
      const callback =
        current.actions?.[action] ?? (action === 'activate' ? current.activate : undefined);
      if (callback) {
        performed = true;
        callback();
      }
    };
    if (this.inputObserver) this.inputObserver.dispatchAction(id, action, perform);
    else perform();
    return performed;
  }
  performTextAction(
    id: string,
    action: SemanticsTextAction,
    revision?: number,
    generation?: number,
  ): boolean {
    const node = this.nodes.get(id);
    if (
      this.closed ||
      !node?.enabled ||
      node.role !== 'text-field' ||
      (revision !== undefined && node.textInputRevision !== revision) ||
      (generation !== undefined && node.textInputGeneration !== generation)
    )
      return false;
    if (action.kind === 'set-text') {
      if (typeof action.text !== 'string' || node.readOnly || !node.textActions?.setText)
        return false;
      try {
        validateEditingContent({
          text: action.text,
          selection: { anchor: action.text.length, focus: action.text.length },
          composing: { status: 'none' },
        });
      } catch {
        return false;
      }
    } else if (action.kind === 'set-selection' || action.kind === 'scroll-range') {
      const text = node.value ?? '',
        valid = (at: number) =>
          Number.isSafeInteger(at) &&
          at >= 0 &&
          at <= text.length &&
          !(
            at > 0 &&
            at < text.length &&
            text.charCodeAt(at - 1) >= 0xd800 &&
            text.charCodeAt(at - 1) <= 0xdbff &&
            text.charCodeAt(at) >= 0xdc00 &&
            text.charCodeAt(at) <= 0xdfff
          );
      if (action.kind === 'set-selection') {
        if (!node.textActions?.setSelection || !valid(action.anchor) || !valid(action.focus))
          return false;
      } else if (
        !node.textActions?.scrollRange ||
        !valid(action.start) ||
        !valid(action.end) ||
        action.start > action.end ||
        typeof action.alignToTop !== 'boolean'
      )
        return false;
    } else return false;
    const captured = Object.freeze({ ...action }),
      lifetime = this.nodeLifetimes.get(id),
      sourceRevision = node.textInputRevision,
      text = node.value;
    let performed = false,
      dispatching = true;
    const perform = () => {
      const current = this.nodes.get(id);
      if (
        !dispatching ||
        performed ||
        this.closed ||
        !current?.enabled ||
        current.role !== 'text-field' ||
        this.nodeLifetimes.get(id) !== lifetime ||
        current.textInputRevision !== sourceRevision ||
        current.value !== text
      )
        return;
      if (captured.kind === 'set-text') {
        if (current.readOnly || !current.textActions?.setText) return;
        performed = true;
        current.textActions.setText(captured.text);
      } else if (captured.kind === 'set-selection') {
        if (!current.textActions?.setSelection) return;
        performed = true;
        current.textActions.setSelection({ anchor: captured.anchor, focus: captured.focus });
      } else if (current.textActions?.scrollRange) {
        performed = true;
        current.textActions.scrollRange(captured.start, captured.end, captured.alignToTop);
      }
    };
    try {
      if (this.inputObserver) {
        if (!this.inputObserver.dispatchTextAction) return false;
        this.inputObserver.dispatchTextAction(id, captured, perform);
      } else perform();
      return performed;
    } finally {
      dispatching = false;
    }
  }
  performRangeAction(id: string, action: SemanticsRangeAction, snapshot?: SemanticsNode): boolean {
    const node = this.nodes.get(id),
      value = action.value,
      range = node?.numericRange;
    if (
      action.kind !== 'set-range-value' ||
      this.closed ||
      !node?.enabled ||
      !range ||
      !node.rangeActions?.setValue ||
      !Number.isFinite(value) ||
      value < range.min ||
      value > range.max
    )
      return false;
    // Paint-only Core snapshots refresh callbacks without another native delta.
    // A queued request may keep that control's lifetime, but never an old range.
    if (
      snapshot &&
      (!this.isLiveNodeSnapshot(snapshot) ||
        snapshot.sourceNodeId !== node.sourceNodeId ||
        snapshot.role !== node.role ||
        !sameSemantics(snapshot.numericRange, range))
    )
      return false;
    const captured = Object.freeze({ kind: 'set-range-value' as const, value }),
      lifetime = this.nodeLifetimes.get(id);
    let performed = false,
      dispatching = true;
    const perform = () => {
      if (
        !dispatching ||
        performed ||
        this.closed ||
        this.nodes.get(id) !== node ||
        !node.enabled ||
        this.nodeLifetimes.get(id) !== lifetime
      )
        return;
      performed = true;
      node.rangeActions!.setValue(value);
    };
    try {
      if (this.inputObserver) {
        if (!this.inputObserver.dispatchRangeAction) return false;
        this.inputObserver.dispatchRangeAction(id, captured, perform);
      } else perform();
      return performed;
    } finally {
      dispatching = false;
    }
  }
  activate(id: string): boolean {
    return this.performAction(id, 'activate');
  }
  /** The mounted native control owns its tag; source IDs never stand in for RN tags. */
  attachSemanticsNode(id: string, token: object, readTag: () => number | null): () => void {
    if (this.closed || this.semanticsPorts.has(id))
      throw new Error('Native semantics control is closed or already attached');
    this.semanticsPorts.set(id, { token, readTag });
    return () => {
      if (this.semanticsPorts.get(id)?.token === token) this.semanticsPorts.delete(id);
    };
  }
  nativeSemanticsTag(sourceNodeId: number): number | null {
    if (this.closed || !this.semanticsToken) return null;
    const node = [...this.nodes.values()].find((node) => node.sourceNodeId === sourceNodeId);
    if (!node) return null;
    const tag = this.semanticsPorts.get(node.id)?.readTag();
    return tag !== undefined && tag !== null && Number.isSafeInteger(tag) && tag > 0 ? tag : null;
  }
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    const errors: unknown[] = [];
    this.releaseLifetime?.(errors);
    this.inputObserver = undefined;
    this.desiredFocus = undefined;
    this.desiredFocusRequest = undefined;
    this.retireEditors(errors);
    this.ports.clear();
    this.semanticsPorts.clear();
    this.nodes.clear();
    this.nodeLifetimes.clear();
    this.roots = [];
    this.semanticsToken = undefined;
    this.semanticsNeedsPublish = false;
    try {
      this.publishRetirement(errors);
    } finally {
      this.listeners.clear();
    }
    throwRetirementFailures(errors);
  }
}
