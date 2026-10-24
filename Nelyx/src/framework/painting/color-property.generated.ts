// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/painting/colors.dart; SHA256 2108e8a3baddd463511e696b712420c08dd53a5510facc3fed44f455abd5a92d
import { boxSourceDartInt } from "../../foundation/dart-numeric.ts";
import { checkedInteger } from "../../ui/value-math.ts";
import { Color } from "../../ui/color.ts";
import { kNoDefaultValue } from "../../foundation/diagnostics.ts";
import { DiagnosticsSerializationDelegate } from "../../foundation/diagnostics-serialization.ts";
import { SourceColorPropertyBase } from "./color-property-source-adapter.ts";
import { sourceStyleJsonWrite } from "./color-property-source-adapter.ts";
import { sourceStyleJsonMap } from "./color-property-source-adapter.ts";
import type { SourceJsonMap } from "./color-property-source-adapter.ts";
import type { DiagnosticLevel } from "../../foundation/diagnostics.ts";
import type { DiagnosticsTreeStyle } from "../../foundation/diagnostics.ts";
export class ColorProperty extends SourceColorPropertyBase<Color> {
    constructor(name: string, value: Color | null, { showName = true, defaultValue = kNoDefaultValue, style = "singleLine", level = "info" }: {
        readonly showName?: boolean;
        readonly defaultValue?: {} | null;
        readonly style?: DiagnosticsTreeStyle;
        readonly level?: DiagnosticLevel;
    } = {}) {
        super(name, value, { showName: showName, defaultValue: defaultValue, style: style, level: level });
    }
    override toSourceJsonMap(delegate: DiagnosticsSerializationDelegate): SourceJsonMap<string, {} | null> {
        const json: SourceJsonMap<string, {} | null> = super.toSourceJsonMap(delegate);
        if (this.value !== null) {
            (() => {
                const _dartTemporary2 = json;
                const _dartTemporary0 = "valueProperties";
                const _dartTemporary1 = (() => {
                    const _dartTemporary4 = "red";
                    const _dartTemporary5 = boxSourceDartInt(checkedInteger((() => {
                        const _dartTemporary6 = this.value;
                        if (_dartTemporary6 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary6!;
                    })().red));
                    const _dartTemporary7 = "green";
                    const _dartTemporary8 = boxSourceDartInt(checkedInteger((() => {
                        const _dartTemporary9 = this.value;
                        if (_dartTemporary9 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary9!;
                    })().green));
                    const _dartTemporary10 = "blue";
                    const _dartTemporary11 = boxSourceDartInt(checkedInteger((() => {
                        const _dartTemporary12 = this.value;
                        if (_dartTemporary12 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary12!;
                    })().blue));
                    const _dartTemporary13 = "alpha";
                    const _dartTemporary14 = boxSourceDartInt(checkedInteger((() => {
                        const _dartTemporary15 = this.value;
                        if (_dartTemporary15 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary15!;
                    })().alpha));
                    const _dartTemporary3 = sourceStyleJsonMap();
                    _dartTemporary3.set(_dartTemporary4, _dartTemporary5);
                    _dartTemporary3.set(_dartTemporary7, _dartTemporary8);
                    _dartTemporary3.set(_dartTemporary10, _dartTemporary11);
                    _dartTemporary3.set(_dartTemporary13, _dartTemporary14);
                    return _dartTemporary3;
                })();
                sourceStyleJsonWrite(_dartTemporary2, _dartTemporary0, _dartTemporary1);
                return _dartTemporary1;
            })();
        }
        return json;
    }
}
