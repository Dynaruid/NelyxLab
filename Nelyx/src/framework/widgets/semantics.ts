// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import type { Key } from '../../foundation/key.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import type { SemanticsNode, Rect } from '../../ui/types.ts';
import type { TransformMatrix } from '../../ui/geometry.ts';
import type { Locale } from '../../ui/locale.ts';
import type { RenderBox, RenderObject } from '../rendering/object.ts';
import {
  RenderSemanticsAnnotations,
  RenderBlockSemantics,
  RenderMergeSemantics,
  RenderExcludeSemantics,
} from '../rendering/semantics-annotations.ts';
import { RenderSliverSemanticsAnnotations } from '../rendering/proxy-sliver.ts';
import { RenderObjectWidget, Widget } from './framework.ts';
import type { BuildContext } from './framework.ts';
import { Directionality } from './app-data.ts';
import {
  SemanticsTag,
  SemanticsConfiguration,
  SemanticsProperties,
  SemanticsHintOverrides,
} from '../semantics/semantics.ts';
import type { SemanticsSortKey, SemanticsPropertiesOptions } from '../semantics/semantics.ts';
import { setSemanticsTransportRange } from '../rendering/semantics-transport.ts';
import { valueEquals } from '../painting/value-equality.ts';

const semanticPropertyFields = Object.keys(
  new SemanticsProperties(),
) as (keyof SemanticsProperties)[];
function sameSimpleSemanticsProperties(
  previous: SemanticsProperties,
  value: SemanticsProperties,
): boolean {
  // Base instances are shallowly frozen. Collections and derived properties
  // can change behind the same reference and retain conservative invalidation.
  if (
    Object.getPrototypeOf(previous) !== SemanticsProperties.prototype ||
    Object.getPrototypeOf(value) !== SemanticsProperties.prototype ||
    !Object.isFrozen(previous) ||
    !Object.isFrozen(value)
  )
    return false;
  for (const key of semanticPropertyFields) {
    const before = previous[key],
      after = value[key];
    if (before !== after || (before !== null && typeof before === 'object')) return false;
  }
  return true;
}

