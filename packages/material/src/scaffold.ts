// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { AppTheme, Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { invariant } from '@nelyx/core/foundation/errors';
import { ValueKey } from '@nelyx/core/foundation/key';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import { allInsets } from '@nelyx/core/ui/geometry';
import type { Size } from '@nelyx/core/ui/geometry';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import {
  Column,
  Row,
  Expanded,
  Padding,
  Text,
  SizedBox,
  Stack,
  Positioned,
} from '@nelyx/core/framework/widgets/basic';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { MultiChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { CustomMultiChildLayout, LayoutId } from '@nelyx/core/framework/widgets/custom-layout';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import type { PreferredSizeWidget } from '@nelyx/core/framework/widgets/preferred-size';
import { ScrollNotificationObserver } from '@nelyx/core/framework/widgets/scroll-notification-observer';
import { isCurrentRoute } from '@nelyx/core/framework/widgets/navigation';
import { Material as MaterialSurface } from './material.ts';
import { Color } from '@nelyx/core/ui/color';
import { AppBar } from './app-bar.ts';
import { DrawerAlignment, DrawerController } from './drawer.ts';
import type { DrawerCallback, DrawerControllerState } from './drawer.ts';
import { ScaffoldMessenger } from './scaffold-messenger.ts';
import type { ScaffoldMessengerState } from './scaffold-messenger.ts';
import { SnackBarBehavior } from './snack-bar-behavior.ts';
import { SnackBarTheme } from './snack-bar-theme.ts';
import { Theme } from './theme.ts';

export {
  ScaffoldFeatureController,
  ScaffoldMessenger,
  ScaffoldMessengerState,
} from './scaffold-messenger.ts';
export type {
  ScaffoldMessengerOptions,
  ShowSnackBarOptions,
  CloseSnackBarOptions,
} from './scaffold-messenger.ts';

const drawerLayer = new ValueKey('Scaffold drawer');
const endDrawerLayer = new ValueKey('Scaffold end drawer');

export interface ScaffoldOptions extends WidgetOptions {
  readonly appBar?: PreferredSizeWidget | null;
  readonly body?: Widget | null;
  readonly drawer?: Widget | null;
  readonly onDrawerChanged?: DrawerCallback | null;
  readonly endDrawer?: Widget | null;
  readonly onEndDrawerChanged?: DrawerCallback | null;
  readonly drawerScrimColor?: Color | null;
  readonly drawerBarrierDismissible?: boolean;
  readonly drawerDragStartBehavior?: DragStartBehavior;
  readonly drawerEdgeDragWidth?: number | null;
  readonly drawerEnableOpenDragGesture?: boolean;
  readonly endDrawerEnableOpenDragGesture?: boolean;
  readonly bottomNavigationBar?: Widget | null;
  readonly floatingActionButton?: Widget | null;
  readonly backgroundColor?: Color | null;
  readonly primary?: boolean;
  readonly resizeToAvoidBottomInset?: boolean | null;
}

export class Scaffold extends StatefulWidget {
  readonly title: string;
  readonly body: Widget;
  readonly trailing: Widget | undefined;
  readonly options: Readonly<ScaffoldOptions> | null;

  constructor(options?: ScaffoldOptions);
  constructor(title: string, body: Widget, trailing?: Widget);
  constructor(options: ScaffoldOptions | string = {}, body?: Widget, trailing?: Widget) {
    super(typeof options === 'string' ? null : (options.key ?? null));
    this.title = typeof options === 'string' ? options : '';
    this.options = typeof options === 'string' ? null : Object.freeze({ ...options });
    this.body = this.options?.body ?? body ?? new SizedBox();
    this.trailing = trailing;
  }

  static maybeOf(context: BuildContext): ScaffoldState | null {
    if (context instanceof Element && context.stateObject instanceof ScaffoldState)
      return context.stateObject;
    return context.findAncestorStateOfType(ScaffoldState) ?? null;
  }

  static of(context: BuildContext): ScaffoldState {
    const scaffold = this.maybeOf(context);
    invariant(scaffold, 'missing-scaffold', 'Scaffold.of requires a Scaffold ancestor');
    return scaffold;
  }

  override createState(): ScaffoldState {
    return new ScaffoldState();
  }
}

export class ScaffoldState extends State<Scaffold> {
  private messenger: ScaffoldMessengerState | null = null;
  private unregister: (() => void) | null = null;
  private readonly drawerKey = new GlobalKey<DrawerControllerState>('Scaffold.drawer');
  private readonly endDrawerKey = new GlobalKey<DrawerControllerState>('Scaffold.endDrawer');

  get hasDrawer(): boolean {
    return this.widget.options?.drawer != null;
  }
  get hasEndDrawer(): boolean {
    return this.widget.options?.endDrawer != null;
  }
  get isDrawerOpen(): boolean {
    return this.drawerKey.currentState?.isDrawerOpen ?? false;
  }
  get isEndDrawerOpen(): boolean {
    return this.endDrawerKey.currentState?.isDrawerOpen ?? false;
  }

  openDrawer(): void {
    this.endDrawerKey.currentState?.close();
    this.drawerKey.currentState?.open();
  }
  closeDrawer(): void {
    this.drawerKey.currentState?.close();
  }
  openEndDrawer(): void {
    this.drawerKey.currentState?.close();
    this.endDrawerKey.currentState?.open();
  }
  closeEndDrawer(): void {
    this.endDrawerKey.currentState?.close();
  }

  private buildDrawers(body: Widget, options: ScaffoldOptions): Widget {
    const layers: Widget[] = [Positioned.fill(body)];
    if (options.drawer == null && options.endDrawer == null) return body;
    const primary = (end: boolean) => {
      const child = end ? options.endDrawer : options.drawer;
      if (child == null) return;
      const changed = end ? options.onEndDrawerChanged : options.onDrawerChanged;
      layers.push(
        Positioned.fill(
          new DrawerController({
            key: end ? this.endDrawerKey : this.drawerKey,
            child,
            alignment: end ? DrawerAlignment.end : DrawerAlignment.start,
            drawerCallback: (open) => {
              if (open) {
                if (end) this.closeDrawer();
                else this.closeEndDrawer();
              }
              this.setState(() => {});
              changed?.(open);
            },
            drawerBarrierDismissible: options.drawerBarrierDismissible ?? true,
            dragStartBehavior: options.drawerDragStartBehavior ?? DragStartBehavior.start,
            scrimColor: options.drawerScrimColor ?? null,
            edgeDragWidth: options.drawerEdgeDragWidth ?? null,
            enableOpenDragGesture: end
              ? (options.endDrawerEnableOpenDragGesture ?? true) && !this.isDrawerOpen
              : (options.drawerEnableOpenDragGesture ?? true) && !this.isEndDrawerOpen,
          }),
          { key: end ? endDrawerLayer : drawerLayer },
        ),
      );
    };
    primary(this.isDrawerOpen);
    primary(!this.isDrawerOpen);
    return new Stack(layers);
  }

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const messenger = ScaffoldMessenger.maybeOf(this.context);
    if (messenger === this.messenger && this.unregister) return;
    this.unregister?.();
    this.messenger = messenger;
    this.unregister = messenger?._registerScaffold(this) ?? null;
  }

  override deactivate(): void {
    this.unregister?.();
    this.unregister = null;
    super.deactivate();
  }

  override dispose(): void {
    this.unregister?.();
    this.unregister = null;
    this.messenger = null;
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const { options, body: suppliedBody, title, trailing } = this.widget;
    const parent = context.findAncestorStateOfType(ScaffoldState);
    const snack =
      parent?.messenger !== this.messenger && isCurrentRoute(context)
        ? (this.messenger?.currentSnackBar ?? null)
        : null;
    if (options) {
      const {
        appBar,
        bottomNavigationBar,
        floatingActionButton,
        primary = true,
        resizeToAvoidBottomInset,
        backgroundColor,
      } = options;
      const padding = MediaQuery.maybePaddingOf(context);
      const keyboard =
        resizeToAvoidBottomInset === false
          ? 0
          : (MediaQuery.maybeViewInsetsOf(context)?.bottom ?? 0);
      const body =
        padding === null
          ? suppliedBody
          : MediaQuery.removePadding({
              context,
              removeTop: appBar != null,
              removeBottom: bottomNavigationBar != null,
              child: suppliedBody,
            });
      const children = [new LayoutId(body, 'body')];
      if (appBar) children.push(new LayoutId(appBar, 'appBar'));
      if (bottomNavigationBar)
        children.push(new LayoutId(bottomNavigationBar, 'bottomNavigationBar'));
      if (floatingActionButton)
        children.push(new LayoutId(floatingActionButton, 'floatingActionButton'));
      if (snack) children.push(new LayoutId(snack, 'snackBar'));
      return new MaterialSurface({
        color: backgroundColor ?? Theme.of(context).scaffoldBackgroundColor,
        child: this.buildDrawers(
          new ScrollNotificationObserver({
            child: new CustomMultiChildLayout(
              children,
              new ScaffoldLayout(
                appBar
                  ? AppBar.preferredHeightFor(context, appBar.preferredSize) +
                      (primary ? (padding?.top ?? 0) : 0)
                  : 0,
                keyboard,
                Math.max(padding?.bottom ?? 0, keyboard),
                padding?.left ?? 0,
                padding?.right ?? 0,
                Directionality.maybeOf(context) ?? 'ltr',
                snack !== null &&
                  (snack.behavior ?? SnackBarTheme.of(context).behavior) ===
                    SnackBarBehavior.floating,
              ),
            ),
          }),
          options,
        ),
      });
    }

    const theme = AppTheme.of(context);
    const content = new Padding(
      allInsets(20),
      new Column(
        [
          new Row(
            [
              new Expanded(new Text(title, { fontSize: 28, color: theme.foreground })),
              ...(trailing ? [trailing] : []),
            ],
            { spacing: 12 },
          ),
          new Expanded(suppliedBody),
        ],
        {
          spacing: 20,
          crossAlign: 'stretch',
          mainSize: 'max',
        },
      ),
    );
    return new MaterialSurface({
      color: new Color(theme.background),
      child: snack
        ? new Stack([content, new Positioned(snack, { left: 0, right: 0, bottom: 0 })])
        : content,
    });
  }
}

