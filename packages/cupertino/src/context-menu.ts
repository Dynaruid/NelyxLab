// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/context_menu.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { Tween } from '@nelyx/core/framework/animation/tween';
import { GestureDisposition } from '@nelyx/core/framework/gestures/arena';
import { kMinFlingVelocity } from '@nelyx/core/framework/gestures/constants';
import type {
  DragEndDetails,
  DragUpdateDetails,
} from '@nelyx/core/framework/gestures/drag-details';
import { TapGestureRecognizer } from '@nelyx/core/framework/gestures/tap';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { Border } from '@nelyx/core/framework/painting/box-border';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { MultiChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { ShapeBorderClipper } from '@nelyx/core/framework/rendering/shape-border-clipper';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  ColoredBox,
  Column,
  DecoratedBox,
  KeyedSubtree,
  Positioned,
  SizedBox,
  Transform,
} from '@nelyx/core/framework/widgets/basic';
import { ClipPath } from '@nelyx/core/framework/widgets/clip';
import { CustomMultiChildLayout, LayoutId } from '@nelyx/core/framework/widgets/custom-layout';
import { FittedBox } from '@nelyx/core/framework/widgets/fitted-box';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { CapturedThemes } from '@nelyx/core/framework/widgets/inherited-theme';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { Navigator, isCurrentRoute } from '@nelyx/core/framework/widgets/navigation';
import type { NavigatorController, Route } from '@nelyx/core/framework/widgets/navigation';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { Overlay, OverlayEntry } from '@nelyx/core/framework/widgets/overlay';
import type { OverlayState } from '@nelyx/core/framework/widgets/overlay';
import { PageRoute } from '@nelyx/core/framework/widgets/pages';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import {
  RawGestureDetector,
  GestureRecognizerFactoryWithHandlers,
} from '@nelyx/core/framework/widgets/raw-gesture-detector';
import { ScrollConfiguration } from '@nelyx/core/framework/widgets/scroll-configuration';
import { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import { SingleBoxScrollView } from '@nelyx/core/framework/widgets/scroll-view';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { HapticFeedback } from '@nelyx/core/services/haptic-feedback';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { ImageFilter } from '@nelyx/core/ui/image-filter';
import { Offset } from '@nelyx/core/ui/offset';
import { Rect } from '@nelyx/core/ui/rect';
import { SemanticsRole } from '@nelyx/core/ui/semantics';
import { CupertinoLocalizations } from './cupertino-localizations.ts';
import { CupertinoScrollbar } from './scrollbar.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import {
  contextMenuBackground,
  contextMenuPreviewShadows,
  contextMenuSeparator,
} from './internal/context-menu-style.ts';

const openScale = 1.15;
const minimumScale = 1.02;
const previewRadius = 12;
const routeDuration = 335;
const previewDuration = 800;
const totalDuration = previewDuration + routeDuration;
const opensAt = previewDuration / totalDuration;
const barrierColor = new Color(0x6604040f);
const backdrop = ImageFilter.blur({ sigmaX: 5, sigmaY: 5 });
const spacing = 20;
const actionWidth = 250;
const scrollbarMargin = 13;
const minDragScale = 0.8;
const sheetThreshold = 0.9;
const restoreDragDuration = 600;
const flingDuration = 64;
const sheetShape = new RoundedSuperellipseBorder({ borderRadius: BorderRadius.circular(13) });
const builderProgress = new Tween({ begin: opensAt, end: 1 });
type ContextMenuLocation = 'left' | 'center' | 'right';
type DismissCallback = (context: BuildContext, scale: number, opacity: number) => void;

export type CupertinoContextMenuBuilder = (
  context: BuildContext,
  animation: Animation<number>,
) => Widget;
interface ContextMenuOptions extends WidgetOptions {
  readonly actions: readonly Widget[];
  readonly enableHapticFeedback?: boolean;
}
export interface CupertinoContextMenuOptions extends ContextMenuOptions {
  readonly child: Widget;
}
export interface CupertinoContextMenuBuilderOptions extends ContextMenuOptions {
  readonly builder: CupertinoContextMenuBuilder;
}

