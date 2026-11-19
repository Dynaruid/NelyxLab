// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { FlutterErrorDetails } from '@nelyx/core/foundation/assertions';
import type { DartDouble } from '@nelyx/core/foundation/dart-numeric';
import { invariant } from '@nelyx/core/foundation/errors';
import { FlutterError } from '@nelyx/core/foundation/flutter-error';
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
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
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
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { AnimatedOpacity } from '@nelyx/core/framework/widgets/implicit-animations';
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { Navigator, type NavigatorController } from '@nelyx/core/framework/widgets/navigation';
import { PageRouteBuilder } from '@nelyx/core/framework/widgets/pages';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import { WidgetState, emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { Color } from '@nelyx/core/ui/color';
import { bounds } from '@nelyx/core/ui/geometry';
import type { Offset, Size } from '@nelyx/core/ui/geometry';
import { Rect } from '@nelyx/core/ui/rect';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { BackButton } from './action-buttons.ts';
import { Divider } from './divider.ts';
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

const stadium = new StadiumBorder();
const viewShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(28) });
const fullShape = new RoundedRectangleBorder();
const noColor = new Color(0);
const barInsets = EdgeInsets.symmetric({ horizontal: 16 });
const headerInsets = EdgeInsets.symmetric({ horizontal: 8 });
const barLimits = new BoxConstraints(360, 800, 56, 56);
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
  'textCapitalization' | 'textInputAction' | 'keyboardType' | 'contextMenuBuilder' | 'onTapOutside'
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
  private hovered = false;

  override build(context: BuildContext): Widget {
    const o = this.widget.options;
    const theme = SearchBarTheme.of(context);
    const { colorScheme, textTheme } = Theme.of(context);
    const focus = o.focusNode ?? this.ownedFocus;
    return new ListenableBuilder(focus, () => {
      const states = emptyWidgetStateSet();
      if (o.enabled === false) states.add(WidgetState.disabled);
      if (focus.hasFocus) states.add(WidgetState.focused);
      if (this.hovered) states.add(WidgetState.hovered);
      const shape = o.shape?.resolve(states) ?? theme.shape?.resolve(states) ?? stadium;
      const side = o.side?.resolve(states) ?? theme.side?.resolve(states);
      const body = new Padding(
        o.padding?.resolve(states) ?? theme.padding?.resolve(states) ?? barInsets,
        new Row(
          [
            ...(o.leading ? [o.leading] : []),
            new Expanded(
              new SearchField({
                controller: o.controller ?? null,
                focusNode: focus,
                autofocus: o.autoFocus ?? false,
                enabled: o.enabled ?? true,
                readOnly: o.readOnly ?? false,
                ...(o.keyboardType === undefined ? {} : { keyboardType: o.keyboardType }),
                ...(o.textCapitalization === undefined
                  ? {}
                  : { textCapitalization: o.textCapitalization }),
                ...(o.textInputAction === undefined ? {} : { textInputAction: o.textInputAction }),
                ...(o.contextMenuBuilder === undefined
                  ? {}
                  : { contextMenuBuilder: o.contextMenuBuilder }),
                ...(o.onTapOutside === undefined ? {} : { onTapOutside: o.onTapOutside }),
                decoration: new InputDecoration({
                  border: InputBorder.none,
                  hintText: o.hintText ?? null,
                  hintStyle:
                    o.hintStyle?.resolve(states) ??
                    theme.hintStyle?.resolve(states) ??
                    (textTheme.bodyLarge ?? new TextStyle()).copyWith({
                      color: colorScheme.onSurfaceVariant,
                    }),
                  contentPadding: EdgeInsets.zero,
                }),
                style:
                  o.textStyle?.resolve(states) ??
                  theme.textStyle?.resolve(states) ??
                  textTheme.bodyLarge,
                ...(o.onTap ? { onTap: o.onTap } : {}),
                ...(o.onChanged ? { onChanged: o.onChanged } : {}),
                ...(o.onSubmitted ? { onSubmitted: o.onSubmitted } : {}),
              }),
            ),
            ...(o.trailing ?? []),
          ],
          { spacing: 8 },
        ),
      );
      return new MouseRegion(
        new ConstrainedBox(
          new Material({
            color:
              o.backgroundColor?.resolve(states) ??
              theme.backgroundColor?.resolve(states) ??
              new Color(colorScheme.surfaceContainerHigh),
            elevation:
              o.elevation?.resolve(states)?.value ?? theme.elevation?.resolve(states)?.value ?? 6,
            shadowColor:
              o.shadowColor?.resolve(states) ?? theme.shadowColor?.resolve(states) ?? null,
            surfaceTintColor:
              o.surfaceTintColor?.resolve(states) ??
              theme.surfaceTintColor?.resolve(states) ??
              noColor,
            shape: side ? shape.copyWith({ side }) : shape,
            clipBehavior: 'antiAlias',
            child: new InkWell({
              customBorder: shape,
              onTap: o.enabled === false ? null : (o.onTap ?? (() => focus.requestFocus())),
              canRequestFocus: false,
              excludeFromSemantics: true,
              overlayColor: o.overlayColor ?? theme.overlayColor,
              child: body,
            }),
          }),
          o.constraints ?? theme.constraints ?? barLimits,
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
          enabled: options.enabled ?? true,
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
          readOnly: true,
          onTap: () => {
            controller.openView();
            options.onTap?.();
          },
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

  openView(): void {
    if (this.opened || this.widget.options.enabled === false) return;
    const navigator = Navigator.of(this.context);
    const anchor = this.key.currentContext?.findRenderObject();
    const rect =
      anchor instanceof RenderBox && anchor.hasSize && anchor.attached
        ? bounds(anchor.getTransformTo(null), anchor.size)
        : { x: 0, y: 0, width: 360, height: 56 };
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
      transitionDuration: 600,
      reverseTransitionDuration: 300,
      pageBuilder: () =>
        themes.wrap(
          new SearchView(
            o,
            controller,
            full,
            Rect.fromLTWH(rect.x, rect.y, rect.width, rect.height),
            () => this.closeView(null),
          ),
        ),
      transitionsBuilder: (_context, animation, _secondary, child) =>
        new FadeTransition({ opacity: animation, child }),
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
    if (!open || open.navigator.routes.at(-1)?.route !== open.route) return;
    if (value !== null) open.controller.text = value;
    open.navigator.pop(value ?? undefined);
  }
  override build(context: BuildContext): Widget {
    const { builder, enabled = true } = this.widget.options;
    return new AnimatedOpacity({
      key: this.key,
      opacity: enabled ? (this.isOpen ? 0 : 1) : 0.38,
      duration: 167,
      child: new IgnorePointer(
        new GestureDetector(builder(context, this.controller), {
          onTap: () => this.openView(),
          excludeFromSemantics: true,
        }),
        { ignoring: !enabled || this.isOpen },
      ),
    });
  }
  override dispose(): void {
    attached.delete(this.controller);
    const open = this.opened;
    if (open)
      (this.context as Element).owner.postFrame(() => {
        if (open.navigator.isAttached && open.navigator.routes.at(-1)?.route === open.route)
          open.navigator.pop();
      });
    this.owned.dispose();
    super.dispose();
  }
}

class SearchView extends StatefulWidget {
  constructor(
    readonly options: Readonly<SearchAnchorOptions>,
    readonly controller: SearchController,
    readonly full: boolean,
    readonly anchor: Rect,
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

  override initState(): void {
    super.initState();
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
    const side = full ? null : (o.viewSide ?? local.side);
    const shrink = !full && (o.shrinkWrap ?? local.shrinkWrap ?? false);
    const header = new SizedBox(
      undefined,
      o.headerHeight ?? local.headerHeight ?? 56,
      new Padding(
        o.viewBarPadding ?? local.barPadding ?? headerInsets,
        new Row(
          [
            o.viewLeading ?? new BackButton({ onPressed: this.widget.close }),
            new Expanded(
              new SearchField({
                controller,
                autofocus: true,
                style: o.headerTextStyle ?? local.headerTextStyle ?? textTheme.bodyLarge,
                decoration: new InputDecoration({
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                  hintText: o.viewHintText ?? null,
                  hintStyle:
                    o.headerHintStyle ??
                    local.headerHintStyle ??
                    (textTheme.bodyLarge ?? new TextStyle()).copyWith({
                      color: colorScheme.onSurfaceVariant,
                    }),
                }),
                ...(o.textCapitalization === undefined
                  ? {}
                  : { textCapitalization: o.textCapitalization }),
                ...(o.keyboardType === undefined ? {} : { keyboardType: o.keyboardType }),
                ...(o.textInputAction === undefined ? {} : { textInputAction: o.textInputAction }),
                ...(o.contextMenuBuilder === undefined
                  ? {}
                  : { contextMenuBuilder: o.contextMenuBuilder }),
                ...(o.onTapOutside === undefined ? {} : { onTapOutside: o.onTapOutside }),
                ...(o.viewOnChanged ? { onChanged: o.viewOnChanged } : {}),
                ...(o.viewOnSubmitted ? { onSubmitted: o.viewOnSubmitted } : {}),
              }),
            ),
            ...(o.viewTrailing ?? [
              new ListenableBuilder(
                controller,
                (context) =>
                  new IconButton({
                    icon: new Icon(Icons.close),
                    tooltip: MaterialLocalizations.of(context).closeButtonTooltip,
                    onPressed: controller.text ? () => controller.clear() : null,
                  }),
              ),
            ]),
          ],
          { spacing: 8 },
        ),
      ),
    );
    const content =
      o.viewBuilder?.(this.suggestions) ??
      new ListView({
        children: this.suggestions,
        padding: EdgeInsets.zero,
        primary: false,
        shrinkWrap: shrink,
      });
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
        child: new SafeArea({
          top: full,
          bottom: full,
          left: full,
          right: full,
          child: new Column(
            [
              header,
              new Divider({
                height: 1,
                color: o.dividerColor ?? local.dividerColor ?? new Color(colorScheme.outline),
              }),
              shrink
                ? new Flexible(
                    new Padding(o.viewPadding ?? local.padding ?? EdgeInsets.zero, content),
                  )
                : new Expanded(
                    new Padding(o.viewPadding ?? local.padding ?? EdgeInsets.zero, content),
                  ),
            ],
            { mainAxisSize: shrink ? 'min' : 'max', crossAxisAlignment: 'stretch' },
          ),
        }),
      }),
    });
    const keyboard = MediaQuery.maybeViewInsetsOf(context) ?? EdgeInsets.zero;
    if (full) return new Padding(keyboard, panel);
    const insets = (MediaQuery.maybePaddingOf(context) ?? EdgeInsets.zero)
      .add(keyboard)
      .resolve('ltr');
    return new CustomSingleChildLayout(
      panel,
      new SearchViewLayout(
        this.widget.anchor,
        insets,
        o.viewConstraints ?? local.constraints ?? null,
        shrink,
      ),
    );
  }
  override dispose(): void {
    ++this.version;
    this.widget.controller.removeListener(this.refresh);
    super.dispose();
  }
}

class SearchViewLayout extends SingleChildLayoutDelegate {
  constructor(
    readonly anchor: Rect,
    readonly insets: EdgeInsets,
    readonly limits: BoxConstraints | null,
    readonly shrink: boolean,
  ) {
    super();
  }
  override getConstraintsForChild(constraints: BoxConstraints): BoxConstraints {
    const { width, height } = this.insets.deflateSize(constraints.biggest);
    const limits = this.limits;
    const w = Math.min(
      width,
      Math.min(limits?.maxWidth ?? Infinity, Math.max(limits?.minWidth ?? 360, this.anchor.width)),
    );
    const h = Math.min(
      height,
      Math.min(limits?.maxHeight ?? Infinity, Math.max(limits?.minHeight ?? 80, (height * 2) / 3)),
    );
    return new BoxConstraints(w, w, this.shrink ? Math.min(h, limits?.minHeight ?? 56) : h, h);
  }
  override getPositionForChild(size: Size, child: Size): Offset {
    return {
      x: Math.max(
        this.insets.left,
        Math.min(this.anchor.left, size.width - this.insets.right - child.width),
      ),
      y: Math.max(
        this.insets.top,
        Math.min(this.anchor.top, size.height - this.insets.bottom - child.height),
      ),
    };
  }
  override shouldRelayout(): boolean {
    return true;
  }
}
