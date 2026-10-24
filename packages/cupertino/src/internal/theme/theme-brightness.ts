// SPDX-License-Identifier: BSD-3-Clause
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
type Reader = (context: BuildContext) => 'light' | 'dark' | null;
let themeReader: Reader | null = null;
/** Keep generated dynamic colors independent of Theme's palette initialization. */
export function registerCupertinoThemeBrightnessReader(reader: Reader): void {
    themeReader = reader;
}
export function cupertinoThemeBrightness(context: BuildContext): 'light' | 'dark' | null {
    return themeReader === null ? MediaQuery.maybePlatformBrightnessOf(context) : themeReader(context);
}
