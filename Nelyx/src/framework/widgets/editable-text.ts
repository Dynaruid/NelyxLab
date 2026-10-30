// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed adaptation of selected Doroti Widgets/editable_text.cs controller/session ownership.
import type { InputFocusRequest } from '../../ui/input.ts';
import { AutofillGroup } from './autofill.ts';
import type { AutofillGroupState } from './autofill.ts';
import type { Disposable } from '../../foundation/disposable.ts';
import { getEditableButtonItems, ClipboardStatus } from './text-selection.ts';
import type { TextSelectionControls } from './text-selection.ts';
import { ChangeNotifier } from '../../foundation/notifier.ts';
import type { Listenable } from '../../foundation/notifier.ts';
import { FoundationPlatform } from '../../foundation/platform.ts';
import { invariant, exceptionStack } from '../../foundation/errors.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { ErrorDescription } from '../../foundation/diagnostics.ts';
import type {
  TextEditingValue,
  TextSelection,
  Composition,
  EditingGeometry,
  TextLayoutGeometry,
  TextInputGeometry,
  TextInputCharacterBounds,
  TextInputGeometryStamp,
  TextInputRangeBounds,
  TextInputHitOptions,
  TextInputHitTest,
  SemanticsTextActions,
} from '../../ui/types.ts';
import { freezeEditingGeometry } from '../../ui/editing.ts';
import {
  freezeEditingConfiguration,
  editingConfigurationKey,
} from '../../hosting/editing-configuration.ts';
import type {
  EditingConfiguration,
  EditingConfigurationOptions,
} from '../../hosting/editing-configuration.ts';
import type {
  EditingBinding,
  TextInputAction,
  EditingSynchronizationRejection,
} from '../../hosting/interaction.ts';
import type { Key } from '../../foundation/key.ts';
import { StatefulWidget, State, Element, RenderObjectWidget } from './framework.ts';
import type { Widget, BuildContext, BuildOwner } from './framework.ts';
import { RenderBox } from '../rendering/object.ts';
import { Scrollable } from './scrollable.ts';
import type { ScrollableState } from './scrollable.ts';
import type { ScrollController } from './scroll-controller.ts';
import { ScrollPhysics } from './scroll-physics.ts';
import { ScrollConfiguration } from './scroll-configuration.ts';
import type { ScrollBehavior } from './scroll-configuration.ts';
import type { ViewportOffset } from '../rendering/viewport-offset.ts';
import { IgnorePointer } from './pointer-blocking.ts';
import { intersect } from '../../ui/geometry.ts';
import { FocusNode } from './focus.ts';
import type { FocusAttachmentOptions, KeyEventResult } from './focus.ts';
import { Action, Actions, ContextAction, DoNothingAction, DismissIntent } from './actions.ts';
import type { Intent, IntentType, ActionHandle } from './actions.ts';
import { ScrollIntent, ScrollIncrementType } from './scrollable-helpers.ts';
import { AxisDirection } from '../painting/basic-types.ts';
import {
  TextEditingValue as SourceEditingValue,
  SelectionChangedCause,
} from '../../services/text-input.ts';
import type { TextSelectionDelegate } from '../../services/text-input.ts';
import { TextRange } from '../../ui/text-range.ts';
import { Focus, ExcludeFocus } from './focus-scope.ts';
import { DirectionalFocusAction, DirectionalFocusIntent } from './focus-traversal.ts';
import { TextFieldTapRegion } from './tap-region.ts';
import type { TapRegionCallback, TapRegionUpCallback } from './tap-region.ts';
import type { PointerDownEvent, PointerUpEvent } from '../gestures/events.ts';
import { MediaQuery } from './app-data.ts';
import { snapshotEditingContent, TextEditingDelta } from '../../services/input-formatters.ts';
import type { EditingContent, TextInputFormatter } from '../../services/input-formatters.ts';
import { RenderEditable, validateEditableLinePolicy } from '../rendering/editable.ts';
import type {
  EditableTextLayout,
  EditableLinePolicy,
  EditablePaintValue,
  EditableSelectionLinks,
} from '../rendering/editable.ts';
import { TextPainter } from '../painting/text-painter.ts';
import { TextSpan } from '../painting/text-span.ts';
import type { TextStyle } from '../painting/text-style.ts';
import type { TextAlign } from '../../ui/typography.ts';
import { resolveTextConfiguration } from './text-input.ts';
import { DefaultSelectionStyle } from './default-selection-style.ts';
import { freezeEditorStyle } from '../../hosting/editor-style.ts';
import type { EditorStyle } from '../../hosting/editor-style.ts';
import {
  RawGestureDetector,
  GestureRecognizerFactoryWithHandlers,
} from './raw-gesture-detector.ts';
import type {
  GestureRecognizerFactories,
  GestureRecognizerType,
  GestureRecognizerFactory,
} from './raw-gesture-detector.ts';
import {
  TapAndPanGestureRecognizer,
  TapAndHorizontalDragGestureRecognizer,
} from '../gestures/tap-and-drag.ts';
import { LongPressGestureRecognizer } from '../gestures/long-press.ts';
import { TapGestureRecognizer } from '../gestures/tap.ts';
import { DragStartBehavior } from '../gestures/recognizer.ts';
import { Ticker } from '../animation/ticker.ts';
import { HitTestBehavior } from '../rendering/pointer-listener.ts';
import type { Offset } from '../../ui/geometry.ts';
import { TextPosition } from '../../ui/text-position.ts';
import type { StrutStyle } from '../painting/strut-style.ts';
import type { TextScaler } from '../painting/text-scaler.ts';
import { maybeTickerScheduler } from './ticker-scheduler.ts';
import { GlobalKey } from './global-key.ts';
import { graphemeBoundaries } from '../../foundation/grapheme-boundaries.ts';
import type { KeyEvent } from '../../services/hardware-keyboard.ts';
import {
  CharacterBoundary,
  DocumentBoundary,
  ParagraphBoundary,
} from '../../services/text-boundary.ts';
import type { TextBoundary } from '../../services/text-boundary.ts';
import { textEditingShortcutMaps } from './text-editing-shortcuts-data.ts';
import * as editingIntents from './text-editing-intents.ts';
import { SelectionOverlay } from './selection-overlay.ts';
import { Overlay } from './overlay.ts';
import { LayerLink } from '../rendering/layer.ts';
import { TextSelectionHandleType } from '../rendering/selection.ts';
import { TextSelection as SourceSelection } from '../../services/text-editing.ts';
import { TextSelectionToolbarAnchors } from './text-selection-toolbar-anchors.ts';
import type { ContextMenuButtonItem } from './context-menu-button-item.ts';
import { ValueNotifier } from '../../foundation/notifier.ts';
import { Clipboard, ClipboardData } from '../../services/clipboard.ts';
import type { TextMagnifierConfiguration } from './magnifier.ts';
import { MagnifierInfo } from './magnifier.ts';
import { Offset as SourceOffset } from '../../ui/offset.ts';
import { Rect as SourceRect } from '../../ui/rect.ts';
import {
  bounds,
  multiply,
  translate,
  captureTransform,
  fullTransform,
  contains,
} from '../../ui/geometry.ts';
import { tryUnprojectMatrix4Point } from '../../ui/matrix4.ts';
import { PointerDeviceKind } from '../../ui/pointer.ts';
export class TextEditingController extends ChangeNotifier {
  private consumer: object | undefined;
  private consumerLease: object | undefined;
  private replaceCommand: ((text: string, selection: TextSelection) => void) | undefined;
  private selectionValue: TextSelection;
  private composition: Composition = { status: 'unavailable' };
  private geometryValue: EditingGeometry = Object.freeze({ status: 'unavailable' });
  private version = 0;
  private textVersion = 0;
  private composingActive = false;
  private undoValues: EditingContent[] = [];
  private redoValues: EditingContent[] = [];
  private committed: EditingContent;
  private pendingHistory:
    | {
        target: EditingContent;
        previous: EditingContent;
        from: EditingContent[];
        to: EditingContent[];
      }
    | undefined;
  private pendingReset: string | undefined;
  private retired = false;
  private pendingReplacement:
    | {
        readonly text: string;
        readonly selection: TextSelection;
        readonly baseText: string;
        readonly baseSelection: TextSelection;
        readonly onApplied: (() => void) | undefined;
      }
    | undefined;
  constructor(
    private textValue = '',
    readonly historyLimit = 100,
  ) {
    super();
    invariant(
      Number.isSafeInteger(historyLimit) && historyLimit >= 0 && historyLimit <= 1000,
      'invalid-undo-limit',
      'History limit must be in 0..1000',
    );
    this.selectionValue = Object.freeze({ anchor: textValue.length, focus: textValue.length });
    this.committed = snapshotEditingContent({
      text: textValue,
      selection: this.selectionValue,
      composing: this.composition,
    });
  }
  get text(): string {
    return this.textValue;
  }
  set text(value: string) {
    this.replace(value, { anchor: value.length, focus: value.length });
  }
  get selection(): TextSelection {
    return this.selectionValue;
  }
  set selection(value: TextSelection) {
    this.replace(this.text, value);
  }
  get composing(): Composition {
    return this.composition;
  }
  get isComposing(): boolean {
    return this.composingActive || this.composition.status === 'active';
  }
  get value(): EditingContent {
    return snapshotEditingContent({
      text: this.text,
      selection: this.selection,
      composing: this.composing,
    });
  }
  /** Monotonic Core content/attachment revision for asynchronous editing commands. */
  get revision(): number {
    return this.version;
  }
  /** Content changes only; preserves text-change evidence across coalesced frames. */
  get textRevision(): number {
    return this.textVersion;
  }
  /** @internal A failed OS cancellation never runs the requested completion. */
  _rejectPendingReplacement(): void {
    this.ensureAlive();
    const changed =
      !!this.pendingReplacement || !!this.pendingHistory || this.pendingReset !== undefined;
    this.pendingReplacement = undefined;
    this.pendingHistory = undefined;
    this.pendingReset = undefined;
    if (changed) {
      this.version++;
      this.notifyListeners();
    }
  }
  get canUndo(): boolean {
    return (
      this.pendingReset === undefined &&
      !this.pendingHistory &&
      !this.isComposing &&
      this.undoValues.length > 0
    );
  }
  get canRedo(): boolean {
    return (
      this.pendingReset === undefined &&
      !this.pendingHistory &&
      !this.isComposing &&
      this.redoValues.length > 0
    );
  }
  get geometry(): EditingGeometry {
    return this.geometryValue;
  }
  attach(consumer: object, replace?: (text: string, selection: TextSelection) => void): () => void {
    this.ensureAlive();
    invariant(
      !this.consumer,
      'editor-controller-in-use',
      'A TextEditingController belongs to one mounted EditableText',
    );
    const lease = {};
    this.consumer = consumer;
    this.consumerLease = lease;
    this.replaceCommand = replace;
    this.version++;
    return () => {
      if (this.consumerLease === lease) {
        this.consumer = undefined;
        this.consumerLease = undefined;
        this.replaceCommand = undefined;
        this.pendingReplacement = undefined;
        this.composingActive = false;
        this.pendingHistory = undefined;
        this.pendingReset = undefined;
        this.composition = Object.freeze({ status: 'unavailable' });
        this.geometryValue = Object.freeze({ status: 'unavailable' });
        this.committed = this.value;
        this.version++;
      }
    };
  }
  /** Core accepts ordinary commands synchronously. Active OS composition must
   * finish before a cancellation/replacement can report native completion. */
  replace(text: string, selection: TextSelection, onApplied?: () => void): void {
    this.ensureAlive();
    const next = snapshotEditingContent({ text, selection, composing: { status: 'none' } }),
      request = {
        text,
        selection: next.selection,
        baseText: this.text,
        baseSelection: this.selection,
        onApplied,
      };
    this.pendingReplacement = request;
    try {
      if (this.isComposing) {
        invariant(
          this.replaceCommand,
          'composition-active',
          'Cannot cancel composition without its owning OS connection',
        );
        this.replaceCommand(text, next.selection);
        return;
      }
      const lease = this.consumerLease,
        revision = this.version + 1,
        errors: unknown[] = [];
      try {
        this.accept(next, { status: 'unavailable' }, false, 'programmatic');
      } catch (error) {
        errors.push(error);
      }
      // A listener/completion may retire the owner or issue a newer command.
      if (!this.retired && this.consumerLease === lease && this.version === revision)
        try {
          this.replaceCommand?.(text, next.selection);
        } catch (error) {
          errors.push(error);
        }
      if (errors.length === 1) throw errors[0];
      if (errors.length)
        throw new AggregateError(errors, 'Core editing command and OS synchronization failed');
    } catch (error) {
      if (this.pendingReplacement === request) this.pendingReplacement = undefined;
      throw error;
    }
  }
  /** @internal A selection command retains the last observed composing range. */
  _updateUserSelection(selection: TextSelection, onApplied: () => void): void {
    this.ensureAlive();
    invariant(
      !this.pendingReplacement,
      'composition-cancellation-pending',
      'Selection cannot supersede an unfinished OS cancellation',
    );
    const content = snapshotEditingContent({ ...this.value, selection }),
      revision = this.version + 1,
      lease = this.consumerLease;
    this.accept(content, this.geometryValue, this.composingActive, 'programmatic');
    if (!this.retired && lease === this.consumerLease && revision === this.version) onApplied();
  }
  receive(
    value: TextEditingValue,
    geometry: EditingGeometry = { status: 'unavailable' },
    composingActive = value.composing.status === 'active',
  ): void {
    this.ensureAlive();
    const content = snapshotEditingContent(value),
      observed = freezeEditingGeometry(geometry);
    // Programmatic acknowledgements describe transport synchronization. Only
    // an outstanding composition cancellation can still complete Core state.
    if (this.consumer && value.source === 'programmatic' && !this.pendingReplacement) {
      this.geometryValue = observed;
      if (
        value.text === this.text &&
        (composingActive !== this.composingActive ||
          JSON.stringify(value.composing) !== JSON.stringify(this.composition))
      )
        this.accept(
          { ...this.value, composing: value.composing },
          observed,
          composingActive,
          'programmatic',
        );
      return;
    }
    this.accept(content, observed, composingActive, value.source);
  }
  private accept(
    value: EditingContent,
    geometry: EditingGeometry,
    composingActive: boolean,
    source: 'native' | 'programmatic',
  ): void {
    if (value.text !== this.textValue) {
      invariant(
        Number.isSafeInteger(this.textVersion + 1),
        'text-revision-exhausted',
        'Core text revision space is exhausted',
      );
      this.textVersion++;
    }
    this.textValue = value.text;
    this.selectionValue = value.selection;
    this.composition = value.composing;
    this.geometryValue = geometry;
    this.composingActive = composingActive;
    this.version++;
    const request = this.pendingReplacement,
      applied =
        !!request &&
        source === 'programmatic' &&
        !this.isComposing &&
        value.text === request.text &&
        value.selection.anchor === request.selection.anchor &&
        value.selection.focus === request.selection.focus;
    const waiting =
      !!request &&
      !applied &&
      (source === 'native' ||
        (value.text === request.baseText &&
          value.selection.anchor === request.baseSelection.anchor &&
          value.selection.focus === request.baseSelection.focus));
    if (!waiting) this.pendingReplacement = undefined;
    if (!this.isComposing && !waiting) {
      const pending = this.pendingHistory,
        reset = applied && this.pendingReset === value.text;
      this.pendingHistory = undefined;
      this.pendingReset = undefined;
      if (reset) {
        this.undoValues = [];
        this.redoValues = [];
      } else if (applied && pending && value.text === pending.target.text) {
        pending.from.pop();
        pending.to.push(pending.previous);
      } else if (value.text !== this.committed.text) {
        this.undoValues.push(this.committed);
        if (this.undoValues.length > this.historyLimit) this.undoValues.shift();
        this.redoValues = [];
      }
      this.committed = this.value;
    }
    // Form reset establishes its accepted value/interaction flags before
    // controller listeners run. A completion may also retire this controller.
    const errors: unknown[] = [];
    if (applied)
      try {
        request!.onApplied?.();
      } catch (error) {
        errors.push(error);
      }
    if (!this.retired)
      try {
        this.notifyListeners();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1)
      throw new AggregateError(errors, 'Editing completion and listeners failed');
  }
  applyDelta(delta: TextEditingDelta): void {
    const value = delta.apply(this.value);
    invariant(
      value.composing.status !== 'active',
      'composition-active',
      'Programmatic deltas cannot create native composition',
    );
    this.replace(value.text, value.selection);
  }
  private restore(from: EditingContent[], to: EditingContent[]): boolean {
    this.ensureAlive();
    if (this.pendingReset !== undefined || this.pendingHistory || this.isComposing || !from.length)
      return false;
    const target = from[from.length - 1]!;
    this.pendingHistory = { target, previous: this.value, from, to };
    try {
      this.replace(target.text, target.selection);
    } catch (error) {
      this.pendingHistory = undefined;
      throw error;
    }
    return true;
  }
  undo(): boolean {
    return this.restore(this.undoValues, this.redoValues);
  }
  redo(): boolean {
    return this.restore(this.redoValues, this.undoValues);
  }
  clearHistory(): void {
    this.ensureAlive();
    this.pendingHistory = undefined;
    this.undoValues = [];
    this.redoValues = [];
    this.committed = this.value;
  }
  clear(onApplied?: () => void): void {
    this.replace('', { anchor: 0, focus: 0 }, onApplied);
  }
  /** Reset Core history with the accepted value; OS synchronization is separate. */
  reset(text = '', onApplied?: () => void): void {
    this.ensureAlive();
    this.pendingReset = text;
    try {
      this.replace(text, { anchor: text.length, focus: text.length }, onApplied);
    } catch (error) {
      this.pendingReset = undefined;
      throw error;
    }
  }
  /** Host clipboard is passed explicitly; unsupported platforms do not silently copy. */
  async copy(clipboard: { writeText(text: string): Promise<void> }): Promise<void> {
    const { anchor, focus } = this.selection;
    await clipboard.writeText(this.text.slice(Math.min(anchor, focus), Math.max(anchor, focus)));
  }
  async paste(clipboard: { readText(): Promise<string> }): Promise<void> {
    this.ensureAlive();
    const version = this.version,
      text = await clipboard.readText();
    if (version !== this.version) return;
    const { anchor, focus } = this.selection;
    const start = Math.min(anchor, focus),
      end = Math.max(anchor, focus);
    this.replace(this.text.slice(0, start) + text + this.text.slice(end), {
      anchor: start + text.length,
      focus: start + text.length,
    });
  }
  async cut(clipboard: { writeText(text: string): Promise<void> }): Promise<void> {
    this.ensureAlive();
    const version = this.version,
      { anchor, focus } = this.selection,
      start = Math.min(anchor, focus),
      end = Math.max(anchor, focus);
    await clipboard.writeText(this.text.slice(start, end));
    if (version === this.version)
      this.replace(this.text.slice(0, start) + this.text.slice(end), {
        anchor: start,
        focus: start,
      });
  }
  selectAll(): void {
    this.selection = { anchor: 0, focus: this.text.length };
  }
  override dispose(): void {
    invariant(
      !this.consumer,
      'editor-controller-in-use',
      'Unmount EditableText before disposing its controller',
    );
    super.dispose();
    this.retired = true;
    this.version++;
    this.pendingReplacement = undefined;
    this.undoValues = [];
    this.redoValues = [];
  }
}
export interface EditableTextOptions {
  readonly groupId?: NonNullable<unknown>;
  readonly onTapOutside?: TapRegionCallback | null;
  readonly onTapUpOutside?: TapRegionUpCallback | null;
  readonly configuration?: EditingConfigurationOptions;
  readonly action?: TextInputAction;
  readonly onEditingComplete?: () => void;
  readonly onSubmitted?: (text: string) => void;
  readonly onChanged?: (text: string) => void;
  readonly inputFormatters?: readonly TextInputFormatter[];
  /** Painted through the owning View's Core paragraph engine. */
  readonly textStyle?: TextStyle;
  readonly textAlign?: TextAlign;
  readonly textDirection?: 'ltr' | 'rtl';
  readonly cursorColor?: number;
  readonly selectionColor?: number;
  readonly strutStyle?: StrutStyle;
  readonly textScaler?: TextScaler;
  readonly cursorWidth?: number;
  readonly cursorHeight?: number;
  readonly selectionControls?: TextSelectionControls | null;
  readonly enableInteractiveSelection?: boolean;
  readonly onSelectionChanged?:
    | ((selection: SourceSelection, cause: SelectionChangedCause | null) => void)
    | null;
  readonly contextMenuBuilder?:
    | ((context: BuildContext, state: EditableTextState) => Widget)
    | null;
  readonly magnifierConfiguration?: TextMagnifierConfiguration;
  readonly minHeight?: number;
  readonly enabled?: boolean;
  readonly autofocus?: boolean;
  readonly minLines?: number | null;
  readonly maxLines?: number | null;
  readonly expands?: boolean;
  readonly scrollController?: ScrollController | null;
  readonly scrollPhysics?: ScrollPhysics | null;
  readonly scrollBehavior?: ScrollBehavior | null;
  readonly restorationId?: string | null;
}
function editableLinePolicy(options: EditableTextOptions | undefined): EditableLinePolicy {
  const maxLines =
    options?.maxLines === undefined
      ? options?.configuration?.multiline
        ? null
        : 1
      : options.maxLines;
  const policy = {
    maxLines,
    minLines: options?.minLines ?? null,
    expands: options?.expands ?? false,
  };
  validateEditableLinePolicy(policy);
  invariant(
    options?.configuration?.multiline === undefined ||
      options.configuration.multiline === (maxLines !== 1),
    'conflicting-editor-lines',
    'Editing configuration and maxLines must agree on multiline',
  );
  return Object.freeze(policy);
}
export class EditableText extends StatefulWidget {
  static readonly getEditableButtonItems = getEditableButtonItems;
  constructor(
    readonly id: string,
    readonly controller: TextEditingController,
    readonly label: string,
    readonly focusNode?: FocusNode,
    readonly height = 48,
    key: Key | null = null,
    readonly inputOptions?: EditableTextOptions,
  ) {
    super(key);
    invariant(
      inputOptions?.groupId !== null,
      'invalid-editor-group',
      'EditableText groupId must not be null',
    );
    const policy = editableLinePolicy(inputOptions);
    freezeEditingConfiguration({
      ...inputOptions?.configuration,
      multiline: policy.maxLines !== 1,
    });
  }
  get groupId(): NonNullable<unknown> {
    return this.inputOptions?.groupId ?? EditableText;
  }
  get enableInteractiveSelection(): boolean {
    return this.inputOptions?.enableInteractiveSelection ?? true;
  }
  get selectionEnabled(): boolean {
    return this.enableInteractiveSelection;
  }
  createState(): EditableTextState {
    return new EditableTextState();
  }
}
export class EditableTextState extends State<EditableText> implements TextSelectionDelegate {
  private readonly renderKey = new GlobalKey('EditableText renderer');
  private readonly scrollableKey = new GlobalKey<ScrollableState>('EditableText scrollable');
  private layoutViewportGeneration = -1;
  private currentInputGeometry(): TextInputGeometry | null {
    if (
      !this.mounted ||
      !(this.context instanceof Element) ||
      !this.context.active ||
      this.context.dirty ||
      this.context.services.readStatus() !== 'open'
    )
      return null;
    const render = this.editableRender(),
      metrics = this.context.services.readMetrics();
    if (
      !render?.attached ||
      !render.hasSize ||
      render.needsLayout ||
      !render.isDisplayed ||
      metrics.viewportGeneration !== this.layoutViewportGeneration
    )
      return null;
    const expected = this.boundConfiguration.obscureText
      ? '•'.repeat(this.widget.controller.text.length)
      : this.widget.controller.text;
    if (render.plainText !== expected) return null;
    return render.readTextInputGeometry(this.context.services.owner, metrics);
  }
  private inputQueryGeometry(expected?: TextInputGeometryStamp): TextInputGeometry | null {
    if (!this.binding || this.widget.inputOptions?.enabled === false) return null;
    const native = this.binding.read(),
      core = this.widget.controller;
    if (
      native.text !== core.text ||
      native.selection.anchor !== core.selection.anchor ||
      native.selection.focus !== core.selection.focus
    )
      return null;
    const geometry = this.currentInputGeometry();
    return geometry &&
      (!expected ||
        (expected.owner.id === geometry.owner.id &&
          expected.owner.generation === geometry.owner.generation &&
          expected.viewportGeneration === geometry.viewportGeneration &&
          expected.layoutEpoch === geometry.layoutEpoch))
      ? geometry
      : null;
  }
  private projectInputRects(
    geometry: TextInputGeometry,
    localRects: readonly SourceRect[],
  ): readonly import('../../ui/types.ts').Rect[] | null {
    const matrix = captureTransform(geometry.transform),
      rects = localRects.map((rect) =>
        Object.freeze(bounds(multiply(matrix, translate(rect.x, rect.y)), rect)),
      );
    return rects.some(
      (rect) => ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite),
    ) || this.inputQueryGeometry() !== geometry
      ? null
      : Object.freeze(rects);
  }
  private readCharacterBounds(
    start: number,
    end: number,
    expected?: TextInputGeometryStamp,
  ): TextInputCharacterBounds | null {
    const geometry = this.inputQueryGeometry(expected);
    if (!geometry) return null;
    const rects = this.projectInputRects(
      geometry,
      this.renderEditable.getCharacterBounds(start, end),
    );
    if (!rects) return null;
    return Object.freeze({
      coordinates: 'view-logical',
      owner: geometry.owner,
      viewportGeneration: geometry.viewportGeneration,
      layoutEpoch: geometry.layoutEpoch,
      rangeStart: start,
      rects: Object.freeze(rects),
    });
  }
  private readRangeBounds(
    start: number,
    end: number,
    expected?: TextInputGeometryStamp,
  ): TextInputRangeBounds | null {
    const geometry = this.inputQueryGeometry(expected);
    if (!geometry) return null;
    const render = this.renderEditable,
      characters = render.getCharacterBounds(start, end),
      rects = this.projectInputRects(
        geometry,
        start === end
          ? [
              render.getLocalRectForCaret(
                new TextPosition({
                  offset: start,
                  affinity:
                    start === this.widget.controller.selection.focus
                      ? this.selectionAffinity
                      : 'downstream',
                }),
              ),
            ]
          : characters,
      );
    if (!rects) return null;
    let x = Infinity,
      y = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    for (const rect of rects) {
      x = Math.min(x, rect.x);
      y = Math.min(y, rect.y);
      right = Math.max(right, rect.x + rect.width);
      bottom = Math.max(bottom, rect.y + rect.height);
    }
    return Object.freeze({
      coordinates: 'view-logical',
      owner: geometry.owner,
      viewportGeneration: geometry.viewportGeneration,
      layoutEpoch: geometry.layoutEpoch,
      rangeStart: start,
      rangeEnd: end,
      rect: Object.freeze({ x, y, width: right - x, height: bottom - y }),
    });
  }
  private readTextPosition(
    point: Offset,
    options: TextInputHitOptions,
    expected?: TextInputGeometryStamp,
  ): TextInputHitTest | null {
    const geometry = this.inputQueryGeometry(expected);
    if (!geometry) return null;
    const local = tryUnprojectMatrix4Point(
      fullTransform(captureTransform(geometry.transform)),
      point,
    );
    if (!local) return null;
    const position =
      options.nearest || contains(geometry.clip, point)
        ? this.renderEditable.getTextPositionForPoint(local, options)
        : null;
    if (this.inputQueryGeometry() !== geometry) return null;
    const stamp = {
      coordinates: 'view-logical' as const,
      owner: geometry.owner,
      viewportGeneration: geometry.viewportGeneration,
      layoutEpoch: geometry.layoutEpoch,
    };
    return position
      ? Object.freeze({
          ...stamp,
          status: 'hit',
          position: position.offset,
          affinity: position.affinity,
        })
      : Object.freeze({ ...stamp, status: 'miss' });
  }
  private readonly publishInputGeometry = (): void => {
    if (
      !this.binding?.updateGeometry ||
      !this.mounted ||
      !(this.context instanceof Element) ||
      !this.context.active
    )
      return;
    this.binding.updateGeometry(this.currentInputGeometry());
  };

  private metricPainter: TextPainter | undefined;
  private lineMetrics:
    | { readonly geometry: TextLayoutGeometry; readonly baselines: EditorBaselines }
    | undefined;
  private fontMetricsDirty = false;
  private fontSubscription:
    | {
        readonly fonts: Listenable;
        readonly owner: BuildOwner;
        readonly notify: () => void;
        installing: boolean;
        retired: boolean;
      }
    | undefined;
  private removeSystemFonts(): void {
    const subscription = this.fontSubscription;
    this.fontSubscription = undefined;
    if (!subscription) return;
    subscription.retired = true;
    if (!subscription.installing) subscription.fonts.removeListener(subscription.notify);
  }
  private updateSystemFonts(): void {
    const owner =
        this.context instanceof Element && this.context.active ? this.context.owner : null,
      fonts = owner?.systemFonts ?? null;
    if (!this.fontSubscription && !fonts) return;
    if (this.fontSubscription?.owner === owner && this.fontSubscription.fonts === fonts) return;
    this.fontMetricsDirty = true;
    this.removeSystemFonts();
    if (
      !owner ||
      !fonts ||
      !this.mounted ||
      !(this.context instanceof Element) ||
      !this.context.active ||
      this.context.owner !== owner ||
      owner.services.readStatus() !== 'open'
    )
      return;
    const subscription = {
      fonts,
      owner,
      installing: true,
      retired: false,
      notify: () => {
        if (
          !this.mounted ||
          !(this.context instanceof Element) ||
          !this.context.active ||
          this.context.owner !== owner ||
          owner.services.readStatus() !== 'open' ||
          this.fontSubscription !== subscription
        )
          return;
        // Retirement happens in build, outside the notifier's listener traversal.
        this.fontMetricsDirty = true;
        this.setState(() => {});
      },
    };
    this.fontSubscription = subscription;
    try {
      fonts.addListener(subscription.notify);
    } catch (error) {
      if (this.fontSubscription === subscription) this.fontSubscription = undefined;
      subscription.retired = true;
      try {
        fonts.removeListener(subscription.notify);
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Editor font subscription and cleanup failed');
      }
      throw error;
    } finally {
      subscription.installing = false;
    }
    if (subscription.retired || this.fontSubscription !== subscription)
      fonts.removeListener(subscription.notify);
  }
  private autofocusHandled = false;
  private binding: EditingBinding | undefined;
  private boundConfiguration: EditingConfiguration = freezeEditingConfiguration();
  private boundLinePolicy: EditableLinePolicy = { minLines: null, maxLines: 1, expands: false };
  private autofillGroup: AutofillGroupState | null = null;
  private autofillClient: Disposable | undefined;
  private desiredConfiguration(): EditingConfiguration {
    const group = AutofillGroup.maybeOf(this.context);
    return freezeEditingConfiguration({
      ...this.widget.inputOptions?.configuration,
      multiline: editableLinePolicy(this.widget.inputOptions).maxLines !== 1,
      ...(this.widget.inputOptions?.enabled === false ? { readOnly: true } : {}),
      ...(group ? { autofillSection: group.section } : {}),
    });
  }
  private boundAction: TextInputAction = 'done';
  private pendingConfiguration = false;
  private reconfigurationQueued = false;
  private focus: FocusNode | undefined;
  private focusRestorationToken: object = {};
  private keyboardRequest: InputFocusRequest | undefined;
  private ownFocus = false;
  private releaseController: (() => void) | undefined;
  private attachedController: TextEditingController | undefined;
  private connection = 0;
  private pendingSynchronization:
    | (EditingContent & { readonly retries: number; readonly selectionOnly?: boolean })
    | undefined;
  private synchronizationInFlight:
    | {
        readonly request: number;
        readonly revision: number;
        readonly value: EditingContent;
        readonly retries: number;
        readonly selectionOnly: boolean;
      }
    | undefined;
  private synchronizationSequence = 0;
  private synchronizationQueued = false;
  private cancellationPending = false;
  private synchronizeCore(text: string, selection: TextSelection): void {
    if (this.widget.controller.isComposing) this.cancellationPending = true;
    this.pendingSynchronization = {
      ...snapshotEditingContent({ text, selection, composing: { status: 'none' } }),
      retries: 0,
    };
    this.flushSynchronization();
  }
  private synchronizeUserSelection(): void {
    invariant(
      !this.cancellationPending,
      'composition-cancellation-pending',
      'Selection cannot supersede an unfinished OS cancellation',
    );
    this.pendingSynchronization = {
      ...this.widget.controller.value,
      retries: 0,
      selectionOnly: true,
    };
    this.flushSynchronization();
  }
  private synchronizationRejected(request: number, reason: EditingSynchronizationRejection): void {
    const flight = this.synchronizationInFlight;
    if (!flight || flight.request !== request) return;
    this.synchronizationInFlight = undefined;
    if (this.context.services.readStatus() !== 'open') {
      this.pendingSynchronization = undefined;
      this.cancellationPending = false;
      this.widget.controller._rejectPendingReplacement();
      return;
    }
    if (
      (reason === 'stale' || (reason === 'composing' && !this.cancellationPending)) &&
      flight.retries < 3
    ) {
      this.pendingSynchronization ??= {
        ...(this.cancellationPending ? flight.value : this.widget.controller.value),
        ...(flight.selectionOnly
          ? { selectionOnly: true }
          : { composing: { status: 'none' } as const }),
        retries: flight.retries + 1,
      };
      this.queueSynchronization();
      return;
    }
    this.pendingSynchronization = undefined;
    this.cancellationPending = false;
    this.widget.controller._rejectPendingReplacement();
    this.editingCallback('OS input synchronization', () => {
      throw new Error('OS input synchronization rejected: ' + reason);
    });
  }
  private queueSynchronization(): void {
    if (this.synchronizationQueued) return;
    this.synchronizationQueued = true;
    const connection = this.connection;
    void Promise.resolve().then(() => {
      if (connection !== this.connection) return;
      this.synchronizationQueued = false;
      if (this.mounted)
        this.editingCallback('synchronizing Core input', () => this.flushSynchronization());
    });
  }
  private flushSynchronization(): void {
    if (
      this.synchronizationInFlight ||
      !this.pendingSynchronization ||
      this.context.services.readStatus() !== 'open'
    )
      return;
    const binding = this.binding;
    invariant(binding, 'editor-binding-closed', 'Editor binding unavailable');
    const current = binding.read(),
      composing = binding.isComposing ?? current.composing.status === 'active';
    let value = this.pendingSynchronization;
    if (composing && !this.cancellationPending && !value.selectionOnly) return;
    this.pendingSynchronization = undefined;
    if (value.selectionOnly) {
      if (value.text !== current.text) return;
      value = { ...value, composing: current.composing };
    }
    if (
      !this.cancellationPending &&
      current.composing.status !== 'active' &&
      current.text === value.text &&
      current.selection.anchor === value.selection.anchor &&
      current.selection.focus === value.selection.focus
    )
      return;
    const flight = {
      request: ++this.synchronizationSequence,
      revision: current.revision,
      value: snapshotEditingContent(value),
      retries: value.retries,
      selectionOnly: value.selectionOnly === true,
    };
    this.synchronizationInFlight = flight;
    try {
      const next = { ...current, ...flight.value, source: 'programmatic' as const };
      if (composing && !flight.selectionOnly) {
        invariant(
          binding.replaceComposing,
          'composition-active',
          'This host cannot cancel native composition',
        );
        binding.replaceComposing(next, flight.request);
      } else binding.replace(next, flight.request);
    } catch (error) {
      if (this.synchronizationInFlight === flight) {
        this.synchronizationInFlight = undefined;
        if (!this.pendingSynchronization) this.cancellationPending = false;
      }
      throw error;
    }
  }
  private compositionBase: EditingContent | undefined;
  private cursorVisible = true;
  private blink: Disposable | undefined;
  private blinkVisibility: Disposable | undefined;
  private stopBlink(): void {
    this.blink?.dispose();
    this.blink = undefined;
  }
  private syncBlink(reset = true): void {
    this.stopBlink();
    if (reset) this.cursorVisible = true;
    if (
      !this.isCurrentEditingOwner(this.editingIdentity) ||
      !this.focus?.hasPrimaryFocus ||
      this.widget.controller.isComposing ||
      this.widget.controller.selection.anchor !== this.widget.controller.selection.focus ||
      maybeTickerScheduler(this.context)?.visible === false
    )
      return;
    const host = globalThis as unknown as {
      setTimeout?: (callback: () => void, delay: number) => unknown;
      clearTimeout?: (handle: unknown) => void;
    };
    invariant(
      host.setTimeout && host.clearTimeout,
      'missing-cursor-timer',
      'EditableText needs host one-shot timers',
    );
    let active = true;
    const connection = this.connection,
      handle = host.setTimeout(() => {
        if (!active || connection !== this.connection) return;
        active = false;
        this.blink = undefined;
        if (this.isCurrentEditingOwner(this.editingIdentity)) {
          this.setState(() => {
            this.cursorVisible = !this.cursorVisible;
          });
          this.syncBlink(false);
        }
      }, 500);
    this.blink = {
      dispose() {
        if (active) {
          active = false;
          host.clearTimeout!(handle);
        }
      },
    };
  }
  private dragAnchor: number | undefined;
  private selectionAffinity: 'upstream' | 'downstream' = 'downstream';
  private selectionDirectional = false;
  private readonly selectionLinks = {
    start: new LayerLink(),
    end: new LayerLink(),
    toolbar: new LayerLink(),
  };
  private selectionOverlay: SelectionOverlay | undefined;
  private overlayRequested = false;
  private overlayScheduled = false;
  private toolbarRequested = false;
  private readonly startHandleVisible = new ValueNotifier(false);
  private readonly endHandleVisible = new ValueNotifier(false);
  private clipboardStatus = ClipboardStatus.unknown;
  private handleAnchor: number | undefined;
  private handleCollapsed = false;
  private handleDragDy = 0;
  private restoreToolbarAfterDrag = false;
  private selectionDrag:
    | {
        kind: 'pointer' | 'start-handle' | 'end-handle';
        global: SourceOffset;
        text: string;
        focused: boolean;
        focusRequest: InputFocusRequest | undefined;
      }
    | undefined;
  private get selectionFocusRequest(): InputFocusRequest | undefined {
    return this.context instanceof Element
      ? this.context.owner.focus.currentFocusRequest
      : undefined;
  }
  private selectionScrollTicker: Ticker | undefined;
  private selectionScrollElapsed = 0;
  private selectionScrollAncestors(): readonly ScrollableState[] {
    const result: ScrollableState[] = [],
      seen = new Set<ScrollableState>();
    let context = this.context;
    for (let parent = Scrollable.maybeOf(context); parent; parent = Scrollable.maybeOf(context)) {
      invariant(
        !seen.has(parent),
        'cyclic-scrollable-ancestry',
        'EditableText ancestor Scrollables must form a tree',
      );
      seen.add(parent);
      result.push(parent);
      context = parent.context;
    }
    return result;
  }
  private ancestorSelectionScrolls(
    global: SourceOffset,
  ): readonly { state: ScrollableState; velocity: number }[] {
    const result: { state: ScrollableState; velocity: number }[] = [],
      render = this.editableRender();
    if (!render?.attached || !render.hasSize || render.needsLayout || !render.isDisplayed)
      return result;
    const local = this.dragPosition(
      render,
      global,
      this.selectionDrag?.kind === 'pointer' ? 0 : this.handleDragDy,
    );
    if (!local) return result;
    // Reveal only this editor's target, even when the held pointer is over a later sibling.
    const target = render.localToGlobal(local);
    for (const state of this.selectionScrollAncestors()) {
      if (
        !state.mounted ||
        state.resolvedPhysics?.allowSelectionEdgeScrolling === false ||
        (state.resolvedPhysics && !state.resolvedPhysics.shouldAcceptUserOffset(state.position)) ||
        !state.position.hasPixels ||
        !state.position.hasContentDimensions
      )
        continue;
      const box = state.context.findRenderObject();
      if (
        !(box instanceof RenderBox) ||
        !box.attached ||
        !box.hasSize ||
        box.needsLayout ||
        !box.isDisplayed
      )
        continue;
      const point = tryUnprojectMatrix4Point(fullTransform(box.getTransformTo(null)), target);
      if (!point) continue;
      const direction = state.axisDirection,
        vertical = direction === AxisDirection.up || direction === AxisDirection.down,
        extent = vertical ? box.size.height : box.size.width,
        at = vertical ? point.y : point.x,
        overshoot = at < 0 ? at : at > extent ? at - extent : 0,
        reversed = direction === AxisDirection.up || direction === AxisDirection.left;
      const velocity = Math.max(-20, Math.min(20, overshoot)) * 30 * (reversed ? -1 : 1),
        position = state.position;
      if (
        (velocity < 0 && position.pixels > position.minScrollExtent) ||
        (velocity > 0 && position.pixels < position.maxScrollExtent)
      )
        result.push({ state, velocity });
    }
    return result;
  }
  private stopSelectionScroll(): void {
    this.selectionScrollTicker?.dispose();
    this.selectionScrollTicker = undefined;
    this.selectionScrollElapsed = 0;
  }
  private stopSelectionDrag(): void {
    this.stopSelectionScroll();
    this.selectionDrag = undefined;
    this.dragAnchor = undefined;
    this.handleAnchor = undefined;
    this.handleCollapsed = false;
    this.handleDragDy = 0;
    this.selectionOverlay?.hideMagnifier();
  }
  private dragPosition(render: RenderEditable, global: SourceOffset, deltaY = 0): Offset | null {
    const point = tryUnprojectMatrix4Point(fullTransform(render.getTransformTo(null)), global);
    return point
      ? {
          x: Math.max(0, Math.min(render.size.width, point.x)),
          y: Math.max(0, Math.min(render.size.height, point.y + deltaY)),
        }
      : null;
  }
  private selectionScrollVelocity(render: RenderEditable, global: SourceOffset): number {
    const point = tryUnprojectMatrix4Point(fullTransform(render.getTransformTo(null)), global);
    if (!point) return 0;
    const vertical = render.isMultiline,
      extent = vertical ? render.size.height : render.size.width,
      at = vertical
        ? point.y + (this.selectionDrag?.kind === 'pointer' ? 0 : this.handleDragDy)
        : point.x;
    const caret = render.getLocalRectForCaret(
        new TextPosition({
          offset: this.widget.controller.selection.focus,
          affinity: this.selectionAffinity,
        }),
      ),
      edge = Math.min(caret.height / 2, extent / 2),
      overshoot = at < edge ? at - edge : at > extent - edge ? at - extent + edge : 0;
    // The shared selection auto-scroller uses scalar 30 and a 20 logical-pixel step cap.
    return Math.max(-20, Math.min(20, overshoot)) * 30;
  }
  private updateSelectionScroll(): void {
    const drag = this.selectionDrag,
      render = this.editableRender();
    if (
      !drag ||
      !this.focus?.hasPrimaryFocus ||
      !render?.attached ||
      !render.hasSize ||
      render.needsLayout ||
      (!this.selectionScrollVelocity(render, drag.global) &&
        !this.ancestorSelectionScrolls(drag.global).length)
    ) {
      this.stopSelectionScroll();
      return;
    }
    if (this.selectionScrollTicker) return;
    const scheduler = maybeTickerScheduler(this.context);
    if (!scheduler?.visible) return;
    this.selectionScrollElapsed = 0;
    this.selectionScrollTicker = new Ticker(
      scheduler,
      (elapsed) => {
        const current = this.selectionDrag,
          editable = this.editableRender();
        if (
          !this.mounted ||
          !(this.context instanceof Element) ||
          !this.context.active ||
          this.widget.inputOptions?.enabled === false ||
          this.cancellationPending ||
          !this.focus?.hasPrimaryFocus ||
          !current ||
          (this.widget.controller.isComposing && current.kind !== 'pointer') ||
          current.text !== this.widget.controller.text ||
          !editable?.attached
        ) {
          this.stopSelectionDrag();
          return;
        }
        const delta = Math.min(1000 / 30, Math.max(0, elapsed - this.selectionScrollElapsed));
        this.selectionScrollElapsed = elapsed;
        if (!delta || editable.needsLayout) return;
        const at = this.dragPosition(editable, current.global);
        if (!at) {
          this.stopSelectionDrag();
          return;
        }
        const owner = this.editingIdentity,
          revision = this.widget.controller.revision;
        let moved = editable.scrollBy(
          (this.selectionScrollVelocity(editable, current.global) * delta) / 1000,
        );
        if (
          !this.isCurrentEditingOwner(owner) ||
          revision !== this.widget.controller.revision ||
          current !== this.selectionDrag ||
          current.text !== this.widget.controller.text
        ) {
          this.stopSelectionDrag();
          return;
        }
        for (const { state, velocity } of this.ancestorSelectionScrolls(current.global)) {
          const position = state.position,
            before = position.pixels,
            next = Math.max(
              position.minScrollExtent,
              Math.min(position.maxScrollExtent, before + (velocity * delta) / 1000),
            );
          if (next !== before) {
            const owner = this.editingIdentity,
              revision = this.widget.controller.revision;
            position.jumpTo(next);
            if (
              !this.isCurrentEditingOwner(owner) ||
              revision !== this.widget.controller.revision ||
              current !== this.selectionDrag ||
              current.text !== this.widget.controller.text
            ) {
              this.stopSelectionDrag();
              return;
            }
            moved = true;
          }
        }
        if (!moved) {
          this.stopSelectionScroll();
          return;
        }
        this.context.owner.focus.runWithFocusRequest(current.focusRequest, () => {
          if (current.kind === 'pointer') {
            if (!this.selectAt(at, true)) this.stopSelectionDrag();
          } else this.applyHandleDrag(current.kind === 'end-handle', current.global);
        });
        this.queueSelectionOverlay();
      },
      { debugLabel: 'EditableText selection scroll' },
    );
    this.selectionScrollTicker.start();
  }
  private beginTextDrag(global: SourceOffset): void {
    if (!this.selectionEnabled) return;
    this.stopSelectionDrag();
    const render = this.editableRender();
    if (!render?.hasSize || render.needsLayout) return;
    const at = this.dragPosition(render, global);
    if (!at || !this.selectAt(at, false, false, SelectionChangedCause.drag)) return;
    this.selectionDrag = {
      kind: 'pointer',
      global,
      text: this.widget.controller.text,
      focused: this.focus?.hasPrimaryFocus ?? false,
      focusRequest: this.selectionFocusRequest,
    };
    this.updateSelectionScroll();
  }
  private updateTextDrag(global: SourceOffset): void {
    if (this.selectionDrag?.kind !== 'pointer') return;
    const render = this.editableRender();
    if (!render?.hasSize || render.needsLayout) return;
    const at = this.dragPosition(render, global);
    if (!at) {
      this.stopSelectionDrag();
      return;
    }
    this.selectionDrag.global = global;
    this.selectionDrag.focusRequest = this.selectionFocusRequest;
    if (!this.selectAt(at, true)) {
      this.stopSelectionDrag();
      return;
    }
    this.updateSelectionScroll();
  }
  private endTextDrag(): void {
    if (this.selectionDrag?.kind === 'pointer') this.stopSelectionDrag();
  }
  private selectionGestures(): GestureRecognizerFactories {
    if (this.widget.inputOptions?.enabled === false) return new Map();
    invariant(
      this.context instanceof Element,
      'invalid-context',
      'Selection gestures require an Element',
    );
    const binding = this.context.owner.gestureBinding,
      options = { binding, debugOwner: this };
    const tap = (global: SourceOffset, kind: PointerDeviceKind | null) => {
      if (!this.selectionEnabled) {
        this.requestKeyboard();
        return;
      }
      const render = this.editableRender();
      if (!render?.hasSize || render.needsLayout) return;
      const at = tryUnprojectMatrix4Point(fullTransform(render.getTransformTo(null)), global);
      if (!at) return;
      this.stopSelectionDrag();
      this.selectAt(at);
      if (kind === PointerDeviceKind.touch) {
        this.overlayRequested = true;
        this.queueSelectionOverlay();
      }
    };
    return new Map<GestureRecognizerType, GestureRecognizerFactory>([
      [
        TapAndPanGestureRecognizer,
        new GestureRecognizerFactoryWithHandlers(
          TapAndPanGestureRecognizer,
          () =>
            new TapAndPanGestureRecognizer({
              ...options,
              supportedDevices: new Set([PointerDeviceKind.mouse]),
            }),
          (recognizer) => {
            recognizer.dragStartBehavior = DragStartBehavior.down;
            recognizer.onTapUp = (details) => tap(details.globalPosition, details.kind);
            recognizer.onDragStart = (details) => this.beginTextDrag(details.globalPosition);
            recognizer.onDragUpdate = (details) => this.updateTextDrag(details.globalPosition);
            recognizer.onDragEnd = () => this.endTextDrag();
            recognizer.onCancel = () => this.endTextDrag();
          },
        ),
      ],
      [
        TapAndHorizontalDragGestureRecognizer,
        new GestureRecognizerFactoryWithHandlers(
          TapAndHorizontalDragGestureRecognizer,
          () =>
            new TapAndHorizontalDragGestureRecognizer({
              ...options,
              supportedDevices: new Set(
                PointerDeviceKind.values.filter((kind) => kind !== PointerDeviceKind.mouse),
              ),
            }),
          (recognizer) => {
            recognizer.dragStartBehavior = DragStartBehavior.down;
            recognizer.onTapUp = (details) => tap(details.globalPosition, details.kind);
            recognizer.onDragStart = (details) => this.beginTextDrag(details.globalPosition);
            recognizer.onDragUpdate = (details) => this.updateTextDrag(details.globalPosition);
            recognizer.onDragEnd = () => this.endTextDrag();
            recognizer.onCancel = () => this.endTextDrag();
          },
        ),
      ],
      [
        LongPressGestureRecognizer,
        new GestureRecognizerFactoryWithHandlers(
          LongPressGestureRecognizer,
          () =>
            new LongPressGestureRecognizer({
              ...options,
              supportedDevices: new Set([
                PointerDeviceKind.touch,
                PointerDeviceKind.stylus,
                PointerDeviceKind.invertedStylus,
              ]),
            }),
          (recognizer) => {
            recognizer.onLongPressStart = (details) => {
              if (!this.selectionEnabled) return;
              this.stopSelectionDrag();
              this.selectAt(details.localPosition, false, true);
              this.overlayRequested = true;
              this.showToolbar();
              this.handleAnchor = this.selection().start;
              this.handleCollapsed = this.selection().isCollapsed;
              this.restoreToolbarAfterDrag = this.toolbarRequested;
              this.queueSelectionOverlay();
            };
            recognizer.onLongPressMoveUpdate = (details) => {
              if (this.selectionEnabled) this.dragHandle(true, details.globalPosition);
            };
            recognizer.onLongPressEnd = () => this.endHandleDrag();
            recognizer.onLongPressCancel = () => this.endHandleDrag();
          },
        ),
      ],
      [
        TapGestureRecognizer,
        new GestureRecognizerFactoryWithHandlers(
          TapGestureRecognizer,
          () => new TapGestureRecognizer(options),
          (recognizer) => {
            recognizer.onSecondaryTapUp = () => {
              this.focus?.requestFocus();
              this.showToolbar();
            };
          },
        ),
      ],
    ]);
  }

  private selection(): SourceSelection {
    const value = this.widget.controller.selection;
    return new SourceSelection({
      baseOffset: value.anchor,
      extentOffset: value.focus,
      affinity: this.selectionAffinity,
      isDirectional: this.selectionDirectional,
    });
  }
  get renderEditable(): RenderEditable {
    const render = this.editableRender();
    invariant(render, 'missing-editable-render', 'EditableText has no mounted Core renderer');
    return render;
  }
  get contextMenuAnchors(): TextSelectionToolbarAnchors {
    const render = this.renderEditable,
      selection = this.selection(),
      start = render.getLocalRectForCaret(selection.base),
      end = render.getLocalRectForCaret(selection.extent);
    return TextSelectionToolbarAnchors.fromSelection({
      renderBox: render,
      startGlyphHeight: start.height,
      endGlyphHeight: end.height,
      selectionEndpoints: render.getEndpointsForSelection(selection),
    });
  }
  private get selectionEnabled(): boolean {
    return this.widget.selectionEnabled;
  }
  get cutEnabled(): boolean {
    return (
      !this.boundConfiguration.readOnly &&
      !this.boundConfiguration.obscureText &&
      !this.selection().isCollapsed
    );
  }
  get copyEnabled(): boolean {
    return !this.boundConfiguration.obscureText && !this.selection().isCollapsed;
  }
  get pasteEnabled(): boolean {
    return !this.boundConfiguration.readOnly && this.clipboardStatus === ClipboardStatus.pasteable;
  }
  get selectAllEnabled(): boolean {
    if (
      !this.selectionEnabled ||
      (this.boundConfiguration.readOnly && this.boundConfiguration.obscureText)
    )
      return false;
    const selection = this.selection(),
      text = this.widget.controller.text;
    switch (FoundationPlatform.defaultTargetPlatform) {
      case 'macOS':
        return false;
      case 'iOS':
        return text.length > 0 && selection.isCollapsed;
      default:
        return text.length > 0 && !(selection.start === 0 && selection.end === text.length);
    }
  }
  private get selectedText(): string {
    const selection = this.selection();
    return this.widget.controller.text.slice(selection.start, selection.end);
  }
  get lookUpEnabled(): boolean {
    return (
      FoundationPlatform.defaultTargetPlatform === 'iOS' &&
      !this.boundConfiguration.obscureText &&
      this.selectedText.trim().length > 0
    );
  }
  get searchWebEnabled(): boolean {
    return this.lookUpEnabled;
  }
  get shareEnabled(): boolean {
    return (
      ['android', 'iOS'].includes(FoundationPlatform.defaultTargetPlatform) &&
      !this.boundConfiguration.obscureText &&
      this.selectedText.trim().length > 0
    );
  }
  /** There is no observed Live Text availability producer on this host yet. */
  get liveTextInputEnabled(): boolean {
    return false;
  }
  get contextMenuButtonItems(): readonly ContextMenuButtonItem[] {
    if (!this.selectionEnabled) return [];
    const controller = this.widget.controller,
      clipboard = !!this.context.services.binaryMessenger,
      editable = !controller.isComposing,
      identity = this.editingIdentity,
      revision = controller.revision;
    const guard = (command: () => void) => () => {
      if (
        this.isCurrentEditingOwner(identity) &&
        this.widget.controller === controller &&
        controller.revision === revision
      )
        command();
    };
    return getEditableButtonItems({
      clipboardStatus: this.clipboardStatus,
      onCopy:
        this.copyEnabled && clipboard
          ? guard(() => this.copySelection(SelectionChangedCause.toolbar))
          : null,
      onCut:
        this.cutEnabled && editable && clipboard
          ? guard(() => this.cutSelection(SelectionChangedCause.toolbar))
          : null,
      onPaste:
        !this.boundConfiguration.readOnly && editable && clipboard
          ? guard(() => this.observeEditingCommand(this.pasteText(SelectionChangedCause.toolbar)))
          : null,
      onSelectAll: this.selectAllEnabled
        ? guard(() => this.selectAll(SelectionChangedCause.toolbar))
        : null,
      onLookUp: null,
      onSearchWeb: null,
      onShare: null,
      onLiveTextInput: null,
    });
  }
  private observeEditingCommand(operation: Promise<void>): void {
    const identity = this.editingIdentity;
    void operation.catch((error) => {
      if (this.isCurrentEditingOwner(identity))
        this.editingCallback('editing command', () => {
          throw error;
        });
    });
  }
  private clipboard() {
    const messenger = this.context.services.binaryMessenger;
    invariant(
      messenger,
      'missing-binary-messenger',
      'Clipboard commands require the owning app messenger',
    );
    return {
      writeText: (text: string) => Clipboard.setData(new ClipboardData(text), messenger),
      readText: async () => {
        const value = await Clipboard.getData(Clipboard.kTextPlain, messenger);
        return value?.text ?? null;
      },
    };
  }
  private refreshClipboardStatus(): void {
    const messenger = this.context.services.binaryMessenger;
    if (!messenger) return;
    const identity = this.editingIdentity;
    void Clipboard.hasStrings(messenger).then(
      (available) => {
        if (this.isCurrentEditingOwner(identity)) {
          this.clipboardStatus = available
            ? ClipboardStatus.pasteable
            : ClipboardStatus.notPasteable;
          this.selectionOverlay?.markNeedsBuild();
        }
      },
      (error) => {
        if (this.isCurrentEditingOwner(identity))
          this.editingCallback('clipboard availability', () => {
            throw error;
          });
      },
    );
  }
  copySelection(cause: SelectionChangedCause): void {
    if (!this.mounted || !this.copyEnabled) return;
    const identity = this.editingIdentity,
      controller = this.widget.controller,
      value = this.textEditingValue,
      revision = controller.revision;
    this.observeEditingCommand(
      this.clipboard().writeText(value.text.slice(value.selection.start, value.selection.end)),
    );
    if (!this.isCurrentEditingOwner(identity) || controller.revision !== revision) return;
    if (cause === SelectionChangedCause.toolbar) {
      this.bringIntoView(value.selection.extent);
      if (!this.isCurrentEditingOwner(identity) || controller.revision !== revision) return;
      this.hideToolbar(false);
      if (['android', 'fuchsia'].includes(FoundationPlatform.defaultTargetPlatform))
        this.userUpdateTextEditingValue(
          value.copyWith({ selection: SourceSelection.collapsed(value.selection.end) }),
          cause,
        );
    }
    if (this.isCurrentEditingOwner(identity)) this.refreshClipboardStatus();
  }
  private userReplace(text: string, selection: TextSelection): void {
    if (!this.mounted || this.boundConfiguration.readOnly || this.widget.controller.isComposing)
      return;
    this.userUpdateTextEditingValue(
      new SourceEditingValue({
        text,
        selection: new SourceSelection({
          baseOffset: selection.anchor,
          extentOffset: selection.focus,
          affinity: this.selectionAffinity,
        }),
      }),
      SelectionChangedCause.keyboard,
    );
  }
  cutSelection(cause: SelectionChangedCause): void {
    if (!this.mounted || !this.cutEnabled) return;
    const identity = this.editingIdentity,
      controller = this.widget.controller,
      value = this.textEditingValue,
      revision = controller.revision;
    this.observeEditingCommand(
      this.clipboard().writeText(value.text.slice(value.selection.start, value.selection.end)),
    );
    if (!this.isCurrentEditingOwner(identity) || controller.revision !== revision) return;
    this.invokeNestedEditingIntent(
      new editingIntents.ReplaceTextIntent(value, '', value.selection, cause),
    );
    if (!this.isCurrentEditingOwner(identity)) return;
    if (cause === SelectionChangedCause.toolbar) {
      this.scheduleCaretReveal();
      this.hideToolbar();
    }
    this.refreshClipboardStatus();
  }
  async pasteText(cause: SelectionChangedCause): Promise<void> {
    if (!this.mounted || this.boundConfiguration.readOnly) return;
    const identity = this.editingIdentity,
      controller = this.widget.controller,
      text = await this.clipboard().readText();
    if (
      text === null ||
      !this.isCurrentEditingOwner(identity) ||
      this.widget.controller !== controller ||
      this.boundConfiguration.readOnly
    )
      return;
    const value = this.textEditingValue,
      selection = value.selection,
      collapsed = value.copyWith({ selection: SourceSelection.collapsed(selection.end) });
    this.userUpdateTextEditingValue(collapsed.replaced(selection, text), cause);
    if (this.isCurrentEditingOwner(identity) && cause === SelectionChangedCause.toolbar) {
      this.scheduleCaretReveal();
      this.hideToolbar();
    }
  }
  selectAll(cause: SelectionChangedCause): void {
    if (!this.mounted || (this.boundConfiguration.readOnly && this.boundConfiguration.obscureText))
      return;
    const identity = this.editingIdentity,
      value = this.textEditingValue;
    this.userUpdateTextEditingValue(
      value.copyWith({
        selection: new SourceSelection({ baseOffset: 0, extentOffset: value.text.length }),
      }),
      cause,
    );
    if (!this.isCurrentEditingOwner(identity) || cause !== SelectionChangedCause.toolbar) return;
    const platform = FoundationPlatform.defaultTargetPlatform;
    if (['macOS', 'linux', 'windows'].includes(platform)) this.hideToolbar();
    if (!['macOS', 'iOS'].includes(platform)) this.bringIntoView(this.selection().extent);
  }
  hideToolbar(hideHandles = true): void {
    this.toolbarRequested = false;
    if (hideHandles) {
      this.overlayRequested = false;
      this.selectionOverlay?.hide();
    } else this.selectionOverlay?.hideToolbar();
  }
  showToolbar(): boolean {
    if (
      !this.mounted ||
      !this.selectionEnabled ||
      this.widget.inputOptions?.enabled === false ||
      !this.widget.inputOptions?.contextMenuBuilder
    )
      return false;
    this.overlayRequested = true;
    this.toolbarRequested = true;
    this.queueSelectionOverlay();
    this.refreshClipboardStatus();
    return true;
  }
  private queueSelectionOverlay(): void {
    if (
      this.overlayScheduled ||
      !this.mounted ||
      !(this.context instanceof Element) ||
      !this.context.active ||
      (!this.overlayRequested && !this.selectionOverlay)
    )
      return;
    this.overlayScheduled = true;
    const connection = this.connection;
    this.context.owner.postFrame(() => {
      this.overlayScheduled = false;
      if (
        connection === this.connection &&
        this.mounted &&
        this.context instanceof Element &&
        this.context.active
      )
        this.syncSelectionOverlay();
    });
  }
  private syncSelectionOverlay(): void {
    if (
      !this.selectionEnabled ||
      !this.focus?.hasPrimaryFocus ||
      this.widget.inputOptions?.enabled === false ||
      this.widget.controller.isComposing
    ) {
      this.overlayRequested = false;
      this.toolbarRequested = false;
      this.selectionOverlay?.hide();
      return;
    }
    if (!this.overlayRequested) return;
    const render = this.editableRender();
    if (!render?.hasSize || render.needsLayout) return;
    if (!Overlay.maybeOf(this.context)) return;
    const selection = this.selection(),
      endpoints = render.getEndpointsForSelection(selection);
    if (!endpoints.length) return;
    const startType = selection.isCollapsed
        ? TextSelectionHandleType.collapsed
        : endpoints[0]!.direction === 'rtl'
          ? TextSelectionHandleType.right
          : TextSelectionHandleType.left,
      endType = selection.isCollapsed
        ? TextSelectionHandleType.collapsed
        : endpoints.at(-1)!.direction === 'rtl'
          ? TextSelectionHandleType.left
          : TextSelectionHandleType.right,
      start = render.getLocalRectForCaret(new TextPosition({ offset: selection.start })),
      end = render.getLocalRectForCaret(new TextPosition({ offset: selection.end }));
    const visible = (point: SourceOffset) =>
      point.dx >= 0 &&
      point.dx <= render.size.width &&
      point.dy >= 0 &&
      point.dy <= render.size.height;
    this.startHandleVisible.value = visible(endpoints[0]!.point);
    this.endHandleVisible.value = visible(endpoints.at(-1)!.point);
    this.selectionOverlay ??= new SelectionOverlay({
      context: this.renderKey.currentContext!,
      startHandleType: startType,
      endHandleType: endType,
      lineHeightAtStart: start.height,
      lineHeightAtEnd: end.height,
      selectionEndpoints: endpoints,
      selectionControls: this.widget.inputOptions?.selectionControls ?? null,
      startHandleLayerLink: this.selectionLinks.start,
      endHandleLayerLink: this.selectionLinks.end,
      toolbarLayerLink: this.selectionLinks.toolbar,
      startHandlesVisible: this.startHandleVisible,
      endHandlesVisible: this.endHandleVisible,
      onStartHandleDragStart: (details) => this.beginHandleDrag(false, details.globalPosition),
      onStartHandleDragUpdate: (details) => this.dragHandle(false, details.globalPosition),
      onEndHandleDragStart: (details) => this.beginHandleDrag(true, details.globalPosition),
      onEndHandleDragUpdate: (details) => this.dragHandle(true, details.globalPosition),
      onStartHandleDragEnd: () => this.endHandleDrag(),
      onEndHandleDragEnd: () => this.endHandleDrag(),
      onSelectionHandleTapped: () => {
        this.showToolbar();
      },
      ...(this.widget.inputOptions?.magnifierConfiguration
        ? { magnifierConfiguration: this.widget.inputOptions.magnifierConfiguration }
        : {}),
    });
    const overlay = this.selectionOverlay;
    overlay.startHandleType = startType;
    overlay.endHandleType = endType;
    overlay.lineHeightAtStart = start.height;
    overlay.lineHeightAtEnd = end.height;
    overlay.selectionEndpoints = endpoints;
    overlay.showHandles();
    overlay.markNeedsBuild();
    if (
      this.toolbarRequested &&
      this.widget.inputOptions?.contextMenuBuilder &&
      !overlay.toolbarIsVisible
    )
      overlay.showToolbar({
        context: this.renderKey.currentContext!,
        contextMenuBuilder: (context) =>
          this.widget.inputOptions!.contextMenuBuilder!(context, this),
      });
  }
  private dragHandle(end: boolean, global: SourceOffset): void {
    if (!this.selectionEnabled) return;
    this.selectionDrag = {
      kind: end ? 'end-handle' : 'start-handle',
      global,
      text: this.widget.controller.text,
      focused: this.focus?.hasPrimaryFocus ?? false,
      focusRequest: this.selectionFocusRequest,
    };
    this.applyHandleDrag(end, global);
    this.updateSelectionScroll();
  }
  private applyHandleDrag(end: boolean, global: SourceOffset): void {
    if (!this.mounted || !this.selectionEnabled || this.widget.controller.isComposing) return;
    const render = this.editableRender();
    if (!render?.hasSize || render.needsLayout) return;
    this.toolbarRequested = false;
    const local = this.dragPosition(render, global, this.handleDragDy);
    if (!local) {
      this.stopSelectionDrag();
      return;
    }
    const at = render.getPositionForOffset(local),
      selection = this.selection(),
      opposite = this.handleAnchor ?? (end ? selection.start : selection.end),
      apple =
        FoundationPlatform.defaultTargetPlatform === 'iOS' ||
        FoundationPlatform.defaultTargetPlatform === 'macOS';
    if (!this.handleCollapsed && !apple && (end ? at.offset <= opposite : at.offset >= opposite))
      return;
    const anchor = this.handleCollapsed ? at.offset : end || apple ? opposite : at.offset,
      focus = this.handleCollapsed ? at.offset : end || apple ? at.offset : opposite,
      identity = this.editingIdentity,
      text = this.widget.controller.text;
    this.userUpdateTextEditingValue(
      this.textEditingValue.copyWith({
        selection: new SourceSelection({
          baseOffset: anchor,
          extentOffset: focus,
          affinity: at.affinity,
        }),
      }),
      SelectionChangedCause.drag,
    );
    if (
      !this.isCurrentEditingOwner(identity) ||
      this.widget.controller.text !== text ||
      this.widget.controller.selection.anchor !== anchor ||
      this.widget.controller.selection.focus !== focus ||
      !render.attached ||
      render.needsLayout
    )
      return;
    const caret = render.getLocalRectForCaret(at),
      project = (rect: SourceRect) => {
        const value = bounds(
          multiply(render.getTransformTo(null), translate(rect.x, rect.y)),
          rect,
        );
        return SourceRect.fromLTWH(value.x, value.y, value.width, value.height);
      },
      info = new MagnifierInfo({
        globalGesturePosition: global,
        caretRect: project(caret),
        fieldBounds: project(SourceRect.fromLTWH(0, 0, render.size.width, render.size.height)),
        currentLineBoundaries: project(
          SourceRect.fromLTWH(0, caret.top, render.size.width, caret.height),
        ),
      });
    this.selectionOverlay?.showMagnifier(info);
    this.selectionOverlay?.updateMagnifier(info);
    this.queueSelectionOverlay();
  }
  private beginHandleDrag(end: boolean, global: SourceOffset): void {
    this.stopSelectionDrag();
    const selection = this.selection(),
      render = this.editableRender();
    if (!render?.hasSize || render.needsLayout) return;
    this.handleAnchor = end ? selection.start : selection.end;
    this.handleCollapsed = selection.isCollapsed;
    const point = tryUnprojectMatrix4Point(fullTransform(render.getTransformTo(null)), global);
    if (!point) {
      this.stopSelectionDrag();
      return;
    }
    const caret = render.getLocalRectForCaret(
      new TextPosition({
        offset: end ? selection.end : selection.start,
        affinity: end ? 'upstream' : 'downstream',
      }),
    );
    this.handleDragDy = caret.top + caret.height / 2 - point.y;
    this.restoreToolbarAfterDrag = this.toolbarRequested;
    this.dragHandle(end, global);
  }
  private endHandleDrag(): void {
    this.stopSelectionDrag();
    if (this.restoreToolbarAfterDrag) this.showToolbar();
    this.restoreToolbarAfterDrag = false;
  }
  private releaseKey: (() => void) | undefined;
  private preferredX: number | undefined;
  private actions: ReadonlyMap<IntentType, ActionHandle> | undefined;
  private editingIdentity = newEditingIdentity();
  private hadFocusOnTapDown = false;
  private isCurrentEditingOwner(owner: object): boolean {
    return (
      owner === this.editingIdentity &&
      this.mounted &&
      this.context instanceof Element &&
      this.context.active &&
      this.context.services.readStatus() === 'open' &&
      this.widget.inputOptions?.enabled !== false
    );
  }
  private onTapOutside(event: PointerDownEvent, owner: object): void {
    if (!this.isCurrentEditingOwner(owner) || !this.focus?.hasFocus) return;
    this.hadFocusOnTapDown = true;
    const callback = this.widget.inputOptions?.onTapOutside;
    if (callback) this.editingCallback('onTapOutside', () => callback(event));
    else
      this.invokeNestedEditingIntent(
        new editingIntents.EditableTextTapOutsideIntent({
          focusNode: this.focus,
          pointerDownEvent: event,
        }),
      );
  }
  private onTapUpOutside(event: PointerUpEvent, owner: object): void {
    if (!this.isCurrentEditingOwner(owner) || !this.hadFocusOnTapDown) return;
    this.hadFocusOnTapDown = false;
    const callback = this.widget.inputOptions?.onTapUpOutside;
    if (callback) this.editingCallback('onTapUpOutside', () => callback(event));
    else if (this.focus)
      this.invokeNestedEditingIntent(
        new editingIntents.EditableTextTapUpOutsideIntent({
          focusNode: this.focus,
          pointerUpEvent: event,
        }),
      );
  }
  private readonly defaultEditingKey = (event: KeyEvent): KeyEventResult =>
    this.mounted &&
    this.focus &&
    this.context instanceof Element &&
    this.context.owner.focus.isKeyEventTarget(this.focus)
      ? this.handleSelectionKey(event)
      : 'ignored';
  private makeActions(): ReadonlyMap<IntentType, ActionHandle> {
    const actions = new Map<IntentType, ActionHandle>();
    const types: readonly IntentType[] = [
      editingIntents.EditableTextTapOutsideIntent,
      editingIntents.EditableTextTapUpOutsideIntent,
      editingIntents.DeleteCharacterIntent,
      editingIntents.DeleteToNextWordBoundaryIntent,
      editingIntents.DeleteToLineBreakIntent,
      editingIntents.ExtendSelectionByCharacterIntent,
      editingIntents.ExtendSelectionToNextWordBoundaryIntent,
      editingIntents.ExtendSelectionToNextParagraphBoundaryIntent,
      editingIntents.ExtendSelectionToLineBreakIntent,
      editingIntents.ExtendSelectionVerticallyToAdjacentLineIntent,
      editingIntents.ExtendSelectionVerticallyToAdjacentPageIntent,
      editingIntents.ExtendSelectionToNextParagraphBoundaryOrCaretLocationIntent,
      editingIntents.ExtendSelectionToDocumentBoundaryIntent,
      editingIntents.ExtendSelectionToNextWordBoundaryOrCaretLocationIntent,
      editingIntents.ExpandSelectionToLineBreakIntent,
      editingIntents.ExpandSelectionToDocumentBoundaryIntent,
      editingIntents.ScrollToDocumentBoundaryIntent,
      editingIntents.SelectAllTextIntent,
      editingIntents.CopySelectionTextIntent,
      editingIntents.PasteTextIntent,
      editingIntents.UndoTextIntent,
      editingIntents.RedoTextIntent,
      editingIntents.TransposeCharactersIntent,
    ];
    for (const type of [
      ...types,
      editingIntents.ReplaceTextIntent,
      editingIntents.UpdateSelectionIntent,
      ScrollIntent,
      DismissIntent,
    ]) {
      const action = new EditableIntentAction(
        type,
        () => this.canInvokeEditingType(type),
        (intent) => this.canInvokeEditingIntent(intent),
        (intent, context) => this.invokeEditingIntent(intent, context),
      );
      actions.set(
        type,
        types.includes(type)
          ? Action.overridable({ defaultAction: action, context: this.context })
          : action,
      );
    }
    actions.set(editingIntents.DoNothingAndStopPropagationTextIntent, new DoNothingAction(false));
    actions.set(DirectionalFocusIntent, DirectionalFocusAction.forTextField());
    return actions;
  }
  private canInvokeEditingType(type: IntentType): boolean {
    if (
      !this.mounted ||
      !(this.context instanceof Element) ||
      !this.context.active ||
      this.widget.inputOptions?.enabled === false
    )
      return false;
    if (type === DismissIntent) {
      const intent = new DismissIntent();
      return (
        this.toolbarRequested ||
        !!this.selectionOverlay?.toolbarIsVisible ||
        !!Actions.maybeFind(this.context, intent)?.isEnabledFor(intent, this.context)
      );
    }
    if (
      this.widget.controller.isComposing &&
      type !== ScrollIntent &&
      type !== editingIntents.EditableTextTapOutsideIntent &&
      type !== editingIntents.EditableTextTapUpOutsideIntent
    )
      return false;
    const readOnly = this.boundConfiguration.readOnly;
    if (
      type === editingIntents.DeleteCharacterIntent ||
      type === editingIntents.DeleteToNextWordBoundaryIntent ||
      type === editingIntents.DeleteToLineBreakIntent ||
      type === editingIntents.TransposeCharactersIntent
    )
      return !readOnly;
    if (type === editingIntents.UndoTextIntent) return !readOnly && this.widget.controller.canUndo;
    if (type === editingIntents.RedoTextIntent) return !readOnly && this.widget.controller.canRedo;
    if (type === editingIntents.PasteTextIntent)
      return !readOnly && !!this.context.services.binaryMessenger;
    if (type === editingIntents.CopySelectionTextIntent)
      return (
        !this.boundConfiguration.obscureText &&
        !!this.context.services.binaryMessenger &&
        this.widget.controller.selection.anchor !== this.widget.controller.selection.focus
      );
    return true;
  }
  private canInvokeEditingIntent(intent: Intent): boolean {
    return (
      this.canInvokeEditingType(intent.typeToken) &&
      (!(intent instanceof editingIntents.CopySelectionTextIntent) ||
        !intent.collapseSelection ||
        !this.boundConfiguration.readOnly)
    );
  }
  private invokeNestedEditingIntent(intent: Intent): void {
    const context = this.focus?.context;
    if (context?.mounted) Actions.invoke(context, intent);
  }
  get textEditingValue(): SourceEditingValue {
    const value = this.widget.controller.value,
      composing = value.composing;
    return new SourceEditingValue({
      text: value.text,
      selection: this.selection(),
      composing:
        composing.status === 'active'
          ? new TextRange({ start: composing.start, end: composing.end })
          : TextRange.empty,
    });
  }
  private formatUserValue(
    before: EditingContent,
    value: EditingContent,
    current: () => boolean,
  ): EditingContent | undefined {
    let result = value;
    this.editingCallback('applying input formatters', () => {
      let formatted = value;
      for (const formatter of this.widget.inputOptions?.inputFormatters ?? []) {
        const next = formatter.formatEditUpdate(before, formatted);
        if (!current()) return;
        const retained =
          before.composing.status === 'active' &&
          next.composing.status === 'active' &&
          next.text === before.text &&
          next.composing.start === before.composing.start &&
          next.composing.end === before.composing.end;
        invariant(
          next.composing.status !== 'active' || retained,
          'formatter-composition-command-unavailable',
          'Input formatters cannot create an observed OS composition',
        );
        // Formatters own text/selection. The input endpoint owns observed
        // composition availability and completion, including a rejected edit.
        formatted = snapshotEditingContent({ ...next, composing: value.composing });
      }
      result = formatted;
    });
    return current() ? result : undefined;
  }
  userUpdateTextEditingValue(value: SourceEditingValue, cause: SelectionChangedCause | null): void {
    if (!this.mounted || !this.isCurrentEditingOwner(this.editingIdentity)) return;
    invariant(
      value instanceof SourceEditingValue,
      'invalid-user-editing-value',
      'User editing requires a TextEditingValue',
    );
    const controller = this.widget.controller,
      old = this.textEditingValue,
      identity = this.editingIdentity,
      revision = controller.revision;
    const focusRequest =
      this.context instanceof Element ? this.context.owner.focus.currentFocusRequest : undefined;
    if (value.equals(old)) {
      if (!this.focus?.hasFocus) {
        this.focus?.requestFocus();
        this.overlayRequested = true;
        this.queueSelectionOverlay();
      }
      return;
    }
    // Active ranges describe an observed OS composition. Core must not invent or
    // silently finish one while applying a public value/selection request.
    const selectionOnly =
      controller.isComposing && value.text === old.text && value.composing.equals(old.composing);
    invariant(
      selectionOnly || !value.composing.isValid || value.composing.isCollapsed,
      'user-composition-command-unavailable',
      'An active composing value must retain its observed text and composing range',
    );
    if (selectionOnly)
      invariant(
        !this.cancellationPending,
        'composition-cancellation-pending',
        'Selection cannot supersede an unfinished OS cancellation',
      );
    let content: EditingContent = snapshotEditingContent({
      text: value.text,
      selection: { anchor: value.selection.baseOffset, focus: value.selection.extentOffset },
      composing: { status: 'none' },
    });
    if (old.text !== value.text || (!old.composing.isCollapsed && value.composing.isCollapsed)) {
      const formatted = this.formatUserValue(
        controller.value,
        content,
        () => this.isCurrentEditingOwner(identity) && controller.revision === revision,
      );
      if (!formatted) return;
      content = formatted;
    }
    const selectionChanged = !old.selection.equals(value.selection),
      changed =
        old.text !== value.text || selectionChanged || !old.composing.equals(value.composing),
      showCaret =
        changed &&
        cause !== SelectionChangedCause.drag &&
        (!this.boundConfiguration.readOnly || selectionChanged);
    const notify = () => {
      if (!this.isCurrentEditingOwner(identity) || this.widget.controller !== controller) return;
      this.selectionAffinity = value.selection.affinity;
      this.selectionDirectional = value.selection.isDirectional;
      const accepted = controller.revision;
      if (
        selectionChanged ||
        cause === SelectionChangedCause.longPress ||
        cause === SelectionChangedCause.keyboard
      ) {
        if (cause !== SelectionChangedCause.keyboard) this.requestKeyboard();
        if (!this.isCurrentEditingOwner(identity) || controller.revision !== accepted) return;
        this.overlayRequested = true;
        this.queueSelectionOverlay();
        this.editingCallback('calling onSelectionChanged', () =>
          this.widget.inputOptions?.onSelectionChanged?.(this.selection(), cause),
        );
      }
      if (!this.isCurrentEditingOwner(identity) || controller.revision !== accepted) return;
      if (showCaret) this.scheduleCaretReveal();
      if (old.text !== controller.text)
        this.editingCallback('calling onChanged', () =>
          this.widget.inputOptions?.onChanged?.(controller.text),
        );
    };
    const applied = () => {
      if (this.context instanceof Element)
        this.context.owner.focus.runWithFocusRequest(focusRequest, notify);
    };
    if (selectionOnly)
      controller._updateUserSelection(content.selection, () => {
        const accepted = controller.revision;
        applied();
        if (
          this.isCurrentEditingOwner(identity) &&
          this.widget.controller === controller &&
          controller.revision === accepted
        )
          this.synchronizeUserSelection();
      });
    else controller.replace(content.text, content.selection, applied);
  }
  private semanticsTextActions(): SemanticsTextActions {
    const identity = this.editingIdentity,
      controller = this.widget.controller,
      revision = controller.revision,
      current = () =>
        this.isCurrentEditingOwner(identity) &&
        this.widget.controller === controller &&
        controller.revision === revision &&
        this.widget.inputOptions?.enabled !== false;
    return Object.freeze({
      ...(!this.boundConfiguration.readOnly
        ? {
            setText: (text: string) => {
              if (current() && !this.boundConfiguration.readOnly)
                this.userUpdateTextEditingValue(
                  new SourceEditingValue({
                    text,
                    selection: SourceSelection.collapsed(text.length),
                  }),
                  SelectionChangedCause.keyboard,
                );
            },
          }
        : {}),
      ...(this.selectionEnabled
        ? {
            setSelection: (selection: TextSelection) => {
              if (current() && this.selectionEnabled && !this.cancellationPending)
                this.userUpdateTextEditingValue(
                  this.textEditingValue.copyWith({
                    selection: new SourceSelection({
                      baseOffset: selection.anchor,
                      extentOffset: selection.focus,
                    }),
                  }),
                  SelectionChangedCause.keyboard,
                );
            },
          }
        : {}),
      scrollRange: (start: number, end: number, alignToTop: boolean) => {
        if (!current()) return;
        this.cancelCaretReveal();
        const perform = () => {
          if (!current() || !(this.context instanceof Element) || !this.context.active) return;
          const render = this.editableRender(),
            text = this.boundConfiguration.obscureText
              ? '•'.repeat(controller.text.length)
              : controller.text;
          if (
            !render?.attached ||
            !render.hasSize ||
            render.needsLayout ||
            !render.isDisplayed ||
            render.plainText !== text
          )
            return;
          const revealed = render.revealRange(start, end, alignToTop);
          if (
            !current() ||
            render !== this.editableRender() ||
            !render.attached ||
            render.needsLayout
          )
            return;
          const visible = revealed ? intersect(revealed, { x: 0, y: 0, ...render.size }) : null;
          if (visible && visible.height > 0)
            render.showOnScreen(
              SourceRect.fromLTWH(visible.x, visible.y, visible.width, visible.height),
            );
        };
        const render = this.editableRender();
        if (render?.attached && render.hasSize && !render.needsLayout) perform();
        else if (this.context instanceof Element) this.context.owner.postFrame(perform);
      },
    });
  }
  private applyActionValue(value: SourceEditingValue, cause: SelectionChangedCause): void {
    this.userUpdateTextEditingValue(value, cause);
  }
  private handleSelectionKey(event: KeyEvent): KeyEventResult {
    if (
      event.kind !== 'down' ||
      !this.mounted ||
      this.widget.controller.isComposing ||
      this.widget.inputOptions?.enabled === false ||
      !(this.context instanceof Element)
    )
      return 'ignored';
    const controller = this.widget.controller,
      range = controller.selection,
      text = controller.text;
    // These are the Core text-input defaults, after the focus tree and its
    // custom shortcuts have had the first opportunity to handle the key.
    if (event.key === 'Enter' && !event.alt) {
      if (
        !event.control &&
        !event.meta &&
        this.boundConfiguration.multiline &&
        this.boundAction === 'enter' &&
        !this.boundConfiguration.readOnly
      ) {
        const start = Math.min(range.anchor, range.focus),
          end = Math.max(range.anchor, range.focus);
        this.userReplace(text.slice(0, start) + '\n' + text.slice(end), {
          anchor: start + 1,
          focus: start + 1,
        });
      } else if (!event.repeat) this.submit();
      return 'handled';
    }
    const keyboard = this.context.owner.keyboard,
      intent = [...textEditingShortcutMaps[FoundationPlatform.defaultTargetPlatform]].find(
        ([activator]) => activator.accepts(event, keyboard),
      )?.[1],
      context = this.focus?.context;
    if (!intent || !context?.mounted) return 'ignored';
    const action = Actions.maybeFind(context, intent);
    if (!action?.isEnabledFor(intent, context)) return 'ignored';
    const result = Actions.of(context).invokeAction(action, intent, context);
    return action.toKeyEventResultFor(intent, result);
  }
  private invokeEditingIntent(intent: Intent, _context?: BuildContext): boolean {
    if (!this.canInvokeEditingIntent(intent)) return false;
    if (intent instanceof editingIntents.EditableTextTapUpOutsideIntent) return true;
    if (intent instanceof editingIntents.EditableTextTapOutsideIntent) {
      const mobile = ['android', 'iOS', 'fuchsia'].includes(
        FoundationPlatform.defaultTargetPlatform,
      );
      if (mobile) {
        invariant(
          intent.pointerDownEvent.kind !== PointerDeviceKind.trackpad,
          'unexpected-trackpad-down',
          'Trackpad pointer down is not supported',
        );
        if (
          intent.pointerDownEvent.kind === PointerDeviceKind.touch &&
          FoundationPlatform.hostEnvironment.kind !== 'web'
        )
          return true;
      }
      intent.focusNode.unfocus();
      return true;
    }
    if (intent instanceof DismissIntent) {
      if (this.toolbarRequested || this.selectionOverlay?.toolbarIsVisible) this.hideToolbar();
      else Actions.maybeInvoke(this.context, intent);
      return true;
    }
    if (intent instanceof editingIntents.ReplaceTextIntent) {
      this.applyActionValue(
        intent.currentTextEditingValue.replaced(intent.replacementRange, intent.replacementText),
        intent.cause,
      );
      return true;
    }
    if (intent instanceof editingIntents.UpdateSelectionIntent) {
      const owner = this.editingIdentity,
        controller = this.widget.controller,
        revision = controller.revision;
      this.bringIntoView(intent.newSelection.extent);
      if (this.isCurrentEditingOwner(owner) && revision === controller.revision)
        this.applyActionValue(
          intent.currentTextEditingValue.copyWith({ selection: intent.newSelection }),
          intent.cause,
        );
      return true;
    }
    const controller = this.widget.controller,
      range = controller.selection,
      text = controller.text;
    if (intent instanceof editingIntents.TransposeCharactersIntent) {
      if (range.anchor !== range.focus || range.focus === 0) return true;
      const stops = graphemeBoundaries(text);
      if (stops.length <= 2) return true;
      let middle = 0;
      while (middle + 1 < stops.length && stops[middle + 1]! <= range.focus) middle++;
      if (range.focus === text.length) middle--;
      invariant(
        middle > 0 && middle + 1 < stops.length,
        'invalid-transpose-range',
        'Transpose requires two complete adjacent graphemes',
      );
      const start = stops[middle - 1]!,
        at = stops[middle]!,
        end = stops[middle + 1]!;
      this.userReplace(
        text.slice(0, start) + text.slice(at, end) + text.slice(start, at) + text.slice(end),
        { anchor: end, focus: end },
      );
      return true;
    }
    const render = this.editableRender();
    if (intent instanceof editingIntents.ScrollToDocumentBoundaryIntent) {
      this.cancelCaretReveal();
      this.bringIntoView(new TextPosition({ offset: intent.forward ? text.length : 0 }));
      return true;
    }
    if (intent instanceof ScrollIntent) {
      this.cancelCaretReveal();
      if (intent.type !== ScrollIncrementType.page || !render?.hasSize || render.needsLayout)
        return true;
      if (!render.isMultiline) render.scrollBy(render.maxScrollExtent - render.scrollOffset.x);
      else if (intent.direction === AxisDirection.up || intent.direction === AxisDirection.down)
        render.scrollBy(
          (intent.direction === AxisDirection.down ? 1 : -1) * 0.8 * render.size.height,
        );
      return true;
    }
    if (intent instanceof editingIntents.SelectAllTextIntent) {
      if (this.selectionEnabled) this.selectAll(intent.cause);
      return true;
    }
    if (
      intent instanceof editingIntents.CopySelectionTextIntent ||
      intent instanceof editingIntents.PasteTextIntent
    ) {
      const paste = intent instanceof editingIntents.PasteTextIntent,
        cut = intent instanceof editingIntents.CopySelectionTextIntent && intent.collapseSelection;
      if (
        (this.boundConfiguration.obscureText && !paste) ||
        (this.boundConfiguration.readOnly && (paste || cut))
      )
        return true;
      if (!this.context.services.binaryMessenger) return false;
      if (!this.selectionEnabled) return true;
      if (paste) this.observeEditingCommand(this.pasteText(intent.cause));
      else if (cut) this.cutSelection(intent.cause);
      else this.copySelection(intent.cause);
      return true;
    }
    if (
      intent instanceof editingIntents.UndoTextIntent ||
      intent instanceof editingIntents.RedoTextIntent
    ) {
      if (this.boundConfiguration.readOnly) return true;
      const changed =
        intent instanceof editingIntents.RedoTextIntent ? controller.redo() : controller.undo();
      if (changed) this.scheduleCaretReveal();
      return changed;
    }
    if (!render?.hasSize || render.needsLayout) return false;
    const atomic = new CharacterBoundary(text),
      document = new DocumentBoundary(text);
    const beyond = (
      position: TextPosition,
      forward: boolean,
      boundary: TextBoundary,
    ): TextPosition =>
      new TextPosition({
        offset: forward
          ? (boundary.getTrailingTextBoundaryAt(position.offset) ?? text.length)
          : (boundary.getLeadingTextBoundaryAt(position.offset - 1) ?? 0),
      });
    const word = () =>
      this.boundConfiguration.obscureText ? document : render.wordBoundaries.moveByWordBoundary;
    const line = (
      position: TextPosition,
      forward: boolean,
      continuesAtWrap = false,
    ): TextPosition => {
      if (this.boundConfiguration.obscureText)
        return new TextPosition({ offset: forward ? text.length : 0 });
      let boundary = render.getLineBoundary(position);
      // Home/End on the upstream/downstream side of a soft wrap continues
      // into the adjacent line only for the platform's explicit wrap policy.
      if (
        continuesAtWrap &&
        (forward
          ? position.affinity === 'upstream' &&
            position.offset === boundary.end &&
            position.offset < text.length &&
            !/[\r\n\u0085\u2028\u2029]/u.test(text[position.offset]!)
          : position.affinity === 'downstream' &&
            position.offset === boundary.start &&
            position.offset > 0 &&
            !/[\r\n\u0085\u2028\u2029]/u.test(text[position.offset - 1]!))
      ) {
        position = new TextPosition({
          offset: position.offset,
          affinity: forward ? 'downstream' : 'upstream',
        });
        boundary = render.getLineBoundary(position);
      }
      return new TextPosition({
        offset: forward ? boundary.end : boundary.start,
        affinity: forward ? 'upstream' : 'downstream',
      });
    };
    if (
      intent instanceof editingIntents.DeleteCharacterIntent ||
      intent instanceof editingIntents.DeleteToNextWordBoundaryIntent ||
      intent instanceof editingIntents.DeleteToLineBreakIntent
    ) {
      if (this.boundConfiguration.readOnly) return true;
      let start = Math.min(range.anchor, range.focus),
        end = Math.max(range.anchor, range.focus);
      if (start === end) {
        const position = new TextPosition({
            offset: range.focus,
            affinity: this.selectionAffinity,
          }),
          target =
            intent instanceof editingIntents.DeleteToLineBreakIntent
              ? line(position, intent.forward)
              : beyond(
                  position,
                  intent.forward,
                  intent instanceof editingIntents.DeleteToNextWordBoundaryIntent ? word() : atomic,
                );
        start = Math.min(start, target.offset);
        end = Math.max(end, target.offset);
      }
      // A programmatic/native UTF-16 selection may bisect a grapheme. Keyboard
      // deletion expands outward so it cannot strand combining marks or ZWJ.
      if (start !== end) {
        start = atomic.getLeadingTextBoundaryAt(start) ?? 0;
        end = atomic.getTrailingTextBoundaryAt(end - 1) ?? text.length;
        this.preferredX = undefined;
        this.invokeNestedEditingIntent(
          new editingIntents.ReplaceTextIntent(
            this.textEditingValue,
            '',
            new TextRange({ start, end }),
            SelectionChangedCause.keyboard,
          ),
        );
      }
      return true;
    }
    if (!(intent instanceof editingIntents.DirectionalCaretMovementIntent)) return false;
    const collapse = intent.collapseSelection,
      forward = intent.forward,
      expand =
        intent instanceof editingIntents.ExpandSelectionToLineBreakIntent ||
        intent instanceof editingIntents.ExpandSelectionToDocumentBoundaryIntent,
      targetBase = expand && (forward ? range.anchor > range.focus : range.anchor < range.focus),
      position = new TextPosition({
        offset: targetBase ? range.anchor : range.focus,
        affinity: this.selectionAffinity,
      });
    let next: TextPosition;
    if (intent instanceof editingIntents.ExtendSelectionByCharacterIntent) {
      next =
        collapse && range.anchor !== range.focus
          ? new TextPosition({
              offset: forward
                ? Math.max(range.anchor, range.focus)
                : Math.min(range.anchor, range.focus),
            })
          : render.getNextVisualPosition(position, forward ? 'right' : 'left');
    } else if (
      intent instanceof editingIntents.ExtendSelectionToNextWordBoundaryIntent ||
      intent instanceof editingIntents.ExtendSelectionToNextWordBoundaryOrCaretLocationIntent
    )
      next = beyond(position, forward, word());
    else if (
      intent instanceof editingIntents.ExtendSelectionToNextParagraphBoundaryIntent ||
      intent instanceof editingIntents.ExtendSelectionToNextParagraphBoundaryOrCaretLocationIntent
    )
      next = beyond(
        position,
        forward,
        this.boundConfiguration.obscureText ? document : new ParagraphBoundary(text),
      );
    else if (intent instanceof editingIntents.ExtendSelectionToLineBreakIntent)
      next = line(position, forward, intent.continuesAtWrap);
    else if (
      intent instanceof editingIntents.ExtendSelectionToDocumentBoundaryIntent ||
      intent instanceof editingIntents.ExpandSelectionToDocumentBoundaryIntent
    )
      next = beyond(position, forward, document);
    else if (intent instanceof editingIntents.ExpandSelectionToLineBreakIntent)
      next = line(position, forward);
    else if (
      intent instanceof editingIntents.ExtendSelectionVerticallyToAdjacentLineIntent ||
      intent instanceof editingIntents.ExtendSelectionVerticallyToAdjacentPageIntent
    ) {
      const caret = render.getLocalRectForCaret(position);
      this.preferredX ??= caret.x;
      const distance =
        intent instanceof editingIntents.ExtendSelectionVerticallyToAdjacentPageIntent
          ? render.size.height
          : caret.height;
      next = render.getPositionForOffset({
        x: this.preferredX,
        y: caret.y + caret.height / 2 + (forward ? distance : -distance),
      });
    } else return false;
    if (
      !(
        intent instanceof editingIntents.ExtendSelectionVerticallyToAdjacentLineIntent ||
        intent instanceof editingIntents.ExtendSelectionVerticallyToAdjacentPageIntent
      )
    )
      this.preferredX = undefined;
    if (
      intent.collapseAtReversal &&
      (range.anchor - range.focus) * (range.anchor - next.offset) < 0
    )
      next = new TextPosition({ offset: range.anchor });
    const selection = expand
      ? this.selection().expandTo(
          next,
          intent instanceof editingIntents.ExpandSelectionToDocumentBoundaryIntent ||
            range.anchor === range.focus,
        )
      : new SourceSelection({
          baseOffset: collapse ? next.offset : range.anchor,
          extentOffset: next.offset,
          affinity: next.affinity,
        });
    this.invokeNestedEditingIntent(
      new editingIntents.UpdateSelectionIntent(
        this.textEditingValue,
        selection,
        SelectionChangedCause.keyboard,
      ),
    );
    return true;
  }
  private editableRender(): RenderEditable | undefined {
    const render = this.renderKey.currentContext?.findRenderObject();
    return render instanceof RenderEditable ? render : undefined;
  }
  /** Pinned EditableTextState API; host ordering metadata is an Nelyx extension. */
  requestKeyboard(): void {
    if (!(this.context instanceof Element) || !this.isCurrentEditingOwner(this.editingIdentity))
      return;
    if (this.focus?.hasPrimaryFocus)
      this.showKeyboard(this.context.owner.focus.currentFocusRequest);
    else this.focus?.requestFocus();
  }
  private showKeyboard(request?: InputFocusRequest): void {
    this.focusRestorationToken = {};
    this.keyboardRequest = request;
    this.binding?.focus(request);
  }
  private selectAt(
    position: Offset,
    extend = false,
    word = false,
    cause = word
      ? SelectionChangedCause.longPress
      : extend
        ? SelectionChangedCause.drag
        : SelectionChangedCause.tap,
  ): boolean {
    if (
      !this.mounted ||
      this.widget.inputOptions?.enabled === false ||
      !this.selectionEnabled ||
      this.cancellationPending
    )
      return false;
    const render = this.editableRender();
    if (!render?.hasSize || render.needsLayout) return false;
    this.preferredX = undefined;
    const identity = this.editingIdentity,
      controller = this.widget.controller,
      revision = controller.revision,
      text = controller.text;
    const at = render.getPositionForOffset(position),
      range = word && !this.boundConfiguration.obscureText ? render.getWordBoundary(at) : undefined;
    const anchor = range?.start ?? (extend ? (this.dragAnchor ?? at.offset) : at.offset),
      focus = range?.end ?? at.offset;
    if (!this.isCurrentEditingOwner(identity) || controller.revision !== revision) return false;
    if (!extend) this.dragAnchor = anchor;
    const value = this.textEditingValue.copyWith({
      selection: new SourceSelection({
        baseOffset: anchor,
        extentOffset: focus,
        affinity: at.affinity,
      }),
    });
    if (cause === SelectionChangedCause.tap && value.equals(this.textEditingValue))
      this.requestKeyboard();
    if (!this.isCurrentEditingOwner(identity) || controller.revision !== revision) return false;
    this.userUpdateTextEditingValue(value, cause);
    const current = () =>
      this.isCurrentEditingOwner(identity) &&
      controller === this.widget.controller &&
      controller.text === text &&
      controller.selection.anchor === anchor &&
      controller.selection.focus === focus &&
      render === this.editableRender() &&
      render.attached &&
      !render.needsLayout;
    if (!current()) return false;
    const accepted = controller.revision;
    render.revealPosition(at);
    return current() && controller.revision === accepted;
  }
  private editingCallback(name: string, callback: () => void): void {
    try {
      callback();
    } catch (exception) {
      invariant(
        this.context instanceof Element,
        'invalid-context',
        'Editing callbacks require an Element',
      );
      this.context.owner.reportError(
        new FlutterErrorDetails({
          exception,
          stack: exceptionStack(exception),
          library: 'widgets',
          context: new ErrorDescription('while calling ' + name + ' for ' + this.boundAction),
        }),
      );
    }
  }
  private submit(): void {
    if (this.widget.inputOptions?.enabled === false || this.widget.controller.isComposing) return;
    const action = this.boundAction,
      connection = this.connection,
      complete = this.widget.inputOptions?.onEditingComplete;
    if (complete) this.editingCallback('onEditingComplete', complete);
    else if ((action === 'next' || action === 'previous') && this.context instanceof Element)
      this.context.owner.focus.next(action === 'previous');
    else if (action !== 'enter' || !this.boundConfiguration.multiline) this.focus?.unfocus();
    if (connection !== this.connection || !this.mounted) return;
    const submitted = this.widget.inputOptions?.onSubmitted;
    if (submitted)
      this.editingCallback('onSubmitted', () => submitted(this.widget.controller.text));
  }
  private readonly invalidated = () => {
    if (!this.mounted || !(this.context instanceof Element) || !this.context.active) return;
    if (this.context.services.readStatus() !== 'open') {
      this.stopBlink();
      this.stopSelectionDrag();
      return;
    }
    if (this.selectionDrag) {
      if (
        this.cancellationPending ||
        (this.widget.controller.isComposing && this.selectionDrag.kind !== 'pointer') ||
        this.selectionDrag.text !== this.widget.controller.text ||
        this.widget.inputOptions?.enabled === false ||
        (this.selectionDrag.focused && !this.focus?.hasPrimaryFocus)
      )
        this.stopSelectionDrag();
      else if (this.focus?.hasPrimaryFocus) {
        this.selectionDrag.focused = true;
        this.updateSelectionScroll();
      }
    }
    this.syncBlink();
    this.selectionOverlay?.markNeedsBuild();
    this.queueSelectionOverlay();
    if (this.context.owner.building)
      this.context.owner.postFrame(() => {
        if (this.mounted) this.setState(() => {});
      });
    else this.setState(() => {});
  };
  private caretRevealScheduled = false;
  private caretRevealToken: object = {};
  private internalCaretRevealScheduled = false;
  private queueInternalCaretReveal(): void {
    if (this.internalCaretRevealScheduled || !(this.context instanceof Element)) return;
    this.internalCaretRevealScheduled = true;
    const identity = this.editingIdentity,
      controller = this.widget.controller,
      revision = controller.revision,
      render = this.editableRender();
    this.context.owner.postFrame(() => {
      this.internalCaretRevealScheduled = false;
      if (
        this.isCurrentEditingOwner(identity) &&
        controller === this.widget.controller &&
        controller.revision === revision &&
        !this.selectionDrag &&
        render === this.editableRender() &&
        render?.attached &&
        render.hasSize &&
        !render.needsLayout &&
        render.isDisplayed
      )
        render.revealPendingCaret();
    });
  }
  private pendingCaretReveal:
    | {
        readonly position: TextPosition | null;
        readonly document: string;
        readonly identity: object;
        readonly focusedOnly: boolean;
      }
    | undefined;
  private cancelCaretReveal(): void {
    this.caretRevealToken = {};
    this.caretRevealScheduled = false;
    this.pendingCaretReveal = undefined;
  }
  private scheduleCaretReveal(position: TextPosition | null = null, focusedOnly = true): void {
    if (
      !this.mounted ||
      !(this.context instanceof Element) ||
      !this.context.active ||
      this.widget.inputOptions?.enabled === false
    )
      return;
    this.pendingCaretReveal = {
      position,
      document: this.widget.controller.text,
      identity: this.editingIdentity,
      focusedOnly,
    };
    if (this.caretRevealScheduled) return;
    this.caretRevealScheduled = true;
    const token = this.caretRevealToken;
    this.context.owner.postFrame(() => {
      if (token !== this.caretRevealToken) return;
      this.caretRevealScheduled = false;
      const request = this.pendingCaretReveal;
      this.pendingCaretReveal = undefined;
      if (
        !request ||
        !this.isCurrentEditingOwner(request.identity) ||
        request.document !== this.widget.controller.text ||
        maybeTickerScheduler(this.context)?.visible === false ||
        (request.focusedOnly && (!this.focus?.hasPrimaryFocus || this.selectionDrag))
      )
        return;
      if (this.context instanceof Element && this.context.dirty) {
        this.scheduleCaretReveal(request.position, request.focusedOnly);
        return;
      }
      this.revealPosition(
        request.position ??
          new TextPosition({
            offset: this.widget.controller.selection.focus,
            affinity: this.selectionAffinity,
          }),
      );
    });
  }
  /** Reveals a Core text position through the actual ancestor viewports. */
  bringIntoView(position: TextPosition): void {
    if (!this.isCurrentEditingOwner(this.editingIdentity)) return;
    invariant(
      position instanceof TextPosition &&
        position.offset >= 0 &&
        position.offset <= this.widget.controller.text.length,
      'invalid-text-offset',
      'Reveal position is outside the Core document',
    );
    const render = this.editableRender(),
      text = this.boundConfiguration.obscureText
        ? '•'.repeat(this.widget.controller.text.length)
        : this.widget.controller.text;
    if (!render?.hasSize || render.needsLayout || render.plainText !== text) {
      this.scheduleCaretReveal(position, false);
      return;
    }
    this.revealPosition(position);
  }
  private revealPosition(position: TextPosition): void {
    if (!(this.context instanceof Element) || !this.context.active) return;
    const render = this.editableRender(),
      text = this.boundConfiguration.obscureText
        ? '•'.repeat(this.widget.controller.text.length)
        : this.widget.controller.text;
    if (!render?.hasSize || render.needsLayout || !render.isDisplayed || render.plainText !== text)
      return;
    const identity = this.editingIdentity,
      controller = this.widget.controller,
      revision = controller.revision;
    render.revealPosition(position);
    if (
      !this.isCurrentEditingOwner(identity) ||
      controller !== this.widget.controller ||
      controller.revision !== revision ||
      render !== this.editableRender() ||
      !render.attached ||
      render.needsLayout
    )
      return;
    const caret = intersect(render.getLocalRectForCaret(position), { x: 0, y: 0, ...render.size });
    render?.showOnScreen(caret && caret.width > 0 && caret.height > 0 ? caret : undefined);
  }
  private reveal(): void {
    if (!this.selectionDrag)
      this.bringIntoView(
        new TextPosition({
          offset: this.widget.controller.selection.focus,
          affinity: this.selectionAffinity,
        }),
      );
  }
  override initState(): void {
    this.connect();
  }
  private checkFormatterSupport(): void {
    invariant(
      !this.widget.inputOptions?.inputFormatters?.length ||
        this.context.services.editing.capabilities.composing === 'observed' ||
        typeof this.binding?.isComposing === 'boolean',
      'editing-composition-unobservable',
      'Input formatters require an editing host that observes composition activity',
    );
  }
  private connect(): void {
    const { services } = this.context,
      controller = this.widget.controller;
    this.autofillGroup = AutofillGroup.maybeOf(this.context);
    this.boundConfiguration = this.desiredConfiguration();
    this.boundLinePolicy = editableLinePolicy(this.widget.inputOptions);
    this.boundAction =
      this.widget.inputOptions?.action ?? (this.boundConfiguration.multiline ? 'enter' : 'done');
    this.pendingConfiguration = false;
    this.attachedController = controller;
    const connection = ++this.connection;
    // One readonly view per connection. Availability is read from its actual
    // owners, without allocating another state snapshot for each IME query.
    const state = this,
      inputState = {
        get enabled() {
          return (
            connection === state.connection && state.isCurrentEditingOwner(state.editingIdentity)
          );
        },
        get focusable() {
          return state.focus?.canRequestFocus ?? state.widget.focusNode?.canRequestFocus ?? true;
        },
        get label() {
          return state.widget.label;
        },
      };
    try {
      this.clipboardStatus = ClipboardStatus.unknown;
      if (
        this.autofillGroup &&
        this.boundConfiguration.autofillHints &&
        !this.boundConfiguration.readOnly
      )
        this.autofillClient = this.autofillGroup.registerClient(
          this.widget.id,
          this.boundConfiguration.autofillHints,
        );
      this.releaseController = controller.attach(this, (text, selection) =>
        this.synchronizeCore(text, selection),
      );
      invariant(
        this.context instanceof Element,
        'invalid-context',
        'EditableText needs an Element',
      );
      this.binding = services.editing.bind(
        services.owner,
        {
          text: controller.text,
          selection: controller.selection,
          composing: { status: 'unavailable' },
          revision: 0,
          session: services.owner,
          source: 'programmatic',
        },
        (value) => {
          if (connection !== this.connection) return;
          const previous = controller.text,
            previousSelection = this.selection(),
            identity = this.editingIdentity,
            startRevision = controller.revision,
            userEdit = value.source === 'native',
            composing = this.binding?.isComposing ?? value.composing.status === 'active';
          let correction: TextEditingValue | undefined;
          const sameDocument = () =>
            connection === this.connection &&
            this.widget.controller === controller &&
            identity === this.editingIdentity &&
            controller.revision === startRevision;
          const current = () => sameDocument() && this.isCurrentEditingOwner(identity);
          const flight = this.synchronizationInFlight;
          const acknowledged =
            !!flight &&
            value.source === 'programmatic' &&
            value.revision > flight.revision &&
            value.text === flight.value.text &&
            value.selection.anchor === flight.value.selection.anchor &&
            value.selection.focus === flight.value.selection.focus &&
            (!composing || !this.cancellationPending);
          if (acknowledged) {
            this.synchronizationInFlight = undefined;
            this.queueSynchronization();
            const pending = this.pendingSynchronization;
            if (pending) {
              if (
                pending.text !== value.text ||
                pending.selection.anchor !== value.selection.anchor ||
                pending.selection.focus !== value.selection.focus
              )
                return;
              this.pendingSynchronization = undefined;
            }
          }
          // Receipts retire an admitted synchronization after View admission stops;
          // they cannot turn into another user edit or focus/action callback.
          if (!current() && !acknowledged) return;
          const compositionBase = this.compositionBase;
          if (composing) this.compositionBase ??= controller.value;
          else this.compositionBase = undefined;
          if (
            !composing &&
            !this.boundConfiguration.readOnly &&
            userEdit &&
            this.binding &&
            (previous !== value.text || compositionBase !== undefined)
          ) {
            const formatted = this.formatUserValue(
              compositionBase ?? controller.value,
              value,
              current,
            );
            if (!formatted) return;
            if (
              formatted.text !== value.text ||
              formatted.selection.anchor !== value.selection.anchor ||
              formatted.selection.focus !== value.selection.focus
            ) {
              correction = { ...value, ...formatted, source: 'programmatic' };
              value = { ...value, ...formatted };
            }
          }
          if (userEdit && previous !== value.text) this.hideToolbar();
          if (value.source === 'native') {
            this.selectionAffinity = 'downstream';
            this.selectionDirectional = false;
          }
          const geometry = this.binding?.readGeometry?.();
          if (!sameDocument()) return;
          const revision = controller.revision + 1;
          controller.receive(value, geometry, composing);
          if (connection !== this.connection) return;
          if (correction && controller.revision === revision && this.binding)
            this.editingCallback('synchronizing formatted input', () =>
              this.synchronizeCore(correction!.text, correction!.selection),
            );
          else if (
            userEdit &&
            !this.cancellationPending &&
            controller.revision === revision &&
            (this.synchronizationInFlight || this.pendingSynchronization)
          ) {
            const selectionOnly =
              this.pendingSynchronization?.selectionOnly ??
              this.synchronizationInFlight?.selectionOnly;
            this.pendingSynchronization = {
              ...snapshotEditingContent({
                ...controller.value,
                ...(selectionOnly ? {} : { composing: { status: 'none' } as const }),
              }),
              retries: 0,
              ...(selectionOnly ? { selectionOnly: true } : {}),
            };
          }
          if (acknowledged && !this.pendingSynchronization && !composing)
            this.cancellationPending = false;
          if (
            this.pendingSynchronization &&
            !this.synchronizationInFlight &&
            (!composing || this.pendingSynchronization.selectionOnly)
          )
            this.queueSynchronization();
          if (!composing && this.pendingConfiguration) this.queueReconfiguration();
          if (
            userEdit &&
            controller.revision === revision &&
            this.isCurrentEditingOwner(identity)
          ) {
            if (this.focus?.hasFocus) this.scheduleCaretReveal();
            if (!previousSelection.equals(this.selection()))
              this.editingCallback('calling onSelectionChanged', () =>
                this.widget.inputOptions?.onSelectionChanged?.(
                  this.selection(),
                  SelectionChangedCause.keyboard,
                ),
              );
            if (
              controller.revision === revision &&
              this.isCurrentEditingOwner(identity) &&
              previous !== controller.text
            )
              this.editingCallback('calling onChanged', () =>
                this.widget.inputOptions?.onChanged?.(controller.text),
              );
          }
          if (acknowledged) this.publishInputGeometry();
        },
        {
          id: this.widget.id,
          readInputState: () => inputState,
          readValue: () => controller.value,
          synchronizationRejected: (request, reason) => {
            if (connection === this.connection) this.synchronizationRejected(request, reason);
          },
          readCharacterBounds: (start, end, expected) =>
            connection === this.connection ? this.readCharacterBounds(start, end, expected) : null,
          readRangeBounds: (start, end, expected) =>
            connection === this.connection ? this.readRangeBounds(start, end, expected) : null,
          readTextPosition: (point, options, expected) =>
            connection === this.connection ? this.readTextPosition(point, options, expected) : null,
          configuration: this.boundConfiguration,
          onUndo: () =>
            connection === this.connection &&
            this.isCurrentEditingOwner(this.editingIdentity) &&
            !this.boundConfiguration.readOnly &&
            controller.undo(),
          onRedo: () =>
            connection === this.connection &&
            this.isCurrentEditingOwner(this.editingIdentity) &&
            !this.boundConfiguration.readOnly &&
            controller.redo(),
          action: this.boundAction,
          onAction: () => {
            if (connection === this.connection && this.isCurrentEditingOwner(this.editingIdentity))
              this.submit();
          },
          focusChanged: (focused) => {
            if (connection === this.connection && this.focus && this.context instanceof Element) {
              if (focused) {
                if (
                  this.isCurrentEditingOwner(this.editingIdentity) &&
                  this.context.owner.focus.focus(this.focus)
                )
                  this.reveal();
              } else this.context.owner.focus.blur(this.focus);
            }
          },
        },
      );
      this.checkFormatterSupport();
      this.focus = this.widget.focusNode ?? new FocusNode();
      this.ownFocus = !this.widget.focusNode;
      const manager = this.context.owner.focus;
      manager.addLateKeyEventHandler(this.defaultEditingKey);
      this.releaseKey = () => manager.removeLateKeyEventHandler(this.defaultEditingKey);
      controller.addListener(this.invalidated);
      this.focus.addListener(this.invalidated);
      this.blinkVisibility = maybeTickerScheduler(this.context)?.observeVisibility((visible) => {
        if (visible) this.invalidated();
        else {
          this.stopBlink();
          this.stopSelectionDrag();
        }
      });
      this.syncBlink();
    } catch (error) {
      try {
        this.disconnect();
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Editor connection and cleanup failed');
      }
      throw error;
    }
  }
  private disconnect(): void {
    this.focusRestorationToken = {};
    this.keyboardRequest = undefined;
    this.stopSelectionDrag();
    this.selectionOverlay?.dispose();
    this.selectionOverlay = undefined;
    this.overlayRequested = false;
    this.toolbarRequested = false;
    this.overlayScheduled = false;
    this.handleAnchor = undefined;
    this.restoreToolbarAfterDrag = false;
    this.releaseKey?.();
    this.releaseKey = undefined;
    this.stopBlink();
    this.blinkVisibility?.dispose();
    this.blinkVisibility = undefined;
    this.connection++;
    this.pendingConfiguration = false;
    this.reconfigurationQueued = false;
    const controller = this.attachedController,
      focus = this.focus,
      release = this.releaseController,
      binding = this.binding,
      owned = this.ownFocus,
      autofillClient = this.autofillClient;
    this.autofillClient = undefined;
    this.autofillGroup = null;
    this.attachedController = undefined;
    this.releaseController = undefined;
    this.focus = undefined;
    this.binding = undefined;
    this.compositionBase = undefined;
    this.pendingSynchronization = undefined;
    this.synchronizationInFlight = undefined;
    this.synchronizationQueued = false;
    this.cancellationPending = false;
    const errors: unknown[] = [];
    for (const cleanup of [
      () => controller?.removeListener(this.invalidated),
      () => focus?.removeListener(this.invalidated),
      () => release?.(),
      () => {
        if (owned) focus?.dispose();
      },
      () => binding?.dispose(),
      () => autofillClient?.dispose(),
    ])
      try {
        cleanup();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Editor cleanup failed');
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.updateSystemFonts();
    this.selectionOverlay?.dispose();
    this.selectionOverlay = undefined;
    this.queueSelectionOverlay();
    Focus.maybeOf(this.context, { scopeOk: true });
    const next = this.desiredConfiguration(),
      changed =
        this.autofillGroup !== AutofillGroup.maybeOf(this.context) ||
        editingConfigurationKey(this.boundConfiguration) !== editingConfigurationKey(next);
    if (changed) {
      if (this.binding?.isComposing || this.widget.controller.isComposing)
        this.pendingConfiguration = true;
      else this.reconnect();
    }
  }
  override deactivate(): void {
    this.fontMetricsDirty = true;
    try {
      this.focusRestorationToken = {};
      this.cancelCaretReveal();
      this.hadFocusOnTapDown = false;
      this.stopSelectionDrag();
      this.hideToolbar();
      this.stopBlink();
      this.dragAnchor = undefined;
      super.deactivate();
    } catch (error) {
      try {
        this.removeSystemFonts();
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Editor deactivation and font cleanup failed');
      }
      throw error;
    }
    this.removeSystemFonts();
  }
  override activate(): void {
    super.activate();
    this.updateSystemFonts();
    this.syncBlink();
    if (this.pendingConfiguration && !this.binding?.isComposing) this.queueReconfiguration();
  }
  private reconnect(restoreFocus = true): void {
    const priorFocus = this.focus,
      focused = restoreFocus && priorFocus?.hasFocus,
      request: InputFocusRequest = { ...this.keyboardRequest, restore: true };
    this.disconnect();
    this.connect();
    if (!focused || !(this.context instanceof Element)) return;
    const token = {},
      identity = this.editingIdentity,
      connection = this.connection,
      focus = this.focus,
      binding = this.binding,
      manager = this.context.owner.focus,
      generation = manager.focusRequestGeneration;
    this.focusRestorationToken = token;
    const current = () =>
      token === this.focusRestorationToken &&
      connection === this.connection &&
      focus === this.focus &&
      binding === this.binding &&
      this.isCurrentEditingOwner(identity) &&
      manager.focusRequestGeneration === generation;
    this.context.owner.postFrame(() => {
      if (!current() || !focus?.attached) return;
      if (focus.hasPrimaryFocus) {
        this.reveal();
        if (current() && focus.hasPrimaryFocus) {
          this.keyboardRequest = request;
          binding?.focus(request);
        }
      } else if (focus !== priorFocus)
        this.context instanceof Element &&
          this.context.owner.focus.runWithFocusRequest(request, () => focus.requestFocus());
    });
  }
  private queueReconfiguration(): void {
    if (
      this.reconfigurationQueued ||
      !this.mounted ||
      !(this.context instanceof Element) ||
      !this.context.active ||
      this.context.services.readStatus() !== 'open'
    )
      return;
    this.reconfigurationQueued = true;
    const connection = this.connection;
    this.context.owner.postFrame(() => {
      if (connection !== this.connection) return;
      this.reconfigurationQueued = false;
      if (
        !this.mounted ||
        !(this.context instanceof Element) ||
        !this.context.active ||
        this.context.services.readStatus() !== 'open' ||
        !this.pendingConfiguration ||
        this.binding?.isComposing ||
        this.widget.controller.isComposing
      )
        return;
      this.reconnect();
      this.setState(() => {});
    });
  }
  override didUpdateWidget(old: EditableText): void {
    if (!this.selectionEnabled) {
      this.stopSelectionDrag();
      this.hideToolbar();
    }
    if (
      old.inputOptions?.selectionControls !== this.widget.inputOptions?.selectionControls ||
      old.inputOptions?.magnifierConfiguration !==
        this.widget.inputOptions?.magnifierConfiguration ||
      old.inputOptions?.contextMenuBuilder !== this.widget.inputOptions?.contextMenuBuilder
    ) {
      this.selectionOverlay?.dispose();
      this.selectionOverlay = undefined;
      if (!this.widget.inputOptions?.contextMenuBuilder) this.toolbarRequested = false;
    }
    const identityChanged =
        old.id !== this.widget.id ||
        old.controller !== this.widget.controller ||
        old.focusNode !== this.widget.focusNode,
      next = this.desiredConfiguration(),
      action = this.widget.inputOptions?.action ?? (next.multiline ? 'enter' : 'done'),
      settingsChanged =
        this.boundAction !== action ||
        editingConfigurationKey(this.boundConfiguration) !== editingConfigurationKey(next);
    if (identityChanged) {
      this.cancelCaretReveal();
      this.editingIdentity = newEditingIdentity();
      this.hadFocusOnTapDown = false;
    }
    if (!this.binding || identityChanged || settingsChanged) {
      if (
        this.binding &&
        !identityChanged &&
        (this.binding.isComposing || this.widget.controller.isComposing)
      )
        this.pendingConfiguration = true;
      else {
        this.reconnect(old.focusNode === this.widget.focusNode);
        return;
      }
    } else this.pendingConfiguration = false;
    try {
      this.checkFormatterSupport();
    } catch (error) {
      try {
        this.disconnect();
      } catch (cleanup) {
        throw new AggregateError([error, cleanup], 'Unsupported formatter cleanup failed');
      }
      throw error;
    }
  }
  override dispose(): void {
    const painter = this.metricPainter;
    this.metricPainter = undefined;
    this.lineMetrics = undefined;
    const errors: unknown[] = [],
      release = (dispose: () => void) => {
        try {
          dispose();
        } catch (error) {
          errors.push(error);
        }
      };
    release(() => this.removeSystemFonts());
    release(() => this.cancelCaretReveal());
    this.editingIdentity = { generation: 0 };
    this.hadFocusOnTapDown = false;
    release(() => this.disconnect());
    release(() => painter?.dispose());
    release(() => this.startHandleVisible.dispose());
    release(() => this.endHandleVisible.dispose());
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'Editable state retirement failed');
  }
  private resolveStyle(text: string):
    | {
        style: EditorStyle;
        baselines: EditorBaselines;
        layout: Pick<EditableTextLayout, 'options' | 'context'>;
      }
    | undefined {
    if (this.fontMetricsDirty) {
      this.fontMetricsDirty = false;
      this.lineMetrics = undefined;
      this.metricPainter?.markNeedsLayout();
    }
    const options = this.widget.inputOptions;
    const resolved = resolveTextConfiguration(this.context, {
        ...(options?.textStyle ? { style: options.textStyle } : {}),
        ...(options?.textAlign ? { textAlign: options.textAlign } : {}),
        ...(options?.textDirection ? { direction: options.textDirection } : {}),
        ...(options?.strutStyle ? { strutStyle: options.strutStyle } : {}),
        ...(options?.textScaler ? { textScaler: options.textScaler } : {}),
      }),
      { font, scale, style, scaler, painterOptions } = resolved,
      run = style.toRunStyle(scaler),
      services = this.context.services;
    const context = {
      text: services.text,
      resources: services.resources,
      font,
      scale,
      transient: true,
    };
    if (
      this.metricPainter &&
      (this.metricPainter._paragraphContext.text !== services.text ||
        this.metricPainter._paragraphContext.resources !== services.resources)
    ) {
      const old = this.metricPainter;
      this.metricPainter = undefined;
      this.lineMetrics = undefined;
      old.dispose();
    }
    const painter = (this.metricPainter ??= new TextPainter({}, context));
    painter._updateContext(context);
    painter.text = new TextSpan({ text: ' ', style });
    painter.textAlign = 'left';
    painter.textDirection = painterOptions.textDirection ?? null;
    painter.textScaler = scaler;
    painter.maxLines = 1;
    painter.ellipsis = null;
    painter.locale = painterOptions.locale ?? null;
    painter.strutStyle = painterOptions.strutStyle ?? null;
    painter.textWidthBasis = 'parent';
    painter.textHeightBehavior = painterOptions.textHeightBehavior ?? null;
    painter.hyphens = painterOptions.hyphens ?? 'manual';
    const geometry = painter._measure(Infinity);
    if (this.lineMetrics?.geometry !== geometry)
      this.lineMetrics = {
        geometry,
        baselines: Object.freeze({
          lineHeight: geometry.height,
          alphabetic: geometry.alphabeticBaseline,
          ideographic: geometry.ideographicBaseline,
        }),
      };
    const family = services.text.fontFamily?.(font),
      families = [...new Set([...(run.fontFamilies ?? []), ...(family ? [family] : [])])],
      selection = DefaultSelectionStyle.of(this.context),
      baselines = this.lineMetrics.baselines;
    return {
      style: freezeEditorStyle({
        fontFamilies: families,
        fontSize: run.fontSize ?? scaler.scale(style.fontSize ?? 18),
        fontWeight: run.fontWeight ?? 400,
        fontStyle: run.fontStyle ?? 'normal',
        lineHeight: baselines.lineHeight,
        letterSpacing: run.letterSpacing ?? 0,
        wordSpacing: run.wordSpacing ?? 0,
        color: run.color ?? style.color ?? 0xff000000,
        backgroundColor: run.backgroundColor ?? 0,
        cursorColor:
          options?.cursorColor ?? selection.cursorColor ?? run.color ?? style.color ?? 0xff000000,
        selectionColor:
          options?.selectionColor ?? selection.selectionColor ?? DefaultSelectionStyle.defaultColor,
        textAlign: painterOptions.textAlign ?? 'start',
        textDirection: painterOptions.textDirection ?? 'ltr',
      }),
      baselines,
      layout: {
        options: { ...painterOptions, text: new TextSpan({ text, style }) },
        context: { text: services.text, resources: services.resources, font, scale },
      },
    };
  }
  build(): Widget {
    this.layoutViewportGeneration = this.context.services.readMetrics().viewportGeneration;
    this.queueSelectionOverlay();
    const options = this.widget.inputOptions,
      minHeight = options?.minHeight ?? 48;
    invariant(
      Number.isFinite(this.widget.height) &&
        this.widget.height >= 0 &&
        Number.isFinite(minHeight) &&
        minHeight >= 0,
      'invalid-editor-height',
      'EditableText heights must be finite and nonnegative',
    );
    const text = this.boundConfiguration.obscureText
        ? '•'.repeat(this.widget.controller.text.length)
        : this.widget.controller.text,
      scale =
        this.context.maybeDependOn(MediaQuery)?.data.textScale ??
        this.context.services.readMetrics().environment?.textScale ??
        1,
      resolved = this.resolveStyle(text),
      height = Math.max(this.widget.height, minHeight * scale, resolved?.style.lineHeight ?? 0),
      enabled = options?.enabled !== false;
    const desiredPolicy = editableLinePolicy(options),
      policy =
        this.pendingConfiguration &&
        this.boundConfiguration.multiline !== (desiredPolicy.maxLines !== 1)
          ? this.boundLinePolicy
          : desiredPolicy;
    const layout: EditableTextLayout | undefined = resolved
      ? { ...policy, ...resolved.layout }
      : undefined;
    if (
      !this.autofocusHandled &&
      options?.autofocus &&
      enabled &&
      this.context instanceof Element
    ) {
      this.autofocusHandled = true;
      const identity = this.editingIdentity;
      this.context.owner.postFrame(() => {
        if (this.isCurrentEditingOwner(identity) && this.focus?.attached)
          this.focus.enclosingScope?.autofocus(this.focus);
      });
    }
    const currentSelection = this.widget.controller.selection,
      handleDrag =
        this.selectionDrag?.kind === 'start-handle' || this.selectionDrag?.kind === 'end-handle',
      apple =
        handleDrag &&
        (FoundationPlatform.defaultTargetPlatform === 'iOS' ||
          FoundationPlatform.defaultTargetPlatform === 'macOS'),
      activeEdge =
        !apple && this.selectionDrag?.kind === 'start-handle'
          ? Math.min(currentSelection.anchor, currentSelection.focus)
          : !apple && this.selectionDrag?.kind === 'end-handle'
            ? Math.max(currentSelection.anchor, currentSelection.focus)
            : undefined;
    const focused = enabled && (this.focus?.hasPrimaryFocus ?? false),
      selection = DefaultSelectionStyle.of(this.context),
      paint: EditablePaintValue = {
        selection: currentSelection,
        ...(activeEdge !== undefined
          ? {
              activeSelectionEdge: new TextPosition({
                offset: activeEdge,
                affinity: this.selectionAffinity,
              }),
            }
          : {}),
        composing: this.widget.controller.composing,
        affinity: this.selectionAffinity,
        focused,
        cursorVisible: this.cursorVisible,
        cursorColor:
          options?.cursorColor ?? selection.cursorColor ?? resolved?.style.color ?? 0xff000000,
        selectionColor:
          options?.selectionColor ?? selection.selectionColor ?? DefaultSelectionStyle.defaultColor,
        ...(options?.cursorWidth !== undefined ? { cursorWidth: options.cursorWidth } : {}),
        ...(options?.cursorHeight !== undefined ? { cursorHeight: options.cursorHeight } : {}),
        obscureText: this.boundConfiguration.obscureText,
        graphemeOffsets: graphemeBoundaries(this.widget.controller.text),
      };
    const box = new Scrollable({
      key: this.scrollableKey,
      axisDirection: policy.maxLines === 1 ? AxisDirection.right : AxisDirection.down,
      controller: options?.scrollController ?? null,
      physics:
        options?.scrollPhysics ??
        (policy.maxLines === 1 && FoundationPlatform.defaultTargetPlatform === 'iOS'
          ? singleLineIOSPhysics
          : null),
      excludeFromSemantics: true,
      restorationId: options?.restorationId ?? null,
      scrollBehavior:
        options?.scrollBehavior ??
        ScrollConfiguration.of(this.context).copyWith({
          scrollbars: policy.maxLines !== 1,
          overscroll: false,
        }),
      viewportBuilder: (_context, offset) =>
        new EditorBox(
          this.widget.id,
          this.widget.label,
          height,
          () => {
            if (this.mounted && this.widget.inputOptions?.enabled !== false)
              this.focus?.requestFocus();
          },
          text,
          focused,
          enabled && (this.focus?.canRequestFocus ?? false),
          enabled,
          paint,
          this.renderKey,
          options?.selectionControls || options?.contextMenuBuilder
            ? this.selectionLinks
            : undefined,
          this.boundConfiguration,
          offset,
          this.publishInputGeometry,
          () => this.queueInternalCaretReveal(),
          resolved?.style,
          resolved?.baselines,
          layout,
          this.semanticsTextActions(),
          this.widget.controller.revision,
          this.editingIdentity.generation,
          this.widget.controller.textRevision,
        ),
    });
    if (!enabled) this.hadFocusOnTapDown = false;
    const tapOwner = this.editingIdentity;
    const gestures = this.selectionGestures(),
      commands: Pick<FocusAttachmentOptions, 'focus' | 'blur' | 'reveal'> = {
        focus: (request) => {
          const identity = this.editingIdentity,
            connection = this.connection,
            binding = this.binding;
          this.reveal();
          if (
            connection === this.connection &&
            binding === this.binding &&
            this.isCurrentEditingOwner(identity)
          )
            this.showKeyboard(request);
        },
        blur: () => this.binding?.blur(),
        reveal: () => this.reveal(),
      };
    return new Actions({
      actions: (this.actions ??= this.makeActions()),
      child: new TextFieldTapRegion(
        new ExcludeFocus(
          new EditableFocus(
            new RawGestureDetector(new IgnorePointer(box, { ignoring: !enabled }), {
              gestures,
              excludeFromSemantics: true,
              behavior: HitTestBehavior.opaque,
            }),
            this.focus!,
            commands,
          ),
          { excluding: !enabled },
        ),
        {
          groupId: this.widget.groupId,
          onTapOutside:
            enabled && this.focus?.hasFocus ? (event) => this.onTapOutside(event, tapOwner) : null,
          onTapUpOutside: (event) => this.onTapUpOutside(event, tapOwner),
        },
      ),
    });
  }
}
class EditableFocus extends Focus {
  constructor(
    child: Widget,
    focusNode: FocusNode,
    private readonly commands: Pick<FocusAttachmentOptions, 'focus' | 'blur' | 'reveal'>,
  ) {
    super(child, { focusNode, includeSemantics: false });
  }
  override get attachmentCommands(): Pick<FocusAttachmentOptions, 'focus' | 'blur' | 'reveal'> {
    return this.commands;
  }
}
class EditableIntentAction extends ContextAction<Intent> {
  constructor(
    type: IntentType,
    private readonly enabledState: () => boolean,
    private readonly enabled: (intent: Intent) => boolean,
    private readonly invokeIntent: (intent: Intent, context?: BuildContext) => unknown,
  ) {
    super(type);
  }
  override get isActionEnabled(): boolean {
    return this.enabledState();
  }
  override isEnabled(intent: Intent): boolean {
    return this.enabled(intent);
  }
  invoke(intent: Intent, context?: BuildContext): unknown {
    return this.invokeIntent(intent, context);
  }
}
interface EditorBaselines {
  readonly lineHeight: number;
  readonly alphabetic: number;
  readonly ideographic: number;
}
class NeverUserScrollableScrollPhysics extends ScrollPhysics {
  override applyTo(ancestor: ScrollPhysics | null): NeverUserScrollableScrollPhysics {
    return new NeverUserScrollableScrollPhysics({ parent: this.buildParent(ancestor) });
  }
  override get allowUserScrolling(): boolean {
    return false;
  }
}
let editingIdentitySequence = 0;
function newEditingIdentity(): { readonly generation: number } {
  invariant(
    Number.isSafeInteger(editingIdentitySequence + 1),
    'editing-identity-exhausted',
    'Editing owner generation space is exhausted',
  );
  return Object.freeze({ generation: ++editingIdentitySequence });
}
const singleLineIOSPhysics = new NeverUserScrollableScrollPhysics();
class EditorBox extends RenderObjectWidget {
  constructor(
    readonly id: string,
    readonly label: string,
    readonly height: number,
    readonly focus: () => void,
    readonly value: string,
    readonly focused: boolean,
    readonly focusable: boolean,
    readonly enabled: boolean,
    readonly paintValue: EditablePaintValue,
    key: GlobalKey,
    readonly links: EditableSelectionLinks | undefined,
    readonly configuration: EditingConfiguration,
    readonly viewportOffset: ViewportOffset,
    readonly geometryChanged: () => void,
    readonly revealCaret: () => void,
    readonly style?: EditorStyle,
    readonly baselines?: EditorBaselines,
    readonly layout?: EditableTextLayout,
    readonly textActions?: SemanticsTextActions,
    readonly textInputRevision?: number,
    readonly textInputGeneration?: number,
    readonly textRevision?: number,
  ) {
    super(key);
  }
  get childWidgets(): readonly Widget[] {
    return [];
  }
  createRenderObject(): RenderBox {
    return new RenderEditable(this.height);
  }
  updateRenderObject(_context: BuildContext, object: RenderBox): void {
    const render = object as RenderEditable;
    render.offset = this.viewportOffset;
    render.height = this.height;
    render.textBaselines = this.baselines ?? null;
    render.textLayout = this.layout ?? null;
    render.editingValue = this.paintValue;
    render.selectionLinks = this.links;
    render.onInputGeometryChanged = this.geometryChanged;
    render.onCaretReveal = this.revealCaret;
    render.semantics = {
      id: this.id,
      role: 'text-field',
      ...(this.enabled && this.textActions ? { textActions: this.textActions } : {}),
      ...(this.textInputRevision !== undefined
        ? { textInputRevision: this.textInputRevision }
        : {}),
      ...(this.textInputGeneration !== undefined
        ? { textInputGeneration: this.textInputGeneration }
        : {}),
      ...(this.textRevision !== undefined ? { textRevision: this.textRevision } : {}),
      name: this.label,
      enabled: this.enabled,
      textSelection: this.paintValue.selection,
      readOnly: this.configuration.readOnly,
      obscured: this.configuration.obscureText,
      multiline: this.configuration.multiline,
      ...(this.style ? { editorStyle: this.style } : {}),
      ...(this.focusable ? { activate: this.focus, actions: { focus: this.focus } } : {}),
      value: this.value,
      focused: this.focused,
      focusable: this.focusable,
    };
  }
}
