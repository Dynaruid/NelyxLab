// SPDX-License-Identifier: BSD-3-Clause
// Canonical framework parent projections shared by converted source parts.
import { Widget, StatefulWidget, StatelessWidget, State } from './framework.ts';
import { TickerProviderStateMixin } from './ticker-provider.ts';
import { DiagnosticableTree } from '../../foundation/diagnosticable.ts';
import { widgetStateDiagnosticableType } from './widget-state-diagnostic-source-adapter.ts';
import { applyDartType } from '../../foundation/dart-type-witness.ts';
import type { DartTypeWitness } from '../../foundation/dart-type-witness.ts';
import type { TickerProvider, Ticker } from '../animation/ticker.ts';

const diagnosticTreeType = applyDartType(
  DiagnosticableTree,
  'DiagnosticableTree',
  [],
  [widgetStateDiagnosticableType],
);
export const sourceWidgetType = applyDartType<Widget>(Widget, 'Widget', [], [diagnosticTreeType]);
export const sourceStatefulWidgetType = applyDartType<StatefulWidget>(
  StatefulWidget,
  'StatefulWidget',
  [],
  [sourceWidgetType],
);
export const sourceStatelessWidgetType = applyDartType<StatelessWidget>(
  StatelessWidget,
  'StatelessWidget',
  [],
  [sourceWidgetType],
);
// The source TickerProvider interface has no Core constructor value. This
// abstract identity token supplies no provider/lifecycle implementation.
abstract class TickerProviderWitnessOwner implements TickerProvider {
  abstract createTicker(callback: (elapsed: number) => void): Ticker;
}
const tickerProviderType = applyDartType<TickerProvider>(
  TickerProviderWitnessOwner,
  'TickerProvider',
  [],
  [],
);
export function sourceStateType<W extends StatefulWidget>(
  widget: DartTypeWitness<W>,
): DartTypeWitness<State<W>> {
  return applyDartType(State, 'State', [widget], [widgetStateDiagnosticableType]);
}
export function sourceTickerStateType<W extends StatefulWidget>(
  widget: DartTypeWitness<W>,
): DartTypeWitness<TickerProviderStateMixin<W>> {
  return applyDartType(
    TickerProviderStateMixin,
    'TickerProviderStateMixin',
    [widget],
    [tickerProviderType],
  );
}
