// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter packages/flutter/lib/src/material/material_state_mixin.dart
// at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { State } from '@nelyx/core/framework/widgets/framework';
import type { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { WidgetState, emptyWidgetStateSet } from '@nelyx/core/framework/widgets/widget-state';

export abstract class MaterialStateMixin<
  W extends StatefulWidget = StatefulWidget,
> extends State<W> {
  protected materialStates = emptyWidgetStateSet();

  protected updateMaterialState(
    state: WidgetState,
    { onChanged }: { readonly onChanged?: (value: boolean) => void } = {},
  ): (active: boolean) => void {
    return (active) => {
      if (this.materialStates.contains(state) === active) return;
      this.setMaterialState(state, active);
      onChanged?.(active);
    };
  }

  protected setMaterialState(state: WidgetState, active: boolean): void {
    if (active) this.addMaterialState(state);
    else this.removeMaterialState(state);
  }

  protected addMaterialState(state: WidgetState): void {
    if (this.materialStates.add(state)) this.setState(() => {});
  }

  protected removeMaterialState(state: WidgetState): void {
    if (this.materialStates.remove(state)) this.setState(() => {});
  }

  get isDisabled(): boolean {
    return this.materialStates.contains(WidgetState.disabled);
  }
  get isDragged(): boolean {
    return this.materialStates.contains(WidgetState.dragged);
  }
  get isErrored(): boolean {
    return this.materialStates.contains(WidgetState.error);
  }
  get isFocused(): boolean {
    return this.materialStates.contains(WidgetState.focused);
  }
  get isHovered(): boolean {
    return this.materialStates.contains(WidgetState.hovered);
  }
  get isPressed(): boolean {
    return this.materialStates.contains(WidgetState.pressed);
  }
  get isScrolledUnder(): boolean {
    return this.materialStates.contains(WidgetState.scrolledUnder);
  }
  get isSelected(): boolean {
    return this.materialStates.contains(WidgetState.selected);
  }

  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new DiagnosticsProperty('materialStates', this.materialStates, {
        defaultValue: emptyWidgetStateSet(),
      }),
    );
  }
}
