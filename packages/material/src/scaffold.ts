// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/scaffold.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { AppTheme, Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { invariant } from '@nelyx/core/foundation/errors';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import { UniqueKey, ValueKey, sameKey } from '@nelyx/core/foundation/key';
import { Listenable, ValueNotifier } from '@nelyx/core/foundation/notifier';
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import type { AnimationStyle } from '@nelyx/core/framework/animation/animation-style';
import {
  kAlwaysCompleteAnimation,
  TrainHoppingAnimation,
} from '@nelyx/core/framework/animation/animations';
import { Curves, Split } from '@nelyx/core/framework/animation/curves';
import { CurveTween, Tween } from '@nelyx/core/framework/animation/tween';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import { Alignment, AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { Border } from '@nelyx/core/framework/painting/box-border';
import type { Decoration } from '@nelyx/core/framework/painting/decoration';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { allInsets } from '@nelyx/core/ui/geometry';
import type { Size } from '@nelyx/core/ui/geometry';
import { Size as SourceSize } from '@nelyx/core/ui/size';
import type { TextDirection } from '@nelyx/core/ui/typography';
import { Element, InheritedWidget, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import {
  Align,
  Builder,
  ColoredBox,
  Column,
  ConstrainedBox,
  DecoratedBox,
  IntrinsicHeight,
  Row,
  Expanded,
  Padding,
  Text,
  SizedBox,
  Stack,
  Positioned,
  Transform,
} from '@nelyx/core/framework/widgets/basic';
import { Actions, DismissAction, DismissIntent } from '@nelyx/core/framework/widgets/actions';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { MultiChildLayoutDelegate } from '@nelyx/core/framework/rendering/custom-layout';
import { CustomMultiChildLayout, LayoutId } from '@nelyx/core/framework/widgets/custom-layout';
import { DraggableScrollableNotification } from '@nelyx/core/framework/widgets/draggable-scrollable-sheet';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Hero } from '@nelyx/core/framework/widgets/heroes';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { ListenableBuilder } from '@nelyx/core/framework/widgets/listenable-builder';
import { NotificationListener } from '@nelyx/core/framework/widgets/notification-listener';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { OverflowBar, OverflowBarAlignment } from '@nelyx/core/framework/widgets/overflow-bar';
import type { PreferredSizeWidget } from '@nelyx/core/framework/widgets/preferred-size';
import { withStatusBarScrollTarget } from '@nelyx/core/framework/widgets/primary-scroll-controller';
import { AbsorbPointer, IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { ScrollNotificationObserver } from '@nelyx/core/framework/widgets/scroll-notification-observer';
import {
  BlockSemantics,
  ExcludeSemantics,
  Semantics,
} from '@nelyx/core/framework/widgets/semantics';
import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import {
  isCurrentRoute,
  LocalHistoryEntry,
  Navigator,
  routeTokenOf,
} from '@nelyx/core/framework/widgets/navigation';
import { Material as MaterialSurface } from './material.ts';
import { Color } from '@nelyx/core/ui/color';
import { Rect } from '@nelyx/core/ui/rect';
import { clampDouble } from '@nelyx/core/ui/math';
import { maybeTickerScheduler } from '@nelyx/core/internal/framework/widgets/ticker-scheduler';
import { AppBar } from './app-bar.ts';
import { BottomSheet } from './bottom-sheet.ts';
import type { BottomSheetOptions } from './bottom-sheet.ts';
import { standardEasing } from './curves.ts';
import { MaterialBannerTheme } from './material-banner-theme.ts';
import { DrawerAlignment, DrawerController } from './drawer.ts';
import type { DrawerCallback, DrawerControllerState } from './drawer.ts';
import { Divider } from './divider.ts';
import { FlexibleSpaceBar } from './flexible-space-bar.ts';
import { FloatingActionButton } from './floating-action-button.ts';
import {
  FloatingActionButtonAnimator,
  FloatingActionButtonLocation,
  isTopFabLocation,
  kFloatingActionButtonSegue,
  kFloatingActionButtonTurnInterval,
} from './floating-action-button-location.ts';
import { ScaffoldFeatureController, ScaffoldMessenger } from './scaffold-messenger.ts';
import type { ScaffoldMessengerState } from './scaffold-messenger.ts';
import { ScaffoldGeometryNotifier } from './internal/scaffold-geometry.ts';
import { ScaffoldFeatureFlight } from './internal/scaffold-feature-flight.ts';
import type { ScaffoldGeometry } from './internal/scaffold-geometry.ts';
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
  CloseMaterialBannerOptions,
} from './scaffold-messenger.ts';
export { ScaffoldGeometry } from './internal/scaffold-geometry.ts';
export type { ScaffoldGeometryOptions } from './internal/scaffold-geometry.ts';

const drawerLayer = new ValueKey('Scaffold drawer');
const endDrawerLayer = new ValueKey('Scaffold end drawer');
const bottomSheetDominatesPercentage = 0.3;
const minBottomSheetScrimOpacity = 0.1;
const maxBottomSheetScrimOpacity = 0.6;
const standardBottomSheetCurve = standardEasing;
const fabEntranceTurn = new Tween({ begin: 1 - kFloatingActionButtonTurnInterval, end: 1 }).chain(
  new CurveTween({ curve: Curves.easeIn }),
);

export interface ScaffoldPrelayoutGeometryOptions {
  readonly floatingActionButtonSize: SourceSize;
  readonly bottomSheetSize: SourceSize;
  readonly contentBottom: number;
  readonly contentTop: number;
  readonly minInsets: EdgeInsets;
  readonly minViewPadding: EdgeInsets;
  readonly scaffoldSize: SourceSize;
  readonly snackBarSize: SourceSize;
  readonly materialBannerSize: SourceSize;
  readonly textDirection: TextDirection;
}

export class ScaffoldPrelayoutGeometry implements ScaffoldPrelayoutGeometryOptions {
  readonly floatingActionButtonSize: SourceSize;
  readonly bottomSheetSize: SourceSize;
  readonly contentBottom: number;
  readonly contentTop: number;
  readonly minInsets: EdgeInsets;
  readonly minViewPadding: EdgeInsets;
  readonly scaffoldSize: SourceSize;
  readonly snackBarSize: SourceSize;
  readonly materialBannerSize: SourceSize;
  readonly textDirection: TextDirection;

  constructor(options: ScaffoldPrelayoutGeometryOptions) {
    this.floatingActionButtonSize = options.floatingActionButtonSize;
    this.bottomSheetSize = options.bottomSheetSize;
    this.contentBottom = options.contentBottom;
    this.contentTop = options.contentTop;
    this.minInsets = options.minInsets;
    this.minViewPadding = options.minViewPadding;
    this.scaffoldSize = options.scaffoldSize;
    this.snackBarSize = options.snackBarSize;
    this.materialBannerSize = options.materialBannerSize;
    this.textDirection = options.textDirection;
  }
}

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
  readonly bottomSheet?: Widget | null;
  readonly bottomSheetScrimBuilder?: (
    context: BuildContext,
    animation: Animation<number>,
  ) => Widget;
  readonly persistentFooterButtons?: readonly Widget[] | null;
  readonly persistentFooterAlignment?: AlignmentGeometry;
  readonly persistentFooterDecoration?: Decoration | null;
  readonly floatingActionButton?: Widget | null;
  readonly floatingActionButtonAnimator?: FloatingActionButtonAnimator | null;
  readonly floatingActionButtonLocation?: FloatingActionButtonLocation | null;
  readonly backgroundColor?: Color | null;
  readonly primary?: boolean;
  readonly resizeToAvoidBottomInset?: boolean | null;
  readonly extendBody?: boolean;
  readonly extendBodyBehindAppBar?: boolean;
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

  static geometryOf(context: BuildContext): ValueListenable<ScaffoldGeometry> {
    const scope = context.maybeDependOn(ScaffoldScope);
    invariant(
      scope,
      'missing-scaffold-geometry',
      'Scaffold.geometryOf requires a Scaffold ancestor',
    );
    return scope.geometry;
  }

  static hasDrawer(context: BuildContext, { registerForUpdates = true } = {}): boolean {
    return registerForUpdates
      ? (context.maybeDependOn(ScaffoldScope)?.hasDrawer ?? false)
      : (this.maybeOf(context)?.hasDrawer ?? false);
  }

  static hasEndDrawer(context: BuildContext, { registerForUpdates = true } = {}): boolean {
    return registerForUpdates
      ? (context.maybeDependOn(ScaffoldScope)?.hasEndDrawer ?? false)
      : (this.maybeOf(context)?.hasEndDrawer ?? false);
  }

  override createState(): ScaffoldState {
    return new ScaffoldState();
  }
}

