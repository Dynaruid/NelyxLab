// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/cupertino/app.dart; SHA256 c68733e55f2bcb828c1000c8d27190f1c3cedb03b4f383e74f0d3f908d503f3e
import { invariant } from "@nelyx/core/foundation/errors";
import { FoundationBuildMode } from "@nelyx/core/foundation/constants";
import { Widget } from "@nelyx/core/framework/widgets/framework";
import { ScrollPhysics } from "@nelyx/core/framework/widgets/scroll-physics";
import { ScrollBehavior } from "@nelyx/core/framework/widgets/scroll-configuration";
import { applyDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { captureDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { scrollbarRawObjectEquals } from "@nelyx/core/internal/framework/widgets/scrollbar-raw-source-adapter";
import { stretchConstBouncing } from "@nelyx/core/internal/framework/widgets/stretch-source-adapter";
import { SourceCupertinoScrollbar } from "../scrollbar/scrollbar.generated.ts";
import { BouncingScrollPhysics } from "@nelyx/core/framework/widgets/scroll-physics";
import { ScrollDecelerationRate } from "@nelyx/core/framework/widgets/scroll-physics";
import { sourceScrollBehaviorType } from "@nelyx/core/internal/framework/widgets/scroll-behavior-source-adapter";
import { MultitouchDragStrategy } from "@nelyx/core/framework/gestures/recognizer";
import type { BuildContext } from "@nelyx/core/framework/widgets/framework";
import type { ScrollableDetails } from "@nelyx/core/framework/widgets/scrollable-helpers";
export class CupertinoScrollBehavior extends ScrollBehavior {
    constructor() {
        super();
        captureDartType(this, applyDartType<CupertinoScrollBehavior>(CupertinoScrollBehavior, "CupertinoScrollBehavior", [], [sourceScrollBehaviorType]));
    }
    override buildScrollbar(context: BuildContext, child: Widget, details: ScrollableDetails): Widget {
        switch (this.getPlatform(context)) {
            case "linux":
            case "macOS":
            case "windows": {
                if (FoundationBuildMode.debug)
                    invariant(details.controller !== null, "generated-source-assert", "Pinned Dart assertion failed");
                return new SourceCupertinoScrollbar({ controller: details.controller, child: child });
                break;
            }
            case "android":
            case "fuchsia":
            case "iOS": {
                return child;
                break;
            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
    }
    override buildOverscrollIndicator(context: BuildContext, child: Widget, details: ScrollableDetails): Widget {
        return child;
    }
    override getScrollPhysics(context: BuildContext): ScrollPhysics {
        if (scrollbarRawObjectEquals(this.getPlatform(context), "macOS")) {
            return stretchConstBouncing(BouncingScrollPhysics, { decelerationRate: ScrollDecelerationRate.fast });
        }
        return stretchConstBouncing(BouncingScrollPhysics, {});
    }
    override getMultitouchDragStrategy(context: BuildContext): MultitouchDragStrategy {
        return MultitouchDragStrategy.averageBoundaryPointers;
    }
}
