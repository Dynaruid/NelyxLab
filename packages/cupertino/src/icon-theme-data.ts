// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { Diagnosticable } from '@nelyx/core/foundation/diagnosticable';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import type { IconThemeDataOptions } from '@nelyx/core/framework/widgets/icon-theme-data';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { CupertinoDynamicColor, createCupertinoColorProperty } from './colors.ts';
export class CupertinoIconThemeData extends Diagnosticable(IconThemeData) {
    constructor(options: IconThemeDataOptions = {}) {
        super(options);
        if (new.target === CupertinoIconThemeData)
            Object.freeze(this);
    }
    override resolve(context: BuildContext): IconThemeData {
        const color = CupertinoDynamicColor.maybeResolve(this.color, context);
        return color === this.color || color?.equals(this.color) ? this : this.copyWith({ color });
    }
    override copyWith(options: IconThemeDataOptions = {}): CupertinoIconThemeData {
        return new CupertinoIconThemeData(super.copyWith(options));
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        properties.add(createCupertinoColorProperty('color', this.color, { defaultValue: null }));
    }
}