class ScaffoldScope extends InheritedWidget {
  constructor(
    readonly geometry: ValueListenable<ScaffoldGeometry>,
    readonly hasDrawer: boolean,
    readonly hasEndDrawer: boolean,
    child: Widget,
  ) {
    super(child);
  }

  override updateShouldNotify(old: ScaffoldScope): boolean {
    return (
      old.geometry !== this.geometry ||
      old.hasDrawer !== this.hasDrawer ||
      old.hasEndDrawer !== this.hasEndDrawer
    );
  }
}

export interface ShowBottomSheetOptions extends Pick<
  BottomSheetOptions,
  | 'builder'
  | 'backgroundColor'
  | 'elevation'
  | 'shape'
  | 'clipBehavior'
  | 'constraints'
  | 'enableDrag'
  | 'showDragHandle'
> {
  readonly transitionAnimationController?: AnimationController | null;
  readonly sheetAnimationStyle?: AnimationStyle | null;
}

export class PersistentBottomSheetController extends ScaffoldFeatureController<BottomSheet, void> {}

interface PresentedBottomSheet {
  readonly widget: Widget;
  readonly animation: AnimationController;
  readonly ownsAnimation: boolean;
  readonly contentRevision: ValueNotifier<number>;
  readonly resolve: () => void;
  readonly statusChanged: (status: AnimationStatus) => void;
  history: LocalHistoryEntry | null;
  closing: boolean;
}

export class ScaffoldState extends TickerProviderStateMixin<Scaffold> {
  private readonly geometry = new ScaffoldGeometryNotifier(
    () => this.mounted && maybeTickerScheduler(this.context)?.phase === 'paint',
  );
  private messenger: ScaffoldMessengerState | null = null;
  private unregister: (() => void) | null = null;
  private readonly drawerKey = new GlobalKey<DrawerControllerState>('Scaffold.drawer');
  private readonly endDrawerKey = new GlobalKey<DrawerControllerState>('Scaffold.endDrawer');
  private readonly sheets: PresentedBottomSheet[] = [];
  private currentSheet: PresentedBottomSheet | null = null;
  private persistentSheetHistory: LocalHistoryEntry | null = null;
  private showScrim = false;
  private scrimAnimation: AnimationController | null = null;
  private readonly sheetFabScale = new ValueNotifier(1);
  private fabMove: AnimationController | null = null;
  private fabVisibility!: AnimationController;
  private displayedFab: Widget | null = null;
  private fabExiting = false;
  private exitFabLocation: FloatingActionButtonLocation | null = null;
  private previousFabLocation: FloatingActionButtonLocation | null = null;
  private fabAnimations: {
    readonly animator: FloatingActionButtonAnimator;
    readonly scale: Animation<number>;
    readonly entranceRotation: TrainHoppingAnimation;
    readonly exitRotation: TrainHoppingAnimation;
  } | null = null;
  private currentFabScale(): number {
    const motion = this.fabAnimations;
    if (!motion || !this.displayedFab) return 0;
    return motion.animator === FloatingActionButtonAnimator.noAnimation
      ? motion.scale.value
      : Math.min(
          motion.scale.value,
          Curves.easeIn.transform(Math.min(this.fabVisibility.value, this.sheetFabScale.value)),
        );
  }
  private readonly updateFabGeometry = () => this.geometry.updateScale(this.currentFabScale());