export class CupertinoContextMenu extends StatefulWidget {
  static readonly kOpenBorderRadius = previewRadius;
  static readonly kEndBoxShadow = contextMenuPreviewShadows;
  static readonly kBackgroundColor = contextMenuBackground;
  static readonly animationOpensAt = opensAt;
  readonly actions: readonly Widget[];
  readonly enableHapticFeedback: boolean;
  readonly child: Widget | null;
  readonly builder: CupertinoContextMenuBuilder;

  constructor(options: CupertinoContextMenuOptions | CupertinoContextMenuBuilderOptions) {
    super(options.key ?? null);
    invariant(
      options.actions.length > 0,
      'empty-cupertino-context-menu',
      'Supply at least one context menu action',
    );
    this.actions = Object.freeze([...options.actions]);
    this.enableHapticFeedback = options.enableHapticFeedback ?? false;
    this.child = 'child' in options ? options.child : null;
    this.builder = 'builder' in options ? options.builder : () => options.child;
  }
  static builder(options: CupertinoContextMenuBuilderOptions): CupertinoContextMenu {
    return new CupertinoContextMenu(options);
  }
  override createState(): State<CupertinoContextMenu> {
    return new CupertinoContextMenuState();
  }
}

function rectOf(box: RenderBox, ancestor?: RenderObject | null): Rect {
  const target = ancestor?.attached && ancestor.owner === box.owner ? { ancestor } : {};
  return Rect.fromPoints(
    box.localToGlobal(Offset.zero, target),
    box.localToGlobal(new Offset(box.size.width, box.size.height), target),
  );
}
function positionOf(rect: Rect, center: number): ContextMenuLocation {
  if (
    rect.left < center &&
    rect.right > center &&
    Math.abs(rect.center.dx - center) <= rect.width / 4
  )
    return 'center';
  return rect.center.dx > center ? 'right' : 'left';
}
function openingScale(rect: Rect, viewport: Size, padding: EdgeInsets): number {
  const center = rect.center;
  const left = (2 * (center.dx - padding.left)) / rect.width;
  const right = (2 * (viewport.width - padding.right - center.dx)) / rect.width;
  const top = (2 * (center.dy - padding.top)) / rect.height;
  const bottom = (2 * (viewport.height - padding.bottom - center.dy)) / rect.height;
  return Math.min(openScale, Math.max(minimumScale, Math.min(left, right, top, bottom)));
}
class HoldRecognizer extends TapGestureRecognizer {
  acceptHold(): void {
    this.resolve(GestureDisposition.accepted);
  }
}

class CupertinoContextMenuState extends SingleTickerProviderStateMixin<CupertinoContextMenu> {
  private readonly anchorKey = new GlobalKey('Cupertino context menu anchor');
  private readonly previewKey = new GlobalKey('Cupertino context menu preview');
  private press!: AnimationController;
  private tap: HoldRecognizer | null = null;
  private route: ContextMenuRoute | null = null;
  private decoy: OverlayEntry | null = null;
  private measured: { readonly rect: Rect; readonly viewport: Size } | null = null;
  private accepted = false;
  private scale = openScale;

