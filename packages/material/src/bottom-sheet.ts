// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Material defaults and modal policy based on Flutter bottom_sheet.dart at
// 71e4717a61786faab4c7aa39825989305ed29e8a.
import { invariant } from '@nelyx/core/foundation/errors';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import type { ValueListenable } from '@nelyx/core/foundation/notifier';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import type { AnimationStyle } from '@nelyx/core/framework/animation/animation-style';
import { CurvedAnimation, ProxyAnimation } from '@nelyx/core/framework/animation/animations';
import { Split } from '@nelyx/core/framework/animation/curves';
import type { TickerProvider } from '@nelyx/core/framework/animation/ticker';
import { Tween } from '@nelyx/core/framework/animation/tween';
import type {
  DragEndDetails,
  DragStartDetails,
  DragUpdateDetails,
} from '@nelyx/core/framework/gestures/drag-details';
import { VerticalDragGestureRecognizer } from '@nelyx/core/framework/gestures/monodrag';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { ShapeBorder } from '@nelyx/core/framework/painting/borders';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Builder,
  Column,
  ConstrainedBox,
  DecoratedBox,
  Flexible,
  Padding,
  SizedBox,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { ControlInteraction } from '@nelyx/core/framework/widgets/control-interaction';
import { DisplayFeatureSubScreen } from '@nelyx/core/framework/widgets/display-feature-sub-screen';
import { DraggableScrollableNotification } from '@nelyx/core/framework/widgets/draggable-scrollable-sheet';
import { TraversalEdgeBehavior } from '@nelyx/core/framework/widgets/focus-traversal-policy';
import {
  Element,
  SingleChildRenderObjectWidget,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { InheritedTheme } from '@nelyx/core/framework/widgets/inherited-theme';
import type { CapturedThemes } from '@nelyx/core/framework/widgets/inherited-theme';
import { LayoutBuilder } from '@nelyx/core/framework/widgets/layout-builder';
import { Listener } from '@nelyx/core/framework/widgets/listener';
import { Navigator } from '@nelyx/core/framework/widgets/navigation';
import { NotificationListener } from '@nelyx/core/framework/widgets/notification-listener';
import { PageRouteBuilder } from '@nelyx/core/framework/widgets/pages';
import type { RouteSettings } from '@nelyx/core/framework/widgets/pages';
import {
  GestureRecognizerFactoryWithHandlers,
  RawGestureDetector,
} from '@nelyx/core/framework/widgets/raw-gesture-detector';
import { SafeArea } from '@nelyx/core/framework/widgets/safe-area';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SlideTransition } from '@nelyx/core/framework/widgets/transitions';
import {
  WidgetState,
  WidgetStateColor,
  emptyWidgetStateSet,
} from '@nelyx/core/framework/widgets/widget-state';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import { Offset } from '@nelyx/core/ui/offset';
import { Radius } from '@nelyx/core/ui/radius';
import { Size } from '@nelyx/core/ui/size';
import { Material } from './material.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Easing } from './motion.ts';
import { Scaffold } from './scaffold.ts';
import type { PersistentBottomSheetController, ShowBottomSheetOptions } from './scaffold.ts';
import { Theme } from './theme.ts';

export { PersistentBottomSheetController } from './scaffold.ts';
export type { ShowBottomSheetOptions } from './scaffold.ts';

const sheetShape = new RoundedRectangleBorder({
  borderRadius: BorderRadius.vertical({ top: Radius.circular(28) }),
});
const sheetConstraints = new BoxConstraints(0, 640);
const handleSize = new Size(32, 4);
const transparent = new Color(0x00000000);
const black54 = new Color(0x8a000000);
const enterDuration = 250;
const exitDuration = 200;
const modalCurve = Easing.legacyDecelerate;
const minFlingVelocity = 700;
const closeThreshold = 0.5;
const defaultMaximumHeightRatio = 9 / 16;
const slide = new Tween<Offset>({ begin: new Offset(0, 1), end: Offset.zero });