export interface SemanticsAnnotationOptions {
  readonly tagForChildren?: SemanticsTag;
  readonly sortKey?: SemanticsSortKey | null;
  readonly container?: boolean;
}
/** Existing host-id adapter. Source-shaped widgets use SemanticsWidgetOptions. */
export interface SemanticsOptions
  extends Omit<SemanticsNode, 'bounds' | 'children'>, SemanticsAnnotationOptions {
  readonly excludeChildren?: boolean;
  readonly merge?: boolean;
}
export interface SemanticsTagOptions extends SemanticsAnnotationOptions {
  readonly tagForChildren: SemanticsTag;
}
export interface SemanticsStructureOptions {
  readonly child?: Widget | null;
  readonly key?: Key | null;
  readonly container?: boolean;
  readonly explicitChildNodes?: boolean;
  readonly excludeSemantics?: boolean;
  readonly blockUserActions?: boolean;
  readonly localeForSubtree?: Locale | null;
  /** Stable Nelyx host id without replacing source properties/actions. */ readonly transportId?:
    | string
    | null;
  /** Explicit embedding range; does not alter source formatted value or role. */ readonly transportRange?:
    | SemanticsNode['numericRange']
    | null;
  readonly transportRangeActions?: SemanticsNode['rangeActions'] | null;
}
export interface SemanticsWidgetOptions
  extends
    SemanticsStructureOptions,
    Omit<
      SemanticsPropertiesOptions,
      'hintOverrides' | 'onMoveCursorForwardByWord' | 'onMoveCursorBackwardByWord'
    > {
  readonly onTapHint?: string | null;
  readonly onLongPressHint?: string | null;
}
export interface SemanticsFromPropertiesOptions extends SemanticsStructureOptions {
  readonly properties: SemanticsProperties;
}
abstract class _SemanticsBase extends RenderObjectWidget {
  readonly child: Widget | null;
  readonly properties: SemanticsProperties;
  readonly container: boolean;
  readonly explicitChildNodes: boolean;
  readonly excludeSemantics: boolean;
  readonly blockUserActions: boolean;
  readonly localeForSubtree: Locale | null;
  protected constructor(options: SemanticsFromPropertiesOptions) {
    super(options.key ?? null);
    this.child = options.child ?? null;
    this.properties = options.properties;
    this.container = options.container ?? false;
    this.explicitChildNodes = options.explicitChildNodes ?? false;
    this.excludeSemantics = options.excludeSemantics ?? false;
    this.blockUserActions = options.blockUserActions ?? false;
    this.localeForSubtree = options.localeForSubtree ?? null;
  }
  get childWidgets(): readonly Widget[] {
    return this.child ? [this.child] : [];
  }
  protected getTextDirection(context?: BuildContext): 'ltr' | 'rtl' | null {
    if (this.properties.textDirection !== null) return this.properties.textDirection;
    const containsText = (
      [
        'label',
        'attributedLabel',
        'value',
        'attributedValue',
        'increasedValue',
        'attributedIncreasedValue',
        'decreasedValue',
        'attributedDecreasedValue',
        'hint',
        'attributedHint',
        'tooltip',
      ] as const
    ).some((name) => this.properties[name] !== null);
    return containsText && context ? Directionality.maybeOf(context) : null;
  }
}
export class Semantics extends _SemanticsBase {
  readonly options:
    | SemanticsWidgetOptions
    | SemanticsFromPropertiesOptions
    | SemanticsOptions
    | SemanticsAnnotationOptions;
  private readonly hostOptions: SemanticsOptions | null;
  constructor(options?: SemanticsWidgetOptions | SemanticsFromPropertiesOptions);
  constructor(
    child: Widget,
    options: SemanticsOptions | SemanticsAnnotationOptions,
    key?: Key | null,
  );
  constructor(
    first: Widget | SemanticsWidgetOptions | SemanticsFromPropertiesOptions = {},
    options?: SemanticsOptions | SemanticsAnnotationOptions,
    key: Key | null = null,
  ) {
    let configuration: SemanticsFromPropertiesOptions;
    let host: SemanticsOptions | null = null;
    if (first instanceof Widget) {
      const annotations = options ?? {};
      host = 'id' in annotations ? (annotations as SemanticsOptions) : null;
      configuration = {
        child: first,
        key,
        container: annotations.container ?? (host ? host.role !== 'text' : false),
        explicitChildNodes: host?.role === 'list',
        excludeSemantics: host?.excludeChildren ?? false,
        properties: new SemanticsProperties({
          tagForChildren: annotations.tagForChildren ?? null,
          sortKey: annotations.sortKey ?? null,
        }),
      };
    } else if ('properties' in first) configuration = first;
    else
      configuration = {
        ...first,
        properties: new SemanticsProperties({
          ...first,
          hintOverrides:
            first.onTapHint != null || first.onLongPressHint != null
              ? new SemanticsHintOverrides({
                  onTapHint: first.onTapHint ?? null,
                  onLongPressHint: first.onLongPressHint ?? null,
                })
              : null,
        }),
      };
    if (!(first instanceof Widget) && first.transportId != null) {
      if (typeof first.transportId !== 'string' || first.transportId.length === 0)
        throw new TypeError('Semantics transportId must be a nonempty string');
      host = { id: first.transportId, role: 'group', name: '', enabled: true };
    }
    super(configuration);
    this.options = first instanceof Widget ? (options ?? {}) : first;
    this.hostOptions = host;
  }
  static fromProperties(options: SemanticsFromPropertiesOptions): Semantics {
    return new Semantics(options);
  }
  createRenderObject(context?: BuildContext): RenderSemanticsAnnotations {
    return new RenderSemantics(this, this.getTextDirection(context));
  }
  updateRenderObject(context: BuildContext, object: RenderBox): void {
    const render = object as RenderSemantics;
    render.container = this.container;
    render.explicitChildNodes = this.explicitChildNodes;
    render.excludeSemantics = this.excludeSemantics;
    render.blockUserActions = this.blockUserActions;
    render.updateProperties(this.properties);
    render.textDirection = this.getTextDirection(context);
    render.localeForSubtree = this.localeForSubtree;
    render.setHostOptions(
      this.hostOptions,
      'transportId' in this.options && this.options.transportId != null,
    );
    render.setRange(this.transportRange, this.transportRangeActions);
  }
  /** @internal The host-id compatibility path shares the source renderer. */
  get transportRange(): SemanticsNode['numericRange'] | null {
    return 'transportRange' in this.options ? (this.options.transportRange ?? null) : null;
  }
  get transportRangeActions(): SemanticsNode['rangeActions'] | null {
    return !this.blockUserActions && 'transportRangeActions' in this.options
      ? (this.options.transportRangeActions ?? null)
      : null;
  }
  get transportOptions(): SemanticsOptions | null {
    return this.hostOptions;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('container', this.container));
    properties.add(new DiagnosticsProperty('properties', this.properties));
    this.properties.debugFillProperties(properties);
  }
}
export class SliverSemantics extends _SemanticsBase {
  constructor(options: SemanticsWidgetOptions | SemanticsFromPropertiesOptions = {}) {
    super(
      'properties' in options
        ? options
        : {
            ...options,
            properties: new SemanticsProperties({
              ...options,
              hintOverrides:
                options.onTapHint != null || options.onLongPressHint != null
                  ? new SemanticsHintOverrides({
                      onTapHint: options.onTapHint ?? null,
                      onLongPressHint: options.onLongPressHint ?? null,
                    })
                  : null,
            }),
          },
    );
  }
  static fromProperties(options: SemanticsFromPropertiesOptions): SliverSemantics {
    return new SliverSemantics(options);
  }
  createRenderObject(context?: BuildContext): RenderSliverSemanticsAnnotations {
    return new RenderSliverSemanticsAnnotations({
      container: this.container,
      explicitChildNodes: this.explicitChildNodes,
      excludeSemantics: this.excludeSemantics,
      blockUserActions: this.blockUserActions,
      properties: this.properties,
      localeForSubtree: this.localeForSubtree,
      textDirection: this.getTextDirection(context),
    });
  }
  updateRenderObject(context: BuildContext, object: RenderObject): void {
    const render = object as RenderSliverSemanticsAnnotations;
    render.container = this.container;
    render.explicitChildNodes = this.explicitChildNodes;
    render.excludeSemantics = this.excludeSemantics;
    render.blockUserActions = this.blockUserActions;
    render.properties = this.properties;
    render.textDirection = this.getTextDirection(context);
    render.localeForSubtree = this.localeForSubtree;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('container', this.container));
    properties.add(new DiagnosticsProperty('properties', this.properties));
    this.properties.debugFillProperties(properties);
  }
}
class RenderSemantics extends RenderSemanticsAnnotations {
  protected override markNeedsPaintAfterLayout(): void {
    if (
      this.hasStaticLayoutSemantics(
        RenderSemantics.prototype,
        RenderSemantics.prototype.describeSemanticsConfiguration,
      )
    )
      this.markNeedsPaintAfterGeometryLayout();
    else super.markNeedsPaintAfterLayout();
  }
  private hostOptions: SemanticsOptions | null = null;
  private transportIdOnly = false;
  updateProperties(value: SemanticsProperties): void {
    if (this.properties === value) return;
    if (
      !Object.hasOwn(this, 'properties') &&
      this.hasStaticLayoutSemantics(
        RenderSemantics.prototype,
        RenderSemantics.prototype.describeSemanticsConfiguration,
      ) &&
      sameSimpleSemanticsProperties(this.properties, value)
    ) {
      this._replaceSemanticsProperties(value);
      return;
    }
    this.properties = value;
  }
  constructor(widget: Semantics, textDirection: 'ltr' | 'rtl' | null) {
    super({
      container: widget.container,
      explicitChildNodes: widget.explicitChildNodes,
      excludeSemantics: widget.excludeSemantics,
      blockUserActions: widget.blockUserActions,
      properties: widget.properties,
      localeForSubtree: widget.localeForSubtree,
      textDirection,
    });
    this.setHostOptions(
      widget.transportOptions,
      'transportId' in widget.options && widget.options.transportId != null,
    );
    this.setRange(widget.transportRange, widget.transportRangeActions);
  }
  protected override get hasSourceSemanticsConfiguration(): boolean {
    return this.hostOptions === null || this.transportIdOnly;
  }
  setRange(
    value: SemanticsNode['numericRange'] | null,
    actions: SemanticsNode['rangeActions'] | null,
  ): void {
    if (setSemanticsTransportRange(this, value, actions)) this.markNeedsSemanticsUpdate();
  }
  setHostOptions(value: SemanticsOptions | null, transportIdOnly: boolean): void {
    const previous = this.hostOptions;
    if (value === previous && transportIdOnly === this.transportIdOnly) return;
    // Source widgets recreate this id-only envelope. Source properties/actions
    // invalidate independently; an unchanged envelope need not do so again.
    if (
      transportIdOnly &&
      this.transportIdOnly &&
      value &&
      previous &&
      value.id === previous.id &&
      value.role === previous.role &&
      value.name === previous.name &&
      value.enabled === previous.enabled &&
      Object.keys(value).length === 4 &&
      Object.keys(previous).length === 4
    )
      return;
    this.hostOptions = value;
    this.transportIdOnly = transportIdOnly;
    this.semantics = value ?? undefined;
    this.markNeedsSemanticsUpdate();
  }
  override describeSemanticsConfiguration(config: SemanticsConfiguration): void {
    super.describeSemanticsConfiguration(config);
    if (this.hostOptions?.merge) {
      config.isSemanticBoundary = true;
      config.isMergingSemanticsOfDescendants = true;
    }
  }
  override collectSemantics(output: SemanticsNode[], matrix?: TransformMatrix, clip?: Rect): void {
    const collected: SemanticsNode[] = [];
    super.collectSemantics(collected, matrix, clip);
    const tag = this.properties.tagForChildren,
      configuration = this.hostOptions;
    const tagged = (node: SemanticsNode): SemanticsNode =>
      tag && !node.tags?.some((value) => valueEquals(value, tag))
        ? { ...node, tags: [...(node.tags ?? []), tag] }
        : node;
    for (const original of collected) {
      const node = configuration
        ? { ...original, ...(original.children ? { children: original.children.map(tagged) } : {}) }
        : tagged(original);
      if (configuration?.excludeChildren) {
        const { children, ...own } = node;
        output.push(own);
      } else if (configuration?.merge) {
        const names: string[] = [];
        const visit = (node: SemanticsNode) => {
          if (node.name) names.push(node.name);
          node.children?.forEach(visit);
        };
        visit(node);
        const { children, ...own } = node;
        output.push({ ...own, name: names.join(' ') });
      } else output.push(node);
    }
  }
}
interface SemanticChildOptions {
  readonly child?: Widget | null;
  readonly key?: Key | null;
}
export class MergeSemantics extends RenderObjectWidget {
  readonly child: Widget | null;
  constructor({ child = null, key = null }: SemanticChildOptions = {}) {
    super(key);
    this.child = child;
  }
  get childWidgets(): readonly Widget[] {
    return this.child ? [this.child] : [];
  }
  createRenderObject(): RenderMergeSemantics {
    return new RenderMergeSemantics();
  }
  updateRenderObject(): void {}
}
export class BlockSemantics extends RenderObjectWidget {
  readonly child: Widget | null;
  readonly blocking: boolean;
  constructor({
    child = null,
    key = null,
    blocking = true,
  }: SemanticChildOptions & { readonly blocking?: boolean } = {}) {
    super(key);
    this.child = child;
    this.blocking = blocking;
  }
  get childWidgets(): readonly Widget[] {
    return this.child ? [this.child] : [];
  }
  createRenderObject(): RenderBlockSemantics {
    return new RenderBlockSemantics({ blocking: this.blocking });
  }
  updateRenderObject(_context: BuildContext, object: RenderBox): void {
    (object as RenderBlockSemantics).blocking = this.blocking;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('blocking', this.blocking));
  }
}
export class ExcludeSemantics extends RenderObjectWidget {
  readonly child: Widget | null;
  readonly excluding: boolean;
  constructor(options?: SemanticChildOptions & { readonly excluding?: boolean });
  constructor(child: Widget, key?: Key | null);
  constructor(
    first: Widget | (SemanticChildOptions & { readonly excluding?: boolean }) = {},
    key: Key | null = null,
  ) {
    const options = first instanceof Widget ? { child: first, key } : first;
    super(options.key ?? null);
    this.child = options.child ?? null;
    this.excluding = options.excluding ?? true;
  }
  get childWidgets(): readonly Widget[] {
    return this.child ? [this.child] : [];
  }
  createRenderObject(): RenderExcludeSemantics {
    return new RenderExcludeSemantics({ excluding: this.excluding });
  }
  updateRenderObject(_context: BuildContext, object: RenderBox): void {
    (object as RenderExcludeSemantics).excluding = this.excluding;
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('excluding', this.excluding));
  }
}