  override initState(): void {
    super.initState();
    this.press = new AnimationController({
      vsync: this,
      duration: previewDuration,
      upperBound: opensAt,
    });
    this.press.addListener(this.pressAdvanced);
    this.press.addStatusListener(this.pressStatus);
  }
  private readonly pressAdvanced = () => {
    if (
      !this.mounted ||
      this.accepted ||
      this.press.status === AnimationStatus.reverse ||
      this.press.value < opensAt / 2
    )
      return;
    if (!isCurrentRoute(this.context)) {
      this.press.reverse();
      return;
    }
    this.accepted = true;
    if (this.widget.enableHapticFeedback) {
      const messenger =
        this.context.services.binaryMessenger ??
        this.context.services.platformServices?.defaultBinaryMessenger;
      void HapticFeedback.heavyImpact(messenger).catch((error) =>
        this.context.services.reportError?.(error),
      );
    }
    this.tap?.acceptHold();
  };
  private readonly pressStatus = (status: AnimationStatus) => {
    if (status === AnimationStatus.completed && this.mounted && this.measured && !this.route)
      this.openRoute();
    if (status === AnimationStatus.dismissed && this.decoy) {
      this.removeDecoy();
      if (this.mounted && this.context instanceof Element && this.context.active)
        this.setState(() => {});
    }
  };

  private readonly beginHold = (): void => {
    if (
      !this.mounted ||
      this.route ||
      this.press.isForwardOrCompleted ||
      !isCurrentRoute(this.context)
    )
      return;
    const context = this.context;
    const anchor = this.anchorKey.currentContext?.findRenderObject();
    if (!(anchor instanceof RenderBox && anchor.attached && anchor.hasSize)) return;
    const overlay = Overlay.maybeOf(context, { rootOverlay: true });
    const overlayRender = overlay?.context.findRenderObject();
    let viewport: RenderObject = overlayRender ?? anchor;
    if (!overlayRender) while (viewport.parent) viewport = viewport.parent;
    const rect = rectOf(anchor, viewport);
    if (rect.isEmpty) return;
    const size = viewport instanceof RenderBox && viewport.hasSize ? viewport.size : anchor.size;
    this.measured = { rect, viewport: size };
    this.scale = openingScale(rect, size, MediaQuery.paddingOf(context));
    this.accepted = false;
    if (overlay && overlayRender?.attached) this.showDecoy(overlay, rect);
    this.press.forward();
  };

  private buildPreview(): Widget {
    return new ListenableBuilder({
      listenable: this.press,
      builder: (context) => {
        const amount = this.press.value / opensAt;
        const child = new KeyedSubtree({
          key: this.previewKey,
          child: this.widget.builder(context, this.press),
        });
        return Transform.scale(child, {
          scale: 1 + (this.scale - 1) * Curves.easeOutCubic.transform(amount),
          alignment: Alignment.center,
          transformHitTests: false,
        });
      },
    });
  }

  private showDecoy(overlay: OverlayState, rect: Rect): void {
    const themes = InheritedTheme.capture(this.context, overlay.context);
    const entry = new OverlayEntry({
      builder: () =>
        Positioned.fromRect(
          new IgnorePointer(new ExcludeSemantics({ child: themes.wrap(this.buildPreview()) })),
          rect,
        ),
    });
    overlay.insert(entry);
    this.setState(() => {
      this.decoy = entry;
    });
  }

  private removeDecoy(): void {
    const entry = this.decoy;
    this.decoy = null;
    if (entry?.overlay) entry.remove();
    entry?.dispose();
  }
  private readonly releaseHold = (): void => {
    if (!this.route && !this.accepted && this.press.isAnimating) this.press.reverse();
  };

  private openRoute(): void {
    const context = this.context;
    const measured = this.measured;
    if (!measured || !(context instanceof Element && context.active)) return;
    if (!isCurrentRoute(context)) {
      this.press.reverse();
      return;
    }
    const navigator = Navigator.of(context, { rootNavigator: true });
    const original = measured.rect;
    const anchor = Rect.fromCenter({
      center: original.center,
      width: original.width * this.scale,
      height: original.height * this.scale,
    });
    const route = new ContextMenuRoute(
      navigator,
      this.widget,
      this.previewKey,
      original.size,
      anchor,
      positionOf(original, measured.viewport.width / 2),
      CupertinoLocalizations.of(context).menuDismissLabel,
      InheritedTheme.capture(context),
    );
    this.removeDecoy();
    this.setState(() => {
      this.route = route;
    });
    const clear = () => {
      if (!this.mounted || !context.active || this.route !== route) return;
      this.press.reset();
      this.setState(() => {
        this.route = null;
      });
    };
    try {
      void navigator.push(route).catch((error: unknown) => {
        clear();
        context.services.reportError?.(error);
      });
      void route.completed.then(clear);
    } catch (error) {
      clear();
      throw error;
    }
  }

