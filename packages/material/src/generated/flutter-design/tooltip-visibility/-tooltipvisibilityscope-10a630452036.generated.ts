// W11 Flutter design source 10a630452036df34cc5f4ff158ca92cec1de5531d24af31e62c3db756a5b42a8 SHA256 e0c3eca2b52c69ee139d83c1c19d198fe2304105c35dfdda945824ae0cecb898
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/tooltip_visibility.dart; SHA256 1151bc9ad25c0a20b609abc99187289dd53c178aef349a586182928ff93fb2e7
import { Widget } from "@nelyx/core/framework/widgets/framework";
import { InheritedWidget } from "@nelyx/core/framework/widgets/framework";
import { protect } from "@nelyx/core/internal/ui/value-math";
export class _TooltipVisibilityScope extends InheritedWidget {
    readonly visible: boolean;
    constructor({ child, visible }: {
        readonly child: Widget;
        readonly visible: boolean;
    }) {
        const _initialField0 = visible;
        super(child);
        this.visible = _initialField0;
        protect(this, ["visible"]);
    }
    override updateShouldNotify(old: _TooltipVisibilityScope): boolean {
        if (!(old instanceof _TooltipVisibilityScope))
            throw new TypeError("Invalid covariant argument: old");
        return old.visible !== this.visible;
    }
}
