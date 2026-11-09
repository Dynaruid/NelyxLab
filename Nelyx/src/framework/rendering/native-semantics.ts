// SPDX-License-Identifier: BSD-3-Clause
import {
  SemanticsConfiguration,
  SemanticsProperties,
  OrdinalSortKey,
  CustomSemanticsAction,
  SemanticsHintOverrides,
} from '../semantics/semantics.ts';
import { SemanticsAction } from '../../ui/semantics-action.ts';
import { SemanticsRole } from '../../ui/semantics.ts';
import { nativeSemanticsRange } from './semantics-transport.ts';
import type { RenderSemanticsAnnotations } from './semantics-annotations.ts';

export interface NativeSemanticsAction {
  readonly id: number;
  readonly label: string;
  readonly hint?: string;
  readonly overrideAction?: number;
  readonly invokable: boolean;
  readonly hintOverride: boolean;
}
export interface NativeSemanticsMetadata {
  readonly kind: 'semantics';
  readonly source: RenderSemanticsAnnotations;
  readonly configuration: SemanticsConfiguration;
  readonly sortKey: { readonly order: number; readonly name: string | null } | null;
  readonly customActions: readonly NativeSemanticsAction[];
}
const defaults = new SemanticsProperties();
const fields = new Set([
  'enabled',
  'checked',
  'mixed',
  'role',
  'inMutuallyExclusiveGroup',
  'toggled',
  'selected',
  'button',
  'link',
  'textField',
  'slider',
  'readOnly',
  'hidden',
  'liveRegion',
  'scopesRoute',
  'namesRoute',
  'identifier',
  'hint',
  'tooltip',
  'textDirection',
  'onTap',
  'onLongPress',
  'onFocus',
  'onIncrease',
  'onDecrease',
  'focusable',
  'focused',
  'label',
  'value',
  'increasedValue',
  'decreasedValue',
  'sortKey',
  'customSemanticsActions',
  'hintOverrides',
  // Inline placement is validated by the owning paragraph bridge.
  'tagForChildren',
]);
/** Source policy capture only; Core assembles fragments and orders published geometry. */
export function nativeSemanticsMetadata(
  source: RenderSemanticsAnnotations,
  describe: RenderSemanticsAnnotations['describeSemanticsConfiguration'],
): NativeSemanticsMetadata {
  const properties = source.properties,
    progress = properties.role === SemanticsRole.progressBar,
    loading = properties.role === SemanticsRole.loadingSpinner,
    range = nativeSemanticsRange(source);
  if (
    Object.getPrototypeOf(properties) !== SemanticsProperties.prototype ||
    source.describeSemanticsConfiguration !== describe ||
    Object.hasOwn(source, 'describeSemanticsConfiguration') ||
    source.localeForSubtree
  )
    throw Error('Custom native semantics configuration');
  for (const key of Object.keys(properties) as (keyof SemanticsProperties)[])
    if (
      !fields.has(key) &&
      !(
        (key === 'minValue' || key === 'maxValue') &&
        progress &&
        range.range &&
        properties[key] === String(key === 'minValue' ? range.range.min : range.range.max)
      ) &&
      properties[key] !== defaults[key]
    )
      throw Error('Unsupported native semantics property: ' + key);
  if (
    properties.role != null &&
    properties.role !== SemanticsRole.none &&
    properties.role !== SemanticsRole.radioGroup &&
    !progress &&
    !loading
  )
    throw Error('Unsupported native semantics role');
  const configuration = new SemanticsConfiguration();
  describe.call(source, configuration);
  const key = configuration.sortKey;
  if (
    key &&
    (Object.getPrototypeOf(key) !== OrdinalSortKey.prototype ||
      ['compareTo', 'doCompare'].some((name) => Object.hasOwn(key, name)) ||
      !Number.isFinite((key as OrdinalSortKey).order))
  )
    throw Error('Custom native semantics sort key');
  const customActions: NativeSemanticsAction[] = [];
  const append = (action: CustomSemanticsAction, invokable: boolean, hintOverride = false) => {
    if (Object.getPrototypeOf(action) !== CustomSemanticsAction.prototype)
      throw Error('Custom native semantics action identity');
    const value = {
      id: CustomSemanticsAction.getIdentifier(action),
      label: action.label ?? '',
      invokable,
      hintOverride,
      ...(action.hint === null ? {} : { hint: action.hint }),
      ...(action.action === null ? {} : { overrideAction: action.action.index }),
    };
    const previous = customActions.findIndex((entry) => entry.id === value.id);
    if (previous < 0) customActions.push(value);
    else
      customActions[previous] = {
        ...value,
        invokable: invokable || customActions[previous]!.invokable,
        hintOverride: hintOverride || customActions[previous]!.hintOverride,
      };
  };
  for (const action of configuration.customSemanticsActions.keys()) append(action, true);
  const hints = properties.hintOverrides;
  if (hints) {
    if (Object.getPrototypeOf(hints) !== SemanticsHintOverrides.prototype)
      throw Error('Custom native semantics hint identity');
    if (hints.onTapHint)
      append(
        CustomSemanticsAction.overridingAction({
          hint: hints.onTapHint,
          action: SemanticsAction.tap,
        }),
        false,
        true,
      );
    if (hints.onLongPressHint)
      append(
        CustomSemanticsAction.overridingAction({
          hint: hints.onLongPressHint,
          action: SemanticsAction.longPress,
        }),
        false,
        true,
      );
  }
  return {
    kind: 'semantics',
    source,
    configuration,
    sortKey: key ? { order: (key as OrdinalSortKey).order, name: key.name } : null,
    customActions: customActions.sort((a, b) => a.id - b.id),
  };
}
