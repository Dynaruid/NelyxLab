// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Standard and adaptive constructor APIs projected from resolved Flutter IR.
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import type { ControlInteractionOptions } from '@nelyx/core/framework/widgets/control-interaction';
import type { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import type { Color } from '@nelyx/core/ui/color';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import type { OutlinedBorder, BorderSide } from '@nelyx/core/framework/painting/borders';
import type { MaterialTapTargetSize, VisualDensity } from './theme-data.ts';
import { invariant } from '@nelyx/core/foundation/errors';
import { buildMaterialCheckbox } from './internal/checkbox/checkbox-build.ts';
type InteractionOptions = Pick<
  ControlInteractionOptions,
  | 'key'
  | 'enabled'
  | 'skipTraversal'
  | 'statesController'
  | 'onFocusChange'
  | 'onHover'
  | 'onHighlightChanged'
  | 'onShowFocusHighlight'
  | 'onShowHoverHighlight'
  | 'shortcuts'
  | 'actions'
>;
export interface CheckboxOptions extends InteractionOptions {
  readonly id?: string;
  readonly value: boolean | null;
  readonly tristate?: boolean;
  readonly onChanged: ((value0: boolean | null) => void) | null;
  readonly mouseCursor?: MouseCursor | null;
  readonly activeColor?: Color | null;
  readonly fillColor?: WidgetStateProperty<Color | null> | null;
  readonly checkColor?: Color | null;
  readonly focusColor?: Color | null;
  readonly hoverColor?: Color | null;
  readonly overlayColor?: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */ readonly splashRadius?: number | null;
  readonly materialTapTargetSize?: MaterialTapTargetSize | null;
  readonly visualDensity?: VisualDensity | null;
  readonly focusNode?: FocusNode | null;
  readonly autofocus?: boolean;
  readonly shape?: OutlinedBorder | null;
  readonly side?: BorderSide | null;
  readonly isError?: boolean;
  readonly semanticLabel?: string | null;
}
const adaptiveCheckboxes = new WeakSet<Checkbox>();
export class Checkbox extends StatefulWidget {
  readonly options: Readonly<CheckboxOptions>;
  readonly value: boolean | null;
  readonly onChanged: ((value0: boolean | null) => void) | null;
  readonly mouseCursor: MouseCursor | null;
  readonly activeColor: Color | null;
  readonly fillColor: WidgetStateProperty<Color | null> | null;
  readonly checkColor: Color | null;
  readonly tristate: boolean;
  readonly materialTapTargetSize: MaterialTapTargetSize | null;
  readonly visualDensity: VisualDensity | null;
  readonly focusColor: Color | null;
  readonly hoverColor: Color | null;
  readonly overlayColor: WidgetStateProperty<Color | null> | null;
  /** @dartType double? */ readonly splashRadius: number | null;
  readonly focusNode: FocusNode | null;
  readonly autofocus: boolean;
  readonly shape: OutlinedBorder | null;
  readonly side: BorderSide | null;
  readonly isError: boolean;
  readonly semanticLabel: string | null;
  /** @dartType double */ static readonly width = 18;
  /** @dartParam splashRadius double? */
  constructor(o: CheckboxOptions) {
    super(o.key ?? null);
    invariant(
      Object.keys(o).every((key) =>
        [
          'key',
          'enabled',
          'skipTraversal',
          'statesController',
          'onFocusChange',
          'onHover',
          'onHighlightChanged',
          'onShowFocusHighlight',
          'onShowHoverHighlight',
          'shortcuts',
          'actions',
          'id',
          'value',
          'tristate',
          'onChanged',
          'mouseCursor',
          'activeColor',
          'fillColor',
          'checkColor',
          'focusColor',
          'hoverColor',
          'overlayColor',
          'splashRadius',
          'materialTapTargetSize',
          'visualDensity',
          'focusNode',
          'autofocus',
          'shape',
          'side',
          'isError',
          'semanticLabel',
        ].includes(key),
      ),
      'unsupported-checkbox-option',
      'Unknown standard Checkbox option',
    );
    invariant(
      o.onChanged === null || typeof o.onChanged === 'function',
      'invalid-checkbox-callback',
      'Checkbox requires an explicit nullable callback',
    );
    this.options = Object.freeze({ ...o });
    this.value = o.value;
    this.onChanged = o.onChanged;
    this.mouseCursor = o.mouseCursor ?? null;
    this.activeColor = o.activeColor ?? null;
    this.fillColor = o.fillColor ?? null;
    this.checkColor = o.checkColor ?? null;
    this.tristate = o.tristate ?? false;
    this.materialTapTargetSize = o.materialTapTargetSize ?? null;
    this.visualDensity = o.visualDensity ?? null;
    this.focusColor = o.focusColor ?? null;
    this.hoverColor = o.hoverColor ?? null;
    this.overlayColor = o.overlayColor ?? null;
    this.splashRadius = o.splashRadius ?? null;
    this.focusNode = o.focusNode ?? null;
    this.autofocus = o.autofocus ?? false;
    this.shape = o.shape ?? null;
    this.side = o.side ?? null;
    this.isError = o.isError ?? false;
    this.semanticLabel = o.semanticLabel ?? null;
    invariant(
      typeof this.value === 'boolean' || (this.tristate && this.value === null),
      'invalid-checkbox-value',
      'Null checkbox values require tristate',
    );
  }
  /** @dartParam splashRadius double? */
  static adaptive(o: CheckboxOptions): Checkbox {
    const result = new Checkbox(o);
    adaptiveCheckboxes.add(result);
    return result;
  }
  createState(): State<Checkbox> {
    return new CheckboxState();
  }
}
class CheckboxState extends State<Checkbox> {
  build(context: BuildContext): Widget {
    return buildMaterialCheckbox(this.widget, context, adaptiveCheckboxes.has(this.widget));
  }
}
