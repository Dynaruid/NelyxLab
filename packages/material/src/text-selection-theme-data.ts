// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {lerpArgb} from "@nelyx/core/ui/color-values";


export interface TextSelectionThemeDataOptions {
    readonly cursorColor?: number | null;
    readonly selectionColor?: number | null;
    readonly selectionHandleColor?: number | null;
}

export class TextSelectionThemeData {
    readonly cursorColor: number | null;
    readonly selectionColor: number | null;
    readonly selectionHandleColor: number | null;
    constructor({ cursorColor = null, selectionColor = null, selectionHandleColor = null }: TextSelectionThemeDataOptions = {}) {
        this.cursorColor = cursorColor;
        this.selectionColor = selectionColor;
        this.selectionHandleColor = selectionHandleColor;
        Object.freeze(this);
    }
    copyWith(options: TextSelectionThemeDataOptions = {}): TextSelectionThemeData {
        return new TextSelectionThemeData({
            cursorColor: options.cursorColor ?? this.cursorColor, selectionColor: options.selectionColor ?? this.selectionColor, selectionHandleColor: options.selectionHandleColor ?? this.selectionHandleColor
        });
    }
    static lerp(a: TextSelectionThemeData | null, b: TextSelectionThemeData | null, t: number): TextSelectionThemeData {
        if (a === b && a !== null)
            return a;
        return new TextSelectionThemeData({
            cursorColor: lerpArgb(a?.cursorColor ?? null, b?.cursorColor ?? null, t), selectionColor: lerpArgb(a?.selectionColor ?? null, b?.selectionColor ?? null, t), selectionHandleColor: lerpArgb(a?.selectionHandleColor ?? null, b?.selectionHandleColor ?? null, t)
        });
    }
    equals(other: unknown): boolean {
        return other instanceof TextSelectionThemeData && other.cursorColor === this.cursorColor && other.selectionColor === this.selectionColor && other.selectionHandleColor === this.selectionHandleColor;
    }
}