// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/list_wheel_scroll_view.dart; SHA256 6e6a545ed8eb253a4980888bbddd67da3989f9c9c218c70816f8ac28eb42484e
// Adopted product owner: nominal checks use the classes declared here.
import { dartMethodTearOff } from "../../foundation/dart-method-tear-off.ts";
import { checkedInteger } from "../../ui/value-math.ts";
import { protect } from "../../ui/value-math.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { invariant } from "../../foundation/errors.ts";
import { ScrollPhysics } from "./scroll-physics.ts";
import { wheelParentData } from "../rendering/list-wheel-renderer-adapter.ts";
import { wheelParent } from "../rendering/list-wheel-renderer-adapter.ts";
import { wheelParentOffset } from "../rendering/list-wheel-renderer-adapter.ts";
import { castWheelBox } from "../rendering/list-wheel-renderer-adapter.ts";
import { RenderBox } from "../rendering/object.ts";
import { RenderObject } from "../rendering/object.ts";
import { castWheelParentData } from "../rendering/list-wheel-viewport.generated.ts";
import { isWheelRenderObject } from "../rendering/list-wheel-renderer-adapter.ts";
import { SourceListWheelChildDelegate } from "./list-wheel-delegate.generated.ts";
import { SourceListWheelChildListDelegate } from "./list-wheel-delegate.generated.ts";
import { SourceFixedExtentScrollController } from "./list-wheel-controller.generated.ts";
import { isSourceFixedExtentScrollController } from "./list-wheel-widget-adapter.ts";
import { castSourceFixedExtentScrollController } from "./list-wheel-widget-adapter.ts";
import { SourceFixedExtentMetrics } from "./list-wheel-position.generated.ts";
import { isSourceFixedExtentMetrics } from "./list-wheel-widget-adapter.ts";
import { castSourceFixedExtentMetrics } from "./list-wheel-widget-adapter.ts";
import { SourceListWheelChildManager } from "../rendering/list-wheel-viewport.generated.ts";
import { SourceListWheelParentData } from "../rendering/list-wheel-viewport.generated.ts";
import { SourceRenderListWheelViewport } from "../rendering/list-wheel-viewport.generated.ts";
import { isSourceRenderListWheelViewport } from "./list-wheel-widget-adapter.ts";
import { castSourceRenderListWheelViewport } from "./list-wheel-widget-adapter.ts";
import { Scrollable } from "./scrollable.ts";
import { ScrollableState } from "./scrollable.ts";
import { WheelScrollableStateHost } from "./list-wheel-widget-adapter.ts";
import { StatefulWidget } from "./framework.ts";
import { WheelStatefulHost } from "./list-wheel-widget-adapter.ts";
import { State } from "./framework.ts";
import { RenderObjectElement } from "./framework.ts";
import { WheelElementHost } from "./list-wheel-widget-adapter.ts";
import { RenderObjectWidget } from "./framework.ts";
import { WheelRenderWidgetHost } from "./list-wheel-widget-adapter.ts";
import { HitTestBehavior } from "../rendering/pointer-listener.ts";
import { DragStartBehavior } from "../gestures/recognizer.ts";
import { ChangeReportingBehavior } from "./list-wheel-widget-adapter.ts";
import { ScrollBehavior } from "./scroll-configuration.ts";
import { Key } from "../../foundation/key.ts";
import { ScrollNotification } from "./scroll-notification.ts";
import { isScrollEndNotification } from "./list-wheel-widget-adapter.ts";
import { isScrollUpdateNotification } from "./list-wheel-widget-adapter.ts";
import { createWheelNotificationListener } from "./list-wheel-widget-adapter.ts";
import { ScrollConfiguration } from "./scroll-configuration.ts";
import { DartIntMap } from "../../foundation/dart-int-map.ts";
import { createWheelWidgetMap } from "./list-wheel-widget-adapter.ts";
import { createWheelElementMap } from "./list-wheel-widget-adapter.ts";
import { Element } from "./framework.ts";
import { dartIntMapRead } from "../../foundation/dart-int-map.ts";
import { dartIntMapWrite } from "../../foundation/dart-int-map.ts";
import { wheelBuildScope } from "./list-wheel-widget-adapter.ts";
import { wheelElementRenderObject } from "./list-wheel-widget-adapter.ts";
import { isWheelInteger } from "./list-wheel-widget-adapter.ts";
import { castWheelInteger } from "./list-wheel-widget-adapter.ts";
import { wheelRuntimeType } from "./list-wheel-widget-adapter.ts";
import { wheelInsertChild } from "./list-wheel-widget-adapter.ts";
import { wheelDebugValidateChild } from "./list-wheel-widget-adapter.ts";
import { ScrollController } from "./scroll-controller.ts";
import { createSourceWheelController } from "./list-wheel-widget-adapter.ts";
import { wheelElementSlot } from "./list-wheel-widget-adapter.ts";
import type { Widget } from "./framework.ts";
import type { BuildContext } from "./framework.ts";
import type { DartList } from "../../foundation/dart-list.ts";
import type { ViewportOffset } from "../rendering/viewport-offset.ts";
import type { Clip } from "../../ui/clip.ts";
export class SourceFixedExtentScrollable extends Scrollable {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly itemExtent: number;
    /**
     * @dartParam itemExtent double
     * @dartParamOrigin itemExtent inferred
     */
    constructor({ controller = null, physics = null, itemExtent, viewportBuilder, dragStartBehavior, restorationId = null, scrollBehavior = null, hitTestBehavior = HitTestBehavior.opaque }: {
        readonly controller?: ScrollController | null;
        readonly physics?: ScrollPhysics | null;
        readonly itemExtent: number;
        readonly viewportBuilder: (argument0: BuildContext, argument1: ViewportOffset) => Widget;
        readonly dragStartBehavior: DragStartBehavior;
        readonly restorationId?: string | null;
        readonly scrollBehavior?: ScrollBehavior | null;
        readonly hitTestBehavior?: HitTestBehavior;
    }) {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField0 = itemExtent;
        super({ controller: controller, physics: physics, viewportBuilder: viewportBuilder, dragStartBehavior: dragStartBehavior, restorationId: restorationId, scrollBehavior: scrollBehavior, hitTestBehavior: hitTestBehavior });
        this.itemExtent = _initialField0;
        protect(this, ["itemExtent"]);
    }
    override createState(): SourceFixedExtentScrollableState {
        return new SourceFixedExtentScrollableState();
    }
}
export class SourceFixedExtentScrollableState extends WheelScrollableStateHost {
    constructor() {
        super();
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    get itemExtent(): number {
        const actualWidget: SourceFixedExtentScrollable = castSourceFixedExtentScrollable(this.widget);
        return actualWidget.itemExtent;
    }
}
export class SourceListWheelScrollView extends WheelStatefulHost {
    readonly controller: ScrollController | null;
    readonly physics: ScrollPhysics | null;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly diameterRatio: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly perspective: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly offAxisFraction: number;
    readonly useMagnifier: boolean;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly magnification: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly overAndUnderCenterOpacity: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly itemExtent: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly squeeze: number;
    /**
     * @dartType void Function(int)?
     * @dartTypeOrigin explicit
     */
    readonly onSelectedItemChanged: ((argument0: number) => void) | null;
    readonly renderChildrenOutsideViewport: boolean;
    readonly childDelegate: SourceListWheelChildDelegate;
    readonly clipBehavior: Clip;
    readonly hitTestBehavior: HitTestBehavior;
    readonly restorationId: string | null;
    readonly scrollBehavior: ScrollBehavior | null;
    readonly dragStartBehavior: DragStartBehavior;
    readonly changeReportingBehavior: ChangeReportingBehavior;
    /**
     * @dartParam diameterRatio double
     * @dartParamOrigin diameterRatio inferred
     * @dartParam perspective double
     * @dartParamOrigin perspective inferred
     * @dartParam offAxisFraction double
     * @dartParamOrigin offAxisFraction inferred
     * @dartParam magnification double
     * @dartParamOrigin magnification inferred
     * @dartParam overAndUnderCenterOpacity double
     * @dartParamOrigin overAndUnderCenterOpacity inferred
     * @dartParam itemExtent double
     * @dartParamOrigin itemExtent inferred
     * @dartParam squeeze double
     * @dartParamOrigin squeeze inferred
     * @dartParam onSelectedItemChanged void Function(int)?
     * @dartParamOrigin onSelectedItemChanged inferred
     */
    constructor({ key = null, controller = null, physics = null, diameterRatio = SourceRenderListWheelViewport.defaultDiameterRatio, perspective = SourceRenderListWheelViewport.defaultPerspective, offAxisFraction = 0, useMagnifier = false, magnification = 1, overAndUnderCenterOpacity = 1, itemExtent, squeeze = 1, onSelectedItemChanged = null, renderChildrenOutsideViewport = false, clipBehavior = "hardEdge", hitTestBehavior = HitTestBehavior.opaque, restorationId = null, scrollBehavior = null, dragStartBehavior = DragStartBehavior.start, changeReportingBehavior = ChangeReportingBehavior.onScrollUpdate, children }: {
        readonly key?: Key | null;
        readonly controller?: ScrollController | null;
        readonly physics?: ScrollPhysics | null;
        readonly diameterRatio?: number;
        readonly perspective?: number;
        readonly offAxisFraction?: number;
        readonly useMagnifier?: boolean;
        readonly magnification?: number;
        readonly overAndUnderCenterOpacity?: number;
        readonly itemExtent: number;
        readonly squeeze?: number;
        readonly onSelectedItemChanged?: ((argument0: number) => void) | null;
        readonly renderChildrenOutsideViewport?: boolean;
        readonly clipBehavior?: Clip;
        readonly hitTestBehavior?: HitTestBehavior;
        readonly restorationId?: string | null;
        readonly scrollBehavior?: ScrollBehavior | null;
        readonly dragStartBehavior?: DragStartBehavior;
        readonly changeReportingBehavior?: ChangeReportingBehavior;
        readonly children: DartList<Widget>;
    }) {
        const _initialField0 = controller;
        const _initialField1 = physics;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField2 = diameterRatio;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField3 = perspective;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField4 = offAxisFraction;
        const _initialField5 = useMagnifier;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField6 = magnification;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField7 = overAndUnderCenterOpacity;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField8 = itemExtent;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField9 = squeeze;
        /**
         * @dartType void Function(int)?
         * @dartTypeOrigin inferred
         */
        const _initialField10 = onSelectedItemChanged;
        const _initialField11 = renderChildrenOutsideViewport;
        const _initialField12 = clipBehavior;
        const _initialField13 = hitTestBehavior;
        const _initialField14 = restorationId;
        const _initialField15 = scrollBehavior;
        const _initialField16 = dragStartBehavior;
        const _initialField17 = changeReportingBehavior;
        if (FoundationBuildMode.debug)
            invariant(diameterRatio > 0, "invalid-source-wheel-renderer", SourceRenderListWheelViewport.diameterRatioZeroMessage);
        if (FoundationBuildMode.debug)
            invariant(perspective > 0, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        if (FoundationBuildMode.debug)
            invariant(perspective <= 0.01, "invalid-source-wheel-renderer", SourceRenderListWheelViewport.perspectiveTooHighMessage);
        if (FoundationBuildMode.debug)
            invariant(magnification > 0, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        if (FoundationBuildMode.debug)
            invariant(overAndUnderCenterOpacity >= 0 && overAndUnderCenterOpacity <= 1, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        if (FoundationBuildMode.debug)
            invariant(itemExtent > 0, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        if (FoundationBuildMode.debug)
            invariant(squeeze > 0, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        if (FoundationBuildMode.debug)
            invariant(!renderChildrenOutsideViewport || clipBehavior === "none", "invalid-source-wheel-renderer", SourceRenderListWheelViewport.clipBehaviorAndRenderChildrenOutsideViewportConflict);
        const _initialField18 = new SourceListWheelChildListDelegate({ children: children });
        super({ key: key });
        this.controller = _initialField0;
        this.physics = _initialField1;
        this.diameterRatio = _initialField2;
        this.perspective = _initialField3;
        this.offAxisFraction = _initialField4;
        this.useMagnifier = _initialField5;
        this.magnification = _initialField6;
        this.overAndUnderCenterOpacity = _initialField7;
        this.itemExtent = _initialField8;
        this.squeeze = _initialField9;
        this.onSelectedItemChanged = _initialField10;
        this.renderChildrenOutsideViewport = _initialField11;
        this.childDelegate = _initialField18;
        this.clipBehavior = _initialField12;
        this.hitTestBehavior = _initialField13;
        this.restorationId = _initialField14;
        this.scrollBehavior = _initialField15;
        this.dragStartBehavior = _initialField16;
        this.changeReportingBehavior = _initialField17;
        protect(this, ["controller", "physics", "diameterRatio", "perspective", "offAxisFraction", "useMagnifier", "magnification", "overAndUnderCenterOpacity", "itemExtent", "squeeze", "onSelectedItemChanged", "renderChildrenOutsideViewport", "childDelegate", "clipBehavior", "hitTestBehavior", "restorationId", "scrollBehavior", "dragStartBehavior", "changeReportingBehavior"]);
    }
    override createState(): State<SourceListWheelScrollView> {
        return new SourceListWheelScrollViewState();
    }
    /**
     * @dartParam diameterRatio double
     * @dartParamOrigin diameterRatio inferred
     * @dartParam perspective double
     * @dartParamOrigin perspective inferred
     * @dartParam offAxisFraction double
     * @dartParamOrigin offAxisFraction inferred
     * @dartParam magnification double
     * @dartParamOrigin magnification inferred
     * @dartParam overAndUnderCenterOpacity double
     * @dartParamOrigin overAndUnderCenterOpacity inferred
     * @dartParam itemExtent double
     * @dartParamOrigin itemExtent inferred
     * @dartParam squeeze double
     * @dartParamOrigin squeeze inferred
     * @dartParam onSelectedItemChanged void Function(int)?
     * @dartParamOrigin onSelectedItemChanged inferred
     */
    static useDelegate({ key = null, controller = null, physics = null, diameterRatio = SourceRenderListWheelViewport.defaultDiameterRatio, perspective = SourceRenderListWheelViewport.defaultPerspective, offAxisFraction = 0, useMagnifier = false, magnification = 1, overAndUnderCenterOpacity = 1, itemExtent, squeeze = 1, onSelectedItemChanged = null, renderChildrenOutsideViewport = false, clipBehavior = "hardEdge", hitTestBehavior = HitTestBehavior.opaque, restorationId = null, scrollBehavior = null, dragStartBehavior = DragStartBehavior.start, changeReportingBehavior = ChangeReportingBehavior.onScrollUpdate, childDelegate }: {
        readonly key?: Key | null;
        readonly controller?: ScrollController | null;
        readonly physics?: ScrollPhysics | null;
        readonly diameterRatio?: number;
        readonly perspective?: number;
        readonly offAxisFraction?: number;
        readonly useMagnifier?: boolean;
        readonly magnification?: number;
        readonly overAndUnderCenterOpacity?: number;
        readonly itemExtent: number;
        readonly squeeze?: number;
        readonly onSelectedItemChanged?: ((argument0: number) => void) | null;
        readonly renderChildrenOutsideViewport?: boolean;
        readonly clipBehavior?: Clip;
        readonly hitTestBehavior?: HitTestBehavior;
        readonly restorationId?: string | null;
        readonly scrollBehavior?: ScrollBehavior | null;
        readonly dragStartBehavior?: DragStartBehavior;
        readonly changeReportingBehavior?: ChangeReportingBehavior;
        readonly childDelegate: SourceListWheelChildDelegate;
    }): SourceListWheelScrollView {
        return _dartTemporary0({ key, controller, physics, diameterRatio, perspective, offAxisFraction, useMagnifier, magnification, overAndUnderCenterOpacity, itemExtent, squeeze, onSelectedItemChanged, renderChildrenOutsideViewport, clipBehavior, hitTestBehavior, restorationId, scrollBehavior, dragStartBehavior, changeReportingBehavior, childDelegate });
    }
}
function _dartTemporary0({ key = null, controller = null, physics = null, diameterRatio = SourceRenderListWheelViewport.defaultDiameterRatio, perspective = SourceRenderListWheelViewport.defaultPerspective, offAxisFraction = 0, useMagnifier = false, magnification = 1, overAndUnderCenterOpacity = 1, itemExtent, squeeze = 1, onSelectedItemChanged = null, renderChildrenOutsideViewport = false, clipBehavior = "hardEdge", hitTestBehavior = HitTestBehavior.opaque, restorationId = null, scrollBehavior = null, dragStartBehavior = DragStartBehavior.start, changeReportingBehavior = ChangeReportingBehavior.onScrollUpdate, childDelegate }: {
    readonly key?: Key | null;
    readonly controller?: ScrollController | null;
    readonly physics?: ScrollPhysics | null;
    readonly diameterRatio?: number;
    readonly perspective?: number;
    readonly offAxisFraction?: number;
    readonly useMagnifier?: boolean;
    readonly magnification?: number;
    readonly overAndUnderCenterOpacity?: number;
    readonly itemExtent: number;
    readonly squeeze?: number;
    readonly onSelectedItemChanged?: ((argument0: number) => void) | null;
    readonly renderChildrenOutsideViewport?: boolean;
    readonly clipBehavior?: Clip;
    readonly hitTestBehavior?: HitTestBehavior;
    readonly restorationId?: string | null;
    readonly scrollBehavior?: ScrollBehavior | null;
    readonly dragStartBehavior?: DragStartBehavior;
    readonly changeReportingBehavior?: ChangeReportingBehavior;
    readonly childDelegate: SourceListWheelChildDelegate;
}): SourceListWheelScrollView {
    const _initialField0 = controller;
    const _initialField1 = physics;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField2 = diameterRatio;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField3 = perspective;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField4 = offAxisFraction;
    const _initialField5 = useMagnifier;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField6 = magnification;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField7 = overAndUnderCenterOpacity;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField8 = itemExtent;
    /**
     * @dartType double
     * @dartTypeOrigin inferred
     */
    const _initialField9 = squeeze;
    /**
     * @dartType void Function(int)?
     * @dartTypeOrigin inferred
     */
    const _initialField10 = onSelectedItemChanged;
    const _initialField11 = renderChildrenOutsideViewport;
    const _initialField12 = clipBehavior;
    const _initialField13 = hitTestBehavior;
    const _initialField14 = restorationId;
    const _initialField15 = scrollBehavior;
    const _initialField16 = dragStartBehavior;
    const _initialField17 = changeReportingBehavior;
    const _initialField18 = childDelegate;
    if (FoundationBuildMode.debug)
        invariant(diameterRatio > 0, "invalid-source-wheel-renderer", SourceRenderListWheelViewport.diameterRatioZeroMessage);
    if (FoundationBuildMode.debug)
        invariant(perspective > 0, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
    if (FoundationBuildMode.debug)
        invariant(perspective <= 0.01, "invalid-source-wheel-renderer", SourceRenderListWheelViewport.perspectiveTooHighMessage);
    if (FoundationBuildMode.debug)
        invariant(magnification > 0, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
    if (FoundationBuildMode.debug)
        invariant(overAndUnderCenterOpacity >= 0 && overAndUnderCenterOpacity <= 1, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
    if (FoundationBuildMode.debug)
        invariant(itemExtent > 0, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
    if (FoundationBuildMode.debug)
        invariant(squeeze > 0, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
    if (FoundationBuildMode.debug)
        invariant(!renderChildrenOutsideViewport || clipBehavior === "none", "invalid-source-wheel-renderer", SourceRenderListWheelViewport.clipBehaviorAndRenderChildrenOutsideViewportConflict);
    const _dartTemporary1: InstanceType<typeof WheelStatefulHost> & {
        controller: ScrollController | null;
        physics: ScrollPhysics | null;
        diameterRatio: number;
        perspective: number;
        offAxisFraction: number;
        useMagnifier: boolean;
        magnification: number;
        overAndUnderCenterOpacity: number;
        itemExtent: number;
        squeeze: number;
        onSelectedItemChanged: ((argument0: number) => void) | null;
        renderChildrenOutsideViewport: boolean;
        childDelegate: SourceListWheelChildDelegate;
        clipBehavior: Clip;
        hitTestBehavior: HitTestBehavior;
        restorationId: string | null;
        scrollBehavior: ScrollBehavior | null;
        dragStartBehavior: DragStartBehavior;
        changeReportingBehavior: ChangeReportingBehavior;
    } = Reflect.construct(WheelStatefulHost, [{ key: key }] satisfies ConstructorParameters<typeof WheelStatefulHost>, SourceListWheelScrollView) as InstanceType<typeof WheelStatefulHost> & {
        controller: ScrollController | null;
        physics: ScrollPhysics | null;
        diameterRatio: number;
        perspective: number;
        offAxisFraction: number;
        useMagnifier: boolean;
        magnification: number;
        overAndUnderCenterOpacity: number;
        itemExtent: number;
        squeeze: number;
        onSelectedItemChanged: ((argument0: number) => void) | null;
        renderChildrenOutsideViewport: boolean;
        childDelegate: SourceListWheelChildDelegate;
        clipBehavior: Clip;
        hitTestBehavior: HitTestBehavior;
        restorationId: string | null;
        scrollBehavior: ScrollBehavior | null;
        dragStartBehavior: DragStartBehavior;
        changeReportingBehavior: ChangeReportingBehavior;
    };
    _dartTemporary1.controller = _initialField0;
    _dartTemporary1.physics = _initialField1;
    _dartTemporary1.diameterRatio = _initialField2;
    _dartTemporary1.perspective = _initialField3;
    _dartTemporary1.offAxisFraction = _initialField4;
    _dartTemporary1.useMagnifier = _initialField5;
    _dartTemporary1.magnification = _initialField6;
    _dartTemporary1.overAndUnderCenterOpacity = _initialField7;
    _dartTemporary1.itemExtent = _initialField8;
    _dartTemporary1.squeeze = _initialField9;
    _dartTemporary1.onSelectedItemChanged = _initialField10;
    _dartTemporary1.renderChildrenOutsideViewport = _initialField11;
    _dartTemporary1.childDelegate = _initialField18;
    _dartTemporary1.clipBehavior = _initialField12;
    _dartTemporary1.hitTestBehavior = _initialField13;
    _dartTemporary1.restorationId = _initialField14;
    _dartTemporary1.scrollBehavior = _initialField15;
    _dartTemporary1.dragStartBehavior = _initialField16;
    _dartTemporary1.changeReportingBehavior = _initialField17;
    protect(_dartTemporary1, ["controller", "physics", "diameterRatio", "perspective", "offAxisFraction", "useMagnifier", "magnification", "overAndUnderCenterOpacity", "itemExtent", "squeeze", "onSelectedItemChanged", "renderChildrenOutsideViewport", "childDelegate", "clipBehavior", "hitTestBehavior", "restorationId", "scrollBehavior", "dragStartBehavior", "changeReportingBehavior"]);
    return _dartTemporary1 as SourceListWheelScrollView;
}
export class SourceListWheelScrollViewState extends State<SourceListWheelScrollView> {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    _dart_7b25c3dc43b1ced7_lastReportedItemIndex: number;
    _dart_7b25c3dc43b1ced7_backupController: ScrollController | null;
    constructor() {
        /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        const _initialField0 = 0;
        super();
        this._dart_7b25c3dc43b1ced7_lastReportedItemIndex = _initialField0;
        this._dart_7b25c3dc43b1ced7_backupController = null;
    }
    get _dart_7b25c3dc43b1ced7_effectiveController(): ScrollController {
        return this.widget.controller ?? (this._dart_7b25c3dc43b1ced7_backupController ??= createSourceWheelController());
    }
    override initState(): void {
        super.initState();
        if (isSourceFixedExtentScrollController(this.widget.controller)) {
            const controller: SourceFixedExtentScrollController = castSourceFixedExtentScrollController((() => {
                const _dartTemporary2 = this.widget.controller;
                if (_dartTemporary2 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary2!;
            })());
            checkedInteger(this._dart_7b25c3dc43b1ced7_lastReportedItemIndex = checkedInteger(controller.initialItem));
        }
    }
    override dispose(): void {
        (this._dart_7b25c3dc43b1ced7_backupController?.dispose() ?? null);
        super.dispose();
    }
    _dart_7b25c3dc43b1ced7_reportSelectedItemChanged(notification: ScrollNotification): void {
        const metrics: SourceFixedExtentMetrics = castSourceFixedExtentMetrics(notification.metrics);
        /**
         * @dartType int
         * @dartTypeOrigin explicit
         */
        const currentItemIndex: number = checkedInteger(metrics.itemIndex);
        if (checkedInteger(currentItemIndex) !== checkedInteger(this._dart_7b25c3dc43b1ced7_lastReportedItemIndex)) {
            checkedInteger(this._dart_7b25c3dc43b1ced7_lastReportedItemIndex = checkedInteger(currentItemIndex));
            /**
             * @dartType int
             * @dartTypeOrigin explicit
             */
            const trueIndex: number = checkedInteger(this.widget.childDelegate.trueIndexOf(checkedInteger(currentItemIndex)));
            (() => {
                const _dartTemporary3 = this.widget.onSelectedItemChanged;
                if (_dartTemporary3 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary3!;
            })()(checkedInteger(trueIndex));
        }
    }
    _dart_7b25c3dc43b1ced7_handleScrollNotification(notification: ScrollNotification): boolean {
        if (this.widget.onSelectedItemChanged === null || checkedInteger(notification.depth) !== 0 || !isSourceFixedExtentMetrics(notification.metrics)) {
            return false;
        }
        switch (this.widget.changeReportingBehavior) {
            case ChangeReportingBehavior.onScrollEnd: {
                if (isScrollEndNotification(notification)) {
                    this._dart_7b25c3dc43b1ced7_reportSelectedItemChanged(notification);
                }
                break;
            }
            case ChangeReportingBehavior.onScrollUpdate: {
                if (isScrollUpdateNotification(notification)) {
                    this._dart_7b25c3dc43b1ced7_reportSelectedItemChanged(notification);
                }
                break;
            }
        }
        return false;
    }
    override build(context: BuildContext): Widget {
        return createWheelNotificationListener({ onNotification: dartMethodTearOff(this, this._dart_7b25c3dc43b1ced7_handleScrollNotification), child: new SourceFixedExtentScrollable({ controller: this._dart_7b25c3dc43b1ced7_effectiveController, physics: this.widget.physics, itemExtent: this.widget.itemExtent, restorationId: this.widget.restorationId, hitTestBehavior: this.widget.hitTestBehavior, scrollBehavior: this.widget.scrollBehavior ?? ScrollConfiguration.of(context).copyWith({ scrollbars: false }), dragStartBehavior: this.widget.dragStartBehavior, viewportBuilder: (context: BuildContext, offset: ViewportOffset): SourceListWheelViewport => {
                    return new SourceListWheelViewport({ diameterRatio: this.widget.diameterRatio, perspective: this.widget.perspective, offAxisFraction: this.widget.offAxisFraction, useMagnifier: this.widget.useMagnifier, magnification: this.widget.magnification, overAndUnderCenterOpacity: this.widget.overAndUnderCenterOpacity, itemExtent: this.widget.itemExtent, squeeze: this.widget.squeeze, renderChildrenOutsideViewport: this.widget.renderChildrenOutsideViewport, offset: offset, childDelegate: this.widget.childDelegate, clipBehavior: this.widget.clipBehavior });
                } }) });
    }
}
export class SourceListWheelElement extends WheelElementHost implements SourceListWheelChildManager {
    /**
     * @dartType Map<int, Widget?>
     * @dartTypeOrigin explicit
     */
    readonly sourceWidgets: DartIntMap<number, Widget | null>;
    /**
     * @dartType SplayTreeMap<int, Element>
     * @dartTypeOrigin explicit
     */
    readonly sourceElements: DartIntMap<number, Element>;
    constructor(widget: SourceListWheelViewport) {
        /**
         * @dartType HashMap<int, Widget?>
         * @dartTypeOrigin inferred
         */
        const _initialField0 = createWheelWidgetMap();
        /**
         * @dartType SplayTreeMap<int, Element>
         * @dartTypeOrigin inferred
         */
        const _initialField1 = createWheelElementMap();
        super(widget);
        this.sourceWidgets = _initialField0;
        this.sourceElements = _initialField1;
        protect(this, ["sourceWidgets", "sourceElements"]);
    }
    override get renderObject(): SourceRenderListWheelViewport {
        return castSourceRenderListWheelViewport(super.renderObject);
    }
    override update(newWidget: SourceListWheelViewport): void {
        if (!(newWidget instanceof SourceListWheelViewport))
            throw new TypeError("Invalid covariant argument: newWidget");
        const oldWidget: SourceListWheelViewport = castSourceListWheelViewport(this.widget);
        super.update(newWidget);
        const newDelegate: SourceListWheelChildDelegate = newWidget.childDelegate;
        const oldDelegate: SourceListWheelChildDelegate = oldWidget.childDelegate;
        if (!(newDelegate === oldDelegate) && (!(wheelRuntimeType(newDelegate) === wheelRuntimeType(oldDelegate)) || newDelegate.shouldRebuild(oldDelegate))) {
            this.performRebuild();
            this.renderObject.markNeedsLayout();
        }
    }
    /**
     * @dartReturn int?
     * @dartReturnOrigin explicit
     */
    get childCount(): number | null {
        return (castSourceListWheelViewport(this.widget)).childDelegate.estimatedChildCount;
    }
    override sourcePerformRebuild(): void {
        this.sourceWidgets.clear();
        super.performRebuildBase();
        if (this.sourceElements.isEmpty) {
            return;
        }
        /**
         * @dartType int
         * @dartTypeOrigin explicit
         */
        const firstIndex: number = checkedInteger((() => {
            const _dartTemporary4 = this.sourceElements.firstKey();
            if (_dartTemporary4 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary4!;
        })());
        /**
         * @dartType int
         * @dartTypeOrigin explicit
         */
        const lastIndex: number = checkedInteger((() => {
            const _dartTemporary5 = this.sourceElements.lastKey();
            if (_dartTemporary5 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary5!;
        })());
        for (let /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        index: number = checkedInteger(firstIndex); checkedInteger(index) <= checkedInteger(lastIndex); checkedInteger((() => {
            const _dartTemporary6 = checkedInteger(index);
            const _dartTemporary7 = checkedInteger(_dartTemporary6 + 1);
            index = _dartTemporary7;
            return _dartTemporary7;
        })())) {
            const newChild: Element | null = this.updateChild(dartIntMapRead(this.sourceElements, checkedInteger(index)), this.retrieveWidget(checkedInteger(index)), checkedInteger(index));
            if (newChild !== null) {
                (() => {
                    const _dartTemporary10 = this.sourceElements;
                    const _dartTemporary8 = checkedInteger(index);
                    const _dartTemporary9 = newChild;
                    dartIntMapWrite(_dartTemporary10, _dartTemporary8, _dartTemporary9);
                    return _dartTemporary9;
                })();
            }
            else {
                this.sourceElements.remove(checkedInteger(index));
            }
        }
    }
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    retrieveWidget(index: number): Widget | null {
        checkedInteger(index);
        return this.sourceWidgets.putIfAbsent(checkedInteger(index), (): Widget | null => {
            return (castSourceListWheelViewport(this.widget)).childDelegate.build(this, checkedInteger(index));
        });
    }
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    childExistsAt(index: number): boolean {
        checkedInteger(index);
        return this.retrieveWidget(checkedInteger(index)) !== null;
    }
    /**
     * @dartParam index int
     * @dartParamOrigin index explicit
     */
    createChild(index: number, { after }: {
        readonly after: RenderBox | null;
    }): void {
        checkedInteger(index);
        wheelBuildScope((() => {
            const _dartTemporary14 = this.owner;
            if (_dartTemporary14 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary14!;
        })(), this, (): void => {
            const insertFirst: boolean = after === null;
            if (FoundationBuildMode.debug)
                invariant(insertFirst || dartIntMapRead(this.sourceElements, checkedInteger(checkedInteger(index) - 1)) !== null, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
            const newChild: Element | null = this.updateChild(dartIntMapRead(this.sourceElements, checkedInteger(index)), this.retrieveWidget(checkedInteger(index)), checkedInteger(index));
            if (newChild !== null) {
                (() => {
                    const _dartTemporary13 = this.sourceElements;
                    const _dartTemporary11 = checkedInteger(index);
                    const _dartTemporary12 = newChild;
                    dartIntMapWrite(_dartTemporary13, _dartTemporary11, _dartTemporary12);
                    return _dartTemporary12;
                })();
            }
            else {
                this.sourceElements.remove(checkedInteger(index));
            }
        });
    }
    removeChild(child: RenderBox): void {
        /**
         * @dartType int
         * @dartTypeOrigin explicit
         */
        const index: number = checkedInteger(this.renderObject.indexOf(child));
        wheelBuildScope((() => {
            const _dartTemporary15 = this.owner;
            if (_dartTemporary15 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary15!;
        })(), this, (): void => {
            if (FoundationBuildMode.debug)
                invariant(this.sourceElements.containsKey(checkedInteger(index)), "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
            const result: Element | null = this.updateChild(dartIntMapRead(this.sourceElements, checkedInteger(index)), null, checkedInteger(index));
            if (FoundationBuildMode.debug)
                invariant(result === null, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
            this.sourceElements.remove(checkedInteger(index));
            if (FoundationBuildMode.debug)
                invariant(!this.sourceElements.containsKey(checkedInteger(index)), "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        });
    }
    override updateChild(child: Element | null, newWidget: Widget | null, newSlot: {} | null): Element | null {
        const oldParentData: SourceListWheelParentData | null = (() => {
            const _dartTemporary18 = (() => {
                const _dartTemporary17 = (() => {
                    const _dartTemporary16 = child;
                    return _dartTemporary16 === null ? null : wheelElementRenderObject(_dartTemporary16);
                })();
                return _dartTemporary17 === null ? null : wheelParentData(_dartTemporary17);
            })();
            return _dartTemporary18 === null ? null : castWheelParentData(_dartTemporary18);
        })();
        const newChild: Element | null = super.updateChild(child, newWidget, newSlot);
        const newParentData: SourceListWheelParentData | null = (() => {
            const _dartTemporary21 = (() => {
                const _dartTemporary20 = (() => {
                    const _dartTemporary19 = newChild;
                    return _dartTemporary19 === null ? null : wheelElementRenderObject(_dartTemporary19);
                })();
                return _dartTemporary20 === null ? null : wheelParentData(_dartTemporary20);
            })();
            return _dartTemporary21 === null ? null : castWheelParentData(_dartTemporary21);
        })();
        if (newParentData !== null) {
            checkedInteger(newParentData.index = checkedInteger(castWheelInteger((() => {
                const _dartTemporary22 = newSlot;
                if (_dartTemporary22 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary22!;
            })())));
            if (oldParentData !== null) {
                newParentData.offset = wheelParentOffset(oldParentData);
            }
        }
        return newChild;
    }
    /**
     * @dartParam slot int
     * @dartParamOrigin slot explicit
     */
    override sourceInsertRenderObjectChild(child: RenderObject, slot: number): void {
        if (!(isWheelRenderObject(child)))
            throw new TypeError("Invalid covariant argument: child");
        if (!(isWheelInteger(slot)))
            throw new TypeError("Invalid covariant argument: slot");
        checkedInteger(slot);
        const renderObject: SourceRenderListWheelViewport = this.renderObject;
        if (FoundationBuildMode.debug)
            invariant(wheelDebugValidateChild(renderObject, child), "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        wheelInsertChild(renderObject, castWheelBox(child), { after: (() => {
                const _dartTemporary24 = (() => {
                    const _dartTemporary23 = dartIntMapRead(this.sourceElements, checkedInteger(checkedInteger(slot) - 1));
                    return _dartTemporary23 === null ? null : wheelElementRenderObject(_dartTemporary23);
                })();
                return _dartTemporary24 === null ? null : castWheelBox(_dartTemporary24);
            })() });
        if (FoundationBuildMode.debug)
            invariant(renderObject === this.renderObject, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
    }
    /**
     * @dartParam oldSlot int
     * @dartParamOrigin oldSlot explicit
     * @dartParam newSlot int
     * @dartParamOrigin newSlot explicit
     */
    override sourceMoveRenderObjectChild(child: RenderObject, oldSlot: number, newSlot: number): void {
        if (!(isWheelRenderObject(child)))
            throw new TypeError("Invalid covariant argument: child");
        if (!(isWheelInteger(oldSlot)))
            throw new TypeError("Invalid covariant argument: oldSlot");
        if (!(isWheelInteger(newSlot)))
            throw new TypeError("Invalid covariant argument: newSlot");
        checkedInteger(oldSlot);
        checkedInteger(newSlot);
        const moveChildRenderObjectErrorMessage: string = "Currently we maintain the list in contiguous increasing order, so moving children around is not allowed.";
        if (FoundationBuildMode.debug)
            invariant(false, "invalid-source-wheel-renderer", moveChildRenderObjectErrorMessage);
    }
    /**
     * @dartParam slot int
     * @dartParamOrigin slot explicit
     */
    override removeRenderObjectChild(child: RenderObject, slot: number): void {
        if (!(isWheelRenderObject(child)))
            throw new TypeError("Invalid covariant argument: child");
        if (!(isWheelInteger(slot)))
            throw new TypeError("Invalid covariant argument: slot");
        checkedInteger(slot);
        if (FoundationBuildMode.debug)
            invariant(wheelParent(child) === this.renderObject, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        this.renderObject.remove(castWheelBox(child));
    }
    override visitChildren(visitor: (argument0: Element) => void): void {
        this.sourceElements.forEach((key: number, child: Element): void => {
            checkedInteger(key);
            visitor(child);
        });
    }
    override forgetChild(child: Element): void {
        this.sourceElements.remove(wheelElementSlot(child));
        super.forgetChild(child);
    }
}
export class SourceListWheelViewport extends WheelRenderWidgetHost {
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly diameterRatio: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly perspective: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly offAxisFraction: number;
    readonly useMagnifier: boolean;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly magnification: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly overAndUnderCenterOpacity: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly itemExtent: number;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly squeeze: number;
    readonly renderChildrenOutsideViewport: boolean;
    readonly offset: ViewportOffset;
    readonly childDelegate: SourceListWheelChildDelegate;
    readonly clipBehavior: Clip;
    /**
     * @dartParam diameterRatio double
     * @dartParamOrigin diameterRatio inferred
     * @dartParam perspective double
     * @dartParamOrigin perspective inferred
     * @dartParam offAxisFraction double
     * @dartParamOrigin offAxisFraction inferred
     * @dartParam magnification double
     * @dartParamOrigin magnification inferred
     * @dartParam overAndUnderCenterOpacity double
     * @dartParamOrigin overAndUnderCenterOpacity inferred
     * @dartParam itemExtent double
     * @dartParamOrigin itemExtent inferred
     * @dartParam squeeze double
     * @dartParamOrigin squeeze inferred
     */
    constructor({ key = null, diameterRatio = SourceRenderListWheelViewport.defaultDiameterRatio, perspective = SourceRenderListWheelViewport.defaultPerspective, offAxisFraction = 0, useMagnifier = false, magnification = 1, overAndUnderCenterOpacity = 1, itemExtent, squeeze = 1, renderChildrenOutsideViewport = false, offset, childDelegate, clipBehavior = "hardEdge" }: {
        readonly key?: Key | null;
        readonly diameterRatio?: number;
        readonly perspective?: number;
        readonly offAxisFraction?: number;
        readonly useMagnifier?: boolean;
        readonly magnification?: number;
        readonly overAndUnderCenterOpacity?: number;
        readonly itemExtent: number;
        readonly squeeze?: number;
        readonly renderChildrenOutsideViewport?: boolean;
        readonly offset: ViewportOffset;
        readonly childDelegate: SourceListWheelChildDelegate;
        readonly clipBehavior?: Clip;
    }) {
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField0 = diameterRatio;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField1 = perspective;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField2 = offAxisFraction;
        const _initialField3 = useMagnifier;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField4 = magnification;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField5 = overAndUnderCenterOpacity;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField6 = itemExtent;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField7 = squeeze;
        const _initialField8 = renderChildrenOutsideViewport;
        const _initialField9 = offset;
        const _initialField10 = childDelegate;
        const _initialField11 = clipBehavior;
        if (FoundationBuildMode.debug)
            invariant(diameterRatio > 0, "invalid-source-wheel-renderer", SourceRenderListWheelViewport.diameterRatioZeroMessage);
        if (FoundationBuildMode.debug)
            invariant(perspective > 0, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        if (FoundationBuildMode.debug)
            invariant(perspective <= 0.01, "invalid-source-wheel-renderer", SourceRenderListWheelViewport.perspectiveTooHighMessage);
        if (FoundationBuildMode.debug)
            invariant(overAndUnderCenterOpacity >= 0 && overAndUnderCenterOpacity <= 1, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        if (FoundationBuildMode.debug)
            invariant(itemExtent > 0, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        if (FoundationBuildMode.debug)
            invariant(squeeze > 0, "invalid-source-wheel-renderer", "Pinned wheel renderer invariant");
        if (FoundationBuildMode.debug)
            invariant(!renderChildrenOutsideViewport || clipBehavior === "none", "invalid-source-wheel-renderer", SourceRenderListWheelViewport.clipBehaviorAndRenderChildrenOutsideViewportConflict);
        super({ key: key });
        this.diameterRatio = _initialField0;
        this.perspective = _initialField1;
        this.offAxisFraction = _initialField2;
        this.useMagnifier = _initialField3;
        this.magnification = _initialField4;
        this.overAndUnderCenterOpacity = _initialField5;
        this.itemExtent = _initialField6;
        this.squeeze = _initialField7;
        this.renderChildrenOutsideViewport = _initialField8;
        this.offset = _initialField9;
        this.childDelegate = _initialField10;
        this.clipBehavior = _initialField11;
        protect(this, ["diameterRatio", "perspective", "offAxisFraction", "useMagnifier", "magnification", "overAndUnderCenterOpacity", "itemExtent", "squeeze", "renderChildrenOutsideViewport", "offset", "childDelegate", "clipBehavior"]);
    }
    override createElement(): SourceListWheelElement {
        return new SourceListWheelElement(this);
    }
    override createRenderObject(context: BuildContext): SourceRenderListWheelViewport {
        const childManager: SourceListWheelElement = castSourceListWheelElement(context);
        return new SourceRenderListWheelViewport({ childManager: childManager, offset: this.offset, diameterRatio: this.diameterRatio, perspective: this.perspective, offAxisFraction: this.offAxisFraction, useMagnifier: this.useMagnifier, magnification: this.magnification, overAndUnderCenterOpacity: this.overAndUnderCenterOpacity, itemExtent: this.itemExtent, squeeze: this.squeeze, renderChildrenOutsideViewport: this.renderChildrenOutsideViewport, clipBehavior: this.clipBehavior });
    }
    override updateRenderObject(context: BuildContext, renderObject: SourceRenderListWheelViewport): void {
        if (!(isSourceRenderListWheelViewport(renderObject)))
            throw new TypeError("Invalid covariant argument: renderObject");
        (() => {
            const _dartTemporary25 = renderObject;
            _dartTemporary25.offset = this.offset;
            _dartTemporary25.diameterRatio = this.diameterRatio;
            _dartTemporary25.perspective = this.perspective;
            _dartTemporary25.offAxisFraction = this.offAxisFraction;
            _dartTemporary25.useMagnifier = this.useMagnifier;
            _dartTemporary25.magnification = this.magnification;
            _dartTemporary25.overAndUnderCenterOpacity = this.overAndUnderCenterOpacity;
            _dartTemporary25.itemExtent = this.itemExtent;
            _dartTemporary25.squeeze = this.squeeze;
            _dartTemporary25.renderChildrenOutsideViewport = this.renderChildrenOutsideViewport;
            _dartTemporary25.clipBehavior = this.clipBehavior;
            return _dartTemporary25;
        })();
    }
}

export function castSourceFixedExtentScrollable(value:unknown):SourceFixedExtentScrollable{invariant(value instanceof SourceFixedExtentScrollable,'invalid-wheel-scrollable','Expected source wheel Scrollable');return value;}
export function castSourceListWheelElement(value:unknown):SourceListWheelElement{invariant(value instanceof SourceListWheelElement,'invalid-wheel-element','Expected source wheel Element');return value;}
export function castSourceListWheelViewport(value:unknown):SourceListWheelViewport{invariant(value instanceof SourceListWheelViewport,'invalid-wheel-widget','Expected source wheel Viewport');return value;}