interface SheetAppearance {
  readonly backgroundColor?: Color | null;
  readonly elevation?: number | null;
  readonly shape?: ShapeBorder | null;
  readonly clipBehavior?: Clip | null;
  readonly constraints?: BoxConstraints | null;
  readonly showDragHandle?: boolean | null;
  readonly enableDrag?: boolean;
}

export type BottomSheetDragStartHandler = (details: DragStartDetails) => void;
export type BottomSheetDragEndHandler = (
  details: DragEndDetails,
  result: { readonly isClosing: boolean },
) => void;

export interface BottomSheetOptions extends SheetAppearance, WidgetOptions {
  readonly builder: (context: BuildContext) => Widget;
  readonly onClosing: () => void;
  readonly animationController?: AnimationController | null;
  readonly onDragStart?: BottomSheetDragStartHandler | null;
  readonly onDragEnd?: BottomSheetDragEndHandler | null;
  readonly shadowColor?: Color | null;
  readonly dragHandleColor?: Color | null;
  readonly dragHandleSize?: Size | null;
}

/** An inline Material surface. For a modal route, use showModalBottomSheet. */
export class BottomSheet extends StatelessWidget {
  constructor(readonly options: BottomSheetOptions) {
    super(options.key ?? null);
  }

  static createAnimationController({
    vsync,
    sheetAnimationStyle,
  }: {
    readonly vsync: TickerProvider;
    readonly sheetAnimationStyle?: AnimationStyle | null;
  }): AnimationController {
    return new AnimationController({
      vsync,
      duration: sheetAnimationStyle?.duration ?? enterDuration,
      reverseDuration: sheetAnimationStyle?.reverseDuration ?? exitDuration,
      debugLabel: 'BottomSheet',
    });
  }

  override build(context: BuildContext): Widget {
    const constraints =
      this.options.constraints ??
      Theme.of(context).bottomSheetTheme.constraints ??
      sheetConstraints;
    return new Align(new ConstrainedBox(new SheetSurface(this.options), constraints), {
      alignment: Alignment.bottomCenter,
      heightFactor: 1,
    });
  }
}

class SheetSurface extends StatefulWidget {
  constructor(
    readonly options: BottomSheetOptions,
    readonly modal = false,
    readonly onDragCancel?: () => void,
  ) {
    super();
  }

  override createState(): State<SheetSurface> {
    return new SheetSurfaceState();
  }
}

class SheetSurfaceState extends State<SheetSurface> {
  private readonly surfaceKey = new GlobalKey('BottomSheet surface');
  private dragController: AnimationController | null = null;
  private hovered = false;
  private readonly dragRecognizers = new Map([
    [
      VerticalDragGestureRecognizer,
      new GestureRecognizerFactoryWithHandlers(
        VerticalDragGestureRecognizer,
        () => {
          const context = this.context;
          invariant(
            context instanceof Element,
            'invalid-sheet-gesture-context',
            'BottomSheet drags require an Element',
          );
          return new VerticalDragGestureRecognizer({
            binding: context.owner.gestureBinding,
            debugOwner: this,
          });
        },
        (recognizer) => {
          recognizer.onlyAcceptDragOnThreshold = true;
          recognizer.onStart = this.startDrag;
          recognizer.onUpdate = this.updateDrag;
          recognizer.onEnd = this.endDrag;
          recognizer.onCancel = this.cancelDrag;
        },
      ),
    ],
  ]);

  private get height(): number {
    const render = this.surfaceKey.currentContext?.findRenderObject();
    return render instanceof RenderBox && render.hasSize ? render.size.height : 0;
  }

  private readonly startDrag = (details: DragStartDetails): void => {
    const { animationController, onDragStart } = this.widget.options;
    if (!animationController || animationController.status === AnimationStatus.reverse) return;
    this.setState(() => {
      this.dragController = animationController;
    });
    animationController.stop();
    onDragStart?.(details);
  };

  private readonly updateDrag = (details: DragUpdateDetails): void => {
    const animation = this.dragController;
    const height = this.height;
    if (animation && height > 0 && animation.status !== AnimationStatus.reverse)
      animation.value -= (details.primaryDelta ?? details.delta.dy) / height;
  };