  override build(context: BuildContext): Widget {
    invariant(
      context instanceof Element,
      'invalid-cupertino-context-menu-context',
      'Context menu gestures require an Element',
    );
    const recipe = new GestureRecognizerFactoryWithHandlers(
      HoldRecognizer,
      () => new HoldRecognizer({ binding: context.owner.gestureBinding, debugOwner: this }),
      (recognizer) => {
        this.tap = recognizer;
        recognizer.onTapDown = this.beginHold;
        recognizer.onTapUp = this.releaseHold;
        recognizer.onTapCancel = this.releaseHold;
        recognizer.gestureSettings = MediaQuery.maybeGestureSettingsOf(context);
      },
    );
    const size = this.measured?.rect.size;
    const anchor =
      (this.route || this.decoy) && size
        ? new SizedBox(size.width, size.height)
        : this.buildPreview();
    return new MouseRegion(
      new Semantics({
        onLongPress: this.route ? null : this.beginHold,
        child: new RawGestureDetector(new SizedBox(undefined, undefined, anchor, this.anchorKey), {
          gestures: new Map([[HoldRecognizer, recipe]]),
          excludeFromSemantics: true,
          behavior: HitTestBehavior.opaque,
        }),
      }),
      FoundationPlatform.isWeb ? { cursor: SystemMouseCursors.click } : {},
    );
  }

  override dispose(): void {
    this.removeDecoy();
    this.route?.dismiss();
    this.press.dispose();
    this.tap = null;
    super.dispose();
  }
}

class ContextMenuRoute extends PageRoute<void> {
  private closing = false;
  constructor(
    readonly navigator: NavigatorController,
    readonly menu: CupertinoContextMenu,
    readonly previewKey: GlobalKey,
    readonly originalSize: Size,
    readonly anchor: Rect,
    readonly location: ContextMenuLocation,
    readonly label: string,
    readonly themes: CapturedThemes,
  ) {
    super({
      barrierDismissible: true,
      semanticsDismissible: false,
      barrierFilter: backdrop,
      traversalEdgeBehavior: 'closedLoop',
      directionalTraversalEdgeBehavior: 'closedLoop',
    });
  }
  override get opaque(): boolean {
    return false;
  }
  override get maintainState(): boolean {
    return true;
  }
  override get barrierColor(): Color {
    return barrierColor;
  }
  override get barrierLabel(): string {
    return this.label;
  }
  override get transitionDuration(): number {
    return routeDuration;
  }
  override canTransitionFrom(): boolean {
    return false;
  }
  override canTransitionTo(): boolean {
    return false;
  }
  override didChangeNext(next: Route | null): void {
    super.didChangeNext(next);
    if (next === null && this.closing) this.popWhenCurrent();
  }
  dismiss(): void {
    this.closing = true;
    this.popWhenCurrent();
  }
  private popWhenCurrent(): void {
    void Promise.resolve()
      .then(() => {
        if (this.isCurrent) this.navigator.pop();
      })
      .catch((error) => this.navigatorContext?.services.reportError?.(error));
  }
  override buildPage(context: BuildContext, animation: Animation<number>): Widget {
    return this.themes.wrap(new ContextMenuPage(this, animation, MediaQuery.paddingOf(context)));
  }
  override buildTransitions(
    _context: BuildContext,
    _animation: Animation<number>,
    _secondary: Animation<number>,
    child: Widget,
  ): Widget {
    return child;
  }
}
type ContextMenuChild = 'preview' | 'sheet';
type ContextMenuPlacement = Readonly<Record<ContextMenuChild, Rect>>;

