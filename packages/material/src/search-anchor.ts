// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/search_anchor.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves, Interval } from '@nelyx/core/framework/animation/curves';
import { FlutterErrorDetails } from '@nelyx/core/foundation/assertions';
import type { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { invariant } from '@nelyx/core/foundation/errors';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
import { nullableDartType } from '@nelyx/core/foundation/dart-type-witness';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { BorderSide, OutlinedBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { StadiumBorder } from '@nelyx/core/framework/painting/stadium-border';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { SingleChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Builder,
  Column,
  ConstrainedBox,
  Expanded,
  Flexible,
  Padding,
  Row,
  SizedBox,
} from '@nelyx/core/framework/widgets/basic';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { AnimatedOpacity } from '@nelyx/core/framework/widgets/implicit-animations';
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import {
  Navigator,
  NavigatorState,
  type NavigatorController,
} from '@nelyx/core/framework/widgets/navigation';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { OverflowBox } from '@nelyx/core/framework/widgets/overflow-box';
import { PageRouteBuilder } from '@nelyx/core/framework/widgets/pages';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { AnimatedBuilder, FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import {
  WidgetState,
  WidgetStateProperty,
  WidgetStatesController,
  emptyWidgetStateSet,
} from '@nelyx/core/framework/widgets/widget-state';
import { Color } from '@nelyx/core/ui/color';
import { sourceColorType } from '@nelyx/core/ui/color-source';
import { bounds } from '@nelyx/core/ui/geometry';
import type { Offset, Size } from '@nelyx/core/ui/geometry';
import { Rect } from '@nelyx/core/ui/rect';
import { SemanticsInputType, SemanticsRole } from '@nelyx/core/ui/semantics';
import { BackButton } from './action-buttons.ts';
import { ButtonStyle } from './button-style.ts';
import { kDefaultIconDarkColor, kDefaultIconLightColor } from './constants.ts';
import { Divider } from './divider.ts';
import { DividerTheme } from './divider-theme.ts';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { InkWell } from './ink-well.ts';
import { InputBorder } from './input-border.ts';
import { InputDecoration } from './input-decoration.ts';
import { Material } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { SearchBarTheme } from './search-bar-theme.ts';
import { SearchViewTheme } from './search-view-theme.ts';
import { TextField } from './text-field.ts';
import type { TextFieldOptions } from './text-field.ts';
import { Theme } from './theme.ts';
import { MaterialTapTargetSize } from './theme-data.ts';

const stadium = new StadiumBorder();
const viewShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(28) });
const fullShape = new RoundedRectangleBorder();
const noColor = new Color(0);
const barInsets = EdgeInsets.symmetric({ horizontal: 8 });
const barLimits = new BoxConstraints(360, 800, 56);
const viewLimits = new BoxConstraints(360, Infinity, 240);
const fullViewHeaderHeight = 72;
const openViewDuration = 600;
const anchorFadeDuration = 150;
const viewFadeInterval = new Interval(0, 1 / 2);
const viewIconsFadeInterval = new Interval(1 / 6, 2 / 6);
const viewDividerFadeInterval = new Interval(0, 1 / 6);
const viewListFadeInterval = new Interval(133 / openViewDuration, 233 / openViewDuration);
const disabledSearchBarOpacity = 0.38;
let nextSearchField = 0;

export type SearchAnchorChildBuilder = (
  context: BuildContext,
  controller: SearchController,
) => Widget;
export type SuggestionsBuilder = (
  context: BuildContext,
  controller: SearchController,
) => Iterable<Widget> | PromiseLike<Iterable<Widget>>;
export type ViewBuilder = (suggestions: Iterable<Widget>) => Widget;

interface SearchViewOwner {
  readonly isOpen: boolean;
  openView(): void;
  closeView(value: string | null): void;
}
const attached = new WeakMap<SearchController, SearchViewOwner>();

export class SearchController extends TextEditingController {
  get isAttached(): boolean {
    return attached.has(this);
  }
  private get anchor(): SearchViewOwner {
    const owner = attached.get(this);
    invariant(
      owner,
      'unattached-search-controller',
      'Attach SearchController to a SearchAnchor first',
    );
    return owner;
  }
  get isOpen(): boolean {
    return this.anchor.isOpen;
  }
  openView(): void {
    this.anchor.openView();
  }
  closeView(selectedText: string | null): void {
    this.anchor.closeView(selectedText);
  }
}

type FieldSettings = Pick<
  TextFieldOptions,
  | 'textCapitalization'
  | 'textInputAction'
  | 'keyboardType'
  | 'contextMenuBuilder'
  | 'onTapOutside'
  | 'smartDashesType'
  | 'smartQuotesType'
>;

export interface SearchBarOptions extends WidgetOptions, FieldSettings {
  readonly controller?: TextEditingController | null;
  readonly focusNode?: FocusNode | null;
  readonly hintText?: string | null;
  readonly leading?: Widget | null;
  readonly trailing?: Iterable<Widget> | null;
  readonly onTap?: (() => void) | null;
  readonly onChanged?: ((text: string) => void) | null;
  readonly onSubmitted?: ((text: string) => void) | null;
  readonly constraints?: BoxConstraints | null;
  readonly elevation?: WidgetStateProperty<DartDouble | null> | null;
  readonly backgroundColor?: WidgetStateProperty<Color | null> | null;
  readonly shadowColor?: WidgetStateProperty<Color | null> | null;
  readonly surfaceTintColor?: WidgetStateProperty<Color | null> | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  readonly side?: WidgetStateProperty<BorderSide | null> | null;
  readonly shape?: WidgetStateProperty<OutlinedBorder | null> | null;
  readonly padding?: WidgetStateProperty<EdgeInsetsGeometry | null> | null;
  readonly textStyle?: WidgetStateProperty<TextStyle | null> | null;
  readonly hintStyle?: WidgetStateProperty<TextStyle | null> | null;
  readonly enabled?: boolean;
  readonly autoFocus?: boolean;
  readonly readOnly?: boolean;
  readonly scrollPadding?: EdgeInsets;
}

export class SearchBar extends StatefulWidget {
  readonly options: Readonly<SearchBarOptions>;
  constructor(options: SearchBarOptions = {}) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }
  override createState(): State<SearchBar> {
    return new SearchBarState();
  }
}

