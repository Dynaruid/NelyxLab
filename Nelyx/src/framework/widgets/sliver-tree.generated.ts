// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from packages/flutter/lib/src/widgets/sliver_tree.dart; SHA256 e375ca7e7bca6a448dd3e88cb1bf07096e8d82ec5a006e03b070fbe7bdcf0cd2
import { Widget } from "../widgets/framework.ts";
import { State } from "../widgets/framework.ts";
import { Key } from "../../foundation/key.ts";
import { UniqueKey } from "../../foundation/key.ts";
import { IntProperty } from "../../foundation/diagnostic-properties.ts";
import { RenderObject } from "../rendering/object.ts";
import { SliverVariedExtentList } from "../widgets/sliver.ts";
import { AnimationStyle } from "../animation/animation-style.ts";
import { Curve } from "../animation/curves.ts";
import { Curves } from "../animation/curves.ts";
import { AnimationController } from "../animation/animation-controller.ts";
import { CurvedAnimation } from "../animation/animations.ts";
import { DartMap } from "../../foundation/dart-collections.ts";
import { checkedInteger } from "../../ui/value-math.ts";
import { protect } from "../../ui/value-math.ts";
import { invariant } from "../../foundation/errors.ts";
import { FoundationBuildMode } from "../../foundation/constants.ts";
import { dartNamedRecord } from "../../foundation/dart-named-record.ts";
import { dartNamedRecordRead } from "../../foundation/dart-named-record.ts";
import { dartStaticRead } from "../../foundation/dart-static-field.ts";
import { dartStaticWrite } from "../../foundation/dart-static-field.ts";
import { dartStaticSeal } from "../../foundation/dart-static-field.ts";
import { SourceTreeSliverNodeParentData } from "../rendering/sliver-tree.generated.ts";
import { SourceTreeSliverIndentationType } from "../rendering/sliver-tree.generated.ts";
import { SourceRenderTreeSliver } from "../rendering/sliver-tree.generated.ts";
import { treeContentString } from "../widgets/tree-sliver-source-adapter.ts";
import { treeDepthString } from "../widgets/tree-sliver-source-adapter.ts";
import { findTreeSliverState } from "./tree-widget-source-types.ts";
import { ErrorSummary } from "../../foundation/diagnostics.ts";
import { ErrorDescription } from "../../foundation/diagnostics.ts";
import { ErrorHint } from "../../foundation/diagnostics.ts";
import { FlutterError } from "../../foundation/flutter-error.ts";
import { TreeStatefulHost } from "./tree-sliver-source-adapter.ts";
import { SliverLayoutDimensions } from "../rendering/sliver.ts";
import { treeAnimationStyleConstant } from "./tree-sliver-source-adapter.ts";
import { SizedBox } from "./basic.ts";
import { Text } from "./basic.ts";
import { IndexedSemantics } from "./basic.ts";
import { EdgeInsets } from "../painting/edge-insets.ts";
import { GestureDetector } from "./gesture-detector.ts";
import { AnimatedRotation } from "./implicit-animations.ts";
import { treeBuilder } from "./tree-sliver-source-adapter.ts";
import { treePadding } from "./tree-sliver-source-adapter.ts";
import { treeRow } from "./tree-sliver-source-adapter.ts";
import { treeSquare } from "./tree-sliver-source-adapter.ts";
import { treeEdgeInsetsConstant } from "./tree-sliver-source-adapter.ts";
import { treeSpacerConstant } from "./tree-sliver-source-adapter.ts";
import { TreeArrowIconData } from "./tree-sliver-source-adapter.ts";
import { treeArrowDataConstant } from "./tree-sliver-source-adapter.ts";
import { TreeArrowIcon } from "./tree-sliver-source-adapter.ts";
import { treeArrowConstant } from "./tree-sliver-source-adapter.ts";
import { treeIndexKey } from "./tree-sliver-source-adapter.ts";
import { TreeStateHost } from "./tree-sliver-source-adapter.ts";
import { dartMethodTearOff } from "../../foundation/dart-method-tear-off.ts";
import { treeNodeAnimationMap } from "./tree-widget-source-types.ts";
import { treeNodesAnimationMap } from "./tree-widget-source-types.ts";
import { treeListEmpty } from "./tree-sliver-source-adapter.ts";
import { treeListNotEmpty } from "./tree-sliver-source-adapter.ts";
import { treeListRead } from "./tree-sliver-source-adapter.ts";
import { treeListClear } from "./tree-sliver-source-adapter.ts";
import { treeListAdd } from "./tree-sliver-source-adapter.ts";
import { treeListAddAll } from "./tree-sliver-source-adapter.ts";
import { treeListIndexOf } from "./tree-sliver-source-adapter.ts";
import { treeListContains } from "./tree-sliver-source-adapter.ts";
import { treeListReversed } from "./tree-sliver-source-adapter.ts";
import { dartMapRead } from "../../foundation/dart-collections.ts";
import { dartMapWrite } from "../../foundation/dart-collections.ts";
import { treeIterableForEach } from "./tree-sliver-source-adapter.ts";
import { AnimationStatus } from "../animation/animation.ts";
import { TreeParentDataHost } from "./tree-widget-source-types.ts";
import { castTreeParentData } from "../rendering/tree-sliver-source-types.ts";
import { castTreeSliverElement } from "./tree-widget-source-types.ts";
import { isTreeRenderObject } from "./tree-widget-source-types.ts";
import { treeRenderParent } from "./tree-sliver-source-adapter.ts";
import { treeRepaintBoundary } from "./tree-sliver-source-adapter.ts";
import { SliverChildBuilderDelegate } from "./scroll-delegate.ts";
import { RenderTreeSliver } from "../rendering/tree-sliver.ts";
import { SliverMultiBoxAdaptorElement } from "./sliver.ts";
import { treeDescribeElement } from "./tree-sliver-source-adapter.ts";
import { treeTapDetector } from "./tree-sliver-source-adapter.ts";
import { treeFindChildIndex } from "./tree-widget-source-types.ts";
import { treeSliverWithExtentContract } from "./tree-widget-source-types.ts";
import { boxSourceDartInt } from "../../foundation/dart-numeric.ts";
import { boxSourceDartDouble } from "../../foundation/dart-numeric.ts";
import { applyDartType } from "../../foundation/dart-type-witness.ts";
import { readDartType } from "../../foundation/dart-type-witness.ts";
import { nullableDartType } from "../../foundation/dart-type-witness.ts";
import { dartObjectType } from "../../foundation/dart-type-witness.ts";
import { createDartListLiteral } from "../../foundation/dart-mutable-list.ts";
import { dartListType } from "../../foundation/dart-mutable-list.ts";
import { treeCoreStateType } from "./tree-generic-witnesses.ts";
import { treeTickerStateType } from "./tree-generic-witnesses.ts";
import { treeStateMixinType } from "./tree-generic-witnesses.ts";
import { treeStatefulWidgetType } from "./tree-generic-witnesses.ts";
import { castSourceDartType } from "../../foundation/dart-source-type.ts";
import { treeObjectEquals } from "./tree-widget-source-types.ts";
import { captureTreeDartType } from "./tree-widget-source-types.ts";
import type { BuildContext } from "../widgets/framework.ts";
import type { DartNamedRecord } from "../../foundation/dart-named-record.ts";
import type { DiagnosticPropertiesBuilder } from "../../foundation/diagnostics.ts";
import type { TreeRuntimeType } from "./tree-sliver-source-adapter.ts";
import type { DartTypeWitness } from "../../foundation/dart-type-witness.ts";
import type { DartInt } from "../../foundation/dart-numeric.ts";
import type { DartDouble } from "../../foundation/dart-numeric.ts";
import type { DartMutableList } from "../../foundation/dart-mutable-list.ts";
/**
 * @dartType double
 * @dartTypeOrigin explicit
 */
