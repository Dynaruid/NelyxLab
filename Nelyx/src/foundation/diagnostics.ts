// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter foundation/diagnostics.dart.
import { FlutterError } from './flutter-error.ts';
import { diagnosticValueString, diagnosticDoubleString } from './debug.ts';
import { FoundationBuildMode } from './constants.ts';
import {
  TextTreeRenderer,
  sparseTextConfiguration,
  dashedTextConfiguration,
  denseTextConfiguration,
  transitionTextConfiguration,
  errorTextConfiguration,
  whitespaceTextConfiguration,
  flatTextConfiguration,
  singleLineTextConfiguration,
  errorPropertyTextConfiguration,
  shallowTextConfiguration,
} from './diagnostics-text.ts';
import type { TextTreeConfiguration } from './diagnostics-text.ts';
import { DiagnosticsSerializationDelegate } from './diagnostics-serialization.ts';
import type { JsonDiagnosticsNode } from './diagnostics-serialization.ts';
export type DiagnosticLevel =
  | 'hidden'
  | 'fine'
  | 'debug'
  | 'info'
  | 'warning'
  | 'hint'
  | 'summary'
  | 'error'
  | 'off';
export type DiagnosticsTreeStyle =
  | 'none'
  | 'sparse'
  | 'offstage'
  | 'dense'
  | 'transition'
  | 'error'
  | 'whitespace'
  | 'flat'
  | 'singleLine'
  | 'errorProperty'
  | 'shallow'
  | 'truncateChildren';
