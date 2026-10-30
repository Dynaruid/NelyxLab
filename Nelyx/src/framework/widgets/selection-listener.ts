// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed listener declarations from widgets/selectable_region.dart.
import { ChangeNotifier } from '../../foundation/notifier.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { State, StatefulWidget } from './framework.ts';
import type { Widget } from './framework.ts';
import type { Key } from '../../foundation/key.ts';
import { SelectionContainer } from './selection-container.ts';
import { StaticSelectionContainerDelegate } from './selectable-region.ts';
import type {
  SelectionGeometry,
  SelectedContentRange,
  SelectionStatus,
} from '../rendering/selection.ts';
export interface SelectionDetails {
  readonly range: SelectedContentRange | null;
  readonly status: SelectionStatus;
}
export class SelectionListener extends StatefulWidget {
  readonly selectionNotifier: SelectionListenerNotifier;
  readonly child: Widget;
  constructor({
    selectionNotifier,
    child,
    key = null,
  }: {
    readonly selectionNotifier: SelectionListenerNotifier;
    readonly child: Widget;
    readonly key?: Key | null;
  }) {
    super(key);
    this.selectionNotifier = selectionNotifier;
    this.child = child;
  }
  createState(): State<SelectionListener> {
    return new SelectionListenerState();
  }
}
class SelectionListenerState extends State<SelectionListener> {
  private delegateValue: SelectionListenerDelegate | null = null;
  private get delegate(): SelectionListenerDelegate {
    return (this.delegateValue ??= new SelectionListenerDelegate(this.widget.selectionNotifier));
  }
  override didUpdateWidget(old: SelectionListener): void {
    super.didUpdateWidget(old);
    if (old.selectionNotifier !== this.widget.selectionNotifier)
      this.delegate._setNotifier(this.widget.selectionNotifier);
  }
  override dispose(): void {
    this.delegate.dispose();
    super.dispose();
  }
  build(): Widget {
    return new SelectionContainer({ delegate: this.delegate, child: this.widget.child });
  }
}
/** @internal The owning State transfers the notifier while retaining child selection. */
export class SelectionListenerDelegate
  extends StaticSelectionContainerDelegate
  implements SelectionDetails
{
  private initialGeometry: SelectionGeometry | null = null;
  constructor(private selectionNotifier: SelectionListenerNotifier) {
    super();
    selectionNotifier._registerSelectionListenerDelegate(this);
  }
  _setNotifier(value: SelectionListenerNotifier): void {
    this.selectionNotifier._unregisterSelectionListenerDelegate();
    this.selectionNotifier = value;
    value._registerSelectionListenerDelegate(this);
  }
  override notifyListeners(): void {
    super.notifyListeners();
    if (this.initialGeometry === null && !this.value.hasSelection) {
      this.initialGeometry = this.value;
      return;
    }
    this.selectionNotifier.notifyListeners();
  }
  override dispose(): void {
    this.selectionNotifier._unregisterSelectionListenerDelegate();
    this.initialGeometry = null;
    super.dispose();
  }
  get range(): SelectedContentRange | null {
    return this.getSelection();
  }
  get status(): SelectionStatus {
    return this.value.status;
  }
}
export class SelectionListenerNotifier extends ChangeNotifier {
  private delegate: SelectionListenerDelegate | null = null;
  get selection(): SelectionDetails {
    invariant(
      this.delegate !== null,
      'unregistered-selection-listener',
      'Selection client has not been registered to this notifier.',
    );
    return this.delegate;
  }
  get registered(): boolean {
    return this.delegate !== null;
  }
  /** @internal Private library collaboration, not a second public registration API. */
  _registerSelectionListenerDelegate(delegate: SelectionListenerDelegate): void {
    if (FoundationBuildMode.debug)
      invariant(
        !this.registered,
        'duplicate-selection-listener',
        'This SelectionListenerNotifier is already registered to another SelectionListener. Try providing a new SelectionListenerNotifier.',
      );
    this.delegate = delegate;
  }
  /** @internal */
  _unregisterSelectionListenerDelegate(): void {
    this.delegate = null;
  }
  override dispose(): void {
    this._unregisterSelectionListenerDelegate();
    super.dispose();
  }
  override addListener(listener: () => void): void {
    super.addListener(listener);
  }
}
