// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Known pinned _colorSchemeLightM3/_colorSchemeDarkM3 const expressions only.
import {ColorScheme} from '../../color-scheme.ts';
import {Color} from '@nelyx/core/ui/color';
import {constSourceColor} from '@nelyx/core/internal/ui/color-source-adapter';
import type {ColorRole} from '../../color-scheme.ts';
const light=Object.freeze(new ColorScheme()),dark=Object.freeze(new ColorScheme({brightness:'dark'}));
export function defaultMaterialColorScheme(brightness:'light'|'dark'):ColorScheme{return brightness==='dark'?dark:light;}
export function materialSchemeColor(scheme:ColorScheme,role:ColorRole):Color{return scheme===light||scheme===dark?constSourceColor(Color,scheme[role]):new Color(scheme[role]);}