export const _kDefaultRowExtent: number = 40;
export class SourceTreeSliverNode<T extends {} | null> {
    readonly _dart_8cfd46f68e2cffcc_content: T;
    readonly _dart_8cfd46f68e2cffcc_children: DartMutableList<SourceTreeSliverNode<T>>;
    _dart_8cfd46f68e2cffcc_expanded: boolean;
    /**
     * @dartType int?
     * @dartTypeOrigin explicit
     */
    _dart_8cfd46f68e2cffcc_depth: number | null;
    _dart_8cfd46f68e2cffcc_parent: SourceTreeSliverNode<T> | null;
    constructor(_dartTemporary0: DartTypeWitness<T>, content: T, { children = null, expanded = false }: {
        readonly children?: DartMutableList<SourceTreeSliverNode<T>> | null;
        readonly expanded?: boolean;
    } = {}) {
        castSourceDartType<T>(content, _dartTemporary0);
        castSourceDartType<DartMutableList<SourceTreeSliverNode<T>> | null>(children, nullableDartType<DartMutableList<SourceTreeSliverNode<T>>>(dartListType<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [_dartTemporary0], []))));
        const _initialField0 = ((() => {
            const _dartTemporary1 = children;
            return _dartTemporary1 === null ? null : treeListNotEmpty(_dartTemporary1);
        })() ?? false) && expanded;
        const _initialField1 = content;
        const _initialField2 = children ?? createDartListLiteral<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [_dartTemporary0], []), []);
        captureTreeDartType(this, applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [_dartTemporary0], []));
        this._dart_8cfd46f68e2cffcc_content = _initialField1;
        this._dart_8cfd46f68e2cffcc_children = _initialField2;
        this._dart_8cfd46f68e2cffcc_expanded = _initialField0;
        this._dart_8cfd46f68e2cffcc_depth = null;
        this._dart_8cfd46f68e2cffcc_parent = null;
        protect(this, ["_dart_8cfd46f68e2cffcc_content", "_dart_8cfd46f68e2cffcc_children"]);
    }
    get content(): T {
        return this._dart_8cfd46f68e2cffcc_content;
    }
    get children(): DartMutableList<SourceTreeSliverNode<T>> {
        return this._dart_8cfd46f68e2cffcc_children;
    }
    get isExpanded(): boolean {
        return this._dart_8cfd46f68e2cffcc_expanded;
    }
    /**
     * @dartReturn int?
     * @dartReturnOrigin explicit
     */
    get depth(): number | null {
        return this._dart_8cfd46f68e2cffcc_depth;
    }
    get parent(): SourceTreeSliverNode<T> | null {
        return this._dart_8cfd46f68e2cffcc_parent;
    }
    toString(): string {
        return `TreeSliverNode: ${treeContentString(this.content)}, depth: ${(() => {
            const _dartTemporary2 = this.depth === 0 ? "root" : this.depth;
            return _dartTemporary2 === null ? "null" : treeDepthString(_dartTemporary2);
        })()}, ${treeListEmpty(this.children) ? "leaf" : `parent, expanded: ${this.isExpanded}`}`;
    }
}
export class SourceTreeSliverController {
    _dart_8cfd46f68e2cffcc_state: SourceTreeSliverStateMixin<{} | null> | null;
    constructor() {
        captureTreeDartType(this, applyDartType<SourceTreeSliverController>(SourceTreeSliverController, "TreeSliverController", [], []));
        this._dart_8cfd46f68e2cffcc_state = null;
    }
    isExpanded(node: SourceTreeSliverNode<{} | null>): boolean {
        castSourceDartType<SourceTreeSliverNode<{} | null>>(node, applyDartType<SourceTreeSliverNode<{} | null>>(SourceTreeSliverNode, "TreeSliverNode", [nullableDartType<{}>(dartObjectType)], []));
        if (FoundationBuildMode.debug)
            invariant(this._dart_8cfd46f68e2cffcc_state !== null, "generated-source-assert", "Pinned Dart assertion failed");
        return (() => {
            const _dartTemporary3 = this._dart_8cfd46f68e2cffcc_state;
            if (_dartTemporary3 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary3!;
        })().isExpanded(node);
    }
    isActive(node: SourceTreeSliverNode<{} | null>): boolean {
        castSourceDartType<SourceTreeSliverNode<{} | null>>(node, applyDartType<SourceTreeSliverNode<{} | null>>(SourceTreeSliverNode, "TreeSliverNode", [nullableDartType<{}>(dartObjectType)], []));
        if (FoundationBuildMode.debug)
            invariant(this._dart_8cfd46f68e2cffcc_state !== null, "generated-source-assert", "Pinned Dart assertion failed");
        return (() => {
            const _dartTemporary4 = this._dart_8cfd46f68e2cffcc_state;
            if (_dartTemporary4 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary4!;
        })().isActive(node);
    }
    getNodeFor(content: {} | null): SourceTreeSliverNode<{} | null> | null {
        if (FoundationBuildMode.debug)
            invariant(this._dart_8cfd46f68e2cffcc_state !== null, "generated-source-assert", "Pinned Dart assertion failed");
        return (() => {
            const _dartTemporary5 = this._dart_8cfd46f68e2cffcc_state;
            if (_dartTemporary5 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary5!;
        })().getNodeFor(content);
    }
    toggleNode(node: SourceTreeSliverNode<{} | null>): void {
        castSourceDartType<SourceTreeSliverNode<{} | null>>(node, applyDartType<SourceTreeSliverNode<{} | null>>(SourceTreeSliverNode, "TreeSliverNode", [nullableDartType<{}>(dartObjectType)], []));
        if (FoundationBuildMode.debug)
            invariant(this._dart_8cfd46f68e2cffcc_state !== null, "generated-source-assert", "Pinned Dart assertion failed");
        return (() => {
            const _dartTemporary6 = this._dart_8cfd46f68e2cffcc_state;
            if (_dartTemporary6 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary6!;
        })().toggleNode(node);
    }
    expandNode(node: SourceTreeSliverNode<{} | null>): void {
        castSourceDartType<SourceTreeSliverNode<{} | null>>(node, applyDartType<SourceTreeSliverNode<{} | null>>(SourceTreeSliverNode, "TreeSliverNode", [nullableDartType<{}>(dartObjectType)], []));
        if (FoundationBuildMode.debug)
            invariant(this._dart_8cfd46f68e2cffcc_state !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (!node.isExpanded) {
            (() => {
                const _dartTemporary7 = this._dart_8cfd46f68e2cffcc_state;
                if (_dartTemporary7 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary7!;
            })().toggleNode(node);
        }
    }
    expandAll(): void {
        if (FoundationBuildMode.debug)
            invariant(this._dart_8cfd46f68e2cffcc_state !== null, "generated-source-assert", "Pinned Dart assertion failed");
        (() => {
            const _dartTemporary8 = this._dart_8cfd46f68e2cffcc_state;
            if (_dartTemporary8 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary8!;
        })().expandAll();
    }
    collapseAll(): void {
        if (FoundationBuildMode.debug)
            invariant(this._dart_8cfd46f68e2cffcc_state !== null, "generated-source-assert", "Pinned Dart assertion failed");
        (() => {
            const _dartTemporary9 = this._dart_8cfd46f68e2cffcc_state;
            if (_dartTemporary9 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary9!;
        })().collapseAll();
    }
    collapseNode(node: SourceTreeSliverNode<{} | null>): void {
        castSourceDartType<SourceTreeSliverNode<{} | null>>(node, applyDartType<SourceTreeSliverNode<{} | null>>(SourceTreeSliverNode, "TreeSliverNode", [nullableDartType<{}>(dartObjectType)], []));
        if (FoundationBuildMode.debug)
            invariant(this._dart_8cfd46f68e2cffcc_state !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (node.isExpanded) {
            (() => {
                const _dartTemporary10 = this._dart_8cfd46f68e2cffcc_state;
                if (_dartTemporary10 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary10!;
            })().toggleNode(node);
        }
    }
    /**
     * @dartReturn int?
     * @dartReturnOrigin explicit
     */
    getActiveIndexFor(node: SourceTreeSliverNode<{} | null>): number | null {
        castSourceDartType<SourceTreeSliverNode<{} | null>>(node, applyDartType<SourceTreeSliverNode<{} | null>>(SourceTreeSliverNode, "TreeSliverNode", [nullableDartType<{}>(dartObjectType)], []));
        if (FoundationBuildMode.debug)
            invariant(this._dart_8cfd46f68e2cffcc_state !== null, "generated-source-assert", "Pinned Dart assertion failed");
        return (() => {
            const _dartTemporary11 = this._dart_8cfd46f68e2cffcc_state;
            if (_dartTemporary11 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary11!;
        })().getActiveIndexFor(node);
    }
    static of(context: BuildContext): SourceTreeSliverController {
        const result: SourceTreeSliverState<{} | null> | null = findTreeSliverState(context);
        if (result !== null) {
            return (result as SourceTreeSliverState<{} | null>).controller;
        }
        (() => {
            const _dartTemporary12 = FlutterError.fromParts([new ErrorSummary("TreeController.of() called with a context that does not contain a TreeSliver."), new ErrorDescription("No TreeSliver ancestor could be found starting from the context that was passed to TreeController.of(). This usually happens when the context provided is from the same StatefulWidget as that whose build function actually creates the TreeSliver widget being sought."), new ErrorHint("There are several ways to avoid this problem. The simplest is to use a Builder to get a context that is \"under\" the TreeSliver."), new ErrorHint("A more efficient solution is to split your build function into several widgets. This introduces a new context from which you can obtain the TreeSliver. In this solution, you would have an outer widget that creates the TreeSliver populated by instances of your new inner widgets, and then in these inner widgets you would use TreeController.of()."), treeDescribeElement(context, "The context used was")]);
            throw _dartTemporary12;
        })();
    }
    static maybeOf(context: BuildContext): SourceTreeSliverController | null {
        return (() => {
            const _dartTemporary13 = findTreeSliverState(context);
            return _dartTemporary13 === null ? null : _dartTemporary13.controller;
        })();
    }
}
export class SourceTreeSliver<T extends {} | null> extends TreeStatefulHost {
    readonly tree: DartMutableList<SourceTreeSliverNode<T>>;
    readonly treeNodeBuilder: TreeSliverNodeBuilder;
    /**
     * @dartType double Function(TreeSliverNode<Object?>, SliverLayoutDimensions)
     * @dartTypeOrigin explicit
     */
    readonly treeRowExtentBuilder: TreeSliverRowExtentBuilder;
    readonly controller: SourceTreeSliverController | null;
    readonly onNodeToggle: TreeSliverNodeCallback | null;
    readonly toggleAnimationStyle: AnimationStyle | null;
    readonly indentation: SourceTreeSliverIndentationType;
    readonly addAutomaticKeepAlives: boolean;
    readonly addRepaintBoundaries: boolean;
    readonly addSemanticIndexes: boolean;
    /**
     * @dartType int? Function(Widget, int)
     * @dartTypeOrigin explicit
     */
    readonly semanticIndexCallback: (argument0: Widget, argument1: number) => number | null;
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly semanticIndexOffset: number;
    /**
     * @dartType int? Function(Key)?
     * @dartTypeOrigin explicit
     */
    readonly findChildIndexCallback: ((argument0: Key) => number | null) | null;
    static readonly defaultAnimationCurve: Curve = Curves.linear;
    static readonly defaultAnimationDuration: number = 0 + 150 * 1;
    static get defaultToggleAnimationStyle(): AnimationStyle {
        return dartStaticRead<AnimationStyle>(SourceTreeSliver, "package:flutter/src/widgets/sliver_tree.dart::TreeSliver.defaultToggleAnimationStyle:FIELD", (): AnimationStyle => treeAnimationStyleConstant(AnimationStyle, { curve: SourceTreeSliver.defaultAnimationCurve, duration: SourceTreeSliver.defaultAnimationDuration }));
    }
    static set defaultToggleAnimationStyle(value: AnimationStyle) {
        dartStaticWrite<AnimationStyle>(SourceTreeSliver, "package:flutter/src/widgets/sliver_tree.dart::TreeSliver.defaultToggleAnimationStyle:FIELD", value);
    }
    /**
     * @dartParam treeRowExtentBuilder double Function(TreeSliverNode<Object?>, SliverLayoutDimensions)
     * @dartParamOrigin treeRowExtentBuilder inferred
     * @dartParam semanticIndexCallback int? Function(Widget, int)
     * @dartParamOrigin semanticIndexCallback inferred
     * @dartParam semanticIndexOffset int
     * @dartParamOrigin semanticIndexOffset inferred
     * @dartParam findChildIndexCallback int? Function(Key)?
     * @dartParamOrigin findChildIndexCallback inferred
     */
    constructor(_dartTemporary14: DartTypeWitness<T>, { key = null, tree, treeNodeBuilder = SourceTreeSliver.defaultTreeNodeBuilder, treeRowExtentBuilder = SourceTreeSliver.defaultTreeRowExtentBuilder, controller = null, onNodeToggle = null, toggleAnimationStyle = null, indentation = SourceTreeSliverIndentationType.standard, addAutomaticKeepAlives = true, addRepaintBoundaries = true, addSemanticIndexes = true, semanticIndexCallback = _kDefaultSemanticIndexCallback, semanticIndexOffset = 0, findChildIndexCallback = null }: {
        readonly key?: Key | null;
        readonly tree: DartMutableList<SourceTreeSliverNode<T>>;
        readonly treeNodeBuilder?: TreeSliverNodeBuilder;
        readonly treeRowExtentBuilder?: TreeSliverRowExtentBuilder;
        readonly controller?: SourceTreeSliverController | null;
        readonly onNodeToggle?: TreeSliverNodeCallback | null;
        readonly toggleAnimationStyle?: AnimationStyle | null;
        readonly indentation?: SourceTreeSliverIndentationType;
        readonly addAutomaticKeepAlives?: boolean;
        readonly addRepaintBoundaries?: boolean;
        readonly addSemanticIndexes?: boolean;
        readonly semanticIndexCallback?: (argument0: Widget, argument1: number) => number | null;
        readonly semanticIndexOffset?: number;
        readonly findChildIndexCallback?: ((argument0: Key) => number | null) | null;
    }) {
        castSourceDartType<DartMutableList<SourceTreeSliverNode<T>>>(tree, dartListType<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [_dartTemporary14], [])));
        checkedInteger(semanticIndexOffset);
        const _initialField0 = tree;
        const _initialField1 = treeNodeBuilder;
        /**
         * @dartType double Function(TreeSliverNode<Object?>, SliverLayoutDimensions)
         * @dartTypeOrigin inferred
         */
        const _initialField2 = treeRowExtentBuilder;
        const _initialField3 = controller;
        const _initialField4 = onNodeToggle;
        const _initialField5 = toggleAnimationStyle;
        const _initialField6 = indentation;
        const _initialField7 = addAutomaticKeepAlives;
        const _initialField8 = addRepaintBoundaries;
        const _initialField9 = addSemanticIndexes;
        /**
         * @dartType int? Function(Widget, int)
         * @dartTypeOrigin inferred
         */
        const _initialField10 = semanticIndexCallback;
        /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        const _initialField11 = semanticIndexOffset;
        /**
         * @dartType int? Function(Key)?
         * @dartTypeOrigin inferred
         */
        const _initialField12 = findChildIndexCallback;
        super({ key: key });
        captureTreeDartType(this, applyDartType<SourceTreeSliver<T>>(SourceTreeSliver, "TreeSliver", [_dartTemporary14], [treeStatefulWidgetType]));
        this.tree = _initialField0;
        this.treeNodeBuilder = _initialField1;
        this.treeRowExtentBuilder = _initialField2;
        this.controller = _initialField3;
        this.onNodeToggle = _initialField4;
        this.toggleAnimationStyle = _initialField5;
        this.indentation = _initialField6;
        this.addAutomaticKeepAlives = _initialField7;
        this.addRepaintBoundaries = _initialField8;
        this.addSemanticIndexes = _initialField9;
        this.semanticIndexCallback = _initialField10;
        this.semanticIndexOffset = _initialField11;
        this.findChildIndexCallback = _initialField12;
        protect(this, ["tree", "treeNodeBuilder", "treeRowExtentBuilder", "controller", "onNodeToggle", "toggleAnimationStyle", "indentation", "addAutomaticKeepAlives", "addRepaintBoundaries", "addSemanticIndexes", "semanticIndexCallback", "semanticIndexOffset", "findChildIndexCallback"]);
    }
    static wrapChildToToggleNode({ node, child }: {
        readonly node: SourceTreeSliverNode<{} | null>;
        readonly child: Widget;
    }): Widget {
        castSourceDartType<SourceTreeSliverNode<{} | null>>(node, applyDartType<SourceTreeSliverNode<{} | null>>(SourceTreeSliverNode, "TreeSliverNode", [nullableDartType<{}>(dartObjectType)], []));
        return treeBuilder({ builder: (context: BuildContext): GestureDetector => {
                return treeTapDetector({ onTap: (): void => {
                        SourceTreeSliverController.of(context).toggleNode(node);
                    }, child: child });
            } });
    }
    /**
     * @dartReturn double
     * @dartReturnOrigin explicit
     */
    static defaultTreeRowExtentBuilder(node: SourceTreeSliverNode<{} | null>, dimensions: SliverLayoutDimensions): number {
        castSourceDartType<SourceTreeSliverNode<{} | null>>(node, applyDartType<SourceTreeSliverNode<{} | null>>(SourceTreeSliverNode, "TreeSliverNode", [nullableDartType<{}>(dartObjectType)], []));
        return _kDefaultRowExtent;
    }
    static defaultTreeNodeBuilder(context: BuildContext, node: SourceTreeSliverNode<{} | null>, toggleAnimationStyle: AnimationStyle): Widget {
        castSourceDartType<SourceTreeSliverNode<{} | null>>(node, applyDartType<SourceTreeSliverNode<{} | null>>(SourceTreeSliverNode, "TreeSliverNode", [nullableDartType<{}>(dartObjectType)], []));
        const animationDuration: number = toggleAnimationStyle.duration ?? SourceTreeSliver.defaultAnimationDuration;
        const animationCurve: Curve = toggleAnimationStyle.curve ?? SourceTreeSliver.defaultAnimationCurve;
        /**
         * @dartType int
         * @dartTypeOrigin explicit
         */
        const index: number = checkedInteger((() => {
            const _dartTemporary15 = SourceTreeSliverController.of(context).getActiveIndexFor(node);
            if (_dartTemporary15 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary15!;
        })());
        return treePadding({ padding: treeEdgeInsetsConstant(EdgeInsets, 8), child: treeRow({ children: [SourceTreeSliver.wrapChildToToggleNode({ node: node, child: treeSquare({ dimension: 30, child: treeListNotEmpty(node.children) ? new AnimatedRotation({ key: treeIndexKey(boxSourceDartInt(checkedInteger(index))), turns: node.isExpanded ? 0.25 : 0, duration: animationDuration, curve: animationCurve, child: treeArrowConstant(TreeArrowIcon, treeArrowDataConstant(TreeArrowIconData, 9658), { size: 14 }) }) : null }) }), treeSpacerConstant(SizedBox, { width: 8 }), new Text(treeContentString(node.content))] }) });
    }
    override createState(): State<SourceTreeSliver<T>> {
        return new SourceTreeSliverState<T>(readDartType<T>(this, SourceTreeSliver, 0));
    }
}
protect(SourceTreeSliver, ["defaultAnimationCurve", "defaultAnimationDuration"]);
dartStaticSeal(SourceTreeSliver, ["defaultToggleAnimationStyle"]);
export class SourceTreeSliverState<T extends {} | null> extends TreeStateHost<SourceTreeSliver<T>> implements SourceTreeSliverStateMixin<T> {
    _dart_8cfd46f68e2cffcc_treeController: SourceTreeSliverController | null;
    readonly _dart_8cfd46f68e2cffcc_activeNodes: DartMutableList<SourceTreeSliverNode<T>>;
    readonly _dart_8cfd46f68e2cffcc_currentAnimationForParent: DartMap<SourceTreeSliverNode<T>, _AnimationRecord>;
    /**
     * @dartType Map<UniqueKey, ({int fromIndex, int toIndex, double value})>
     * @dartTypeOrigin explicit
     */
    readonly _dart_8cfd46f68e2cffcc_activeAnimations: DartMap<UniqueKey, DartNamedRecord<[
    ], {
        readonly "fromIndex": DartInt;
        readonly "toIndex": DartInt;
        readonly "value": DartDouble;
    }>>;
    constructor(_dartTemporary16: DartTypeWitness<T>) {
        const _initialField0: DartMutableList<SourceTreeSliverNode<T>> = createDartListLiteral<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [_dartTemporary16], []), []);
        const _initialField1 = (() => {
            const _dartTemporary17 = treeNodeAnimationMap<T>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [_dartTemporary16], []));
            return _dartTemporary17;
        })();
        /**
         * @dartType Map<UniqueKey, ({int fromIndex, int toIndex, double value})>
         * @dartTypeOrigin inferred
         */
        const _initialField2 = (() => {
            const _dartTemporary18 = treeNodesAnimationMap();
            return _dartTemporary18;
        })();
        super();
        captureTreeDartType(this, applyDartType<SourceTreeSliverState<T>>(SourceTreeSliverState, "_TreeSliverState", [_dartTemporary16], [treeCoreStateType<SourceTreeSliver<T>>(applyDartType<SourceTreeSliver<T>>(SourceTreeSliver, "TreeSliver", [_dartTemporary16], [treeStatefulWidgetType])), treeTickerStateType<SourceTreeSliver<T>>(applyDartType<SourceTreeSliver<T>>(SourceTreeSliver, "TreeSliver", [_dartTemporary16], [treeStatefulWidgetType])), treeStateMixinType<T>(_dartTemporary16)]));
        this._dart_8cfd46f68e2cffcc_treeController = null;
        this._dart_8cfd46f68e2cffcc_activeNodes = _initialField0;
        this._dart_8cfd46f68e2cffcc_currentAnimationForParent = _initialField1;
        this._dart_8cfd46f68e2cffcc_activeAnimations = _initialField2;
        protect(this, ["_dart_8cfd46f68e2cffcc_activeNodes", "_dart_8cfd46f68e2cffcc_currentAnimationForParent", "_dart_8cfd46f68e2cffcc_activeAnimations"]);
    }
    get controller(): SourceTreeSliverController {
        return (() => {
            const _dartTemporary19 = this._dart_8cfd46f68e2cffcc_treeController;
            if (_dartTemporary19 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary19!;
        })();
    }
    _dart_8cfd46f68e2cffcc_shouldUnpackNode(node: SourceTreeSliverNode<T>): boolean {
        castSourceDartType<SourceTreeSliverNode<T>>(node, applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], []));
        if (treeListEmpty(node.children)) {
            return false;
        }
        if (dartMapRead(this._dart_8cfd46f68e2cffcc_currentAnimationForParent, node) !== null) {
            return true;
        }
        return node.isExpanded;
    }
    /**
     * @dartParam depth int
     * @dartParamOrigin depth explicit
     */
    _dart_8cfd46f68e2cffcc_unpackActiveNodes({ depth = 0, nodes = null, parent = null }: {
        readonly depth?: number;
        readonly nodes?: DartMutableList<SourceTreeSliverNode<T>> | null;
        readonly parent?: SourceTreeSliverNode<T> | null;
    } = {}): void {
        castSourceDartType<DartMutableList<SourceTreeSliverNode<T>> | null>(nodes, nullableDartType<DartMutableList<SourceTreeSliverNode<T>>>(dartListType<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], []))));
        castSourceDartType<SourceTreeSliverNode<T> | null>(parent, nullableDartType<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], [])));
        checkedInteger(depth);
        if (nodes === null) {
            treeListClear(this._dart_8cfd46f68e2cffcc_activeNodes);
            nodes = this.widget.tree;
        }
        for (const _dartTemporary23 of nodes as DartMutableList<SourceTreeSliverNode<T>>) {
            const node: SourceTreeSliverNode<T> = _dartTemporary23;
            {
                checkedInteger(node._dart_8cfd46f68e2cffcc_depth = checkedInteger(depth));
                (() => {
                    const _dartTemporary20 = node;
                    const _dartTemporary21 = parent;
                    const _dartTemporary22 = castSourceDartType<typeof _dartTemporary20._dart_8cfd46f68e2cffcc_parent>(_dartTemporary21, nullableDartType(applyDartType(SourceTreeSliverNode, "TreeSliverNode", [readDartType(_dartTemporary20, SourceTreeSliverNode, 0)], [])) as DartTypeWitness<typeof _dartTemporary20._dart_8cfd46f68e2cffcc_parent>);
                    _dartTemporary20._dart_8cfd46f68e2cffcc_parent = _dartTemporary22;
                    return _dartTemporary21;
                })();
                treeListAdd(this._dart_8cfd46f68e2cffcc_activeNodes, node);
                if (this._dart_8cfd46f68e2cffcc_shouldUnpackNode(node)) {
                    this._dart_8cfd46f68e2cffcc_unpackActiveNodes({ depth: checkedInteger(checkedInteger(depth) + 1), nodes: node.children, parent: node });
                }
            }
        }
    }
    override initState(): void {
        this._dart_8cfd46f68e2cffcc_unpackActiveNodes();
        if (FoundationBuildMode.debug)
            invariant((() => {
                const _dartTemporary24 = this.widget.controller;
                return _dartTemporary24 === null ? null : _dartTemporary24._dart_8cfd46f68e2cffcc_state;
            })() === null, "generated-source-assert", "The provided TreeSliverController is already associated with another TreeSliver. A TreeSliverController can only be associated with one TreeSliver.");
        this._dart_8cfd46f68e2cffcc_treeController = this.widget.controller ?? new SourceTreeSliverController();
        (() => {
            const _dartTemporary25 = this._dart_8cfd46f68e2cffcc_treeController;
            if (_dartTemporary25 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary25!;
        })()._dart_8cfd46f68e2cffcc_state = this;
        super.initState();
    }
    override didUpdateWidget(oldWidget: SourceTreeSliver<T>): void {
        castSourceDartType<SourceTreeSliver<T>>(oldWidget, applyDartType<SourceTreeSliver<T>>(SourceTreeSliver, "TreeSliver", [readDartType<T>(this, SourceTreeSliverState, 0)], [treeStatefulWidgetType]));
        super.didUpdateWidget(oldWidget);
        if (FoundationBuildMode.debug)
            invariant(this._dart_8cfd46f68e2cffcc_treeController !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (oldWidget.controller === null && this.widget.controller !== null) {
            (() => {
                const _dartTemporary26 = this._dart_8cfd46f68e2cffcc_treeController;
                if (_dartTemporary26 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary26!;
            })()._dart_8cfd46f68e2cffcc_state = null;
            this._dart_8cfd46f68e2cffcc_treeController = this.widget.controller;
            (() => {
                const _dartTemporary27 = this._dart_8cfd46f68e2cffcc_treeController;
                if (_dartTemporary27 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary27!;
            })()._dart_8cfd46f68e2cffcc_state = this;
        }
        else if (oldWidget.controller !== null && this.widget.controller === null) {
            if (FoundationBuildMode.debug)
                invariant((() => {
                    const _dartTemporary28 = oldWidget.controller;
                    const _dartTemporary29 = this._dart_8cfd46f68e2cffcc_treeController;
                    return _dartTemporary28 === null || _dartTemporary29 === null ? _dartTemporary28 === _dartTemporary29 : treeObjectEquals(_dartTemporary28, _dartTemporary29);
                })(), "generated-source-assert", "Pinned Dart assertion failed");
            (() => {
                const _dartTemporary30 = oldWidget.controller;
                if (_dartTemporary30 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary30!;
            })()._dart_8cfd46f68e2cffcc_state = null;
            this._dart_8cfd46f68e2cffcc_treeController = new SourceTreeSliverController();
            (() => {
                const _dartTemporary31 = this._dart_8cfd46f68e2cffcc_treeController;
                if (_dartTemporary31 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary31!;
            })()._dart_8cfd46f68e2cffcc_state = this;
        }
        else if (!(() => {
            const _dartTemporary32 = oldWidget.controller;
            const _dartTemporary33 = this.widget.controller;
            return _dartTemporary32 === null || _dartTemporary33 === null ? _dartTemporary32 === _dartTemporary33 : treeObjectEquals(_dartTemporary32, _dartTemporary33);
        })()) {
            if (FoundationBuildMode.debug)
                invariant(oldWidget.controller !== null, "generated-source-assert", "Pinned Dart assertion failed");
            if (FoundationBuildMode.debug)
                invariant(this.widget.controller !== null, "generated-source-assert", "Pinned Dart assertion failed");
            if (FoundationBuildMode.debug)
                invariant((() => {
                    const _dartTemporary34 = oldWidget.controller;
                    const _dartTemporary35 = this._dart_8cfd46f68e2cffcc_treeController;
                    return _dartTemporary34 === null || _dartTemporary35 === null ? _dartTemporary34 === _dartTemporary35 : treeObjectEquals(_dartTemporary34, _dartTemporary35);
                })(), "generated-source-assert", "Pinned Dart assertion failed");
            (() => {
                const _dartTemporary36 = this._dart_8cfd46f68e2cffcc_treeController;
                if (_dartTemporary36 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary36!;
            })()._dart_8cfd46f68e2cffcc_state = null;
            this._dart_8cfd46f68e2cffcc_treeController = this.widget.controller;
            (() => {
                const _dartTemporary37 = this._dart_8cfd46f68e2cffcc_treeController;
                if (_dartTemporary37 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary37!;
            })()._dart_8cfd46f68e2cffcc_state = this;
        }
        if (FoundationBuildMode.debug)
            invariant(this._dart_8cfd46f68e2cffcc_treeController !== null, "generated-source-assert", "Pinned Dart assertion failed");
        if (FoundationBuildMode.debug)
            invariant((() => {
                const _dartTemporary38 = this._dart_8cfd46f68e2cffcc_treeController;
                if (_dartTemporary38 === null)
                    throw new TypeError("Null check operator used on a null value");
                return _dartTemporary38!;
            })()._dart_8cfd46f68e2cffcc_state !== null, "generated-source-assert", "Pinned Dart assertion failed");
        this._dart_8cfd46f68e2cffcc_unpackActiveNodes();
    }
    override dispose(): void {
        (() => {
            const _dartTemporary39 = this._dart_8cfd46f68e2cffcc_treeController;
            if (_dartTemporary39 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary39!;
        })()._dart_8cfd46f68e2cffcc_state = null;
        for (const _dartTemporary40 of this._dart_8cfd46f68e2cffcc_currentAnimationForParent.values) {
            const record: _AnimationRecord = _dartTemporary40;
            {
                dartNamedRecordRead(record, "animation", 0, ["animation", "controller", "key"]).dispose();
                dartNamedRecordRead(record, "controller", 0, ["animation", "controller", "key"]).dispose();
            }
        }
        super.dispose();
    }
    override build(context: BuildContext): Widget {
        return treeSliverWithExtentContract(this, { itemCount: checkedInteger(this._dart_8cfd46f68e2cffcc_activeNodes.length), activeAnimations: this._dart_8cfd46f68e2cffcc_activeAnimations, itemBuilder: (context: BuildContext, index: number): SourceTreeNodeParentDataWidget => {
                checkedInteger(index);
                const node: SourceTreeSliverNode<T> = treeListRead(this._dart_8cfd46f68e2cffcc_activeNodes, checkedInteger(index));
                let child: Widget = this.widget.treeNodeBuilder(context, node, this.widget.toggleAnimationStyle ?? SourceTreeSliver.defaultToggleAnimationStyle);
                if (this.widget.addRepaintBoundaries) {
                    child = treeRepaintBoundary({ child: child });
                }
                if (this.widget.addSemanticIndexes) {
                    /**
                     * @dartType int?
                     * @dartTypeOrigin explicit
                     */
                    const semanticIndex: number | null = this.widget.semanticIndexCallback(child, checkedInteger(index));
                    if (semanticIndex !== null) {
                        child = new IndexedSemantics({ index: checkedInteger(checkedInteger(semanticIndex as number) + checkedInteger(this.widget.semanticIndexOffset)), child: child });
                    }
                }
                return new SourceTreeNodeParentDataWidget({ depth: checkedInteger((() => {
                        const _dartTemporary41 = node.depth;
                        if (_dartTemporary41 === null)
                            throw new TypeError("Null check operator used on a null value");
                        return _dartTemporary41!;
                    })()), child: child });
            }, itemExtentBuilder: (index: number, dimensions: SliverLayoutDimensions): number => {
                checkedInteger(index);
                return this.widget.treeRowExtentBuilder(treeListRead(this._dart_8cfd46f68e2cffcc_activeNodes, checkedInteger(index)), dimensions);
            }, addAutomaticKeepAlives: this.widget.addAutomaticKeepAlives, findChildIndexCallback: treeFindChildIndex(this.widget), indentation: this.widget.indentation.value });
    }
    isExpanded(node: SourceTreeSliverNode<T>): boolean {
        castSourceDartType<SourceTreeSliverNode<T>>(node, applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], []));
        return (() => {
            const _dartTemporary42 = this._dart_8cfd46f68e2cffcc_getNode(node.content, this.widget.tree);
            return _dartTemporary42 === null ? null : _dartTemporary42.isExpanded;
        })() ?? false;
    }
    isActive(node: SourceTreeSliverNode<T>): boolean {
        castSourceDartType<SourceTreeSliverNode<T>>(node, applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], []));
        return treeListContains(this._dart_8cfd46f68e2cffcc_activeNodes, node);
    }
    getNodeFor(content: T): SourceTreeSliverNode<T> | null {
        castSourceDartType<T>(content, readDartType<T>(this, SourceTreeSliverState, 0));
        return this._dart_8cfd46f68e2cffcc_getNode(content, this.widget.tree);
    }
    _dart_8cfd46f68e2cffcc_getNode(content: T, tree: DartMutableList<SourceTreeSliverNode<T>>): SourceTreeSliverNode<T> | null {
        castSourceDartType<T>(content, readDartType<T>(this, SourceTreeSliverState, 0));
        castSourceDartType<DartMutableList<SourceTreeSliverNode<T>>>(tree, dartListType<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], [])));
        const nextDepth: DartMutableList<SourceTreeSliverNode<T>> = createDartListLiteral<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], []), []);
        for (const _dartTemporary43 of tree) {
            const node: SourceTreeSliverNode<T> = _dartTemporary43;
            {
                if (treeObjectEquals(node.content, content)) {
                    return node;
                }
                if (treeListNotEmpty(node.children)) {
                    treeListAddAll(nextDepth, node.children);
                }
            }
        }
        if (treeListNotEmpty(nextDepth)) {
            return this._dart_8cfd46f68e2cffcc_getNode(content, nextDepth);
        }
        return null;
    }
    /**
     * @dartReturn int?
     * @dartReturnOrigin explicit
     */
    getActiveIndexFor(node: SourceTreeSliverNode<T>): number | null {
        castSourceDartType<SourceTreeSliverNode<T>>(node, applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], []));
        if (treeListContains(this._dart_8cfd46f68e2cffcc_activeNodes, node)) {
            return checkedInteger(treeListIndexOf(this._dart_8cfd46f68e2cffcc_activeNodes, node));
        }
        return null;
    }
    expandAll(): void {
        const activeNodesToExpand: DartMutableList<SourceTreeSliverNode<T>> = createDartListLiteral<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], []), []);
        this._dart_8cfd46f68e2cffcc_expandAll(this.widget.tree, activeNodesToExpand);
        treeIterableForEach(treeListReversed(activeNodesToExpand), dartMethodTearOff(this, this.toggleNode));
    }
    _dart_8cfd46f68e2cffcc_expandAll(tree: DartMutableList<SourceTreeSliverNode<T>>, activeNodesToExpand: DartMutableList<SourceTreeSliverNode<T>>): void {
        castSourceDartType<DartMutableList<SourceTreeSliverNode<T>>>(tree, dartListType<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], [])));
        castSourceDartType<DartMutableList<SourceTreeSliverNode<T>>>(activeNodesToExpand, dartListType<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], [])));
        for (const _dartTemporary44 of tree) {
            const node: SourceTreeSliverNode<T> = _dartTemporary44;
            {
                if (treeListNotEmpty(node.children)) {
                    this._dart_8cfd46f68e2cffcc_expandAll(node.children, activeNodesToExpand);
                    if (!node.isExpanded) {
                        if (treeListContains(this._dart_8cfd46f68e2cffcc_activeNodes, node)) {
                            treeListAdd(activeNodesToExpand, node);
                        }
                        else {
                            node._dart_8cfd46f68e2cffcc_expanded = true;
                        }
                    }
                }
            }
        }
    }
    collapseAll(): void {
        const activeNodesToCollapse: DartMutableList<SourceTreeSliverNode<T>> = createDartListLiteral<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], []), []);
        this._dart_8cfd46f68e2cffcc_collapseAll(this.widget.tree, activeNodesToCollapse);
        treeIterableForEach(treeListReversed(activeNodesToCollapse), dartMethodTearOff(this, this.toggleNode));
    }
    _dart_8cfd46f68e2cffcc_collapseAll(tree: DartMutableList<SourceTreeSliverNode<T>>, activeNodesToCollapse: DartMutableList<SourceTreeSliverNode<T>>): void {
        castSourceDartType<DartMutableList<SourceTreeSliverNode<T>>>(tree, dartListType<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], [])));
        castSourceDartType<DartMutableList<SourceTreeSliverNode<T>>>(activeNodesToCollapse, dartListType<SourceTreeSliverNode<T>>(applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], [])));
        for (const _dartTemporary45 of tree) {
            const node: SourceTreeSliverNode<T> = _dartTemporary45;
            {
                if (treeListNotEmpty(node.children)) {
                    this._dart_8cfd46f68e2cffcc_collapseAll(node.children, activeNodesToCollapse);
                    if (node.isExpanded) {
                        if (treeListContains(this._dart_8cfd46f68e2cffcc_activeNodes, node)) {
                            treeListAdd(activeNodesToCollapse, node);
                        }
                        else {
                            node._dart_8cfd46f68e2cffcc_expanded = false;
                        }
                    }
                }
            }
        }
    }
    _dart_8cfd46f68e2cffcc_updateActiveAnimations(): void {
        this._dart_8cfd46f68e2cffcc_activeAnimations.clear();
        for (const _dartTemporary50 of this._dart_8cfd46f68e2cffcc_currentAnimationForParent.keys) {
            const node: SourceTreeSliverNode<T> = _dartTemporary50;
            {
                const animationRecord: _AnimationRecord = (() => {
                    const _dartTemporary46 = dartMapRead(this._dart_8cfd46f68e2cffcc_currentAnimationForParent, node);
                    if (_dartTemporary46 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary46!;
                })();
                /**
                 * @dartType int
                 * @dartTypeOrigin explicit
                 */
                const leadingChildIndex: number = checkedInteger(checkedInteger(treeListIndexOf(this._dart_8cfd46f68e2cffcc_activeNodes, node)) + 1);
                /**
                 * @dartType ({int fromIndex, int toIndex, double value})
                 * @dartTypeOrigin explicit
                 */
                const animatingChildren: DartNamedRecord<[
                ], {
                    readonly "fromIndex": DartInt;
                    readonly "toIndex": DartInt;
                    readonly "value": DartDouble;
                }> = dartNamedRecord<[
                ], {
                    readonly "fromIndex": DartInt;
                    readonly "toIndex": DartInt;
                    readonly "value": DartDouble;
                }>(0, ["fromIndex", "toIndex", "value"], [["fromIndex", boxSourceDartInt(checkedInteger(leadingChildIndex))] as const, ["toIndex", boxSourceDartInt(checkedInteger(checkedInteger(checkedInteger(leadingChildIndex) + checkedInteger(node.children.length)) - 1))] as const, ["value", boxSourceDartDouble(dartNamedRecordRead(animationRecord, "animation", 0, ["animation", "controller", "key"]).value)] as const]);
                (() => {
                    const _dartTemporary49 = this._dart_8cfd46f68e2cffcc_activeAnimations;
                    const _dartTemporary47 = dartNamedRecordRead(animationRecord, "key", 0, ["animation", "controller", "key"]);
                    const _dartTemporary48 = animatingChildren;
                    dartMapWrite(_dartTemporary49, _dartTemporary47, _dartTemporary48);
                    return _dartTemporary48;
                })();
            }
        }
    }
    toggleNode(node: SourceTreeSliverNode<T>): void {
        castSourceDartType<SourceTreeSliverNode<T>>(node, applyDartType<SourceTreeSliverNode<T>>(SourceTreeSliverNode, "TreeSliverNode", [readDartType<T>(this, SourceTreeSliverState, 0)], []));
        if (FoundationBuildMode.debug)
            invariant(treeListContains(this._dart_8cfd46f68e2cffcc_activeNodes, node), "generated-source-assert", "Pinned Dart assertion failed");
        if (treeListEmpty(node.children)) {
            return;
        }
        this.setState((): void => {
            node._dart_8cfd46f68e2cffcc_expanded = !node._dart_8cfd46f68e2cffcc_expanded;
            if (this.widget.onNodeToggle !== null) {
                (() => {
                    const _dartTemporary51 = this.widget.onNodeToggle;
                    if (_dartTemporary51 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary51!;
                })()(node);
            }
            if (dartMapRead(this._dart_8cfd46f68e2cffcc_currentAnimationForParent, node) !== null) {
                dartNamedRecordRead((() => {
                    const _dartTemporary52 = dartMapRead(this._dart_8cfd46f68e2cffcc_currentAnimationForParent, node);
                    if (_dartTemporary52 === null)
                        throw new TypeError("Null check operator used on a null value");
                    return _dartTemporary52!;
                })(), "animation", 0, ["animation", "controller", "key"]).dispose();
            }
            if ((() => {
                const _dartTemporary53 = this.widget.toggleAnimationStyle;
                const _dartTemporary54 = AnimationStyle.noAnimation;
                return _dartTemporary53 === null || _dartTemporary54 === null ? _dartTemporary53 === _dartTemporary54 : _dartTemporary53.equals(_dartTemporary54);
            })() || (() => {
                const _dartTemporary55 = this.widget.toggleAnimationStyle;
                return _dartTemporary55 === null ? null : _dartTemporary55.duration;
            })() === 0) {
                this._dart_8cfd46f68e2cffcc_unpackActiveNodes();
                return;
            }
            const controller: AnimationController = (() => {
                const _dartTemporary58 = (() => {
                    const _dartTemporary56 = dartMapRead(this._dart_8cfd46f68e2cffcc_currentAnimationForParent, node);
                    if (_dartTemporary56 === null)
                        return null;
                    return dartNamedRecordRead(_dartTemporary56, "controller", 0, ["animation", "controller", "key"]);
                })() ?? new AnimationController({ value: node._dart_8cfd46f68e2cffcc_expanded ? 0 : 1, vsync: this, duration: (() => {
                        const _dartTemporary57 = this.widget.toggleAnimationStyle;
                        return _dartTemporary57 === null ? null : _dartTemporary57.duration;
                    })() ?? SourceTreeSliver.defaultAnimationDuration });
                _dartTemporary58.addStatusListener((status: AnimationStatus): void => {
                    switch (status) {
                        case AnimationStatus.dismissed:
                        case AnimationStatus.completed: {
                            dartNamedRecordRead((() => {
                                const _dartTemporary59 = dartMapRead(this._dart_8cfd46f68e2cffcc_currentAnimationForParent, node);
                                if (_dartTemporary59 === null)
                                    throw new TypeError("Null check operator used on a null value");
                                return _dartTemporary59!;
                            })(), "animation", 0, ["animation", "controller", "key"]).dispose();
                            dartNamedRecordRead((() => {
                                const _dartTemporary60 = dartMapRead(this._dart_8cfd46f68e2cffcc_currentAnimationForParent, node);
                                if (_dartTemporary60 === null)
                                    throw new TypeError("Null check operator used on a null value");
                                return _dartTemporary60!;
                            })(), "controller", 0, ["animation", "controller", "key"]).dispose();
                            this._dart_8cfd46f68e2cffcc_currentAnimationForParent.remove(node);
                            this._dart_8cfd46f68e2cffcc_updateActiveAnimations();
                            if (!node._dart_8cfd46f68e2cffcc_expanded) {
                                this._dart_8cfd46f68e2cffcc_unpackActiveNodes();
                            }
                            break;
                        }
                        case AnimationStatus.forward:
                        case AnimationStatus.reverse: break;
                        default: throw new TypeError("Invalid value outside exhaustive Dart switch");
                    }
                });
                _dartTemporary58.addListener((): void => {
                    this.setState((): void => {
                        this._dart_8cfd46f68e2cffcc_updateActiveAnimations();
                    });
                });
                return _dartTemporary58;
            })();
            switch (controller.status) {
                case AnimationStatus.forward:
                case AnimationStatus.reverse: {
                    controller.stop();
                    break;
                }
                case AnimationStatus.dismissed:
                case AnimationStatus.completed: break;
                default: throw new TypeError("Invalid value outside exhaustive Dart switch");
            }
            const newAnimation: CurvedAnimation = new CurvedAnimation({ parent: controller, curve: (() => {
                    const _dartTemporary61 = this.widget.toggleAnimationStyle;
                    return _dartTemporary61 === null ? null : _dartTemporary61.curve;
                })() ?? SourceTreeSliver.defaultAnimationCurve });
            (() => {
                const _dartTemporary64 = this._dart_8cfd46f68e2cffcc_currentAnimationForParent;
                const _dartTemporary62 = node;
                const _dartTemporary63 = dartNamedRecord<[
                ], {
                    readonly "animation": CurvedAnimation;
                    readonly "controller": AnimationController;
                    readonly "key": UniqueKey;
                }>(0, ["animation", "controller", "key"], [["controller", controller] as const, ["animation", newAnimation] as const, ["key", new UniqueKey()] as const]);
                dartMapWrite(_dartTemporary64, _dartTemporary62, _dartTemporary63);
                return _dartTemporary63;
            })();
            switch (node._dart_8cfd46f68e2cffcc_expanded) {
                case true: {
                    this._dart_8cfd46f68e2cffcc_unpackActiveNodes();
                    controller.forward();
                    break;
                }
                case false: {
                    controller.reverse();
                    break;
                }
                default: throw new TypeError("Invalid value outside exhaustive Dart switch");
            }
        });
    }
}
export class SourceTreeNodeParentDataWidget extends TreeParentDataHost<SourceTreeSliverNodeParentData> {
    /**
     * @dartType int
     * @dartTypeOrigin explicit
     */
    readonly depth: number;
    /**
     * @dartParam depth int
     * @dartParamOrigin depth inferred
     */
    constructor({ depth, child }: {
        readonly depth: number;
        readonly child: Widget;
    }) {
        checkedInteger(depth);
        /**
         * @dartType int
         * @dartTypeOrigin inferred
         */
        const _initialField0 = depth;
        if (FoundationBuildMode.debug)
            invariant(checkedInteger(depth) >= 0, "generated-source-assert", "Pinned Dart assertion failed");
        super({ child: child });
        this.depth = _initialField0;
        protect(this, ["depth"]);
    }
    override applyParentData(renderObject: RenderObject): void {
        const parentData: SourceTreeSliverNodeParentData = castTreeParentData((() => {
            const _dartTemporary65 = renderObject.parentData;
            if (_dartTemporary65 === null)
                throw new TypeError("Null check operator used on a null value");
            return _dartTemporary65!;
        })());
        let needsLayout: boolean = false;
        if (checkedInteger(parentData.depth) !== checkedInteger(this.depth)) {
            if (FoundationBuildMode.debug)
                invariant(checkedInteger(this.depth) >= 0, "generated-source-assert", "Pinned Dart assertion failed");
            checkedInteger(parentData.depth = checkedInteger(this.depth));
            needsLayout = true;
        }
        if (needsLayout) {
            (treeRenderParent(renderObject)?.markNeedsLayout() ?? null);
        }
    }
    override get debugTypicalAncestorWidgetClass(): TreeRuntimeType {
        return SourceSliverTree;
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        properties.add(new IntProperty("depth", checkedInteger(this.depth)));
    }
}
export class SourceSliverTree extends SliverVariedExtentList {
    /**
     * @dartType Map<UniqueKey, ({int fromIndex, int toIndex, double value})>
     * @dartTypeOrigin explicit
     */
    readonly activeAnimations: DartMap<UniqueKey, DartNamedRecord<[
    ], {
        readonly "fromIndex": DartInt;
        readonly "toIndex": DartInt;
        readonly "value": DartDouble;
    }>>;
    /**
     * @dartType double
     * @dartTypeOrigin explicit
     */
    readonly indentation: number;
    /**
     * @dartParam itemBuilder Widget? Function(BuildContext, int)
     * @dartParamOrigin itemBuilder explicit
     * @dartParam itemExtentBuilder double? Function(int, SliverLayoutDimensions)
     * @dartParamOrigin itemExtentBuilder inferred
     * @dartParam activeAnimations Map<UniqueKey, ({int fromIndex, int toIndex, double value})>
     * @dartParamOrigin activeAnimations inferred
     * @dartParam indentation double
     * @dartParamOrigin indentation inferred
     * @dartParam findChildIndexCallback int? Function(Key)?
     * @dartParamOrigin findChildIndexCallback explicit
     * @dartParam itemCount int
     * @dartParamOrigin itemCount explicit
     */
    constructor({ itemBuilder, itemExtentBuilder, activeAnimations, indentation, findChildIndexCallback = null, itemCount, addAutomaticKeepAlives = true }: {
        readonly itemBuilder: (argument0: BuildContext, argument1: number) => Widget | null;
        readonly itemExtentBuilder: (argument0: number, argument1: SliverLayoutDimensions) => number | null;
        readonly activeAnimations: DartMap<UniqueKey, DartNamedRecord<[
        ], {
            readonly "fromIndex": DartInt;
            readonly "toIndex": DartInt;
            readonly "value": DartDouble;
        }>>;
        readonly indentation: number;
        readonly findChildIndexCallback?: ((argument0: Key) => number | null) | null;
        readonly itemCount: number;
        readonly addAutomaticKeepAlives?: boolean;
    }) {
        checkedInteger(itemCount);
        /**
         * @dartType Map<UniqueKey, ({int fromIndex, int toIndex, double value})>
         * @dartTypeOrigin inferred
         */
        const _initialField0 = activeAnimations;
        /**
         * @dartType double
         * @dartTypeOrigin inferred
         */
        const _initialField1 = indentation;
        super({ delegate: new SliverChildBuilderDelegate(itemBuilder, { findChildIndexCallback: findChildIndexCallback, childCount: checkedInteger(itemCount), addAutomaticKeepAlives: addAutomaticKeepAlives, addRepaintBoundaries: false, addSemanticIndexes: false }), itemExtentBuilder: itemExtentBuilder });
        this.activeAnimations = _initialField0;
        this.indentation = _initialField1;
        protect(this, ["activeAnimations", "indentation"]);
    }
    override createRenderObject(context: BuildContext): SourceRenderTreeSliver {
        const element: SliverMultiBoxAdaptorElement = castTreeSliverElement(context);
        return new RenderTreeSliver({ itemExtentBuilder: this.itemExtentBuilder, activeAnimations: this.activeAnimations, indentation: this.indentation, childManager: element });
    }
    override updateRenderObject(context: BuildContext, renderObject: SourceRenderTreeSliver): void {
        if (!(isTreeRenderObject(renderObject)))
            throw new TypeError("Invalid covariant argument: renderObject");
        (() => {
            const _dartTemporary66 = renderObject;
            _dartTemporary66.itemExtentBuilder = this.itemExtentBuilder;
            _dartTemporary66.activeAnimations = this.activeAnimations;
            _dartTemporary66.indentation = this.indentation;
            return _dartTemporary66;
        })();
    }
}
export interface SourceTreeSliverStateMixin<T extends {} | null> {
    isExpanded(node: SourceTreeSliverNode<T>): boolean;
    isActive(node: SourceTreeSliverNode<T>): boolean;
    toggleNode(node: SourceTreeSliverNode<T>): void;
    collapseAll(): void;
    expandAll(): void;
    getNodeFor(content: T): SourceTreeSliverNode<T> | null;
    /**
     * @dartReturn int?
     * @dartReturnOrigin explicit
     */
    getActiveIndexFor(node: SourceTreeSliverNode<T>): number | null;
}
/**
 * @dartParam localIndex int
 * @dartParamOrigin localIndex explicit
 * @dartReturn int
 * @dartReturnOrigin explicit
 */
export function _kDefaultSemanticIndexCallback(_: Widget, localIndex: number): number {
    checkedInteger(localIndex);
    return checkedInteger(localIndex);
}
export type TreeSliverNodeBuilder = (context: BuildContext, node: SourceTreeSliverNode<{} | null>, animationStyle: AnimationStyle) => Widget;
/**
 * @dartType double Function(TreeSliverNode<Object?>, SliverLayoutDimensions)
 * @dartTypeOrigin explicit
 * @dartReturn double
 * @dartReturnOrigin explicit
 */
export type TreeSliverRowExtentBuilder = (node: SourceTreeSliverNode<{} | null>, dimensions: SliverLayoutDimensions) => number;
export type TreeSliverNodeCallback = (node: SourceTreeSliverNode<{} | null>) => void;
export type _AnimationRecord = DartNamedRecord<[
], {
    readonly "animation": CurvedAnimation;
    readonly "controller": AnimationController;
    readonly "key": UniqueKey;
}>;
