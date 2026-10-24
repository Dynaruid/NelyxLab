// SPDX-License-Identifier: BSD-3-Clause
// Staged module-local factory. The enum is read only when the source constructor
// runs, after both cyclic modules and the nominal registration have initialized.
import {SourceWidgetState} from './widget-state-controller.generated.ts';
import {widgetStateSet} from './widget-state-constraint-source-adapter.ts';
import type {DartSet} from '../../foundation/dart-collections.ts';
export function emptyWidgetStateSet():DartSet<SourceWidgetState>{return widgetStateSet(SourceWidgetState);}