class SearchBarState extends State<SearchBar> {
  private readonly ownedFocus = new FocusNode();
  private readonly inkStates = new WidgetStatesController();
  private hovered = false;
  private pressed = false;

  private readonly syncPressed = () => {
    const pressed = this.inkStates.value.contains(WidgetState.pressed);
    if (pressed === this.pressed) return;
    this.pressed = pressed;
    (this.context as Element).owner.postFrame(() => {
      if (this.mounted) this.setState(() => {});
    });
  };

  override initState(): void {
    super.initState();
    this.inkStates.addListener(this.syncPressed);
  }

  override build(context: BuildContext): Widget {
    const o = this.widget.options;
    const theme = SearchBarTheme.of(context);
    const { colorScheme, textTheme } = Theme.of(context);
    const focus = o.focusNode ?? this.ownedFocus;
    const iconTheme = IconTheme.of(context);
    const defaultIconColor =
      colorScheme.brightness === 'light' ? kDefaultIconDarkColor : kDefaultIconLightColor;
    const themedIcon = (child: Widget, color: number): Widget =>
      IconTheme.merge({
        data: iconTheme.color?.equals(defaultIconColor)
          ? new IconThemeData({ color: new Color(color) })
          : iconTheme,
        child,
      });
    const defaultOverlay = WidgetStateProperty.resolveWith(
      nullableDartType(sourceColorType),
      (states) => {
        const color = new Color(colorScheme.onSurface);
        if (states.contains(WidgetState.pressed)) return color.withOpacity(0.1);
        if (states.contains(WidgetState.hovered)) return color.withOpacity(0.08);
        return noColor;
      },
    );
    return new ListenableBuilder(focus, () => {
      const states = emptyWidgetStateSet();
      if (o.enabled === false) states.add(WidgetState.disabled);
      if (focus.hasFocus) states.add(WidgetState.focused);
      if (this.hovered) states.add(WidgetState.hovered);
      if (this.pressed && o.enabled !== false) states.add(WidgetState.pressed);
      const shape = o.shape?.resolve(states) ?? theme.shape?.resolve(states) ?? stadium;
      const side = o.side?.resolve(states) ?? theme.side?.resolve(states);
      const padding = o.padding?.resolve(states) ?? theme.padding?.resolve(states) ?? barInsets;
      const body = new Padding(
        padding,
        new Row([
          ...(o.leading ? [themedIcon(o.leading, colorScheme.onSurface)] : []),
          new Expanded(
            new Padding(
              padding,
              new Semantics({
                inputType: SemanticsInputType.search,
                child: new SearchField({
                  controller: o.controller ?? null,
                  focusNode: focus,
                  autofocus: o.autoFocus ?? false,
                  enabled: o.enabled ?? true,
                  readOnly: o.readOnly ?? false,
                  ...(o.keyboardType === undefined ? {} : { keyboardType: o.keyboardType }),
                  smartDashesType: o.smartDashesType ?? null,
                  smartQuotesType: o.smartQuotesType ?? null,
                  textCapitalization:
                    o.textCapitalization ?? theme.textCapitalization?.name ?? 'none',
                  ...(o.textInputAction === undefined
                    ? {}
                    : { textInputAction: o.textInputAction }),
                  ...(o.contextMenuBuilder === undefined
                    ? {}
                    : { contextMenuBuilder: o.contextMenuBuilder }),
                  ...(o.onTapOutside === undefined ? {} : { onTapOutside: o.onTapOutside }),
                  ...(o.scrollPadding === undefined ? {} : { scrollPadding: o.scrollPadding }),
                  decoration: new InputDecoration({
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    isDense: true,
                    hintText: o.hintText ?? null,
                    hintStyle:
                      o.hintStyle?.resolve(states) ??
                      theme.hintStyle?.resolve(states) ??
                      o.textStyle?.resolve(states) ??
                      theme.textStyle?.resolve(states) ??
                      (textTheme.bodyLarge ?? new TextStyle()).copyWith({
                        color: colorScheme.onSurfaceVariant,
                      }),
                    contentPadding: EdgeInsets.zero,
                  }),
                  style:
                    o.textStyle?.resolve(states) ??
                    theme.textStyle?.resolve(states) ??
                    (textTheme.bodyLarge ?? new TextStyle()).copyWith({
                      color: colorScheme.onSurface,
                    }),
                  ...(o.onTap ? { onTap: o.onTap, onTapAlwaysCalled: true } : {}),
                  ...(o.onChanged ? { onChanged: o.onChanged } : {}),
                  ...(o.onSubmitted ? { onSubmitted: o.onSubmitted } : {}),
                }),
              }),
            ),
          ),
          ...Array.from(o.trailing ?? [], (child) =>
            themedIcon(child, colorScheme.onSurfaceVariant),
          ),
        ]),
      );
      const enabled = o.enabled ?? true;
      const bar = new ConstrainedBox(
        new Material({
          color:
            o.backgroundColor?.resolve(states) ??
            theme.backgroundColor?.resolve(states) ??
            new Color(colorScheme.surfaceContainerHigh),
          elevation:
            o.elevation?.resolve(states)?.value ?? theme.elevation?.resolve(states)?.value ?? 6,
          shadowColor:
            o.shadowColor?.resolve(states) ??
            theme.shadowColor?.resolve(states) ??
            new Color(colorScheme.shadow),
          surfaceTintColor:
            o.surfaceTintColor?.resolve(states) ??
            theme.surfaceTintColor?.resolve(states) ??
            noColor,
          shape: side ? shape.copyWith({ side }) : shape,
          clipBehavior: 'antiAlias',
          child: new InkWell({
            customBorder: side ? shape.copyWith({ side }) : shape,
            onTap: enabled
              ? () => {
                  o.onTap?.();
                  if (!focus.hasFocus) focus.requestFocus();
                }
              : null,
            canRequestFocus: false,
            excludeFromSemantics: o.onTap == null,
            overlayColor: o.overlayColor ?? theme.overlayColor ?? defaultOverlay,
            statesController: this.inkStates,
            child: body,
          }),
        }),
        o.constraints ?? theme.constraints ?? barLimits,
      );
      return new MouseRegion(
        new Opacity(
          new ExcludeFocus(new IgnorePointer(bar, { ignoring: !enabled }), { excluding: !enabled }),
          { opacity: enabled ? 1 : disabledSearchBarOpacity },
        ),
        {
          onEnter: () =>
            this.setState(() => {
              this.hovered = true;
            }),
          onExit: () =>
            this.setState(() => {
              this.hovered = false;
            }),
        },
      );
    });
  }
  override dispose(): void {
    this.inkStates.removeListener(this.syncPressed);
    this.inkStates.dispose();
    this.ownedFocus.dispose();
    super.dispose();
  }
}