function safeMenuBounds(viewport: Size, padding: EdgeInsets): Rect {
  return Rect.fromLTRB(
    padding.left + spacing,
    padding.top + spacing,
    Math.max(padding.left + spacing, viewport.width - padding.right - spacing),
    Math.max(padding.top + spacing, viewport.height - padding.bottom - spacing),
  );
}

function placeMenu(
  route: ContextMenuRoute,
  safe: Rect,
  sheet: Size,
  landscape: boolean,
): ContextMenuPlacement {
  const { width: sheetWidth, height: sheetHeight } = sheet;
  const previewWidth = landscape ? Math.max(0, safe.width - sheetWidth - spacing) : safe.width;
  const previewHeight = landscape ? safe.height : Math.max(0, safe.height - sheetHeight - spacing);
  const scale = Math.min(
    previewWidth / route.originalSize.width,
    previewHeight / route.originalSize.height,
  );
  const width = route.originalSize.width * scale;
  const height = route.originalSize.height * scale;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
  if (landscape) {
    const totalWidth = width + spacing + sheetWidth;
    const x = safe.center.dx - totalWidth / 2;
    const top = safe.center.dy - Math.max(height, sheetHeight) / 2;
    const before = route.location === 'right';
    return {
      preview: Rect.fromLTWH(before ? x + sheetWidth + spacing : x, top, width, height),
      sheet: Rect.fromLTWH(before ? x : x + width + spacing, top, sheetWidth, sheetHeight),
    };
  }
  const x = clamp(route.anchor.center.dx - width / 2, safe.left, safe.right - width);
  const top = clamp(
    route.anchor.center.dy - height,
    safe.top,
    safe.bottom - height - spacing - sheetHeight,
  );
  const aligned =
    route.location === 'left'
      ? x
      : route.location === 'right'
        ? x + width - sheetWidth
        : x + (width - sheetWidth) / 2;
  return {
    preview: Rect.fromLTWH(x, top, width, height),
    sheet: Rect.fromLTWH(
      clamp(aligned, safe.left, safe.right - sheetWidth),
      top + height + spacing,
      sheetWidth,
      sheetHeight,
    ),
  };
}

class ContextMenuLayout extends MultiChildLayoutDelegate {
  constructor(
    readonly route: ContextMenuRoute,
    readonly padding: EdgeInsets,
    readonly progress: number,
    readonly drag: Offset,
    readonly scale: number,
  ) {
    super();
  }

  override performLayout(size: Size): void {
    const safe = safeMenuBounds(size, this.padding);
    const landscape = size.width > size.height && safe.width > actionWidth + spacing;
    const width = Math.min(actionWidth, safe.width);
    const sheet = this.layoutChild(
      'sheet',
      new BoxConstraints(width, width, 0, landscape ? safe.height : safe.height * 0.45),
    );
    const placement = placeMenu(this.route, safe, sheet, landscape);
    const { anchor } = this.route;
    const preview = (
      Rect.lerp(anchor, placement.preview, this.progress) ?? placement.preview
    ).shift(this.drag);
    const previewRect = Rect.fromCenter({
      center: preview.center,
      width: Math.max(0, preview.width * this.scale),
      height: Math.max(0, preview.height * this.scale),
    });
    this.layoutChild('preview', BoxConstraints.tight(previewRect.size));
    this.positionChild('preview', previewRect.topLeft);
    const menuStart = Rect.fromLTWH(
      anchor.center.dx - sheet.width / 2,
      anchor.bottom,
      sheet.width,
      sheet.height,
    );
    const sheetRect = (
      Rect.lerp(menuStart, placement.sheet, this.progress) ?? placement.sheet
    ).shift(this.drag);
    this.positionChild('sheet', sheetRect.topLeft);
  }

  override shouldRelayout(old: ContextMenuLayout): boolean {
    return (
      old.route !== this.route ||
      !old.padding.equals(this.padding) ||
      old.progress !== this.progress ||
      !old.drag.equals(this.drag) ||
      old.scale !== this.scale
    );
  }
}

