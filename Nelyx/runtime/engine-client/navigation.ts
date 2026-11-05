// SPDX-License-Identifier: BSD-3-Clause
import { State, StatefulWidget, Stack, Box, GlobalKey, ValueKey } from './widgets.ts';
import type { Widget, NodeOptions } from './widgets.ts';
import { protocol as p } from './codec.ts';
type Route = {
  widget: Widget;
  key: GlobalKey;
  modal: boolean;
  dismissible: boolean;
  resolve: (value: unknown) => void;
};
export class NavigatorController {
  /** @internal */ routes: Route[];
  private listener: (() => void) | undefined;
  private closed = false;
  constructor(home: Widget) {
    this.routes = [
      { widget: home, key: new GlobalKey(), modal: false, dismissible: false, resolve: () => {} },
    ];
  }
  push<T = unknown>(
    widget: Widget,
    options: { modal?: boolean; barrierDismissible?: boolean } = {},
  ): Promise<T | null> {
    if (this.closed || this.routes.length >= 32)
      throw new Error('Navigator closed or route budget exceeded');
    let resolve!: (value: unknown) => void;
    const result = new Promise<T | null>((done) => {
      resolve = (value) => done(value as T | null);
    });
    this.routes.push({
      widget,
      key: new GlobalKey(),
      modal: options.modal ?? false,
      dismissible: options.barrierDismissible ?? true,
      resolve,
    });
    this.listener?.();
    return result;
  }
  pop(result: unknown = null): boolean {
    if (this.routes.length < 2) return false;
    const route = this.routes.pop()!;
    this.listener?.();
    route.resolve(result);
    return true;
  }
  /** @internal */ attach(listener: () => void): void {
    if (this.listener || this.closed) throw new Error('Navigator already attached or closed');
    this.listener = listener;
  }
  /** @internal */ close(): void {
    this.closed = true;
    this.listener = undefined;
    for (const route of this.routes) route.resolve(null);
    this.routes.length = 0;
  }
}
export class Navigator extends StatefulWidget {
  constructor(
    readonly controller: NavigatorController,
    readonly options: NodeOptions = {},
  ) {
    super(options.key);
  }
  createState(): State {
    return new NavigatorState();
  }
}
class NavigatorState extends State<Navigator> {
  initState(): void {
    this.widget.controller.attach(() => this.setState(() => {}));
  }
  didUpdateWidget(old: Navigator): void {
    if (old.controller !== this.widget.controller)
      throw new Error('Navigator controller cannot change while attached');
  }
  build(): Widget {
    const routes = this.widget.controller.routes;
    let active = routes.length - 1;
    while (active > 0 && routes[active]!.modal) --active;
    return new Stack(
      routes.map((route, index) =>
        route.modal
          ? new Stack(
              [
                new Box([], {
                  color: 0x66000000,
                  horizontal: { kind: 'expand' },
                  vertical: { kind: 'expand' },
                  gestures: p.gestures.tap,
                  onGesture: (e) => {
                    if (e.kind === 'tap' && route.dismissible) this.widget.controller.pop();
                  },
                }),
                route.widget,
              ],
              {
                key: route.key,
                modal: true,
                horizontal: { kind: 'expand' },
                vertical: { kind: 'expand' },
                layout: { mainAlign: 'center', crossAlign: 'center' },
              },
            )
          : new Box([route.widget], {
              key: route.key,
              properties: { opacity: index >= active ? 1 : 0 },
              horizontal: { kind: 'expand' },
              vertical: { kind: 'expand' },
            }),
      ),
      {
        ...this.widget.options,
        key: new ValueKey('navigator'),
        horizontal: { kind: 'expand' },
        vertical: { kind: 'expand' },
      },
    );
  }
  dispose(): void {
    this.widget.controller.close();
  }
}
