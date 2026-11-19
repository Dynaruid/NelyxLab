// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/widgets/autocomplete.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { invariant } from '../../foundation/errors.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FoundationPlatform } from '../../foundation/platform.ts';
import type { KeyEvent } from '../../services/hardware-keyboard.ts';
import { LogicalKeyboardKey } from '../../services/keyboard-key.ts';
import { TextSelection } from '../../services/text-editing.ts';
import { TextEditingValue } from '../../services/text-input.ts';
import { bounds, inversePaintTransform, multiply, translate } from '../../ui/geometry.ts';
import type { Size } from '../../ui/geometry.ts';
import { TextRange } from '../../ui/text-range.ts';
import { Alignment } from '../painting/alignment.ts';
import { EdgeInsets } from '../painting/edge-insets.ts';
import { BoxConstraints } from '../rendering/constraints.ts';
import { LayerLink } from '../rendering/layer.ts';
import { RenderBox } from '../rendering/object.ts';
import { RenderLeaderLayer } from '../rendering/proxy-layer.ts';
import { SemanticsService } from '../semantics/semantics-service.ts';
import { Directionality, Localizations, MediaQuery } from './app-data.ts';
import { Align, Builder, ConstrainedBox, Positioned, SizedBox, Stack } from './basic.ts';
import { CompositedTransformFollower } from './composited-transform.ts';
import { TextEditingController } from './editable-text.ts';
import { ExcludeFocus } from './focus-scope.ts';
import { FocusNode } from './focus.ts';
import type { KeyEventResult } from './focus.ts';
import {
  Element,
  InheritedWidget,
  SingleChildRenderObjectWidget,
  State,
  StatefulWidget,
} from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { GlobalKey } from './global-key.ts';
import { InheritedTheme } from './inherited-theme.ts';
import { autocompleteAnnouncements } from './internal/autocomplete-announcements.ts';
import { Overlay, OverlayEntry } from './overlay.ts';
import type { OverlayState } from './overlay.ts';
import type { ScrollPosition } from './scroll-position.ts';
import { Scrollable } from './scrollable.ts';
import { TextFieldTapRegion } from './tap-region.ts';

export type AutocompleteOptionsBuilder<T> = (
  value: TextEditingValue,
) => Iterable<T> | PromiseLike<Iterable<T>>;
export type AutocompleteOptionToString<T> = (option: T) => string;
export type AutocompleteOnSelected<T> = (option: T) => void;
export type AutocompleteOptionsViewBuilder<T> = (
  context: BuildContext,
  onSelected: AutocompleteOnSelected<T>,
  options: Iterable<T>,
) => Widget;
export type AutocompleteFieldViewBuilder = (
  context: BuildContext,
  controller: TextEditingController,
  focus: FocusNode,
  onSubmitted: () => void,
) => Widget;

export enum OptionsViewOpenDirection {
  up = 'up',
  down = 'down',
  mostSpace = 'mostSpace',
}

export interface RawAutocompleteOptions<T extends {}> extends WidgetOptions {
  readonly optionsBuilder: AutocompleteOptionsBuilder<T>;
  readonly optionsViewBuilder: AutocompleteOptionsViewBuilder<T>;
  readonly displayStringForOption?: AutocompleteOptionToString<T>;
  readonly fieldViewBuilder?: AutocompleteFieldViewBuilder | null;
  readonly focusNode?: FocusNode | null;
  readonly textEditingController?: TextEditingController | null;
  readonly initialValue?: TextEditingValue | null;
  readonly onSelected?: AutocompleteOnSelected<T> | null;
  readonly optionsViewOpenDirection?: OptionsViewOpenDirection;
}

export class RawAutocomplete<T extends {}> extends StatefulWidget {
  constructor(readonly options: RawAutocompleteOptions<T>) {
    super(options.key ?? null);
    invariant(
      (options.focusNode == null) === (options.textEditingController == null),
      'autocomplete-controller-focus',
      'Provide both a focus node and editing controller',
    );
    invariant(
      options.initialValue == null || options.textEditingController == null,
      'autocomplete-initial-value',
      'Set initialValue or supply a controller',
    );
    invariant(
      options.fieldViewBuilder || (options.key instanceof GlobalKey && options.focusNode),
      'autocomplete-field-builder',
      'A separate field requires a GlobalKey and its controller and focus node',
    );
  }

