// SPDX-License-Identifier: BSD-3-Clause
// Source generic APIs require explicit runtime type witnesses at erased boundaries.
export {
  SourceWidgetStatesConstraint as WidgetStatesConstraint,
  SourceWidgetState as WidgetState,
  SourceWidgetStateProperty as WidgetStateProperty,
  SourceWidgetStateMapper as WidgetStateMapper,
  SourceWidgetStatePropertyAll as WidgetStatePropertyAll,
  SourceWidgetStatesController as WidgetStatesController,
  sourceConstWidgetStatePropertyFromMap,
  sourceConstWidgetStateMapper,
  sourceConstWidgetStatePropertyAll,
  emptyWidgetStateSet,
} from './widget-state.generated.ts';

export { WidgetStateBorderSide } from './widget-state-border-side.ts';
export { WidgetStateColor } from './widget-state-color.ts';
export { WidgetStateMouseCursor } from './widget-state-mouse-cursor.ts';
export { WidgetStateTextStyle } from './widget-state-text-style.ts';
