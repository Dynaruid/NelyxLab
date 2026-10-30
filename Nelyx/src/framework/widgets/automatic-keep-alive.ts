// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { State, StatefulWidget, StatelessWidget, ParentDataElement } from './framework.ts';
import type { BuildContext, Element, Widget } from './framework.ts';
import { Notification, NotificationListener } from './notification-listener.ts';
import { KeepAlive } from './keep-alive.ts';
import { tickerScheduler } from './ticker-scheduler.ts';
import type { FrameScheduler } from '../scheduler/scheduler.ts';
import { ChangeNotifier } from '../../foundation/notifier.ts';
import type { Listenable } from '../../foundation/notifier.ts';
import type { Key } from '../../foundation/key.ts';
import { invariant } from '../../foundation/errors.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { FlagProperty } from '../../foundation/diagnostic-properties.ts';
import { DiagnosticsProperty } from '../../foundation/diagnostics.ts';
import type { DiagnosticPropertiesBuilder } from '../../foundation/diagnostics.ts';
import { protect } from '../../ui/value-math.ts';

export class AutomaticKeepAlive extends StatefulWidget {
  readonly child: Widget;
  constructor({ child, key = null }: { readonly child: Widget; readonly key?: Key | null }) {
    super(key);
    this.child = child;
    protect(this, ['child']);
  }
  createState(): State<AutomaticKeepAlive> {
    return new _AutomaticKeepAliveState();
  }
}
class _AutomaticKeepAliveState extends State<AutomaticKeepAlive> {
  private _handles: Map<Listenable, () => void> | null = null;
  private _child!: Widget;
  private _keepingAlive = false;
  private _scheduler!: FrameScheduler;
  override initState(): void {
    super.initState();
    this._scheduler = tickerScheduler(this.context);
    this._updateChild();
  }
  override didUpdateWidget(oldWidget: AutomaticKeepAlive): void {
    super.didUpdateWidget(oldWidget);
    this._updateChild();
  }
  private _updateChild(): void {
    this._child = new NotificationListener({
      notificationType: KeepAliveNotification,
      onNotification: (n) => this._addClient(n),
      child: this.widget.child,
    });
  }
  override dispose(): void {
    const errors: unknown[] = [];
    if (this._handles !== null) {
      for (const [handle, callback] of this._handles)
        try {
          handle.removeListener(callback);
        } catch (error) {
          errors.push(error);
        }
      this._handles.clear();
    }
    try {
      super.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length)
      throw new AggregateError(errors, 'AutomaticKeepAlive listener teardown failed');
  }
  private _addClient(notification: KeepAliveNotification): boolean {
    const handle = notification.handle;
    this._handles ??= new Map();
    invariant(
      !this._handles.has(handle),
      'duplicate-keep-alive-handle',
      'A KeepAlive handle must be released before reuse',
    );
    const callback = this._createCallback(handle);
    this._handles.set(handle, callback);
    try {
      handle.addListener(callback);
    } catch (error) {
      this._handles.delete(handle);
      throw error;
    }
    if (!this._keepingAlive) {
      this._keepingAlive = true;
      const childElement = this._getChildElement();
      if (childElement !== null) this._updateParentDataOfChild(childElement);
      else
        this._scheduler.addPostFrameCallback(
          () => {
            if (!this.mounted || !(this.context as Element).active) return;
            const child = this._getChildElement();
            invariant(
              child !== null,
              'missing-keep-alive-child',
              'AutomaticKeepAlive must have its ParentData child after the frame',
            );
            // The handle can be released before this callback runs. Only enabling
            // keep-alive is permitted out of turn; a queued rebuild applies false.
            if (this._keepingAlive) this._updateParentDataOfChild(child);
          },
          { debugLabel: 'AutomaticKeepAlive.updateParentData' },
        );
    }
    return false;
  }
  private _getChildElement(): ParentDataElement | null {
    invariant(this.mounted, 'disposed-keep-alive-state', 'KeepAlive child lookup after disposal');
    let childElement: Element | null = null;
    (this.context as Element).visitChildren((child) => {
      invariant(
        childElement === null,
        'multiple-keep-alive-children',
        'AutomaticKeepAlive must have one ParentData child',
      );
      childElement = child;
    });
    const child = childElement as Element | null;
    invariant(
      child === null || child instanceof ParentDataElement,
      'invalid-keep-alive-child',
      'AutomaticKeepAlive child must be a ParentDataElement',
    );
    // Queued Element builds can link the ParentDataElement before its render
    // descendant is mounted. Synchronous source builds link it later. Treat
    // this intermediate state like the source's absent first-build child.
    return child !== null && child.renderObjects.length > 0 ? (child as ParentDataElement) : null;
  }
  private _updateParentDataOfChild(childElement: ParentDataElement): void {
    childElement.applyWidgetOutOfTurn(this.build(this.context) as KeepAlive);
  }
  private _createCallback(handle: Listenable): () => void {
    const callback = () => {
      invariant(
        this.mounted,
        'late-keep-alive-handle',
        'KeepAlive handle triggered after AutomaticKeepAlive disposal',
      );
      this._handles!.delete(handle);
      handle.removeListener(callback);
      if (this._handles!.size === 0) {
        const scheduler = this._scheduler;
        if (scheduler.disposed || !(this.context as Element).mounted) {
          this._keepingAlive = false;
          return;
        }
        if (
          scheduler.phase === 'idle' ||
          scheduler.phase === 'transient' ||
          scheduler.phase === 'mid-frame-microtasks'
        )
          this.setState(() => {
            this._keepingAlive = false;
          });
        else {
          this._keepingAlive = false;
          void Promise.resolve().then(() => {
            if (
              this.mounted &&
              (this.context as Element).mounted &&
              this._handles!.size === 0 &&
              !scheduler.disposed
            )
              this.setState(() => {});
          });
        }
      }
    };
    return callback;
  }
  build(_context: BuildContext): Widget {
    return new KeepAlive({ keepAlive: this._keepingAlive, child: this._child });
  }
  override debugFillProperties(description: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(description);
    description.add(
      new FlagProperty('_keepingAlive', this._keepingAlive, { ifTrue: 'keeping subtree alive' }),
    );
    description.add(
      new DiagnosticsProperty('handles', this._handles, {
        ...(this._handles !== null
          ? {
              description: `${this._handles.size} active client${this._handles.size === 1 ? '' : 's'}`,
            }
          : {}),
        ifNull: 'no notifications ever received',
      }),
    );
  }
}
export class KeepAliveNotification extends Notification {
  readonly handle: Listenable;
  constructor(handle: Listenable) {
    super();
    this.handle = handle;
    protect(this, ['handle']);
  }
}
export class KeepAliveHandle extends ChangeNotifier {
  private released = false;
  override dispose(): void {
    if (this.released) return;
    this.released = true;
    const errors: unknown[] = [];
    try {
      this.notifyListeners();
    } catch (error) {
      errors.push(error);
    }
    try {
      super.dispose();
    } catch (error) {
      errors.push(error);
    }
    if (errors.length) throw new AggregateError(errors, 'KeepAlive handle release failed');
  }
}
/** State superclass adaptation of the source mixin, consistent with ticker providers. */
export abstract class AutomaticKeepAliveClientMixin<
  W extends StatefulWidget = StatefulWidget,
