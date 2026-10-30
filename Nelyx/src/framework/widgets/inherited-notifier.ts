// SPDX-License-Identifier: BSD-3-Clause
import type { Listenable } from '../../foundation/notifier.ts';
import type { Key } from '../../foundation/key.ts';
import { InheritedWidget, InheritedElement } from './framework.ts';
import type { Widget, Element, BuildOwner } from './framework.ts';

/** Multiple notifications in a frame coalesce before notifying dependent Elements. */
export class InheritedNotifier<T extends Listenable = Listenable> extends InheritedWidget {
  constructor(
    readonly notifier: T | null,
    child: Widget,
    key: Key | null = null,
  ) {
    super(child, key);
  }
  updateShouldNotify(old: this): boolean {
    return old.notifier !== this.notifier;
  }
  override createElement(): Element {
    return new NotifierElement(this);
  }
}
class NotifierElement extends InheritedElement {
  private notified = false;
  private readonly changed = () => {
    if (!this.mounted) return;
    this.notified = true;
    this.markNeedsBuild();
  };
  override mount(parent: Element | undefined, owner: BuildOwner, slot?: unknown): void {
    super.mount(parent, owner, slot);
    (this.widget as InheritedNotifier).notifier?.addListener(this.changed);
  }
  override update(widget: Widget): void {
    const old = (this.widget as InheritedNotifier).notifier,
      next = (widget as InheritedNotifier).notifier;
    if (old !== next) {
      old?.removeListener(this.changed);
      next?.addListener(this.changed);
    }
    super.update(widget);
  }
  override notifyClients(old: InheritedWidget): void {
    this.notified = false;
    super.notifyClients(old);
  }
  protected override build(): readonly Widget[] {
    if (this.notified) this.notifyClients(this.widget as InheritedWidget);
    return super.build();
  }
  override unmount(): void {
    if (!this.mounted) return;
    try {
      (this.widget as InheritedNotifier).notifier?.removeListener(this.changed);
    } finally {
      super.unmount();
    }
  }
}