type SearchFieldOptions = Omit<TextFieldOptions, 'id'>;
class SearchField extends StatefulWidget {
  constructor(readonly options: SearchFieldOptions) {
    super();
  }
  override createState(): State<SearchField> {
    return new SearchFieldState();
  }
}

class SearchFieldState extends State<SearchField> {
  private readonly id = `material-search-field-${++nextSearchField}`;
  private readonly mirror = new TextEditingController();
  private source: SearchController | null = null;
  private updating = false;

  // An anchor and its route can coexist during a transition. Each editor keeps
  // its own platform binding while SearchController owns the shared value.
  private readonly fromSource = () => {
    if (!this.source || this.updating) return;
    const { text, selection } = this.source;
    if (
      text !== this.mirror.text ||
      selection.anchor !== this.mirror.selection.anchor ||
      selection.focus !== this.mirror.selection.focus
    )
      this.mirror.replace(text, selection);
  };
  private bind(): void {
    const value = this.widget.options.controller;
    const next = value instanceof SearchController ? value : null;
    if (next === this.source) return;
    this.source?.removeListener(this.fromSource);
    this.source = next;
    next?.addListener(this.fromSource);
    this.fromSource();
  }
  override initState(): void {
    super.initState();
    this.bind();
  }
  override didUpdateWidget(old: SearchField): void {
    super.didUpdateWidget(old);
    this.bind();
  }
  override build(): Widget {
    const o = this.widget.options;
    return new TextField({
      ...o,
      id: this.id,
      controller: this.source ? this.mirror : (o.controller ?? null),
      onChanged: (text) => {
        if (this.source && text !== this.source.text) {
          try {
            this.updating = true;
            this.source.replace(text, this.mirror.selection);
          } finally {
            this.updating = false;
          }
        }
        o.onChanged?.(text);
      },
    });
  }
  override dispose(): void {
    this.source?.removeListener(this.fromSource);
    this.mirror.dispose();
    super.dispose();
  }
}

