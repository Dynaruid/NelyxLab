// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '../../foundation/errors.ts';
import { FlutterErrorDetails } from '../../foundation/assertions.ts';
import { ErrorDescription } from '../../foundation/diagnostics.ts';
import { FlutterError } from '../../foundation/flutter-error.ts';
import { InheritedWidget, State, StatefulWidget } from './framework.ts';
import type { BuildContext, Widget, WidgetOptions } from './framework.ts';
import { NotificationListener } from './notification-listener.ts';
import { ScrollNotification } from './scroll-notification.ts';
import { ScrollMetricsNotification } from './scroll-position.ts';

export type ScrollNotificationCallback = (notification: ScrollNotification) => void;

class ObserverScope extends InheritedWidget {
  constructor(
    readonly state: ScrollNotificationObserverState,
    child: Widget,
  ) {
    super(child);
  }

  override updateShouldNotify(old: ObserverScope): boolean {
    return old.state !== this.state;
  }
}

export class ScrollNotificationObserver extends StatefulWidget {
  readonly child: Widget;

  constructor({ child, key = null }: WidgetOptions & { readonly child: Widget }) {
    super(key);
    this.child = child;
  }

  static maybeOf(context: BuildContext): ScrollNotificationObserverState | null {
    return context.maybeDependOn(ObserverScope)?.state ?? null;
  }

  static of(context: BuildContext): ScrollNotificationObserverState {
    const observer = this.maybeOf(context);
    invariant(
      observer,
      'missing-scroll-observer',
      'ScrollNotificationObserver.of requires an ancestor observer',
    );
    return observer;
  }

  override createState(): ScrollNotificationObserverState {
    return new ScrollNotificationObserverState();
  }
}

export class ScrollNotificationObserverState extends State<ScrollNotificationObserver> {
  private readonly listeners = new Set<{ readonly callback: ScrollNotificationCallback }>();

  addListener(callback: ScrollNotificationCallback): void {
    this.listeners.add({ callback });
  }

  removeListener(callback: ScrollNotificationCallback): void {
    for (const entry of this.listeners) {
      if (entry.callback === callback) {
        this.listeners.delete(entry);
        return;
      }
    }
  }

  private dispatch(notification: ScrollNotification): boolean {
    for (const entry of [...this.listeners]) {
      if (!this.listeners.has(entry)) continue;
      try {
        entry.callback(notification);
      } catch (exception) {
        FlutterError.reportError(
          new FlutterErrorDetails({
            exception,
            library: 'widgets library',
            context: new ErrorDescription('while dispatching scroll notifications'),
          }),
        );
      }
    }
    return false;
  }

  override build(): Widget {
    return new NotificationListener({
      notificationType: ScrollMetricsNotification,
      onNotification: (notification) => this.dispatch(notification.asScrollUpdate()),
      child: new NotificationListener({
        notificationType: ScrollNotification,
        onNotification: (notification) => this.dispatch(notification),
        child: new ObserverScope(this, this.widget.child),
      }),
    });
  }

  override dispose(): void {
    this.listeners.clear();
    super.dispose();
  }
}
