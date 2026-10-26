// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adopted product owner: nominal checks use the classes declared here.
// Generated from packages/flutter/lib/src/widgets/scroll_delegate.dart; SHA256 e9cec65374b38d38a3ef8cce7410076f26b5a942145b2742506499ae81834383
import { checkedInteger } from "../../ui/value-math.ts";
import { protect } from "../../ui/value-math.ts";
import { invariant } from "../../foundation/errors.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { ChangeNotifier } from "../../foundation/notifier.ts";
import { State } from "./framework.ts";
import { StatefulWidget } from "./framework.ts";
import { ErrorWidget } from "./framework.ts";
import { FlutterError } from "../../foundation/flutter-error.ts";
import { FlutterErrorDetails } from "../../foundation/assertions.ts";
import { ErrorDescription } from "../../foundation/diagnostics.ts";
import { RepaintBoundary } from "./repaint-boundary.ts";
import { AutomaticKeepAlive } from "./automatic-keep-alive.ts";
import { AutomaticKeepAliveClientMixin } from "./automatic-keep-alive.ts";
import { SelectionContainer } from "./selection-container.ts";
import { SelectionRegistrarScope } from "./selection-container.ts";
import { ChildVicinity } from "./child-vicinity.generated.ts";
import { dartListGet } from "../../foundation/dart-list.ts";
import { DartMap } from "../../foundation/dart-collections.ts";
import { DartSet } from "../../foundation/dart-collections.ts";
import { dartMapRead } from "../../foundation/dart-collections.ts";
import { dartMapWrite } from "../../foundation/dart-collections.ts";
import { dartMethodTearOff } from "../../foundation/dart-method-tear-off.ts";
import { captureDartException } from "../../foundation/dart-exceptions.ts";
import { createSelectableMap } from "./two-dimensional-delegate-adapter.ts";
import { createSelectableSet } from "./two-dimensional-delegate-adapter.ts";
import { isChildVicinity } from "./child-vicinity.generated.ts";
import { castChildVicinity } from "./child-vicinity.generated.ts";
import { createTwoDimensionalRepaintBoundary } from "./two-dimensional-delegate-adapter.ts";
import { TwoDimensionalSelectionHost } from "./two-dimensional-selection-host.ts";
import { selectionParentFor } from "./two-dimensional-selection-host.ts";
import { selectionAddListener } from "./two-dimensional-selection-host.ts";
import { selectionRemoveListener } from "./two-dimensional-selection-host.ts";
import type { Widget } from "./framework.ts";
import type { BuildContext } from "./framework.ts";
import type { Selectable } from "../rendering/selection.ts";
import type { SelectionRegistrar } from "../rendering/selection.ts";
import type { DartList } from "../../foundation/dart-list.ts";
import type { HostStackTrace } from "./two-dimensional-delegate-adapter.ts";
export abstract class SourceTwoDimensionalChildDelegate extends ChangeNotifier {
    constructor() {
        super();
        if (false) {
            ChangeNotifier.maybeDispatchObjectCreation(this);
        }
    }
    abstract build(context: BuildContext, vicinity: ChildVicinity): Widget | null;
    abstract shouldRebuild(oldDelegate: SourceTwoDimensionalChildDelegate): boolean;
}
export class SourceTwoDimensionalChildBuilderDelegate extends SourceTwoDimensionalChildDelegate {
    readonly builder: (argument0: BuildContext, argument1: ChildVicinity) => Widget | null;
    /**
     * @dartType int?
     * @dartTypeOrigin explicit
     */
    _dart_66ef66b3420e175b_maxXIndex: number | null;
    /**
     * @dartType int?
     * @dartTypeOrigin explicit
     */
    _dart_66ef66b3420e175b_maxYIndex: number | null;
    readonly addRepaintBoundaries: boolean;
    readonly addAutomaticKeepAlives: boolean;
    /**
     * @dartParam maxXIndex int?
     * @dartParamOrigin maxXIndex explicit
     * @dartParam maxYIndex int?
     * @dartParamOrigin maxYIndex explicit
     */
    constructor({ builder, maxXIndex = null, maxYIndex = null, addRepaintBoundaries = true, addAutomaticKeepAlives = true }: {
        readonly builder: (argument0: BuildContext, argument1: ChildVicinity) => Widget | null;
        readonly maxXIndex?: number | null;
        readonly maxYIndex?: number | null;
        readonly addRepaintBoundaries?: boolean;
        readonly addAutomaticKeepAlives?: boolean;
    }) {
        if (maxXIndex !== null)
            checkedInteger(maxXIndex);
        if (maxYIndex !== null)
            checkedInteger(maxYIndex);
        const _initialField0 = builder;
        const _initialField1 = addRepaintBoundaries;
        const _initialField2 = addAutomaticKeepAlives;
        if (FoundationBuildMode.debug)
            invariant(maxYIndex === null || checkedInteger(maxYIndex) >= checkedInteger(-1), "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant(maxXIndex === null || checkedInteger(maxXIndex) >= checkedInteger(-1), "generated-source-assert", "Pinned Dart assertion failed");
        /**
         * @dartType int?
         * @dartTypeOrigin inferred
         */
        const _initialField3 = maxYIndex;
        /**
         * @dartType int?
         * @dartTypeOrigin inferred
         */
        const _initialField4 = maxXIndex;
        super();
        this.builder = _initialField0;
        this._dart_66ef66b3420e175b_maxXIndex = _initialField4;
        this._dart_66ef66b3420e175b_maxYIndex = _initialField3;
        this.addRepaintBoundaries = _initialField1;
        this.addAutomaticKeepAlives = _initialField2;
        protect(this, ["builder", "addRepaintBoundaries", "addAutomaticKeepAlives"]);
    }
    /**
     * @dartReturn int?
     * @dartReturnOrigin explicit
     */
    get maxXIndex(): number | null {
        return this._dart_66ef66b3420e175b_maxXIndex;
    }
    /**
     * @dartParam value int?
     * @dartParamOrigin value explicit
     */
    set maxXIndex(value: number | null) {
        if (value !== null)
            checkedInteger(value);
        if (value === this.maxXIndex) {
            return;
        }
        if (FoundationBuildMode.debug)
            invariant(value === null || checkedInteger(value) >= checkedInteger(-1), "generated-source-assert", "Pinned Dart assertion failed");
        this._dart_66ef66b3420e175b_maxXIndex = value;
        this.notifyListeners();
    }
    /**
     * @dartReturn int?
     * @dartReturnOrigin explicit
     */
    get maxYIndex(): number | null {
        return this._dart_66ef66b3420e175b_maxYIndex;
    }
    /**
     * @dartParam value int?
     * @dartParamOrigin value explicit
     */
    set maxYIndex(value: number | null) {
        if (value !== null)
            checkedInteger(value);
        if (this.maxYIndex === value) {
            return;
        }
        if (FoundationBuildMode.debug)
            invariant(value === null || checkedInteger(value) >= checkedInteger(-1), "generated-source-assert", "Pinned Dart assertion failed");
        this._dart_66ef66b3420e175b_maxYIndex = value;
        this.notifyListeners();
    }
    override build(context: BuildContext, vicinity: ChildVicinity): Widget | null {
        if (!(isChildVicinity(vicinity)))
            throw new TypeError("Invalid covariant argument: vicinity");
        if (checkedInteger(vicinity.xIndex) < 0 || (this.maxXIndex !== null && checkedInteger(vicinity.xIndex) > checkedInteger((() => {
            const _dartTemporary0 = this.maxXIndex;
            if (_dartTemporary0 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary0!;
        })()))) {
            return null;
        }
        if (checkedInteger(vicinity.yIndex) < 0 || (this.maxYIndex !== null && checkedInteger(vicinity.yIndex) > checkedInteger((() => {
            const _dartTemporary1 = this.maxYIndex;
            if (_dartTemporary1 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary1!;
        })()))) {
            return null;
        }
        let child: Widget | null = null;
        try {
            child = this.builder(context, vicinity);
        }
        catch (_dartTemporary2) {
            const _dartTemporary3 = captureDartException(_dartTemporary2);
            {
                const exception = _dartTemporary3.exception;
                const stackTrace = _dartTemporary3.stackTrace;
                child = _createErrorWidget(exception, stackTrace);
            }
        }
        if (child === null) {
            return null;
        }
        if (this.addRepaintBoundaries) {
            child = createTwoDimensionalRepaintBoundary({ child: child });
        }
        if (this.addAutomaticKeepAlives) {
            child = new AutomaticKeepAlive({ child: new _SelectionKeepAlive({ child: child }) });
        }
        return child;
    }
    override shouldRebuild(oldDelegate: SourceTwoDimensionalChildDelegate): boolean {
        if (!(oldDelegate instanceof SourceTwoDimensionalChildDelegate))
            throw new TypeError("Invalid covariant argument: oldDelegate");
        return true;
    }
}
export class SourceTwoDimensionalChildListDelegate extends SourceTwoDimensionalChildDelegate {
    readonly children: DartList<DartList<Widget>>;
    readonly addRepaintBoundaries: boolean;
    readonly addAutomaticKeepAlives: boolean;
    constructor({ addRepaintBoundaries = true, addAutomaticKeepAlives = true, children }: {
        readonly addRepaintBoundaries?: boolean;
        readonly addAutomaticKeepAlives?: boolean;
        readonly children: DartList<DartList<Widget>>;
    }) {
        const _initialField0 = addRepaintBoundaries;
        const _initialField1 = addAutomaticKeepAlives;
        const _initialField2 = children;
        super();
        this.children = _initialField2;
        this.addRepaintBoundaries = _initialField0;
        this.addAutomaticKeepAlives = _initialField1;
        protect(this, ["children", "addRepaintBoundaries", "addAutomaticKeepAlives"]);
    }
    override build(context: BuildContext, vicinity: ChildVicinity): Widget | null {
        if (!(isChildVicinity(vicinity)))
            throw new TypeError("Invalid covariant argument: vicinity");
        if (checkedInteger(vicinity.yIndex) < 0 || checkedInteger(vicinity.yIndex) >= checkedInteger(this.children.length)) {
            return null;
        }
        if (checkedInteger(vicinity.xIndex) < 0 || checkedInteger(vicinity.xIndex) >= checkedInteger(dartListGet(this.children, checkedInteger(vicinity.yIndex)).length)) {
            return null;
        }
        let child: Widget = dartListGet(dartListGet(this.children, checkedInteger(vicinity.yIndex)), checkedInteger(vicinity.xIndex));
        if (this.addRepaintBoundaries) {
            child = createTwoDimensionalRepaintBoundary({ child: child });
        }
        if (this.addAutomaticKeepAlives) {
            child = new AutomaticKeepAlive({ child: new _SelectionKeepAlive({ child: child }) });
        }
        return child;
    }
    override shouldRebuild(oldDelegate: SourceTwoDimensionalChildListDelegate): boolean {
        if (!(oldDelegate instanceof SourceTwoDimensionalChildListDelegate))
            throw new TypeError("Invalid covariant argument: oldDelegate");
        return !(this.children === oldDelegate.children);
    }
}
export class _SelectionKeepAlive extends StatefulWidget {
    readonly child: Widget;
    constructor({ child }: {
        readonly child: Widget;
    }) {
        const _initialField0 = child;
        super();
        this.child = _initialField0;
        protect(this, ["child"]);
    }
    override createState(): State<_SelectionKeepAlive> {
        return new _SelectionKeepAliveState();
    }
}
export class _SelectionKeepAliveState extends TwoDimensionalSelectionHost<_SelectionKeepAlive> implements SelectionRegistrar {
    sourceSelections: DartSet<Selectable> | null;
    sourceAttachments: DartMap<Selectable, () => void> | null;
    sourceRegistrar: SelectionRegistrar | null;
    _dart_66ef66b3420e175b_wantKeepAlive: boolean;
    constructor() {
        const _initialField0 = false;
        super();
        this.sourceSelections = null;
        this.sourceAttachments = null;
        this.sourceRegistrar = null;
        this._dart_66ef66b3420e175b_wantKeepAlive = _initialField0;
    }
    override get wantKeepAlive(): boolean {
        return this._dart_66ef66b3420e175b_wantKeepAlive;
    }
    set wantKeepAlive(value: boolean) {
        if (this._dart_66ef66b3420e175b_wantKeepAlive !== value) {
            this._dart_66ef66b3420e175b_wantKeepAlive = value;
            this.updateKeepAlive();
        }
    }
    sourceListensTo(selectable: Selectable): () => void {
        return (): void => {
            if (selectable.value.hasSelection) {
                this._dart_66ef66b3420e175b_updateSelectablesWithSelections(selectable, { add: true });
            }
            else {
                this._dart_66ef66b3420e175b_updateSelectablesWithSelections(selectable, { add: false });
            }
        };
    }
    _dart_66ef66b3420e175b_updateSelectablesWithSelections(selectable: Selectable, { add }: {
        readonly add: boolean;
    }): void {
        if (add) {
            if (FoundationBuildMode.debug)
                invariant(selectable.value.hasSelection, "generated-source-assert", "Pinned Dart assertion failed");
            this.sourceSelections ??= (() => {
                const _dartTemporary4 = createSelectableSet();
                return _dartTemporary4;
            })();
            (() => {
                const _dartTemporary5 = this.sourceSelections;
                if (_dartTemporary5 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary5!;
            })().add(selectable);
        }
        else {
            (this.sourceSelections?.remove(selectable) ?? null);
        }
        this.wantKeepAlive = (() => {
            const _dartTemporary6 = this.sourceSelections;
            return _dartTemporary6 === null ? null : _dartTemporary6.isNotEmpty;
        })() ?? false;
    }
    override sourceDidChangeDependencies(): void {
        super.sourceBaseDidChangeDependencies();
        const newRegistrar: SelectionRegistrar | null = selectionParentFor(this, this.context);
        if (!(this.sourceRegistrar === newRegistrar)) {
            if (this.sourceRegistrar !== null) {
                (() => {
                    const _dartTemporary7 = this.sourceAttachments;
                    if (_dartTemporary7 === null)
                        return null;
                    return _dartTemporary7.keys.forEach((() => {
                        const _dartTemporary9 = (() => {
                            const _dartTemporary8 = this.sourceRegistrar;
                            if (_dartTemporary8 === null)
                                throw new TypeError("Null check operator used on a null value");
                            return _dartTemporary8!;
                        })();
                        return dartMethodTearOff(_dartTemporary9, _dartTemporary9.remove);
                    })());
                })();
            }
            this.sourceRegistrar = newRegistrar;
            if (this.sourceRegistrar !== null) {
                (() => {
                    const _dartTemporary10 = this.sourceAttachments;
                    if (_dartTemporary10 === null)
                        return null;
                    return _dartTemporary10.keys.forEach((() => {
                        const _dartTemporary12 = (() => {
                            const _dartTemporary11 = this.sourceRegistrar;
                            if (_dartTemporary11 === null)
                                throw new TypeError("Null check operator used on a null value");
                            return _dartTemporary11!;
                        })();
                        return dartMethodTearOff(_dartTemporary12, _dartTemporary12.add);
                    })());
                })();
            }
        }
    }
    sourceAdd(selectable: Selectable): void {
        const attachment: () => void = this.guardedSourceListener(selectable);
        selectionAddListener(selectable, attachment);
        this.sourceAttachments ??= (() => {
            const _dartTemporary13 = createSelectableMap();
            return _dartTemporary13;
        })();
        (() => {
            const _dartTemporary17 = (() => {
                const _dartTemporary16 = this.sourceAttachments;
                if (_dartTemporary16 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary16!;
            })();
            const _dartTemporary14 = selectable;
            const _dartTemporary15 = attachment;
            dartMapWrite(_dartTemporary17, _dartTemporary14, _dartTemporary15);
            return _dartTemporary15;
        })();
        (() => {
            const _dartTemporary18 = this.sourceRegistrar;
            if (_dartTemporary18 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary18!;
        })().add(selectable);
        if (selectable.value.hasSelection) {
            this._dart_66ef66b3420e175b_updateSelectablesWithSelections(selectable, { add: true });
        }
    }
    sourceRemove(selectable: Selectable): void {
        if (this.sourceAttachments === null) {
            return;
        }
        if (FoundationBuildMode.debug)
            invariant((() => {
                const _dartTemporary19 = this.sourceAttachments;
                if (_dartTemporary19 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary19!;
            })().containsKey(selectable), "generated-source-assert", "Pinned Dart assertion failed");
        const attachment: () => void = (() => {
            const _dartTemporary21 = (() => {
                const _dartTemporary20 = this.sourceAttachments;
                if (_dartTemporary20 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary20!;
            })().remove(selectable);
            if (_dartTemporary21 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary21!;
        })();
        selectionRemoveListener(selectable, attachment);
        (() => {
            const _dartTemporary22 = this.sourceRegistrar;
            if (_dartTemporary22 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary22!;
        })().remove(selectable);
        this._dart_66ef66b3420e175b_updateSelectablesWithSelections(selectable, { add: false });
    }
    override sourceDispose(): void {
        if (this.sourceAttachments !== null) {
            for (const _dartTemporary26 of (() => {
                const _dartTemporary27 = this.sourceAttachments;
                if (_dartTemporary27 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary27!;
            })().keys) {
                const selectable: Selectable = _dartTemporary26;
                {
                    (() => {
                        const _dartTemporary23 = this.sourceRegistrar;
                        if (_dartTemporary23 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary23!;
                    })().remove(selectable);
                    selectionRemoveListener(selectable, (() => {
                        const _dartTemporary25 = dartMapRead((() => {
                            const _dartTemporary24 = this.sourceAttachments;
                            if (_dartTemporary24 === null)
                                throw new TypeError("Null check operator used on a null value");
                            return _dartTemporary24!;
                        })(), selectable);
                        if (_dartTemporary25 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary25!;
                    })());
                }
            }
            this.sourceAttachments = null;
        }
        this.sourceSelections = null;
        super.sourceBaseDispose();
    }
    override build(context: BuildContext): Widget {
        super.build(context);
        if (this.sourceRegistrar === null) {
            return this.widget.child;
        }
        return new SelectionRegistrarScope({ registrar: this, child: this.widget.child });
    }
}
export function _createErrorWidget(exception: {}, stackTrace: HostStackTrace): Widget {
    const details: FlutterErrorDetails = new FlutterErrorDetails({ exception: exception, stack: stackTrace, library: "widgets library", context: new ErrorDescription("building") });
    FlutterError.reportError(details);
    return ErrorWidget.builder(details);
}

export function isTwoDimensionalChildDelegate(value:unknown):value is SourceTwoDimensionalChildDelegate{return value instanceof SourceTwoDimensionalChildDelegate;}
export function castTwoDimensionalChildDelegate(value:unknown):SourceTwoDimensionalChildDelegate{if(!isTwoDimensionalChildDelegate(value))throw new TypeError('Expected TwoDimensionalChildDelegate');return value;}
export function isTwoDimensionalChildListDelegate(value:unknown):value is SourceTwoDimensionalChildListDelegate{return value instanceof SourceTwoDimensionalChildListDelegate;}
export function castTwoDimensionalChildListDelegate(value:unknown):SourceTwoDimensionalChildListDelegate{if(!isTwoDimensionalChildListDelegate(value))throw new TypeError('Expected TwoDimensionalChildListDelegate');return value;}
