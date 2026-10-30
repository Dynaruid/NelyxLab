// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adopted M3-only port from packages/flutter/lib/src/material/app.dart; SHA256 f52607c80ff30a26709916fff8e6c9a5cbc4bd4377b75410f5241ea9697d1bc9
import { invariant } from "@nelyx/core/foundation/errors";
import { FoundationBuildMode } from "@nelyx/core/foundation/constants";
import { Widget } from "@nelyx/core/framework/widgets/framework";
import { Axis } from "@nelyx/core/framework/painting/basic-types";
import { ScrollBehavior } from "@nelyx/core/framework/widgets/scroll-configuration";
import { axisDirectionToAxis } from "@nelyx/core/framework/painting/basic-types";
import { applyDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { captureDartType } from "@nelyx/core/internal/foundation/dart-type-witness";
import { StretchingOverscrollIndicator } from "@nelyx/core/internal/framework/widgets/stretching-overscroll-indicator.generated";
import { SourceScrollbar } from "../scrollbar/scrollbar.generated.ts";
import { ScrollbarMaterialTheme } from "../../internal/scrollbar/scrollbar-source-adapter.ts";
import { sourceScrollBehaviorType } from "@nelyx/core/internal/framework/widgets/scroll-behavior-source-adapter";
import { stretchGlow } from "@nelyx/core/internal/framework/widgets/stretch-source-adapter";
import type { BuildContext } from "@nelyx/core/framework/widgets/framework";
import type { TargetPlatform } from "@nelyx/core/foundation/platform";
import type { ScrollableDetails } from "@nelyx/core/framework/widgets/scrollable-helpers";
export class MaterialScrollBehavior extends ScrollBehavior {
    constructor() {
        super();
        captureDartType(this, applyDartType<MaterialScrollBehavior>(MaterialScrollBehavior, "MaterialScrollBehavior", [], [sourceScrollBehaviorType]));
    }
    override getPlatform(context: BuildContext): TargetPlatform {
        return ScrollbarMaterialTheme.of(context).platform;
    }
    override buildScrollbar(context: BuildContext, child: Widget, details: ScrollableDetails): Widget {
        switch (axisDirectionToAxis(details.direction)) {
            case Axis.horizontal: {
                return child;

            }
            case Axis.vertical: {
                switch (this.getPlatform(context)) {
                    case "linux":
                    case "macOS":
                    case "windows": {
                        if (FoundationBuildMode.debug)
                            invariant(details.controller !== null, "generated-source-assert", "Pinned Dart assertion failed");
                        return new SourceScrollbar({ controller: details.controller, child: child });

                    }
                    case "android":
                    case "fuchsia":
                    case "iOS": {
                        return child;

                    }
                    default: throw new TypeError("Invalid value outside exhaustive Dart switch");
                }

            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
    }
    override buildOverscrollIndicator(context: BuildContext, child: Widget, details: ScrollableDetails): Widget {
        switch (this.getPlatform(context)) {
            case "iOS":
            case "linux":
            case "macOS":
            case "windows": {
                return child;

            }
            case "android": {
                return new StretchingOverscrollIndicator({ axisDirection: details.direction, clipBehavior: details.clipBehavior ?? "hardEdge", child: child });
            }
            case "fuchsia": {
                break;

            }
            default: throw new TypeError("Invalid value outside exhaustive Dart switch");
        }
        return stretchGlow({ axisDirection: details.direction, color: ScrollbarMaterialTheme.of(context).colorScheme.secondary, child: child });
    }
}
