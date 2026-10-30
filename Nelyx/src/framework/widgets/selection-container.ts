// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { State, StatefulWidget, InheritedWidget } from './framework.ts';
import type { BuildContext, Widget } from './framework.ts';
import {
  SelectionHandler,
  SelectionRegistrant,
  SelectionGeometry,
  SelectionStatus,
} from '../rendering/selection.ts';
import type {
  Selectable,
  SelectionRegistrar,
  SelectedContent,
  SelectedContentRange,
  SelectionEvent,
  SelectionResult,
} from '../rendering/selection.ts';
import { RenderBox } from '../rendering/object.ts';
import type { RenderObject } from '../rendering/object.ts';
import type { LayerLink } from '../rendering/layer.ts';
import { Matrix4 } from '../../math/matrix4.ts';
import { Rect } from '../../ui/rect.ts';
import type { Size } from '../../ui/geometry.ts';
import { protect } from '../../ui/value-math.ts';
import { valueEquals } from '../painting/value-equality.ts';
import { invariant } from '../../foundation/errors.ts';
import type { Key } from '../../foundation/key.ts';

export class SelectionContainer extends StatefulWidget {
  readonly registrar: SelectionRegistrar | null;
  readonly delegate: SelectionContainerDelegate | null;
  readonly child: Widget;
  /** A null delegate is the TS named-constructor adaptation used by disabled. */
  constructor({
    registrar = null,
    delegate,
    child,
    key = null,
  }: {
    readonly registrar?: SelectionRegistrar | null;
    readonly delegate: SelectionContainerDelegate | null;
    readonly child: Widget;
    readonly key?: Key | null;
  }) {
    super(key);
    invariant(
      delegate !== null || registrar === null,
      'disabled-selection-registrar',
      'Disabled SelectionContainer cannot register to a parent',
    );
    this.registrar = registrar;
    this.delegate = delegate;
    this.child = child;
    protect(this, ['registrar', 'delegate', 'child']);
  }
  static disabled({
    child,
    key = null,
  }: {
    readonly child: Widget;
    readonly key?: Key | null;
  }): SelectionContainer {
    return new SelectionContainer({ delegate: null, child, key });
  }
  static maybeOf(context: BuildContext): SelectionRegistrar | null {
    return context.maybeDependOn(SelectionRegistrarScope)?.registrar ?? null;
  }
  get _disabled(): boolean {
    return this.delegate === null;
  }
  createState(): State<SelectionContainer> {
    return new _SelectionContainerState();
  }
}
abstract class _SelectableState extends State<SelectionContainer> implements Selectable {
  abstract get value(): SelectionGeometry;
  abstract addListener(listener: () => void): void;
  abstract removeListener(listener: () => void): void;
  abstract pushHandleLayers(startHandle: LayerLink | null, endHandle: LayerLink | null): void;
  abstract getSelectedContent(): SelectedContent | null;
  abstract getSelection(): SelectedContentRange | null;
  abstract dispatchSelectionEvent(event: SelectionEvent): SelectionResult;
  abstract get contentLength(): number;
  abstract getTransformTo(ancestor: RenderObject | null): Matrix4;
  abstract get size(): Size;
  abstract get boundingBoxes(): readonly Rect[];
}
class _SelectionContainerState extends SelectionRegistrant(_SelectableState) {
  private readonly _listeners = new Set<() => void>();
  private static readonly _disabledGeometry = new SelectionGeometry({
    status: SelectionStatus.none,
    hasContent: true,
  });
  private get delegate(): SelectionContainerDelegate {
    invariant(
      this.widget.delegate !== null,
      'disabled-selection-container',
      'Disabled SelectionContainer cannot handle selection events',
    );
    return this.widget.delegate;
  }
  private get renderBox(): RenderBox {
    const render = this.context.findRenderObject();
    invariant(
      render instanceof RenderBox,
      'missing-selection-container-render-box',
      'SelectionContainer needs its actual box subtree',
    );
    return render;
  }
  override initState(): void {
    super.initState();
    if (!this.widget._disabled) {
      this.delegate._setSelectionContainerContext(this.context);
      if (this.widget.registrar !== null) this.registrar = this.widget.registrar;
    }
  }
  override didUpdateWidget(oldWidget: SelectionContainer): void {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.delegate !== this.widget.delegate) {
      const errors: unknown[] = [];
      if (oldWidget.delegate !== null) {
        try {
          oldWidget.delegate._setSelectionContainerContext(null);
        } catch (error) {
          errors.push(error);
        }
        for (const listener of this._listeners)
          try {
            oldWidget.delegate.removeListener(listener);
          } catch (error) {
            errors.push(error);
          }
      }
      if (this.widget.delegate !== null) {
        try {
          this.widget.delegate._setSelectionContainerContext(this.context);
        } catch (error) {
          errors.push(error);
        }
        for (const listener of this._listeners)
          try {
            this.widget.delegate.addListener(listener);
          } catch (error) {
            errors.push(error);
          }
      }
      if (!valueEquals(oldWidget.delegate?.value, this.widget.delegate?.value)) {
        const snapshot = [...this._listeners];
        for (const listener of snapshot)
          try {
            listener();
          } catch (error) {
            errors.push(error);
          }
      }
      if (errors.length) throw new AggregateError(errors, 'Selection delegate transfer failed');
    }
    if (this.widget._disabled) this.registrar = null;
    else if (this.widget.registrar !== null) this.registrar = this.widget.registrar;
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    if (this.widget.registrar === null && !this.widget._disabled)
      this.registrar = SelectionContainer.maybeOf(this.context);
  }
  addListener(listener: () => void): void {
    this.delegate.addListener(listener);
    this._listeners.add(listener);
  }
  removeListener(listener: () => void): void {
    this.widget.delegate?.removeListener(listener);
    this._listeners.delete(listener);
  }
  pushHandleLayers(startHandle: LayerLink | null, endHandle: LayerLink | null): void {
    this.delegate.pushHandleLayers(startHandle, endHandle);
  }
  getSelectedContent(): SelectedContent | null {
    return this.delegate.getSelectedContent();
  }
  getSelection(): SelectedContentRange | null {
    return this.delegate.getSelection();
  }
  dispatchSelectionEvent(event: SelectionEvent): SelectionResult {
    return this.delegate.dispatchSelectionEvent(event);
  }
  get value(): SelectionGeometry {
    return this.widget._disabled ? _SelectionContainerState._disabledGeometry : this.delegate.value;
  }
  getTransformTo(ancestor: RenderObject | null): Matrix4 {
    invariant(
      !this.widget._disabled,
      'disabled-selection-container',
      'Disabled SelectionContainer has no selection transform',
    );
    return Matrix4.fromList(this.renderBox.getTransformTo(ancestor));
  }
  get contentLength(): number {
    return this.delegate.contentLength;
  }
  get size(): Size {
    return this.renderBox.size;
  }
  get boundingBoxes(): readonly Rect[] {
    const rect = this.renderBox.paintBounds;
    return [Rect.fromLTWH(rect.x, rect.y, rect.width, rect.height)];
  }
  override dispose(): void {
    const errors: unknown[] = [];
    if (this.widget.delegate !== null) {
      try {
        this.widget.delegate._setSelectionContainerContext(null);
      } catch (error) {
        errors.push(error);
      }
      for (const listener of this._listeners)
        try {
          this.widget.delegate.removeListener(listener);
        } catch (error) {
          errors.push(error);
        }
    }
    try {
      super.dispose();
    } catch (error) {
      errors.push(error);
    }
    this._listeners.clear();
    if (errors.length) throw new AggregateError(errors, 'SelectionContainer release failed');
  }
  build(_context: BuildContext): Widget {
    return this.widget._disabled
      ? SelectionRegistrarScope._disabled(this.widget.child)
      : new SelectionRegistrarScope({ registrar: this.delegate, child: this.widget.child });
  }
}
export class SelectionRegistrarScope extends InheritedWidget {
  readonly registrar: SelectionRegistrar | null;
  constructor({
    registrar,
    child,
    key = null,
  }: {
    readonly registrar: SelectionRegistrar | null;
    readonly child: Widget;
    readonly key?: Key | null;
  }) {
    super(child, key);
    this.registrar = registrar;
    protect(this, ['registrar']);
  }
  /** @internal Source private disabled named constructor. */
  static _disabled(child: Widget): SelectionRegistrarScope {
    return new SelectionRegistrarScope({ registrar: null, child });
  }
  updateShouldNotify(oldWidget: SelectionRegistrarScope): boolean {
    return oldWidget.registrar !== this.registrar;
  }
}
export abstract class SelectionContainerDelegate
  extends SelectionHandler
  implements SelectionRegistrar
{
  private _selectionContainerContext: BuildContext | null = null;
  /** @internal A delegate belongs to exactly one live container. */
  _setSelectionContainerContext(context: BuildContext | null): void {
    invariant(
      context === null ||
        this._selectionContainerContext === null ||
        this._selectionContainerContext === context,
      'selection-delegate-owner',
      'A SelectionContainerDelegate cannot belong to two live containers',
    );
    this._selectionContainerContext = context;
  }
  /** Per-View scheduler adapter. Flutter's binding is process-global; Nelyx's is not. */
  protected get selectionContainerContext(): BuildContext | null {
    return this._selectionContainerContext;
  }
  private get renderBox(): RenderBox {
    const render = this._selectionContainerContext?.findRenderObject();
    invariant(
      render instanceof RenderBox,
      'unlaid-selection-container',
      'SelectionContainer delegate requires an actual rendered box subtree',
    );
    return render;
  }
  getTransformFrom(child: Selectable): Matrix4 {
    const transform = child.getTransformTo(this.renderBox);
    return transform instanceof Matrix4 ? transform : Matrix4.fromList(transform);
  }
  getTransformTo(ancestor: RenderObject | null): Matrix4 {
    return Matrix4.fromList(this.renderBox.getTransformTo(ancestor));
  }
  get hasSize(): boolean {
    return this.renderBox.hasSize;
  }
  get containerSize(): Size {
    invariant(
      this.hasSize,
      'unlaid-selection-container',
      'SelectionContainer must be laid out before reading its size',
    );
    return this.renderBox.size;
  }
  abstract add(selectable: Selectable): void;
  abstract remove(selectable: Selectable): void;
}