  private readonly fabVisibilityStatusChanged = (status: AnimationStatus): void => {
    if (!this.mounted || !this.fabExiting || status !== AnimationStatus.dismissed) return;
    this.setState(() => {
      this.fabExiting = false;
      this.displayedFab = this.widget.options?.floatingActionButton ?? null;
    });
    if (this.displayedFab) this.fabVisibility.forward();
    else this.updateFabGeometry();
  };

  private configureFabMotion(): void {
    const animator =
      this.widget.options?.floatingActionButtonAnimator ?? FloatingActionButtonAnimator.scaling;
    if (animator === this.fabAnimations?.animator) return;
    this.fabAnimations?.scale.removeListener(this.updateFabGeometry);
    this.fabAnimations?.entranceRotation.dispose();
    this.fabAnimations?.exitRotation.dispose();
    const controller = (this.fabMove ??= new AnimationController({
      vsync: this,
      value: 1,
      duration: kFloatingActionButtonSegue * 2,
      disableAnimations: () =>
        this.context.maybeDependOn(MediaQuery)?.data.disableAnimations ?? false,
    }));
    const rotation = animator.getRotationAnimation({ parent: controller.view });
    const noAnimation = animator === FloatingActionButtonAnimator.noAnimation;
    this.fabAnimations = {
      animator,
      scale: animator.getScaleAnimation({ parent: controller.view }),
      entranceRotation: noAnimation
        ? new TrainHoppingAnimation(rotation, null)
        : new TrainHoppingAnimation(this.fabVisibility.drive(fabEntranceTurn), rotation),
      exitRotation: noAnimation
        ? new TrainHoppingAnimation(rotation, null)
        : new TrainHoppingAnimation(kAlwaysCompleteAnimation, rotation),
    };
    this.fabAnimations.scale.addListener(this.updateFabGeometry);
    this.updateFabGeometry();
  }

  override initState(): void {
    super.initState();
    this.displayedFab = this.widget.options?.floatingActionButton ?? null;
    this.fabVisibility = new AnimationController({
      vsync: this,
      value: this.displayedFab ? 1 : 0,
      duration: kFloatingActionButtonSegue,
      disableAnimations: () =>
        this.context.maybeDependOn(MediaQuery)?.data.disableAnimations ?? false,
    });
    this.fabVisibility.addListener(this.updateFabGeometry);
    this.fabVisibility.addStatusListener(this.fabVisibilityStatusChanged);
    this.sheetFabScale.addListener(this.updateFabGeometry);
    if (this.displayedFab) this.configureFabMotion();
  }

  override didUpdateWidget(oldWidget: Scaffold): void {
    super.didUpdateWidget(oldWidget);
    if (this.widget.options?.bottomSheet && this.currentSheet) this.closeSheet(this.currentSheet);
    if (oldWidget.options?.bottomSheet && !this.widget.options?.bottomSheet) {
      this.persistentSheetHistory?.remove();
      this.clearSheetCoverage();
    }
    this.updateFabChild(oldWidget);
    if (!this.widget.options?.floatingActionButton) {
      this.previousFabLocation = null;
      if (this.fabMove?.isAnimating) this.fabMove.value = 1;
      return;
    }
    const oldAnimator = this.fabAnimations?.animator;
    this.configureFabMotion();
    const move = this.fabMove!;
    const previous =
      oldWidget.options?.floatingActionButtonLocation ?? FloatingActionButtonLocation.endFloat;
    const location =
      this.widget.options.floatingActionButtonLocation ?? FloatingActionButtonLocation.endFloat;
    if (!oldWidget.options?.floatingActionButton || previous === location) return;

    const animator = this.fabAnimations!.animator;
    const interrupted = move.isAnimating && this.previousFabLocation !== null;
    this.previousFabLocation = interrupted
      ? new TransitionSnapshotFabLocation(
          this.previousFabLocation!,
          previous,
          oldAnimator ?? animator,
          move.value,
        )
      : previous;
    move.forward({ from: interrupted ? animator.getAnimationRestart(move.value) : 0 });
  }

  private updateFabChild(oldWidget: Scaffold): void {
    const next = this.widget.options?.floatingActionButton ?? null;
    if (next) this.configureFabMotion();
    const current = this.displayedFab;
    if (this.fabAnimations?.animator === FloatingActionButtonAnimator.noAnimation) {
      this.fabExiting = false;
      this.displayedFab = next;
      this.fabVisibility.value = next ? 1 : 0;
    } else if (current && next && sameKey(current.key, next.key)) {
      this.displayedFab = next;
      if (this.fabExiting) {
        this.fabExiting = false;
        this.fabVisibility.forward();
      }
    } else if (current && this.fabVisibility.value > 0) {
      if (!this.fabExiting) {
        this.exitFabLocation = oldWidget.options?.floatingActionButtonLocation ?? null;
        this.fabExiting = true;
        this.fabVisibility.reverse();
      }
    } else {
      this.fabExiting = false;
      this.displayedFab = next;
      if (next) this.fabVisibility.forward();
    }
    this.updateFabGeometry();
  }

