// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from packages/flutter/lib/src/cupertino/menu_anchor.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { invariant } from '@nelyx/core/foundation/errors';
import { Listenable, ValueNotifier } from '@nelyx/core/foundation/notifier';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import type { Ticker } from '@nelyx/core/framework/animation/ticker';
import { Alignment, AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import {
  BoxDecoration,
  sourceBoxDecorationType,
} from '@nelyx/core/framework/painting/box-decoration';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { ClampedSimulation } from '@nelyx/core/framework/physics/clamped-simulation';
import {
  SpringDescription,
  SpringSimulation,
} from '@nelyx/core/framework/physics/spring-simulation';
import { Tolerance } from '@nelyx/core/framework/physics/tolerance';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  ColoredBox,
  Column,
  ConstrainedBox,
  DecoratedBox,
  Padding,
  Positioned,
  SizedBox,
  Stack,
  Transform,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { CustomSingleChildLayout } from '@nelyx/core/framework/widgets/custom-layout';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { DisplayFeatureSubScreen } from '@nelyx/core/framework/widgets/display-feature-sub-screen';
import { FocusNode, FocusScopeNode } from '@nelyx/core/framework/widgets/focus';
import { ExcludeFocus, FocusScope } from '@nelyx/core/framework/widgets/focus-scope';
import { FocusTraversalGroup } from '@nelyx/core/framework/widgets/focus-traversal-group';
import { ReadingOrderTraversalPolicy } from '@nelyx/core/framework/widgets/focus-traversal-policy';
import {
  Element,
  InheritedWidget,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { IconTheme } from '@nelyx/core/framework/widgets/icon-theme';
import { IconThemeData } from '@nelyx/core/framework/widgets/icon-theme-data';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { MenuController, RawMenuAnchor } from '@nelyx/core/framework/widgets/raw-menu-anchor';
import type {
  RawMenuAnchorChildBuilder,
  RawMenuOverlayInfo,
} from '@nelyx/core/framework/widgets/raw-menu-anchor';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { TapRegion } from '@nelyx/core/framework/widgets/tap-region';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import {
  emptyWidgetStateSet,
  WidgetState,
  WidgetStateProperty,
} from '@nelyx/core/framework/widgets/widget-state';
import { HapticFeedback } from '@nelyx/core/services/haptic-feedback';
import { KeyDownEvent, KeyRepeatEvent } from '@nelyx/core/services/hardware-keyboard';
import { LogicalKeyboardKey } from '@nelyx/core/services/keyboard-key';
import { MouseCursor, SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Color } from '@nelyx/core/ui/color';
import type { Offset, Size } from '@nelyx/core/ui/geometry';
import { Paint } from '@nelyx/core/ui/paint';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { FontWeight } from '@nelyx/core/ui/typography';
import { CupertinoColors, CupertinoDynamicColor } from './colors.ts';
import { CupertinoPopupSurface } from './dialog.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import {
  CupertinoMenuLayout,
  CupertinoMenuShadow,
  MenuMidpointLayout,
  maxMenuScale,
  menuAttachment,
  menuBaseFontSize,
  menuDefaultWidth,
  menuLargeText,
  menuTextStyle,
  menuTextUnits,
  minMenuScale,
  roundMenuMetric,
} from './internal/menu-layout.ts';
import { MenuSwipeRegion, MenuSwipeScope, MenuSwipeSurface } from './internal/menu-swipe.ts';
import type { MenuSwipeTarget } from './internal/menu-swipe.ts';
import { CupertinoTheme } from './theme.ts';

export { MenuController };
export type { RawMenuAnchorChildBuilder };

export interface CupertinoMenuEntry {
  hasLeading(context: BuildContext): boolean;
  readonly isDivider: boolean;
}

export type CupertinoMenuAnimationStatusChangedCallback = (status: AnimationStatus) => void;

export interface CupertinoMenuAnchorOptions extends WidgetOptions {
  readonly controller?: MenuController | null;
  readonly onOpen?: (() => void) | null;
  readonly onClose?: (() => void) | null;
  readonly onAnimationStatusChanged?: CupertinoMenuAnimationStatusChangedCallback | null;
  readonly constraints?: BoxConstraints | null;
  readonly constrainCrossAxis?: boolean;
  readonly consumeOutsideTaps?: boolean;
  readonly enableSwipe?: boolean;
  readonly enableLongPressToOpen?: boolean;
  readonly useRootOverlay?: boolean;
  readonly overlayPadding?: EdgeInsetsGeometry;
  readonly menuChildren: readonly Widget[];
  readonly builder?: RawMenuAnchorChildBuilder | null;
  readonly child?: Widget | null;
  readonly childFocusNode?: FocusNode | null;
}

class MenuAnchorScope extends InheritedWidget {
  constructor(
    readonly hasLeading: boolean,
    child: Widget,
  ) {
    super(child);
  }

  override updateShouldNotify(old: MenuAnchorScope): boolean {
    return this.hasLeading !== old.hasLeading;
  }
}

function menuEntry(widget: Widget): CupertinoMenuEntry | null {
  return 'hasLeading' in widget &&
    typeof widget.hasLeading === 'function' &&
    'isDivider' in widget &&
    typeof widget.isDivider === 'boolean'
    ? (widget as Widget & CupertinoMenuEntry)
    : null;
}

const openSpring = SpringDescription.withDurationAndBounce({ duration: 337, bounce: 0.2 });
const closeSpring = SpringDescription.withDurationAndBounce({ duration: 409 });
const springTolerance = new Tolerance({ velocity: 0.1 });
const longPressDelay = 400;
const defaultTraversal = new ReadingOrderTraversalPolicy();

function isCupertinoPlatform(): boolean {
  const platform = FoundationPlatform.defaultTargetPlatform;
  return platform === 'iOS' || platform === 'macOS';
}

export class CupertinoMenuAnchor extends StatefulWidget {
  readonly options: Readonly<CupertinoMenuAnchorOptions>;

  constructor(options: CupertinoMenuAnchorOptions) {
    super(options.key ?? null);
    invariant(
      options.enableSwipe !== false || options.enableLongPressToOpen !== true,
      'cupertino-menu-long-press',
      'Long press to open requires menu swipe support',
    );
    this.options = Object.freeze({
      ...options,
      menuChildren: Object.freeze([...options.menuChildren]),
    });
  }

  static maybeHasLeadingOf(context: BuildContext): boolean | null {
    return context.maybeDependOn(MenuAnchorScope)?.hasLeading ?? null;
  }

  override createState(): State<CupertinoMenuAnchor> {
    return new CupertinoMenuAnchorState();
  }
}

class CupertinoMenuAnchorState extends TickerProviderStateMixin<CupertinoMenuAnchor> {
  private readonly localController = new MenuController();
  private readonly focus = new FocusScopeNode({ debugLabel: 'Cupertino menu' });
  private readonly swipe = new MenuSwipeRegion();
  private readonly swipeScale = new ValueNotifier(1);
  private motion!: AnimationController;
  private motionListenable!: Listenable;
  private swipeTicker: Ticker | null = null;
  private swipePosition = 0;
  private swipeVelocity = 0;
  private pendingHide: (() => void) | null = null;

  private get controller(): MenuController {
    return this.widget.options.controller ?? this.localController;
  }

  private get interactive(): boolean {
    return (
      this.motion.status === AnimationStatus.forward ||
      this.motion.status === AnimationStatus.completed
    );
  }

  override initState(): void {
    super.initState();
    this.swipe.enabled = this.widget.options.enableSwipe !== false;
    this.motion = AnimationController.unbounded({ vsync: this });
    this.motionListenable = Listenable.merge([this.motion, this.swipeScale]);
    this.motion.addStatusListener(this.statusChanged);
    this.swipe.distance.addListener(this.swipeChanged);
  }

  override didUpdateWidget(old: CupertinoMenuAnchor): void {
    super.didUpdateWidget(old);
    if (old.options.enableSwipe !== this.widget.options.enableSwipe) {
      this.swipe.enabled =
        this.widget.options.enableSwipe !== false && this.motion.status !== AnimationStatus.reverse;
      if (!this.swipe.enabled) this.swipe.reset();
    }
  }

  private readonly statusChanged = (status: AnimationStatus): void => {
    if (status === AnimationStatus.dismissed && this.pendingHide) {
      const hide = this.pendingHide;
      this.pendingHide = null;
      hide();
    }
    this.swipe.enabled =
      this.widget.options.enableSwipe !== false && status !== AnimationStatus.reverse;
    if (!this.swipe.enabled) this.swipe.reset();
    if (this.mounted) this.setState(() => {});
    this.widget.options.onAnimationStatusChanged?.(status);
  };

  private readonly swipeChanged = (): void => {
    if (!this.controller.isOpen || this.swipe.distance.value === this.swipePosition) return;
    this.swipeTicker ??= this.createTicker(this.updateSwipe);
    if (!this.swipeTicker.isActive) this.swipeTicker.start();
  };

  private readonly updateSwipe = (): void => {
    const target = this.swipe.distance.value;
    const remaining = target - this.swipePosition;
    const fraction = Math.min(1, Math.abs(remaining) / 80);
    this.swipeVelocity = Math.min(20, Math.max(8, this.swipeVelocity + fraction * 0.12));
    this.swipePosition += Math.sign(remaining) * this.swipeVelocity * fraction;
    if (Math.abs(remaining) < 1) {
      this.swipePosition = target;
      this.swipeVelocity = 0;
      this.swipeTicker?.stop();
    }
    this.swipeScale.value = 1 - this.swipePosition / 750;
  };

  private readonly openRequested = (_position: Offset | null, show: () => void): void => {
    this.pendingHide = null;
    show();
    if (this.interactive) return;
    if (MediaQuery.of(this.context).disableAnimations) this.motion.animateTo(1, { duration: 0 });
    else
      this.motion.animateWith(
        new SpringSimulation(openSpring, this.motion.value, 1, 0.5, { snapToEnd: true }),
      );
  };

  private readonly closeRequested = (hide: () => void): void => {
    if (this.motion.isDismissed) {
      hide();
      return;
    }
    this.pendingHide = hide;
    if (MediaQuery.of(this.context).disableAnimations) this.motion.animateBack(0, { duration: 0 });
    else
      this.motion.animateBackWith(
        new ClampedSimulation(
          new SpringSimulation(closeSpring, this.motion.value, 0, 0, {
            tolerance: springTolerance,
            snapToEnd: true,
          }),
          { xMin: 0, xMax: 1 },
        ),
      );
  };

  private traverse(context: BuildContext, key: LogicalKeyboardKey): boolean {
    const current =
      this.focus.traversalDescendants.find((node) => node.hasPrimaryFocus) ?? this.focus;
    const down = key.equals(LogicalKeyboardKey.arrowDown);
    const up = key.equals(LogicalKeyboardKey.arrowUp);
    const home = key.equals(LogicalKeyboardKey.home);
    const end = key.equals(LogicalKeyboardKey.end);
    if (!down && !up && !home && !end) return false;
    const policy = FocusTraversalGroup.maybeOf(current.context ?? context) ?? defaultTraversal;
    const native = isCupertinoPlatform() && !FoundationPlatform.isWeb;
    if (native && (up || down)) return policy.inDirection(current, down ? 'down' : 'up');
    const first = policy.findFirstFocus(current, { ignoreCurrentFocus: true });
    const last = policy.findLastFocus(current, { ignoreCurrentFocus: true });
    const target =
      home || (down && (current === this.focus || current === last))
        ? first
        : end || (up && (current === this.focus || current === first))
          ? last
          : null;
    if (target?.context) policy.requestFocusCallback(target);
    else if (up || down) return policy.inDirection(current, down ? 'down' : 'up');
    return true;
  }

  private hasLeading(context: BuildContext): boolean {
    return this.widget.options.menuChildren.some(
      (child) => menuEntry(child)?.hasLeading(context) === true,
    );
  }

  private readonly buildMenu = (context: BuildContext, info: RawMenuOverlayInfo): Widget => {
    const { options } = this.widget;
    const media = MediaQuery.of(context);
    const direction = Directionality.of(context);
    const attachment = menuAttachment(info);
    const padding = (options.overlayPadding ?? EdgeInsets.all(8)).resolve(direction);
    const screens = DisplayFeatureSubScreen.avoidBounds(media);
    const defaultWidth = menuDefaultWidth(
      media.width,
      menuLargeText(MediaQuery.textScalerOf(context)),
    );
    const constraints = options.constraints ?? BoxConstraints.tightFor(defaultWidth);
    const hasLeading = this.hasLeading(context);
    const entries: Widget[] = [];
    for (let i = 0; i < options.menuChildren.length; ++i) {
      const child = options.menuChildren[i]!;
      const next = options.menuChildren[i + 1];
      entries.push(child);
      if (next && !menuEntry(child)?.isDivider && !menuEntry(next)?.isDivider)
        entries.push(new ImplicitMenuDivider());
    }
    const panel = new CupertinoPopupSurface({
      child: new MenuAnchorScope(
        hasLeading,
        new ConstrainedBox(
          new SingleBoxScrollView({
            primary: false,
            clipBehavior: 'none',
            child: new Column(entries, { mainSize: 'min', crossAlign: 'stretch' }),
          }),
          constraints,
        ),
      ),
    });
    return new ListenableBuilder(this.motionListenable, () => {
      const value = Math.max(0, this.motion.value);
      const disable = media.disableAnimations === true;
      const reduce = media.reduceMotion === true;
      const fade = disable ? 1 : Curves.easeIn.transform(Math.min(1, value));
      const sizeFactor = disable || reduce ? 1 : 0.8 + value * 0.2;
      const scale = disable ? 1 : (reduce ? 1 : value) * this.swipeScale.value;
      const contents = new CustomPaint(
        new Opacity(
          new ClipRect(
            new Align(panel, {
              heightFactor: sizeFactor,
              widthFactor: 1,
              alignment: Alignment.topCenter,
            }),
          ),
          { opacity: fade, alwaysIncludeSemantics: true },
        ),
        { painter: new CupertinoMenuShadow(fade) },
      );
      const menu = new TapRegion(
        new FocusScope(
          new Semantics({
            role: SemanticsRole.menu,
            container: true,
            explicitChildNodes: true,
            child: contents,
          }),
          {
            node: this.focus,
            autofocus: true,
            skipTraversal: true,
            includeSemantics: false,
            traversalEdgeBehavior: 'closedLoop',
            directionalTraversalEdgeBehavior: 'stop',
            onKeyEvent: (_node, event) => {
              if (!(event instanceof KeyDownEvent || event instanceof KeyRepeatEvent))
                return 'ignored';
              if (event.logicalKey.equals(LogicalKeyboardKey.escape)) {
                this.controller.close();
                return 'handled';
              }
              return this.traverse(context, event.logicalKey) ? 'handled' : 'ignored';
            },
          },
        ),
        { groupId: info.tapRegionGroupId, behavior: HitTestBehavior.opaque },
      );
      const surface = new MenuSwipeScope(this.swipe, new MenuSwipeSurface(menu, this.swipe));
      const interactive = this.interactive;
      return new ClipRect(
        Transform.scale(
          new CustomSingleChildLayout(
            new ExcludeFocus(
              new ExcludeSemantics({
                excluding: !interactive,
                child: new IgnorePointer(surface, { ignoring: !interactive }),
              }),
              { excluding: !interactive },
            ),
            new CupertinoMenuLayout(
              info,
              attachment,
              padding,
              screens,
              sizeFactor,
              options.constrainCrossAxis === true,
              direction === 'rtl',
            ),
          ),
          { scale, alignment: attachment.pivot },
        ),
      );
    });
  };

  override build(context: BuildContext): Widget {
    const { options } = this.widget;
    return new MenuAnchorScope(
      this.hasLeading(context),
      new RawMenuAnchor({
        controller: this.controller,
        useRootOverlay: options.useRootOverlay ?? false,
        consumeOutsideTaps: options.consumeOutsideTaps ?? false,
        childFocusNode: options.childFocusNode ?? null,
        onOpen: options.onOpen ?? null,
        onClose: options.onClose ?? null,
        onOpenRequested: this.openRequested,
        onCloseRequested: this.closeRequested,
        overlayBuilder: this.buildMenu,
        child: options.child ?? null,
        builder: (context, controller, child) => {
          const trigger = options.builder?.(context, controller, child) ?? child ?? new SizedBox();
          return options.enableLongPressToOpen === true
            ? new MenuSwipeSurface(trigger, this.swipe, longPressDelay, () => {
                if (!this.interactive) controller.open();
              })
            : trigger;
        },
      }),
    );
  }

  override dispose(): void {
    this.pendingHide = null;
    this.swipe.distance.removeListener(this.swipeChanged);
    this.swipeTicker?.dispose();
    this.motion.removeStatusListener(this.statusChanged);
    this.motion.dispose();
    this.swipeScale.dispose();
    this.swipe.dispose();
    this.focus.dispose();
    super.dispose();
  }
}

function adaptiveColor(light: number, dark: number): CupertinoDynamicColor {
  return CupertinoDynamicColor.withBrightness({
    color: new Color(light),
    darkColor: new Color(dark),
  });
}

export interface CupertinoMenuDividerOptions extends WidgetOptions {
  readonly color?: CupertinoColor;
}

export class CupertinoMenuDivider extends StatelessWidget implements CupertinoMenuEntry {
  static readonly kDefaultColor = adaptiveColor(0x14000000, 0x29000000);
  readonly color: CupertinoColor;
  readonly isDivider = true;

  constructor({
    color = CupertinoMenuDivider.kDefaultColor,
    key = null,
  }: CupertinoMenuDividerOptions = {}) {
    super(key);
    this.color = color;
  }

  hasLeading(): boolean {
    return false;
  }

  override build(context: BuildContext): Widget {
    return new ColoredBox({
      color: resolveCupertinoColor(this.color, context).toARGB32(),
      child: new SizedBox(undefined, 8),
    });
  }
}

const dividerOverlayColor = adaptiveColor(0x4d8c8c8c, 0x40ffffff);
const dividerColor = adaptiveColor(0x40000000, 0x40ffffff);

class ImplicitMenuDivider extends StatelessWidget {
  override build(context: BuildContext): Widget {
    const density = MediaQuery.maybeDevicePixelRatioOf(context) ?? 1;
    const painter = new MenuDividerPainter(
      resolveCupertinoColor(dividerColor, context).toARGB32(),
      FoundationPlatform.isWeb
        ? null
        : resolveCupertinoColor(dividerOverlayColor, context).toARGB32(),
      density < 1,
    );
    return new SizedBox(undefined, 1 / density, new CustomPaint(undefined, { painter }));
  }
}

class MenuDividerPainter extends CustomPainter {
  constructor(
    private readonly color: number,
    private readonly overlay: number | null,
    private readonly antialias: boolean,
  ) {
    super();
  }
  override paint(canvas: Canvas, size: Size): void {
    const start = { x: 0, y: size.height / 2 };
    const end = { x: size.width, y: size.height / 2 };
    if (this.overlay !== null)
      canvas.drawLine(
        start,
        end,
        new Paint({
          color: this.overlay,
          blendMode: 'overlay',
          isAntiAlias: this.antialias,
          strokeWidth: 0,
        }),
      );
    canvas.drawLine(
      start,
      end,
      new Paint({ color: this.color, isAntiAlias: this.antialias, strokeWidth: 0 }),
    );
  }
  override shouldRepaint(old: CustomPainter): boolean {
    return (
      !(old instanceof MenuDividerPainter) ||
      old.color !== this.color ||
      old.overlay !== this.overlay ||
      old.antialias !== this.antialias
    );
  }
}

export interface CupertinoMenuItemOptions extends WidgetOptions {
  readonly child: Widget;
  readonly subtitle?: Widget | null;
  readonly leading?: Widget | null;
  readonly leadingWidth?: number | null;
  readonly leadingMidpointAlignment?: AlignmentGeometry | null;
  readonly trailing?: Widget | null;
  readonly trailingWidth?: number | null;
  readonly trailingMidpointAlignment?: AlignmentGeometry | null;
  readonly padding?: EdgeInsetsGeometry | null;
  readonly constraints?: BoxConstraints | null;
  readonly autofocus?: boolean;
  readonly focusNode?: FocusNode | null;
  readonly onFocusChange?: ((focused: boolean) => void) | null;
  readonly onHover?: ((hovered: boolean) => void) | null;
  readonly onPressed?: (() => void) | null;
  readonly decoration?: WidgetStateProperty<BoxDecoration> | null;
  readonly mouseCursor?: WidgetStateProperty<MouseCursor> | MouseCursor | null;
  readonly behavior?: HitTestBehavior;
  readonly requestCloseOnActivate?: boolean;
  readonly requestFocusOnHover?: boolean;
  readonly isDestructiveAction?: boolean;
}

class MenuStateDecoration extends BoxDecoration {
  constructor(readonly opacity: number) {
    super({ color: ((Math.round(opacity * 255) << 24) | 0x323232) >>> 0 });
  }
  inDarkMode(): BoxDecoration {
    return new BoxDecoration({ color: ((Math.round(this.opacity * 255) << 24) | 0xffffff) >>> 0 });
  }
}

const menuTextColor = adaptiveColor(0xf5000000, 0xf5ffffff);
const menuSubtitleColor = adaptiveColor(0x8c000000, 0x66ffffff);

export class CupertinoMenuItem extends StatefulWidget implements CupertinoMenuEntry {
  static readonly kDefaultDecoration = WidgetStateProperty.resolveWith<BoxDecoration>(
    sourceBoxDecorationType,
    (states) => {
      if (states.contains(WidgetState.dragged) || states.contains(WidgetState.pressed))
        return new MenuStateDecoration(0.1);
      if (states.contains(WidgetState.focused)) return new MenuStateDecoration(0.075);
      if (states.contains(WidgetState.hovered)) return new MenuStateDecoration(0.05);
      return new BoxDecoration();
    },
  );
  readonly isDivider = false;
  readonly options: Readonly<CupertinoMenuItemOptions>;

  constructor(options: CupertinoMenuItemOptions) {
    super(options.key ?? null);
    this.options = Object.freeze({ ...options });
  }

  hasLeading(): boolean {
    return this.options.leading != null;
  }

  override createState(): State<CupertinoMenuItem> {
    return new CupertinoMenuItemState();
  }
}

class CupertinoMenuItemState extends State<CupertinoMenuItem> implements MenuSwipeTarget {
  private readonly localFocus = new FocusNode({ debugLabel: 'Cupertino menu item' });
  private dragging = false;

  private get live(): boolean {
    return this.mounted && this.context instanceof Element && this.context.active;
  }

  private get focus(): FocusNode {
    return this.widget.options.focusNode ?? this.localFocus;
  }

  enter(): void {
    if (!this.live || this.dragging || !this.widget.options.onPressed) return;
    this.setState(() => {
      this.dragging = true;
    });
    const services = this.context.services;
    const messenger = services.binaryMessenger ?? services.platformServices?.defaultBinaryMessenger;
    if (messenger && isCupertinoPlatform())
      void HapticFeedback.selectionClick(messenger).catch((error) => services.reportError?.(error));
  }

  leave(): void {
    if (this.live && this.dragging)
      this.setState(() => {
        this.dragging = false;
      });
  }

  activate(): void {
    if (!this.live) return;
    const { onPressed, requestCloseOnActivate = true } = this.widget.options;
    if (!onPressed) return;
    if (requestCloseOnActivate) MenuController.maybeOf(this.context)?.close();
    onPressed();
  }

  override didUpdateWidget(old: CupertinoMenuItem): void {
    super.didUpdateWidget(old);
    if (!this.widget.options.onPressed) this.dragging = false;
  }

  override dispose(): void {
    this.localFocus.dispose();
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const { options } = this.widget;
    const enabled = options.onPressed != null;
    const dark = CupertinoTheme.maybeBrightnessOf(context) === 'dark';
    const behavior = options.behavior ?? HitTestBehavior.opaque;
    const cursor = options.mouseCursor;
    const label = this.buildLabel(context, enabled, dark);
    const widget = new ControlInteraction(
      (_context, visual) => {
        const states = emptyWidgetStateSet();
        for (const state of visual.states) states.add(state);
        if (this.dragging) states.add(WidgetState.dragged);
        const decoration = (options.decoration ?? CupertinoMenuItem.kDefaultDecoration).resolve(
          states,
        );
        return new DecoratedBox(label, {
          decoration:
            dark && decoration instanceof MenuStateDecoration
              ? decoration.inDarkMode()
              : decoration,
        });
      },
      {
        enabled,
        focusNode: this.focus,
        autofocus: options.autofocus ?? false,
        hitTestBehavior: behavior,
        onPressed: enabled ? () => this.activate() : null,
        requestFocusOnPointer: false,
        ...(options.onFocusChange ? { onFocusChange: options.onFocusChange } : {}),
        onHover: (hover) => {
          if (hover && enabled && options.requestFocusOnHover !== false) this.focus.requestFocus();
          options.onHover?.(hover);
        },
        mouseCursorResolver: (states) =>
          cursor instanceof MouseCursor
            ? cursor
            : (cursor?.resolve(states) ??
              (enabled && FoundationPlatform.isWeb ? SystemMouseCursors.click : MouseCursor.defer)),
        semantics: { role: SemanticsRole.menuItem, button: true },
      },
    );
    return MenuSwipeScope.target(context, this, widget, behavior);
  }

  private buildLabel(context: BuildContext, enabled: boolean, dark: boolean): Widget {
    const options = this.widget.options;
    const scaler = (MediaQuery.maybeTextScalerOf(context) ?? TextScaler.noScaling).clamp({
      minScaleFactor: minMenuScale,
      maxScaleFactor: maxMenuScale,
    });
    const ratio = MediaQuery.maybeDevicePixelRatioOf(context) ?? 1;
    const large = menuLargeText(scaler);
    const units = menuTextUnits(scaler);
    const body = menuTextStyle(scaler);
    const lineHeight = (body.fontSize ?? 17) * (body.height ?? 1);
    const defaultHeight =
      roundMenuMetric((lineHeight * 14) / 11, ratio) + roundMenuMetric(lineHeight * 0.71, ratio);
    const padding =
      options.padding ??
      EdgeInsets.symmetric({ vertical: Math.max(0, (defaultHeight - lineHeight) / 2) });
    const leading = options.leading ?? null;
    const trailing = large ? null : (options.trailing ?? null);
    const showLeading = leading !== null || CupertinoMenuAnchor.maybeHasLeadingOf(context) === true;
    const leftWidth =
      options.leadingWidth ??
      (showLeading ? roundMenuMetric(10 - 0.311 * units + lineHeight, ratio) : 16);
    const rightWidth =
      options.trailingWidth ??
      (trailing ? roundMenuMetric(22 + 0.1 * units + lineHeight, ratio) : 16);
    const direction = Directionality.maybeOf(context) ?? 'ltr';
    const color = resolveCupertinoColor(
      enabled
        ? options.isDestructiveAction === true
          ? CupertinoColors.systemRed
          : menuTextColor
        : CupertinoColors.systemGrey,
      context,
    ).toARGB32();
    const label = new DefaultTextStyle(
      body.copyWith({ fontSize: menuBaseFontSize, color }),
      options.child,
      {
        maxLines: large ? 100 : 2,
        softWrap: true,
        overflow: 'ellipsis',
      },
    );
    const text =
      options.subtitle == null
        ? new Align(label, { alignment: AlignmentDirectional.centerStart })
        : new Column(
            [
              label,
              new DefaultTextStyle(
                menuTextStyle(scaler, true).copyWith({
                  fontSize: 15,
                  foreground: new Paint({
                    color: resolveCupertinoColor(menuSubtitleColor, context).toARGB32(),
                    blendMode: dark ? 'plus' : 'hardLight',
                  }),
                }),
                options.subtitle,
                { maxLines: large ? 100 : 2, softWrap: true, overflow: 'ellipsis' },
              ),
            ],
            { mainSize: 'min', crossAlign: 'stretch', spacing: 1 },
          );
    const children: Widget[] = [
      new Padding(EdgeInsetsDirectional.only({ start: leftWidth, end: rightWidth }), text),
    ];
    const iconSlot = (
      child: Widget,
      alignment: AlignmentGeometry,
      width: number,
      start: boolean,
    ): Widget => {
      const iconSize = start ? 15 : 21;
      const style = new TextStyle({
        fontSize: iconSize,
        color,
        ...(start ? { fontWeight: FontWeight.w600 } : {}),
      });
      const content = new DefaultTextStyle(
        style,
        IconTheme.merge({
          data: new IconThemeData({
            color: new Color(color),
            size: iconSize,
            applyTextScaling: true,
            ...(start ? { weight: 600 } : {}),
          }),
          child,
        }),
      );
      return new Positioned(
        new CustomSingleChildLayout(content, new MenuMidpointLayout(alignment.resolve(direction))),
        {
          ...(start === (direction === 'ltr') ? { left: 0 } : { right: 0 }),
          top: 0,
          bottom: 0,
          width,
        },
      );
    };
    if (leading)
      children.push(
        iconSlot(
          leading,
          options.leadingMidpointAlignment ??
            new AlignmentDirectional(2 * (0.000118 * units + 0.584) - 1, 0),
          leftWidth,
          true,
        ),
      );
    if (trailing)
      children.push(
        iconSlot(
          trailing,
          options.trailingMidpointAlignment ??
            new AlignmentDirectional(rightWidth > 0 ? -12 / rightWidth : 0, 0),
          rightWidth,
          false,
        ),
      );
    return MediaQuery.withClampedTextScaling({
      minScaleFactor: minMenuScale,
      maxScaleFactor: maxMenuScale,
      child: new ConstrainedBox(
        new Padding(padding, new Stack(children)),
        options.constraints ?? new BoxConstraints(0, Infinity, defaultHeight),
      ),
    });
  }
}