class ContextMenuPage extends StatefulWidget {
  constructor(
    readonly route: ContextMenuRoute,
    readonly animation: Animation<number>,
    readonly padding: EdgeInsets,
  ) {
    super();
  }
  override createState(): State<ContextMenuPage> {
    return new ContextMenuPageState();
  }
}

class ContextMenuPageState extends SingleTickerProviderStateMixin<ContextMenuPage> {
  private drive!: AnimationController;
  private motion!: CurvedAnimation;
  private preview!: Animation<number>;
  private drag = Offset.zero;
  private dragTween = new Tween({ begin: Offset.zero, end: Offset.zero });
  private readonly scroll = new ScrollController();
  private viewport: Size = { width: 0, height: 0 };
  private dismissing = false;
  private dismissScale: number | null = null;
  private dismissOpacity: number | null = null;

  override initState(): void {
    super.initState();
    this.drive = new AnimationController({ vsync: this, duration: restoreDragDuration, value: 1 });
    this.motion = new CurvedAnimation({
      parent: this.widget.animation,
      curve: Curves.easeOutBack,
      reverseCurve: Curves.easeInBack,
    });
    this.preview = this.widget.animation.drive(builderProgress);
  }
  private readonly dismiss: DismissCallback = (_context, scale, opacity) => {
    this.dismissing = true;
    this.dismissScale = scale;
    this.dismissOpacity = opacity;
    this.widget.route.dismiss();
  };
  private dragPoint(): Offset {
    return this.dragTween.transform(Curves.easeOut.transform(this.drive.value));
  }
  private dragScale(value: Offset): number {
    const distance = Math.max(this.viewport.height / 2, 1);
    return Math.max(minDragScale, 1 - Math.abs(value.dy) / distance);
  }
  private startDrag = (): void => {
    if (this.dismissing) return;
    const current = this.dragPoint();
    this.drive.stop();
    this.drag = current;
  };
  private updateDrag = ({ delta }: DragUpdateDetails): void => {
    if (this.dismissing) return;
    this.setState(() => {
      this.drag = this.drag.add(new Offset(delta.x, delta.y));
      const x = Math.max(-spacing, Math.min(spacing, this.drag.dx * 0.05));
      const y = this.drag.dy < 0 ? this.drag.dy * 0.05 : this.drag.dy;
      const point = new Offset(x, y);
      this.dragTween = new Tween({ begin: point, end: point });
      this.drive.value = 1;
    });
  };
  private endDrag = (details: DragEndDetails): void => {
    if (this.dismissing) return;
    const current = this.dragPoint();
    const velocity = details.velocity.pixelsPerSecond.dy;
    if (velocity >= kMinFlingVelocity) {
      this.animateDrag(current, current.translate(0, 100), flingDuration, true);
    } else if (velocity > -kMinFlingVelocity && this.dragScale(current) === minDragScale) {
      this.dismiss(this.context, minDragScale, 0);
    } else {
      this.animateDrag(
        current,
        Offset.zero,
        velocity < -kMinFlingVelocity ? flingDuration : restoreDragDuration,
        false,
      );
    }
  };
  private readonly cancelDrag = (): void => {
    if (!this.dismissing)
      this.animateDrag(this.dragPoint(), Offset.zero, restoreDragDuration, false);
  };
  private animateDrag(from: Offset, to: Offset, duration: number, dismiss: boolean): void {
    this.dragTween = new Tween({ begin: from, end: to });
    this.drive.duration = duration;
    if (dismiss) this.dismissing = true;
    const motion = this.drive.forward({ from: 0 });
    if (dismiss)
      void motion.then(() => {
        if (this.mounted) this.dismiss(this.context, this.dragScale(to), 0);
      });
  }

