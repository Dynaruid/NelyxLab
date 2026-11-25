// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Selected read-only body/selection intent from pinned material/selectable_text.dart.
import {
  StatefulWidget,
  State,
  RenderObjectWidget,
  LeafRenderObjectElement,
  Element,
} from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import type { TextOptions } from './basic.ts';
import { Localizations } from './app-data.ts';
import { Focus } from './focus-scope.ts';
import { FocusNode } from './focus.ts';
import { TextSelectionController } from '../painting/text-selection-controller.ts';
import { RenderSelectableParagraph } from '../rendering/selectable-paragraph.ts';
import type { RenderBox } from '../rendering/object.ts';
import type { TextSelection } from '../../ui/types.ts';
import type { RichParagraphConfiguration } from '../rendering/paragraph.ts';
import '../../ui/text.ts';
import { Clipboard, ClipboardData } from '../../services/clipboard.ts';
import { invariant } from '../../foundation/errors.ts';
import { FoundationPlatform } from '../../foundation/platform.ts';
import type { Disposable } from '../../foundation/disposable.ts';
import { resolveTextConfiguration } from './text-input.ts';
import { TextSpan } from '../painting/text-span.ts';
import { Offset } from '../../ui/offset.ts';
import type { Offset as Point } from '../../ui/geometry.ts';
import { Rect } from '../../ui/rect.ts';
import { TextPosition } from '../../ui/text-position.ts';
import { TextSelection as SourceSelection } from '../../services/text-editing.ts';
import { TextSelectionPoint } from '../rendering/editable.ts';
import { TextSelectionHandleType } from '../rendering/selection.ts';
import { LayerLink } from '../rendering/layer.ts';
import { ContextMenuButtonFocus, isContextMenuKey } from './context-menu-controller.ts';
import { ContextMenuButtonItem, ContextMenuButtonType } from './context-menu-button-item.ts';
import { SelectionOverlay, observeSelectionFrames } from './selection-overlay.ts';
import {
  TextSelectionToolbarAnchors,
  projectSelectionRect,
  visibleSelectionBounds,
} from './text-selection-toolbar-anchors.ts';
import {
  MagnifierInfo,
  TextMagnifierConfiguration,
  MagnifierController,
  RawMagnifier,
  magnifierViewportBounds,
} from './magnifier.ts';
import type { TextSelectionControls } from './text-selection.ts';
import { GlobalKey } from './global-key.ts';
import { Overlay } from './overlay.ts';
import { isCurrentRoute } from './navigation.ts';
import { GestureDetector } from './gesture-detector.ts';
import { TapRegion } from './tap-region.ts';
import { ListenableBuilder } from './listenable-builder.ts';
import { ColoredBox, Padding, Positioned, Row, SizedBox, Text } from './basic.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import { Semantics } from './semantics.ts';
import { CustomSingleChildLayout } from './custom-layout.ts';
import { DesktopTextSelectionToolbarLayoutDelegate } from './desktop-text-selection-toolbar-layout-delegate.ts';
import { TextSelectionToolbarLayoutDelegate } from './text-selection-toolbar-layout-delegate.ts';
import { maybeTickerScheduler } from './ticker-scheduler.ts';

