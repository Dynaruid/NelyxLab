// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/sliding_segmented_control.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { Tween } from '@nelyx/core/framework/animation/tween';
import { TweenSequence } from '@nelyx/core/framework/animation/tween-sequence';
import { TweenSequenceItem } from '@nelyx/core/framework/animation/tween-sequence-item';
import { GestureArenaTeam } from '@nelyx/core/framework/gestures/team';
import { TapGestureRecognizer } from '@nelyx/core/framework/gestures/tap';
import { HorizontalDragGestureRecognizer } from '@nelyx/core/framework/gestures/monodrag';
import { LongPressGestureRecognizer } from '@nelyx/core/framework/gestures/long-press';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import {
  SpringDescription,
  SpringSimulation,
} from '@nelyx/core/framework/physics/spring-simulation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { ShapeBorderClipper } from '@nelyx/core/framework/rendering/shape-border-clipper';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { Directionality, MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { Center, Padding, Stack, Text } from '@nelyx/core/framework/widgets/basic';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import {
  Element,
  MultiChildRenderObjectWidget,
  State,
  StatefulWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { ClipPath } from '@nelyx/core/framework/widgets/clip';
import {
  AnimatedDefaultTextStyle,
  AnimatedOpacity,
} from '@nelyx/core/framework/widgets/implicit-animations';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { Opacity } from '@nelyx/core/framework/widgets/opacity';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { RadioGroup } from '@nelyx/core/framework/widgets/radio-group';
import {
  RawGestureDetector,
  GestureRecognizerFactoryWithHandlers,
} from '@nelyx/core/framework/widgets/raw-gesture-detector';
import type {
  GestureRecognizerFactories,
  GestureRecognizerFactory,
  GestureRecognizerType,
} from '@nelyx/core/framework/widgets/raw-gesture-detector';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import {
  SingleTickerProviderStateMixin,
  TickerProviderStateMixin,
} from '@nelyx/core/framework/widgets/ticker-provider';
import { ScaleTransition } from '@nelyx/core/framework/widgets/transitions';
import { SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { Offset } from '@nelyx/core/ui/offset';
import { Paint } from '@nelyx/core/ui/paint';
import { Rect } from '@nelyx/core/ui/rect';
import { FontWeight } from '@nelyx/core/ui/typography';
import type { TextBaseline } from '@nelyx/core/ui/typography';
import { SegmentFocusButton } from './internal/segmented-control-focus.ts';
import type { SegmentFocusButtonState } from './internal/segmented-control-focus.ts';
import { CupertinoColors, CupertinoDynamicColor } from './colors.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';

const defaultThumbColor = CupertinoDynamicColor.withBrightness({
  color: new Color(0xffffffff),
  darkColor: new Color(0xff636366),
});
const defaultPadding = EdgeInsets.symmetric({ horizontal: 3, vertical: 2 });
const labelPadding = EdgeInsets.symmetric({ horizontal: 10 });
const separatorColor = new Color(0x4d8e8e93);
const separatorWidth = 1;
const separatorRadius = separatorWidth / 2;
const separatorInset = 5;
const minThumbScale = 0.95;
const momentaryScale = 1.05;
const springDuration = 412;
const opacityDuration = 470;
const highlightDuration = 200;
const disabledContentColor = 0x737a7a7a;
const thumbInsets = EdgeInsets.symmetric({ horizontal: 1 });
const trackShape = new RoundedSuperellipseBorder({ borderRadius: BorderRadius.circular(9) });
const thumbShape = new RoundedSuperellipseBorder({ borderRadius: BorderRadius.circular(7) });
const thumbStroke = new RoundedSuperellipseBorder({ borderRadius: BorderRadius.circular(7.5) });
const thumbOutline = new Paint({ color: 0x0a000000 });
const thumbShadows = [
  new BoxShadow({ color: 0x1f000000, offset: new Offset(0, 3), blurRadius: 8 }),
  new BoxShadow({ color: 0x0a000000, offset: new Offset(0, 3), blurRadius: 1 }),
];
const spring = new SpringSimulation(
  new SpringDescription({ mass: 1, stiffness: 503.551, damping: 44.8799 }),
  0,
  1,
  0,
  { snapToEnd: true },
);
function playSpring(controller: AnimationController, reduceMotion: boolean): void {
  if (reduceMotion) controller.value = 1;
  else controller.animateWith(spring);
}
const none = new Set<never>();

export interface CupertinoSlidingSegmentedControlOptions<T extends {}> extends WidgetOptions {
  readonly children: ReadonlyMap<T, Widget>;
  readonly onValueChanged: (value: T | null) => void;
  readonly disabledChildren?: ReadonlySet<T>;
  readonly groupValue?: T | null;
  readonly backgroundColor?: CupertinoColor;
  readonly proportionalWidth?: boolean;
  readonly thumbColor?: CupertinoColor;
  readonly padding?: EdgeInsetsGeometry;
  readonly isMomentary?: boolean;
}

export class CupertinoSlidingSegmentedControl<T extends {}> extends StatefulWidget {
  readonly children: ReadonlyMap<T, Widget>;
  readonly onValueChanged: (value: T | null) => void;
  readonly disabledChildren: ReadonlySet<T>;
  readonly groupValue: T | null;
  readonly backgroundColor: CupertinoColor;
  readonly proportionalWidth: boolean;
  readonly thumbColor: CupertinoColor;
  readonly padding: EdgeInsetsGeometry;
  readonly isMomentary: boolean;

  constructor({
    children,
    onValueChanged,
    disabledChildren = none,
    groupValue = null,
    backgroundColor = CupertinoColors.tertiarySystemFill,
    proportionalWidth = false,
    thumbColor = defaultThumbColor,
    padding = defaultPadding,
    isMomentary = false,
    key = null,
  }: CupertinoSlidingSegmentedControlOptions<T>) {
    super(key);
    if (
      children.size < 2 ||
      (groupValue !== null && ![...children.keys()].some((value) => valueEquals(value, groupValue)))
    ) {
      throw new RangeError(
        'CupertinoSlidingSegmentedControl requires two or more segments and a valid groupValue',
      );
    }
    this.children = children;
    this.onValueChanged = onValueChanged;
    this.disabledChildren = disabledChildren;
    this.groupValue = groupValue;
    this.backgroundColor = backgroundColor;
    this.proportionalWidth = proportionalWidth;
    this.thumbColor = thumbColor;
    this.padding = padding;
    this.isMomentary = isMomentary;
  }

  createState(): State<CupertinoSlidingSegmentedControl<T>> {
    return new SlidingControlState<T>();
  }
}

class SegmentAppearance extends StatefulWidget {
  constructor(
    readonly child: Widget,
    readonly highlighted: boolean,
    readonly fades: boolean,
    readonly scales: boolean,
    readonly momentary: boolean,
    readonly enabled: boolean,
    readonly reduceMotion: boolean,
    readonly alignment: Alignment,
  ) {
    super();
  }
  override createState(): State<SegmentAppearance> {
    return new SegmentAppearanceState();
  }
}
class SegmentAppearanceState extends SingleTickerProviderStateMixin<SegmentAppearance> {
  private controller!: AnimationController;
  private scale!: Animation<number>;
  override initState(): void {
    super.initState();
    this.controller = new AnimationController({
      vsync: this,
      duration: opacityDuration,
      value: this.widget.scales ? 1 : 0,
    });
    this.scale = this.controller.drive(new Tween({ begin: 1, end: minThumbScale }));
  }
  override didUpdateWidget(old: SegmentAppearance): void {
    super.didUpdateWidget(old);
    const appearance = this.widget;
    if (old.scales === appearance.scales && old.momentary === appearance.momentary) return;
    const current = this.scale.value;
    const scale =
      appearance.momentary && appearance.scales
        ? new TweenSequence([
            new TweenSequenceItem({
              tween: new Tween({ begin: current, end: momentaryScale }),
              weight: 1,
            }),
            new TweenSequenceItem({
              tween: new Tween({ begin: momentaryScale, end: 1 }),
              weight: 1,
            }),
          ])
        : new Tween({ begin: current, end: appearance.scales ? minThumbScale : 1 });
    this.scale = this.controller.drive(scale);
    playSpring(this.controller, appearance.reduceMotion);
  }
  override build(context: BuildContext): Widget {
    const appearance = this.widget;
    const inherited =
      DefaultTextStyle.of(context)?.style ??
      new TextStyle({
        color: resolveCupertinoColor(CupertinoColors.label, context).toARGB32(),
      });
    const style = inherited.merge(
      new TextStyle({
        fontSize: 13,
        fontWeight: appearance.highlighted ? FontWeight.w600 : FontWeight.w500,
        ...(appearance.enabled ? {} : { color: disabledContentColor }),
      }),
    );
    const visual = new AnimatedOpacity({
      opacity: appearance.fades ? 0.2 : 1,
      duration: appearance.reduceMotion ? 0 : opacityDuration,
      curve: Curves.ease,
      child: new AnimatedDefaultTextStyle({
        style,
        duration: appearance.reduceMotion ? 0 : highlightDuration,
        curve: Curves.ease,
        child: new ScaleTransition({
          scale: this.scale,
          alignment: appearance.alignment,
          child: appearance.child,
        }),
      }),
    });
    const child = appearance.child;
    if (!(child instanceof Text) || child.constructor !== Text) return visual;
    const { key: _key, ...options } = child.options;
    const measure = new DefaultTextStyle(
      inherited.merge(new TextStyle({ fontSize: 13, fontWeight: FontWeight.w600 })),
      new Text(child.text, options),
    );
    return new Stack([visual, new IgnorePointer(new Opacity(measure, { opacity: 0 }))], {
      alignment: Alignment.center,
    });
  }
  override dispose(): void {
    this.controller.dispose();
    super.dispose();
  }
}

class SlidingControlState<T extends {}> extends TickerProviderStateMixin<
  CupertinoSlidingSegmentedControl<T>
> {
  private readonly renderKey = new GlobalKey('Cupertino sliding segmented control');
  private readonly radioGroup = {};
  private arenaTeam!: GestureArenaTeam;
  private highlighted: T | null = null;
  private pressed: T | null = null;
  private draggingThumb = false;
  private blockedDrag = false;
  private reduceMotion = false;
  private segmentKeys: { value: T; key: GlobalKey<SegmentFocusButtonState> }[] = [];
  private thumbProgress!: AnimationController;
  private scaleController!: AnimationController;
  private thumbScale!: Animation<number>;
  private readonly separators: AnimationController[] = [];
  private readonly separatorTargets: number[] = [];
  get render(): SlidingRender | null {
    const render = this.renderKey.currentContext?.findRenderObject();
    return render instanceof SlidingRender && render.hasSize ? render : null;
  }
  private readonly repaint = () => this.render?.markNeedsPaint();

  override initState(): void {
    super.initState();
    this.highlighted = this.widget.groupValue;
    this.thumbProgress = new AnimationController({
      vsync: this,
      value: 1,
      duration: springDuration,
      disableAnimations: () => this.reduceMotion,
    });
    this.thumbProgress.addListener(this.repaint);
    this.scaleController = new AnimationController({ vsync: this, duration: springDuration });
    this.scaleController.addListener(this.repaint);
    this.thumbScale = this.scaleController.drive(new Tween({ begin: 1, end: 1 }));
    const context = this.context;
    invariant(
      context instanceof Element,
      'invalid-sliding-segments-context',
      'Segment gesture recognizers require an Element',
    );
    this.arenaTeam = new GestureArenaTeam(context.owner.gestureBinding.gestureArena);
  }

  override didUpdateWidget(old: CupertinoSlidingSegmentedControl<T>): void {
    super.didUpdateWidget(old);
    if (!this.draggingThumb) this.highlighted = this.widget.groupValue;
  }

  override dispose(): void {
    this.arenaTeam.dispose();
    for (const separator of this.separators) separator.dispose();
    this.thumbProgress.dispose();
    this.scaleController.dispose();
    super.dispose();
  }

  private disabled(value: T): boolean {
    return [...this.widget.disabledChildren].some((item) => valueEquals(item, value));
  }

  private choose(value: T, invokeSelected = false): void {
    if (!this.mounted || this.disabled(value)) return;
    const target = this.segmentKeys.find((entry) => valueEquals(entry.value, value));
    if (!target) return;
    target.key.currentState?.focusNode.requestFocus();
    if (invokeSelected || !valueEquals(value, this.widget.groupValue))
      this.widget.onValueChanged(value);
  }

  private at(position: Offset): T | null {
    const render = this.render;
    if (render === null) return null;
    const local = render.globalToLocal(position);
    const dx = Math.max(-local.x, local.x - render.size.width, 0);
    const dy = Math.max(-local.y, local.y - render.size.height, 0);
    if (!this.draggingThumb && dx * dx + dy * dy > 2500) return null;
    const index = render.closestSegment(local.x);
    return [...this.widget.children.keys()][index] ?? null;
  }

  private setPressed(value: T | null, highlighted = this.highlighted): void {
    if (!valueEquals(value, this.pressed) || !valueEquals(highlighted, this.highlighted))
      this.setState(() => {
        this.pressed = value;
        this.highlighted = highlighted;
      });
  }

  private reset(): void {
    const changed = this.draggingThumb;
    this.draggingThumb = false;
    this.blockedDrag = false;
    if (changed) this.scaleThumb(false);
    if (changed || this.pressed !== null)
      this.setState(() => {
        this.pressed = null;
      });
  }

  private scaleThumb(pressed: boolean): void {
    this.thumbScale = this.scaleController.drive(
      new Tween({
        begin: this.thumbScale.value,
        end: pressed ? minThumbScale : 1,
      }),
    );
    playSpring(this.scaleController, this.reduceMotion);
  }

  private syncSeparators(count: number, highlighted: number): void {
    for (let index = 0; index < count - 1; index++) {
      const target =
        highlighted >= 0 && (highlighted === index || highlighted === index + 1) ? 0 : 1;
      const controller = this.separators[index];
      if (!controller) {
        const separator = new AnimationController({
          vsync: this,
          duration: springDuration,
          value: target,
          disableAnimations: () => this.reduceMotion,
        });
        separator.addListener(this.repaint);
        this.separators.push(separator);
      } else if (target !== this.separatorTargets[index]) {
        if (this.reduceMotion) controller.value = target;
        else controller.animateTo(target, { duration: springDuration, curve: Curves.ease });
      }
      this.separatorTargets[index] = target;
    }
    for (const removed of this.separators.splice(count - 1)) removed.dispose();
    this.separatorTargets.length = count - 1;
  }

  private gestureFactories(context: Element): GestureRecognizerFactories {
    const binding = context.owner.gestureBinding;
    const settings = MediaQuery.maybeGestureSettingsOf(context);
    const gestures = new Map<GestureRecognizerType, GestureRecognizerFactory>();
    gestures.set(
      HorizontalDragGestureRecognizer,
      new GestureRecognizerFactoryWithHandlers(
        HorizontalDragGestureRecognizer,
        () => {
          const drag = new HorizontalDragGestureRecognizer({ binding, debugOwner: this });
          drag.team = this.arenaTeam;
          this.arenaTeam.captain = drag;
          return drag;
        },
        (drag) => {
          drag.gestureSettings = settings;
          drag.onDown = ({ globalPosition }) => {
            const value = this.at(globalPosition);
            this.blockedDrag = value === null || this.disabled(value);
            this.draggingThumb = !this.blockedDrag && valueEquals(value, this.highlighted);
            if (this.draggingThumb) this.scaleThumb(true);
            if (!this.blockedDrag) this.setPressed(value);
          };
          drag.onUpdate = ({ globalPosition }) => {
            if (this.blockedDrag) return;
            const value = this.at(globalPosition);
            if (value === null || !this.disabled(value))
              this.setPressed(value, this.draggingThumb ? value : this.highlighted);
          };
          drag.onEnd = () => {
            const value = this.pressed;
            if (value !== null && !this.disabled(value)) this.setPressed(value, value);
            this.reset();
            if (value !== null) this.choose(value);
          };
          drag.onCancel = () => this.reset();
        },
      ),
    );
    gestures.set(
      LongPressGestureRecognizer,
      new GestureRecognizerFactoryWithHandlers(
        LongPressGestureRecognizer,
        () => {
          const longPress = new LongPressGestureRecognizer({ binding, debugOwner: this });
          longPress.team = this.arenaTeam;
          return longPress;
        },
        (longPress) => {
          longPress.gestureSettings = settings;
          // Acceptance is handled by the drag recognizer, the team's captain.
          longPress.onLongPress = () => {};
        },
      ),
    );
    gestures.set(
      TapGestureRecognizer,
      new GestureRecognizerFactoryWithHandlers(
        TapGestureRecognizer,
        () => new TapGestureRecognizer({ binding, debugOwner: this }),
        (tap) => {
          tap.gestureSettings = settings;
          tap.onTapUp = ({ globalPosition }) => {
            if (this.draggingThumb) return;
            const value = this.at(globalPosition);
            this.reset();
            if (value !== null) this.choose(value);
          };
        },
      ),
    );
    return gestures;
  }

  build(context: BuildContext): Widget {
    invariant(
      context instanceof Element,
      'invalid-sliding-segments-context',
      'Segment gesture recognizers require an Element',
    );
    const widget = this.widget;
    this.reduceMotion = context.maybeDependOn(MediaQuery)?.data.disableAnimations ?? false;
    const rtl = Directionality.of(context) === 'rtl';
    const visual = this.highlighted;
    const values = [...widget.children.keys()];
    this.segmentKeys = values.map((value) => ({
      value,
      key:
        this.segmentKeys.find((entry) => valueEquals(entry.value, value))?.key ??
        new GlobalKey('Cupertino segment'),
    }));
    const highlighted = widget.isMomentary
      ? -1
      : values.findIndex((value) => valueEquals(value, visual));
    this.syncSeparators(values.length, highlighted);
    const children = [...widget.children].map(([value, child], index) => {
      const selected = valueEquals(widget.groupValue, value);
      const pressed = valueEquals(this.pressed, value);
      const disabled = this.disabled(value);
      const highlighted = valueEquals(visual, value);
      const physicalIndex = rtl ? values.length - 1 - index : index;
      const alignment =
        physicalIndex === 0
          ? Alignment.centerLeft
          : physicalIndex === values.length - 1
            ? Alignment.centerRight
            : Alignment.center;
      const activate = () => this.choose(value, true);
      const appearance = new SegmentAppearance(
        child,
        highlighted && !widget.isMomentary,
        pressed && !highlighted && !disabled && !widget.isMomentary,
        pressed && !disabled && ((highlighted && this.draggingThumb) || widget.isMomentary),
        widget.isMomentary,
        !disabled,
        this.reduceMotion,
        alignment,
      );
      const content = new Semantics({
        button: true,
        selected,
        enabled: !disabled,
        inMutuallyExclusiveGroup: true,
        onTap: disabled ? null : activate,
        child: new Padding(labelPadding, new Center(appearance)),
      });
      return new SegmentFocusButton(
        this.radioGroup,
        index,
        !disabled,
        FoundationPlatform.isWeb
          ? new MouseRegion(content, { cursor: SystemMouseCursors.click })
          : content,
        this.segmentKeys[index]!.key,
        activate,
      );
    });
    const strip = new SlidingStrip(children, this.renderKey, {
      rtl,
      highlighted,
      proportional: widget.proportionalWidth,
      padding: widget.padding.resolve(rtl ? 'rtl' : 'ltr'),
      thumb: resolveCupertinoColor(widget.thumbColor, context),
      background: resolveCupertinoColor(widget.backgroundColor, context),
      animation: this.thumbProgress,
      scale: this.thumbScale,
      separators: [...this.separators],
      reduceMotion: this.reduceMotion,
    });
    const selectedIndex = values.findIndex((value) => valueEquals(value, widget.groupValue));
    return new RadioGroup({
      typeToken: this.radioGroup,
      groupValue: selectedIndex === -1 ? null : selectedIndex,
      onChanged: (index) => {
        const value = index === null ? undefined : values[index];
        if (value !== undefined) this.choose(value);
      },
      child: new ClipPath(
        new RawGestureDetector(strip, {
          behavior: HitTestBehavior.opaque,
          excludeFromSemantics: true,
          gestures: this.gestureFactories(context),
        }),
        { clipper: new ShapeBorderClipper({ shape: trackShape }) },
      ),
    });
  }
}

interface StripOptions {
  readonly rtl: boolean;
  readonly highlighted: number;
  readonly proportional: boolean;
  readonly padding: EdgeInsets;
  readonly thumb: Color;
  readonly background: Color;
  readonly animation: AnimationController;
  readonly scale: Animation<number>;
  readonly separators: readonly AnimationController[];
  readonly reduceMotion: boolean;
}

class SlidingStrip extends MultiChildRenderObjectWidget {
  constructor(
    children: readonly Widget[],
    key: GlobalKey,
    readonly options: StripOptions,
  ) {
    super(children, { key });
  }
  createRenderObject(): SlidingRender {
    return new SlidingRender(this.options);
  }
  updateRenderObject(_context: BuildContext, render: SlidingRender): void {
    render.update(this.options);
  }
}

class SlidingRender extends RenderBox {
  private thumbFrom: Rect | null = null;
  private thumbTarget: Rect | null = null;
  private thumbStart = 0;
  constructor(private options: StripOptions) {
    super();
  }

  update(options: StripOptions): void {
    const old = this.options;
    const current = this.currentThumb();
    this.options = options;
    if (
      old.rtl !== options.rtl ||
      old.proportional !== options.proportional ||
      !old.padding.equals(options.padding)
    )
      this.markNeedsLayout();
    if (old.highlighted !== options.highlighted) {
      this.thumbFrom = current;
      this.thumbTarget = this.targetThumb();
      this.thumbStart = 0;
      if (this.thumbFrom && this.thumbTarget) playSpring(options.animation, options.reduceMotion);
    }
    this.markNeedsPaint();
  }

  private measure(constraints: BoxConstraints): { size: Size; widths: number[]; gap: number } {
    const { padding, proportional } = this.options;
    const count = this.children.length;
    const inner = constraints.deflate(padding);
    const gap = Math.min(separatorWidth, inner.maxWidth / Math.max(count - 1, 1));
    const separators = Math.max(0, count - 1) * gap;
    const intrinsic = this.children.map((child) => child.getMaxIntrinsicWidth(Infinity));
    const maximum = Math.max(0, ...intrinsic);
    const requested = proportional ? intrinsic : intrinsic.map(() => maximum);
    const sum = requested.reduce((total, width) => total + width, 0);
    const available = Math.max(0, inner.constrainWidth(sum + separators) - separators);
    const widths = requested.map((width) =>
      sum > 0 ? (available * width) / sum : available / count,
    );
    const height = Math.max(
      28,
      ...this.children.map((child, i) => child.getMaxIntrinsicHeight(widths[i]!)),
    );
    return {
      size: constraints.constrain({
        width: available + separators + padding.horizontal,
        height: height + padding.vertical,
      }),
      widths,
      gap,
    };
  }

  protected override computeDryLayout(constraints: BoxConstraints): Size {
    return this.measure(constraints).size;
  }
  protected override computeMinIntrinsicWidth(height: number): number {
    return this.intrinsicWidth(height, (child, cross) => child.getMinIntrinsicWidth(cross));
  }
  protected override computeMaxIntrinsicWidth(height: number): number {
    return this.intrinsicWidth(height, (child, cross) => child.getMaxIntrinsicWidth(cross));
  }
  protected override computeMinIntrinsicHeight(width: number): number {
    return this.measure(new BoxConstraints(0, width)).size.height;
  }
  protected override computeMaxIntrinsicHeight(width: number): number {
    return this.computeMinIntrinsicHeight(width);
  }

  private highestBaseline(
    query: (child: RenderBox<RenderObject>, index: number) => number | null,
  ): number | null {
    let result: number | null = null;
    this.children.forEach((child, index) => {
      const offset = query(child, index);
      if (offset !== null) result = result === null ? offset : Math.min(result, offset);
    });
    return result;
  }

  protected override computeDryBaseline(
    constraints: BoxConstraints,
    baseline: TextBaseline,
  ): number | null {
    const { size, widths } = this.measure(constraints);
    const { padding } = this.options;
    const height = Math.max(0, size.height - padding.vertical);
    const result = this.highestBaseline((child, index) =>
      child.getDryBaseline(BoxConstraints.tightFor(widths[index]!, height), baseline),
    );
    return result === null ? null : result + padding.top;
  }

  protected override computeDistanceToActualBaseline(baseline: TextBaseline): number | null {
    return this.highestBaseline((child) => {
      const result = child.getDistanceToActualBaseline(baseline);
      return result === null ? null : result + child.layoutOffset.y;
    });
  }

  private intrinsicWidth(
    height: number,
    query: (child: RenderBox<RenderObject>, cross: number) => number,
  ): number {
    const { padding, proportional } = this.options;
    const widths = this.children.map((child) =>
      query(child, Math.max(0, height - padding.vertical)),
    );
    const childWidth = proportional
      ? widths.reduce((total, width) => total + width, 0)
      : Math.max(0, ...widths) * widths.length;
    return childWidth + Math.max(0, widths.length - 1) * separatorWidth + padding.horizontal;
  }
  protected override performLayout(constraints: BoxConstraints): Size {
    const current = this.currentThumb();
    const { size, widths, gap } = this.measure(constraints);
    const { rtl, padding } = this.options;
    let x = rtl ? size.width - padding.right : padding.left;
    this.children.forEach((child, i) => {
      const width = widths[i]!;
      child.layout(BoxConstraints.tightFor(width, Math.max(0, size.height - padding.vertical)), {
        parentUsesSize: true,
      });
      child.layoutOffset = { x: rtl ? x - width : x, y: padding.top };
      x += (rtl ? -1 : 1) * (width + gap);
    });
    const target = this.targetThumb();
    if (
      current &&
      target &&
      this.options.animation.isAnimating &&
      !target.equals(this.thumbTarget)
    ) {
      this.thumbFrom = current;
      this.thumbStart = this.options.animation.value;
    }
    this.thumbTarget = target;
    return size;
  }

  closestSegment(x: number): number {
    let best = 0,
      distance = Infinity;
    this.children.forEach((child, i) => {
      const left = child.layoutOffset.x;
      const delta = Math.max(left - x, x - left - child.size.width, 0);
      if (delta < distance) {
        best = i;
        distance = delta;
      }
    });
    return best;
  }

  private targetThumb(): Rect | null {
    const child = this.children[this.options.highlighted];
    if (!child?.hasSize) return null;
    const { x, y } = child.layoutOffset;
    return thumbInsets.inflateRect(Rect.fromLTWH(x, y, child.size.width, child.size.height));
  }

  private currentThumb(): Rect | null {
    if (this.thumbTarget === null || this.thumbFrom === null || !this.options.animation.isAnimating)
      return this.thumbTarget;
    const t =
      (this.options.animation.value - this.thumbStart) /
      Math.max(1 - this.thumbStart, Number.EPSILON);
    return Rect.lerp(this.thumbFrom, this.thumbTarget, Math.max(0, Math.min(1, t)));
  }

  override paint(context: PaintingContext): void {
    const { highlighted, rtl, thumb, background, separators, scale } = this.options;
    const bounds = Rect.fromLTWH(0, 0, this.size.width, this.size.height);
    context.drawPath(trackShape.getOuterPath(bounds), new Paint({ color: background.toARGB32() }));
    this.children.forEach((child, index) => {
      if (index === 0 || child.size.height <= separatorInset * 2) return;
      const opacity = separators[index - 1]?.value ?? 1;
      if (opacity === 0) return;
      const { x, y } = child.layoutOffset;
      const left = rtl ? x + child.size.width : x - separatorWidth;
      context.drawRRect(
        Rect.fromLTWH(
          left,
          y + separatorInset,
          separatorWidth,
          child.size.height - 2 * separatorInset,
        ),
        separatorRadius,
        new Paint({
          color: separatorColor.withValues({ alpha: separatorColor.a * opacity }).toARGB32(),
        }),
      );
    });
    const current = this.currentThumb();
    if (current && !current.isEmpty) {
      const width = current.width * scale.value;
      const height = current.height * scale.value;
      const physical = rtl ? this.children.length - 1 - highlighted : highlighted;
      const anchor = physical === 0 ? -1 : physical === this.children.length - 1 ? 1 : 0;
      const rect = Rect.fromCenter({
        center: current.center.translate((anchor * (current.width - width)) / 2, 0),
        width,
        height,
      });
      for (const shadow of thumbShadows)
        context.drawPath(thumbShape.getOuterPath(rect.shift(shadow.offset)), shadow.toPaint());
      context.drawPath(thumbStroke.getOuterPath(rect.inflate(0.5)), thumbOutline);
      context.drawPath(thumbShape.getOuterPath(rect), new Paint({ color: thumb.toARGB32() }));
    }
    super.paint(context);
  }
}