  private readonly endDrag = (details: DragEndDetails): void => {
    const animation = this.dragController;
    if (!animation) return;
    this.setState(() => {
      this.dragController = null;
    });
    if (animation.status === AnimationStatus.reverse) return;
    const speed = details.velocity.pixelsPerSecond.dy;
    const isClosing = speed > minFlingVelocity || animation.value < closeThreshold;
    const { onDragEnd, onClosing } = this.widget.options;
    if (isClosing) {
      const height = this.height;
      if (animation.value > 0)
        animation.fling({
          velocity: speed > minFlingVelocity && height > 0 ? -speed / height : -1,
        });
    } else animation.forward();
    onDragEnd?.(details, { isClosing });
    if (!this.mounted || this.widget.options.animationController !== animation) return;
    if (isClosing) onClosing();
  };

  private readonly cancelDrag = (): void => {
    const animation = this.dragController;
    if (!animation) return;
    this.setState(() => {
      this.dragController = null;
    });
    this.widget.onDragCancel?.();
    if (animation.status !== AnimationStatus.reverse) animation.forward();
  };

  override didUpdateWidget(old: SheetSurface): void {
    super.didUpdateWidget(old);
    if (old.options.animationController !== this.widget.options.animationController)
      this.dragController = null;
  }

  private draggable(child: Widget): Widget {
    return new RawGestureDetector(child, {
      excludeFromSemantics: true,
      gestures: this.dragRecognizers,
    });
  }

  override build(context: BuildContext): Widget {
    const { colorScheme, bottomSheetTheme: theme } = Theme.of(context);
    const { options, modal } = this.widget;
    const canDrag = options.animationController != null;
    const dragBody = canDrag && options.enableDrag !== false;
    const showHandle =
      options.showDragHandle ?? ((options.enableDrag ?? true) && (theme.showDragHandle ?? false));
    let child: Widget = new Builder(options.builder);
    if (showHandle) {
      const size = options.dragHandleSize ?? theme.dragHandleSize ?? handleSize;
      const states = emptyWidgetStateSet();
      if (this.hovered) states.add(WidgetState.hovered);
      if (this.dragController) states.add(WidgetState.dragged);
      const resolve = (value: Color | null | undefined) =>
        value instanceof WidgetStateColor ? value.resolve(states) : value;
      const color =
        resolve(options.dragHandleColor) ??
        resolve(theme.dragHandleColor) ??
        new Color(colorScheme.onSurfaceVariant);
      let handle: Widget = new ControlInteraction(
        () =>
          new SizedBox(
            Math.max(48, size.width),
            Math.max(48, size.height),
            new Align(
              new DecoratedBox(
                new SizedBox(size.width, size.height),
                color.toARGB32(),
                size.height / 2,
              ),
            ),
          ),
        {
          onPressed: options.onClosing,
          onHover: (value) => {
            if (this.hovered !== value)
              this.setState(() => {
                this.hovered = value;
              });
          },
          semantics: {
            button: true,
            label: MaterialLocalizations.of(context).modalBarrierDismissLabel,
          },
        },
      );
      if (canDrag && !dragBody) handle = this.draggable(handle);
      child = new Column(
        [new Align(handle, { widthFactor: 1, heightFactor: 1 }), new Flexible(child)],
        {
          mainAxisSize: 'min',
          crossAlign: modal ? 'stretch' : 'center',
        },
      );
    }
    const material = new Material({
      key: this.surfaceKey,
      color:
        options.backgroundColor ??
        (modal ? theme.modalBackgroundColor : null) ??
        theme.backgroundColor ??
        new Color(colorScheme.surfaceContainerLow),
      elevation: options.elevation ?? (modal ? theme.modalElevation : null) ?? theme.elevation ?? 1,
      shape: options.shape ?? theme.shape ?? sheetShape,
      clipBehavior: options.clipBehavior ?? theme.clipBehavior ?? 'none',
      shadowColor: options.shadowColor ?? theme.shadowColor ?? transparent,
      surfaceTintColor: theme.surfaceTintColor ?? transparent,
      child: new NotificationListener({
        notificationType: DraggableScrollableNotification,
        onNotification: (notification) => {
          if (
            notification.depth === 0 &&
            notification.extent === notification.minExtent &&
            notification.shouldCloseOnMinExtent
          )
            this.widget.options.onClosing();
          return false;
        },
        child,
      }),
    });
    return dragBody ? this.draggable(material) : material;
  }
}