class ScaffoldLayout extends MultiChildLayoutDelegate {
  constructor(
    readonly appBarHeight: number,
    readonly keyboard: number,
    readonly bottomInset: number,
    readonly leftInset: number,
    readonly rightInset: number,
    readonly direction: 'ltr' | 'rtl',
    readonly floatingSnack: boolean,
  ) {
    super();
  }

  override performLayout({ width, height }: Size): void {
    const top = Math.min(height, this.appBarHeight);
    if (this.hasChild('appBar')) {
      this.layoutChild('appBar', BoxConstraints.tight({ width, height: top }));
      this.positionChild('appBar', { x: 0, y: 0 });
    }
    let bottom = 0;
    if (this.hasChild('bottomNavigationBar')) {
      bottom = this.layoutChild(
        'bottomNavigationBar',
        new BoxConstraints(width, width, 0, height),
      ).height;
      this.positionChild('bottomNavigationBar', { x: 0, y: height - bottom });
    }
    const bodyBottom = Math.max(top, height - Math.max(bottom, this.keyboard));
    this.layoutChild('body', BoxConstraints.tight({ width, height: bodyBottom - top }));
    this.positionChild('body', { x: 0, y: top });
    let snackBottom = bodyBottom;
    if (this.hasChild('floatingActionButton')) {
      const button = this.layoutChild(
        'floatingActionButton',
        BoxConstraints.loose({ width, height }),
      );
      const x =
        this.direction === 'rtl'
          ? this.leftInset + 16
          : width - this.rightInset - button.width - 16;
      const y = Math.max(top, height - Math.max(bottom, this.bottomInset) - button.height - 16);
      this.positionChild('floatingActionButton', {
        x: Math.max(0, Math.min(width - button.width, x)),
        y,
      });
      if (this.floatingSnack) snackBottom = Math.min(snackBottom, y);
    }
    if (this.hasChild('snackBar')) {
      const snack = this.layoutChild(
        'snackBar',
        new BoxConstraints(width, width, 0, Math.max(0, snackBottom - top)),
      );
      this.positionChild('snackBar', { x: 0, y: snackBottom - snack.height });
    }
  }

  override shouldRelayout(old: ScaffoldLayout): boolean {
    return (
      old.appBarHeight !== this.appBarHeight ||
      old.keyboard !== this.keyboard ||
      old.bottomInset !== this.bottomInset ||
      old.leftInset !== this.leftInset ||
      old.rightInset !== this.rightInset ||
      old.direction !== this.direction ||
      old.floatingSnack !== this.floatingSnack
    );
  }
}
