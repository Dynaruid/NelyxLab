// SPDX-License-Identifier: BSD-3-Clause
// Staged in Core framework/widgets beside the unchanged RawScrollbar producer.
import { Widget, ProxyWidget, InheritedWidget, StatelessWidget, Element } from './framework.ts';
import type { State, StatefulWidget } from './framework.ts';
import { SystemChannelSet } from '../../services/system-channels.ts';
import { invariant } from '../../foundation/errors.ts';
import { InheritedTheme } from './inherited-theme.ts';
import type { Key } from '../../foundation/key.ts';
import { applyDartType } from '../../foundation/dart-type-witness.ts';
import type { DartTypeWitness } from '../../foundation/dart-type-witness.ts';
import {
  scrollbarStatefulType,
  scrollbarStateType,
  scrollbarTickerStateType,
} from './scrollbar-raw-source-adapter.ts';
import { SourceRawScrollbar, SourceRawScrollbarState } from './scrollbar.generated.ts';

export abstract class ScrollbarStatelessHost extends StatelessWidget {
  constructor({ key = null }: { key?: Key | null } = {}) {
    super(key);
  }
}
export abstract class ScrollbarInheritedThemeHost extends InheritedTheme {
  constructor({ key = null, child }: { key?: Key | null; child: Widget }) {
    super(child, key);
  }
}
import { sourceWidgetType as widgetType } from './framework-source-types.ts';
const proxyWidgetType = applyDartType(ProxyWidget, 'ProxyWidget', [], [widgetType]);
const inheritedWidgetType = applyDartType(
  InheritedWidget,
  'InheritedWidget',
  [],
  [proxyWidgetType],
);
export { sourceStatelessWidgetType as scrollbarStatelessType } from './framework-source-types.ts';
export const scrollbarInheritedThemeType = applyDartType<InheritedTheme>(
  InheritedTheme,
  'InheritedTheme',
  [],
  [inheritedWidgetType],
);
export const scrollbarRawWidgetType = applyDartType<SourceRawScrollbar>(
  SourceRawScrollbar,
  'RawScrollbar',
  [],
  [scrollbarStatefulType],
);
export function scrollbarRawStateType<T extends SourceRawScrollbar>(
  type: DartTypeWitness<T>,
): DartTypeWitness<SourceRawScrollbarState<T>> {
  return applyDartType(
    SourceRawScrollbarState,
    'RawScrollbarState',
    [type],
    [scrollbarStateType(type), scrollbarTickerStateType(type)],
  );
}
export async function scrollbarMediumImpact(state: State<StatefulWidget>): Promise<void> {
  invariant(
    state.mounted && state.context instanceof Element,
    'invalid-scrollbar-owner',
    'Scrollbar haptics require their mounted View',
  );
  const services = state.context.services;
  const channel =
    services.platformServices?.channels.platform ??
    (services.binaryMessenger ? new SystemChannelSet(services.binaryMessenger).platform : null);
  invariant(
    channel,
    'missing-scrollbar-haptic-channel',
    'Scrollbar haptics require their View platform channel',
  );
  await channel.invokeMethod('HapticFeedback.vibrate', 'HapticFeedbackType.mediumImpact');
}

/** @dartParam value double
 * @dartReturn double */
export function scrollbarDoubleAbs(value: number): number {
  return Math.abs(value);
}
