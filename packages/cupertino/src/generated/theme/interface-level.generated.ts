// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/interface_level.dart; SHA256 19f273b1720ae62777159e0094621b7c3ab848ba5e49715bf99e887f523a350d
import { protect } from "@nelyx/core/internal/ui/value-math";
import { Widget } from "@nelyx/core/framework/widgets/framework";
import { DiagnosticPropertiesBuilder } from "@nelyx/core/foundation/diagnostics";
import { FlutterError } from "@nelyx/core/foundation/flutter-error";
import { sourceStyleString } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { SourceStyleInheritedHost } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import { sourceStyleLevelOf } from "../../internal/scrollbar/scrollbar-style-level-lookup.ts";
import { sourceStyleEnumProperty } from "../../internal/scrollbar/scrollbar-style-source-adapter.ts";
import type { BuildContext } from "@nelyx/core/framework/widgets/framework";
import type { Key } from "@nelyx/core/foundation/key";
const _dartTemporary0 = Symbol();
export class CupertinoUserInterfaceLevelData {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly index: number;
    private readonly _dartTemporary1!: void;
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    private constructor(index: number, readonly name: string, token: typeof _dartTemporary0) {
        if (token !== _dartTemporary0)
            throw new TypeError("Enum values cannot be constructed");
        this.index = index;
        Object.freeze(this);
    }
    static readonly base: CupertinoUserInterfaceLevelData = new CupertinoUserInterfaceLevelData(0, "base", _dartTemporary0);
    static readonly elevated: CupertinoUserInterfaceLevelData = new CupertinoUserInterfaceLevelData(1, "elevated", _dartTemporary0);
    static readonly values: ReadonlyArray<CupertinoUserInterfaceLevelData> = Object.freeze([CupertinoUserInterfaceLevelData.base, CupertinoUserInterfaceLevelData.elevated]);
    toString(): string {
        return "CupertinoUserInterfaceLevelData." + this.name;
    }
}
Object.freeze(CupertinoUserInterfaceLevelData.prototype);
Object.freeze(CupertinoUserInterfaceLevelData);
export class CupertinoUserInterfaceLevel extends SourceStyleInheritedHost {
    readonly _dart_90a66f31938a3323_data: CupertinoUserInterfaceLevelData;
    constructor({ key = null, data, child }: {
        readonly key?: Key | null;
        readonly data: CupertinoUserInterfaceLevelData;
        readonly child: Widget;
    }) {
        const _initialField0 = data;
        super({ key: key, child: child });
        this._dart_90a66f31938a3323_data = _initialField0;
        protect(this, ["_dart_90a66f31938a3323_data"]);
    }
    override updateShouldNotify(oldWidget: CupertinoUserInterfaceLevel): boolean {
        if (!(oldWidget instanceof CupertinoUserInterfaceLevel))
            throw new TypeError("Invalid covariant argument: oldWidget");
        return !(oldWidget._dart_90a66f31938a3323_data === this._dart_90a66f31938a3323_data);
    }
    static of(context: BuildContext): CupertinoUserInterfaceLevelData {
        const query: CupertinoUserInterfaceLevel | null = sourceStyleLevelOf(context, CupertinoUserInterfaceLevel);
        if (query !== null) {
            return (query as CupertinoUserInterfaceLevel)._dart_90a66f31938a3323_data;
        }
        (() => {
            const _dartTemporary2 = new FlutterError(`CupertinoUserInterfaceLevel.of() called with a context that does not contain a CupertinoUserInterfaceLevel.
No CupertinoUserInterfaceLevel ancestor could be found starting from the context that was passed to CupertinoUserInterfaceLevel.of(). This can happen because you do not have a WidgetsApp or MaterialApp widget (those widgets introduce a CupertinoUserInterfaceLevel), or it can happen if the context you use comes from a widget above those widgets.
The context used was:
  ${sourceStyleString(context)}`);
            throw _dartTemporary2;
        })();
    }
    static maybeOf(context: BuildContext): CupertinoUserInterfaceLevelData | null {
        const query: CupertinoUserInterfaceLevel | null = sourceStyleLevelOf(context, CupertinoUserInterfaceLevel);
        return (() => {
            const _dartTemporary3 = query;
            return _dartTemporary3 === null ? null : _dartTemporary3._dart_90a66f31938a3323_data;
        })();
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        properties.add(sourceStyleEnumProperty("user interface level", this._dart_90a66f31938a3323_data));
    }
}