  private buildFab(): Widget | null {
    const button = this.displayedFab;
    const motion = this.fabAnimations;
    if (!button || !motion) return null;
    const rotation = this.fabExiting ? motion.exitRotation : motion.entranceRotation;
    return new ListenableBuilder(
      Listenable.merge([motion.scale, rotation, this.fabVisibility, this.sheetFabScale]),
      () => {
        const scale = this.currentFabScale();
        const extended = button instanceof FloatingActionButton && button.isExtended;
        const animated = extended
          ? Transform.scale(new Opacity(button, { opacity: clampDouble(scale, 0, 1) }), {
              scale: this.fabExiting ? 1 : clampDouble(scale / 0.1, 0, 1),
            })
          : Transform.scale(Transform.rotate(button, rotation.value * Math.PI * 2), { scale });
        const inactive = this.fabExiting || scale <= 0;
        return new ExcludeFocus(
          new ExcludeSemantics({
            child: new IgnorePointer(animated, { ignoring: inactive }),
            excluding: inactive,
          }),
          { excluding: inactive },
        );
      },
    );
  }

  get hasDrawer(): boolean {
    return this.widget.options?.drawer != null;
  }
  get hasEndDrawer(): boolean {
    return this.widget.options?.endDrawer != null;
  }
  get hasFloatingActionButton(): boolean {
    return this.widget.options?.floatingActionButton != null;
  }
  get isDrawerBarrierDismissible(): boolean {
    return this.widget.options?.drawerBarrierDismissible ?? true;
  }
  get appBarMaxHeight(): number | null {
    const options = this.widget.options;
    if (!options?.appBar) return null;
    return (
      AppBar.preferredHeightFor(this.context, options.appBar.preferredSize) +
      (options.primary === false ? 0 : (MediaQuery.maybePaddingOf(this.context)?.top ?? 0))
    );
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

  showBodyScrim(visible: boolean, progress: number): void {
    if (!visible && !this.scrimAnimation) return;
    this.scrimAnimation ??= new AnimationController({ vsync: this });
    if (visible !== this.showScrim)
      this.setState(() => {
        this.showScrim = visible;
      });
    if (this.scrimAnimation.value !== progress) this.scrimAnimation.value = progress;
  }

  private clearSheetCoverage(): void {
    this.sheetFabScale.value = 1;
    this.showBodyScrim(false, 0);
  }

  private onSheetExtent(
    sheet: PresentedBottomSheet | null,
    notification: DraggableScrollableNotification,
  ): boolean {
    if (notification.depth !== 0) return false;
    if (sheet && (this.currentSheet !== sheet || sheet.closing)) return false;
    if (!sheet && !this.widget.options?.bottomSheet) return false;
    const remaining = 1 - notification.extent;
    if (remaining < bottomSheetDominatesPercentage) {
      this.sheetFabScale.value = remaining * bottomSheetDominatesPercentage * 10;
      this.showBodyScrim(true, 1 - remaining / bottomSheetDominatesPercentage);
    } else this.clearSheetCoverage();

    if (sheet) {
      if (notification.extent === notification.minExtent && notification.shouldCloseOnMinExtent)
        this.closeSheet(sheet);
    } else if (notification.extent > notification.initialExtent + 1e-10) {
      if (!this.persistentSheetHistory) {
        const navigator = Navigator.maybeOf(this.context);
        const token = routeTokenOf(this.context);
        if (navigator && token) {
          const history = new LocalHistoryEntry({
            onRemove: () => {
              if (this.persistentSheetHistory !== history) return;
              this.persistentSheetHistory = null;
              if (!this.mounted) return;
              notification.reset();
              this.clearSheetCoverage();
            },
          });
          navigator.addLocalHistoryEntry(token, history);
          this.persistentSheetHistory = history;
        }
      }
    } else this.persistentSheetHistory?.remove();
    return false;
  }

  showBottomSheet({
    transitionAnimationController = null,
    sheetAnimationStyle = null,
    ...options
  }: ShowBottomSheetOptions): PersistentBottomSheetController {
    invariant(
      this.mounted,
      'unmounted-scaffold',
      'Showing a bottom sheet requires a mounted Scaffold',
    );
    invariant(
      this.widget.options?.bottomSheet == null,
      'scaffold-bottom-sheet-conflict',
      'Remove Scaffold.bottomSheet before calling showBottomSheet',
    );
    invariant(
      transitionAnimationController === null ||
        (transitionAnimationController.lowerBound === 0 &&
          transitionAnimationController.upperBound === 1 &&
          transitionAnimationController.duration !== null &&
          !this.sheets.some(({ animation }) => animation === transitionAnimationController)),
      'invalid-persistent-sheet-animation-controller',
      'A supplied bottom sheet controller requires an available [0, 1] animation and a duration',
    );
    const animation =
      transitionAnimationController ??
      BottomSheet.createAnimationController({ vsync: this, sheetAnimationStyle });
    const contentRevision = new ValueNotifier(0);
    let resolve!: () => void;
    const closed = new Promise<void>((complete) => {
      resolve = complete;
    });
    const key = new UniqueKey();
    const curve = sheetAnimationStyle?.curve ?? standardBottomSheetCurve;
    const reverseCurve = sheetAnimationStyle?.reverseCurve ?? curve;
    let dragStart: number | null = null;
    let split = false;
    const feature = new BottomSheet({
      ...options,
      key,
      animationController: animation,
      onDragStart: () => {
        dragStart = animation.value;
        split = false;
      },
      onDragEnd: () => {
        dragStart = animation.value;
        split = true;
      },
      onClosing: () => this.closeSheet(sheet),
      builder: () => new ListenableBuilder(contentRevision, options.builder),
    });
    const sheet: PresentedBottomSheet = {
      widget: new ListenableBuilder(
        animation,
        () => {
          const easing = animation.status === AnimationStatus.reverse ? reverseCurve : curve;
          const factor =
            dragStart === null
              ? easing.transform(animation.value)
              : split
                ? new Split(dragStart, { endCurve: easing }).transform(animation.value)
                : animation.value;
          return new ClipRect(
            new Align(
              new Semantics({
                container: true,
                onDismiss: () => this.closeSheet(sheet),
                child: new NotificationListener({
                  notificationType: DraggableScrollableNotification,
                  onNotification: (notification) => this.onSheetExtent(sheet, notification),
                  child: feature,
                }),
              }),
              { heightFactor: factor, alignment: AlignmentDirectional.topStart },
            ),
          );
        },
        key,
      ),
      animation,
      ownsAnimation: transitionAnimationController === null,
      contentRevision,
      resolve,
      statusChanged: (status) => {
        if (status === AnimationStatus.dismissed && sheet.closing) this.retireSheet(sheet);
      },
      history: null,
      closing: false,
    };
    try {
      const token = routeTokenOf(this.context);
      const navigator = Navigator.maybeOf(this.context);
      if (navigator && token) {
        sheet.history = new LocalHistoryEntry({
          onRemove: () => {
            sheet.history = null;
            this.closeSheet(sheet);
          },
        });
        navigator.addLocalHistoryEntry(token, sheet.history);
      }
      animation.addStatusListener(sheet.statusChanged);
      if (this.currentSheet !== null) this.closeSheet(this.currentSheet);
      this.setState(() => {
        this.currentSheet = sheet;
        this.sheets.push(sheet);
      });
      animation.forward({ from: 0 });
    } catch (error) {
      this.retireSheet(sheet);
      throw error;
    }
    return new PersistentBottomSheetController(
      feature,
      closed,
      () => this.closeSheet(sheet),
      (mutation) => {
        if (this.currentSheet !== sheet || sheet.closing) return;
        mutation();
        if (this.currentSheet === sheet && !sheet.closing) contentRevision.value++;
      },
    );
  }

  private closeSheet(sheet: PresentedBottomSheet): void {
    if (sheet.closing || !this.sheets.includes(sheet)) return;
    sheet.closing = true;
    if (this.currentSheet === sheet) this.clearSheetCoverage();
    const history = sheet.history;
    sheet.history = null;
    history?.remove();
    if (sheet.animation.isDismissed) this.retireSheet(sheet);
    else if (!sheet.animation.isAnimating || sheet.animation.status !== AnimationStatus.reverse)
      sheet.animation.reverse();
  }

  private retireSheet(sheet: PresentedBottomSheet, rebuild = true): void {
    sheet.closing = true;
    const index = this.sheets.indexOf(sheet);
    if (index >= 0) {
      const remove = () => {
        this.sheets.splice(index, 1);
        if (this.currentSheet === sheet) this.currentSheet = null;
      };
      if (rebuild && this.mounted) this.setState(remove);
      else remove();
    }
    sheet.animation.removeStatusListener(sheet.statusChanged);
    try {
      const history = sheet.history;
      sheet.history = null;
      history?.remove();
    } finally {
      if (sheet.ownsAnimation) sheet.animation.dispose();
      else if (sheet.animation.isAnimating) sheet.animation.stop();
      sheet.contentRevision.dispose();
      sheet.resolve();
    }
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
    return new Actions({
      actions: new Map([[DismissIntent, new DismissDrawerAction(this)]]),
      child: new Stack(layers),
    });
  }

  override didChangeDependencies(): void {
    super.didChangeDependencies();
    const messenger = ScaffoldMessenger.maybeOf(this.context);
    const route = routeTokenOf(this.context);
    if (messenger === this.messenger && this.unregister && route === this.presentationRoute) return;
    this.unregister?.();
    this.presentationSlot?.dispose();
    this.messenger = messenger;
    this.presentationRoute = route;
    this.unregister = messenger?._registerScaffold(this) ?? null;
    const parent = this.context.findAncestorStateOfType(ScaffoldState);
    this.presentationSlot =
      messenger && route && parent?.messenger !== messenger
        ? messenger._reservePresentationSlot(route)
        : null;
  }

  private presentationRoute: symbol | null = null;
  private presentationSlot: (Disposable & { readonly ordinal: number }) | null = null;

  override deactivate(): void {
    this.unregister?.();
    this.unregister = null;
    this.presentationSlot?.dispose();
    this.presentationSlot = null;
    super.deactivate();
  }

  override dispose(): void {
    this.unregister?.();
    this.unregister = null;
    this.presentationSlot?.dispose();
    this.presentationSlot = null;
    this.messenger = null;
    for (const sheet of [...this.sheets]) this.retireSheet(sheet, false);
    const history = this.persistentSheetHistory;
    this.persistentSheetHistory = null;
    history?.remove();
    this.scrimAnimation?.dispose();
    this.fabAnimations?.entranceRotation.dispose();
    this.fabAnimations?.exitRotation.dispose();
    this.fabVisibility.removeListener(this.updateFabGeometry);
    this.fabVisibility.removeStatusListener(this.fabVisibilityStatusChanged);
    this.fabVisibility.dispose();
    this.sheetFabScale.dispose();
    this.fabAnimations?.scale.removeListener(this.updateFabGeometry);
    this.fabMove?.dispose();
    this.geometry.dispose();
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const { options, body: suppliedBody, title, trailing } = this.widget;
    const parent = context.findAncestorStateOfType(ScaffoldState);
    const canPresent = parent?.messenger !== this.messenger;
    const active = canPresent && isCurrentRoute(context);
    const currentSnack = canPresent ? (this.messenger?.currentSnackBar ?? null) : null;
    const currentBanner = canPresent ? (this.messenger?.currentMaterialBanner ?? null) : null;
    const slot = this.presentationSlot;
    const navigator = slot && (currentSnack || currentBanner) ? Navigator.maybeOf(context) : null;
    const fly = navigator && Hero.hasController(context, navigator) ? navigator : null;
    const snack = active || fly ? currentSnack : null;
    const banner = active || fly ? currentBanner : null;
    const snackContent =
      snack && fly && slot
        ? new ScaffoldFeatureFlight(snack, fly, slot.ordinal, active, true)
        : snack;
    const bannerContent =
      banner && fly && slot
        ? new ScaffoldFeatureFlight(banner, fly, slot.ordinal, active, false)
        : banner;
    const declaredSheet = options?.bottomSheet;
    let bottomSheet: Widget | null = declaredSheet
      ? new NotificationListener({
          child: new BottomSheet({
            enableDrag: false,
            onClosing: () => {},
            builder: () => declaredSheet,
          }),
          notificationType: DraggableScrollableNotification,
          onNotification: (notification) => this.onSheetExtent(null, notification),
        })
      : null;
    if (this.sheets.length > 0) {
      const activeSheets = this.sheets.map(({ widget }) => widget);
      if (bottomSheet) activeSheets.push(bottomSheet);
      bottomSheet = new Stack(activeSheets, { alignment: Alignment.bottomCenter });
    }
    if (options) {
      const {
        appBar,
        bottomNavigationBar,
        persistentFooterButtons,
        floatingActionButton,
        floatingActionButtonLocation = null,
        resizeToAvoidBottomInset,
        extendBody = false,
        extendBodyBehindAppBar = false,
        backgroundColor,
      } = options;
      const padding = MediaQuery.maybePaddingOf(context);
      const keyboard =
        resizeToAvoidBottomInset === false
          ? 0
          : (MediaQuery.maybeViewInsetsOf(context)?.bottom ?? 0);
      const minInsets = (padding ?? EdgeInsets.zero).copyWith({ bottom: keyboard });
      const viewPadding =
        floatingActionButton || snack
          ? (MediaQuery.maybeViewPaddingOf(context) ?? padding ?? EdgeInsets.zero)
          : EdgeInsets.zero;
      const minViewPadding = keyboard ? viewPadding.copyWith({ bottom: 0 }) : viewPadding;
      const hasFooter = persistentFooterButtons != null;
      let body =
        extendBody || extendBodyBehindAppBar
          ? new LayoutBuilder((bodyContext, constraints) => {
              invariant(
                constraints instanceof BodyBoxConstraints,
                'missing-scaffold-body-geometry',
                'Extended Scaffold body requires its layout constraints',
              );
              const data = bodyContext.maybeDependOn(MediaQuery)?.data;
              if (!data) return suppliedBody;
              const padding = MediaQuery.paddingOf(bodyContext);
              return new MediaQuery(
                {
                  ...data,
                  padding: padding.copyWith({
                    top: extendBodyBehindAppBar
                      ? Math.max(padding.top, constraints.topWidgetsHeight)
                      : null,
                    bottom: extendBody
                      ? Math.max(padding.bottom, constraints.bottomWidgetsHeight)
                      : null,
                  }),
                },
                suppliedBody,
              );
            })
          : suppliedBody;
      if (padding !== null) {
        if (resizeToAvoidBottomInset !== false) {
          const innerBody = body;
          body = new Builder((bodyContext) =>
            MediaQuery.removeViewInsets({
              context: bodyContext,
              removeBottom: true,
              child: innerBody,
            }),
          );
        }
        body = MediaQuery.removePadding({
          context,
          removeTop: appBar != null || banner != null,
          removeBottom: bottomNavigationBar != null || hasFooter,
          child: body,
        });
      }
      const children = [new LayoutId(body, 'body')];
      if (this.showScrim && this.scrimAnimation) {
        const animation = this.scrimAnimation.view;
        children.push(
          new LayoutId(
            options.bottomSheetScrimBuilder?.(context, animation) ??
              new ListenableBuilder(animation, () => {
                const extentRemaining = bottomSheetDominatesPercentage * (1 - animation.value);
                const opacity = Math.max(
                  minBottomSheetScrimOpacity,
                  maxBottomSheetScrimOpacity -
                    extentRemaining * bottomSheetDominatesPercentage * 10,
                );
                return new BlockSemantics({
                  child: new AbsorbPointer(
                    new ColoredBox({
                      color: new Color(0xff000000).withOpacity(opacity).toARGB32(),
                    }),
                  ),
                });
              }),
            'bodyScrim',
          ),
        );
      }
      const appBarHeight = this.appBarMaxHeight ?? 0;
      if (appBar) {
        children.push(
          new LayoutId(
            new ConstrainedBox(
              FlexibleSpaceBar.createSettings({
                currentExtent: appBarHeight,
                child: appBar,
              }),
              new BoxConstraints(0, Infinity, 0, appBarHeight),
            ),
            'appBar',
          ),
        );
      }
      if (bannerContent)
        children.push(
          new LayoutId(
            padding === null
              ? bannerContent
              : MediaQuery.removePadding({
                  context,
                  child: bannerContent,
                  removeTop: appBar != null,
                  removeBottom: true,
                }),
            'materialBanner',
          ),
        );
      if (bottomNavigationBar)
        children.push(
          new LayoutId(
            padding === null
              ? bottomNavigationBar
              : MediaQuery.removePadding({ context, removeTop: true, child: bottomNavigationBar }),
            'bottomNavigationBar',
          ),
        );
      if (hasFooter) {
        const footer = new DecoratedBox(
          new SafeArea({
            top: false,
            bottom: bottomNavigationBar == null,
            maintainBottomViewPadding: resizeToAvoidBottomInset === false,
            child: new IntrinsicHeight(
              new Padding(
                EdgeInsets.all(8),
                new Align(
                  new OverflowBar({
                    children: persistentFooterButtons,
                    spacing: 8,
                    overflowAlignment: OverflowBarAlignment.end,
                  }),
                  {
                    alignment: options.persistentFooterAlignment ?? AlignmentDirectional.centerEnd,
                  },
                ),
              ),
            ),
          }),
          {
            decoration:
              options.persistentFooterDecoration ??
              new BoxDecoration({
                border: new Border({ top: Divider.createBorderSide(context, { width: 1 }) }),
              }),
          },
        );
        children.push(new LayoutId(footer, 'persistentFooter'));
      }
      if (bottomSheet) children.push(new LayoutId(bottomSheet, 'bottomSheet'));
      const fab = this.buildFab();
      if (fab) children.push(new LayoutId(fab, 'floatingActionButton'));
      if (snackContent) children.push(new LayoutId(snackContent, 'snackBar'));
      const surface = new MaterialSurface({
        color: backgroundColor ?? Theme.of(context).scaffoldBackgroundColor,
        child: new ScaffoldScope(
          this.geometry,
          this.hasDrawer,
          this.hasEndDrawer,
          this.buildDrawers(
            new ScrollNotificationObserver({
              child: new CustomMultiChildLayout(
                children,
                new ScaffoldLayout(
                  minInsets,
                  minViewPadding,
                  Directionality.maybeOf(context) ?? 'ltr',
                  floatingActionButton ? floatingActionButtonLocation : this.exitFabLocation,
                  floatingActionButton && this.fabMove && this.fabAnimations
                    ? {
                        previousLocation: this.previousFabLocation,
                        animator: this.fabAnimations.animator,
                        animation: this.fabMove.view,
                      }
                    : null,
                  snack !== null &&
                    (snack.behavior ?? SnackBarTheme.of(context).behavior) ===
                      SnackBarBehavior.floating,
                  banner !== null &&
                    (banner.elevation ?? MaterialBannerTheme.of(context).elevation ?? 0) !== 0,
                  extendBody,
                  extendBodyBehindAppBar,
                  this.geometry,
                ),
              ),
            }),
            options,
          ),
        ),
      });
      return options.primary === false
        ? surface
        : withStatusBarScrollTarget(context, surface, 1000, Curves.easeOutCirc);
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
    const main = bannerContent ? new Column([bannerContent, new Expanded(content)]) : content;
    const surface = new MaterialSurface({
      color: new Color(theme.background),
      child: new ScaffoldScope(
        this.geometry,
        false,
        false,
        snackContent || bottomSheet
          ? new Stack([
              main,
              ...(bottomSheet
                ? [new Positioned(bottomSheet, { left: 0, right: 0, bottom: 0 })]
                : []),
              ...(snackContent
                ? [new Positioned(snackContent, { left: 0, right: 0, bottom: 0 })]
                : []),
            ])
          : main,
      ),
    });
    return withStatusBarScrollTarget(context, surface, 1000, Curves.easeOutCirc);
  }
}

class DismissDrawerAction extends DismissAction {
  constructor(readonly scaffold: ScaffoldState) {
    super();
  }

  override isEnabled(_intent: DismissIntent): boolean {
    return (
      this.scaffold.isDrawerBarrierDismissible &&
      (this.scaffold.isDrawerOpen || this.scaffold.isEndDrawerOpen)
    );
  }

  override invoke(intent: DismissIntent): void {
    if (!this.isEnabled(intent)) return;
    this.scaffold.closeDrawer();
    this.scaffold.closeEndDrawer();
  }
}

class TransitionSnapshotFabLocation extends FloatingActionButtonLocation {
  constructor(
    private readonly begin: FloatingActionButtonLocation,
    private readonly end: FloatingActionButtonLocation,
    private readonly animator: FloatingActionButtonAnimator,
    private readonly progress: number,
  ) {
    super();
  }

  override getOffset(geometry: ScaffoldPrelayoutGeometry) {
    return this.animator.getOffset({
      begin: this.begin.getOffset(geometry),
      end: this.end.getOffset(geometry),
      progress: this.progress,
    });
  }
}

interface FabLayoutMotion {
  readonly previousLocation: FloatingActionButtonLocation | null;
  readonly animator: FloatingActionButtonAnimator;
  readonly animation: Animation<number>;
}

class BodyBoxConstraints extends BoxConstraints {
  constructor(
    width: number,
    height: number,
    readonly bottomWidgetsHeight: number,
    readonly topWidgetsHeight: number,
  ) {
    super(width, width, height, height);
  }

  override equals(other: unknown): boolean {
    return (
      other instanceof BodyBoxConstraints &&
      super.equals(other) &&
      this.bottomWidgetsHeight === other.bottomWidgetsHeight &&
      this.topWidgetsHeight === other.topWidgetsHeight
    );
  }

  override get hashCode(): number {
    return (31 * (31 * super.hashCode + this.bottomWidgetsHeight) + this.topWidgetsHeight) >>> 0;
  }
}

class ScaffoldLayout extends MultiChildLayoutDelegate {
  constructor(
    readonly minInsets: EdgeInsets,
    readonly minViewPadding: EdgeInsets,
    readonly direction: TextDirection,
    readonly fabLocation: FloatingActionButtonLocation | null,
    readonly fabMotion: FabLayoutMotion | null,
    readonly floatingSnack: boolean,
    readonly bodyBehindBanner: boolean,
    readonly extendBody: boolean,
    readonly extendBodyBehindAppBar: boolean,
    readonly geometry: ScaffoldGeometryNotifier,
  ) {
    super({ relayout: fabMotion?.animation ?? null });
  }

  override performLayout({ width, height }: Size): void {
    const fullWidth = new BoxConstraints(width, width, 0, height);
    let top = 0;
    if (this.hasChild('appBar')) {
      top = this.layoutChild('appBar', fullWidth).height;
      this.positionChild('appBar', { x: 0, y: 0 });
    }
    let bottom = 0;
    let barTop: number | null = null;
    if (this.hasChild('bottomNavigationBar')) {
      bottom = this.layoutChild('bottomNavigationBar', fullWidth).height;
      barTop = height - bottom;
      this.positionChild('bottomNavigationBar', { x: 0, y: barTop });
    }
    let bodyTop = this.extendBodyBehindAppBar ? 0 : top;
    if (this.hasChild('persistentFooter')) {
      bottom += this.layoutChild(
        'persistentFooter',
        new BoxConstraints(width, width, 0, Math.max(0, height - bodyTop - bottom)),
      ).height;
      this.positionChild('persistentFooter', { x: 0, y: height - bottom });
    }
    let bannerSize: Size = SourceSize.zero;
    if (this.hasChild('materialBanner')) {
      bannerSize = this.layoutChild(
        'materialBanner',
        new BoxConstraints(width, width, 0, height - top),
      );
      this.positionChild('materialBanner', { x: 0, y: top });
      if (!this.bodyBehindBanner) bodyTop += bannerSize.height;
    }
    const contentBottom = Math.max(0, height - Math.max(bottom, this.minInsets.bottom));
    const bodyBottom = Math.max(bodyTop, contentBottom);
    const extendedBottom = this.extendBody && this.minInsets.bottom <= bottom ? bottom : 0;
    const bodyHeight = Math.min(height - bodyTop, bodyBottom - bodyTop + extendedBottom);
    this.layoutChild(
      'body',
      new BodyBoxConstraints(width, bodyHeight, extendedBottom, top + bannerSize.height),
    );
    this.positionChild('body', { x: 0, y: bodyTop });
    if (this.hasChild('bodyScrim')) {
      this.layoutChild('bodyScrim', BoxConstraints.tight({ width, height: contentBottom }));
      this.positionChild('bodyScrim', { x: 0, y: 0 });
    }

    const hasSnack = this.hasChild('snackBar');
    const fixedSnack =
      hasSnack && !this.floatingSnack
        ? this.layoutChild(
            'snackBar',
            new BoxConstraints(width, width, 0, Math.max(0, bodyBottom - top)),
          )
        : SourceSize.zero;
    let snackBottom = this.floatingSnack
      ? Math.min(bodyBottom, height - this.minViewPadding.bottom)
      : bodyBottom;
    let sheetSize: Size = SourceSize.zero;
    if (this.hasChild('bottomSheet')) {
      sheetSize = this.layoutChild(
        'bottomSheet',
        new BoxConstraints(0, width, 0, Math.max(0, contentBottom - bodyTop)),
      );
      this.positionChild('bottomSheet', {
        x: (width - sheetSize.width) / 2,
        y: contentBottom - sheetSize.height,
      });
    }
    let buttonArea: Rect | null = null;
    if (this.hasChild('floatingActionButton')) {
      const button = this.layoutChild(
        'floatingActionButton',
        BoxConstraints.loose({ width, height }),
      );
      const location = this.fabLocation ?? FloatingActionButtonLocation.endFloat;
      const geometry = new ScaffoldPrelayoutGeometry({
        floatingActionButtonSize: new SourceSize(button.width, button.height),
        bottomSheetSize: new SourceSize(sheetSize.width, sheetSize.height),
        contentBottom,
        contentTop: top,
        minInsets: this.minInsets,
        minViewPadding: this.minViewPadding,
        scaffoldSize: new SourceSize(width, height),
        snackBarSize: new SourceSize(fixedSnack.width, fixedSnack.height),
        materialBannerSize: new SourceSize(bannerSize.width, bannerSize.height),
        textDirection: this.direction,
      });
      const motion = this.fabMotion;
      const end = location.getOffset(geometry);
      const offset =
        motion?.previousLocation && motion.animation.value < 1
          ? motion.animator.getOffset({
              begin: motion.previousLocation.getOffset(geometry),
              end,
              progress: motion.animation.value,
            })
          : end;
      const y = this.fabLocation ? offset.dy : Math.max(top, offset.dy);
      const x = this.fabLocation
        ? offset.dx
        : Math.max(0, Math.min(width - button.width, offset.dx));
      this.positionChild('floatingActionButton', { x, y });
      if (button.width > 0 && button.height > 0)
        buttonArea = Rect.fromLTWH(x, y, button.width, button.height);
      if (
        this.floatingSnack &&
        button.width > 0 &&
        button.height > 0 &&
        !isTopFabLocation(location)
      )
        snackBottom = Math.min(snackBottom, y);
    }
    if (hasSnack) {
      const snack = this.floatingSnack
        ? this.layoutChild(
            'snackBar',
            new BoxConstraints(width, width, 0, Math.max(0, snackBottom - top)),
          )
        : fixedSnack;
      this.positionChild('snackBar', { x: 0, y: snackBottom - snack.height });
    }
    this.geometry.updateLayout(barTop, buttonArea);
  }

  override shouldRelayout(old: ScaffoldLayout): boolean {
    return (
      !old.minInsets.equals(this.minInsets) ||
      !old.minViewPadding.equals(this.minViewPadding) ||
      old.direction !== this.direction ||
      old.fabLocation !== this.fabLocation ||
      old.fabMotion?.previousLocation !== this.fabMotion?.previousLocation ||
      old.fabMotion?.animator !== this.fabMotion?.animator ||
      old.floatingSnack !== this.floatingSnack ||
      old.bodyBehindBanner !== this.bodyBehindBanner ||
      old.extendBody !== this.extendBody ||
      old.extendBodyBehindAppBar !== this.extendBodyBehindAppBar ||
      old.geometry !== this.geometry
    );
  }
}