export interface SearchAnchorOptions extends WidgetOptions, FieldSettings {
  readonly builder: SearchAnchorChildBuilder;
  readonly suggestionsBuilder: SuggestionsBuilder;
  readonly isFullScreen?: boolean | null;
  readonly searchController?: SearchController | null;
  readonly viewBuilder?: ViewBuilder | null;
  readonly viewLeading?: Widget | null;
  readonly viewTrailing?: Iterable<Widget> | null;
  readonly viewHintText?: string | null;
  readonly viewBackgroundColor?: Color | null;
  readonly viewElevation?: number | null;
  readonly viewSurfaceTintColor?: Color | null;
  readonly viewSide?: BorderSide | null;
  readonly viewShape?: OutlinedBorder | null;
  readonly viewBarPadding?: EdgeInsetsGeometry | null;
  readonly headerHeight?: number | null;
  readonly headerTextStyle?: TextStyle | null;
  readonly headerHintStyle?: TextStyle | null;
  readonly dividerColor?: Color | null;
  readonly viewConstraints?: BoxConstraints | null;
  readonly viewPadding?: EdgeInsetsGeometry | null;
  readonly shrinkWrap?: boolean | null;
  readonly viewOnChanged?: ((text: string) => void) | null;
  readonly viewOnSubmitted?: ((text: string) => void) | null;
  readonly viewOnClose?: (() => void) | null;
  readonly viewOnOpen?: (() => void) | null;
  readonly enabled?: boolean;
}

export interface SearchAnchorBarOptions extends Omit<SearchAnchorOptions, 'builder'> {
  readonly barLeading?: Widget | null;
  readonly barTrailing?: Iterable<Widget> | null;
  readonly barHintText?: string | null;
  readonly barElevation?: SearchBarOptions['elevation'];
  readonly barBackgroundColor?: SearchBarOptions['backgroundColor'];
  readonly barOverlayColor?: SearchBarOptions['overlayColor'];
  readonly barSide?: SearchBarOptions['side'];
  readonly barShape?: SearchBarOptions['shape'];
  readonly barPadding?: SearchBarOptions['padding'];
  readonly barTextStyle?: SearchBarOptions['textStyle'];
  readonly barHintStyle?: SearchBarOptions['hintStyle'];
  readonly viewHeaderHeight?: number | null;
  readonly viewHeaderTextStyle?: TextStyle | null;
  readonly viewHeaderHintStyle?: TextStyle | null;
  readonly constraints?: BoxConstraints | null;
  readonly onTap?: (() => void) | null;
  readonly onOpen?: (() => void) | null;
  readonly onClose?: (() => void) | null;
  readonly onChanged?: ((text: string) => void) | null;
  readonly onSubmitted?: ((text: string) => void) | null;
}

export class SearchAnchor extends StatefulWidget {
  readonly options: Readonly<SearchAnchorOptions>;
  constructor(options: SearchAnchorOptions) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }
  static bar(options: SearchAnchorBarOptions): SearchAnchor {
    return new SearchAnchor({
      ...options,
      viewHintText: options.viewHintText ?? options.barHintText ?? null,
      headerHeight: options.viewHeaderHeight ?? options.headerHeight ?? null,
      headerTextStyle: options.viewHeaderTextStyle ?? options.headerTextStyle ?? null,
      headerHintStyle: options.viewHeaderHintStyle ?? options.headerHintStyle ?? null,
      viewOnChanged: options.onChanged ?? options.viewOnChanged ?? null,
      viewOnSubmitted: options.onSubmitted ?? options.viewOnSubmitted ?? null,
      viewOnOpen: options.onOpen ?? options.viewOnOpen ?? null,
      viewOnClose: options.onClose ?? options.viewOnClose ?? null,
      builder: (_context, controller) =>
        new SearchBar({
          controller,
          leading: options.barLeading ?? new Icon(Icons.search),
          trailing: options.barTrailing ?? null,
          hintText: options.barHintText ?? null,
          constraints: options.constraints ?? null,
          elevation: options.barElevation ?? null,
          backgroundColor: options.barBackgroundColor ?? null,
          overlayColor: options.barOverlayColor ?? null,
          side: options.barSide ?? null,
          shape: options.barShape ?? null,
          padding: options.barPadding ?? null,
          textStyle: options.barTextStyle ?? null,
          hintStyle: options.barHintStyle ?? null,
          ...(options.keyboardType === undefined ? {} : { keyboardType: options.keyboardType }),
          smartDashesType: options.smartDashesType ?? null,
          smartQuotesType: options.smartQuotesType ?? null,
          ...(options.textCapitalization === undefined
            ? {}
            : { textCapitalization: options.textCapitalization }),
          ...(options.textInputAction === undefined
            ? {}
            : { textInputAction: options.textInputAction }),
          ...(options.contextMenuBuilder === undefined
            ? {}
            : { contextMenuBuilder: options.contextMenuBuilder }),
          ...(options.onTapOutside === undefined ? {} : { onTapOutside: options.onTapOutside }),
          onTap: () => {
            controller.openView();
            options.onTap?.();
          },
          onChanged: () => controller.openView(),
          onSubmitted: options.onSubmitted ?? null,
        }),
    });
  }
  override createState(): State<SearchAnchor> {
    return new SearchAnchorState();
  }
}

