// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Flutter material/tooltip.dart at 71e4717a61786faab4c7aa39825989305ed29e8a.
import { StatefulWidget, State, StatelessWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import {
  RawTooltip,
  TooltipTriggerMode,
  TooltipPositionContext,
} from '@nelyx/core/framework/widgets/raw-tooltip';
import type {
  RawTooltipState,
  TooltipPositionDelegate,
  TooltipTriggeredCallback,
} from '@nelyx/core/framework/widgets/raw-tooltip';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { SizedBox, ConstrainedBox, Center, Text } from '@nelyx/core/framework/widgets/basic';
import { Container } from '@nelyx/core/framework/widgets/container';
import { DefaultTextStyle } from '@nelyx/core/framework/widgets/default-text-style';
import { FadeTransition } from '@nelyx/core/framework/widgets/transitions';
import { MouseRegion } from '@nelyx/core/framework/widgets/mouse-region';
import { MouseCursor } from '@nelyx/core/services/mouse-cursor';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import type { EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import type { Decoration } from '@nelyx/core/framework/painting/decoration';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import type { InlineSpan } from '@nelyx/core/framework/painting/inline-span';
import type { TextStyle } from '@nelyx/core/framework/painting/text-style';
import type { TextAlign } from '@nelyx/core/ui/typography';
import type { Offset } from '@nelyx/core/ui/offset';
import { positionDependentBox } from '@nelyx/core/framework/painting/geometry';
import { protect } from '@nelyx/core/internal/ui/value-math';
import { invariant } from '@nelyx/core/foundation/errors';
import { DiagnosticsProperty, StringProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { DoubleProperty, FlagProperty } from '@nelyx/core/foundation/diagnostic-properties';
import { TooltipTheme, TooltipThemeData } from './tooltip-theme.ts';
import type { TooltipThemeDataOptions } from './tooltip-theme.ts';
import { TooltipVisibility } from './tooltip-visibility.ts';
import { Theme } from './theme.ts';
export { TooltipTriggerMode, TooltipPositionContext };
export type { TooltipPositionDelegate, TooltipTriggeredCallback };
export interface TooltipOptions extends TooltipThemeDataOptions, WidgetOptions {
  readonly message?: string | null;
  readonly richMessage?: InlineSpan | null;
  readonly child?: Widget | null;
  readonly enableTapToDismiss?: boolean;
  readonly onTriggered?: TooltipTriggeredCallback | null;
  readonly mouseCursor?: MouseCursor | null;
  readonly ignorePointer?: boolean | null;
  readonly positionDelegate?: TooltipPositionDelegate | null;
}
export class Tooltip extends StatefulWidget {
  readonly message: string | null;
  readonly richMessage: InlineSpan | null;
  readonly child: Widget | null;
  /** @dartType double? */ readonly height: number | null;
  readonly constraints: BoxConstraints | null;
  readonly padding: EdgeInsetsGeometry | null;
  readonly margin: EdgeInsetsGeometry | null;
  /** @dartType double? */ readonly verticalOffset: number | null;
  readonly preferBelow: boolean | null;
  readonly excludeFromSemantics: boolean | null;
  readonly decoration: Decoration | null;
  readonly textStyle: TextStyle | null;
  readonly textAlign: TextAlign | null;
  readonly waitDuration: number | null;
  readonly showDuration: number | null;
  readonly exitDuration: number | null;
  readonly enableTapToDismiss: boolean;
  readonly triggerMode: TooltipTriggerMode | null;
  readonly enableFeedback: boolean | null;
  readonly onTriggered: TooltipTriggeredCallback | null;
  readonly mouseCursor: MouseCursor | null;
  readonly ignorePointer: boolean | null;
  readonly positionDelegate: TooltipPositionDelegate | null;
  /** @dartParam height double?
   * @dartParam verticalOffset double? */
  constructor(o: TooltipOptions) {
    super(o.key ?? null);
    this.message = o.message ?? null;
    this.richMessage = o.richMessage ?? null;
    invariant(
      (this.message === null) !== (this.richMessage === null),
      'ambiguous-tooltip-message',
      'Either message or richMessage must be specified',
    );
    invariant(
      o.height == null || o.constraints == null,
      'ambiguous-tooltip-size',
      'Only one of height and constraints may be specified',
    );
    this.child = o.child ?? null;
    this.height = o.height ?? null;
    this.constraints = o.constraints ?? null;
    this.padding = o.padding ?? null;
    this.margin = o.margin ?? null;
    this.verticalOffset = o.verticalOffset ?? null;
    this.preferBelow = o.preferBelow ?? null;
    this.excludeFromSemantics = o.excludeFromSemantics ?? null;
    this.decoration = o.decoration ?? null;
    this.textStyle = o.textStyle ?? null;
    this.textAlign = o.textAlign ?? null;
    this.waitDuration = o.waitDuration ?? null;
    this.showDuration = o.showDuration ?? null;
    this.exitDuration = o.exitDuration ?? null;
    this.enableTapToDismiss = o.enableTapToDismiss ?? true;
    this.triggerMode = o.triggerMode ?? null;
    this.enableFeedback = o.enableFeedback ?? null;
    this.onTriggered = o.onTriggered ?? null;
    this.mouseCursor = o.mouseCursor ?? null;
    this.ignorePointer = o.ignorePointer ?? null;
    this.positionDelegate = o.positionDelegate ?? null;
    protect(this, [
      'message',
      'richMessage',
      'child',
      'height',
      'constraints',
      'padding',
      'margin',
      'verticalOffset',
      'preferBelow',
      'excludeFromSemantics',
      'decoration',
      'textStyle',
      'textAlign',
      'waitDuration',
      'showDuration',
      'exitDuration',
      'enableTapToDismiss',
      'triggerMode',
      'enableFeedback',
      'onTriggered',
      'mouseCursor',
      'ignorePointer',
      'positionDelegate',
    ]);
  }
  static dismissAllToolTips(): boolean {
    return RawTooltip.dismissAllToolTips();
  }
  createState(): TooltipState {
    return new TooltipState();
  }
  override debugFillProperties(p: DiagnosticPropertiesBuilder): void {
    super.debugFillProperties(p);
    p.add(
      new StringProperty('message', this.message, {
        showName: this.message === null,
        ...(this.message === null ? { defaultValue: null } : {}),
      }),
    );
    p.add(
      new StringProperty('richMessage', this.richMessage?.toPlainText() ?? null, {
        showName: this.richMessage === null,
        ...(this.richMessage === null ? { defaultValue: null } : {}),
      }),
    );
    p.add(new DoubleProperty('height', this.height, { defaultValue: null }));
    p.add(new DiagnosticsProperty('constraints', this.constraints, { defaultValue: null }));
    p.add(new DiagnosticsProperty('padding', this.padding, { defaultValue: null }));
    p.add(new DiagnosticsProperty('margin', this.margin, { defaultValue: null }));
    p.add(new DoubleProperty('vertical offset', this.verticalOffset, { defaultValue: null }));
    p.add(
      new FlagProperty('position', this.preferBelow, {
        ifTrue: 'below',
        ifFalse: 'above',
        showName: true,
      }),
    );
    p.add(
      new FlagProperty('semantics', this.excludeFromSemantics, {
        ifTrue: 'excluded',
        showName: true,
      }),
    );
    p.add(new DiagnosticsProperty('wait duration', this.waitDuration, { defaultValue: null }));
    p.add(new DiagnosticsProperty('show duration', this.showDuration, { defaultValue: null }));
    p.add(new DiagnosticsProperty('exit duration', this.exitDuration, { defaultValue: null }));
    p.add(new DiagnosticsProperty('triggerMode', this.triggerMode, { defaultValue: null }));
    p.add(
      new FlagProperty('enableFeedback', this.enableFeedback, { ifTrue: 'true', showName: true }),
    );
    p.add(new DiagnosticsProperty('textAlign', this.textAlign, { defaultValue: null }));
    p.add(
      new DiagnosticsProperty('positionDelegate', this.positionDelegate, { defaultValue: null }),
    );
  }
}
export class TooltipState extends State<Tooltip> {
  private readonly tooltipKey = new GlobalKey<RawTooltipState>('Tooltip');
  private visible = true;
  private theme = new TooltipThemeData();
  ensureTooltipVisible(): boolean {
    return this.tooltipKey.currentState?.ensureTooltipVisible() ?? false;
  }
  override didChangeDependencies(): void {
    super.didChangeDependencies();
    this.visible = TooltipVisibility.of(this.context);
    this.theme = TooltipTheme.of(this.context);
  }
  private readonly position = (context: TooltipPositionContext): Offset => {
    const verticalOffset = this.widget.verticalOffset ?? this.theme.verticalOffset ?? 24,
      preferBelow = this.widget.preferBelow ?? this.theme.preferBelow ?? true,
      resolved = new TooltipPositionContext({
        ...context,
        verticalOffset,
        preferBelow,
      });
    return (
      this.widget.positionDelegate?.(resolved) ??
      positionDependentBox({
        size: context.overlaySize,
        childSize: context.tooltipSize,
        target: context.target,
        verticalOffset,
        preferBelow,
      })
    );
  };
  build(context: BuildContext): Widget {
    const w = this.widget,
      t = this.theme,
      message = w.message ?? w.richMessage!.toPlainText();
    if (message === '') return w.child ?? SizedBox.shrink();
    const theme = Theme.of(context),
      desktop = ['macOS', 'linux', 'windows'].includes(theme.platform),
      dark = theme.brightness === 'dark',
      fontSize = desktop ? 12 : 14;
    const textStyle =
        w.textStyle ??
        t.textStyle ??
        theme.textTheme.bodyMedium!.copyWith({ color: dark ? 0xff000000 : 0xffffffff, fontSize }),
      decoration =
        w.decoration ??
        t.decoration ??
        new BoxDecoration({
          color: dark ? 0xe6ffffff : 0xe6616161,
          borderRadius: BorderRadius.circular(4),
        }),
      textAlign = w.textAlign ?? t.textAlign ?? 'start';
    const box = new TooltipBox(
      w.constraints ??
        t.constraints ??
        new BoxConstraints(0, Infinity, w.height ?? t.height ?? (desktop ? 24 : 32), Infinity),
      textStyle,
      textAlign,
      decoration,
      w.padding ?? t.padding ?? EdgeInsets.symmetric({ horizontal: desktop ? 8 : 16, vertical: 4 }),
      w.margin ?? t.margin ?? EdgeInsets.zero,
      w.richMessage ?? new TextSpan({ text: w.message }),
    );
    const child = new MouseRegion(w.child ?? SizedBox.shrink(), {
      cursor: w.mouseCursor ?? MouseCursor.defer,
    });
    if (!this.visible) return child;
    return new RawTooltip({
      key: this.tooltipKey,
      semanticsTooltip:
        (w.excludeFromSemantics ?? t.excludeFromSemantics ?? false) ? null : message,
      tooltipBuilder: (_context, animation) =>
        new FadeTransition({ opacity: animation, child: box }),
      touchDelay: w.showDuration ?? t.showDuration ?? 1500,
      triggerMode: w.triggerMode ?? t.triggerMode ?? TooltipTriggerMode.longPress,
      enableFeedback: w.enableFeedback ?? t.enableFeedback ?? true,
      hoverDelay: w.waitDuration ?? t.waitDuration ?? 0,
      enableTapToDismiss: w.enableTapToDismiss,
      onTriggered: w.onTriggered,
      dismissDelay: w.exitDuration ?? t.exitDuration ?? 100,
      positionDelegate: this.position,
      ignorePointer: w.ignorePointer ?? w.message !== null,
      child,
    });
  }
}
class TooltipBox extends StatelessWidget {
  constructor(
    readonly constraints: BoxConstraints,
    readonly textStyle: TextStyle,
    readonly textAlign: TextAlign,
    readonly decoration: Decoration,
    readonly padding: EdgeInsetsGeometry,
    readonly margin: EdgeInsetsGeometry,
    readonly richMessage: InlineSpan,
  ) {
    super();
  }
  build(): Widget {
    return new ConstrainedBox(
      new DefaultTextStyle(
        this.textStyle,
        new Container({
          decoration: this.decoration,
          padding: this.padding,
          margin: this.margin,
          child: new Center(
            Text.rich(this.richMessage, { style: this.textStyle, textAlign: this.textAlign }),
            { widthFactor: 1, heightFactor: 1 },
          ),
        }),
        { textAlign: this.textAlign },
      ),
      this.constraints,
    );
  }
}
