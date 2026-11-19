// W11 Flutter design source 34590772dc769cb4fdc4e06e2d4ccdabc3aeea319b0f7ef766c9fbc8c708577e SHA256 1979eb2a47e0fa365d7862a8670aca8476838446f8e68c77498f1a19fd9611e0
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/material/popup_menu.dart; SHA256 3a19dec1c1f8b8d6b88adcf1c832bef50e91f86da1b891ab075c53f38d88020d
import { StatefulWidget } from "@nelyx/core/framework/widgets/framework";
import type { Key } from "@nelyx/core/foundation/key";
export abstract class PopupMenuEntry<T extends {} | null> extends StatefulWidget {
    constructor({ key = null }: {
        readonly key?: Key | null;
    } = {}) {
        super(key);
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    abstract get height(): number;
    abstract represents(value: T | null): boolean;
}