export interface ModalBottomSheetOptions extends SheetAppearance {
  readonly builder: (context: BuildContext) => Widget;
  readonly barrierColor?: Color | null;
  readonly barrierLabel?: string | null;
  /** Allows a tap on the scrim to dismiss the route. */
  readonly isDismissible?: boolean;
  /** Allows content to use the full available height. */
  readonly isScrollControlled?: boolean;
  readonly scrollControlDisabledMaxHeightRatio?: number;
  readonly useRootNavigator?: boolean;
  /** Avoid top and side safe insets; bottom safe padding is left to the content. */
  readonly useSafeArea?: boolean;
  readonly routeSettings?: RouteSettings | null;
  readonly requestFocus?: boolean | null;
  readonly anchorPoint?: Offset | null;
  readonly sheetAnimationStyle?: AnimationStyle | null;
  readonly transitionAnimationController?: AnimationController | null;
}

export interface ModalBottomSheetRouteOptions extends Omit<
  ModalBottomSheetOptions,
  'barrierColor' | 'useRootNavigator' | 'routeSettings'
> {
  readonly capturedThemes?: CapturedThemes | null;
  readonly modalBarrierColor?: Color | null;
  readonly barrierOnTapHint?: string | null;
  readonly settings?: RouteSettings | null;
}

export class ModalBottomSheetRoute<T = unknown> extends PageRouteBuilder<T> {
  readonly options: Readonly<ModalBottomSheetRouteOptions>;
  private readonly barrierInset = new ValueNotifier(0);
  private readonly updateBarrierInset = (height: number) => {
    if (this.navigatorContext !== null) this.barrierInset.value = height;
  };

  constructor(input: ModalBottomSheetRouteOptions) {
    const options = Object.freeze({ ...input });
    const {
      sheetAnimationStyle,
      requestFocus,
      modalBarrierColor,
      barrierLabel,
      barrierOnTapHint,
      settings,
      transitionAnimationController,
    } = options;
    const ratio = options.isScrollControlled
      ? 1
      : (options.scrollControlDisabledMaxHeightRatio ?? defaultMaximumHeightRatio);
    invariant(
      Number.isFinite(ratio) && ratio >= 0 && ratio <= 1,
      'invalid-sheet-height-ratio',
      'Sheet height ratio must be between 0 and 1',
    );
    super({
      opaque: false,
      fullscreenDialog: true,
      settings: settings ?? null,
      requestFocus: requestFocus ?? null,
      traversalEdgeBehavior: TraversalEdgeBehavior.closedLoop,
      barrierDismissible: options.isDismissible ?? true,
      barrierColor: modalBarrierColor ?? black54,
      barrierLabel: barrierLabel ?? null,
      barrierOnTapHint: barrierOnTapHint || null,
      transitionAnimationController: transitionAnimationController ?? null,
      transitionDuration:
        transitionAnimationController?.duration ?? sheetAnimationStyle?.duration ?? enterDuration,
      reverseTransitionDuration:
        transitionAnimationController?.reverseDuration ??
        transitionAnimationController?.duration ??
        sheetAnimationStyle?.reverseDuration ??
        exitDuration,
      pageBuilder: (_context, animation) => {
        const content = new DisplayFeatureSubScreen({
          anchorPoint: options.anchorPoint ?? null,
          child: new ModalSheetContent(
            options,
            animation,
            ratio,
            this.updateBarrierInset,
            (context) => {
              if (this.isCurrent) Navigator.of(context).pop();
            },
          ),
        });
        return options.capturedThemes?.wrap(content) ?? content;
      },
    });
    this.options = options;
  }

