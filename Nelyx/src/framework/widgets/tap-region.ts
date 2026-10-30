// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source widgets/tap_region.dart with actual retained render hit paths and View arena.
import { invariant } from '../../foundation/errors.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { Key, KeyMap } from '../../foundation/key.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { FlagProperty, EnumProperty } from '../../foundation/diagnostic-properties.ts';
import { RenderObjectWidget, RenderObjectElement, Element } from './framework.ts';
import type { Widget, BuildContext } from './framework.ts';
import {
  RenderProxyBoxWithHitTestBehavior,
  HitTestBehavior,
} from '../rendering/pointer-listener.ts';
import type {
  HitTestEntry,
  RenderBox,
  RenderObject,
  LayoutOptions,
  PipelineOwner,
} from '../rendering/object.ts';
import type { BoxConstraints } from '../rendering/constraints.ts';
import type { HitTestEntry as SourceHitTestEntry } from '../gestures/hit-test.ts';
import { GestureDisposition } from '../gestures/arena.ts';
import type { GestureArenaMember } from '../gestures/arena.ts';
import type { GestureBinding } from '../gestures/binding.ts';
import { PointerDownEvent, PointerUpEvent } from '../gestures/events.ts';
import type { PointerEvent } from '../gestures/events.ts';
import { contains, identity } from '../../ui/geometry.ts';
import type { Offset, TransformMatrix } from '../../ui/geometry.ts';
import { Offset as SourceOffset } from '../../ui/offset.ts';
import { SemanticsAction } from '../../ui/semantics-action.ts';
import type { SemanticsActionEvent } from '../../ui/semantics-action.ts';
import type { SemanticsBinding } from '../semantics/binding.ts';
import { isCurrentRoute } from './navigation.ts';
import { EditableText } from './editable-text.ts';
export type TapRegionCallback = (event: PointerDownEvent) => void;
export type TapRegionUpCallback = (event: PointerUpEvent) => void;
export abstract class TapRegionRegistry {
  abstract registerTapRegion(region: RenderTapRegion): void;
  abstract unregisterTapRegion(region: RenderTapRegion): void;
  static maybeOf(context: BuildContext): TapRegionRegistry | null {
    let result: TapRegionRegistry | null = null;
    context.visitAncestorElements((element) => {
      if (
        element instanceof RenderObjectElement &&
        element.renderObject instanceof RenderTapRegionSurface
      ) {
        result = element.renderObject;
        return false;
      }
      return true;
    });
    return result;
  }
  static of(context: BuildContext): TapRegionRegistry {
    const registry = this.maybeOf(context);
    invariant(
      registry,
      'missing-tap-region-surface',
      'TapRegionRegistry.of requires a TapRegionSurface ancestor',
    );
    return registry;
  }
}
class DummyTapRecognizer implements GestureArenaMember {
  /** Source deliberately has no callbacks: this member only consumes an arena. */
  acceptGesture(_pointer: number): void {}
  rejectGesture(_pointer: number): void {}
}
function sameGroup(a: unknown, b: unknown): boolean {
  return (
    a === b ||
    (a !== null &&
      a !== undefined &&
      typeof (a as { equals?: unknown }).equals === 'function' &&
      (a as { equals(other: unknown): boolean }).equals(b))
  );
}
/** Dart Map keys use operator equality/hash rather than JS object identity. */
class TapRegionGroupKey extends Key {
  constructor(readonly value: unknown) {
    super();
  }
  equals(other: Key): boolean {
    return other instanceof TapRegionGroupKey && sameGroup(this.value, other.value);
  }
  override get hashCode(): unknown {
    const value = this.value;
    if (value !== null && (typeof value === 'object' || typeof value === 'function'))
      return typeof (value as { equals?: unknown }).equals === 'function'
        ? ((value as { hashCode?: unknown }).hashCode ?? null)
        : value;
    return value;
  }
}
export class RenderTapRegionSurface
  extends RenderProxyBoxWithHitTestBehavior
  implements TapRegionRegistry
{
  private cachedResults = new WeakMap<SourceHitTestEntry, readonly HitTestEntry[]>();
  private readonly registeredRegions = new Set<RenderTapRegion>();
  private readonly groupIdToRegions = new KeyMap<Set<RenderTapRegion>>();
  constructor(
    readonly binding: GestureBinding,
    readonly semanticsBinding: SemanticsBinding,
  ) {
    super();
  }
  override attach(owner: PipelineOwner): void {
    super.attach(owner);
    this.semanticsBinding.addSemanticsActionListener(this.handleSemanticsAction);
  }
  override detach(): void {
    this.semanticsBinding.removeSemanticsActionListener(this.handleSemanticsAction);
    super.detach();
  }
  private readonly handleSemanticsAction = (event: SemanticsActionEvent): void => {
    if (
      this.debugDisposed ||
      (event.type !== SemanticsAction.tap && event.type !== SemanticsAction.longPress) ||
      this.registeredRegions.size === 0
    )
      return;
    const rect = this.semanticsBinding.getRectOfSemanticsNodeInViewCoordinates(
      event.viewId,
      event.nodeId,
    );
    if (!rect) return;
    const global = new SourceOffset(rect.x + rect.width / 2, rect.y + rect.height / 2),
      local = this.globalToLocal({ x: global.dx, y: global.dy }),
      result: HitTestEntry[] = [];
    if (!this.hitTest(local, result)) return;
    const { inside, outside } = this.classifyRegions(result),
      synthetic = new PointerDownEvent({ viewId: event.viewId, position: global });
    for (const region of outside) {
      if (this.registeredRegions.has(region) && region.enabled) region.onTapOutside?.(synthetic);
      if (this.debugDisposed) return;
    }
    for (const region of inside) {
      if (this.registeredRegions.has(region) && region.enabled) region.onTapInside?.(synthetic);
      if (this.debugDisposed) return;
    }
  };
  registerTapRegion(region: RenderTapRegion): void {
    invariant(
      !this.debugDisposed && !this.registeredRegions.has(region),
      'duplicate-tap-region',
      'Region is already registered or surface is closed',
    );
    const key = new TapRegionGroupKey(region.groupId);
    if (region.groupId !== null) {
      let group = this.groupIdToRegions.get(key);
      if (!group) this.groupIdToRegions.set(key, (group = new Set()));
      group.add(region);
    }
    this.registeredRegions.add(region);
  }
  unregisterTapRegion(region: RenderTapRegion): void {
    invariant(
      this.registeredRegions.delete(region),
      'unknown-tap-region',
      'Region is not registered',
    );
    if (region.groupId !== null) {
      const key = new TapRegionGroupKey(region.groupId),
        group = this.groupIdToRegions.get(key);
      invariant(group, 'missing-tap-region-group', 'No actual group is registered');
      group.delete(region);
      if (group.size === 0) this.groupIdToRegions.delete(key);
    }
  }
  override hitTest(
    position: Offset,
    result: HitTestEntry[],
    toLocal: TransformMatrix = identity,
  ): boolean {
    if (!contains({ x: 0, y: 0, ...this.size }, position)) return false;
    const before = result.length,
      hit = super.hitTest(position, result, toLocal);
    if (hit) {
      const entry = result.at(-1);
      invariant(
        entry?.target === this && result.length > before,
        'missing-tap-surface-entry',
        'Surface hit must create its own path entry',
      );
      result[result.length - 1] = {
        ...entry,
        onSourceEntry: (source) => this.cachedResults.set(source, result),
      };
    }
    return hit;
  }
  private classifyRegions(result: readonly HitTestEntry[]): {
    inside: RenderTapRegion[];
    outside: RenderTapRegion[];
  } {
    const inside = new Set<RenderTapRegion>();
    for (const { target } of result)
      if (target instanceof RenderTapRegion && this.registeredRegions.has(target)) {
        if (target.groupId === null) inside.add(target);
        else
          for (const region of this.groupIdToRegions.get(new TapRegionGroupKey(target.groupId)) ??
            [])
            inside.add(region);
      }
    return {
      inside: [...inside],
      outside: [...this.registeredRegions].filter((region) => !inside.has(region)),
    };
  }
  override handleEvent(event: PointerEvent, entry: SourceHitTestEntry): void {
    if (
      this.debugDisposed ||
      !(event instanceof PointerDownEvent || event instanceof PointerUpEvent) ||
      this.registeredRegions.size === 0
    )
      return;
    const result = this.cachedResults.get(entry);
    if (!result) return;
    const { inside, outside } = this.classifyRegions(result);
    let consume = false;
    for (const region of outside) {
      if (!this.registeredRegions.has(region) || !region.enabled) continue;
      if (event instanceof PointerDownEvent) region.onTapOutside?.(event);
      else region.onTapUpOutside?.(event);
      if (region.consumeOutsideTaps) consume = true;
      if (this.debugDisposed) return;
    }
    for (const region of inside) {
      if (!this.registeredRegions.has(region) || !region.enabled) continue;
      if (event instanceof PointerDownEvent) region.onTapInside?.(event);
      else region.onTapUpInside?.(event);
      if (this.debugDisposed) return;
    }
    if (consume && event instanceof PointerDownEvent && !this.binding.isClosed)
      this.binding.gestureArena
        .add(event.pointer, new DummyTapRecognizer())
        .resolve(GestureDisposition.accepted);
  }
  override dispose(): void {
    try {
      super.dispose();
    } finally {
      if (this.debugDisposed) {
        this.registeredRegions.clear();
        this.groupIdToRegions.clear();
        this.cachedResults = new WeakMap();
      }
    }
  }
}
export interface TapRegionOptions {
  readonly key?: Key | null;
  readonly enabled?: boolean;
  readonly behavior?: HitTestBehavior;
  readonly onTapOutside?: TapRegionCallback | null;
  readonly onTapInside?: TapRegionCallback | null;
  readonly onTapUpOutside?: TapRegionUpCallback | null;
  readonly onTapUpInside?: TapRegionUpCallback | null;
  readonly groupId?: unknown;
  readonly consumeOutsideTaps?: boolean;
  readonly debugLabel?: string | null;
}
export interface RenderTapRegionOptions extends TapRegionOptions {
  readonly registry?: TapRegionRegistry | null;
  readonly child?: RenderBox<RenderObject>;
}
export class RenderTapRegion extends RenderProxyBoxWithHitTestBehavior {
  private isRegistered = false;
  private enabledValue: boolean;
  private consumeOutsideTapsValue: boolean;
  private groupIdValue: unknown;
  private registryValue: TapRegionRegistry | null;
  onTapOutside: TapRegionCallback | null;
  onTapInside: TapRegionCallback | null;
  onTapUpOutside: TapRegionUpCallback | null;
  onTapUpInside: TapRegionUpCallback | null;
  debugLabel: string | null;
  constructor(options: RenderTapRegionOptions = {}) {
    super(options);
    this.registryValue = options.registry ?? null;
    this.enabledValue = options.enabled ?? true;
    this.consumeOutsideTapsValue = options.consumeOutsideTaps ?? false;
    this.groupIdValue = options.groupId ?? null;
    this.onTapOutside = options.onTapOutside ?? null;
    this.onTapInside = options.onTapInside ?? null;
    this.onTapUpOutside = options.onTapUpOutside ?? null;
    this.onTapUpInside = options.onTapUpInside ?? null;
    this.debugLabel = FoundationBuildMode.release ? null : (options.debugLabel ?? null);
  }
  get enabled(): boolean {
    return this.enabledValue;
  }
  set enabled(value: boolean) {
    this.assertCanMutateLayoutProperty();
    if (value !== this.enabledValue) {
      this.enabledValue = value;
      this.markNeedsLayout();
    }
  }
  get consumeOutsideTaps(): boolean {
    return this.consumeOutsideTapsValue;
  }
  set consumeOutsideTaps(value: boolean) {
    this.assertCanMutateLayoutProperty();
    if (value !== this.consumeOutsideTapsValue) {
      this.consumeOutsideTapsValue = value;
      this.markNeedsLayout();
    }
  }
  get groupId(): unknown {
    return this.groupIdValue;
  }
  set groupId(value: unknown) {
    this.assertCanMutateLayoutProperty();
    if (!sameGroup(this.groupIdValue, value)) {
      this.unregister();
      this.groupIdValue = value;
      this.markNeedsLayout();
    }
  }
  get registry(): TapRegionRegistry | null {
    return this.registryValue;
  }
  set registry(value: TapRegionRegistry | null) {
    this.assertCanMutateLayoutProperty();
    if (value !== this.registryValue) {
      this.unregister();
      this.registryValue = value;
      this.markNeedsLayout();
    }
  }
  private unregister(): void {
    if (!this.isRegistered) return;
    this.isRegistered = false;
    this.registryValue!.unregisterTapRegion(this);
  }
  override layout(constraints: BoxConstraints, options: LayoutOptions = {}): void {
    super.layout(constraints, options);
    this.unregister();
    if (this.registryValue && this.enabledValue) {
      this.registryValue.registerTapRegion(this);
      this.isRegistered = true;
    }
  }
  override detach(): void {
    try {
      this.unregister();
    } finally {
      super.detach();
    }
  }
  override dispose(): void {
    try {
      this.unregister();
    } finally {
      super.dispose();
    }
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('debugLabel', this.debugLabel, { defaultValue: null }));
    properties.add(new DiagnosticsProperty('groupId', this.groupId, { defaultValue: null }));
    properties.add(
      new FlagProperty('enabled', this.enabled, { ifFalse: 'DISABLED', defaultValue: true }),
    );
  }
}
export class TapRegionSurface extends RenderObjectWidget {
  constructor(
    readonly child: Widget,
    key: Key | null = null,
  ) {
    super(key);
  }
  get childWidgets(): readonly Widget[] {
    return [this.child];
  }
  createRenderObject(context: BuildContext): RenderTapRegionSurface {
    invariant(
      context instanceof Element,
      'invalid-tap-surface-context',
      'TapRegionSurface requires the actual Element owner',
    );
    return new RenderTapRegionSurface(context.owner.gestureBinding, context.owner.semanticsBinding);
  }
}
export class TapRegion extends RenderObjectWidget {
  constructor(
    readonly child: Widget,
    readonly options: TapRegionOptions = {},
  ) {
    super(options.key ?? null);
  }
  get enabled(): boolean {
    return this.options.enabled ?? true;
  }
  get behavior(): HitTestBehavior {
    return this.options.behavior ?? HitTestBehavior.deferToChild;
  }
  get groupId(): unknown {
    return this.options.groupId ?? null;
  }
  get consumeOutsideTaps(): boolean {
    return this.options.consumeOutsideTaps ?? false;
  }
  get debugLabel(): string | null {
    return FoundationBuildMode.release ? null : (this.options.debugLabel ?? null);
  }
  get childWidgets(): readonly Widget[] {
    return [this.child];
  }
  createRenderObject(context: BuildContext): RenderTapRegion {
    const current = isCurrentRoute(context);
    return new RenderTapRegion({
      ...this.options,
      behavior: this.behavior,
      registry: TapRegionRegistry.maybeOf(context),
      consumeOutsideTaps: current && this.consumeOutsideTaps,
      onTapOutside: current ? (this.options.onTapOutside ?? null) : null,
      onTapUpOutside: current ? (this.options.onTapUpOutside ?? null) : null,
    });
  }
  updateRenderObject(context: BuildContext, object: RenderObject): void {
    const render = object as RenderTapRegion,
      current = isCurrentRoute(context);
    render.registry = TapRegionRegistry.maybeOf(context);
    render.enabled = this.enabled;
    render.consumeOutsideTaps = current && this.consumeOutsideTaps;
    render.behavior = this.behavior;
    render.groupId = this.groupId;
    render.onTapOutside = current ? (this.options.onTapOutside ?? null) : null;
    render.onTapInside = this.options.onTapInside ?? null;
    render.onTapUpOutside = current ? (this.options.onTapUpOutside ?? null) : null;
    render.onTapUpInside = this.options.onTapUpInside ?? null;
    render.debugLabel = this.debugLabel;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(
      new FlagProperty('enabled', this.enabled, { ifFalse: 'DISABLED', defaultValue: true }),
    );
    properties.add(
      new EnumProperty('behavior', this.behavior, { defaultValue: HitTestBehavior.deferToChild }),
    );
    properties.add(new DiagnosticsProperty('debugLabel', this.debugLabel, { defaultValue: null }));
    properties.add(new DiagnosticsProperty('groupId', this.groupId, { defaultValue: null }));
  }
}
export class TextFieldTapRegion extends TapRegion {
  constructor(child: Widget, options: TapRegionOptions = {}) {
    super(child, {
      ...options,
      groupId: options.groupId === undefined ? EditableText : options.groupId,
    });
  }
}
