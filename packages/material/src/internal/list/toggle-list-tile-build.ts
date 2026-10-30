// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// ListTile owns ink/layout/focus; the embedded control owns pointer and visual state.
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { MergeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { Transform } from '@nelyx/core/framework/widgets/basic';
import { Color } from '@nelyx/core/ui/color';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import { emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';
import { ListTile, ListTileControlAffinity } from '../../list-tile.ts';
import type { ListTileOptions } from '../../list-tile.ts';
import { ListTileTheme } from '../../list-tile-theme.ts';
import { Theme } from '../../theme.ts';
import { Checkbox } from '../../checkbox.ts';
import { CheckboxTheme } from '../../checkbox-theme.ts';
import { Switch } from '../../switch.ts';
import { SwitchTheme } from '../../switch-theme.ts';
import { MaterialTapTargetSize } from '../../theme-data.ts';
import type { CheckboxListTile } from '../../checkbox-list-tile.ts';
import type { SwitchListTile } from '../../switch-list-tile.ts';

type TileSource = Required<
  Pick<
    ListTileOptions,
    | 'title'
    | 'subtitle'
    | 'isThreeLine'
    | 'dense'
    | 'contentPadding'
    | 'selected'
    | 'selectedTileColor'
    | 'tileColor'
    | 'autofocus'
    | 'shape'
    | 'visualDensity'
    | 'focusNode'
    | 'statesController'
    | 'onFocusChange'
    | 'enableFeedback'
    | 'horizontalTitleGap'
    | 'minVerticalPadding'
    | 'minLeadingWidth'
    | 'minTileHeight'
    | 'internalAddSemanticForOnTap'
  >
> & {
  readonly titleAlignment?: ListTileOptions['titleAlignment'];
  readonly secondary: Widget | null;
  readonly controlAffinity: ListTileControlAffinity | null;
  readonly options: { readonly id?: string };
};
export function toggleTileStates(selected: boolean) {
  const states = emptyWidgetStateSet();
  if (selected) states.add(WidgetState.selected);
  return states;
}
export function composeToggleTile(
  tile: TileSource,
  context: BuildContext,
  control: Widget,
  enabled: boolean,
  onTap: (() => void) | null,
  selectedColor: Color,
  platformLeading = false,
  focusNode: FocusNode | null = tile.focusNode ?? null,
  hoverColor: Color | null = null,
): Widget {
  const affinity =
    tile.controlAffinity ??
    ListTileTheme.of(context).controlAffinity ??
    ListTileControlAffinity.platform;
  const leadingControl =
    affinity === ListTileControlAffinity.leading ||
    (platformLeading && affinity === ListTileControlAffinity.platform);
  const merged = new MergeSemantics({
    child: new ListTile({
      ...(tile.options.id === undefined ? {} : { id: tile.options.id }),
      selectedColor,
      leading: leadingControl ? control : tile.secondary,
      trailing: leadingControl ? tile.secondary : control,
      title: tile.title,
      subtitle: tile.subtitle,
      isThreeLine: tile.isThreeLine,
      dense: tile.dense,
      enabled,
      onTap,
      selected: tile.selected,
      autofocus: tile.autofocus,
      contentPadding: tile.contentPadding,
      shape: tile.shape,
      selectedTileColor: tile.selectedTileColor,
      tileColor: tile.tileColor,
      visualDensity: tile.visualDensity,
      focusNode,
      statesController: tile.statesController,
      onFocusChange: tile.onFocusChange,
      enableFeedback: tile.enableFeedback,
      horizontalTitleGap: tile.horizontalTitleGap,
      minVerticalPadding: tile.minVerticalPadding,
      minLeadingWidth: tile.minLeadingWidth,
      minTileHeight: tile.minTileHeight,
      titleAlignment: tile.titleAlignment ?? null,
      internalAddSemanticForOnTap: tile.internalAddSemanticForOnTap,
      hoverColor,
    }),
  });
  // Nelyx's explicit identifier belongs to the merged accessible control.
  return tile.options.id === undefined
    ? merged
    : new Semantics({ transportId: tile.options.id, identifier: tile.options.id, child: merged });
}
export function buildCheckboxListTile(
  tile: CheckboxListTile,
  context: BuildContext,
  adaptive: boolean,
): Widget {
  const create = adaptive
    ? Checkbox.adaptive
    : (options: ConstructorParameters<typeof Checkbox>[0]) => new Checkbox(options);
  let control: Widget = new ExcludeFocus(
    create({
      value: tile.value,
      onChanged: tile.enabled === false ? null : tile.onChanged,
      mouseCursor: tile.mouseCursor,
      activeColor: tile.activeColor,
      fillColor: tile.fillColor,
      checkColor: tile.checkColor,
      hoverColor: tile.hoverColor,
      overlayColor: tile.overlayColor,
      splashRadius: tile.splashRadius,
      materialTapTargetSize: tile.materialTapTargetSize ?? MaterialTapTargetSize.shrinkWrap,
      autofocus: tile.autofocus,
      tristate: tile.tristate,
      shape: tile.checkboxShape,
      side: tile.side,
      isError: tile.isError,
      semanticLabel: tile.checkboxSemanticLabel,
    }),
  );
  if (tile.checkboxScaleFactor !== 1)
    control = Transform.scale(control, { scale: tile.checkboxScaleFactor });
  const selectedColor =
    tile.activeColor ??
    CheckboxTheme.of(context).fillColor?.resolve(toggleTileStates(tile.selected)) ??
    new Color(Theme.of(context).colorScheme.secondary);
  const onTap =
    tile.onChanged === null
      ? null
      : () =>
          tile.onChanged!(
            tile.value === false
              ? true
              : tile.value === true
                ? tile.tristate
                  ? null
                  : false
                : false,
          );
  return composeToggleTile(
    tile,
    context,
    control,
    tile.enabled ?? tile.onChanged !== null,
    onTap,
    selectedColor,
  );
}
export function buildSwitchListTile(
  tile: SwitchListTile,
  context: BuildContext,
  adaptive: boolean,
): Widget {
  const options = {
    value: tile.value,
    onChanged: tile.onChanged,
    activeThumbColor: tile.activeThumbColor,
    activeTrackColor: tile.activeTrackColor,
    inactiveThumbColor: tile.inactiveThumbColor,
    inactiveTrackColor: tile.inactiveTrackColor,
    activeThumbImage: tile.activeThumbImage,
    inactiveThumbImage: tile.inactiveThumbImage,
    onActiveThumbImageError: tile.onActiveThumbImageError,
    onInactiveThumbImageError: tile.onInactiveThumbImageError,
    thumbColor: tile.thumbColor,
    trackColor: tile.trackColor,
    trackOutlineColor: tile.trackOutlineColor,
    thumbIcon: tile.thumbIcon,
    materialTapTargetSize: tile.materialTapTargetSize ?? MaterialTapTargetSize.shrinkWrap,
    autofocus: tile.autofocus,
    onFocusChange: tile.onFocusChange,
    dragStartBehavior: tile.dragStartBehavior,
    mouseCursor: tile.mouseCursor,
    splashRadius: tile.splashRadius,
    overlayColor: tile.overlayColor,
  };
  const control = new ExcludeFocus(
    adaptive
      ? Switch.adaptive({ ...options, applyCupertinoTheme: tile.applyCupertinoTheme })
      : new Switch(options),
  );
  const selectedColor =
    tile.activeThumbColor ??
    SwitchTheme.of(context).thumbColor?.resolve(toggleTileStates(tile.selected)) ??
    new Color(Theme.of(context).colorScheme.secondary);
  return composeToggleTile(
    tile,
    context,
    control,
    tile.onChanged !== null,
    tile.onChanged === null ? null : () => tile.onChanged!(!tile.value),
    selectedColor,
    false,
    tile.focusNode,
    tile.hoverColor,
  );
}