  static defaultStringForOption<T>(option: T): string {
    return String(option);
  }

  static onFieldSubmitted<T extends {}>(key: GlobalKey<RawAutocompleteState<T>>): void {
    key.currentState?.submit();
  }

  override createState(): RawAutocompleteState<T> {
    return new RawAutocompleteState();
  }
}

export class AutocompleteHighlightedOption extends InheritedWidget {
  constructor(
    readonly index: number,
    child: Widget,
  ) {
    super(child);
  }
  static of(context: BuildContext): number {
    return context.maybeDependOn(AutocompleteHighlightedOption)?.index ?? 0;
  }
  updateShouldNotify(old: this): boolean {
    return old.index !== this.index;
  }
}

interface DropdownPlacement {
  readonly up: boolean;
  readonly rtl: boolean;
  readonly width: number;
  readonly height: number;
  readonly x: number;
  readonly y: number;
}

class RawAutocompleteState<T extends {}> extends State<RawAutocomplete<T>> {
  private readonly fieldKey = new GlobalKey('Autocomplete field');
  private readonly fieldLink = new LayerLink();
  private ownedController: TextEditingController | null = null;
  private ownedFocus: FocusNode | null = null;
  private controller!: TextEditingController;
  private focus!: FocusNode;
  private position: ScrollPosition | null = null;
  private overlay: OverlayState | null = null;
  private entry: OverlayEntry | null = null;
  private placement: DropdownPlacement | null = null;
  private insets = EdgeInsets.zero;
  private rtl = false;
  private scheduled = false;
  private dismissed = false;
  private requestedText: string | null = null;
  private resultsText: string | null = null;
  private pendingSelection: {
    readonly text: string;
    readonly controller: TextEditingController;
  } | null = null;
  private generation = 0;
  private results: readonly T[] = [];
  private highlighted = 0;

  private bind(): void {
    const options = this.widget.options;
    this.controller =
      options.textEditingController ??
      (this.ownedController ??= this.newController(options.initialValue));
    this.focus =
      options.focusNode ?? (this.ownedFocus ??= new FocusNode({ debugLabel: 'Autocomplete' }));
    this.controller.addListener(this.inputChanged);
    this.focus.addListener(this.focusChanged);
  }

  private newController(initial?: TextEditingValue | null): TextEditingController {
    const controller = new TextEditingController(initial?.text ?? '');
    if (initial && initial.selection.isValid)
      controller.selection = {
        anchor: initial.selection.baseOffset,
        focus: initial.selection.extentOffset,
      };
    return controller;
  }