const levels: readonly DiagnosticLevel[] = [
  'hidden',
  'fine',
  'debug',
  'info',
  'warning',
  'hint',
  'summary',
  'error',
  'off',
];
function putProperties(target: Record<string, unknown>, values: Record<string, unknown>): void {
  for (const key of Object.keys(values))
    Object.defineProperty(target, key, {
      value: values[key],
      enumerable: true,
      writable: true,
      configurable: true,
    });
}
export interface DiagnosticsOptions {
  readonly name?: string | null;
  readonly style?: DiagnosticsTreeStyle | null;
  readonly showName?: boolean;
  readonly showSeparator?: boolean;
  readonly level?: DiagnosticLevel;
  readonly allowWrap?: boolean;
  readonly allowNameWrap?: boolean;
  readonly allowTruncate?: boolean;
  readonly linePrefix?: string | null;
}
export interface DiagnosticsStringOptions {
  readonly minLevel?: DiagnosticLevel;
  readonly prefixLineOne?: string;
  readonly prefixOtherLines?: string | null;
  readonly wrapWidth?: number;
  readonly parentConfiguration?: { readonly lineBreakProperties: boolean } | null;
}
class _NoDefaultValue {
  toString(): string {
    return "Instance of '_NoDefaultValue'";
  }
}
/** Immutable singleton marker; matches the source object-valued constant. */
export const kNoDefaultValue = Object.freeze(new _NoDefaultValue());
export type ComputePropertyValueCallback<T> = () => T | null;
type _NodesToJsonifyStack = ([DiagnosticsNode, (json: JsonDiagnosticsNode) => void] | undefined)[];
export abstract class DiagnosticsNode {
  readonly name: string | null;
  readonly showSeparator: boolean;
  readonly linePrefix: string | null;
  private readonly nodeStyle: DiagnosticsTreeStyle | null;
  private readonly named: boolean;
  private readonly nodeLevel: DiagnosticLevel | undefined;
  private readonly truncatable: boolean;
  private readonly wrap: boolean;
  private readonly wrapName: boolean;
  constructor(o: DiagnosticsOptions = {}) {
    this.name = o.name ?? null;
    this.nodeStyle = o.style ?? null;
    this.named = o.showName ?? true;
    this.showSeparator = o.showSeparator ?? true;
    this.linePrefix = o.linePrefix ?? null;
    this.nodeLevel = o.level;
    this.wrap = o.allowWrap ?? false;
    this.wrapName = o.allowNameWrap ?? false;
    this.truncatable = o.allowTruncate ?? false;
    if (FoundationBuildMode.debug && this.name?.endsWith(':'))
      throw new Error(
        'Names of diagnostic nodes must not end with colons.\nname:\n  "' + this.name + '"',
      );
  }
  get style(): DiagnosticsTreeStyle | null {
    return this.nodeStyle;
  }
  get showName(): boolean {
    return this.named;
  }
  get level(): DiagnosticLevel {
    return this.nodeLevel ?? (FoundationBuildMode.release ? 'hidden' : 'info');
  }
  get allowWrap(): boolean {
    return this.wrap;
  }
  get allowNameWrap(): boolean {
    return this.wrapName;
  }
  get allowTruncate(): boolean {
    return this.truncatable;
  }
  get value(): unknown {
    return null;
  }
  get emptyBodyDescription(): string | null {
    return null;
  }
  static message(message: string, o: DiagnosticsOptions = {}): DiagnosticsNode {
    return new DiagnosticsProperty('', null, {
      style: 'singleLine',
      allowWrap: true,
      typeName: 'void',
      ...o,
      description: message,
      showName: false,
    });
  }
  isFiltered(minLevel: DiagnosticLevel): boolean {
    return FoundationBuildMode.release || levels.indexOf(this.level) < levels.indexOf(minLevel);
  }
  abstract toDescription(options?: DiagnosticsStringOptions): string;
  getProperties(): readonly DiagnosticsNode[] {
    return [];
  }
  getChildren(): readonly DiagnosticsNode[] {
    return [];
  }
  private get _separator(): string {
    return this.showSeparator ? ':' : '';
  }
  toString(o: DiagnosticsStringOptions = {}): string {
    if (!FoundationBuildMode.debug) return "Instance of '" + this.constructor.name + "'";
    if (this.style === null) throw new Error('Diagnostic node style is required');
    if (this.style === 'singleLine')
      return this.toStringDeep({ ...o, minLevel: o.minLevel ?? 'info' });
    const description = this.toDescription(o);
    return this.showName && this.name
      ? this.name + this._separator + (description.includes('\n') ? '\n' : ' ') + description
      : description;
  }
  toStringDeep(o: DiagnosticsStringOptions = {}): string {
    return FoundationBuildMode.debug
      ? new TextTreeRenderer({
          minLevel: o.minLevel ?? 'debug',
          wrapWidth: o.wrapWidth ?? 65,
        }).render(this, o)
      : '';
  }
  get textTreeConfiguration(): TextTreeConfiguration | null {
    switch (this.style) {
      case 'none':
        return null;
      case 'sparse':
        return sparseTextConfiguration;
      case 'dense':
        return denseTextConfiguration;
      case 'offstage':
        return dashedTextConfiguration;
      case 'transition':
        return transitionTextConfiguration;
      case 'error':
        return errorTextConfiguration;
      case 'whitespace':
      case 'truncateChildren':
        return whitespaceTextConfiguration;
      case 'flat':
        return flatTextConfiguration;
      case 'singleLine':
        return singleLineTextConfiguration;
      case 'errorProperty':
        return errorPropertyTextConfiguration;
      case 'shallow':
        return shallowTextConfiguration;
      default:
        throw new Error('Diagnostic node style is required');
    }
  }
  toTimelineArguments(): Record<string, string> | null {
    if (FoundationBuildMode.release) return null;
    if (FoundationBuildMode.profile)
      throw new FlutterError(
        'DiagnosticsNode.toTimelineArguments used in non-debug build.\nThe DiagnosticsNode.toTimelineArguments API is expensive and causes timeline traces to be non-representative. As such, it should not be used in profile builds. However, this application is compiled in profile mode and yet still invoked the method.',
      );
    const result: Record<string, string> = {};
    for (const property of this.getProperties())
      if (property.name !== null)
        Object.defineProperty(result, property.name, {
          value: property.toDescription({ parentConfiguration: singleLineTextConfiguration }),
          enumerable: true,
          writable: true,
          configurable: true,
        });
    return result;
  }
  toJsonMap(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    if (!FoundationBuildMode.debug) return {};
    const result: JsonDiagnosticsNode = {
      description: this.toDescription(),
      type: this.constructor.name,
    };
    if (this.name !== null) result.name = this.name;
    if (!this.showSeparator) result.showSeparator = false;
    if (this.level !== 'info') result.level = this.level;
    if (!this.showName) result.showName = false;
    if (this.emptyBodyDescription !== null) result.emptyBodyDescription = this.emptyBodyDescription;
    if (this.style !== 'sparse') {
      if (this.style === null) throw new Error('Diagnostic node style is required');
      result.style = this.style;
    }
    if (this.allowTruncate) result.allowTruncate = true;
    if (this.getChildren().length) result.hasChildren = true;
    if (this.linePrefix) result.linePrefix = this.linePrefix;
    if (!this.allowWrap) result.allowWrap = false;
    if (this.allowNameWrap) result.allowNameWrap = true;
    putProperties(result, delegate.additionalNodeProperties(this));
    if (delegate.includeProperties)
      result.properties = DiagnosticsNode.toJsonList(
        delegate.filterProperties(this.getProperties(), this),
        this,
        delegate,
      );
    if (delegate.subtreeDepth > 0)
      result.children = DiagnosticsNode.toJsonList(
        delegate.filterChildren(this.getChildren(), this),
        this,
        delegate,
      );
    return result;
  }
  static toJsonList(
    nodes: readonly DiagnosticsNode[] | null,
    parent: DiagnosticsNode | null,
    delegate: DiagnosticsSerializationDelegate,
  ): JsonDiagnosticsNode[] {
    if (nodes === null) return [];
    const original = nodes.length,
      selected = delegate.truncateNodesList(nodes, parent),
      truncated = selected.length !== original;
    if (truncated) selected.push(DiagnosticsNode.message('...'));
    const result = selected.map((node) => node.toJsonMap(delegate.delegateForNode(node)));
    if (truncated) result.at(-1)!.truncated = true;
    return result;
  }
  toJsonMapIterative(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    if (!FoundationBuildMode.debug) return {};
    const queue: _NodesToJsonifyStack = [];
    const result = this._toJson(delegate, queue);
    this._jsonifyNextNodesInStack(queue, delegate);
    return result;
  }
  private _jsonifyNextNodesInStack(
    queue: _NodesToJsonifyStack,
    delegate: DiagnosticsSerializationDelegate,
  ): void {
    for (let i = 0; i < queue.length; i++) {
      const [node, callback] = queue[i]!;
      queue[i] = undefined;
      callback(node._toJson(delegate, queue));
      if (i >= 1023 && i * 2 >= queue.length) {
        queue.splice(0, i + 1);
        i = -1;
      }
    }
    queue.length = 0;
  }
  private _toJson(
    delegate: DiagnosticsSerializationDelegate,
    queue: _NodesToJsonifyStack,
  ): JsonDiagnosticsNode {
    const children: JsonDiagnosticsNode[] = [],
      include = this.getChildren().length > 0 && delegate.subtreeDepth > 0;
    let truncated = false;
    if (include) {
      const originals = delegate.filterChildren(this.getChildren(), this),
        selected = delegate.truncateNodesList(originals, this);
      if (selected.length !== originals.length) {
        selected.push(DiagnosticsNode.message('...'));
        truncated = true;
      }
      for (const child of selected) queue.push([child, (json) => children.push(json)]);
    }
    const description = this.toDescription(),
      result: JsonDiagnosticsNode = {
        description,
        shouldIndent: this.style !== 'flat' && this.style !== 'error',
        widgetRuntimeType: description === '[root]' ? 'RootWidget' : description.split('-')[0],
      };
    if (truncated) result.truncated = true;
    putProperties(result, delegate.additionalNodeProperties(this, { fullDetails: false }));
    if (include) result.children = children;
    return result;
  }
}
export interface DiagnosticsPropertyOptions<_T> extends DiagnosticsOptions {
  readonly description?: string | null;
  readonly ifNull?: string | null;
  readonly ifEmpty?: string | null;
  readonly missingIfNull?: boolean;
  readonly defaultValue?: unknown;
  readonly tooltip?: string | null;
  readonly expandableValue?: boolean;
  readonly typeName?: string;
}
export class DiagnosticsProperty<T> extends DiagnosticsNode {
  private computed = true;
  private stored: T | null;
  private compute: ComputePropertyValueCallback<T> | undefined;
  private failure: unknown = null;
  private hasFailure = false;
  private readonly typeName: string;
  private readonly defaultLevel: DiagnosticLevel;
  readonly defaultValue: unknown;
  readonly missingIfNull: boolean;
  readonly tooltip: string | undefined;
  readonly expandableValue: boolean;
  protected readonly description: string | undefined;
  readonly ifNull: string | undefined;
  readonly ifEmpty: string | undefined;
  constructor(name: string | null, value: T | null, o: DiagnosticsPropertyOptions<T> = {}) {
    super({ style: 'singleLine', allowWrap: true, allowNameWrap: true, ...o, name });
    this.stored = value;
    this.defaultValue = o.defaultValue === undefined ? kNoDefaultValue : o.defaultValue;
    this.missingIfNull = o.missingIfNull ?? false;
    this.tooltip = o.tooltip ?? undefined;
    this.expandableValue = o.expandableValue ?? false;
    this.description = o.description ?? undefined;
    this.ifNull = o.ifNull ?? (this.missingIfNull ? 'MISSING' : undefined);
    this.ifEmpty = o.ifEmpty ?? undefined;
    this.typeName = o.typeName ?? 'Object?';
    this.defaultLevel = o.level ?? 'info';
  }
  static lazy<T>(
    name: string | null,
    compute: ComputePropertyValueCallback<T>,
    o: DiagnosticsPropertyOptions<T> = {},
  ): DiagnosticsProperty<T> {
    const property = new DiagnosticsProperty<T>(name, null, o);
    property.setLazyValue(compute);
    return property;
  }
  protected setLazyValue(compute: ComputePropertyValueCallback<T>): void {
    this.computed = false;
    this.compute = compute;
    this.stored = null;
    this.failure = null;
    this.hasFailure = false;
  }
  private _maybeCacheValue(): void {
    if (this.computed) return;
    this.computed = true;
    try {
      this.stored = this.compute!();
    } catch (error) {
      this.failure = error;
      this.hasFailure = true;
      this.stored = null;
    }
  }
  override get value(): T | null {
    this._maybeCacheValue();
    return this.stored;
  }
  get exception(): unknown {
    this._maybeCacheValue();
    return this.failure;
  }
  get isInteresting(): boolean {
    if (this.defaultValue === kNoDefaultValue) return true;
    const value = this.value;
    return !(
      value === this.defaultValue ||
      (this.defaultValue !== null && hasValueEquality(value) && value.equals(this.defaultValue))
    );
  }
  override get level(): DiagnosticLevel {
    if (this.defaultLevel === 'hidden') return 'hidden';
    this._maybeCacheValue();
    if (this.hasFailure) return 'error';
    if (this.missingIfNull && this.value === null) return 'warning';
    return this.isInteresting ? this.defaultLevel : 'fine';
  }
  valueToString(_options: DiagnosticsStringOptions = {}): string {
    const value = this.value;
    return isDiagnosticable(value) && 'debugDescribeChildren' in value
      ? value.toStringShort()
      : this.propertyType === 'double' && typeof value === 'number'
        ? diagnosticDoubleString(value)
        : diagnosticValueString(value);
  }
  private _addTooltip(text: string): string {
    return this.tooltip === undefined ? text : text + ' (' + this.tooltip + ')';
  }
  toDescription(options: DiagnosticsStringOptions = {}): string {
    if (this.description !== undefined) return this._addTooltip(this.description);
    this._maybeCacheValue();
    if (this.hasFailure)
      return `EXCEPTION (${this.failure === null ? 'Null' : this.failure === undefined ? 'Undefined' : ((this.failure as { constructor?: { name?: string } }).constructor?.name ?? typeof this.failure)})`;
    if (this.ifNull !== undefined && this.value === null) return this._addTooltip(this.ifNull);
    const value = this.valueToString(options);
    return this._addTooltip(value === '' && this.ifEmpty !== undefined ? this.ifEmpty : value);
  }
  get propertyType(): string {
    return this.typeName;
  }
  override toJsonMap(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    const value = this.value;
    let properties: JsonDiagnosticsNode[] | undefined;
    if (
      delegate.expandPropertyValues &&
      delegate.includeProperties &&
      isDiagnosticable(value) &&
      this.getProperties().length === 0
    ) {
      delegate = delegate.copyWith({ subtreeDepth: 0, includeProperties: false });
      properties = DiagnosticsNode.toJsonList(
        delegate.filterProperties(value.toDiagnosticsNode().getProperties(), this),
        this,
        delegate,
      );
    }
    const result = super.toJsonMap(delegate);
    if (properties !== undefined) result.properties = properties;
    if (this.defaultValue !== kNoDefaultValue)
      result.defaultValue = diagnosticValueString(this.defaultValue);
    if (this.ifEmpty !== undefined) result.ifEmpty = this.ifEmpty;
    if (this.ifNull !== undefined) result.ifNull = this.ifNull;
    if (this.tooltip !== undefined) result.tooltip = this.tooltip;
    result.missingIfNull = this.missingIfNull;
    if (this.hasFailure) result.exception = String(this.exception);
    result.propertyType = this.propertyType;
    result.defaultLevel = this.defaultLevel;
    if (isDiagnosticable(value) || value instanceof DiagnosticsNode)
      result.isDiagnosticableValue = true;
    if (typeof value === 'number') result.value = Number.isFinite(value) ? value : String(value);
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
      result.value = value;
    return result;
  }
  override getProperties(): readonly DiagnosticsNode[] {
    if (!this.expandableValue) return [];
    const value = this.value;
    if (value instanceof DiagnosticsNode) return value.getProperties();
    return isDiagnosticable(value)
      ? value.toDiagnosticsNode({ style: this.style }).getProperties()
      : [];
  }
  override getChildren(): readonly DiagnosticsNode[] {
    if (!this.expandableValue) return [];
    const value = this.value;
    if (value instanceof DiagnosticsNode) return value.getChildren();
    return isDiagnosticable(value)
      ? value.toDiagnosticsNode({ style: this.style }).getChildren()
      : [];
  }
}
export class StringProperty extends DiagnosticsProperty<string> {
  readonly quoted: boolean;
  constructor(
    name: string | null,
    value: string | null,
    o: DiagnosticsPropertyOptions<string> & { readonly quoted?: boolean } = {},
  ) {
    super(name, value, { ...o, typeName: 'String' });
    this.quoted = o.quoted ?? true;
  }
  override toJsonMap(
    delegate: DiagnosticsSerializationDelegate = new DiagnosticsSerializationDelegate(),
  ): JsonDiagnosticsNode {
    return { ...super.toJsonMap(delegate), quoted: this.quoted };
  }
  override valueToString(options: DiagnosticsStringOptions = {}): string {
    let text = this.description ?? this.value;
    if (options.parentConfiguration?.lineBreakProperties === false && text !== null)
      text = text.replaceAll('\n', '\\n');
    if (this.quoted && text !== null)
      return text === '' && this.ifEmpty !== undefined ? this.ifEmpty : `"${text}"`;
    return String(text);
  }
}
export class DiagnosticPropertiesBuilder {
  readonly properties: DiagnosticsNode[];
  defaultDiagnosticsTreeStyle: DiagnosticsTreeStyle = 'sparse';
  emptyBodyDescription: string | null = null;
  constructor(properties: DiagnosticsNode[] = []) {
    this.properties = properties;
  }
  add(property: DiagnosticsNode | null): void {
    if (FoundationBuildMode.debug && property) this.properties.push(property);
  }
  static fromProperties(properties: Iterable<DiagnosticsNode>): DiagnosticPropertiesBuilder {
    return new DiagnosticPropertiesBuilder(
      Array.isArray(properties) ? properties : Array.from(properties),
    );
  }
}
export interface Diagnosticable {
  debugFillProperties(properties: DiagnosticPropertiesBuilder): void;
  toStringShort(): string;
  toDiagnosticsNode(options?: DiagnosticsOptions): DiagnosticsNode;
}
export interface DiagnosticableTreeProtocol extends Diagnosticable {
  debugDescribeChildren(): readonly DiagnosticsNode[];
}
function hasValueEquality(value: unknown): value is { equals(other: unknown): boolean } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'equals' in value &&
    typeof value.equals === 'function'
  );
}
function isDiagnosticable(value: unknown): value is Diagnosticable {
  return (
    value !== null &&
    typeof value === 'object' &&
    'debugFillProperties' in value &&
    typeof value.debugFillProperties === 'function' &&
    'toStringShort' in value &&
    typeof value.toStringShort === 'function' &&
    'toDiagnosticsNode' in value &&
    typeof value.toDiagnosticsNode === 'function'
  );
}
export class DiagnosticableNode<T extends Diagnosticable> extends DiagnosticsNode {
  private cached: DiagnosticPropertiesBuilder | undefined;
  constructor(
    readonly diagnosticValue: T,
    o: DiagnosticsOptions = {},
  ) {
    super(o);
  }
  override get value(): T {
    return this.diagnosticValue;
  }
  get builder(): DiagnosticPropertiesBuilder | null {
    if (!FoundationBuildMode.debug) return null;
    if (!this.cached) {
      this.cached = new DiagnosticPropertiesBuilder();
      this.value.debugFillProperties(this.cached);
    }
    return this.cached;
  }
  override get style(): DiagnosticsTreeStyle {
    return FoundationBuildMode.release
      ? 'none'
      : (super.style ?? this.builder!.defaultDiagnosticsTreeStyle);
  }
  override get emptyBodyDescription(): string | null {
    return FoundationBuildMode.debug ? this.builder!.emptyBodyDescription : '';
  }
  toDescription(): string {
    return FoundationBuildMode.debug ? this.value.toStringShort() : '';
  }
  override getProperties(): readonly DiagnosticsNode[] {
    return FoundationBuildMode.debug ? this.builder!.properties : [];
  }
}
export class DiagnosticableTreeNode extends DiagnosticableNode<DiagnosticableTreeProtocol> {
  override getChildren(): readonly DiagnosticsNode[] {
    return this.value.debugDescribeChildren();
  }
}
export class DiagnosticsBlock extends DiagnosticsNode {
  private readonly properties: readonly DiagnosticsNode[];
  private readonly children: readonly DiagnosticsNode[];
  private readonly text: string;
  private readonly blockValue: unknown;
  constructor(
    o: DiagnosticsOptions & {
      readonly description?: string;
      readonly value?: unknown;
      readonly properties?: Iterable<DiagnosticsNode>;
      readonly children?: Iterable<DiagnosticsNode>;
    } = {},
  ) {
    super({
      style: 'whitespace',
      level: 'info',
      ...o,
      showName: (o.showName ?? true) && o.name != null,
    });
    this.properties = Array.isArray(o.properties) ? o.properties : Array.from(o.properties ?? []);
    this.children = Array.isArray(o.children) ? o.children : Array.from(o.children ?? []);
    this.text = o.description ?? '';
    this.blockValue = o.value ?? null;
  }
  override get value(): unknown {
    return this.blockValue;
  }
  toDescription(): string {
    return this.text;
  }
  override getProperties(): readonly DiagnosticsNode[] {
    return this.properties;
  }
  override getChildren(): readonly DiagnosticsNode[] {
    return this.children;
  }
}

abstract class _ErrorDiagnostic extends DiagnosticsProperty<readonly unknown[]> {
  constructor(message: string, level: DiagnosticLevel) {
    super(null, [message], {
      showName: false,
      showSeparator: false,
      defaultValue: null,
      style: 'flat',
      level,
    });
  }
  override valueToString(): string {
    return this.value!.map(String).join('');
  }
  override toString(): string {
    return this.valueToString();
  }
}

export class ErrorDescription extends _ErrorDiagnostic {
  constructor(message: string) {
    super(message, 'info');
  }
}

export class ErrorSummary extends _ErrorDiagnostic {
  constructor(message: string) {
    super(message, 'summary');
  }
}

export class ErrorHint extends _ErrorDiagnostic {
  constructor(message: string) {
    super(message, 'hint');
  }
}

export class ErrorSpacer extends DiagnosticsProperty<void> {
  constructor() {
    super('', null, { description: '', showName: false });
  }
}
