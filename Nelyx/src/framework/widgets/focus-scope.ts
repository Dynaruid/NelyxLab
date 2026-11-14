// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter widgets/focus_scope.dart at the recorded pin.
import { FoundationPlatform } from '../../foundation/platform.ts';
import { invariant } from '../../foundation/errors.ts';
import { FocusNode, FocusScopeNode } from './focus.ts';
import type { FocusAttachment, FocusNodeOptions, FocusAttachmentOptions } from './focus.ts';
import { StatefulWidget, State, StatelessWidget, Element } from './framework.ts';
import type { Widget, BuildContext, WidgetOptions } from './framework.ts';
import { InheritedNotifier } from './inherited-notifier.ts';
import { markFocusScope } from './focus-tree-context.ts';
import { Semantics } from './semantics.ts';
import type { TraversalEdgeBehavior } from './focus-traversal-policy.ts';
export interface FocusOptions extends WidgetOptions {
  readonly focusNode?: FocusNode | null;
  readonly parentNode?: FocusNode | null;
  readonly autofocus?: boolean;
  readonly onFocusChange?: (hasFocus: boolean) => void;
  readonly onKeyEvent?: FocusNodeOptions['onKeyEvent'];
  readonly onKey?: FocusNodeOptions['onKey'];
  readonly canRequestFocus?: boolean | null;
  readonly skipTraversal?: boolean | null;
  readonly descendantsAreFocusable?: boolean | null;
  readonly descendantsAreTraversable?: boolean | null;
  readonly includeSemantics?: boolean;
  readonly debugLabel?: string | null;
}
class FocusInheritedScope extends InheritedNotifier<FocusNode> {
  constructor(node: FocusNode, child: Widget) {
    super(node, child);
    markFocusScope(this, node);
  }
}
const external = new WeakSet<Focus>();
let nextSemanticsId = 0;
export class Focus extends StatefulWidget {
  readonly child: Widget;
  readonly options: Readonly<FocusOptions>;
  constructor(child: Widget, options: FocusOptions = {}) {
    super(options.key ?? null);
    for (const value of [
      options.canRequestFocus,
      options.skipTraversal,
      options.descendantsAreFocusable,
      options.descendantsAreTraversable,
      options.autofocus,
      options.includeSemantics,
    ])
      invariant(
        value == null || typeof value === 'boolean',
        'invalid-focus-flags',
        'Focus options must be boolean',
      );
    this.child = child;
    this.options = Object.freeze({ ...options });
  }
  get focusNode(): FocusNode | null {
    return this.options.focusNode ?? null;
  }
  get parentNode(): FocusNode | null {
    return this.options.parentNode ?? null;
  }
  get autofocus(): boolean {
    return this.options.autofocus ?? false;
  }
  get includeSemantics(): boolean {
    return this.options.includeSemantics ?? true;
  }
  get onFocusChange(): FocusOptions['onFocusChange'] {
    return this.options.onFocusChange;
  }
  get onKeyEvent(): FocusNodeOptions['onKeyEvent'] {
    return external.has(this)
      ? this.focusNode!.onKeyEvent
      : (this.options.onKeyEvent ?? this.focusNode?.onKeyEvent);
  }
  get onKey(): FocusNodeOptions['onKey'] {
    return external.has(this)
      ? this.focusNode!.onKey
      : (this.options.onKey ?? this.focusNode?.onKey);
  }
  get canRequestFocus(): boolean {
    return external.has(this)
      ? this.focusNode!.canRequestFocus
      : (this.options.canRequestFocus ?? this.focusNode?.canRequestFocus ?? true);
  }
  get skipTraversal(): boolean {
    return external.has(this)
      ? this.focusNode!.skipTraversal
      : (this.options.skipTraversal ?? this.focusNode?.skipTraversal ?? false);
  }
  get descendantsAreFocusable(): boolean {
    return external.has(this)
      ? this.focusNode!.descendantsAreFocusable
      : (this.options.descendantsAreFocusable ?? this.focusNode?.descendantsAreFocusable ?? true);
  }
  get descendantsAreTraversable(): boolean {
    return external.has(this)
      ? this.focusNode!.descendantsAreTraversable
      : (this.options.descendantsAreTraversable ??
          this.focusNode?.descendantsAreTraversable ??
          true);
  }
  get debugLabel(): string | null {
    return external.has(this)
      ? this.focusNode!.debugLabel
      : (this.options.debugLabel ?? this.focusNode?.debugLabel ?? null);
  }
  static withExternalFocusNode(
    child: Widget,
    options: Omit<
      FocusOptions,
      | 'focusNode'
      | 'canRequestFocus'
      | 'skipTraversal'
      | 'descendantsAreFocusable'
      | 'descendantsAreTraversable'
      | 'onKeyEvent'
      | 'onKey'
      | 'debugLabel'
    > & { readonly focusNode: FocusNode },
  ): Focus {
    return new FocusWithExternalFocusNode(child, options);
  }
  static maybeOf(
    context: BuildContext,
    {
      scopeOk = false,
      createDependency = true,
    }: { readonly scopeOk?: boolean; readonly createDependency?: boolean } = {},
  ): FocusNode | null {
    const scope = createDependency
        ? context.maybeDependOn(FocusInheritedScope)
        : (context.getElementForInheritedWidgetOfExactType(FocusInheritedScope)?.widget as
            | FocusInheritedScope
            | undefined),
      node = scope?.notifier ?? null;
    return !scopeOk && node instanceof FocusScopeNode ? null : node;
  }
  static of(
    context: BuildContext,
    options: { readonly scopeOk?: boolean; readonly createDependency?: boolean } = {},
  ): FocusNode {
    const node = Focus.maybeOf(context, options);
    invariant(node, 'missing-focus', 'No Focus ancestor before the nearest FocusScope');
    return node;
  }
  /** @internal Core input owners provide nonvisual OS focus commands. */
  get attachmentCommands(): Pick<FocusAttachmentOptions, 'focus' | 'blur' | 'reveal'> {
    return {};
  }
  createState(): State {
    return new FocusState();
  }
}
class FocusWithExternalFocusNode extends Focus {
  constructor(child: Widget, options: FocusOptions & { readonly focusNode: FocusNode }) {
    super(child, options);
    external.add(this);
  }
}
export interface FocusScopeOptions extends Omit<FocusOptions, 'focusNode'> {
  readonly node?: FocusScopeNode | null;
  readonly traversalEdgeBehavior?: TraversalEdgeBehavior | null;
  readonly directionalTraversalEdgeBehavior?: TraversalEdgeBehavior | null;
}
export class FocusScope extends Focus {
  readonly traversalEdgeBehavior: TraversalEdgeBehavior | null;
  readonly directionalTraversalEdgeBehavior: TraversalEdgeBehavior | null;
  constructor(
    child: Widget,
    {
      node = null,
      traversalEdgeBehavior = null,
      directionalTraversalEdgeBehavior = null,
      ...options
    }: FocusScopeOptions = {},
  ) {
    super(child, { ...options, focusNode: node });
    this.traversalEdgeBehavior = traversalEdgeBehavior;
    this.directionalTraversalEdgeBehavior = directionalTraversalEdgeBehavior;
  }
  static override withExternalFocusNode(
    child: Widget,
    options:
      | Parameters<typeof Focus.withExternalFocusNode>[1]
      | (Omit<
          FocusScopeOptions,
          | 'node'
          | 'canRequestFocus'
          | 'skipTraversal'
          | 'descendantsAreFocusable'
          | 'descendantsAreTraversable'
          | 'onKeyEvent'
          | 'onKey'
          | 'debugLabel'
        > & { readonly focusScopeNode: FocusScopeNode }),
  ): FocusScope {
    const node = 'focusScopeNode' in options ? options.focusScopeNode : options.focusNode;
    invariant(
      node instanceof FocusScopeNode,
      'invalid-focus-scope-node',
      'FocusScope requires a FocusScopeNode',
    );
    return new FocusScopeWithExternalFocusNode(child, { ...options, node });
  }
  static override of(
    context: BuildContext,
    { createDependency = true }: { readonly createDependency?: boolean } = {},
  ): FocusScopeNode {
    const node = Focus.maybeOf(context, { scopeOk: true, createDependency });
    if (node?.nearestScope) return node.nearestScope;
    invariant(
      context instanceof Element,
      'invalid-focus-context',
      'FocusScope requires an Element',
    );
    return context.owner.focus.rootScope;
  }
  override createState(): State {
    return new FocusScopeState();
  }
}
class FocusScopeWithExternalFocusNode extends FocusScope {
  constructor(child: Widget, options: FocusScopeOptions) {
    super(child, options);
    external.add(this);
  }
}
class FocusState extends State<Focus> {
  private internal: FocusNode | undefined;
  protected node!: FocusNode;
  private attachment: FocusAttachment | undefined;
  private autofocusHandled = false;
  private queued = false;
  private lastPrimary = false;
  private lastCanRequest = false;
  private lastDescendantsFocusable = false;
  private lastDescendantsTraversable = false;
  protected readonly semanticsId = 'focus-' + ++nextSemanticsId;
  private requestSemanticsFocus = () => this.node.requestFocus();
  private standardState(): boolean {
    const prototype = Object.getPrototypeOf(this.node);
    return (
      (prototype === FocusNode.prototype || prototype === FocusScopeNode.prototype) &&
      !Object.hasOwn(this.node, 'hasPrimaryFocus') &&
      !Object.hasOwn(this.node, 'canRequestFocus') &&
      !Object.hasOwn(this.node, 'descendantsAreFocusable') &&
      !Object.hasOwn(this.node, 'descendantsAreTraversable')
    );
  }
  private readonly changed = () => {
    if (!this.mounted || !(this.context instanceof Element) || !this.context.active) return;
    const standard = this.standardState(),
      primary = standard ? this.node.hasPrimaryFocus : this.lastPrimary,
      canRequest = standard ? this.node.canRequestFocus : this.lastCanRequest,
      focusable = standard ? this.node.descendantsAreFocusable : this.lastDescendantsFocusable,
      traversable = standard
        ? this.node.descendantsAreTraversable
        : this.lastDescendantsTraversable;
    this.widget.onFocusChange?.(this.node.hasFocus);
    if (
      standard &&
      primary === this.lastPrimary &&
      canRequest === this.lastCanRequest &&
      focusable === this.lastDescendantsFocusable &&
      traversable === this.lastDescendantsTraversable
    )
      return;
    this.lastPrimary = primary;
    this.lastCanRequest = canRequest;
    this.lastDescendantsFocusable = focusable;
    this.lastDescendantsTraversable = traversable;
    if (this.context.owner.building) {
      if (!this.queued) {
        this.queued = true;
        this.context.owner.postFrame(() => {
          this.queued = false;
          if (this.mounted && this.context instanceof Element && this.context.active)
            this.setState(() => {});
        });
      }
    } else this.setState(() => {});
  };
  protected createNode(): FocusNode {
    return new FocusNode({
      debugLabel: this.widget.debugLabel,
      canRequestFocus: this.widget.canRequestFocus,
      skipTraversal: this.widget.skipTraversal,
      descendantsAreFocusable: this.widget.descendantsAreFocusable,
      descendantsAreTraversable: this.widget.descendantsAreTraversable,
    });
  }
  private configure(): void {
    if (external.has(this.widget)) return;
    this.node.descendantsAreFocusable = this.widget.descendantsAreFocusable;
    this.node.descendantsAreTraversable = this.widget.descendantsAreTraversable;
    this.node.skipTraversal = this.widget.skipTraversal;
    if (this.widget.options.canRequestFocus != null)
      this.node.canRequestFocus = this.widget.options.canRequestFocus;
    this.node.onKeyEvent = this.widget.onKeyEvent ?? null;
    this.node.onKey = this.widget.onKey ?? null;
    this.node.debugLabel = this.widget.debugLabel;
    if (this.node instanceof FocusScopeNode && this.widget instanceof FocusScope) {
      if (this.widget.traversalEdgeBehavior !== null)
        this.node.traversalEdgeBehavior = this.widget.traversalEdgeBehavior;
      if (this.widget.directionalTraversalEdgeBehavior !== null)
        this.node.directionalTraversalEdgeBehavior = this.widget.directionalTraversalEdgeBehavior;
    }
  }
  private connect(): void {
    this.node = this.widget.focusNode ?? (this.internal ??= this.createNode());
    this.configure();
    if (this.standardState()) {
      this.lastPrimary = this.node.hasPrimaryFocus;
      this.lastCanRequest = this.node.canRequestFocus;
      this.lastDescendantsFocusable = this.node.descendantsAreFocusable;
      this.lastDescendantsTraversable = this.node.descendantsAreTraversable;
    }
    this.attachment = this.node.attach(this.context, {
      ...this.widget.attachmentCommands,
      onKeyEvent: this.widget.onKeyEvent ?? null,
      onKey: this.widget.onKey ?? null,
    });
    this.node.addListener(this.changed);
  }
  override initState(): void {
    super.initState();
    this.connect();
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    Focus.maybeOf(this.context, { scopeOk: true });
    this.attachment!.reparent();
    this.autofocus();
  }
  private autofocus(): void {
    if (!this.autofocusHandled && this.widget.autofocus) {
      FocusScope.of(this.context).autofocus(this.node);
      this.autofocusHandled = true;
    }
  }
  override didUpdateWidget(old: Focus): void {
    super.didUpdateWidget(old);
    if (old.focusNode !== this.widget.focusNode) {
      this.requestSemanticsFocus = () => this.node.requestFocus();
      this.node.removeListener(this.changed);
      this.attachment?.detach();
      this.connect();
    } else {
      this.configure();
      this.attachment = this.node.attach(this.context, {
        ...this.widget.attachmentCommands,
        onKeyEvent: this.widget.onKeyEvent ?? null,
        onKey: this.widget.onKey ?? null,
      });
    }
    if (old.autofocus !== this.widget.autofocus) this.autofocus();
  }
  override deactivate(): void {
    this.attachment?.reparent({ parent: (this.context as Element).owner.focus.rootScope });
    this.autofocusHandled = false;
    super.deactivate();
  }
  override activate(): void {
    super.activate();
    this.attachment?.reparent();
  }
  protected inherited(child: Widget): Widget {
    return new FocusInheritedScope(this.node, child);
  }
  protected semantics(child: Widget): Widget {
    const can = this.node.canRequestFocus;
    return this.widget.includeSemantics
      ? new Semantics({
          child,
          transportId: this.semanticsId,
          focusable: can,
          focused: can ? this.node.hasPrimaryFocus : null,
          onFocus:
            can && FoundationPlatform.defaultTargetPlatform !== 'iOS'
              ? this.requestSemanticsFocus
              : null,
        })
      : child;
  }
  protected compose(child: Widget): Widget {
    return this.inherited(this.semantics(child));
  }
  build(): Widget {
    this.attachment!.reparent({ parent: this.widget.parentNode });
    return this.compose(this.widget.child);
  }
  override dispose(): void {
    const errors: unknown[] = [];
    for (const dispose of [
      () => this.node.removeListener(this.changed),
      () => this.attachment?.detach(),
      () => this.internal?.dispose(),
      () => super.dispose(),
    ])
      try {
        dispose();
      } catch (error) {
        errors.push(error);
      }
    if (errors.length) throw new AggregateError(errors, 'Focus widget teardown failed');
  }
}
class FocusScopeState extends FocusState {
  protected override createNode(): FocusScopeNode {
    return new FocusScopeNode({
      debugLabel: this.widget.debugLabel,
      canRequestFocus: this.widget.canRequestFocus,
      skipTraversal: this.widget.skipTraversal,
    });
  }
  protected override compose(child: Widget): Widget {
    const result = this.inherited(child);
    return this.widget.includeSemantics
      ? new Semantics({ child: result, transportId: this.semanticsId, explicitChildNodes: true })
      : result;
  }
}
export class ExcludeFocus extends StatelessWidget {
  readonly excluding: boolean;
  constructor(
    readonly child: Widget,
    { key = null, excluding = true }: WidgetOptions & { readonly excluding?: boolean } = {},
  ) {
    super(key);
    invariant(typeof excluding === 'boolean', 'invalid-focus-flags', 'excluding must be boolean');
    this.excluding = excluding;
  }
  build(): Widget {
    return new Focus(this.child, {
      canRequestFocus: false,
      skipTraversal: true,
      includeSemantics: false,
      descendantsAreFocusable: !this.excluding,
    });
  }
}
export class ExcludeFocusTraversal extends StatelessWidget {
  readonly excluding: boolean;
  constructor(
    readonly child: Widget,
    { key = null, excluding = true }: WidgetOptions & { readonly excluding?: boolean } = {},
  ) {
    super(key);
    invariant(typeof excluding === 'boolean', 'invalid-focus-flags', 'excluding must be boolean');
    this.excluding = excluding;
  }
  build(): Widget {
    return new Focus(this.child, {
      canRequestFocus: false,
      skipTraversal: true,
      includeSemantics: false,
      descendantsAreTraversable: !this.excluding,
    });
  }
}
