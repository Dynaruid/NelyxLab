// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed SelectionOverlay and its two private widgets from widgets/text_selection.dart.
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { FoundationPlatform } from '../../foundation/platform.ts';
import { invariant } from '../../foundation/errors.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { ValueNotifier } from '../../foundation/notifier.ts';
import type { ValueListenable } from '../../foundation/notifier.ts';
import { Offset } from '../../ui/offset.ts';
import { Rect } from '../../ui/rect.ts';
import { PointerDeviceKind } from '../../ui/pointer.ts';
import { LayerLink } from '../rendering/layer.ts';
import { RenderBox } from '../rendering/object.ts';
import { TextSelectionHandleType } from '../rendering/selection.ts';
import type { TextSelectionPoint } from '../rendering/editable.ts';
import { HitTestBehavior } from '../rendering/pointer-listener.ts';
import { DragStartBehavior } from '../gestures/recognizer.ts';
import { DragStartDetails } from '../gestures/drag-details.ts';
import type { DragUpdateDetails, DragEndDetails } from '../gestures/drag-details.ts';
import { PanGestureRecognizer } from '../gestures/monodrag.ts';
import { DeviceGestureSettings } from '../gestures/gesture-settings.ts';
import { Alignment } from '../painting/alignment.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import { StatefulWidget, Element } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import { Overlay, OverlayEntry } from './overlay.ts';
import { InheritedTheme } from './inherited-theme.ts';
import { TextSelectionControls } from './text-selection.ts';
import { MagnifierController, MagnifierInfo, TextMagnifierConfiguration } from './magnifier.ts';
import { ContextMenuController } from './context-menu-controller.ts';
import { SelectableRegion } from './selectable-region-state.ts';
import { SizedBox, Padding, Align } from './basic.ts';
import { TapRegion, TextFieldTapRegion } from './tap-region.ts';
import { ExcludeSemantics } from './semantics.ts';
import { Directionality } from './app-data.ts';
import { FadeTransition } from './transitions.ts';
import { CompositedTransformFollower } from './composited-transform.ts';
import {
  RawGestureDetector,
  GestureRecognizerFactoryWithHandlers,
} from './raw-gesture-detector.ts';
import { SingleTickerProviderStateMixin } from './ticker-provider.ts';
import { AnimationController } from '../animation/animation-controller.ts';
import { maybeTickerScheduler } from './ticker-scheduler.ts';
export interface SelectionOverlayOptions {
  readonly context: BuildContext;
  readonly debugRequiredFor?: Widget | null;
  readonly startHandleType: TextSelectionHandleType;
  readonly lineHeightAtStart: number;
  readonly startHandlesVisible?: ValueListenable<boolean> | null;
  readonly onStartHandleDragStart?: ((details: DragStartDetails) => void) | null;
  readonly onStartHandleDragUpdate?: ((details: DragUpdateDetails) => void) | null;
  readonly onStartHandleDragEnd?: ((details: DragEndDetails) => void) | null;
  readonly endHandleType: TextSelectionHandleType;
  readonly lineHeightAtEnd: number;
  readonly endHandlesVisible?: ValueListenable<boolean> | null;
  readonly onEndHandleDragStart?: ((details: DragStartDetails) => void) | null;
  readonly onEndHandleDragUpdate?: ((details: DragUpdateDetails) => void) | null;
  readonly onEndHandleDragEnd?: ((details: DragEndDetails) => void) | null;
  readonly toolbarVisible?: ValueListenable<boolean> | null;
  readonly selectionEndpoints: readonly TextSelectionPoint[];
  readonly selectionControls: TextSelectionControls | null;
  readonly startHandleLayerLink: LayerLink;
  readonly endHandleLayerLink: LayerLink;
  readonly toolbarLayerLink: LayerLink;
  readonly dragStartBehavior?: DragStartBehavior;
  readonly onSelectionHandleTapped?: (() => void) | null;
  readonly magnifierConfiguration?: TextMagnifierConfiguration;
}
export class SelectionOverlay {
  static readonly fadeDuration = 150;
  readonly context: BuildContext;
  readonly debugRequiredFor: Widget | null;
  readonly startHandlesVisible: ValueListenable<boolean> | null;
  readonly endHandlesVisible: ValueListenable<boolean> | null;
  readonly toolbarVisible: ValueListenable<boolean> | null;
  readonly onStartHandleDragStart: ((details: DragStartDetails) => void) | null;
  readonly onStartHandleDragUpdate: ((details: DragUpdateDetails) => void) | null;
  readonly onStartHandleDragEnd: ((details: DragEndDetails) => void) | null;
  readonly onEndHandleDragStart: ((details: DragStartDetails) => void) | null;
  readonly onEndHandleDragUpdate: ((details: DragUpdateDetails) => void) | null;
  readonly onEndHandleDragEnd: ((details: DragEndDetails) => void) | null;
  readonly selectionControls: TextSelectionControls | null;
  readonly startHandleLayerLink: LayerLink;
  readonly endHandleLayerLink: LayerLink;
  readonly toolbarLayerLink: LayerLink;
  readonly dragStartBehavior: DragStartBehavior;
  readonly onSelectionHandleTapped: (() => void) | null;
  readonly magnifierConfiguration: TextMagnifierConfiguration;
  private startType: TextSelectionHandleType;
  private endType: TextSelectionHandleType;
  private startHeight: number;
  private endHeight: number;
  private endpoints: readonly TextSelectionPoint[];
  private startDrag = false;
  private endDrag = false;
  private startDragInProgress = false;
  private endDragInProgress = false;
  private handles: { start: OverlayEntry; end: OverlayEntry } | null = null;
  private buildScheduled = false;
  private retired = false;
  private readonly contextMenu = new ContextMenuController();
  private readonly spellCheckMenu = new ContextMenuController();
  private readonly magnifierInfo = new ValueNotifier(MagnifierInfo.empty, (a, b) => a.equals(b));
  private readonly magnifier = new MagnifierController();
  constructor(options: SelectionOverlayOptions) {
    this.context = options.context;
    this.debugRequiredFor = options.debugRequiredFor ?? null;
    this.startType = options.startHandleType;
    this.endType = options.endHandleType;
    this.startHeight = options.lineHeightAtStart;
    this.endHeight = options.lineHeightAtEnd;
    this.endpoints = options.selectionEndpoints;
    this.startHandlesVisible = options.startHandlesVisible ?? null;
    this.endHandlesVisible = options.endHandlesVisible ?? null;
    this.toolbarVisible = options.toolbarVisible ?? null;
    this.onStartHandleDragStart = options.onStartHandleDragStart ?? null;
    this.onStartHandleDragUpdate = options.onStartHandleDragUpdate ?? null;
    this.onStartHandleDragEnd = options.onStartHandleDragEnd ?? null;
    this.onEndHandleDragStart = options.onEndHandleDragStart ?? null;
    this.onEndHandleDragUpdate = options.onEndHandleDragUpdate ?? null;
    this.onEndHandleDragEnd = options.onEndHandleDragEnd ?? null;
    this.selectionControls = options.selectionControls;
    this.startHandleLayerLink = options.startHandleLayerLink;
    this.endHandleLayerLink = options.endHandleLayerLink;
    this.toolbarLayerLink = options.toolbarLayerLink;
    this.dragStartBehavior = options.dragStartBehavior ?? DragStartBehavior.start;
    this.onSelectionHandleTapped = options.onSelectionHandleTapped ?? null;
    this.magnifierConfiguration =
      options.magnifierConfiguration ?? TextMagnifierConfiguration.disabled;
    if (FoundationBuildMode.debug) Overlay.of(this.context);
  }
  get toolbarIsVisible(): boolean {
    return this.contextMenu.isShown || this.spellCheckMenu.isShown;
  }
  get magnifierIsVisible(): boolean {
    return this.magnifier.shown;
  }
  get magnifierExists(): boolean {
    return this.magnifier.overlayEntry !== null;
  }
  showMagnifier(initial: MagnifierInfo): void {
    this.ensureAlive();
    if (this.magnifier.overlayEntry !== null) return;
    if (this.toolbarIsVisible) this.hideToolbar();
    this.magnifierInfo.value = initial;
    const built = this.magnifierConfiguration.magnifierBuilder(
      this.context,
      this.magnifier,
      this.magnifierInfo,
    );
    if (built === null || this.retired) return;
    this.observe(
      this.magnifier.show({
        context: this.context,
        below: this.magnifierConfiguration.shouldDisplayHandlesInMagnifier
          ? null
          : (this.handles?.start ?? null),
        builder: () => built,
      }),
    );
  }
  hideMagnifier(): void {
    if (this.magnifier.overlayEntry !== null) this.observe(this.magnifier.hide());
  }
  updateMagnifier(info: MagnifierInfo): void {
    if (!this.retired && this.magnifier.overlayEntry !== null) this.magnifierInfo.value = info;
  }
  get startHandleType(): TextSelectionHandleType {
    return this.startType;
  }
  set startHandleType(value: TextSelectionHandleType) {
    if (value === this.startType) return;
    this.startType = value;
    this.markNeedsBuild();
  }
  get endHandleType(): TextSelectionHandleType {
    return this.endType;
  }
  set endHandleType(value: TextSelectionHandleType) {
    if (value === this.endType) return;
    this.endType = value;
    this.markNeedsBuild();
  }
  get lineHeightAtStart(): number {
    return this.startHeight;
  }
  set lineHeightAtStart(value: number) {
    if (value === this.startHeight) return;
    this.startHeight = value;
    this.markNeedsBuild();
  }
  get lineHeightAtEnd(): number {
    return this.endHeight;
  }
  set lineHeightAtEnd(value: number) {
    if (value === this.endHeight) return;
    this.endHeight = value;
    this.markNeedsBuild();
  }
  get isDraggingStartHandle(): boolean {
    return this.startDrag || this.startDragInProgress;
  }
  get isDraggingEndHandle(): boolean {
    return this.endDrag || this.endDragInProgress;
  }
  private canDrag(opposite: boolean): boolean {
    return (
      !opposite ||
      (FoundationPlatform.defaultTargetPlatform !== 'iOS' &&
        FoundationPlatform.defaultTargetPlatform !== 'macOS' &&
        FoundationPlatform.hostEnvironment.kind !== 'web')
    );
  }
  private readonly startDragStart = (details: DragStartDetails): void =>
    this.handleDragStart(false, details);
  private readonly endDragStart = (details: DragStartDetails): void =>
    this.handleDragStart(true, details);
  private readonly startDragUpdate = (details: DragUpdateDetails): void =>
    this.handleDragUpdate(false, details);
  private readonly endDragUpdate = (details: DragUpdateDetails): void =>
    this.handleDragUpdate(true, details);
  private readonly startDragEnd = (details: DragEndDetails): void =>
    this.handleDragEnd(false, details);
  private readonly endDragEnd = (details: DragEndDetails): void =>
    this.handleDragEnd(true, details);
  private handleDragStart(end: boolean, details: DragStartDetails): void {
    if (FoundationBuildMode.debug)
      invariant(
        !(end ? this.endDrag : this.startDrag),
        'duplicate-selection-handle-drag',
        'Handle is already dragging',
      );
    if (this.handles === null || this.retired) {
      if (end) this.endDrag = false;
      else this.startDrag = false;
      return;
    }
    if (end) this.endDragInProgress = true;
    else this.startDragInProgress = true;
    if (!this.canDrag(end ? this.startDrag : this.endDrag)) return;
    if (end) this.endDrag = details.kind === PointerDeviceKind.touch;
    else this.startDrag = details.kind === PointerDeviceKind.touch;
    (end ? this.onEndHandleDragStart : this.onStartHandleDragStart)?.(details);
  }
  private handleDragUpdate(end: boolean, details: DragUpdateDetails): void {
    if (this.handles === null || this.retired) {
      if (end) this.endDrag = false;
      else this.startDrag = false;
      return;
    }
    if (!this.canDrag(end ? this.startDrag : this.endDrag)) return;
    if (!(end ? this.endDrag : this.startDrag)) {
      if (end) this.endDrag = details.kind === PointerDeviceKind.touch;
      else this.startDrag = details.kind === PointerDeviceKind.touch;
      (end ? this.onEndHandleDragStart : this.onStartHandleDragStart)?.(
        new DragStartDetails({
          globalPosition: details.globalPosition,
          localPosition: details.localPosition,
          sourceTimeStamp: details.sourceTimeStamp,
          kind: details.kind,
        }),
      );
    }
    if (this.retired || this.handles === null) return;
    (end ? this.onEndHandleDragUpdate : this.onStartHandleDragUpdate)?.(details);
  }
  private handleDragEnd(end: boolean, details: DragEndDetails): void {
    if (end) this.endDrag = false;
    else this.startDrag = false;
    if (this.handles === null || this.retired) return;
    if (end) this.endDragInProgress = false;
    else this.startDragInProgress = false;
    if (!this.canDrag(end ? this.startDrag : this.endDrag)) return;
    (end ? this.onEndHandleDragEnd : this.onStartHandleDragEnd)?.(details);
  }
  get selectionEndpoints(): readonly TextSelectionPoint[] {
    return this.endpoints;
  }
  set selectionEndpoints(value: readonly TextSelectionPoint[]) {
    if (
      value.length !== this.endpoints.length ||
      value.some((point, i) => !point.equals(this.endpoints[i]))
    ) {
      this.markNeedsBuild();
      if (
        (this.startDrag || this.endDrag) &&
        FoundationPlatform.defaultTargetPlatform === 'android'
      ) {
        const channel = this.context.services.platformServices?.channels.platform;
        if (channel)
          this.observe(
            channel.invokeMethod('HapticFeedback.vibrate', 'HapticFeedbackType.selectionClick'),
          );
      }
    }
    this.endpoints = value;
  }
  showHandles(): void {
    this.ensureAlive();
    if (this.handles !== null) return;
    const overlay = Overlay.of(this.context, { rootOverlay: true }),
      themes = InheritedTheme.capture(this.context, overlay.context),
      handles = {
        start: new OverlayEntry({
          builder: (context) => themes.wrap(this.buildHandle(context, false)),
        }),
        end: new OverlayEntry({
          builder: (context) => themes.wrap(this.buildHandle(context, true)),
        }),
      };
    this.handles = handles;
    try {
      overlay.insertAll([handles.start, handles.end]);
    } catch (error) {
      this.handles = null;
      try {
        this.releaseEntries([handles.start, handles.end]);
      } catch (cleanup) {
        throw new AggregateError(
          [error, cleanup],
          'Selection handles insertion and rollback failed',
        );
      }
      throw error;
    }
  }
  hideHandles(): void {
    const handles = this.handles;
    this.handles = null;
    if (handles !== null) this.releaseEntries([handles.start, handles.end]);
  }
  showToolbar({
    context,
    contextMenuBuilder,
  }: {
    readonly context: BuildContext;
    readonly contextMenuBuilder: (context: BuildContext) => Widget;
  }): void {
    this.ensureAlive();
    const box = this.renderBox(context);
    this.contextMenu.show({
      context,
      contextMenuBuilder: (buildContext) =>
        new SelectionToolbarWrapper({
          visibility: this.toolbarVisible,
          layerLink: this.toolbarLayerLink,
          offset: new Offset(-box.localToGlobal(Offset.zero).x, -box.localToGlobal(Offset.zero).y),
          child: contextMenuBuilder(buildContext),
        }),
    });
  }
  showSpellCheckSuggestionsToolbar({
    context,
    builder,
  }: {
    readonly context?: BuildContext | null;
    readonly builder: (context: BuildContext) => Widget;
  }): void {
    this.ensureAlive();
    if (context == null) return;
    const box = this.renderBox(context);
    this.spellCheckMenu.show({
      context,
      contextMenuBuilder: (buildContext) =>
        new SelectionToolbarWrapper({
          layerLink: this.toolbarLayerLink,
          offset: new Offset(-box.localToGlobal(Offset.zero).x, -box.localToGlobal(Offset.zero).y),
          child: builder(buildContext),
        }),
    });
  }
  markNeedsBuild(): void {
    if (
      this.retired ||
      (this.handles === null && !this.contextMenu.isShown && !this.spellCheckMenu.isShown)
    )
      return;
    const scheduler = maybeTickerScheduler(this.context);
    if (scheduler === null) return;
    const rebuild = () => {
      this.buildScheduled = false;
      if (this.retired) return;
      this.handles?.start.markNeedsBuild();
      this.handles?.end.markNeedsBuild();
      if (this.contextMenu.isShown) this.contextMenu.markNeedsBuild();
      else if (this.spellCheckMenu.isShown) this.spellCheckMenu.markNeedsBuild();
    };
    if (['persistent', 'build', 'layout', 'paint', 'semantics'].includes(scheduler.phase)) {
      if (this.buildScheduled) return;
      this.buildScheduled = true;
      scheduler.addPostFrameCallback(rebuild, { debugLabel: 'SelectionOverlay.markNeedsBuild' });
    } else rebuild();
  }
  hide(): void {
    const errors: unknown[] = [];
    for (const close of [
      () => this.hideMagnifier(),
      () => this.hideHandles(),
      () => this.hideToolbar(),
    ])
      try {
        close();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Selection overlay hide failed');
  }
  hideToolbar(): void {
    const errors: unknown[] = [];
    for (const close of [() => this.contextMenu.remove(), () => this.spellCheckMenu.remove()])
      try {
        close();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Selection toolbar retirement failed');
  }
  dispose(): void {
    if (this.retired) return;
    this.retired = true;
    const errors: unknown[] = [];
    for (const close of [
      () => this.hideHandles(),
      () => this.hideToolbar(),
      () => this.magnifier.removeFromOverlay(),
      () => this.magnifierInfo.dispose(),
    ])
      try {
        close();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Selection overlay retirement failed');
  }
  private buildHandle(_context: BuildContext, end: boolean): Widget {
    const type = end ? this.endType : this.startType;
    // Start collapsed handles hide only while the opposite handle is dragging.
    const hide =
      this.selectionControls === null ||
      (!end
        ? type === TextSelectionHandleType.collapsed && this.endDrag
        : type === TextSelectionHandleType.collapsed &&
          (this.startDrag || (!this.startDrag && !this.endDrag)));
    const handle = hide
      ? SizedBox.shrink()
      : new SelectionHandleOverlay({
          type,
          handleLayerLink: end ? this.endHandleLayerLink : this.startHandleLayerLink,
          onSelectionHandleTapped: this.onSelectionHandleTapped,
          onSelectionHandleDragStart: end ? this.endDragStart : this.startDragStart,
          onSelectionHandleDragUpdate: end ? this.endDragUpdate : this.startDragUpdate,
          onSelectionHandleDragEnd: end ? this.endDragEnd : this.startDragEnd,
          selectionControls: this.selectionControls!,
          visibility: end ? this.endHandlesVisible : this.startHandlesVisible,
          preferredLineHeight: end ? this.endHeight : this.startHeight,
          dragStartBehavior: this.dragStartBehavior,
        });
    return new TapRegion(new TextFieldTapRegion(new ExcludeSemantics(handle)), {
      groupId: SelectableRegion,
    });
  }
  private renderBox(context: BuildContext): RenderBox {
    const box = context.findRenderObject();
    invariant(
      box instanceof RenderBox,
      'missing-selection-render-box',
      'Selection overlay requires a mounted RenderBox',
    );
    return box;
  }
  private ensureAlive(): void {
    invariant(!this.retired, 'disposed-selection-overlay', 'Selection overlay has been disposed');
  }
  private observe(operation: Promise<unknown>): void {
    void operation.catch((error) => {
      if (this.context.services.reportError) this.context.services.reportError(error);
      else
        FlutterError.reportError(
          new FlutterErrorDetails({ exception: error, library: 'widgets library' }),
        );
    });
  }
  private releaseEntries(entries: readonly OverlayEntry[]): void {
    const errors: unknown[] = [];
    for (const entry of entries) {
      if (entry.overlay !== null)
        try {
          entry.remove();
        } catch (error) {
          errors.push(error);
        }
      try {
        entry.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(errors, 'Selection overlay entries failed to retire');
  }
}
interface ToolbarOptions {
  readonly visibility?: ValueListenable<boolean> | null;
  readonly layerLink: LayerLink;
  readonly offset: Offset;
  readonly child: Widget;
}
class SelectionToolbarWrapper extends StatefulWidget {
  constructor(readonly options: ToolbarOptions) {
    super();
  }
  createState(): SelectionToolbarWrapperState {
    return new SelectionToolbarWrapperState();
  }
}
class SelectionToolbarWrapperState extends SingleTickerProviderStateMixin<SelectionToolbarWrapper> {
  private controller!: AnimationController;
  private readonly visibilityChanged = () => {
    if (this.widget.options.visibility?.value ?? true) this.controller.forward();
    else this.controller.reverse();
  };
  override initState(): void {
    super.initState();
    this.controller = new AnimationController({
      duration: SelectionOverlay.fadeDuration,
      vsync: this,
    });
    this.visibilityChanged();
    this.widget.options.visibility?.addListener(this.visibilityChanged);
  }
  override didUpdateWidget(old: SelectionToolbarWrapper): void {
    super.didUpdateWidget(old);
    if (old.options.visibility === this.widget.options.visibility) return;
    old.options.visibility?.removeListener(this.visibilityChanged);
    this.visibilityChanged();
    this.widget.options.visibility?.addListener(this.visibilityChanged);
  }
  override dispose(): void {
    this.widget.options.visibility?.removeListener(this.visibilityChanged);
    this.controller.dispose();
    super.dispose();
  }
  build(context: BuildContext): Widget {
    const o = this.widget.options;
    return new TapRegion(
      new TextFieldTapRegion(
        new Directionality(
          Directionality.of(context),
          new FadeTransition({
            opacity: this.controller.view,
            child: new CompositedTransformFollower(o.child, {
              link: o.layerLink,
              showWhenUnlinked: false,
              offset: o.offset,
            }),
          }),
        ),
      ),
      { groupId: SelectableRegion },
    );
  }
}
interface HandleOptions {
  readonly type: TextSelectionHandleType;
  readonly handleLayerLink: LayerLink;
  readonly onSelectionHandleTapped: (() => void) | null;
  readonly onSelectionHandleDragStart: ((details: DragStartDetails) => void) | null;
  readonly onSelectionHandleDragUpdate: ((details: DragUpdateDetails) => void) | null;
  readonly onSelectionHandleDragEnd: ((details: DragEndDetails) => void) | null;
  readonly selectionControls: TextSelectionControls;
  readonly visibility: ValueListenable<boolean> | null;
  readonly preferredLineHeight: number;
  readonly dragStartBehavior: DragStartBehavior;
}
class SelectionHandleOverlay extends StatefulWidget {
  constructor(readonly options: HandleOptions) {
    super();
  }
  createState(): SelectionHandleOverlayState {
    return new SelectionHandleOverlayState();
  }
}
class SelectionHandleOverlayState extends SingleTickerProviderStateMixin<SelectionHandleOverlay> {
  private controller!: AnimationController;
  private readonly visibilityChanged = () => {
    if (this.widget.options.visibility?.value ?? true) this.controller.forward();
    else this.controller.reverse();
  };
  override initState(): void {
    super.initState();
    this.controller = new AnimationController({
      duration: SelectionOverlay.fadeDuration,
      vsync: this,
    });
    this.visibilityChanged();
    this.widget.options.visibility?.addListener(this.visibilityChanged);
  }
  override didUpdateWidget(old: SelectionHandleOverlay): void {
    super.didUpdateWidget(old);
    old.options.visibility?.removeListener(this.visibilityChanged);
    this.visibilityChanged();
    this.widget.options.visibility?.addListener(this.visibilityChanged);
  }
  override dispose(): void {
    this.widget.options.visibility?.removeListener(this.visibilityChanged);
    this.controller.dispose();
    super.dispose();
  }
  build(context: BuildContext): Widget {
    invariant(
      context instanceof Element,
      'invalid-selection-handle-context',
      'Handle requires its actual View owner',
    );
    const o = this.widget.options,
      size = o.selectionControls.getHandleSize(o.preferredLineHeight),
      rect = Rect.fromLTWH(0, 0, size.width, size.height),
      interactive = rect.isEmpty
        ? rect
        : rect.expandToInclude(Rect.fromCircle({ center: rect.center, radius: 24 })),
      padding = interactive.isEmpty
        ? EdgeInsets.zero
        : new EdgeInsets(
            Math.max((interactive.width - rect.width) / 2, 0),
            Math.max((interactive.height - rect.height) / 2, 0),
            Math.max((interactive.width - rect.width) / 2, 0),
            Math.max((interactive.height - rect.height) / 2, 0),
          ),
      anchor = o.selectionControls.getHandleAnchor(o.type, o.preferredLineHeight),
      factory = new GestureRecognizerFactoryWithHandlers(
        PanGestureRecognizer,
        () =>
          new PanGestureRecognizer({
            binding: context.owner.gestureBinding,
            debugOwner: this,
            supportedDevices: new Set([
              PointerDeviceKind.touch,
              PointerDeviceKind.stylus,
              PointerDeviceKind.unknown,
            ]),
          }),
        (recognizer) => {
          recognizer.dragStartBehavior = o.dragStartBehavior;
          recognizer.gestureSettings =
            o.type === TextSelectionHandleType.collapsed &&
            FoundationPlatform.defaultTargetPlatform === 'iOS'
              ? new DeviceGestureSettings({ touchSlop: 1 })
              : null;
          recognizer.onStart = o.onSelectionHandleDragStart;
          recognizer.onUpdate = o.onSelectionHandleDragUpdate;
          recognizer.onEnd = o.onSelectionHandleDragEnd;
        },
      );
    return new CompositedTransformFollower(
      new FadeTransition({
        opacity: this.controller.view,
        child: new SizedBox(
          interactive.width,
          interactive.height,
          new Align(
            new RawGestureDetector(
              new Padding(
                padding,
                o.selectionControls.buildHandle(
                  context,
                  o.type,
                  o.preferredLineHeight,
                  o.onSelectionHandleTapped,
                ),
              ),
              {
                behavior: HitTestBehavior.translucent,
                gestures: new Map([[PanGestureRecognizer, factory]]),
              },
            ),
            { alignment: Alignment.topLeft },
          ),
        ),
      }),
      {
        link: o.handleLayerLink,
        offset: new Offset(-anchor.dx - padding.left, -anchor.dy - padding.top),
        showWhenUnlinked: false,
      },
    );
  }
}