> extends State<W> {
  private _keepAliveHandle: KeepAliveHandle | null = null;
  private _ensureKeepAlive(): void {
    invariant(
      this._keepAliveHandle === null,
      'duplicate-keep-alive-client',
      'KeepAlive client already owns a handle',
    );
    const handle = new KeepAliveHandle();
    this._keepAliveHandle = handle;
    try {
      new KeepAliveNotification(handle).dispatch(this.context);
    } catch (error) {
      this._keepAliveHandle = null;
      try {
        handle.dispose();
      } catch (failure) {
        throw new AggregateError([error, failure], 'KeepAlive dispatch and release failed');
      }
      throw error;
    }
  }
  private _releaseKeepAlive(): void {
    const handle = this._keepAliveHandle;
    this._keepAliveHandle = null;
    handle?.dispose();
  }
  protected abstract get wantKeepAlive(): boolean;
  protected updateKeepAlive(): void {
    if (this.wantKeepAlive) {
      if (this._keepAliveHandle === null) this._ensureKeepAlive();
    } else if (this._keepAliveHandle !== null) this._releaseKeepAlive();
  }
  override initState(): void {
    super.initState();
    if (this.wantKeepAlive) this._ensureKeepAlive();
  }
  override deactivate(): void {
    try {
      if (this._keepAliveHandle !== null) this._releaseKeepAlive();
    } finally {
      super.deactivate();
    }
  }
  build(_context: BuildContext): Widget {
    if (this.wantKeepAlive && this._keepAliveHandle === null) this._ensureKeepAlive();
    return new _NullWidget();
  }
}
class _NullWidget extends StatelessWidget {
  build(_context: BuildContext): Widget {
    throw new FlutterError(
      'Widgets that mix AutomaticKeepAliveClientMixin into their State must call super.build() but must ignore the return value of the superclass.',
    );
  }
}