  override initState(): void {
    super.initState();
    this.bind();
    const context = this.context as Element;
    context.owner.focus.addEarlyKeyEventHandler(this.keyPressed);
    if (this.focus.hasFocus) this.focusChanged();
  }

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const overlay = Overlay.maybeOf(this.context);
    if (overlay !== this.overlay) {
      this.closeOverlay();
      this.overlay = overlay;
    }
    const position = Scrollable.maybeOf(this.context)?.position ?? null;
    if (position !== this.position) {
      this.position?.removeListener(this.scheduleOverlay);
      this.position = position;
      position?.addListener(this.scheduleOverlay);
    }
    this.rtl = Directionality.maybeOf(this.context) === 'rtl';
    const padding = MediaQuery.maybePaddingOf(this.context) ?? EdgeInsets.zero;
    this.insets = padding
      .add(MediaQuery.maybeViewInsetsOf(this.context) ?? EdgeInsets.zero)
      .resolve('ltr');
    this.scheduleOverlay();
  }

  override didUpdateWidget(old: RawAutocomplete<T>): void {
    super.didUpdateWidget(old);
    const options = this.widget.options;
    if (
      (old.options.textEditingController ?? null) !== (options.textEditingController ?? null) ||
      (old.options.focusNode ?? null) !== (options.focusNode ?? null)
    ) {
      this.controller.removeListener(this.inputChanged);
      this.focus.removeListener(this.focusChanged);
      const controller = this.ownedController,
        focus = this.ownedFocus;
      this.ownedController = null;
      this.ownedFocus = null;
      (this.context as Element).owner.postFrame(() => {
        controller?.dispose();
        focus?.dispose();
      });
      this.bind();
      this.pendingSelection = null;
      this.requestedText = null;
      this.resultsText = null;
      this.results = [];
      this.highlighted = 0;
      ++this.generation;
    }
    this.focusChanged();
    this.entry?.markNeedsBuild();
  }

  private readonly focusChanged = (): void => {
    if (!this.focus.hasFocus) {
      this.dismissed = false;
      this.closeOverlay();
      return;
    }
    this.inputChanged();
    this.scheduleOverlay();
  };

  private readonly inputChanged = (): void => {
    const value = this.controller.value;
    if (this.pendingSelection?.text === value.text || this.requestedText === value.text) return;
    this.pendingSelection = null;
    this.requestedText = value.text;
    this.dismissed = false;
    const generation = ++this.generation;
    this.scheduleOverlay();
    const input = new TextEditingValue({
      text: value.text,
      selection: new TextSelection({
        baseOffset: value.selection.anchor,
        extentOffset: value.selection.focus,
      }),
      composing:
        value.composing.status === 'active'
          ? new TextRange({ start: value.composing.start, end: value.composing.end })
          : TextRange.empty,
    });
    const builder = this.widget.options.optionsBuilder;
    void Promise.resolve()
      .then(() => builder(input))
      .then((options) => {
        if (!this.mounted || generation !== this.generation) return;
        const hadOptions = this.results.length > 0;
        this.results = Array.from(options);
        this.resultsText = value.text;
        const hasOptions = this.results.length > 0;
        if (hadOptions !== hasOptions) this.announceOptions(hasOptions);
        this.highlighted = Math.min(this.highlighted, Math.max(0, this.results.length - 1));
        this.entry?.markNeedsBuild();
        this.scheduleOverlay();
      })
      .catch((exception) => {
        if (this.mounted && generation === this.generation)
          FlutterError.reportError(
            new FlutterErrorDetails({ exception, library: 'widgets autocomplete' }),
          );
      });
  };

  private announceOptions(available: boolean): void {
    const context = this.context as Element;
    const view = context.services.platformView;
    if (
      !this.focus.hasFocus ||
      !context.active ||
      !view ||
      !context.maybeDependOn(MediaQuery)?.data.supportsAnnounce
    )
      return;
    const raw = context.maybeDependOn(Localizations)?.locale ?? 'en';
    const locale = raw.replaceAll('-', '_');
    const parts = locale.split('_');
    const language = parts[0]!;
    const script = parts.find((part) => part.length === 4);
    const region = parts.slice(1).find((part) => part.length === 2 || part.length === 3);
    const messages =
      autocompleteAnnouncements[locale] ??
      (script ? autocompleteAnnouncements[`${language}_${script}`] : undefined) ??
      (region ? autocompleteAnnouncements[`${language}_${region}`] : undefined) ??
      autocompleteAnnouncements[language] ??
      autocompleteAnnouncements.en!;
    void SemanticsService.sendAnnouncement(
      view,
      messages[available ? 0 : 1],
      this.rtl ? 'rtl' : 'ltr',
    ).catch((exception) => context.services.reportError?.(exception));
  }

  private select(option: T): void {
    if (!this.mounted) return;
    const controller = this.controller;
    const display =
      this.widget.options.displayStringForOption ?? RawAutocomplete.defaultStringForOption;
    const text = display(option);
    const pending = { text, controller };
    this.pendingSelection = pending;
    this.requestedText = text;
    ++this.generation;
    this.dismissed = true;
    this.closeOverlay();
    try {
      controller.replace(text, { anchor: text.length, focus: text.length }, () => {
        if (!this.mounted || this.pendingSelection !== pending || this.controller !== controller)
          return;
        this.pendingSelection = null;
        this.results = [];
        this.resultsText = null;
        this.widget.options.onSelected?.(option);
      });
    } catch (error) {
      this.pendingSelection = null;
      this.requestedText = null;
      throw error;
    }
  }

  readonly submit = (): void => {
    const option = this.results[this.highlighted];
    if (this.entry && option !== undefined && this.resultsText === this.controller.text)
      this.select(option);
  };

  private readonly keyPressed = (event: KeyEvent): KeyEventResult => {
    if (
      !this.focus.hasFocus ||
      event.kind !== 'down' ||
      this.controller.isComposing ||
      !this.results.length ||
      this.resultsText !== this.controller.text
    )
      return 'ignored';
    const key = event.logicalKey;
    if (key.equals(LogicalKeyboardKey.escape) && this.entry) {
      this.dismissed = true;
      this.closeOverlay();
      return 'handled';
    }
    if (event.shift || event.alt) return 'ignored';
    const apple = ['iOS', 'macOS'].includes(FoundationPlatform.defaultTargetPlatform);
    const firstOrLast = apple ? event.meta && !event.control : event.control && !event.meta;
    if ((event.control || event.meta) && !firstOrLast) return 'ignored';
    if (key.equals(LogicalKeyboardKey.enter) && !firstOrLast && this.entry) {
      this.submit();
      return 'handled';
    }
    let next: number;
    if (key.equals(LogicalKeyboardKey.arrowUp)) next = firstOrLast ? 0 : this.highlighted - 1;
    else if (key.equals(LogicalKeyboardKey.arrowDown))
      next = firstOrLast ? this.results.length - 1 : this.highlighted + 1;
    else if (!firstOrLast && key.equals(LogicalKeyboardKey.pageUp)) next = this.highlighted - 4;
    else if (!firstOrLast && key.equals(LogicalKeyboardKey.pageDown)) next = this.highlighted + 4;
    else return 'ignored';
    this.dismissed = false;
    this.highlighted = Math.max(0, Math.min(this.results.length - 1, next));
    this.entry?.markNeedsBuild();
    this.scheduleOverlay();
    return 'handled';
  };

  private get shouldOpen(): boolean {
    return (
      this.focus.hasFocus &&
      this.results.length > 0 &&
      this.resultsText === this.controller.text &&
      !this.dismissed
    );
  }

  private readonly scheduleOverlay = (): void => {
    if (!this.mounted || this.scheduled || (!this.shouldOpen && this.entry === null)) return;
    const context = this.context as Element;
    if (!context.active) return;
    this.scheduled = true;
    context.owner.postFrame(() => {
      this.scheduled = false;
      if (this.mounted && context.active) this.updateOverlay();
    });
  };

  private updateOverlay(): void {
    const overlay = this.overlay;
    if (!overlay?.isActive || !this.shouldOpen) {
      this.closeOverlay();
      return;
    }
    const field = this.fieldKey.currentContext?.findRenderObject();
    const target = overlay.context.findRenderObject();
    if (
      !(field instanceof RenderBox) ||
      !field.attached ||
      !field.hasSize ||
      !(target instanceof RenderBox) ||
      !target.attached ||
      !target.hasSize
    )
      return;
    const inverse = inversePaintTransform(field.getTransformTo(target));
    const safeSize = this.insets.deflateSize(target.size);
    if (!inverse || safeSize.width <= 0 || safeSize.height <= 0) {
      this.closeOverlay();
      return;
    }
    const visible = bounds(
      multiply(inverse, translate(this.insets.left, this.insets.top)),
      safeSize,
    );
    const left = visible.x,
      right = visible.x + visible.width;
    const top = visible.y,
      bottom = visible.y + visible.height;
    const width = Math.min(field.size.width, visible.width);
    if (width <= 0 || bottom <= top || field.size.height < top || bottom < 0) {
      this.closeOverlay();
      return;
    }
    const above = -top,
      below = bottom - field.size.height;
    const direction = this.widget.options.optionsViewOpenDirection ?? OptionsViewOpenDirection.down;
    const up =
      direction === OptionsViewOpenDirection.up ||
      (direction === OptionsViewOpenDirection.mostSpace && above > below);
    const room = up ? above : below;
    const height = Math.min(bottom - top, Math.max(48, room));
    const x = this.rtl ? field.size.width - width : 0;
    const placement: DropdownPlacement = {
      up,
      rtl: this.rtl,
      width,
      height,
      x: Math.max(left, Math.min(right - width, x)) - x,
      y: (up ? 1 : -1) * Math.max(0, height - room),
    };
    const old = this.placement;
    this.placement = placement;
    if (this.entry) {
      if (
        !old ||
        old.up !== up ||
        old.width !== width ||
        old.height !== height ||
        old.rtl !== placement.rtl ||
        old.x !== placement.x ||
        old.y !== placement.y
      )
        this.entry.markNeedsBuild();
      return;
    }
    this.entry = new OverlayEntry({ builder: this.buildOverlay });
    overlay.insert(this.entry);
  }

  private closeOverlay(): void {
    const entry = this.entry;
    this.entry = null;
    this.placement = null;
    if (!entry) return;
    if (entry.overlay) entry.remove();
    entry.dispose();
  }

  private readonly buildOverlay = (): Widget => {
    const placement = this.placement;
    if (!this.mounted || !placement) return SizedBox.shrink();
    const { up, rtl, width, height, x, y } = placement;
    const topCorner = rtl ? Alignment.topRight : Alignment.topLeft;
    const bottomCorner = rtl ? Alignment.bottomRight : Alignment.bottomLeft;
    const results = this.results,
      generation = this.generation;
    const themes = InheritedTheme.capture(this.context, this.overlay?.context);
    const view = new Directionality(
      rtl ? 'rtl' : 'ltr',
      themes.wrap(
        new TextFieldTapRegion(
          new AutocompleteHighlightedOption(
            this.highlighted,
            new ExcludeFocus(
              new Builder((context) =>
                this.widget.options.optionsViewBuilder(
                  context,
                  (option) => {
                    if (generation === this.generation && this.entry && this.shouldOpen)
                      this.select(option);
                  },
                  results,
                ),
              ),
            ),
          ),
        ),
      ),
    );
    const follower = new CompositedTransformFollower(
      new ConstrainedBox(view, new BoxConstraints(width, width, 0, height)),
      {
        link: this.fieldLink,
        targetAnchor: up ? topCorner : bottomCorner,
        followerAnchor: up ? bottomCorner : topCorner,
        offset: { x, y },
        showWhenUnlinked: false,
      },
    );
    return new Stack([Positioned.fill(new Align(follower, { alignment: Alignment.topLeft }))], {
      fit: 'expand',
      clipBehavior: 'none',
    });
  };

  override build(context: BuildContext): Widget {
    const field =
      this.widget.options.fieldViewBuilder?.(context, this.controller, this.focus, this.submit) ??
      new SizedBox(Infinity, 0);
    this.scheduleOverlay();
    return new AutocompleteAnchor(
      new TextFieldTapRegion(field),
      this.fieldLink,
      this.scheduleOverlay,
      this.fieldKey,
    );
  }

  override activate(): void {
    super.activate();
    this.scheduleOverlay();
  }
  override deactivate(): void {
    this.closeOverlay();
    super.deactivate();
  }
  override dispose(): void {
    ++this.generation;
    this.closeOverlay();
    this.position?.removeListener(this.scheduleOverlay);
    (this.context as Element).owner.focus.removeEarlyKeyEventHandler(this.keyPressed);
    this.controller.removeListener(this.inputChanged);
    this.focus.removeListener(this.focusChanged);
    this.ownedController?.dispose();
    this.ownedFocus?.dispose();
    super.dispose();
  }
}

class AutocompleteAnchor extends SingleChildRenderObjectWidget {
  constructor(
    child: Widget,
    readonly link: LayerLink,
    readonly onLayout: () => void,
    key: GlobalKey,
  ) {
    super(child, { key });
  }
  createRenderObject(): RenderAutocompleteAnchor {
    return new RenderAutocompleteAnchor(this.link, this.onLayout);
  }
  updateRenderObject(_context: BuildContext, render: RenderAutocompleteAnchor): void {
    render.link = this.link;
    render.onLayout = this.onLayout;
  }
}

class RenderAutocompleteAnchor extends RenderLeaderLayer {
  constructor(
    link: LayerLink,
    public onLayout: () => void,
  ) {
    super({ link });
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const size = super.performLayout(constraints);
    this.onLayout();
    return size;
  }
}
