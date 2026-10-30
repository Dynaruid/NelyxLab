// SPDX-License-Identifier: BSD-3-Clause
import { ScrollBehavior } from './scroll-configuration.ts';
import { applyDartType } from '../../foundation/dart-type-witness.ts';
export const sourceScrollBehaviorType = applyDartType<ScrollBehavior>(
  ScrollBehavior,
  'ScrollBehavior',
  [],
  [],
);
