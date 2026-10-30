// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { ValueListenable } from '../../foundation/notifier.ts';
import { Diagnosticable } from '../../foundation/diagnosticable.ts';
import { DiagnosticsProperty, StringProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import {
  IntProperty,
  DoubleProperty,
  EnumProperty,
  IterableProperty,
} from '../../foundation/diagnostic-properties.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { protect } from '../../ui/value-math.ts';
import { Offset } from '../../ui/offset.ts';
import type { Size } from '../../ui/geometry.ts';
import { Rect } from '../../ui/rect.ts';
import type { Matrix4 } from '../../math/matrix4.ts';
import type { Matrix4Storage } from '../../ui/matrix4.ts';
import type { RenderObject } from './object.ts';
import type { LayerLink } from './layer.ts';
import { hashValues, listEquals, valueEquals } from '../painting/value-equality.ts';

export class SelectionResult {
  static readonly next = new SelectionResult(0, 'next');
  static readonly previous = new SelectionResult(1, 'previous');
  static readonly end = new SelectionResult(2, 'end');
  static readonly pending = new SelectionResult(3, 'pending');
  static readonly none = new SelectionResult(4, 'none');
  static readonly values = Object.freeze([
    SelectionResult.next,
    SelectionResult.previous,
    SelectionResult.end,
    SelectionResult.pending,
    SelectionResult.none,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'SelectionResult.' + this.name;
  }
}
export abstract class SelectionHandler extends ValueListenable<SelectionGeometry> {
  abstract pushHandleLayers(startHandle: LayerLink | null, endHandle: LayerLink | null): void;
  abstract getSelectedContent(): SelectedContent | null;
  abstract getSelection(): SelectedContentRange | null;
  abstract dispatchSelectionEvent(event: SelectionEvent): SelectionResult;
  abstract get contentLength(): number;
}
export class SelectedContentRange extends Diagnosticable(class {}) {
  readonly startOffset: number;
  readonly endOffset: number;
  constructor({
    startOffset,
    endOffset,
  }: {
    readonly startOffset: number;
    readonly endOffset: number;
  }) {
    super();
    if (FoundationBuildMode.debug)
      invariant(
        startOffset >= 0 && endOffset >= 0,
        'invalid-selected-content-range',
        'Selection offsets must be nonnegative',
      );
    this.startOffset = startOffset;
    this.endOffset = endOffset;
    protect(this, ['startOffset', 'endOffset']);
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof SelectedContentRange &&
        other.constructor === this.constructor &&
        other.startOffset === this.startOffset &&
        other.endOffset === this.endOffset)
    );
  }
  get hashCode(): number {
    return hashValues(this.startOffset, this.endOffset);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new IntProperty('startOffset', this.startOffset));
    properties.add(new IntProperty('endOffset', this.endOffset));
  }
}
export class SelectedContent extends Diagnosticable(class {}) {
  readonly plainText: string;
  constructor({ plainText }: { readonly plainText: string }) {
    super();
    this.plainText = plainText;
    protect(this, ['plainText']);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new StringProperty('plainText', this.plainText));
  }
}
/** The source mixin has only abstract members, represented as a TS protocol. */
export interface Selectable extends SelectionHandler {
  /** Source Matrix4 and the existing RenderObject storage ABI are normalized
   * by SelectionContainerDelegate; the legacy render ABI has not migrated. */
  getTransformTo(ancestor: RenderObject | null): Matrix4 | Matrix4Storage;
  readonly size: Size;
  readonly boundingBoxes: readonly Rect[];
  dispose(): void;
}
export abstract class SelectionRegistrar {
  abstract add(selectable: Selectable): void;
  abstract remove(selectable: Selectable): void;
}
export interface SelectionRegistrant {
  registrar: SelectionRegistrar | null;
}
type SelectableConstructor = abstract new (...args: any[]) => Selectable;
type RegistrantConstructor<Base extends SelectableConstructor> = abstract new (
  ...args: ConstructorParameters<Base>
) => InstanceType<Base> & SelectionRegistrant;
export function SelectionRegistrant<Base extends SelectableConstructor>(
  Base: Base,
): RegistrantConstructor<Base> {
  abstract class SelectionRegistrant extends Base {
    private _registrar: SelectionRegistrar | null = null;
    private _subscribedToSelectionRegistrar = false;
    private readonly changed = () => this._updateSelectionRegistrarSubscription();
    constructor(...args: any[]) {
      super(...args);
    }
    get registrar(): SelectionRegistrar | null {
      return this._registrar;
    }
    set registrar(value: SelectionRegistrar | null) {
      if (value === this._registrar) return;
      if (value === null) this.removeListener(this.changed);
      else if (this._registrar === null) this.addListener(this.changed);
      this._removeSelectionRegistrarSubscription();
      this._registrar = value;
      this._updateSelectionRegistrarSubscription();
    }
    private _updateSelectionRegistrarSubscription(): void {
      if (this._registrar === null) {
        this._subscribedToSelectionRegistrar = false;
        return;
      }
      if (this._subscribedToSelectionRegistrar && !this.value.hasContent) {
        this._registrar.remove(this);
        this._subscribedToSelectionRegistrar = false;
      } else if (!this._subscribedToSelectionRegistrar && this.value.hasContent) {
        this._registrar.add(this);
        this._subscribedToSelectionRegistrar = true;
      }
    }
    private _removeSelectionRegistrarSubscription(): void {
      if (this._subscribedToSelectionRegistrar) {
        this._registrar!.remove(this);
        this._subscribedToSelectionRegistrar = false;
      }
    }
    override dispose(): void {
      const errors: unknown[] = [];
      try {
        this._removeSelectionRegistrarSubscription();
      } catch (error) {
        errors.push(error);
      }
      try {
        this.removeListener(this.changed);
      } catch (error) {
        errors.push(error);
      }
      this._registrar = null;
      try {
        super.dispose();
      } catch (error) {
        errors.push(error);
      }
      if (errors.length) throw new AggregateError(errors, 'Selection registrar release failed');
    }
  }
  return SelectionRegistrant as unknown as RegistrantConstructor<Base>;
}
export class SelectionUtils {
  private constructor() {}
  static getResultBasedOnRect(targetRect: Rect, point: Offset): SelectionResult {
    if (targetRect.contains(point)) return SelectionResult.end;
    if (point.dy < targetRect.top) return SelectionResult.previous;
    if (point.dy > targetRect.bottom) return SelectionResult.next;
    return point.dx >= targetRect.right ? SelectionResult.next : SelectionResult.previous;
  }
  static adjustDragOffset(
    targetRect: Rect,
    point: Offset,
    { direction = 'ltr' }: { readonly direction?: 'ltr' | 'rtl' } = {},
  ): Offset {
    if (targetRect.contains(point)) return point;
    if (
      point.dy <= targetRect.top ||
      (point.dy <= targetRect.bottom && point.dx <= targetRect.left)
    )
      return direction === 'ltr' ? targetRect.topLeft : targetRect.topRight;
    return direction === 'ltr' ? targetRect.bottomRight : targetRect.bottomLeft;
  }
}
export class SelectionEventType {
  static readonly startEdgeUpdate = new SelectionEventType(0, 'startEdgeUpdate');
  static readonly endEdgeUpdate = new SelectionEventType(1, 'endEdgeUpdate');
  static readonly clear = new SelectionEventType(2, 'clear');
  static readonly selectAll = new SelectionEventType(3, 'selectAll');
  static readonly selectWord = new SelectionEventType(4, 'selectWord');
  static readonly selectParagraph = new SelectionEventType(5, 'selectParagraph');
  static readonly granularlyExtendSelection = new SelectionEventType(
    6,
    'granularlyExtendSelection',
  );
  static readonly directionallyExtendSelection = new SelectionEventType(
    7,
    'directionallyExtendSelection',
  );
  static readonly values = Object.freeze([
    SelectionEventType.startEdgeUpdate,
    SelectionEventType.endEdgeUpdate,
    SelectionEventType.clear,
    SelectionEventType.selectAll,
    SelectionEventType.selectWord,
    SelectionEventType.selectParagraph,
    SelectionEventType.granularlyExtendSelection,
    SelectionEventType.directionallyExtendSelection,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'SelectionEventType.' + this.name;
  }
}
export class TextGranularity {
  static readonly character = new TextGranularity(0, 'character');
  static readonly word = new TextGranularity(1, 'word');
  static readonly paragraph = new TextGranularity(2, 'paragraph');
  static readonly line = new TextGranularity(3, 'line');
  static readonly document = new TextGranularity(4, 'document');
  static readonly values = Object.freeze([
    TextGranularity.character,
    TextGranularity.word,
    TextGranularity.paragraph,
    TextGranularity.line,
    TextGranularity.document,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'TextGranularity.' + this.name;
  }
}
export abstract class SelectionEvent {
  readonly type: SelectionEventType;
  protected constructor(type: SelectionEventType) {
    this.type = type;
    protect(this, ['type']);
  }
}
export class SelectAllSelectionEvent extends SelectionEvent {
  constructor() {
    super(SelectionEventType.selectAll);
  }
}
export class ClearSelectionEvent extends SelectionEvent {
  constructor() {
    super(SelectionEventType.clear);
  }
}
export class SelectWordSelectionEvent extends SelectionEvent {
  readonly globalPosition: Offset;
  constructor({ globalPosition }: { readonly globalPosition: Offset }) {
    super(SelectionEventType.selectWord);
    this.globalPosition = globalPosition;
    protect(this, ['globalPosition']);
  }
}
export class SelectParagraphSelectionEvent extends SelectionEvent {
  readonly globalPosition: Offset;
  readonly absorb: boolean;
  constructor({
    globalPosition,
    absorb = false,
  }: {
    readonly globalPosition: Offset;
    readonly absorb?: boolean;
  }) {
    super(SelectionEventType.selectParagraph);
    this.globalPosition = globalPosition;
    this.absorb = absorb;
    protect(this, ['globalPosition', 'absorb']);
  }
}
export class SelectionEdgeUpdateEvent extends SelectionEvent {
  readonly globalPosition: Offset;
  readonly granularity: TextGranularity;
  private constructor(
    type: SelectionEventType,
    {
      globalPosition,
      granularity,
    }: { readonly globalPosition: Offset; readonly granularity?: TextGranularity | null },
  ) {
    super(type);
    this.globalPosition = globalPosition;
    this.granularity = granularity ?? TextGranularity.character;
    protect(this, ['globalPosition', 'granularity']);
  }
  static forStart(options: {
    readonly globalPosition: Offset;
    readonly granularity?: TextGranularity | null;
  }): SelectionEdgeUpdateEvent {
    return new SelectionEdgeUpdateEvent(SelectionEventType.startEdgeUpdate, options);
  }
  static forEnd(options: {
    readonly globalPosition: Offset;
    readonly granularity?: TextGranularity | null;
  }): SelectionEdgeUpdateEvent {
    return new SelectionEdgeUpdateEvent(SelectionEventType.endEdgeUpdate, options);
  }
}
export class GranularlyExtendSelectionEvent extends SelectionEvent {
  readonly forward: boolean;
  readonly isEnd: boolean;
  readonly granularity: TextGranularity;
  constructor({
    forward,
    isEnd,
    granularity,
  }: {
    readonly forward: boolean;
    readonly isEnd: boolean;
    readonly granularity: TextGranularity;
  }) {
    super(SelectionEventType.granularlyExtendSelection);
    this.forward = forward;
    this.isEnd = isEnd;
    this.granularity = granularity;
    protect(this, ['forward', 'isEnd', 'granularity']);
  }
}
export class SelectionExtendDirection {
  static readonly previousLine = new SelectionExtendDirection(0, 'previousLine');
  static readonly nextLine = new SelectionExtendDirection(1, 'nextLine');
  static readonly forward = new SelectionExtendDirection(2, 'forward');
  static readonly backward = new SelectionExtendDirection(3, 'backward');
  static readonly values = Object.freeze([
    SelectionExtendDirection.previousLine,
    SelectionExtendDirection.nextLine,
    SelectionExtendDirection.forward,
    SelectionExtendDirection.backward,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'SelectionExtendDirection.' + this.name;
  }
}
export class DirectionallyExtendSelectionEvent extends SelectionEvent {
  readonly dx: number;
  readonly isEnd: boolean;
  readonly direction: SelectionExtendDirection;
  constructor({
    dx,
    isEnd,
    direction,
  }: {
    readonly dx: number;
    readonly isEnd: boolean;
    readonly direction: SelectionExtendDirection;
  }) {
    super(SelectionEventType.directionallyExtendSelection);
    this.dx = dx;
    this.isEnd = isEnd;
    this.direction = direction;
    protect(this, ['dx', 'isEnd', 'direction']);
  }
  copyWith({
    dx,
    isEnd,
    direction,
  }: {
    readonly dx?: number | null;
    readonly isEnd?: boolean | null;
    readonly direction?: SelectionExtendDirection | null;
  } = {}): DirectionallyExtendSelectionEvent {
    return new DirectionallyExtendSelectionEvent({
      dx: dx ?? this.dx,
      isEnd: isEnd ?? this.isEnd,
      direction: direction ?? this.direction,
    });
  }
}
export class SelectionStatus {
  static readonly uncollapsed = new SelectionStatus(0, 'uncollapsed');
  static readonly collapsed = new SelectionStatus(1, 'collapsed');
  static readonly none = new SelectionStatus(2, 'none');
  static readonly values = Object.freeze([
    SelectionStatus.uncollapsed,
    SelectionStatus.collapsed,
    SelectionStatus.none,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'SelectionStatus.' + this.name;
  }
}
export interface SelectionGeometryOptions {
  readonly startSelectionPoint?: SelectionPoint | null;
  readonly endSelectionPoint?: SelectionPoint | null;
  readonly selectionRects?: readonly Rect[];
  readonly status: SelectionStatus;
  readonly hasContent: boolean;
}
export class SelectionGeometry extends Diagnosticable(class {}) {
  readonly startSelectionPoint: SelectionPoint | null;
  readonly endSelectionPoint: SelectionPoint | null;
  readonly selectionRects: readonly Rect[];
  readonly status: SelectionStatus;
  readonly hasContent: boolean;
  constructor({
    startSelectionPoint = null,
    endSelectionPoint = null,
    selectionRects = [],
    status,
    hasContent,
  }: SelectionGeometryOptions) {
    super();
    if (FoundationBuildMode.debug)
      invariant(
        (startSelectionPoint === null && endSelectionPoint === null) ||
          status !== SelectionStatus.none,
        'invalid-selection-geometry',
        'Selection points require a selection status',
      );
    this.startSelectionPoint = startSelectionPoint;
    this.endSelectionPoint = endSelectionPoint;
    this.selectionRects = Object.freeze([...selectionRects]);
    this.status = status;
    this.hasContent = hasContent;
    protect(this, [
      'startSelectionPoint',
      'endSelectionPoint',
      'selectionRects',
      'status',
      'hasContent',
    ]);
  }
  get hasSelection(): boolean {
    return this.status !== SelectionStatus.none;
  }
  copyWith({
    startSelectionPoint,
    endSelectionPoint,
    selectionRects,
    status,
    hasContent,
  }: Partial<{
    readonly startSelectionPoint: SelectionPoint | null;
    readonly endSelectionPoint: SelectionPoint | null;
    readonly selectionRects: readonly Rect[] | null;
    readonly status: SelectionStatus | null;
    readonly hasContent: boolean | null;
  }> = {}): SelectionGeometry {
    return new SelectionGeometry({
      startSelectionPoint: startSelectionPoint ?? this.startSelectionPoint,
      endSelectionPoint: endSelectionPoint ?? this.endSelectionPoint,
      selectionRects: selectionRects ?? this.selectionRects,
      status: status ?? this.status,
      hasContent: hasContent ?? this.hasContent,
    });
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof SelectionGeometry &&
        other.constructor === this.constructor &&
        valueEquals(other.startSelectionPoint, this.startSelectionPoint) &&
        valueEquals(other.endSelectionPoint, this.endSelectionPoint) &&
        listEquals(other.selectionRects, this.selectionRects) &&
        other.status === this.status &&
        other.hasContent === this.hasContent)
    );
  }
  get hashCode(): number {
    return hashValues(
      this.startSelectionPoint,
      this.endSelectionPoint,
      this.selectionRects,
      this.status,
      this.hasContent,
    );
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('startSelectionPoint', this.startSelectionPoint));
    properties.add(new DiagnosticsProperty('endSelectionPoint', this.endSelectionPoint));
    properties.add(new IterableProperty('selectionRects', this.selectionRects));
    properties.add(new EnumProperty('status', this.status));
    properties.add(new DiagnosticsProperty('hasContent', this.hasContent));
  }
}
export class SelectionPoint extends Diagnosticable(class {}) {
  readonly localPosition: Offset;
  readonly lineHeight: number;
  readonly handleType: TextSelectionHandleType;
  constructor({
    localPosition,
    lineHeight,
    handleType,
  }: {
    readonly localPosition: Offset;
    readonly lineHeight: number;
    readonly handleType: TextSelectionHandleType;
  }) {
    super();
    this.localPosition = localPosition;
    this.lineHeight = lineHeight;
    this.handleType = handleType;
    protect(this, ['localPosition', 'lineHeight', 'handleType']);
  }
  equals(other: unknown): boolean {
    return (
      this === other ||
      (other instanceof SelectionPoint &&
        other.constructor === this.constructor &&
        other.localPosition.equals(this.localPosition) &&
        other.lineHeight === this.lineHeight &&
        other.handleType === this.handleType)
    );
  }
  get hashCode(): number {
    return hashValues(this.localPosition, this.lineHeight, this.handleType);
  }
  override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(properties);
    properties.add(new DiagnosticsProperty('localPosition', this.localPosition));
    properties.add(new DoubleProperty('lineHeight', this.lineHeight));
    properties.add(new EnumProperty('handleType', this.handleType));
  }
}
export class TextSelectionHandleType {
  static readonly left = new TextSelectionHandleType(0, 'left');
  static readonly right = new TextSelectionHandleType(1, 'right');
  static readonly collapsed = new TextSelectionHandleType(2, 'collapsed');
  static readonly values = Object.freeze([
    TextSelectionHandleType.left,
    TextSelectionHandleType.right,
    TextSelectionHandleType.collapsed,
  ]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'TextSelectionHandleType.' + this.name;
  }
}