  private sheet(context: BuildContext): Widget {
    const { route } = this.widget;
    const background = resolveCupertinoColor(contextMenuBackground, context);
    const separator = resolveCupertinoColor(contextMenuSeparator, context);
    const line = new BoxDecoration({
      border: new Border({ top: new BorderSide({ width: 0.4, color: separator.toARGB32() }) }),
    });
    return new ClipPath(
      new ColoredBox({
        color: background.toARGB32(),
        child: new ScrollConfiguration({
          behavior: ScrollConfiguration.of(context).copyWith({ scrollbars: false }),
          child: new CupertinoScrollbar({
            mainAxisMargin: scrollbarMargin,
            controller: this.scroll,
            child: new SingleBoxScrollView({
              primary: false,
              controller: this.scroll,
              child: new Column(
                route.menu.actions.map((action, index) =>
                  index === 0
                    ? action
                    : new DecoratedBox(action, { decoration: line, position: 'foreground' }),
                ),
                { crossAxisAlignment: 'stretch', mainAxisSize: 'min' },
              ),
            }),
          }),
        }),
      }),
      { clipper: new ShapeBorderClipper({ shape: sheetShape }) },
    );
  }

  override build(context: BuildContext): Widget {
    const { animation } = this.widget;
    return new LayoutBuilder((_layoutContext, constraints) => {
      this.viewport = constraints.biggest;
      const actions = this.sheet(context);
      return new ListenableBuilder({
        listenable: this.drive,
        child: actions,
        builder: (_dragContext, menu) =>
          new ListenableBuilder({
            listenable: this.motion,
            child: menu,
            builder: (previewContext, sheet) => this.panel(previewContext, sheet!, animation.value),
          }),
      });
    });
  }

  private panel(context: BuildContext, sheet: Widget, progress: number): Widget {
    const { route, padding } = this.widget;
    const point = this.dragPoint().multiply(progress);
    const scale =
      this.dismissScale === null ? this.dragScale(point) : 1 + (this.dismissScale - 1) * progress;
    const dragOpacity =
      this.dismissOpacity ??
      Math.max(0, Math.min(1, (scale - minDragScale) / (sheetThreshold - minDragScale)));
    const opacity =
      Curves.easeIn.transform(Math.max(0, Math.min(1, (progress - 0.2) / 0.8))) * dragOpacity;
    const widget = route.menu;
    const content = new KeyedSubtree({
      key: route.previewKey,
      child: widget.builder(context, this.preview),
    });
    const view = widget.child
      ? new DecoratedBox(
          new ClipPath(
            new FittedBox(
              new SizedBox(route.originalSize.width, route.originalSize.height, content),
              { fit: 'cover' },
            ),
            {
              clipper: new ShapeBorderClipper({
                shape: new RoundedSuperellipseBorder({
                  borderRadius: BorderRadius.circular(previewRadius * progress),
                }),
              }),
            },
          ),
          { decoration: new BoxDecoration({ boxShadow: contextMenuPreviewShadows }) },
        )
      : content;
    return new CustomMultiChildLayout(
      [
        new LayoutId(
          new GestureDetector(view, {
            behavior: HitTestBehavior.opaque,
            excludeFromSemantics: true,
            onPanStart: this.startDrag,
            onPanUpdate: this.updateDrag,
            onPanEnd: this.endDrag,
            onPanCancel: this.cancelDrag,
          }),
          'preview',
        ),
        new LayoutId(
          new IgnorePointer(
            new ExcludeSemantics({
              excluding: opacity === 0,
              child: new Opacity(
                new Semantics({ role: SemanticsRole.menu, explicitChildNodes: true, child: sheet }),
                { opacity },
              ),
            }),
            { ignoring: opacity === 0 },
          ),
          'sheet',
        ),
      ],
      new ContextMenuLayout(route, padding, this.motion.value, point, scale),
    );
  }
  override dispose(): void {
    this.motion.dispose();
    this.drive.dispose();
    this.scroll.dispose();
    super.dispose();
  }
}