  get capturedThemes(): CapturedThemes | null {
    return this.options.capturedThemes ?? null;
  }
  get anchorPoint(): Offset | null {
    return this.options.anchorPoint ?? null;
  }
  get modalBarrierColor(): Color | null {
    return this.options.modalBarrierColor ?? null;
  }
  override get barrierSemanticsBottomInset(): ValueListenable<number> {
    return this.barrierInset;
  }
  get backgroundColor(): Color | null {
    return this.options.backgroundColor ?? null;
  }
  get elevation(): number | null {
    return this.options.elevation ?? null;
  }
  get shape(): ShapeBorder | null {
    return this.options.shape ?? null;
  }
  get clipBehavior(): Clip | null {
    return this.options.clipBehavior ?? null;
  }
  get constraints(): BoxConstraints | null {
    return this.options.constraints ?? null;
  }
  get isDismissible(): boolean {
    return this.barrierDismissible;
  }
  get enableDrag(): boolean {
    return this.options.enableDrag ?? true;
  }
  get isScrollControlled(): boolean {
    return this.options.isScrollControlled ?? false;
  }
  get scrollControlDisabledMaxHeightRatio(): number {
    return this.options.scrollControlDisabledMaxHeightRatio ?? defaultMaximumHeightRatio;
  }
  get showDragHandle(): boolean | null {
    return this.options.showDragHandle ?? null;
  }
  get useSafeArea(): boolean {
    return this.options.useSafeArea ?? false;
  }
  get sheetAnimationStyle(): AnimationStyle | null {
    return this.options.sheetAnimationStyle ?? null;
  }

  override canTransitionFrom(): boolean {
    return false;
  }
  override canTransitionTo(): boolean {
    return false;
  }
  override dispose(): void {
    super.dispose();
    this.barrierInset.dispose();
  }
}

class ModalSheetContent extends StatefulWidget {
  constructor(
    readonly options: ModalBottomSheetRouteOptions,
    readonly animation: Animation<number>,
    readonly ratio: number,
    readonly onHeightChanged: (height: number) => void,
    readonly onClosing: (context: BuildContext) => void,
  ) {
    super();
  }

  override createState(): State<ModalSheetContent> {
    return new ModalSheetContentState();
  }
}

class SheetSizeListener extends SingleChildRenderObjectWidget {
  constructor(
    child: Widget,
    readonly onHeightChanged: (height: number) => void,
  ) {
    super(child);
  }
  override createRenderObject(context: BuildContext): RenderSheetSizeListener {
    invariant(
      context instanceof Element,
      'invalid-sheet-layout-context',
      'Expected a sheet Element',
    );
    return new RenderSheetSizeListener(this.onHeightChanged, context.owner.postFrame);
  }
  override updateRenderObject(_context: BuildContext, render: RenderSheetSizeListener): void {
    render.onHeightChanged = this.onHeightChanged;
  }
}

class RenderSheetSizeListener extends RenderProxyBox {
  private height = -1;
  private queued = false;
  constructor(
    public onHeightChanged: (height: number) => void,
    private readonly postFrame: (callback: () => void) => void,
  ) {
    super();
  }
  protected override performLayout(constraints: BoxConstraints) {
    const size = super.performLayout(constraints);
    if (size.height !== this.height) {
      this.height = size.height;
      if (!this.queued) {
        this.queued = true;
        this.postFrame(() => {
          this.queued = false;
          if (this.attached) this.onHeightChanged(this.height);
        });
      }
    }
    return size;
  }
}

class ModalSheetContentState extends State<ModalSheetContent> {
  private readonly progress = new ProxyAnimation();
  private curve: CurvedAnimation | null = null;
  private position!: Animation<Offset>;

  private bindCurve(split?: number): void {
    const {
      animation,
      options: { sheetAnimationStyle },
    } = this.widget;
    const curve = sheetAnimationStyle?.curve ?? modalCurve;
    const reverseCurve = sheetAnimationStyle?.reverseCurve ?? modalCurve;
    const previous = this.curve;
    this.curve = new CurvedAnimation({
      parent: animation,
      curve: split === undefined ? curve : new Split(split, { endCurve: curve }),
      reverseCurve:
        split === undefined ? reverseCurve : new Split(split, { endCurve: reverseCurve }),
    });
    this.progress.parent = this.curve;
    previous?.dispose();
  }