export type SelectableTextContextMenuBuilder = (
  context: BuildContext,
  state: SelectableTextState,
) => Widget;
export interface SelectableTextOptions extends TextOptions {
  readonly controller?: TextSelectionController;
  readonly focusNode?: FocusNode;
  readonly selectionColor?: number;
  readonly onSelectionChanged?: (selection: TextSelection) => void;
  readonly onCopyError?: (error: unknown) => void;
  readonly contextMenuBuilder?: SelectableTextContextMenuBuilder | null;
  readonly magnifierConfiguration?: TextMagnifierConfiguration;
  readonly selectionControls?: TextSelectionControls;
}
/** Read-only text with shaped range highlights and selection overlays. */
export class SelectableText extends StatefulWidget {
  readonly text: string;
  readonly textSpan: TextSpan | null;
  constructor(
    text: string | TextSpan,
    readonly options: SelectableTextOptions = {},
  ) {
    super(options.key ?? null);
    this.textSpan = typeof text === 'string' ? null : text;
    this.text =
      typeof text === 'string' ? text : text.toPlainText({ includeSemanticsLabels: false });
    if (this.textSpan)
      this.textSpan.visitChildren((span) => {
        invariant(
          span instanceof TextSpan,
          'selectable-span-kind',
          'SelectableText.rich requires TextSpan descendants; inline widget selection uses a selection region',
        );
        return true;
      });
  }
  static rich(textSpan: TextSpan, options: SelectableTextOptions = {}): SelectableText {
    return new SelectableText(textSpan, options);
  }
  createState(): State {
    return new SelectableTextState();
  }
}
export class SelectableTextState extends State<SelectableText> {
  private controller!: TextSelectionController;
  private ownController = false;
  private focus!: FocusNode;
  private ownFocus = false;
  private epoch = 0;
  private lastSelection: TextSelection = { anchor: 0, focus: 0 };
  private readonly renderKey = new GlobalKey('SelectableText paragraph');
  private readonly handleLinks = [new LayerLink(), new LayerLink()] as const;
  private readonly toolbarLink = new LayerLink();
  private overlay: SelectionOverlay | null = null;
  private frames: Disposable | null = null;
  private visibility: Disposable | undefined;
  private anchor: Offset | null = null;
  private lastAnchors: TextSelectionToolbarAnchors | null = null;
  private drag: {
    global: Offset;
    opposite: number;
    initial: TextSelection | null;
    grip: Offset;
  } | null = null;
  private readonly focusChanged = () => {
    if (!this.focus.hasFocus) this.closeSelectionUI();
  };
  override initState(): void {
    this.connect();
    this.visibility = maybeTickerScheduler(this.context)?.observeVisibility((visible) => {
      if (!visible) this.closeSelectionUI();
    });
  }
  private connect(): void {
    this.controller =
      this.widget.options.controller ?? new TextSelectionController(this.widget.text);
    this.ownController = !this.widget.options.controller;
    invariant(
      this.controller.text === this.widget.text,
      'selection-text-mismatch',
      'Initial controller text must match SelectableText',
    );
    this.lastSelection = this.controller.selection;
    this.focus = this.widget.options.focusNode ?? new FocusNode();
    this.ownFocus = !this.widget.options.focusNode;
    this.controller.addListener(this.changed);
    this.focus.addListener(this.focusChanged);
  }
  private readonly changed = () => {
    const next = this.controller.selection;
    if (next.anchor === this.lastSelection.anchor && next.focus === this.lastSelection.focus)
      return;
    this.lastSelection = next;
    this.refreshOverlayGeometry();
    const epoch = this.epoch,
      notify = () => {
        if (this.mounted && epoch === this.epoch) this.widget.options.onSelectionChanged?.(next);
      };
    if (this.context instanceof Element && this.context.owner.building)
      this.context.owner.postFrame(notify);
    else notify();
  };
  private disconnect(): void {
    this.epoch++;
    this.controller.removeListener(this.changed);
    this.focus.removeListener(this.focusChanged);
    if (this.ownController) this.controller.dispose();
    if (this.ownFocus) this.focus.dispose();
  }
  override didUpdateWidget(old: SelectableText): void {
    if (
      old.options.selectionControls !== this.widget.options.selectionControls ||
      old.options.magnifierConfiguration !== this.widget.options.magnifierConfiguration ||
      old.options.focusNode !== this.widget.options.focusNode ||
      old.options.controller !== this.widget.options.controller ||
      old.text !== this.widget.text
    )
      this.closeSelectionUI();
    if (this.widget.options.contextMenuBuilder === null) this.overlay?.hideToolbar();
    else if (old.options.contextMenuBuilder !== this.widget.options.contextMenuBuilder)
      this.overlay?.markNeedsBuild();
    if (
      old.options.controller !== this.widget.options.controller ||
      old.options.focusNode !== this.widget.options.focusNode
    ) {
      // The old RenderObject releases its controller when the keyed child is replaced.
      const controller = this.controller,
        own = this.ownController,
        focus = this.focus,
        ownFocus = this.ownFocus;
      this.epoch++;
      controller.removeListener(this.changed);
      focus.removeListener(this.focusChanged);
      this.connect();
      invariant(
        this.context instanceof Element,
        'invalid-context',
        'SelectableText needs Element context',
      );
      this.context.owner.postFrame(() => {
        if (own) controller.dispose();
        if (ownFocus) focus.dispose();
      });
    } else if (old.text !== this.widget.text) this.controller.text = this.widget.text;
  }
  override dispose(): void {
    this.closeSelectionUI();
    this.visibility?.dispose();
    this.disconnect();
  }
  override deactivate(): void {
    this.closeSelectionUI();
    super.deactivate();
  }
  private copy(): void {
    const messenger = this.context.services.binaryMessenger;
    invariant(
      messenger,
      'missing-binary-messenger',
      'SelectableText copy requires this app binary messenger',
    );
    const epoch = this.epoch;
    void this.controller
      .copy({ writeText: (text) => Clipboard.setData(new ClipboardData(text), messenger) })
      .catch((error) => {
        if (!this.mounted || epoch !== this.epoch) return;
        if (this.widget.options.onCopyError) this.widget.options.onCopyError(error);
        else this.context.services.reportError?.(error);
      });
  }
  private get render(): RenderSelectableParagraph | null {
    const render = this.renderKey.currentContext?.findRenderObject();
    return render instanceof RenderSelectableParagraph &&
      render.attached &&
      render.hasSize &&
      !render.needsLayout
      ? render
      : null;
  }
  private visibleBounds(render: RenderSelectableParagraph): Rect {
    const { logicalWidth, logicalHeight } = this.context.services.readMetrics();
    return visibleSelectionBounds(render, Rect.fromLTWH(0, 0, logicalWidth, logicalHeight));
  }
  private selectionPositions(): readonly [TextPosition, TextPosition] {
    const { anchor, focus } = this.controller.selection;
    return [
      new TextPosition({ offset: Math.min(anchor, focus) }),
      new TextPosition({
        offset: Math.max(anchor, focus),
        affinity: anchor === focus ? 'downstream' : 'upstream',
      }),
    ];
  }
  private selectionGeometry(render: RenderSelectableParagraph) {
    const positions = this.selectionPositions();
    const rects = positions.map((position) => render.getSelectionLineRects(position).caret);
    const boxes = render.getBoxesForSelection(
      new SourceSelection({
        baseOffset: positions[0].offset,
        extentOffset: positions[1].offset,
      }),
    );
    const startDirection = boxes[0]?.direction ?? render.textDirection,
      endDirection = boxes.at(-1)?.direction ?? render.textDirection;
    return {
      startHeight: rects[0]!.height,
      endHeight: rects[1]!.height,
      startType:
        startDirection === 'rtl' ? TextSelectionHandleType.right : TextSelectionHandleType.left,
      endType:
        endDirection === 'rtl' ? TextSelectionHandleType.left : TextSelectionHandleType.right,
      endpoints: [
        new TextSelectionPoint(rects[0]!.bottomLeft, startDirection),
        new TextSelectionPoint(rects[1]!.bottomLeft, endDirection),
      ],
    };
  }
  get contextMenuAnchors(): TextSelectionToolbarAnchors {
    const render = this.render;
    if (this.anchor || !render)
      return new TextSelectionToolbarAnchors({
        primaryAnchor: this.anchor ?? Offset.zero,
      }).inOverlay(this.context);
    const { startHeight, endHeight, endpoints } = this.selectionGeometry(render);
    return TextSelectionToolbarAnchors.fromSelection({
      renderBox: render,
      startGlyphHeight: startHeight,
      endGlyphHeight: endHeight,
      selectionEndpoints: endpoints,
      visibleBounds: this.visibleBounds(render),
    }).inOverlay(this.context);
  }
  get contextMenuButtonItems(): readonly ContextMenuButtonItem[] {
    const options = this.context.services.platformServices?.environment?.capabilities;
    const selected = this.controller.selectedText,
      items: ContextMenuButtonItem[] = [];
    if (
      selected &&
      this.context.services.binaryMessenger &&
      options?.clipboardWrite !== 'unavailable'
    )
      items.push(
        new ContextMenuButtonItem({
          type: ContextMenuButtonType.copy,
          onPressed: () => {
            this.copy();
            this.overlay?.hideToolbar();
          },
        }),
      );
    if (selected.length !== this.controller.text.length)
      items.push(
        new ContextMenuButtonItem({
          type: ContextMenuButtonType.selectAll,
          onPressed: () => {
            this.controller.selectAll();
            this.overlay?.hideToolbar();
          },
        }),
      );
    return items;
  }
  private ensureOverlay(render: RenderSelectableParagraph): SelectionOverlay | null {
    if (this.overlay) return this.overlay;
    if (!Overlay.maybeOf(this.context)) return null;
    const { startType, endType, startHeight, endHeight, endpoints } =
      this.selectionGeometry(render);
    return (this.overlay = new SelectionOverlay({
      context: this.context,
      selectionControls: this.widget.options.selectionControls ?? null,
      magnifierConfiguration: this.widget.options.magnifierConfiguration ?? defaultMagnifier,
      focusNode: this.focus,
      regionTapGroupId: this,
      startHandleType: startType,
      endHandleType: endType,
      lineHeightAtStart: startHeight,
      lineHeightAtEnd: endHeight,
      selectionEndpoints: endpoints,
      startHandleLayerLink: this.handleLinks[0],
      endHandleLayerLink: this.handleLinks[1],
      toolbarLayerLink: this.toolbarLink,
      onStartHandleDragStart: (details) => this.beginHandle(false, details.globalPosition),
      onEndHandleDragStart: (details) => this.beginHandle(true, details.globalPosition),
      onStartHandleDragUpdate: (details) => this.moveContact(details.globalPosition),
      onEndHandleDragUpdate: (details) => this.moveContact(details.globalPosition),
      onStartHandleDragEnd: () => this.endContact(true),
      onEndHandleDragEnd: () => this.endContact(true),
      onHandleDragCancel: () => this.endContact(false),
      onToolbarRemoved: () => {
        this.anchor = null;
        this.lastAnchors = null;
        this.trackFrames();
      },
    }));
  }
  private refreshOverlayGeometry(): void {
    const overlay = this.overlay,
      render = this.render;
    if (!overlay || !render) return;
    const { anchor, focus } = this.controller.selection;
    if (this.widget.options.selectionControls && anchor !== focus) {
      const { startType, endType, startHeight, endHeight, endpoints } =
        this.selectionGeometry(render);
      overlay.startHandleType = startType;
      overlay.endHandleType = endType;
      overlay.lineHeightAtStart = startHeight;
      overlay.lineHeightAtEnd = endHeight;
      overlay.selectionEndpoints = endpoints;
      overlay.showHandles();
    } else overlay.hideHandles();
    overlay.markNeedsBuild();
  }
  private showToolbar(anchor: Offset | null = null): boolean {
    const render = this.render,
      builder = this.widget.options.contextMenuBuilder;
    if (!render || builder === null || this.visibleBounds(render).isEmpty) return false;
    const overlay = this.ensureOverlay(render);
    if (!overlay) return false;
    if (anchor || !overlay.toolbarIsVisible) this.anchor = anchor;
    this.lastAnchors = this.contextMenuAnchors;
    overlay.showToolbar({
      context: this.context,
      contextMenuBuilder: (context) => {
        const current = this.widget.options.contextMenuBuilder;
        return current === null
          ? SizedBox.shrink()
          : current
            ? current(context, this)
            : defaultContextMenu(context, this);
      },
    });
    this.trackFrames();
    return true;
  }
  private trackFrames(): void {
    if (!this.drag && !this.overlay?.toolbarIsVisible) {
      this.frames?.dispose();
      this.frames = null;
    } else if (!this.frames) {
      this.frames = observeSelectionFrames(this.context, () => {
        const render = this.render;
        if (
          !render ||
          !this.focus.hasPrimaryFocus ||
          !isCurrentRoute(this.context) ||
          this.visibleBounds(render).isEmpty
        ) {
          this.closeSelectionUI();
          return;
        }
        if (this.overlay?.toolbarIsVisible) {
          const anchors = this.contextMenuAnchors;
          if (!this.lastAnchors?.equals(anchors)) {
            this.lastAnchors = anchors;
            this.overlay.markNeedsBuild();
          }
        }
        if (this.drag) this.refreshMagnifier(render);
      });
    }
  }
  private closeSelectionUI(): void {
    this.drag = null;
    this.frames?.dispose();
    this.frames = null;
    const overlay = this.overlay;
    this.overlay = null;
    overlay?.dispose();
  }
  private selectWord(render: RenderSelectableParagraph, local: Point): void {
    const at = render.selectionPosition(local),
      word = render.getWordBoundary(at);
    this.controller.selection = { anchor: word.start, focus: word.end };
  }
  private beginHold(global: Offset): void {
    const render = this.render;
    if (!render) return;
    this.closeSelectionUI();
    this.focus.requestFocus();
    this.selectWord(render, render.globalToLocal(global));
    if (!this.mounted || this.render !== render || !this.ensureOverlay(render)) return;
    const initial = this.controller.selection;
    this.drag = { global, initial, opposite: initial.anchor, grip: Offset.zero };
    this.refreshOverlayGeometry();
    this.trackFrames();
    this.refreshMagnifier(render);
  }
  private beginHandle(end: boolean, global: Offset): void {
    const render = this.render;
    if (!render || !this.overlay) return;
    const positions = this.selectionPositions();
    const caret = render.getSelectionLineRects(positions[end ? 1 : 0]).caret;
    const center = render.localToGlobal(caret.center);
    this.overlay.hideToolbar();
    this.drag = {
      global,
      initial: null,
      opposite: positions[end ? 0 : 1].offset,
      grip: new Offset(center.x - global.dx, center.y - global.dy),
    };
    this.trackFrames();
    this.refreshMagnifier(render);
  }
  private moveContact(global: Offset): void {
    const drag = this.drag,
      render = this.render;
    if (!drag || !render) return;
    drag.global = global;
    const at = render.selectionPosition(render.globalToLocal(global.add(drag.grip))).offset;
    const initial = drag.initial;
    if (initial === null) {
      if (at !== drag.opposite) this.controller.selection = { anchor: drag.opposite, focus: at };
    } else if (at >= initial.anchor && at <= initial.focus) this.controller.selection = initial;
    else
      this.controller.selection = {
        anchor: at < initial.anchor ? initial.focus : initial.anchor,
        focus: at,
      };
    if (this.drag === drag && this.render === render) this.refreshMagnifier(render);
  }
  private endContact(released: boolean): void {
    if (!this.drag) return;
    this.drag = null;
    this.overlay?.hideMagnifier({ animate: released });
    if (released) this.showToolbar();
    this.trackFrames();
  }
  private refreshMagnifier(render: RenderSelectableParagraph): void {
    const drag = this.drag,
      overlay = this.overlay;
    if (!drag || !overlay || !['android', 'iOS'].includes(FoundationPlatform.defaultTargetPlatform))
      return;
    const selection = this.controller.selection;
    const position = drag.initial
      ? render.selectionPosition(render.globalToLocal(drag.global))
      : new TextPosition({
          offset: selection.focus,
          affinity: selection.focus > selection.anchor ? 'upstream' : 'downstream',
        });
    const { caret, line } = render.getSelectionLineRects(position),
      fieldBounds = this.visibleBounds(render),
      currentLineBoundaries = projectSelectionRect(render, line).intersect(fieldBounds);
    if (currentLineBoundaries.isEmpty) {
      overlay.hideMagnifier();
      return;
    }
    const info = new MagnifierInfo({
      globalGesturePosition: drag.global,
      fieldBounds,
      currentLineBoundaries,
      caretRect: projectSelectionRect(render, caret),
    });
    overlay.showMagnifier(info);
    overlay.updateMagnifier(info);
  }
  private secondaryClick(global: Offset): void {
    const render = this.render;
    if (!render) return;
    this.focus.requestFocus();
    const local = render.globalToLocal(global);
    const { anchor, focus } = this.controller.selection;
    const current = new SourceSelection({ baseOffset: anchor, extentOffset: focus });
    if (!render.getBoxesForSelection(current).some((box) => box.toRect().contains(local))) {
      if (['macOS', 'iOS'].includes(FoundationPlatform.defaultTargetPlatform))
        this.selectWord(render, local);
      else {
        const at = render.selectionPosition(local).offset;
        this.controller.selection = { anchor: at, focus: at };
      }
    }
    if (this.mounted) this.showToolbar(global);
  }
  build(_context: BuildContext): Widget {
    return new TapRegion(
      new Focus(
        new GestureDetector(
          new SelectableParagraphWidget(
            this.controller,
            this.widget.options,
            () => {
              this.closeSelectionUI();
              this.focus.requestFocus();
            },
            this.widget.textSpan,
            this.renderKey,
            this.widget.options.selectionControls ? this.handleLinks : undefined,
          ),
          {
            excludeFromSemantics: true,
            onSecondaryTapUp: (details) => this.secondaryClick(details.globalPosition),
            onLongPressStart: (details) => this.beginHold(details.globalPosition),
            onLongPressMoveUpdate: (details) => this.moveContact(details.globalPosition),
            onLongPressEnd: () => this.endContact(true),
            onLongPressCancel: () => {
              if (this.drag?.initial) this.endContact(false);
            },
          },
        ),
        {
          focusNode: this.focus,
          includeSemantics: false,
          onKeyEvent: (_node, event) => {
            if (event.kind !== 'down' || event.alt) return 'ignored';
            if (isContextMenuKey(event) && this.showToolbar()) return 'handled';
            if ((event.control || event.meta) && event.key.toLowerCase() === 'a') {
              this.controller.selectAll();
              return 'handled';
            }
            if ((event.control || event.meta) && event.key.toLowerCase() === 'c') {
              this.copy();
              return 'handled';
            }
            return this.controller.handleKey(event) ? 'handled' : 'ignored';
          },
        },
      ),
      { groupId: this, onTapOutside: () => this.closeSelectionUI() },
    );
  }
}
const defaultMagnifier = new TextMagnifierConfiguration({
  magnifierBuilder: (_context, _controller, info) =>
    new ListenableBuilder(info, (context) => {
      const { currentLineBoundaries: line, globalGesturePosition, caretRect } = info.value,
        bounds = magnifierViewportBounds(context),
        width = 76,
        height = 38;
      if (bounds.width < width || bounds.height < height) return SizedBox.shrink();
      const x = Math.max(line.left, Math.min(line.right, globalGesturePosition.dx)),
        y = caretRect.center.dy;
      const top = y - height - 20 >= bounds.top ? y - height - 20 : y + 20;
      const rect = MagnifierController.shiftWithinBounds({
        rect: Rect.fromLTWH(x - width / 2, top, width, height),
        bounds,
      });
      return new Positioned(
        new RawMagnifier({
          size: { width, height },
          magnificationScale: 1.25,
          focalPointOffset: new Offset(x - rect.center.dx, y - rect.center.dy),
        }),
        { left: rect.left, top: rect.top },
      );
    }),
});