interface OpenSearch {
  readonly navigator: NavigatorController;
  readonly route: PageRouteBuilder<string>;
  readonly controller: SearchController;
  readonly full: boolean;
}

class SearchAnchorState extends State<SearchAnchor> implements SearchViewOwner {
  private readonly key = new GlobalKey('Material search anchor');
  private readonly owned = new SearchController();
  private readonly ownedViews = new Set<PageRouteBuilder<string>>();
  private disposed = false;
  private controller!: SearchController;
  private opened: OpenSearch | null = null;
  private viewport: Size | null = null;
  get isOpen(): boolean {
    return this.opened !== null;
  }

  private attachController(): void {
    const next = this.widget.options.searchController ?? this.owned;
    invariant(
      !attached.has(next) || attached.get(next) === this,
      'duplicate-search-controller',
      'SearchController already belongs to another SearchAnchor',
    );
    if (this.controller && this.controller !== next) attached.delete(this.controller);
    this.controller = next;
    attached.set(next, this);
  }
  override initState(): void {
    super.initState();
    this.attachController();
  }
  override didUpdateWidget(old: SearchAnchor): void {
    super.didUpdateWidget(old);
    if (old.options.searchController !== this.widget.options.searchController) {
      if (this.isOpen) this.scheduleClose();
      this.attachController();
    }
    if (this.widget.options.enabled === false && this.isOpen) this.scheduleClose();
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const { width, height } = MediaQuery.of(this.context);
    if (
      this.opened &&
      !this.opened.full &&
      this.viewport &&
      (this.viewport.width !== width || this.viewport.height !== height)
    )
      this.scheduleClose();
    this.viewport = { width, height };
  }
  private scheduleClose(): void {
    const view = this.opened;
    (this.context as Element).owner.postFrame(() => {
      if (this.mounted && this.opened === view) this.closeView(null);
    });
  }

  private anchorBounds(): Rect | null {
    if (!this.mounted) return null;
    const anchor = this.key.currentContext?.findRenderObject();
    if (!(anchor instanceof RenderBox) || !anchor.hasSize || !anchor.attached) return null;
    const navigator = this.context
      .findAncestorStateOfType(NavigatorState)
      ?.context.findRenderObject();
    const target = navigator instanceof RenderBox && navigator.attached ? navigator : null;
    const rect = bounds(anchor.getTransformTo(target), anchor.size);
    return Rect.fromLTWH(rect.x, rect.y, rect.width, rect.height);
  }

  openView(): void {
    if (this.opened || this.widget.options.enabled === false) return;
    const navigator = Navigator.of(this.context);
    const anchor = this.anchorBounds() ?? Rect.fromLTWH(0, 0, 360, 56);
    const direction = Directionality.of(this.context);
    const platform = Theme.of(this.context).platform;
    const o = this.widget.options;
    const full =
      o.isFullScreen ?? (platform === 'android' || platform === 'iOS' || platform === 'fuchsia');
    const themes = InheritedTheme.capture(this.context);
    const controller = this.controller;
    const route = new PageRouteBuilder<string>({
      opaque: full,
      barrierDismissible: !full,
      barrierColor: noColor,
      barrierLabel: MaterialLocalizations.of(this.context).modalBarrierDismissLabel,
      transitionDuration: openViewDuration,
      reverseTransitionDuration: openViewDuration,
      pageBuilder: (_context, animation) =>
        themes.wrap(
          new SearchView(
            o,
            controller,
            full,
            () => this.anchorBounds() ?? anchor,
            direction,
            animation,
            () => this.closeView(null),
          ),
        ),
    });
    const open = { navigator, route, controller, full };
    this.setState(() => {
      this.opened = open;
    });
    let result: Promise<string | undefined>;
    try {
      result = navigator.push(route);
    } catch (error) {
      this.setState(() => {
        this.opened = null;
      });
      throw error;
    }
    if (controller === this.owned) {
      this.ownedViews.add(route);
      void route.completed.then(() => {
        this.ownedViews.delete(route);
        if (this.disposed && this.ownedViews.size === 0) this.owned.dispose();
      });
    }
    void result
      .then(() => {
        if (!this.mounted || this.opened !== open) return;
        this.setState(() => {
          this.opened = null;
        });
        o.viewOnClose?.();
      })
      .catch((exception) => {
        if (this.mounted && this.opened === open) {
          this.setState(() => {
            this.opened = null;
          });
          FlutterError.reportError(
            new FlutterErrorDetails({ exception, library: 'material search' }),
          );
        }
      });
    o.viewOnOpen?.();
  }

