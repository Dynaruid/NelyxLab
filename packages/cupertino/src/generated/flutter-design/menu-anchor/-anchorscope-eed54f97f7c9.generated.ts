// W11 Flutter design source eed54f97f7c9346ab101179391cc8fc054e1da685785771f324f0272fe9d8254 SHA256 767f1f6fc024934b87f882176ac315b37b646f8d7beb180080d80f66e06b2e24
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/menu_anchor.dart; SHA256 344e74d347a155a7d62a8340e7180f071b7bbc4cd2f1fec33b253989b1cba229
import { Widget } from "@nelyx/core/framework/widgets/framework";
import { InheritedWidget } from "@nelyx/core/framework/widgets/framework";
import { protect } from "@nelyx/core/internal/ui/value-math";
export class _AnchorScope extends InheritedWidget {
    readonly hasLeading: boolean;
    constructor({ hasLeading, child }: {
        readonly hasLeading: boolean;
        readonly child: Widget;
    }) {
        const _initialField0 = hasLeading;
        super(child);
        this.hasLeading = _initialField0;
        protect(this, ["hasLeading"]);
    }
    override updateShouldNotify(oldWidget: _AnchorScope): boolean {
        if (!(oldWidget instanceof _AnchorScope))
            throw new TypeError("Invalid covariant argument: oldWidget");
        return this.hasLeading !== oldWidget.hasLeading;
    }
}
