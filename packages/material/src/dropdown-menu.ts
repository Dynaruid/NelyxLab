// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/dropdown_menu.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import {
  Actions,
  CallbackAction,
  DismissIntent,
  Intent,
} from '@nelyx/core/framework/widgets/actions';
import type { ActionHandle } from '@nelyx/core/framework/widgets/actions';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { Align, Padding, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { ExcludeFocus, Focus } from '@nelyx/core/framework/widgets/focus-scope';
import { Element, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type {
  BuildContext,
  State,
  Widget,
  WidgetOptions,
} from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import { DismissMenuAction } from '@nelyx/core/framework/widgets/raw-menu-anchor';
import { RestorableValue, RestorationMixin } from '@nelyx/core/framework/widgets/restoration';
import { Scrollable } from '@nelyx/core/framework/widgets/scrollable';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Shortcuts, SingleActivator } from '@nelyx/core/framework/widgets/shortcuts';
import type { ShortcutActivator } from '@nelyx/core/framework/widgets/shortcuts';
import { TextAlignVertical } from '@nelyx/core/framework/painting/text-align-vertical';
import { WidgetState, emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import type { Offset } from '@nelyx/core/ui/offset';
import { Size } from '@nelyx/core/ui/size';
import type { ButtonStyle } from './button-style.ts';
import { DropdownMenuTheme } from './dropdown-menu-theme.ts';
import { IconButton } from './icon-button.ts';
import { Icons } from './icons.ts';
import { OutlineInputBorder } from './input-border.ts';
import { InputDecoration } from './input-decoration.ts';
import { InputDecorationTheme, InputDecorationThemeData } from './input-decoration-theme.ts';
import { colorAll, sizeAll } from './internal/button/style-properties.ts';
import { DropdownMenuBody, minimumDropdownWidth } from './internal/dropdown-menu-body.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { MenuAnchor, MenuController, MenuItemButton } from './menu-anchor.ts';
import { MenuButtonTheme } from './menu-button-theme.ts';
import { MenuStyle } from './menu-style.ts';
import { TextField } from './text-field.ts';
import type { TextFieldOptions } from './text-field.ts';
import { VisualDensity } from './theme-data.ts';
import { Theme } from './theme.ts';

export type FilterCallback<T> = (
  entries: readonly DropdownMenuEntry<T>[],
  filter: string,
) => readonly DropdownMenuEntry<T>[];
export type SearchCallback<T> = (
  entries: readonly DropdownMenuEntry<T>[],
  query: string,
) => number | null;
export type DropdownMenuDecorationBuilder = (
  context: BuildContext,
  controller: MenuController,
) => InputDecoration;

export interface DropdownMenuEntryOptions<T> {
  readonly value: T;
  readonly label: string;
  readonly labelWidget?: Widget | null;
  readonly leadingIcon?: Widget | null;
  readonly trailingIcon?: Widget | null;
  readonly enabled?: boolean;
  readonly style?: ButtonStyle | null;
}

export class DropdownMenuEntry<T> {
  readonly value: T;
  readonly label: string;
  readonly labelWidget: Widget | null;
  readonly leadingIcon: Widget | null;
  readonly trailingIcon: Widget | null;
  readonly enabled: boolean;
  readonly style: ButtonStyle | null;
  constructor({
    value,
    label,
    labelWidget = null,
    leadingIcon = null,
    trailingIcon = null,
    enabled = true,
    style = null,
  }: DropdownMenuEntryOptions<T>) {
    this.value = value;
    this.label = label;
    this.labelWidget = labelWidget;
    this.leadingIcon = leadingIcon;
    this.trailingIcon = trailingIcon;
    this.enabled = enabled;
    this.style = style;
  }
}

export class DropdownMenuCloseBehavior {
  private constructor(
    readonly index: number,
    readonly name: 'all' | 'self' | 'none',
  ) {
    Object.freeze(this);
  }
  static readonly all = new DropdownMenuCloseBehavior(0, 'all');
  static readonly self = new DropdownMenuCloseBehavior(1, 'self');
  static readonly none = new DropdownMenuCloseBehavior(2, 'none');
  static readonly values = Object.freeze([this.all, this.self, this.none]);
  toString(): string {
    return 'DropdownMenuCloseBehavior.' + this.name;
  }
}

export interface DropdownMenuOptions<T> extends WidgetOptions {
  readonly enabled?: boolean;
  readonly width?: number | null;
  readonly menuHeight?: number | null;
  readonly leadingIcon?: Widget | null;
  readonly trailingIcon?: Widget | null;
  readonly showTrailingIcon?: boolean;
  readonly trailingIconFocusNode?: FocusNode | null;
  readonly label?: Widget | null;
  readonly hintText?: string | null;
  readonly helperText?: string | null;
  readonly errorText?: string | null;
  readonly selectedTrailingIcon?: Widget | null;
  readonly enableFilter?: boolean;
  readonly enableSearch?: boolean;
  readonly keyboardType?: TextFieldOptions['keyboardType'];
  readonly textStyle?: TextStyle | null;
  readonly textAlign?: TextFieldOptions['textAlign'];
  readonly inputDecorationTheme?: InputDecorationThemeData | InputDecorationTheme | null;
  readonly decorationBuilder?: DropdownMenuDecorationBuilder | null;
  readonly menuStyle?: MenuStyle | null;
  readonly controller?: TextEditingController | null;
  readonly initialSelection?: T | null;
  readonly onSelected?: ((value: T | null) => void) | null;
  readonly focusNode?: FocusNode | null;
  readonly requestFocusOnTap?: boolean | null;
  readonly selectOnly?: boolean;
  readonly expandedInsets?: EdgeInsetsGeometry | null;
  readonly filterCallback?: FilterCallback<T> | null;
  readonly searchCallback?: SearchCallback<T> | null;
  readonly alignmentOffset?: Offset | null;
  readonly dropdownMenuEntries: readonly DropdownMenuEntry<T>[];
  readonly inputFormatters?: TextFieldOptions['inputFormatters'];
  readonly closeBehavior?: DropdownMenuCloseBehavior;
  readonly maxLines?: number | null;
  readonly textInputAction?: TextFieldOptions['textInputAction'];
  readonly cursorHeight?: number | null;
  readonly restorationId?: string | null;
  readonly menuController?: MenuController | null;
  readonly scrollPadding?: EdgeInsets;
}

export class DropdownMenu<T> extends StatefulWidget {
  constructor(readonly options: DropdownMenuOptions<T>) {
    super(options.key ?? null);
    invariant(
      !options.filterCallback || options.enableFilter,
      'dropdown-filter-disabled',
      'Enable filtering before supplying a filter callback',
    );
    invariant(
      !options.trailingIconFocusNode || options.showTrailingIcon !== false,
      'hidden-dropdown-focus',
      'A trailing focus node requires a trailing icon',
    );
    invariant(
      !options.decorationBuilder ||
        [options.label, options.hintText, options.helperText, options.errorText].every(
          (value) => value == null,
        ),
      'custom-dropdown-decoration',
      'Supply custom decoration or field decoration properties',
    );
  }
  override createState(): State<DropdownMenu<T>> {
    return new DropdownMenuState<T>();
  }
}

class ArrowUpIntent extends Intent {}
class ArrowDownIntent extends Intent {}
class EnterIntent extends Intent {}

const arrowShortcuts = new Map<ShortcutActivator, Intent>([
  [new SingleActivator(LogicalKeyboardKey.arrowUp), new ArrowUpIntent()],
  [new SingleActivator(LogicalKeyboardKey.arrowDown), new ArrowDownIntent()],
]);
const readonlyShortcuts = new Map<ShortcutActivator, Intent>([
  ...arrowShortcuts,
  [new SingleActivator(LogicalKeyboardKey.enter), new EnterIntent()],
]);
const horizontalItemPadding = 12;
const inputStartGap = 4;
const iconPadding = EdgeInsets.all(4);
const defaultScrollPadding = EdgeInsets.all(20);
const defaultInputTheme = new InputDecorationThemeData({ border: new OutlineInputBorder() });
const defaultMenuStyle = new MenuStyle({
  minimumSize: sizeAll(new Size(minimumDropdownWidth, 0)),
  maximumSize: sizeAll(Size.infinite),
  visualDensity: VisualDensity.standard,
});
let nextDropdownFieldId = 0;

class DropdownMenuState<T> extends RestorationMixin<DropdownMenu<T>> {
  private readonly ownText = new TextEditingController();
  private readonly ownMenu = new MenuController();
  private readonly ownFocus = new FocusNode({ debugLabel: 'Dropdown field' });
  private readonly keyboardFocus = new FocusNode({
    debugLabel: 'Dropdown keyboard',
    skipTraversal: true,
  });
  private readonly itemKeys = new WeakMap<DropdownMenuEntry<T>, GlobalKey>();
  private readonly fieldId = 'dropdown-menu-' + ++nextDropdownFieldId;
  private readonly leadingKey = new GlobalKey('Dropdown leading icon');
  private readonly draft = new RestorableValue<string | null>(null, (value) => {
    invariant(
      value === null || typeof value === 'string',
      'invalid-dropdown-restoration',
      'Expected dropdown input text',
    );
    return value;
  });
  private filtered: readonly DropdownMenuEntry<T>[] = [];
  private highlighted: number | null = null;
  private filterActive = false;
  private leadingWidth = 0;
  private lastQuery: string | null = null;
  private queryUpdatePending = false;

  private get text(): TextEditingController {
    return this.widget.options.controller ?? this.ownText;
  }
  private readonly rememberText = (): void => {
    this.draft.value = this.text.text;
    if (this.queryUpdatePending || this.lastQuery === this.text.text) return;
    this.queryUpdatePending = true;
    void Promise.resolve().then(() => {
      this.queryUpdatePending = false;
      if (!this.mounted || !(this.context instanceof Element) || !this.context.active) return;
      const text = this.text.text;
      if (this.draft.value !== text || this.lastQuery === text) return;
      this.setState(() => this.updateEntries(text));
      if (this.menu.isOpen) this.revealHighlight();
    });
  };
  private get menu(): MenuController {
    return this.widget.options.menuController ?? this.ownMenu;
  }
  private get editorFocus(): FocusNode {
    return this.widget.options.focusNode ?? this.ownFocus;
  }
  override get restorationId(): string | null {
    return this.widget.options.restorationId ?? null;
  }

  override initState(): void {
    super.initState();
    this.reflectInitialSelection();
    this.draft.value = this.text.text;
    this.text.addListener(this.rememberText);
  }

  override restoreState(): void {
    this.registerForRestoration(this.draft, 'text');
    const restored = this.draft.value;
    if (restored !== null) this.text.text = restored;
    this.updateEntries(this.text.text);
  }

  override didUpdateWidget(old: DropdownMenu<T>): void {
    super.didUpdateWidget(old);
    const options = this.widget.options;
    if (old.options.controller !== options.controller) {
      (old.options.controller ?? this.ownText).removeListener(this.rememberText);
      if (!options.controller) this.ownText.text = '';
      this.text.addListener(this.rememberText);
    }
    if (!valueEquals(old.options.initialSelection, options.initialSelection)) {
      this.reflectInitialSelection();
    } else if (
      old.options.controller !== options.controller ||
      old.options.dropdownMenuEntries !== options.dropdownMenuEntries ||
      old.options.enableSearch !== options.enableSearch ||
      old.options.enableFilter !== options.enableFilter ||
      old.options.filterCallback !== options.filterCallback ||
      old.options.searchCallback !== options.searchCallback
    ) {
      if (!options.enableFilter) this.filterActive = false;
      this.updateEntries(this.text.text);
    }
    if (old.options.controller !== options.controller) this.draft.value = this.text.text;
    if (old.options.enabled !== false && options.enabled === false) this.menu.close();
  }

  private reflectInitialSelection(): void {
    const { dropdownMenuEntries, initialSelection } = this.widget.options;
    const entry = dropdownMenuEntries.find((item) =>
      valueEquals(item.value, initialSelection ?? null),
    );
    if (entry) this.writeLabel(entry.label);
    this.filterActive = false;
    this.updateEntries(this.text.text);
  }

  private writeLabel(label: string): void {
    this.text.text = label;
    this.draft.value = this.text.text;
    this.lastQuery = label;
  }

  private updateEntries(text: string): void {
    const {
      dropdownMenuEntries,
      enableSearch = true,
      filterCallback,
      searchCallback,
    } = this.widget.options;
    const query = text.toLowerCase();
    this.filtered = this.filterActive
      ? (filterCallback?.(dropdownMenuEntries, text) ??
        dropdownMenuEntries.filter((item) => item.label.toLowerCase().includes(query)))
      : dropdownMenuEntries;
    const index = enableSearch
      ? searchCallback
        ? searchCallback(this.filtered, text)
        : query.length
          ? this.filtered.findIndex((item) => item.label.toLowerCase().includes(query))
          : null
      : null;
    this.highlighted =
      index !== null && Number.isInteger(index) && index >= 0 && index < this.filtered.length
        ? index
        : null;
    this.lastQuery = text;
  }

  private get canRequestEditorFocus(): boolean {
    const options = this.widget.options;
    const platform = Theme.of(this.context).platform;
    return (
      options.focusNode?.canRequestFocus ??
      options.requestFocusOnTap ??
      (platform === 'macOS' || platform === 'linux' || platform === 'windows')
    );
  }

  private get canEdit(): boolean {
    return !this.widget.options.selectOnly && this.canRequestEditorFocus;
  }

  private toggle(): void {
    const menu = this.menu;
    if (this.widget.options.enabled === false) return;
    if (menu.isOpen) {
      menu.close();
      return;
    }
    this.setState(() => {
      this.filterActive = false;
      this.updateEntries(this.text.text);
    });
    menu.open();
  }

  private readonly handleTextChange = (text: string): void => {
    if (this.widget.options.enabled === false) return;
    this.setState(() => {
      this.draft.value = text;
      this.filterActive = this.widget.options.enableFilter ?? false;
      this.updateEntries(text);
    });
    if (!this.menu.isOpen) this.menu.open();
    this.revealHighlight();
  };

  private moveHighlight(direction: -1 | 1): void {
    if (
      this.widget.options.enabled === false ||
      !this.menu.isOpen ||
      !this.filtered.some((entry) => entry.enabled)
    )
      return;
    const count = this.filtered.length;
    let index = this.highlighted ?? (direction === 1 ? -1 : 0);
    do {
      index = (index + direction + count) % count;
    } while (!this.filtered[index]!.enabled);
    this.setState(() => {
      this.highlighted = index;
      this.filterActive = false;
      this.writeLabel(this.filtered[index]!.label);
    });
    this.revealHighlight();
  }

  private readonly submit = (): void => {
    if (this.widget.options.enabled === false) return;
    if (!this.menu.isOpen) {
      if (!this.canEdit) this.toggle();
      return;
    }
    const entry = this.highlighted === null ? null : this.filtered[this.highlighted];
    if (entry?.enabled) {
      this.writeLabel(entry.label);
      this.widget.options.onSelected?.(entry.value);
    } else if (this.highlighted === null) this.widget.options.onSelected?.(null);
    this.menu.close();
  };

  private revealHighlight(): void {
    const context = this.context;
    if (!(context instanceof Element)) return;
    context.owner.postFrame(() => {
      if (!this.mounted || !context.active || !this.menu.isOpen || this.highlighted === null)
        return;
      const entry = this.filtered[this.highlighted];
      const target = entry && this.itemKeys.get(entry)?.currentContext;
      if (target instanceof Element && target.active) void Scrollable.ensureVisible(target);
    });
  }

  private buildItems(
    context: BuildContext,
    entries: readonly DropdownMenuEntry<T>[] = this.filtered,
    measuring = false,
  ): readonly Widget[] {
    const options = this.widget.options;
    const behavior = options.closeBehavior ?? DropdownMenuCloseBehavior.all;
    const theme = Theme.of(context),
      itemTheme = MenuButtonTheme.of(context).style;
    const colors = theme.colorScheme;
    return entries.map((entry, index) => {
      let key = this.itemKeys.get(entry);
      if (!key) this.itemKeys.set(entry, (key = new GlobalKey('Dropdown option')));
      const start =
        !entry.leadingIcon && this.leadingWidth > 0 ? this.leadingWidth : horizontalItemPadding;
      let style =
        entry.style ??
        MenuItemButton.styleFrom({
          padding: EdgeInsetsDirectional.only({ start, end: horizontalItemPadding }),
        });
      if (!measuring && entry.enabled && index === this.highlighted) {
        const states = emptyWidgetStateSet();
        states.add(WidgetState.focused);
        const foreground = new Color(colors.onSurface);
        style = style.copyWith({
          foregroundColor: colorAll(
            entry.style?.foregroundColor?.resolve(states) ??
              itemTheme?.foregroundColor?.resolve(states) ??
              foreground,
          ),
          iconColor: colorAll(
            entry.style?.iconColor?.resolve(states) ??
              itemTheme?.iconColor?.resolve(states) ??
              new Color(colors.onSurfaceVariant),
          ),
          overlayColor: colorAll(
            entry.style?.overlayColor?.resolve(states) ??
              itemTheme?.overlayColor?.resolve(states) ??
              foreground.withOpacity(0.1),
          ),
          backgroundColor: colorAll(
            entry.style?.backgroundColor?.resolve(states) ??
              itemTheme?.backgroundColor?.resolve(states) ??
              foreground.withOpacity(0.12),
          ),
        });
      }
      return new ExcludeFocus(
        new MenuItemButton({
          key,
          style,
          leadingIcon: entry.leadingIcon,
          trailingIcon: entry.trailingIcon,
          closeOnActivate: behavior === DropdownMenuCloseBehavior.all,
          requestFocusOnHover: false,
          child: new Padding(
            EdgeInsetsDirectional.only({ start: inputStartGap }),
            entry.labelWidget ?? new Text(entry.label),
          ),
          onPressed:
            entry.enabled && options.enabled !== false
              ? measuring
                ? () => {}
                : () => {
                    if (this.mounted) {
                      this.setState(() => {
                        this.writeLabel(entry.label);
                        this.filterActive = false;
                        this.highlighted = options.enableSearch !== false ? index : null;
                      });
                      if (behavior === DropdownMenuCloseBehavior.self) this.menu.close();
                    } else if (options.controller) options.controller.text = entry.label;
                    options.onSelected?.(entry.value);
                  }
              : null,
        }),
      );
    });
  }

  private scheduleLeadingWidth(): void {
    const context = this.context;
    if (!(context instanceof Element)) return;
    context.owner.postFrame(() => {
      if (!this.mounted || !context.active) return;
      const render = this.leadingKey.currentContext?.findRenderObject();
      const width = render instanceof RenderBox && render.hasSize ? render.size.width : 0;
      if (width !== this.leadingWidth)
        this.setState(() => {
          this.leadingWidth = width;
        });
    });
  }

  private buildField(
    context: BuildContext,
    controller: MenuController,
    inputTheme: InputDecorationThemeData,
    style: TextStyle,
  ): Widget {
    const options = this.widget.options,
      readOnly = !this.canEdit,
      enabled = options.enabled ?? true;
    let decoration =
      options.decorationBuilder?.(context, controller) ??
      new InputDecoration({
        label: options.label ?? null,
        hintText: options.hintText ?? null,
        helperText: options.helperText ?? null,
        errorText: options.errorText ?? null,
        prefixIcon: options.leadingIcon ?? null,
      });
    if (decoration.suffixIcon === null && options.showTrailingIcon !== false) {
      const suffix = new IconButton({
        focusNode: options.trailingIconFocusNode ?? null,
        icon: options.trailingIcon ?? new Icon(Icons.arrow_drop_down),
        selectedIcon: options.selectedTrailingIcon ?? new Icon(Icons.arrow_drop_up),
        isSelected: controller.isOpen,
        constraints: inputTheme.suffixIconConstraints,
        padding: inputTheme.isCollapsed ? EdgeInsets.zero : null,
        onPressed: enabled ? () => this.toggle() : null,
      });
      decoration = decoration.copyWith({
        suffixIcon: new Padding(
          inputTheme.isCollapsed ? EdgeInsets.zero : iconPadding,
          new ExcludeSemantics({ excluding: readOnly, child: suffix }),
        ),
      });
    }
    decoration = decoration.applyDefaults(inputTheme);
    const prefix = decoration.prefixIcon;
    if (prefix)
      decoration = decoration.copyWith({
        prefixIcon: new SizedBox(undefined, undefined, prefix, this.leadingKey),
      });
    this.scheduleLeadingWidth();
    const localization = MaterialLocalizations.of(context);
    const field = new Semantics({
      button: readOnly,
      expanded: controller.isOpen,
      enabled,
      hint:
        Theme.of(context).platform === 'iOS'
          ? controller.isOpen
            ? localization.collapsedHint
            : localization.expandedHint
          : null,
      onExpand: enabled && !controller.isOpen ? () => this.toggle() : null,
      onCollapse: enabled && controller.isOpen ? () => this.toggle() : null,
      ...(readOnly && FoundationPlatform.isWeb
        ? {
            label: decoration.labelText ?? decoration.hintText ?? '',
            value: this.text.text,
            onTap: enabled ? () => this.toggle() : null,
          }
        : {}),
      child: new ExcludeSemantics({
        excluding: readOnly && FoundationPlatform.isWeb,
        child: new TextField({
          id: this.fieldId,
          controller: this.text,
          focusNode: this.editorFocus,
          canRequestFocus: this.canRequestEditorFocus,
          style,
          enabled,
          readOnly,
          enableInteractiveSelection: !readOnly,
          mouseCursor: readOnly ? SystemMouseCursors.click : SystemMouseCursors.text,
          textAlign: options.textAlign ?? 'start',
          textAlignVertical: TextAlignVertical.center,
          maxLines: options.maxLines === undefined ? 1 : options.maxLines,
          scrollPadding: options.scrollPadding ?? defaultScrollPadding,
          decoration,
          onSubmitted: this.submit,
          onChanged: this.handleTextChange,
          ...(enabled ? { onTap: () => this.toggle() } : {}),
          ...(options.keyboardType !== undefined ? { keyboardType: options.keyboardType } : {}),
          ...(options.textInputAction !== undefined
            ? { textInputAction: options.textInputAction }
            : {}),
          ...(options.inputFormatters !== undefined
            ? { inputFormatters: options.inputFormatters }
            : {}),
          ...(options.cursorHeight != null ? { cursorHeight: options.cursorHeight } : {}),
        }),
      }),
    });
    if (options.expandedInsets)
      return new Focus(field, { focusNode: this.keyboardFocus, includeSemantics: false });
    // The overlay and the width probes share the item keys so custom children
    // keep a single Element when their menu opens or closes.
    const probes =
      controller.isOpen || options.width != null
        ? null
        : this.buildItems(context, options.dropdownMenuEntries, true);
    return new Focus(new DropdownMenuBody(field, probes, options.width ?? null), {
      focusNode: this.keyboardFocus,
      includeSemantics: false,
    });
  }

  override build(context: BuildContext): Widget {
    const options = this.widget.options,
      theme = DropdownMenuTheme.of(context),
      colors = Theme.of(context).colorScheme;
    const defaultStyle = Theme.of(context).textTheme.bodyLarge ?? new TextStyle();
    const base = options.textStyle ?? theme.textStyle ?? defaultStyle;
    const style =
      options.enabled === false
        ? base.copyWith({
            color: (
              theme.disabledColor ?? new Color(colors.onSurface).withOpacity(0.38)
            ).toARGB32(),
          })
        : base;
    const supplied = options.inputDecorationTheme;
    const inputTheme =
      (supplied instanceof InputDecorationTheme ? supplied.data : supplied) ??
      theme.inputDecorationTheme ??
      defaultInputTheme;
    let menuStyle =
      (options.menuStyle ?? theme.menuStyle)?.merge(defaultMenuStyle) ?? defaultMenuStyle;
    const maximum = menuStyle.maximumSize?.resolve(emptyWidgetStateSet());
    if (options.width != null)
      menuStyle = menuStyle.copyWith({
        minimumSize: sizeAll(new Size(Math.min(options.width, maximum?.width ?? Infinity), 0)),
      });
    if (options.menuHeight != null)
      menuStyle = menuStyle.copyWith({
        maximumSize: sizeAll(new Size(maximum?.width ?? Infinity, options.menuHeight)),
      });
    const controller = this.menu;
    const shortcuts = this.canEdit ? arrowShortcuts : readonlyShortcuts;
    const actions = new Map<typeof Intent, ActionHandle>([
      [ArrowUpIntent, new CallbackAction(ArrowUpIntent, () => this.moveHighlight(-1))],
      [ArrowDownIntent, new CallbackAction(ArrowDownIntent, () => this.moveHighlight(1))],
      [EnterIntent, new CallbackAction(EnterIntent, this.submit)],
      [DismissIntent, new DismissMenuAction({ controller })],
    ]);
    let menu: Widget = new MenuAnchor({
      controller,
      style: menuStyle,
      reservedPadding: EdgeInsets.zero,
      crossAxisUnconstrained: false,
      minimumAnchorWidth: true,
      autofocusMenu: false,
      childFocusNode: this.canRequestEditorFocus ? this.editorFocus : this.keyboardFocus,
      ...(options.alignmentOffset ? { alignmentOffset: options.alignmentOffset } : {}),
      menuChildren: this.buildItems(context),
      builder: (anchorContext, controller) =>
        this.buildField(anchorContext, controller, inputTheme, style),
      onOpen: () => this.revealHighlight(),
      onClose: () => {
        if (this.mounted && this.context instanceof Element && this.context.active) {
          this.setState(() => {
            this.highlighted = null;
            this.filterActive = false;
          });
        }
      },
    });
    if (options.expandedInsets) {
      const insets = options.expandedInsets.resolve(Directionality.of(context));
      menu = new Padding(
        EdgeInsets.fromLTRB(Math.max(0, insets.left), 0, Math.max(0, insets.right), 0),
        menu,
      );
    }
    return new Actions({
      actions,
      child: new Shortcuts({
        shortcuts,
        child: new Align(menu, {
          alignment: AlignmentDirectional.topStart,
          widthFactor: 1,
          heightFactor: 1,
        }),
      }),
    });
  }

  override dispose(): void {
    this.text.removeListener(this.rememberText);
    super.dispose();
    this.draft.dispose();
    this.ownText.dispose();
    this.ownFocus.dispose();
    this.keyboardFocus.dispose();
  }
}