  closeView(value: string | null): void {
    const open = this.opened;
    if (!open || !open.navigator.isAttached) return;
    const routes = open.navigator.routes;
    if (!routes.some((entry) => entry.route === open.route)) return;
    if (value !== null) open.controller.text = value;
    if (routes.at(-1)?.route === open.route) open.navigator.pop(value ?? undefined);
    else open.navigator.removeRoute(open.route, value ?? undefined);
  }
  override build(context: BuildContext): Widget {
    const { builder, enabled = true } = this.widget.options;
    const active = enabled && !this.isOpen;
    return new AnimatedOpacity({
      key: this.key,
      opacity: enabled ? (this.isOpen ? 0 : 1) : disabledSearchBarOpacity,
      duration: anchorFadeDuration,
      child: new ExcludeFocus(
        new IgnorePointer(
          new GestureDetector(builder(context, this.controller), {
            onTap: () => this.openView(),
            excludeFromSemantics: true,
          }),
          { ignoring: !active },
        ),
        { excluding: !active },
      ),
    });
  }
  override dispose(): void {
    attached.delete(this.controller);
    const open = this.opened;
    if (open)
      (this.context as Element).owner.postFrame(() => {
        if (open.navigator.isAttached) open.navigator.removeRoute(open.route);
      });
    this.disposed = true;
    if (!this.ownedViews.size) this.owned.dispose();
    super.dispose();
  }
}

class SearchView extends StatefulWidget {
  constructor(
    readonly options: Readonly<SearchAnchorOptions>,
    readonly controller: SearchController,
    readonly full: boolean,
    readonly anchor: () => Rect,
    readonly direction: 'ltr' | 'rtl',
    readonly animation: Animation<number>,
    readonly close: () => void,
  ) {
    super();
  }
  override createState(): State<SearchView> {
    return new SearchViewState();
  }
}

class SearchViewState extends State<SearchView> {
  private suggestions: readonly Widget[] = [];
  private version = 0;
  private query: string | undefined;
  private motion!: CurvedAnimation;
  private surfaceFade!: CurvedAnimation;
  private iconsFade!: CurvedAnimation;
  private dividerFade!: CurvedAnimation;
  private listFade!: CurvedAnimation;
  private anchorRect!: Rect;
  private readonly refreshAnchor = (status: AnimationStatus): void => {
    if (status !== AnimationStatus.reverse || !this.mounted) return;
    this.setState(() => {
      this.anchorRect = this.widget.anchor();
    });
  };

  override initState(): void {
    super.initState();
    const parent = this.widget.animation;
    this.anchorRect = this.widget.anchor();
    parent.addStatusListener(this.refreshAnchor);
    const motionCurve = Curves.easeInOutCubicEmphasized;
    this.motion = new CurvedAnimation({
      parent,
      curve: motionCurve,
      reverseCurve: motionCurve.flipped,
    });
    this.surfaceFade = new CurvedAnimation({
      parent,
      curve: viewFadeInterval,
      reverseCurve: viewFadeInterval.flipped,
    });
    this.iconsFade = new CurvedAnimation({
      parent: this.motion,
      curve: viewIconsFadeInterval,
      reverseCurve: viewIconsFadeInterval.flipped,
    });
    this.dividerFade = new CurvedAnimation({
      parent: this.motion,
      curve: viewDividerFadeInterval,
      reverseCurve: viewFadeInterval.flipped,
    });
    this.listFade = new CurvedAnimation({
      parent: this.motion,
      curve: viewListFadeInterval,
      reverseCurve: viewListFadeInterval.flipped,
    });
    this.widget.controller.addListener(this.refresh);
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.refresh();
  }
  private readonly refresh = (): void => {
    const { controller, options } = this.widget;
    if (controller.text === this.query) return;
    this.query = controller.text;
    const version = ++this.version;
    const apply = (items: Iterable<Widget>) => {
      if (this.mounted && version === this.version)
        this.setState(() => {
          this.suggestions = Array.from(items);
        });
    };
    const failure = (exception: unknown) => {
      if (this.mounted && version === this.version)
        FlutterError.reportError(
          new FlutterErrorDetails({ exception, library: 'material search suggestions' }),
        );
    };
    try {
      const result = options.suggestionsBuilder(this.context, controller);
      if (Symbol.iterator in Object(result)) apply(result as Iterable<Widget>);
      else void Promise.resolve(result).then(apply, failure).catch(failure);
    } catch (exception) {
      failure(exception);
    }
  };

