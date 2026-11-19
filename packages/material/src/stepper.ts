// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/material/stepper.dart
// Revision: 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { ValueKey } from '@nelyx/core/foundation/key';
import { AnimationStatus } from '@nelyx/core/framework/animation/animation';
import type { Animation } from '@nelyx/core/framework/animation/animation';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { Curves, Interval } from '@nelyx/core/framework/animation/curves';
import { CurveTween } from '@nelyx/core/framework/animation/tween';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import type { BoxBorder } from '@nelyx/core/framework/painting/box-border';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import type { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { EdgeInsets, EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import type { Gradient } from '@nelyx/core/framework/painting/gradient';
import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { hashValues, valueEquals } from '@nelyx/core/framework/painting/value-equality';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { AnimatedSize } from '@nelyx/core/framework/widgets/animated-size';
import { AnimatedSwitcher } from '@nelyx/core/framework/widgets/animated-switcher';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import {
  Align,
  Center,
  ColoredBox,
  Column,
  Expanded,
  KeyedSubtree,
  Padding,
  PositionedDirectional,
  Row,
  SizedBox,
  Stack,
  Text,
} from '@nelyx/core/framework/widgets/basic';
import { ClipRect } from '@nelyx/core/framework/widgets/clip';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { ExcludeFocus } from '@nelyx/core/framework/widgets/focus-scope';
import { Element, State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Icon } from '@nelyx/core/framework/widgets/icon';
import {
  AnimatedContainer,
  AnimatedDefaultTextStyle,
} from '@nelyx/core/framework/widgets/implicit-animations';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import type { ScrollController } from '@nelyx/core/framework/widgets/scroll-controller';
import type { ScrollPhysics } from '@nelyx/core/framework/widgets/scroll-physics';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Scrollable } from '@nelyx/core/framework/widgets/scrollable';
import { ExcludeSemantics, Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { FadeTransition, SizeTransition } from '@nelyx/core/framework/widgets/transitions';
import { Visibility } from '@nelyx/core/framework/widgets/visibility';
import { emptyWidgetStateSet, WidgetState } from '@nelyx/core/framework/widgets/widget-state';
import type { WidgetStateProperty } from '@nelyx/core/framework/widgets/widget-state';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Clip } from '@nelyx/core/ui/clip';
import { Color } from '@nelyx/core/ui/color';
import type { Size } from '@nelyx/core/ui/geometry';
import { Paint } from '@nelyx/core/ui/paint';
import { Path } from '@nelyx/core/ui/path';
import { Colors } from './colors.ts';
import { Icons } from './icons.ts';
import { InkResponse, InkWell } from './ink-well.ts';
import { MaterialLocalizations } from './material-localizations.ts';
import { Material } from './material.ts';
import { TextButton } from './text-button.ts';
import type { ThemeData } from './theme-data.ts';
import { Theme } from './theme.ts';

export enum StepState {
  indexed = 'indexed',
  editing = 'editing',
  complete = 'complete',
  disabled = 'disabled',
  error = 'error',
}

export enum StepperType {
  vertical = 'vertical',
  horizontal = 'horizontal',
}

type StepAction = (() => void) | null;

export interface ControlsDetailsOptions {
  readonly currentStep: number;
  readonly stepIndex: number;
  readonly onStepContinue?: StepAction;
  readonly onStepCancel?: StepAction;
}

export class ControlsDetails {
  readonly currentStep: number;
  readonly stepIndex: number;
  readonly onStepContinue: StepAction;
  readonly onStepCancel: StepAction;
  constructor({
    currentStep,
    stepIndex,
    onStepContinue = null,
    onStepCancel = null,
  }: ControlsDetailsOptions) {
    this.currentStep = currentStep;
    this.stepIndex = stepIndex;
    this.onStepContinue = onStepContinue;
    this.onStepCancel = onStepCancel;
  }
  get isActive(): boolean {
    return this.currentStep === this.stepIndex;
  }
}

export type ControlsWidgetBuilder = (context: BuildContext, details: ControlsDetails) => Widget;
export type StepIconBuilder = (stepIndex: number, stepState: StepState) => Widget | null;

export interface StepStyleOptions {
  readonly color?: Color | null;
  readonly errorColor?: Color | null;
  readonly connectorColor?: Color | null;
  readonly connectorThickness?: number | null;
  readonly border?: BoxBorder | null;
  readonly boxShadow?: BoxShadow | null;
  readonly gradient?: Gradient | null;
  readonly indexStyle?: TextStyle | null;
}

export class StepStyle {
  readonly color: Color | null;
  readonly errorColor: Color | null;
  readonly connectorColor: Color | null;
  readonly connectorThickness: number | null;
  readonly border: BoxBorder | null;
  readonly boxShadow: BoxShadow | null;
  readonly gradient: Gradient | null;
  readonly indexStyle: TextStyle | null;
  constructor({
    color = null,
    errorColor = null,
    connectorColor = null,
    connectorThickness = null,
    border = null,
    boxShadow = null,
    gradient = null,
    indexStyle = null,
  }: StepStyleOptions = {}) {
    this.color = color;
    this.errorColor = errorColor;
    this.connectorColor = connectorColor;
    this.connectorThickness = connectorThickness;
    this.border = border;
    this.boxShadow = boxShadow;
    this.gradient = gradient;
    this.indexStyle = indexStyle;
  }
  copyWith(options: StepStyleOptions = {}): StepStyle {
    return new StepStyle({
      color: options.color ?? this.color,
      errorColor: options.errorColor ?? this.errorColor,
      connectorColor: options.connectorColor ?? this.connectorColor,
      connectorThickness: options.connectorThickness ?? this.connectorThickness,
      border: options.border ?? this.border,
      boxShadow: options.boxShadow ?? this.boxShadow,
      gradient: options.gradient ?? this.gradient,
      indexStyle: options.indexStyle ?? this.indexStyle,
    });
  }
  merge(other: StepStyle | null): StepStyle {
    return other === null ? this : this.copyWith(other);
  }
  private get values(): readonly unknown[] {
    const {
      color,
      errorColor,
      connectorColor,
      connectorThickness,
      border,
      boxShadow,
      gradient,
      indexStyle,
    } = this;
    return [
      color,
      errorColor,
      connectorColor,
      connectorThickness,
      border,
      boxShadow,
      gradient,
      indexStyle,
    ];
  }
  equals(other: unknown): boolean {
    if (other === this) return true;
    if (!(other instanceof StepStyle) || other.constructor !== this.constructor) return false;
    const values = other.values;
    return this.values.every((value, index) => valueEquals(value, values[index]));
  }
  get hashCode(): number {
    return hashValues(...this.values);
  }
}

export interface StepOptions {
  readonly title: Widget;
  readonly content: Widget;
  readonly subtitle?: Widget | null;
  readonly state?: StepState;
  readonly isActive?: boolean;
  readonly label?: Widget | null;
  readonly stepStyle?: StepStyle | null;
}

export class Step {
  readonly title: Widget;
  readonly content: Widget;
  readonly subtitle: Widget | null;
  readonly state: StepState;
  readonly isActive: boolean;
  readonly label: Widget | null;
  readonly stepStyle: StepStyle | null;
  constructor({
    title,
    content,
    subtitle = null,
    state = StepState.indexed,
    isActive = false,
    label = null,
    stepStyle = null,
  }: StepOptions) {
    this.title = title;
    this.content = content;
    this.subtitle = subtitle;
    this.state = state;
    this.isActive = isActive;
    this.label = label;
    this.stepStyle = stepStyle;
  }
}

export interface StepperOptions extends WidgetOptions {
  readonly steps: readonly Step[];
  readonly controller?: ScrollController | null;
  readonly physics?: ScrollPhysics | null;
  readonly type?: StepperType;
  readonly currentStep?: number;
  readonly onStepTapped?: ((index: number) => void) | null;
  readonly onStepContinue?: StepAction;
  readonly onStepCancel?: StepAction;
  readonly controlsBuilder?: ControlsWidgetBuilder | null;
  readonly elevation?: number | null;
  readonly margin?: EdgeInsetsGeometry | null;
  readonly connectorColor?: WidgetStateProperty<Color> | null;
  readonly connectorThickness?: number | null;
  readonly stepIconBuilder?: StepIconBuilder | null;
  readonly stepIconHeight?: number | null;
  readonly stepIconWidth?: number | null;
  readonly stepIconMargin?: EdgeInsets | null;
  readonly clipBehavior?: Clip;
  readonly headerPadding?: EdgeInsetsGeometry | null;
  readonly contentPadding?: EdgeInsetsGeometry | null;
}

const iconSize = 24;
const maximumIconSize = 80;
const triangleRatio = 0.866025;
const triangleHeight = iconSize * triangleRatio;
const animation = { duration: 200, curve: Curves.fastOutSlowIn };
const contentFade = new Interval(0.4, 1, { curve: animation.curve });
const circleFade = new Interval(0, 0.6, { curve: animation.curve }).flipped;
const defaultHeaderPadding = EdgeInsets.symmetric({ horizontal: 24 });
const defaultVerticalPadding = EdgeInsetsDirectional.only({ start: 60, end: 24, bottom: 24 });
const defaultHorizontalPadding = EdgeInsets.all(24);
const titleGap = EdgeInsetsDirectional.only({ start: 12 });
const defaultIconPadding = EdgeInsets.symmetric({ vertical: 8 });
const controlPadding = EdgeInsets.symmetric({ horizontal: 16 });
const controlShape = new RoundedRectangleBorder({ borderRadius: BorderRadius.circular(2) });
const whiteIndex = new TextStyle({ fontSize: 12, color: Colors.white.toARGB32() });

function pad(child: Widget, padding: EdgeInsetsGeometry): Padding {
  return new Padding(padding, child);
}

export class Stepper extends StatefulWidget {
  readonly steps: readonly Step[];
  readonly controller: ScrollController | null;
  readonly physics: ScrollPhysics | null;
  readonly type: StepperType;
  readonly currentStep: number;
  readonly onStepTapped: ((index: number) => void) | null;
  readonly onStepContinue: StepAction;
  readonly onStepCancel: StepAction;
  readonly controlsBuilder: ControlsWidgetBuilder | null;
  readonly elevation: number | null;
  readonly margin: EdgeInsetsGeometry | null;
  readonly connectorColor: WidgetStateProperty<Color> | null;
  readonly connectorThickness: number | null;
  readonly stepIconBuilder: StepIconBuilder | null;
  readonly stepIconHeight: number | null;
  readonly stepIconWidth: number | null;
  readonly stepIconMargin: EdgeInsets | null;
  readonly clipBehavior: Clip;
  readonly headerPadding: EdgeInsetsGeometry | null;
  readonly contentPadding: EdgeInsetsGeometry | null;
  constructor({
    key = null,
    steps,
    controller = null,
    physics = null,
    type = StepperType.vertical,
    currentStep = 0,
    onStepTapped = null,
    onStepContinue = null,
    onStepCancel = null,
    controlsBuilder = null,
    elevation = null,
    margin = null,
    connectorColor = null,
    connectorThickness = null,
    stepIconBuilder = null,
    stepIconHeight = null,
    stepIconWidth = null,
    stepIconMargin = null,
    clipBehavior = 'none',
    headerPadding = null,
    contentPadding = null,
  }: StepperOptions) {
    super(key);
    invariant(
      Number.isInteger(currentStep) && currentStep >= 0 && currentStep < steps.length,
      'invalid-stepper-current-step',
      'currentStep must index an existing step',
    );
    for (const size of [stepIconHeight, stepIconWidth]) {
      invariant(
        size === null || (size >= iconSize && size <= maximumIconSize),
        'invalid-stepper-icon-size',
        'Step icon dimensions must be between 24 and 80',
      );
    }
    invariant(
      stepIconHeight === null || stepIconWidth === null || stepIconHeight === stepIconWidth,
      'invalid-stepper-icon-size',
      'When both step icon dimensions are specified they must be equal',
    );
    this.steps = Object.freeze([...steps]);
    this.controller = controller;
    this.physics = physics;
    this.type = type;
    this.currentStep = currentStep;
    this.onStepTapped = onStepTapped;
    this.onStepContinue = onStepContinue;
    this.onStepCancel = onStepCancel;
    this.controlsBuilder = controlsBuilder;
    this.elevation = elevation;
    this.margin = margin;
    this.connectorColor = connectorColor;
    this.connectorThickness = connectorThickness;
    this.stepIconBuilder = stepIconBuilder;
    this.stepIconHeight = stepIconHeight;
    this.stepIconWidth = stepIconWidth;
    this.stepIconMargin = stepIconMargin;
    this.clipBehavior = clipBehavior;
    this.headerPadding = headerPadding;
    this.contentPadding = contentPadding;
  }
  createState(): State<Stepper> {
    return new StepperState();
  }
}

class StepperState extends State<Stepper> {
  private headerKeys: GlobalKey[] = [];
  override initState(): void {
    super.initState();
    this.headerKeys = this.widget.steps.map(() => new GlobalKey());
  }
  override didUpdateWidget(old: Stepper): void {
    super.didUpdateWidget(old);
    invariant(
      old.steps.length === this.widget.steps.length,
      'changed-stepper-length',
      'Use a new Stepper key when changing the number of steps',
    );
  }
  private resolvedConnector(active: boolean): Color | null {
    if (this.widget.connectorColor === null) return null;
    const states = emptyWidgetStateSet();
    states.add(active ? WidgetState.selected : WidgetState.disabled);
    return this.widget.connectorColor.resolve(states);
  }
  private connector(theme: ThemeData, active: boolean): Color {
    return (
      this.resolvedConnector(active) ??
      (active ? new Color(theme.colorScheme.primary) : Colors.grey.shade400)
    );
  }
  private errorColor(theme: ThemeData): Color {
    return theme.brightness === 'dark' ? Colors.red.shade400 : Colors.red;
  }
  private icon(theme: ThemeData, step: Step, index: number): Widget {
    const { stepIconBuilder, stepIconMargin, stepIconHeight, stepIconWidth } = this.widget;
    const width = stepIconWidth ?? iconSize;
    const height = stepIconHeight ?? iconSize;
    const darkActive = theme.brightness === 'dark' && step.isActive;
    const style = step.stepStyle;
    const foreground = darkActive ? Colors.black87 : Colors.white;
    let glyph = stepIconBuilder?.(index, step.state) ?? null;
    if (glyph === null) {
      switch (step.state) {
        case StepState.error:
          glyph = new Text('!', { style: whiteIndex });
          break;
        case StepState.editing:
        case StepState.complete:
          glyph = new Icon(step.state === StepState.editing ? Icons.edit : Icons.check, {
            size: 18,
            color: foreground,
          });
          break;
        default:
          glyph = new Text(String(index + 1), {
            style: style?.indexStyle ?? whiteIndex.copyWith({ color: foreground.toARGB32() }),
          });
      }
    }
    const scheme = theme.colorScheme;
    const circle = () => {
      const color =
        style?.color ??
        this.resolvedConnector(step.isActive) ??
        (theme.brightness === 'dark'
          ? new Color(step.isActive ? scheme.secondary : scheme.surface)
          : step.isActive
            ? new Color(scheme.primary)
            : new Color(scheme.onSurface).withOpacity(0.38));
      return new AnimatedContainer({
        ...animation,
        decoration: new BoxDecoration({
          color: style?.gradient == null ? color.toARGB32() : null,
          shape: 'circle',
          border: style?.border ?? null,
          boxShadow: style?.boxShadow ? [style.boxShadow] : null,
          gradient: style?.gradient ?? null,
        }),
        child: new Center(glyph),
      });
    };
    const error = step.state === StepState.error;
    const indicator = error
      ? new Center(
          new SizedBox(
            width,
            stepIconHeight === null ? triangleHeight : height * triangleRatio,
            new CustomPaint(new Align(glyph, { alignment: new Alignment(0, 0.8) }), {
              painter: new ErrorIndicatorPainter(style?.errorColor ?? this.errorColor(theme)),
            }),
          ),
        )
      : circle();
    const fade = error ? contentFade : circleFade;
    return pad(
      new SizedBox(
        width,
        height,
        new AnimatedSwitcher({
          duration: animation.duration,
          switchInCurve: fade,
          switchOutCurve: fade,
          child: new KeyedSubtree({ key: new ValueKey(error), child: indicator }),
        }),
      ),
      stepIconMargin ?? defaultIconPadding,
    );
  }
  private headerText(theme: ThemeData, step: Step, child: Widget, small = false): Widget {
    const base = (small ? theme.textTheme.bodySmall : theme.textTheme.bodyLarge) ?? new TextStyle();
    const color =
      step.state === StepState.error
        ? this.errorColor(theme)
        : step.state === StepState.disabled
          ? theme.brightness === 'dark'
            ? Colors.white38
            : Colors.black38
          : null;
    return new AnimatedDefaultTextStyle({
      ...animation,
      child,
      style: color ? base.copyWith({ color: color.toARGB32() }) : base,
    });
  }
  private title(theme: ThemeData, step: Step): Widget {
    const children = [this.headerText(theme, step, step.title)];
    if (step.subtitle)
      children.push(
        pad(this.headerText(theme, step, step.subtitle, true), EdgeInsets.only({ top: 2 })),
      );
    return new Column(children, { mainAxisSize: 'min', crossAxisAlignment: 'start' });
  }
  private header(index: number, child: Widget, vertical: boolean): Widget {
    const enabled = this.widget.steps[index]!.state !== StepState.disabled;
    const press = () => {
      if (!this.mounted || this.widget.steps[index]?.state === StepState.disabled) return;
      const context = vertical ? this.headerKeys[index]?.currentContext : undefined;
      if (context) void Scrollable.ensureVisible(context, animation);
      this.widget.onStepTapped?.(index);
    };
    const onTap = enabled ? press : null;
    const options = { onTap, canRequestFocus: onTap !== null, child };
    return new Semantics({
      container: true,
      button: true,
      enabled: onTap !== null,
      selected: index === this.widget.currentStep,
      child: vertical ? new InkWell(options) : new InkResponse(options),
    });
  }
  private controls(context: BuildContext, theme: ThemeData, index: number): Widget {
    const { currentStep, onStepContinue, onStepCancel, controlsBuilder } = this.widget;
    if (controlsBuilder)
      return controlsBuilder(
        context,
        new ControlsDetails({ currentStep, stepIndex: index, onStepContinue, onStepCancel }),
      );
    const labels = MaterialLocalizations.of(context);
    const dark = theme.brightness === 'dark';
    const label = (text: string) => new Text(text);
    const style = { padding: controlPadding, shape: controlShape };
    return pad(
      new SizedBox(
        undefined,
        48,
        new Row([
          new TextButton({
            onPressed: onStepContinue,
            style: TextButton.styleFrom({
              ...style,
              foregroundColor: new Color(
                dark ? theme.colorScheme.onSurface : theme.colorScheme.onPrimary,
              ),
              backgroundColor: dark ? null : new Color(theme.colorScheme.primary),
            }),
            child: label(labels.continueButtonLabel),
          }),
          pad(
            new TextButton({
              onPressed: onStepCancel,
              style: TextButton.styleFrom({
                ...style,
                foregroundColor: dark ? Colors.white70 : Colors.black54,
              }),
              child: label(labels.cancelButtonLabel),
            }),
            EdgeInsetsDirectional.only({ start: 8 }),
          ),
        ]),
      ),
      EdgeInsets.only({ top: 16 }),
    );
  }
  private content(step: Step): Widget {
    return new ClipRect(step.content, { clipBehavior: this.widget.clipBehavior });
  }
  private vertical(context: BuildContext, theme: ThemeData): Widget {
    const w = this.widget;
    const padding = w.headerPadding ?? defaultHeaderPadding;
    const direction = Directionality.maybeOf(context) ?? 'ltr';
    const physicalPadding = padding.resolve(direction);
    const headerStart = direction === 'ltr' ? physicalPadding.left : physicalPadding.right;
    const thickness = w.connectorThickness ?? 1;
    const iconWidth = w.stepIconWidth ?? iconSize;
    const contentPadding = (w.contentPadding ?? defaultVerticalPadding).add(
      EdgeInsetsDirectional.only({ start: w.stepIconMargin?.left ?? 0 }),
    );
    const children = w.steps.map((step, index) => {
      const previous = w.steps[index - 1];
      const last = index === w.steps.length - 1;
      const line = (visible: boolean, active: boolean) =>
        new SizedBox(
          visible ? thickness : 0,
          16,
          new ColoredBox({ color: this.connector(theme, active).toARGB32() }),
        );
      const header = this.header(
        index,
        pad(
          new Row([
            new Column(
              [
                line(previous !== undefined, previous?.isActive ?? false),
                this.icon(theme, step, index),
                line(!last, step.isActive),
              ],
              { mainAxisSize: 'min' },
            ),
            new Expanded(pad(this.title(theme, step), titleGap)),
          ]),
          padding,
        ),
        true,
      );
      const body = new StepperBody(
        index === w.currentStep,
        pad(
          new Column([this.content(step), this.controls(context, theme, index)], {
            mainAxisSize: 'min',
          }),
          contentPadding,
        ),
      );
      const panel = last
        ? body
        : new Stack([
            new PositionedDirectional(
              new ColoredBox({ color: this.connector(theme, step.isActive).toARGB32() }),
              {
                top: 0,
                bottom: 0,
                width: thickness,
                start:
                  headerStart + (iconWidth + (w.stepIconMargin?.horizontal ?? 0) - thickness) / 2,
              },
            ),
            body,
          ]);
      return new Column([header, panel], {
        key: this.headerKeys[index]!,
        mainAxisSize: 'min',
        crossAxisAlignment: 'stretch',
      });
    });
    return new ListView({
      children,
      padding: w.margin,
      controller: w.controller,
      physics: w.physics,
      shrinkWrap: true,
    });
  }
  private horizontal(context: BuildContext, theme: ThemeData): Widget {
    const w = this.widget;
    const hasLabel = w.steps.some((step) => step.label !== null);
    const headers: Widget[] = [];
    const panels: Widget[] = [];
    for (const [index, step] of w.steps.entries()) {
      const icon = this.icon(theme, step, index);
      const label = step.label;
      const indicator = new SizedBox(
        undefined,
        hasLabel ? 104 : 72,
        new Column(
          label === null
            ? [icon]
            : [
                new SizedBox(0, 24),
                icon,
                new SizedBox(undefined, 24, this.headerText(theme, step, label)),
              ],
          { mainAxisAlignment: 'center' },
        ),
      );
      headers.push(
        this.header(
          index,
          new Row([indicator, pad(this.title(theme, step), w.stepIconMargin ?? titleGap)], {
            mainAxisSize: 'min',
          }),
          false,
        ),
      );
      if (index + 1 < w.steps.length) {
        const color = step.stepStyle?.connectorColor ?? this.connector(theme, step.isActive);
        headers.push(
          new Expanded(
            pad(
              new SizedBox(
                undefined,
                step.stepStyle?.connectorThickness ?? w.connectorThickness ?? 1,
                new ColoredBox({ color: color.toARGB32() }),
              ),
              w.stepIconMargin ?? EdgeInsets.symmetric({ horizontal: 8 }),
            ),
          ),
        );
      }
      panels.push(
        new Visibility(this.content(step), {
          visible: index === w.currentStep,
          maintainState: true,
        }),
      );
    }
    const header = new Material({
      elevation: w.elevation ?? 2,
      child: pad(
        new SizedBox(
          undefined,
          w.stepIconHeight === null ? undefined : w.stepIconHeight * (hasLabel ? 2.5 : 2),
          new Row(headers),
        ),
        w.headerPadding ?? defaultHeaderPadding,
      ),
    });
    return new Column(
      [
        header,
        new Expanded(
          new ListView({
            controller: w.controller,
            physics: w.physics,
            padding: w.contentPadding ?? defaultHorizontalPadding,
            children: [
              new AnimatedSize({
                ...animation,
                child: new Column(panels, { mainAxisSize: 'min', crossAxisAlignment: 'stretch' }),
              }),
              this.controls(context, theme, w.currentStep),
            ],
          }),
        ),
      ],
      { crossAxisAlignment: 'stretch' },
    );
  }
  build(context: BuildContext): Widget {
    invariant(
      context.findAncestorWidgetOfExactType(Stepper) === undefined,
      'nested-stepper',
      'Steppers must not be nested',
    );
    const theme = Theme.of(context);
    return this.widget.type === StepperType.vertical
      ? this.vertical(context, theme)
      : this.horizontal(context, theme);
  }
}

class StepperBody extends StatefulWidget {
  constructor(
    readonly expanded: boolean,
    readonly child: Widget,
  ) {
    super();
  }
  override createState(): State<StepperBody> {
    return new StepperBodyState();
  }
}

class StepperBodyState extends SingleTickerProviderStateMixin<StepperBody> {
  private controller!: AnimationController;
  private size!: Animation<number>;
  private opacity!: Animation<number>;

  private readonly onStatus = (status: AnimationStatus): void => {
    if (
      status === AnimationStatus.dismissed &&
      this.mounted &&
      this.context instanceof Element &&
      this.context.active
    )
      this.setState(() => {});
  };
  override initState(): void {
    super.initState();
    this.controller = new AnimationController({
      vsync: this,
      duration: animation.duration,
      value: this.widget.expanded ? 1 : 0,
    });
    this.size = this.controller.drive(new CurveTween({ curve: animation.curve }));
    this.opacity = this.controller.drive(new CurveTween({ curve: contentFade }));
    this.controller.addStatusListener(this.onStatus);
  }
  override didUpdateWidget(old: StepperBody): void {
    super.didUpdateWidget(old);
    if (old.expanded === this.widget.expanded) return;
    if (this.widget.expanded) this.controller.forward();
    else this.controller.reverse();
  }
  override build(): Widget {
    const { expanded, child } = this.widget;
    const panel = new ExcludeFocus(
      new IgnorePointer(new ExcludeSemantics({ excluding: !expanded, child }), {
        ignoring: !expanded,
      }),
      { excluding: !expanded },
    );
    return new SizeTransition({
      sizeFactor: this.size,
      alignment: Alignment.topCenter,
      child: new FadeTransition({
        opacity: this.opacity,
        child: new Visibility(panel, {
          maintainState: true,
          visible: expanded || !this.controller.isDismissed,
        }),
      }),
    });
  }
  override dispose(): void {
    this.controller.dispose();
    super.dispose();
  }
}

class ErrorIndicatorPainter extends CustomPainter {
  constructor(private readonly color: Color) {
    super();
  }
  paint(canvas: Canvas, { width, height }: Size): void {
    const path = new Path();
    path.moveTo(width / 2, 0);
    path.lineTo(width, height);
    path.lineTo(0, height);
    path.close();
    canvas.drawPath(path, new Paint({ color: this.color.toARGB32() }));
  }
  shouldRepaint(old: CustomPainter): boolean {
    return !(old instanceof ErrorIndicatorPainter) || !valueEquals(old.color, this.color);
  }
}