function defaultContextMenu(context: BuildContext, state: SelectableTextState): Widget {
  const items = state.contextMenuButtonItems;
  if (!items.length) return SizedBox.shrink();
  const ko = context.maybeDependOn(Localizations)?.locale.split('-')[0] === 'ko';
  const { primaryAnchor, secondaryAnchor } = state.contextMenuAnchors;
  return new CustomSingleChildLayout(
    new ColoredBox({
      color: 0xfff1f3f4,
      child: new Row(
        items.map((item) => {
          const label =
            item.type === ContextMenuButtonType.copy
              ? ko
                ? '복사'
                : 'Copy'
              : ko
                ? '모두 선택'
                : 'Select all';
          return new ContextMenuButtonFocus(
            new Semantics({
              label,
              button: true,
              enabled: item.onPressed !== null,
              onTap: item.onPressed,
              excludeSemantics: true,
              child: new GestureDetector(
                new Padding(EdgeInsets.all(12), new Text(label, { color: 0xff202124 })),
                {
                  onTap: item.onPressed,
                  excludeFromSemantics: true,
                },
              ),
            }),
            item.onPressed,
          );
        }),
        { mainAxisSize: 'min' },
      ),
    }),
    ['android', 'iOS'].includes(FoundationPlatform.defaultTargetPlatform)
      ? new TextSelectionToolbarLayoutDelegate({
          anchorAbove: primaryAnchor,
          anchorBelow: secondaryAnchor ?? primaryAnchor,
        })
      : new DesktopTextSelectionToolbarLayoutDelegate({ anchor: primaryAnchor }),
  );
}
class SelectableParagraphWidget extends RenderObjectWidget {
  constructor(
    readonly controller: TextSelectionController,
    readonly options: SelectableTextOptions,
    readonly focus: () => void,
    readonly span: TextSpan | null,
    key: GlobalKey,
    readonly handleLinks: readonly [LayerLink, LayerLink] | undefined,
  ) {
    super(key);
  }
  override get typeToken(): object {
    return this.controller;
  }
  override createElement(): LeafRenderObjectElement {
    return new LeafRenderObjectElement(this);
  }
  get childWidgets(): readonly Widget[] {
    return [];
  }
  private configuration(context: BuildContext): RichParagraphConfiguration {
    const resolved = resolveTextConfiguration(context, this.options),
      span = this.span ?? new TextSpan({ text: this.controller.text });
    invariant(
      span.toPlainText({ includeSemanticsLabels: false }) === this.controller.text,
      'selection-text-mismatch',
      'Rich span text must match its controller',
    );
    return {
      span,
      style: resolved.style,
      scaler: resolved.scaler,
      placeholderCount: 0,
      font: resolved.font,
      scale: resolved.scale,
      paragraphOptions: resolved.paragraphOptions,
      painterOptions: resolved.painterOptions,
    };
  }
  createRenderObject(context: BuildContext): RenderBox {
    invariant(
      context instanceof Element,
      'invalid-context',
      'SelectableText needs Element context',
    );
    const config = this.configuration(context);
    return new RenderSelectableParagraph(
      config,
      {
        text: context.services.text,
        resources: context.services.resources,
        font: config.font,
        scale: config.scale,
      },
      this.controller,
      context.owner.gestures,
    );
  }
  updateRenderObject(context: BuildContext, object: RenderBox): void {
    const render = object as RenderSelectableParagraph;
    render.config = this.configuration(context);
    render.devicePixelRatio = render.config.scale;
    render.selectionColor = this.options.selectionColor ?? 0x667aaaff;
    render.requestFocus = this.focus;
    render.setHandleLinks(this.handleLinks);
    render.semantics = {
      id: render.semanticsId,
      role: 'text',
      name: this.controller.text,
      enabled: true,
      focusable: true,
      activate: this.focus,
      actions: { focus: this.focus },
    };
    render.markNeedsPaint();
  }
}
