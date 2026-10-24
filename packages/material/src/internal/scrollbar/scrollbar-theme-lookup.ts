// SPDX-License-Identifier: BSD-3-Clause
import type { BuildContext, InheritedWidget } from "@nelyx/core/framework/widgets/framework";
/** The generated caller supplies its canonical class token without a reverse dependency. */
export function sourceScrollbarThemeOf<T extends InheritedWidget>(context: BuildContext, type: abstract new (...args: never[]) => T): T | null {
    return context.maybeDependOn(type) ?? null;
}
