// W11 Flutter design source c979808c0eca1ee03e2cc92566eefe3285bea098c92802677e98170675ed47bb SHA256 6abd0266e0eb61e0d24dfa95dde02551e94fe6dde11d883febd605c68fe00911
// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/dialog.dart; SHA256 415bfeeb313f3ddbf617ac1d0dd55eff8539a1fb9e4a5e8e0a02a08ef8823d71
export abstract class _SlideTarget {
    constructor() {
    }
    abstract didEnter(options: {
        readonly fromPointerDown: boolean;
        readonly innerEnabled: boolean;
    }): boolean;
    abstract didLeave(): void;
    abstract didConfirm(): void;
}