  override build(context: BuildContext): Widget {
    const { options: o, controller, full } = this.widget;
    const local = SearchViewTheme.of(context);
    const { colorScheme, textTheme } = Theme.of(context);
    const shape = o.viewShape ?? local.shape ?? (full ? fullShape : viewShape);
    const side = o.viewSide ?? local.side;
    const shrink = !full && (o.shrinkWrap ?? local.shrinkWrap ?? false);
    const limits = o.viewConstraints ?? local.constraints ?? viewLimits;
    const headerStyle = o.headerTextStyle ?? local.headerTextStyle;
    const headerPadding = o.viewBarPadding ?? local.barPadding ?? barInsets;
    const header = new SizedBox(
      undefined,
      o.headerHeight ?? local.headerHeight ?? (full ? fullViewHeaderHeight : 56),
      new Padding(
        headerPadding,
        new Row([
          o.viewLeading ??
            new BackButton({
              style: new ButtonStyle({ tapTargetSize: MaterialTapTargetSize.shrinkWrap }),
              onPressed: this.widget.close,
            }),
          new Expanded(
            new Padding(
              headerPadding,
              new Semantics({
                inputType: SemanticsInputType.search,
                child: new SearchField({
                  controller,
                  autofocus: true,
                  style:
                    headerStyle ??
                    (textTheme.bodyLarge ?? new TextStyle()).copyWith({
                      color: colorScheme.onSurface,
                    }),
                  decoration: new InputDecoration({
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                    isDense: true,
                    hintText: o.viewHintText ?? null,
                    hintStyle:
                      o.headerHintStyle ??
                      local.headerHintStyle ??
                      headerStyle ??
                      (textTheme.bodyLarge ?? new TextStyle()).copyWith({
                        color: colorScheme.onSurfaceVariant,
                      }),
                  }),
                  ...(o.textCapitalization === undefined
                    ? {}
                    : { textCapitalization: o.textCapitalization }),
                  ...(o.keyboardType === undefined ? {} : { keyboardType: o.keyboardType }),
                  smartDashesType: o.smartDashesType ?? null,
                  smartQuotesType: o.smartQuotesType ?? null,
                  ...(o.textInputAction === undefined
                    ? {}
                    : { textInputAction: o.textInputAction }),
                  ...(o.contextMenuBuilder === undefined
                    ? {}
                    : { contextMenuBuilder: o.contextMenuBuilder }),
                  ...(o.onTapOutside === undefined ? {} : { onTapOutside: o.onTapOutside }),
                  ...(o.viewOnChanged ? { onChanged: o.viewOnChanged } : {}),
                  ...(o.viewOnSubmitted ? { onSubmitted: o.viewOnSubmitted } : {}),
                }),
              }),
            ),
          ),
          ...Array.from(
            o.viewTrailing ?? [
              new ListenableBuilder(controller, (context) =>
                controller.text
                  ? new IconButton({
                      icon: new Icon(Icons.close),
                      tooltip: MaterialLocalizations.of(context).clearButtonTooltip,
                      onPressed: () => controller.clear(),
                    })
                  : new SizedBox(0, 0),
              ),
            ],
          ),
        ]),
      ),
    );
    const keyboard = MediaQuery.maybeViewInsetsOf(context) ?? EdgeInsets.zero;
    const content =
      o.viewBuilder?.(this.suggestions) ??
      new ListView({
        children: this.suggestions,
        padding: full ? EdgeInsets.only({ bottom: keyboard.bottom }) : EdgeInsets.zero,
        primary: false,
        shrinkWrap: shrink,
      });
    const top = full ? MediaQuery.paddingOf(context).top : 0;
    const viewHeader =
      top === 0
        ? header
        : new AnimatedBuilder({
            animation: this.motion,
            child: header,
            builder: (_context, child) =>
              new Padding(EdgeInsets.only({ top: top * this.motion.value }), child ?? undefined),
          });
    const contentTransition = new FadeTransition({ opacity: this.listFade, child: content });
    const divider = new FadeTransition({
      opacity: this.dividerFade,
      child: new Divider({
        height: 1,
        color:
          o.dividerColor ??
          local.dividerColor ??
          DividerTheme.of(context).color ??
          new Color(colorScheme.outline),
      }),
    });
    const panelContent = new SafeArea({
      top: false,
      bottom: full,
      left: full,
      right: full,
      child: new Column(
        [
          new FadeTransition({ opacity: this.iconsFade, child: viewHeader }),
          ...(!shrink || limits.minHeight > 0 || this.suggestions.length > 0 || o.viewBuilder
            ? [divider]
            : []),
          shrink ? new Flexible(contentTransition) : new Expanded(contentTransition),
        ],
        { mainAxisSize: shrink ? 'min' : 'max', crossAxisAlignment: 'stretch' },
      ),
    });
    const insets = full
      ? EdgeInsets.zero
      : MediaQuery.paddingOf(context).add(keyboard).resolve('ltr');
    const viewPadding = full
      ? EdgeInsets.zero
      : (o.viewPadding ?? local.padding ?? EdgeInsets.zero);
    const layout = new SearchViewLayout(
      this.anchorRect,
      insets,
      limits,
      shrink,
      full,
      this.widget.direction,
      this.motion,
    );
    return new Directionality(
      this.widget.direction,
      new LayoutBuilder((_context, constraints) => {
        const target = layout.targetSize(constraints.biggest);
        // Keep the search editor and result wraps stable while the Material clip expands.
        const contentWidth = Math.max(
          0,
          target.width - viewPadding.resolve(this.widget.direction).horizontal,
        );
        const panel = new Semantics({
          container: true,
          explicitChildNodes: true,
          role: SemanticsRole.dialog,
          label: o.viewHintText ?? null,
          child: new Material({
            color:
              o.viewBackgroundColor ??
              local.backgroundColor ??
              new Color(colorScheme.surfaceContainerHigh),
            elevation: o.viewElevation ?? local.elevation ?? 6,
            surfaceTintColor: o.viewSurfaceTintColor ?? local.surfaceTintColor ?? noColor,
            shape: side ? shape.copyWith({ side }) : shape,
            clipBehavior: 'antiAlias',
            child: new OverflowBox(panelContent, {
              alignment: Alignment.topLeft,
              minWidth: 0,
              maxWidth: contentWidth,
              fit: 'deferToChild',
            }),
          }),
        });
        return new CustomSingleChildLayout(
          new FadeTransition({
            opacity: this.surfaceFade,
            child: full ? panel : new Padding(viewPadding, panel),
          }),
          layout,
        );
      }),
    );
  }
  override dispose(): void {
    ++this.version;
    this.widget.controller.removeListener(this.refresh);
    this.widget.animation.removeStatusListener(this.refreshAnchor);
    this.listFade.dispose();
    this.dividerFade.dispose();
    this.iconsFade.dispose();
    this.surfaceFade.dispose();
    this.motion.dispose();
    super.dispose();
  }
}

