// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { invariant } from '@nelyx/core/foundation/errors';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import type {
  DragEndDetails,
  DragUpdateDetails,
} from '@nelyx/core/framework/gestures/drag-details';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import { BorderRadiusDirectional } from '@nelyx/core/framework/painting/border-radius';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  ColoredBox,
  ConstrainedBox,
  Positioned,
  SizedBox,
  Stack,
} from '@nelyx/core/framework/widgets/basic';
import { FocusScopeNode } from '@nelyx/core/framework/widgets/focus';
import type { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { FocusScope } from '@nelyx/core/framework/widgets/focus-scope';
import {
  Element,
  InheritedWidget,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import {
  LocalHistoryEntry,
  Navigator,
  routeTokenOf,
} from '@nelyx/core/framework/widgets/navigation';
import { BlockSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { KeyDownEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import { clampDouble } from '@nelyx/core/ui/math';
import { Radius } from '@nelyx/core/ui/radius';
import { DrawerTheme } from './drawer-theme.ts';
import { ListTileStyle } from './list-tile.ts';
import { ListTileTheme } from './list-tile-theme.ts';
import { Material } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Theme } from './theme.ts';

const defaultDrawerWidth = 304;
const defaultEdgeDragWidth = 20;
const minFlingVelocity = 365;
const settleDuration = 246;
const transparent = new Color(0x00000000);
const defaultScrim = new Color(0x8a000000);

const alignmentToken = Symbol('DrawerAlignment');
export class DrawerAlignment {
  private readonly brand = alignmentToken;
  private constructor(
    readonly index: number,
    readonly name: 'start' | 'end',
    token: typeof alignmentToken,
  ) {
    if (token !== alignmentToken) throw new TypeError('Expected a canonical DrawerAlignment');
    Object.freeze(this);
  }
  static readonly start = new DrawerAlignment(0, 'start', alignmentToken);
  static readonly end = new DrawerAlignment(1, 'end', alignmentToken);
  static readonly values = Object.freeze([this.start, this.end]);
  toString(): string {
    return 'DrawerAlignment.' + this.name;
  }
}
Object.freeze(DrawerAlignment.prototype);
Object.freeze(DrawerAlignment);

export type DrawerCallback = (isOpened: boolean) => void;
export interface DrawerOptions extends WidgetOptions {
  readonly backgroundColor?: Color | null;
  readonly elevation?: number | null;
  readonly shadowColor?: Color | null;
  readonly surfaceTintColor?: Color | null;
  readonly shape?: ShapeBorder | null;
  readonly width?: number | null;
  readonly child?: Widget | null;
  readonly semanticLabel?: string | null;
  readonly clipBehavior?: Clip | null;
}

export class Drawer extends StatelessWidget {
  readonly backgroundColor: Color | null;
  readonly elevation: number | null;
  readonly shadowColor: Color | null;
  readonly surfaceTintColor: Color | null;
  readonly shape: ShapeBorder | null;
  readonly width: number | null;
  readonly child: Widget | null;
  readonly semanticLabel: string | null;
  readonly clipBehavior: Clip | null;

  constructor({
    backgroundColor = null,
    elevation = null,
    shadowColor = null,
    surfaceTintColor = null,
    shape = null,
    width = null,
    child = null,
    semanticLabel = null,
    clipBehavior = null,
    key = null,
  }: DrawerOptions = {}) {
    super(key);
    this.backgroundColor = backgroundColor;
    this.elevation = elevation;
    this.shadowColor = shadowColor;
    this.surfaceTintColor = surfaceTintColor;
    this.shape = shape;
    this.width = width;
    this.child = child;
    this.semanticLabel = semanticLabel;
    this.clipBehavior = clipBehavior;
  }

  override build(context: BuildContext): Widget {
    const app = Theme.of(context);
    const theme = DrawerTheme.of(context);
    const apple = app.platform === 'iOS' || app.platform === 'macOS';
    const label =
      this.semanticLabel ?? (apple ? null : MaterialLocalizations.of(context).drawerLabel);
    const end = DrawerController.maybeOf(context)?.alignment === DrawerAlignment.end;
    const corner = Radius.circular(16);
    const shape =
      this.shape ??
      (end ? theme.endShape : theme.shape) ??
      new RoundedRectangleBorder({
        borderRadius: BorderRadiusDirectional.horizontal(end ? { start: corner } : { end: corner }),
      });
    return new Semantics({
      scopesRoute: true,
      namesRoute: true,
      explicitChildNodes: true,
      label,
      child: new ConstrainedBox(
        new Material({
          color:
            this.backgroundColor ??
            theme.backgroundColor ??
            new Color(app.colorScheme.surfaceContainerLow),
          elevation: this.elevation ?? theme.elevation ?? 1,
          shadowColor: this.shadowColor ?? theme.shadowColor ?? transparent,
          surfaceTintColor: this.surfaceTintColor ?? theme.surfaceTintColor ?? transparent,
          shape,
          clipBehavior: this.clipBehavior ?? theme.clipBehavior ?? 'hardEdge',
          child: this.child,
        }),
        BoxConstraints.expand(this.width ?? theme.width ?? defaultDrawerWidth),
      ),
    });
  }
}

class DrawerControllerScope extends InheritedWidget {
  constructor(
    readonly controller: DrawerController,
    child: Widget,
  ) {
    super(child);
  }
  override updateShouldNotify(old: DrawerControllerScope): boolean {
    return old.controller !== this.controller;
  }
}

export interface DrawerControllerOptions extends WidgetOptions {
  readonly child: Widget;
  readonly alignment: DrawerAlignment;
  readonly drawerCallback?: DrawerCallback | null;
  readonly drawerBarrierDismissible?: boolean;
  readonly dragStartBehavior?: DragStartBehavior;
  readonly scrimColor?: Color | null;
  readonly enableOpenDragGesture?: boolean;
  readonly edgeDragWidth?: number | null;
  readonly isDrawerOpen?: boolean;
}

export class DrawerController extends StatefulWidget {
  readonly child: Widget;
  readonly alignment: DrawerAlignment;
  readonly drawerCallback: DrawerCallback | null;
  readonly drawerBarrierDismissible: boolean;
  readonly dragStartBehavior: DragStartBehavior;
  readonly scrimColor: Color | null;
  readonly enableOpenDragGesture: boolean;
  readonly edgeDragWidth: number | null;
  readonly isDrawerOpen: boolean;

  constructor({
    child,
    alignment,
    drawerCallback = null,
    drawerBarrierDismissible = true,
    dragStartBehavior = DragStartBehavior.start,
    scrimColor = null,
    enableOpenDragGesture = true,
    edgeDragWidth = null,
    isDrawerOpen = false,
    key = null,
  }: DrawerControllerOptions) {
    super(key);
    this.child = child;
    this.alignment = alignment;
    this.drawerCallback = drawerCallback;
    this.drawerBarrierDismissible = drawerBarrierDismissible;
    this.dragStartBehavior = dragStartBehavior;
    this.scrimColor = scrimColor;
    this.enableOpenDragGesture = enableOpenDragGesture;
    this.edgeDragWidth = edgeDragWidth;
    this.isDrawerOpen = isDrawerOpen;
  }

  static maybeOf(context: BuildContext): DrawerController | null {
    return context.maybeDependOn(DrawerControllerScope)?.controller ?? null;
  }
  static of(context: BuildContext): DrawerController {
    const drawer = this.maybeOf(context);
    invariant(
      drawer,
      'missing-drawer-controller',
      'DrawerController.of requires a DrawerController ancestor',
    );
    return drawer;
  }
  override createState(): DrawerControllerState {
    return new DrawerControllerState();
  }
}

export class DrawerControllerState extends SingleTickerProviderStateMixin<DrawerController> {
  private position!: AnimationController;
  private history: LocalHistoryEntry | null = null;
  private readonly drawerKey = new GlobalKey('Drawer panel');
  private readonly scope = new FocusScopeNode();
  private previousFocus: FocusNode | null = null;
  private reportedOpen = false;

  get isDrawerOpen(): boolean {
    return this.reportedOpen;
  }

  override initState(): void {
    super.initState();
    this.reportedOpen = this.widget.isDrawerOpen;
    this.position = new AnimationController({
      value: this.reportedOpen ? 1 : 0,
      duration: settleDuration,
      vsync: this,
    });
    this.position.addListener(() => this.setState(() => {}));
    this.position.addStatusListener((status) => {
      if (status === AnimationStatus.dismissed) this.finishDismissal();
    });
    if (this.reportedOpen) {
      (this.context as Element).owner.postFrame(() => {
        if (this.mounted && this.reportedOpen) this.ensureHistory();
      });
    }
  }

  override didUpdateWidget(old: DrawerController): void {
    super.didUpdateWidget(old);
    if (!this.position.isAnimating && this.widget.isDrawerOpen !== old.isDrawerOpen) {
      this.reportedOpen = this.widget.isDrawerOpen;
      if (this.reportedOpen) this.ensureHistory();
      this.position.value = this.reportedOpen ? 1 : 0;
    }
  }

  private ensureHistory(): void {
    if (this.history) return;
    this.previousFocus ??= (this.context as Element).owner.focus.primaryFocus ?? null;
    const navigator = Navigator.maybeOf(this.context);
    const token = routeTokenOf(this.context);
    if (navigator && token) {
      const entry = new LocalHistoryEntry({
        impliesAppBarDismissal: false,
        onRemove: () => {
          if (this.history !== entry) return;
          this.history = null;
          if (this.mounted) this.close();
        },
      });
      navigator.addLocalHistoryEntry(token, entry);
      this.history = entry;
    }
  }

  private finishDismissal(): void {
    this.releaseHistory();
    const focus = this.previousFocus;
    this.previousFocus = null;
    if (focus?.attached && this.scope.hasFocus) focus.requestFocus();
  }

  private releaseHistory(): void {
    const entry = this.history;
    this.history = null;
    entry?.remove();
  }

  private report(open: boolean): void {
    if (this.reportedOpen === open) return;
    this.reportedOpen = open;
    this.widget.drawerCallback?.(open);
  }

  open(): void {
    this.ensureHistory();
    this.position.fling();
    this.report(true);
  }

  close(): void {
    if (this.position.value === 0 && !this.position.isAnimating) return;
    this.position.fling({ velocity: -1 });
    this.report(false);
  }

  private get width(): number {
    const box = this.drawerKey.currentContext?.findRenderObject();
    if (box instanceof RenderBox && box.hasSize && box.size.width > 0) return box.size.width;
    const configured = this.widget.child instanceof Drawer ? this.widget.child.width : null;
    return configured ?? DrawerTheme.of(this.context).width ?? defaultDrawerWidth;
  }

  private get fromLeft(): boolean {
    return (
      (Directionality.of(this.context) === 'ltr') ===
      (this.widget.alignment === DrawerAlignment.start)
    );
  }

  private readonly beginDrag = (): void => {
    this.position.stop();
  };

  private readonly updateDrag = ({ primaryDelta }: DragUpdateDetails): void => {
    const delta = ((primaryDelta ?? 0) / Math.max(1, this.width)) * (this.fromLeft ? 1 : -1);
    const value = clampDouble(this.position.value + delta, 0, 1);
    if (value > 0) this.ensureHistory();
    this.position.value = value;
    this.report(value > 0.5);
  };

  private readonly endDrag = ({ primaryVelocity }: DragEndDetails): void => {
    const velocity = primaryVelocity ?? 0;
    if (this.position.value > 0 && Math.abs(velocity) >= minFlingVelocity) {
      const visualVelocity = (velocity / Math.max(1, this.width)) * (this.fromLeft ? 1 : -1);
      this.position.fling({ velocity: visualVelocity });
      this.report(visualVelocity > 0);
    } else this.settleDrag();
  };

  private readonly settleDrag = (): void => {
    if (this.position.value >= 0.5) this.open();
    else this.close();
  };

  private buildVisible(context: BuildContext, value: number): Widget {
    const start = this.widget.alignment === DrawerAlignment.start;
    const outer = start ? AlignmentDirectional.centerStart : AlignmentDirectional.centerEnd;
    const inner = start ? AlignmentDirectional.centerEnd : AlignmentDirectional.centerStart;
    const base = this.widget.scrimColor ?? DrawerTheme.of(context).scrimColor ?? defaultScrim;
    const close = this.widget.drawerBarrierDismissible ? () => this.close() : null;
    const scrim = new ColoredBox({ color: base.withOpacity(base.opacity * value).toARGB32() });
    const barrier = new BlockSemantics({
      child: new Semantics({
        label: close ? MaterialLocalizations.of(context).modalBarrierDismissLabel : null,
        button: close !== null,
        onTap: close,
        child: new GestureDetector(scrim, {
          behavior: HitTestBehavior.opaque,
          excludeFromSemantics: true,
          onTap: close,
        }),
      }),
    });
    const panel = new FocusScope(this.widget.child, {
      key: this.drawerKey,
      node: this.scope,
      autofocus: true,
      skipTraversal: true,
      includeSemantics: false,
      traversalEdgeBehavior: 'closedLoop',
      onKeyEvent: (_node, event) => {
        if (event instanceof KeyDownEvent && event.logicalKey.equals(LogicalKeyboardKey.escape)) {
          this.close();
          return 'handled';
        }
        return 'ignored';
      },
    });
    return new DrawerControllerScope(
      this.widget,
      new Stack([
        Positioned.fill(barrier),
        new Align(new Align(panel, { widthFactor: value, alignment: inner }), { alignment: outer }),
      ]),
    );
  }

  override build(context: BuildContext): Widget {
    const value = this.position.value;
    const visible = value > 0;
    const platform = Theme.of(context).platform;
    const mobile = platform === 'android' || platform === 'iOS' || platform === 'fuchsia';
    if (!visible && !(mobile && this.widget.enableOpenDragGesture)) return new SizedBox();
    const insets = MediaQuery.maybePaddingOf(context);
    const edge =
      this.widget.edgeDragWidth ??
      defaultEdgeDragWidth + ((this.fromLeft ? insets?.left : insets?.right) ?? 0);
    const contents = visible ? this.buildVisible(context, value) : new SizedBox();
    const detector = new GestureDetector(contents, {
      behavior: HitTestBehavior.translucent,
      excludeFromSemantics: true,
      dragStartBehavior: this.widget.dragStartBehavior,
      onHorizontalDragStart: mobile ? this.beginDrag : null,
      onHorizontalDragUpdate: mobile ? this.updateDrag : null,
      onHorizontalDragEnd: mobile ? this.endDrag : null,
      onHorizontalDragCancel: mobile ? this.settleDrag : null,
    });
    return ListTileTheme.merge({
      style: ListTileStyle.drawer,
      child: new Stack([
        visible
          ? Positioned.fill(detector)
          : new Positioned(detector, {
              top: 0,
              bottom: 0,
              ...(this.fromLeft ? { left: 0 } : { right: 0 }),
              width: edge,
            }),
      ]),
    });
  }

  override dispose(): void {
    this.releaseHistory();
    this.position.dispose();
    this.scope.dispose();
    super.dispose();
  }
}
