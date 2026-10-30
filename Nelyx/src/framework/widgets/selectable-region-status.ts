// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Reviewed selection-status declarations from widgets/selectable_region.dart.
import { ChangeNotifier } from '../../foundation/notifier.ts';
import type { ValueListenable } from '../../foundation/notifier.ts';
import { FoundationBuildMode } from '../../foundation/constants.ts';
import { invariant } from '../../foundation/errors.ts';
import { InheritedWidget } from './framework.ts';
import type { Widget, BuildContext, WidgetOptions } from './framework.ts';
export class SelectableRegionSelectionStatus {
  static readonly changing = new SelectableRegionSelectionStatus(0, 'changing');
  static readonly finalized = new SelectableRegionSelectionStatus(1, 'finalized');
  static readonly values = Object.freeze([this.changing, this.finalized]);
  private constructor(
    readonly index: number,
    readonly name: string,
  ) {
    Object.freeze(this);
  }
  toString(): string {
    return 'SelectableRegionSelectionStatus.' + this.name;
  }
}
/** @internal Source notifier deliberately notifies repeated `changing` assignments. */
export class SelectableRegionSelectionStatusNotifier
  extends ChangeNotifier
  implements ValueListenable<SelectableRegionSelectionStatus>
{
  private status = SelectableRegionSelectionStatus.finalized;
  get value(): SelectableRegionSelectionStatus {
    return this.status;
  }
  set value(value: SelectableRegionSelectionStatus) {
    if (FoundationBuildMode.debug)
      invariant(
        value === SelectableRegionSelectionStatus.changing ||
          (value === SelectableRegionSelectionStatus.finalized &&
            this.status === SelectableRegionSelectionStatus.changing),
        'selection-already-finalized',
        'Attempting to finalize the selection when it is already finalized.',
      );
    this.status = value;
    this.notifyListeners();
  }
}
export class SelectableRegionSelectionStatusScope extends InheritedWidget {
  /** @internal Source private construction is used by the owning Region State. */
  constructor(
    readonly selectionStatusNotifier: ValueListenable<SelectableRegionSelectionStatus>,
    child: Widget,
    { key = null }: WidgetOptions = {},
  ) {
    super(child, key);
  }
  static maybeOf(context: BuildContext): ValueListenable<SelectableRegionSelectionStatus> | null {
    return (
      context.maybeDependOn(SelectableRegionSelectionStatusScope)?.selectionStatusNotifier ?? null
    );
  }
  updateShouldNotify(old: this): boolean {
    return this.selectionStatusNotifier !== old.selectionStatusNotifier;
  }
}
