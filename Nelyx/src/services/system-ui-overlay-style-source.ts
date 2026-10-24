// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Own immutable platform payload projection of source-private _toMap.
import type { SystemUiOverlayStyle } from "./system-ui-overlay-style.ts";
export interface SystemUiOverlayStylePlatformMap {
    /** @dartType int? */
    readonly systemNavigationBarColor: number | null;
    /** @dartType int? */
    readonly systemNavigationBarDividerColor: number | null;
    readonly systemStatusBarContrastEnforced: boolean | null;
    /** @dartType int? */
    readonly statusBarColor: number | null;
    readonly statusBarBrightness: string | null;
    readonly statusBarIconBrightness: string | null;
    readonly systemNavigationBarIconBrightness: string | null;
    readonly systemNavigationBarContrastEnforced: boolean | null;
}
export function systemUiOverlayStyleToPlatformMap(value: SystemUiOverlayStyle): SystemUiOverlayStylePlatformMap {
    return Object.freeze({
        systemNavigationBarColor: value.systemNavigationBarColor?.toARGB32() ?? null,
        systemNavigationBarDividerColor: value.systemNavigationBarDividerColor?.toARGB32() ?? null,
        systemStatusBarContrastEnforced: value.systemStatusBarContrastEnforced,
        statusBarColor: value.statusBarColor?.toARGB32() ?? null,
        statusBarBrightness: value.statusBarBrightness === null ? null : "Brightness." + value.statusBarBrightness,
        statusBarIconBrightness: value.statusBarIconBrightness === null ? null : "Brightness." + value.statusBarIconBrightness,
        systemNavigationBarIconBrightness: value.systemNavigationBarIconBrightness === null ? null : "Brightness." + value.systemNavigationBarIconBrightness,
        systemNavigationBarContrastEnforced: value.systemNavigationBarContrastEnforced,
    });
}
