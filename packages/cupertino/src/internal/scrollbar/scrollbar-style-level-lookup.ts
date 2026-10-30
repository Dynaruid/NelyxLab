// SPDX-License-Identifier: BSD-3-Clause
import type { BuildContext, InheritedWidget } from '@nelyx/core/framework/widgets/framework';
/** The caller supplies its canonical class token; the lookup owns no design class dependency. */
export function sourceStyleLevelOf<T extends InheritedWidget>(
  context: BuildContext,
  type: abstract new (...args: never[]) => T,
): T | null {
  return context.maybeDependOn(type) ?? null;
}
