// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter: packages/flutter/lib/src/cupertino/picker.dart @ 71e4717a61786faab4c7aa39825989305ed29e8a
import { invariant } from '@nelyx/core/foundation/errors';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { DragStartBehavior } from '@nelyx/core/framework/gestures/recognizer';
import { BorderRadiusDirectional } from '@nelyx/core/framework/painting/border-radius';
import { ColorShapeDecoration } from '@nelyx/core/framework/painting/color-shape-decoration';
import { EdgeInsetsDirectional } from '@nelyx/core/framework/painting/edge-insets';
import { RoundedSuperellipseBorder } from '@nelyx/core/framework/painting/rounded-superellipse-border';
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes';
import type {
  SemanticsConfiguration,
  SemanticsNode,
} from '@nelyx/core/framework/semantics/semantics';
import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import {
  Center,
  ColoredBox,
  DecoratedBox,
  Padding,
  Positioned,
  SizedBox,
  Stack,
} from '@nelyx/core/framework/widgets/basic';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import {
  SingleChildRenderObjectWidget,
  State,
  StatefulWidget,
  StatelessWidget,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import {
  ChangeReportingBehavior,
  FixedExtentScrollController,
  FixedExtentScrollPhysics,
  ListWheelChildBuilderDelegate,
  ListWheelChildDelegate,
  ListWheelChildListDelegate,
  ListWheelChildLoopingListDelegate,
  ListWheelScrollView,
} from '@nelyx/core/framework/widgets/list-wheel-source';
import { IgnorePointer } from '@nelyx/core/framework/widgets/pointer-blocking';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { HitTestBehavior } from '@nelyx/core/framework/rendering/pointer-listener';
import { HapticFeedback } from '@nelyx/core/services/haptic-feedback';
import { SystemSound, SystemSoundType } from '@nelyx/core/services/system-sound';
import { Radius } from '@nelyx/core/ui/radius';
import { CupertinoColors } from './colors.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
import { CupertinoTheme } from './theme.ts';

export { ChangeReportingBehavior, FixedExtentScrollController };

interface PickerOptions extends WidgetOptions {
  readonly diameterRatio?: number;
  readonly backgroundColor?: CupertinoColor | null;
  readonly offAxisFraction?: number;
  readonly useMagnifier?: boolean;
  readonly magnification?: number;
  readonly scrollController?: FixedExtentScrollController | null;
  readonly squeeze?: number;
  readonly changeReportingBehavior?: ChangeReportingBehavior;
  readonly itemExtent: number;
  readonly onSelectedItemChanged: ((index: number) => void) | null;
  readonly selectionOverlay?: Widget | null;
}

export interface CupertinoPickerOptions extends PickerOptions {
  readonly children: readonly Widget[];
  readonly looping?: boolean;
}

export interface CupertinoPickerBuilderOptions extends PickerOptions {
  readonly itemBuilder: (context: BuildContext, index: number) => Widget | null;
  readonly childCount?: number | null;
}

export class CupertinoPicker extends StatefulWidget {
  readonly diameterRatio: number;
  readonly backgroundColor: CupertinoColor | null;
  readonly offAxisFraction: number;
  readonly useMagnifier: boolean;
  readonly magnification: number;
  readonly scrollController: FixedExtentScrollController | null;
  readonly squeeze: number;
  readonly changeReportingBehavior: ChangeReportingBehavior;
  readonly itemExtent: number;
  readonly onSelectedItemChanged: PickerOptions['onSelectedItemChanged'];
  readonly selectionOverlay: Widget | null;
  readonly childDelegate: ListWheelChildDelegate;

  constructor(options: CupertinoPickerOptions | CupertinoPickerBuilderOptions) {
    super(options.key ?? null);
    this.diameterRatio = options.diameterRatio ?? 1.07;
    this.backgroundColor = options.backgroundColor ?? null;
    this.offAxisFraction = options.offAxisFraction ?? 0;
    this.useMagnifier = options.useMagnifier ?? false;
    this.magnification = options.magnification ?? 1;
    this.scrollController = options.scrollController ?? null;
    this.squeeze = options.squeeze ?? 1.45;
    this.changeReportingBehavior =
      options.changeReportingBehavior ?? ChangeReportingBehavior.onScrollUpdate;
    this.itemExtent = options.itemExtent;
    this.onSelectedItemChanged = options.onSelectedItemChanged;
    this.selectionOverlay =
      options.selectionOverlay === undefined
        ? new CupertinoPickerDefaultSelectionOverlay()
        : options.selectionOverlay;

    invariant(
      [this.diameterRatio, this.magnification, this.squeeze, this.itemExtent].every(
        (value) => Number.isFinite(value) && value > 0,
      ) && Number.isFinite(this.offAxisFraction),
      'invalid-cupertino-picker-projection',
      'CupertinoPicker requires finite projection values and positive extent, ratio, magnification and squeeze',
    );
    this.childDelegate =
      'children' in options
        ? options.looping
          ? new ListWheelChildLoopingListDelegate({ children: options.children })
          : new ListWheelChildListDelegate({ children: options.children })
        : new ListWheelChildBuilderDelegate({
            builder: options.itemBuilder,
            childCount: options.childCount ?? null,
          });
  }

  static builder(options: CupertinoPickerBuilderOptions): CupertinoPicker {
    return new CupertinoPicker(options);
  }

  override createState(): State<CupertinoPicker> {
    return new PickerState();
  }
}

class PickerState extends State<CupertinoPicker> {
  private owned: FixedExtentScrollController | null = null;
  private lastHapticIndex = 0;
  private lastMiddlePosition: number | undefined;
  private tap: object | null = null;

  private get controller(): FixedExtentScrollController {
    return this.widget.scrollController ?? (this.owned ??= new FixedExtentScrollController());
  }

  override initState(): void {
    super.initState();
    this.lastHapticIndex = this.controller.initialItem;
    this.controller.addListener(this.handleScroll);
  }

  override didUpdateWidget(oldWidget: CupertinoPicker): void {
    super.didUpdateWidget(oldWidget);
    if (this.widget.scrollController === oldWidget.scrollController) return;
    (oldWidget.scrollController ?? this.owned)?.removeListener(this.handleScroll);
    this.tap = null;
    this.lastMiddlePosition = undefined;
    this.lastHapticIndex = this.controller.initialItem;
    this.controller.addListener(this.handleScroll);
  }

  private readonly handleScroll = (): void => {
    const { binaryMessenger: messenger, reportError } = this.context.services;
    if (!messenger || FoundationPlatform.defaultTargetPlatform !== 'iOS' || this.tap !== null)
      return;
    const controller = this.controller;
    if (!hasSinglePosition(controller)) return;
    const index = controller.selectedItem;
    const fractionalOffset = controller.offset / this.widget.itemExtent;
    const middle = Math.floor(fractionalOffset);
    if (
      (middle !== this.lastMiddlePosition || Math.abs(fractionalOffset - index) <= 0.1) &&
      index !== this.lastHapticIndex
    ) {
      this.lastHapticIndex = index;
      void Promise.all([
        HapticFeedback.selectionClick(messenger),
        SystemSound.play(SystemSoundType.tick, messenger),
      ]).catch((error) => reportError?.(error));
    }
    this.lastMiddlePosition = middle;
  };

  private readonly handleChildTap = (index: number): void => {
    const controller = this.controller;
    const tap = (this.tap = {});
    const reportError = this.context.services.reportError;
    void controller
      .animateToItem(index, { duration: 300, curve: Curves.easeInOut })
      .catch((error) => reportError?.(error))
      .finally(() => {
        if (this.tap !== tap) return;
        this.tap = null;
        if (hasSinglePosition(controller)) this.lastHapticIndex = controller.selectedItem;
      });
  };

  override build(context: BuildContext): Widget {
    const picker = this.widget;
    const wheel = ListWheelScrollView.useDelegate({
      controller: this.controller,
      physics: pickerPhysics,
      diameterRatio: picker.diameterRatio,
      offAxisFraction: picker.offAxisFraction,
      useMagnifier: picker.useMagnifier,
      magnification: picker.magnification,
      overAndUnderCenterOpacity: 0.447,
      itemExtent: picker.itemExtent,
      squeeze: picker.squeeze,
      onSelectedItemChanged: picker.onSelectedItemChanged,
      dragStartBehavior: DragStartBehavior.down,
      changeReportingBehavior: picker.changeReportingBehavior,
      childDelegate: new PickerChildDelegate(picker.childDelegate, this.handleChildTap),
    });
    const layers: Widget[] = [Positioned.fill(new PickerSemantics(wheel, this.controller))];
    if (picker.selectionOverlay !== null)
      layers.push(
        Positioned.fill(
          new IgnorePointer(
            new Center(
              new SizedBox(
                Infinity,
                picker.itemExtent * picker.magnification,
                picker.selectionOverlay,
              ),
            ),
          ),
        ),
      );
    const content = new DefaultTextStyle(
      CupertinoTheme.of(context).textTheme.pickerTextStyle,
      new Stack(layers),
    );
    return new ColoredBox({
      color:
        picker.backgroundColor === null
          ? 0x00000000
          : resolveCupertinoColor(picker.backgroundColor, context).toARGB32(),
      child: content,
    });
  }

  override dispose(): void {
    this.tap = null;
    this.controller.removeListener(this.handleScroll);
    this.owned?.dispose();
    super.dispose();
  }
}

const pickerPhysics = new FixedExtentScrollPhysics();

export interface CupertinoPickerDefaultSelectionOverlayOptions extends WidgetOptions {
  readonly background?: CupertinoColor;
  readonly capStartEdge?: boolean;
  readonly capEndEdge?: boolean;
}

export class CupertinoPickerDefaultSelectionOverlay extends StatelessWidget {
  readonly background: CupertinoColor;
  readonly capStartEdge: boolean;
  readonly capEndEdge: boolean;

  constructor({
    background = CupertinoColors.tertiarySystemFill,
    capStartEdge = true,
    capEndEdge = true,
    key = null,
  }: CupertinoPickerDefaultSelectionOverlayOptions = {}) {
    super(key);
    this.background = background;
    this.capStartEdge = capStartEdge;
    this.capEndEdge = capEndEdge;
  }

  override build(context: BuildContext): Widget {
    const radius = Radius.circular(8);
    return new Padding(
      EdgeInsetsDirectional.only({
        start: this.capStartEdge ? 9 : 0,
        end: this.capEndEdge ? 9 : 0,
      }),
      new DecoratedBox(undefined, {
        decoration: new ColorShapeDecoration(
          new RoundedSuperellipseBorder({
            borderRadius: BorderRadiusDirectional.horizontal({
              start: this.capStartEdge ? radius : Radius.zero,
              end: this.capEndEdge ? radius : Radius.zero,
            }),
          }),
          resolveCupertinoColor(this.background, context),
        ),
      }),
    );
  }
}

class PickerChildDelegate extends ListWheelChildDelegate {
  constructor(
    private readonly delegate: ListWheelChildDelegate,
    private readonly onTap: (index: number) => void,
  ) {
    super();
  }

  override get estimatedChildCount(): number | null {
    return this.delegate.estimatedChildCount;
  }

  override build(context: BuildContext, index: number): Widget | null {
    const child = this.delegate.build(context, index);
    return child === null
      ? null
      : new Semantics({
          container: true,
          child: new GestureDetector(child, {
            behavior: HitTestBehavior.translucent,
            excludeFromSemantics: true,
            onTap: () => this.onTap(index),
          }),
        });
  }

  override trueIndexOf(index: number): number {
    return this.delegate.trueIndexOf(index);
  }

  override shouldRebuild(old: ListWheelChildDelegate): boolean {
    return (
      !(old instanceof PickerChildDelegate) ||
      old.delegate.constructor !== this.delegate.constructor ||
      this.delegate.shouldRebuild(old.delegate)
    );
  }
}

function hasSinglePosition(controller: FixedExtentScrollController): boolean {
  return controller.sourcePositions.length === 1;
}

class PickerSemantics extends SingleChildRenderObjectWidget {
  constructor(
    child: Widget,
    private readonly controller: FixedExtentScrollController,
  ) {
    super(child);
  }

  override createRenderObject(context: BuildContext): RenderPickerSemantics {
    return new RenderPickerSemantics(this.controller, Directionality.of(context));
  }

  override updateRenderObject(context: BuildContext, render: RenderPickerSemantics): void {
    render.update(this.controller, Directionality.of(context));
  }
}

type PickerDirection = 'ltr' | 'rtl';

class RenderPickerSemantics extends RenderProxyBox {
  private selectedIndex: number;

  constructor(
    private controller: FixedExtentScrollController,
    private direction: PickerDirection,
  ) {
    super();
    this.selectedIndex = controller.initialItem;
    controller.addListener(this.handleScroll);
  }

  update(controller: FixedExtentScrollController, direction: PickerDirection): void {
    if (controller === this.controller && direction === this.direction) return;
    if (controller !== this.controller) {
      this.controller.removeListener(this.handleScroll);
      this.controller = controller;
      // The Scrollable will transfer its current position to the new controller.
      controller.addListener(this.handleScroll);
    }
    this.direction = direction;
    this.markNeedsSemanticsUpdate();
  }

  private readonly handleScroll = (): void => {
    const index = this.currentIndex;
    if (index === this.selectedIndex) return;
    this.selectedIndex = index;
    this.markNeedsSemanticsUpdate();
  };

  private get currentIndex(): number {
    return hasSinglePosition(this.controller) ? this.controller.selectedItem : this.selectedIndex;
  }

  private readonly increase = (): void => this.controller.jumpToItem(this.currentIndex + 1);
  private readonly decrease = (): void => this.controller.jumpToItem(this.currentIndex - 1);

  override describeSemanticsConfiguration(config: SemanticsConfiguration): void {
    super.describeSemanticsConfiguration(config);
    config.isSemanticBoundary = true;
    config.textDirection = this.direction;
  }

  override assembleSemanticsNode(
    node: SemanticsNode,
    config: SemanticsConfiguration,
    children: SemanticsNode[],
  ): void {
    const scrollable = children[0];
    if (!scrollable) {
      super.assembleSemanticsNode(node, config, children);
      return;
    }
    const index = (this.selectedIndex = this.currentIndex);
    const labels = new Map<number, string>();
    scrollable.visitChildren((child) => {
      if (child.indexInParent !== null) labels.set(child.indexInParent, child.label);
      return true;
    });
    const current = labels.get(index);
    if (!current) {
      node.updateWith({ config });
      return;
    }
    const adjusted = config.copy();
    const next = labels.get(index + 1);
    const previous = labels.get(index - 1);
    adjusted.value = current;
    adjusted.isSlider = true;
    adjusted.isFocusable = true;
    if (next) {
      adjusted.increasedValue = next;
      adjusted.onIncrease = this.increase;
    }
    if (previous) {
      adjusted.decreasedValue = previous;
      adjusted.onDecrease = this.decrease;
    }
    node.updateWith({ config: adjusted });
  }

  override dispose(): void {
    this.controller.removeListener(this.handleScroll);
    super.dispose();
  }
}
