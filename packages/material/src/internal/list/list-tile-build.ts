// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Observable source defaults/build/input contracts on canonical Core owners.
import type { Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import { SizedBox, Padding, DecoratedBox, ColoredBox } from '@nelyx/core/framework/widgets/basic';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { AnimatedDefaultTextStyle } from '@nelyx/core/framework/widgets/implicit-animations';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Color } from '@nelyx/core/ui/color';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import {
  copyCapturedTextStyle,
  isCapturedTextStyle,
} from '@nelyx/core/framework/painting/text-style';
import { WidgetState, WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import { WidgetStateColor } from '@nelyx/core/framework/widgets/widget-state-color';
import { WidgetStateMouseCursor } from '@nelyx/core/framework/widgets/widget-state-mouse-cursor';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import type { DartSet } from '@nelyx/core/foundation/dart-collections';
import { sourceColorType } from '@nelyx/core/ui/color-source';
import {
  nullableDartType,
  isDartType,
  captureDartInterface,
} from '@nelyx/core/foundation/dart-type-witness';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { FlagProperty, DoubleProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { ColorProperty } from '@nelyx/core/framework/painting/color-property';
import { FoundationBuildMode } from '@nelyx/core/foundation/constants';
import { invariant } from '@nelyx/core/foundation/errors';
import type { ListTile } from '../../list-tile.ts';
import { ListTileStyle, ListTileTitleAlignment } from '../../generated/list/list-tile-types.ts';
import { ListTileTheme, ListTileThemeData } from '../../list-tile-theme.ts';
import { ListTileRenderWidget } from './list-tile-render.ts';
import { Theme } from '../../theme.ts';
import { InkWell } from '../../ink-well.ts';
import { Ink } from '../../ink-decoration.ts';
import { Material } from '../../material.ts';
import { ChipBackgroundDecoration as ColorShapeDecoration } from '../chip/chip-background.ts';
import { emptyInkDecoration } from '../material/empty-ink-decoration.ts';
import { IconButtonTheme, IconButtonThemeData } from '../../icon-button-theme.ts';
import { ButtonStyle } from '../../button-style.ts';
import { Divider } from '../../divider.ts';
function defaultTileTextStyle(
  base: TextStyle,
  colors: Readonly<{ onSurface: number; onSurfaceVariant: number }>,
  role: 'onSurface' | 'onSurfaceVariant',
): TextStyle {
  const copy = base.copyWith;
  return copyCapturedTextStyle(base, copy, { color: colors[role] });
}
interface TileDefaultsProjection {
  readonly title: TextStyle;
  readonly subtitle: TextStyle;
  readonly leading: TextStyle;
  readonly primary: number;
  readonly icon: number;
  readonly value: ListTileThemeData;
}
// One immutable projection per live Theme. Resolve external members before
// lookup, so style getters/overrides and live colour sources keep their order.
const tileDefaults = new WeakMap<object, TileDefaultsProjection>();
export function listTileDefaults(context: BuildContext, _style: ListTileStyle): ListTileThemeData {
  const theme = Theme.of(context),
    text = theme.textTheme,
    colors = theme.colorScheme;
  const title = defaultTileTextStyle(text.bodyLarge!, colors, 'onSurface'),
    subtitle = defaultTileTextStyle(text.bodyMedium!, colors, 'onSurfaceVariant'),
    leading = defaultTileTextStyle(text.labelSmall!, colors, 'onSurfaceVariant'),
    primary = colors.primary,
    previous = tileDefaults.get(theme);
  // Construct/validate the selected colour before reading the icon colour,
  // matching the original object initializer even for a live source getter.
  const selectedColor =
      previous && Object.is(previous.primary, primary)
        ? previous.value.selectedColor!
        : new Color(primary),
    icon = colors.onSurfaceVariant;
  const iconColor =
    previous && Object.is(previous.icon, icon) ? previous.value.iconColor! : new Color(icon);
  if (
    previous &&
    previous.title === title &&
    previous.subtitle === subtitle &&
    previous.leading === leading &&
    previous.value.selectedColor === selectedColor &&
    previous.value.iconColor === iconColor
  )
    return previous.value;
  const value = new ListTileThemeData({
    contentPadding: EdgeInsetsDirectional.only({ start: 16, end: 24 }),
    minLeadingWidth: 24,
    minVerticalPadding: 8,
    shape: new RoundedRectangleBorder(),
    tileColor: new Color(0),
    titleTextStyle: title,
    subtitleTextStyle: subtitle,
    leadingAndTrailingTextStyle: leading,
    selectedColor,
    iconColor,
  });
  if (
    typeof primary === 'number' &&
    typeof icon === 'number' &&
    isCapturedTextStyle(title) &&
    isCapturedTextStyle(subtitle) &&
    isCapturedTextStyle(leading)
  )
    tileDefaults.set(theme, { title, subtitle, leading, primary, icon, value });
  return value;
}
export function resolveListTileColor(
  explicit: Color | null,
  selected: Color | null,
  enabled: Color | null,
  disabled: Color | null,
  states: DartSet<WidgetState>,
): Color | null {
  if (explicit instanceof WidgetStateColor) return explicit.resolve(states);
  if (states.contains(WidgetState.disabled)) return disabled;
  if (states.contains(WidgetState.selected)) return selected;
  return enabled;
}
// Keep the ambient media projection in its own build scope, as a SafeArea
// widget does. Size changes need not rebuild the tile's themes and controls.
class ListTileSafeArea extends StatelessWidget {
  constructor(
    readonly minimum: EdgeInsets,
    readonly child: Widget,
  ) {
    super();
  }
  build(context: BuildContext): Widget {
    const data = MediaQuery.of(context),
      padding = data.safeArea,
      minimum = this.minimum;
    return new Padding(
      new EdgeInsets(
        Math.max(padding.left, minimum.left),
        Math.max(0, minimum.top),
        Math.max(padding.right, minimum.right),
        Math.max(0, minimum.bottom),
      ),
      new MediaQuery(
        {
          ...data,
          safeArea: {
            ...padding,
            left: 0,
            right: 0,
          },
        },
        this.child,
      ),
    );
  }
}
function checkVisibleBackground(context: BuildContext): void {
  if (!FoundationBuildMode.debug) return;
  context.visitAncestorElements((ancestor) => {
    const widget = ancestor.widget;
    if (widget instanceof Material) return false;
    const color =
      widget instanceof ColoredBox
        ? widget.color
        : widget instanceof DecoratedBox && widget.decoration instanceof BoxDecoration
          ? widget.decoration.color
          : widget instanceof DecoratedBox && widget.decoration instanceof ColorShapeDecoration
            ? (widget.decoration.color?.toARGB32() ?? null)
            : null;
    invariant(
      color === null || color >>> 24 === 0,
      'hidden-list-tile-ink',
      'An opaque ColoredBox/DecoratedBox between ListTile and Material hides its ink/background. Place a Material at the intended paint owner.',
    );
    return true;
  });
}
function listTileInkDecoration(
  shape: ShapeBorder | null,
  background: Color,
  defaultBackground: Color,
): ColorShapeDecoration {
  return shape === null && background === defaultBackground
    ? emptyInkDecoration
    : new ColorShapeDecoration(shape ?? new Border(), background);
}
export function buildListTile(tile: ListTile, context: BuildContext): Widget {
  Material.of(context);
  const theme = Theme.of(context),
    local = ListTileTheme.of(context),
    global = theme.listTileTheme,
    style = tile.style ?? local.style ?? global.style ?? ListTileStyle.list,
    defaults = listTileDefaults(context, style),
    background = tile.tileColor ?? local.tileColor ?? global.tileColor ?? defaults.tileColor!,
    selectedBackground =
      tile.selectedTileColor ??
      local.selectedTileColor ??
      global.selectedTileColor ??
      defaults.tileColor!;
  if (
    tile.onTap !== null ||
    tile.onLongPress !== null ||
    background.a > 0 ||
    selectedBackground.a > 0
  )
    checkVisibleBackground(context);
  const states = emptyWidgetStateSet();
  if (!tile.enabled) states.add(WidgetState.disabled);
  if (tile.selected) states.add(WidgetState.selected);
  const color = (
    explicit: Color | null,
    selected: Color | null,
    enabled: Color | null,
    disabled: Color | null = null,
  ) => resolveListTileColor(explicit, selected, enabled, disabled, states);
  const iconColor =
      color(tile.iconColor, tile.selectedColor, tile.iconColor) ??
      color(local.iconColor, local.selectedColor, local.iconColor) ??
      color(global.iconColor, global.selectedColor, global.iconColor),
    defaultIconColor = color(
      defaults.iconColor,
      defaults.selectedColor,
      defaults.iconColor,
      theme.disabledColor,
    ),
    parentButtonTheme = IconButtonTheme.of(context),
    iconButtonColor =
      iconColor ?? parentButtonTheme.style?.foregroundColor?.resolve(states) ?? defaultIconColor,
    effectiveIconColor = iconColor ?? defaultIconColor,
    effectiveTextColor =
      color(tile.textColor, tile.selectedColor, tile.textColor) ??
      color(local.textColor, local.selectedColor, local.textColor) ??
      color(global.textColor, global.selectedColor, global.textColor) ??
      color(defaults.textColor, defaults.selectedColor, defaults.textColor, theme.disabledColor),
    dense = tile.dense ?? local.dense ?? global.dense ?? false;
  if (iconButtonColor !== null && !isDartType(iconButtonColor, sourceColorType))
    captureDartInterface(iconButtonColor, sourceColorType);
  const buttonStyle = (parentButtonTheme.style ?? new ButtonStyle()).copyWith({
      foregroundColor: WidgetStateProperty.all(nullableDartType(sourceColorType), iconButtonColor),
    }),
    animated = (child: Widget, textStyle: TextStyle): Widget =>
      new AnimatedDefaultTextStyle({
        style: textStyle,
        duration: 200,
        child,
      }),
    leadingStyle =
      tile.leadingAndTrailingTextStyle ??
      local.leadingAndTrailingTextStyle ??
      defaults.leadingAndTrailingTextStyle!,
    titleBase = tile.titleTextStyle ?? local.titleTextStyle ?? defaults.titleTextStyle!,
    titleStyle = copyCapturedTextStyle(titleBase, titleBase.copyWith, {
      color: effectiveTextColor?.toARGB32() ?? null,
      fontSize: dense ? 13 : null,
    }),
    subtitleBase =
      tile.subtitle === null
        ? null
        : (tile.subtitleTextStyle ?? local.subtitleTextStyle ?? defaults.subtitleTextStyle!),
    subtitleStyle =
      subtitleBase === null
        ? null
        : copyCapturedTextStyle(subtitleBase, subtitleBase.copyWith, {
            color: effectiveTextColor?.toARGB32() ?? null,
            fontSize: dense ? 12 : null,
          }),
    direction = Directionality.of(context),
    contentPadding = (
      tile.contentPadding ??
      local.contentPadding ??
      defaults.contentPadding!
    ).resolve(direction);
  const mouseStates = emptyWidgetStateSet();
  if (!tile.enabled || (tile.onTap === null && tile.onLongPress === null))
    mouseStates.add(WidgetState.disabled);
  const cursor =
      (tile.mouseCursor instanceof WidgetStateMouseCursor
        ? tile.mouseCursor.resolve(mouseStates)
        : tile.mouseCursor) ??
      local.mouseCursor?.resolve(mouseStates) ??
      WidgetStateMouseCursor.clickable.resolve(mouseStates),
    alignment = tile.titleAlignment ?? local.titleAlignment ?? ListTileTitleAlignment.threeLine,
    shape = tile.shape ?? local.shape;
  const body = new ListTileRenderWidget({
    leading:
      tile.leading === null
        ? null
        : animated(
            tile.leading,
            copyCapturedTextStyle(leadingStyle, leadingStyle.copyWith, {
              color: effectiveTextColor?.toARGB32() ?? null,
            }),
          ),
    title: animated(tile.title ?? new SizedBox(), titleStyle),
    subtitle: tile.subtitle === null ? null : animated(tile.subtitle, subtitleStyle!),
    trailing:
      tile.trailing === null
        ? null
        : animated(
            tile.trailing,
            copyCapturedTextStyle(leadingStyle, leadingStyle.copyWith, {
              color: effectiveTextColor?.toARGB32() ?? null,
            }),
          ),
    isDense: dense,
    visualDensity: tile.visualDensity ?? local.visualDensity ?? theme.visualDensity,
    isThreeLine: tile.isThreeLine ?? local.isThreeLine ?? global.isThreeLine ?? false,
    textDirection: direction,
    titleBaselineType: titleStyle.textBaseline ?? defaults.titleTextStyle!.textBaseline!,
    subtitleBaselineType: subtitleStyle?.textBaseline ?? defaults.subtitleTextStyle!.textBaseline!,
    horizontalTitleGap: tile.horizontalTitleGap ?? local.horizontalTitleGap ?? 16,
    minVerticalPadding:
      tile.minVerticalPadding ?? local.minVerticalPadding ?? defaults.minVerticalPadding!,
    minLeadingWidth: tile.minLeadingWidth ?? local.minLeadingWidth ?? defaults.minLeadingWidth!,
    minTileHeight: tile.minTileHeight ?? local.minTileHeight,
    titleAlignment: alignment,
  });
  return new InkWell({
    customBorder: shape,
    onTap: tile.enabled ? tile.onTap : null,
    onLongPress: tile.enabled ? tile.onLongPress : null,
    onFocusChange: tile.onFocusChange,
    mouseCursor: cursor,
    canRequestFocus: tile.enabled,
    focusNode: tile.focusNode,
    focusColor: tile.focusColor,
    hoverColor: tile.hoverColor,
    splashColor: tile.splashColor,
    autofocus: tile.autofocus,
    enableFeedback: tile.enableFeedback ?? local.enableFeedback ?? true,
    statesController: tile.statesController,
    ...(tile.id === undefined ? {} : { id: tile.id }),
    child: new Semantics({
      button:
        tile.internalAddSemanticForOnTap && (tile.onTap !== null || tile.onLongPress !== null),
      selected: tile.selected,
      enabled: tile.enabled,
      child: new Ink({
        decoration: listTileInkDecoration(
          shape,
          tile.selected ? selectedBackground : background,
          defaults.tileColor!,
        ),
        child: new ListTileSafeArea(
          contentPadding,
          new IconTheme(
            new IconThemeData({ color: effectiveIconColor }),
            new IconButtonTheme(new IconButtonThemeData({ style: buttonStyle }), body),
          ),
        ),
      }),
    }),
  });
}
export function divideListTiles({
  context = null,
  tiles,
  color = null,
}: {
  readonly context?: BuildContext | null;
  readonly tiles: Iterable<Widget>;
  readonly color?: Color | null;
}): Iterable<Widget> {
  invariant(
    color !== null || context !== null,
    'missing-tile-divider-color',
    'ListTile.divideTiles needs a context or color',
  );
  const list = [...tiles];
  if (list.length < 2) return list;
  const side = Divider.createBorderSide(context, { color });
  return [
    ...list.slice(0, -1).map(
      (tile) =>
        new DecoratedBox(tile, {
          position: 'foreground',
          decoration: new BoxDecoration({ border: new Border({ bottom: side }) }),
        }),
    ),
    list.at(-1)!,
  ];
}
export function listTileDiagnostics(tile: ListTile, p: DiagnosticPropertiesBuilder): void {
  p.add(
    new FlagProperty('isThreeLine', tile.isThreeLine, {
      ifTrue: 'THREE_LINE',
      ifFalse: 'TWO_LINE',
      showName: true,
    }),
  );
  p.add(
    new FlagProperty('dense', tile.dense, {
      ifTrue: 'true',
      ifFalse: 'false',
      showName: true,
    }),
  );
  p.add(
    new DiagnosticsProperty('visualDensity', tile.visualDensity, {
      defaultValue: null,
      typeName: 'VisualDensity',
    }),
  );
  p.add(
    new DiagnosticsProperty('shape', tile.shape, { defaultValue: null, typeName: 'ShapeBorder' }),
  );
  p.add(
    new DiagnosticsProperty('style', tile.style, { defaultValue: null, typeName: 'ListTileStyle' }),
  );
  for (const f of ['selectedColor', 'iconColor', 'textColor'] as const)
    p.add(new ColorProperty(f, tile[f], { defaultValue: null }));
  for (const f of ['titleTextStyle', 'subtitleTextStyle', 'leadingAndTrailingTextStyle'] as const)
    p.add(new DiagnosticsProperty(f, tile[f], { defaultValue: null, typeName: 'TextStyle' }));
  p.add(
    new DiagnosticsProperty('contentPadding', tile.contentPadding, {
      defaultValue: null,
      typeName: 'EdgeInsetsGeometry',
    }),
  );
  p.add(
    new FlagProperty('enabled', tile.enabled, {
      ifTrue: 'true',
      ifFalse: 'false',
      showName: true,
      defaultValue: true,
    }),
  );
  for (const f of ['onTap', 'onLongPress'] as const)
    p.add(new DiagnosticsProperty(f, tile[f], { defaultValue: null, typeName: 'Function' }));
  p.add(
    new DiagnosticsProperty('mouseCursor', tile.mouseCursor, {
      defaultValue: null,
      typeName: 'MouseCursor',
    }),
  );
  p.add(
    new FlagProperty('selected', tile.selected, {
      ifTrue: 'true',
      ifFalse: 'false',
      showName: true,
      defaultValue: false,
    }),
  );
  for (const f of ['focusColor', 'hoverColor'] as const)
    p.add(new ColorProperty(f, tile[f], { defaultValue: null }));
  p.add(
    new DiagnosticsProperty('focusNode', tile.focusNode, {
      defaultValue: null,
      typeName: 'FocusNode',
    }),
  );
  p.add(
    new FlagProperty('autofocus', tile.autofocus, {
      ifTrue: 'true',
      ifFalse: 'false',
      showName: true,
      defaultValue: false,
    }),
  );
  for (const f of ['tileColor', 'selectedTileColor'] as const)
    p.add(new ColorProperty(f, tile[f], { defaultValue: null }));
  p.add(
    new FlagProperty('enableFeedback', tile.enableFeedback, {
      ifTrue: 'true',
      ifFalse: 'false',
      showName: true,
    }),
  );
  for (const f of ['horizontalTitleGap', 'minVerticalPadding', 'minLeadingWidth'] as const)
    p.add(new DoubleProperty(f, tile[f], { defaultValue: null }));
  p.add(
    new DiagnosticsProperty('titleAlignment', tile.titleAlignment, {
      defaultValue: null,
      typeName: 'ListTileTitleAlignment',
    }),
  );
}