  override initState(): void {
    super.initState();
    this.bindCurve();
    this.position = this.progress.drive(slide);
  }

  override didUpdateWidget(old: ModalSheetContent): void {
    super.didUpdateWidget(old);
    if (
      old.animation !== this.widget.animation ||
      old.options.sheetAnimationStyle !== this.widget.options.sheetAnimationStyle
    )
      this.bindCurve();
  }

  override dispose(): void {
    this.progress.parent = null;
    this.curve?.dispose();
    super.dispose();
  }

  override build(context: BuildContext): Widget {
    const { options, animation, ratio, onHeightChanged, onClosing } = this.widget;
    const app = Theme.of(context);
    const constraints = options.constraints ?? app.bottomSheetTheme.constraints ?? sheetConstraints;
    const surface = new SheetSurface(
      {
        ...options,
        animationController: animation instanceof AnimationController ? animation : null,
        onDragStart: () => {
          this.progress.parent = animation;
        },
        onDragEnd: () => this.bindCurve(animation.value),
        onClosing: () => onClosing(context),
      },
      true,
      () => this.bindCurve(animation.value),
    );
    const content = new LayoutBuilder(
      (_context, viewport) =>
        new ClipRect(
          new Align(
            new SlideTransition({
              position: this.position,
              child: new ConstrainedBox(
                new SheetSizeListener(
                  new Listener(new SizedBox(Infinity, undefined, surface), {
                    behavior: HitTestBehavior.opaque,
                  }),
                  onHeightChanged,
                ),
                constraints.enforce(
                  new BoxConstraints(0, viewport.maxWidth, 0, viewport.maxHeight * ratio),
                ),
              ),
            }),
            { alignment: Alignment.bottomCenter },
          ),
        ),
    );
    const safeContent = options.useSafeArea
      ? new SafeArea({ bottom: false, child: content })
      : MediaQuery.removePadding({ context, removeTop: true, child: content });
    const label =
      app.platform === 'iOS' || app.platform === 'macOS'
        ? ''
        : MaterialLocalizations.of(context).dialogLabel;
    return new Semantics({
      scopesRoute: true,
      namesRoute: true,
      label,
      explicitChildNodes: true,
      child: new Padding(
        EdgeInsets.only({ bottom: MediaQuery.viewInsetsOf(context).bottom }),
        safeContent,
      ),
    });
  }
}

/** Pushes a non-opaque sheet and returns its route result. */
export function showModalBottomSheet<T = unknown>(
  context: BuildContext,
  {
    barrierColor,
    barrierLabel,
    useRootNavigator = false,
    routeSettings,
    ...options
  }: ModalBottomSheetOptions,
): Promise<T | undefined> {
  const navigator = Navigator.of(context, { rootNavigator: useRootNavigator });
  let navigatorContext: BuildContext | undefined;
  if (context.widget instanceof Navigator && context.widget.controller === navigator) {
    navigatorContext = context;
  } else {
    context.visitAncestorElements((ancestor) => {
      if (!(ancestor.widget instanceof Navigator) || ancestor.widget.controller !== navigator)
        return true;
      navigatorContext = ancestor;
      return false;
    });
  }
  const themes = InheritedTheme.capture(context, navigatorContext);
  const localizations = MaterialLocalizations.of(context);
  return navigator.push(
    new ModalBottomSheetRoute<T>({
      ...options,
      settings: routeSettings ?? null,
      capturedThemes: themes,
      modalBarrierColor:
        barrierColor ?? Theme.of(context).bottomSheetTheme.modalBarrierColor ?? null,
      barrierLabel: barrierLabel ?? localizations.scrimLabel,
      barrierOnTapHint: localizations.scrimOnTapHint(localizations.bottomSheetLabel),
    }),
  );
}

export function showBottomSheet(
  context: BuildContext,
  options: ShowBottomSheetOptions,
): PersistentBottomSheetController {
  return Scaffold.of(context).showBottomSheet(options);
}
