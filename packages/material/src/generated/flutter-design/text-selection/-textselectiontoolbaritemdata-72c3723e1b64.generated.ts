// W11 Flutter design source 72c3723e1b645a9b147302546d5b1628ebbe1626bcd6b9b5ba3bbdf90d64de38 SHA256 67ec4aa62b50514d9ac0061d45245689ad5f4c392df429894bf0ee5462997cd3
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/text_selection.dart; SHA256 4bdf006ebc419997a64324b265e84545d4a8450714f906b88e8092509bcf5e22
import { protect } from "@nelyx/core/internal/ui/value-math";
export class _TextSelectionToolbarItemData {
    readonly label: string;
    readonly onPressed: () => void;
    constructor({ label, onPressed }: {
        readonly label: string;
        readonly onPressed: () => void;
    }) {
        const _initialField0 = label;
        const _initialField1 = onPressed;
        this.label = _initialField0;
        this.onPressed = _initialField1;
        protect(this, ["label", "onPressed"]);
    }
}