class SearchViewLayout extends SingleChildLayoutDelegate {
  constructor(
    readonly anchor: Rect,
    readonly insets: EdgeInsets,
    readonly limits: BoxConstraints,
    readonly shrink: boolean,
    readonly full: boolean,
    readonly direction: 'ltr' | 'rtl',
    readonly motion: Animation<number>,
  ) {
    super({ relayout: motion });
  }
  targetSize(screen: Size): Size {
    if (this.full) return screen;
    const available = this.insets.deflateSize(screen);
    return {
      width: Math.min(
        Math.max(0, available.width),
        this.limits.maxWidth,
        Math.max(this.limits.minWidth, this.anchor.width),
      ),
      height: Math.min(
        Math.max(0, available.height),
        this.limits.maxHeight,
        Math.max(this.limits.minHeight, (screen.height * 2) / 3),
      ),
    };
  }
  private interpolate(start: number, end: number): number {
    return start + (end - start) * this.motion.value;
  }
  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    const anchor = this.anchor;
    const target = this.targetSize(constraints.biggest);
    const width = Math.max(
      0,
      Math.min(constraints.maxWidth, this.interpolate(anchor.width, target.width)),
    );
    const height = Math.max(
      0,
      Math.min(constraints.maxHeight, this.interpolate(anchor.height, target.height)),
    );
    return new BoxConstraints(
      width,
      width,
      this.shrink ? Math.min(height, this.limits.minHeight) : height,
      height,
    );
  }
  override getPositionForChild(size: Size, child: Size): Offset {
    const anchor = this.anchor;
    const target = this.targetSize(size);
    const targetX = this.full
      ? 0
      : Math.max(
          this.insets.left,
          Math.min(
            this.direction === 'rtl' ? anchor.right - target.width : anchor.left,
            size.width - this.insets.right - target.width,
          ),
        );
    const targetY = this.full
      ? 0
      : Math.max(
          this.insets.top,
          Math.min(
            anchor.top,
            size.height - this.insets.bottom - (this.shrink ? child.height : target.height),
          ),
        );
    return {
      x: this.interpolate(anchor.left, targetX),
      y: this.interpolate(anchor.top, targetY),
    };
  }
  override shouldRelayout(): boolean {
    return true;
  }
}
