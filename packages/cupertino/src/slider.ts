// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { SliderControl } from '@nelyx/core/framework/widgets/slider-control';
import type { SliderVisualState } from '@nelyx/core/framework/widgets/slider-control';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { registerNativeRenderMetadata } from '@nelyx/core/framework/rendering/object';
import type {
  NativePaintEntry,
  NativePaintGeometry,
  NativeShape,
} from '@nelyx/core/framework/rendering/object';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Size } from '@nelyx/core/ui/geometry';
import { Color } from '@nelyx/core/ui/color';
import { Paint } from '@nelyx/core/ui/paint';
import { Rect } from '@nelyx/core/ui/rect';
import { RRect } from '@nelyx/core/ui/rrect';
import { Offset } from '@nelyx/core/ui/offset';
import { FoundationPlatform } from '@nelyx/core/foundation/platform';
import { HapticFeedback } from '@nelyx/core/services/haptic-feedback';
import { MouseCursor, SystemMouseCursors } from '@nelyx/core/services/mouse-cursor';
import { invariant } from '@nelyx/core/foundation/errors';
import { CupertinoThumbPainter } from './thumb-painter.ts';
import { CupertinoColors } from './colors.ts';
import { CupertinoTheme } from './theme.ts';
import { resolveCupertinoColor } from './internal/colors/color-values.ts';
import type { CupertinoColor } from './internal/colors/color-values.ts';
export interface CupertinoSliderOptions extends WidgetOptions {
  readonly value: number;
  readonly onChanged: ((value: number) => void) | null;
  readonly onChangeStart?: ((value: number) => void) | null;
  readonly onChangeEnd?: ((value: number) => void) | null;
  readonly min?: number;
  readonly max?: number;
  readonly divisions?: number | null;
  readonly activeColor?: CupertinoColor | null;
  readonly thumbColor?: CupertinoColor;
  readonly id?: string;
}
export class CupertinoSlider extends StatefulWidget {
  readonly options: Readonly<CupertinoSliderOptions>;
  constructor(options: CupertinoSliderOptions) {
    super(options.key ?? null);
    const min = options.min ?? 0,
      max = options.max ?? 1;
    invariant(
      [min, max, options.value].every(Number.isFinite) &&
        min <= max &&
        options.value >= min &&
        options.value <= max,
      'invalid-cupertino-slider-range',
      'Slider value must be finite within ordered min/max bounds',
    );
    invariant(
      options.divisions == null ||
        (Number.isSafeInteger(options.divisions) && options.divisions > 0),
      'invalid-cupertino-slider-divisions',
      'Slider divisions must be a positive safe integer',
    );
    invariant(
      options.onChanged === null || typeof options.onChanged === 'function',
      'invalid-cupertino-slider-callback',
      'onChanged must be a function or null',
    );
    this.options = Object.freeze({ ...options });
  }
  get value(): number {
    return this.options.value;
  }
  get min(): number {
    return this.options.min ?? 0;
  }
  get max(): number {
    return this.options.max ?? 1;
  }
  get divisions(): number | null {
    return this.options.divisions ?? null;
  }
  get onChanged(): ((value: number) => void) | null {
    return this.options.onChanged;
  }
  get onChangeStart(): ((value: number) => void) | null {
    return this.options.onChangeStart ?? null;
  }
  get onChangeEnd(): ((value: number) => void) | null {
    return this.options.onChangeEnd ?? null;
  }
  get activeColor(): CupertinoColor | null {
    return this.options.activeColor ?? null;
  }
  get thumbColor(): CupertinoColor {
    return this.options.thumbColor ?? CupertinoColors.white;
  }
  createState(): State {
    return new CupertinoSliderState();
  }
}
class CupertinoSliderPainter extends CustomPainter {
  constructor(
    readonly visual: SliderVisualState,
    readonly active: Color,
    readonly track: Color,
    readonly thumb: Color,
  ) {
    super({ repaint: visual.position });
  }
  paint(canvas: Canvas, size: Size): void {
    const v = this.visual,
      visualPosition = v.direction === 'rtl' ? 1 - v.position.value : v.position.value,
      thumbPosition = v.direction === 'rtl' ? 1 - v.fraction : v.fraction,
      center = 22 + (size.width - 44) * thumbPosition,
      cy = size.height / 2,
      rightColor = v.direction === 'rtl' ? this.track : this.active,
      leftColor = v.direction === 'rtl' ? this.active : this.track;
    if (visualPosition > 0)
      canvas.drawRRect(
        RRect.fromLTRBXY(8, cy - 1, center, cy + 1, 1, 1),
        new Paint({ color: rightColor.toARGB32() }),
      );
    if (visualPosition < 1)
      canvas.drawRRect(
        RRect.fromLTRBXY(center, cy - 1, size.width - 8, cy + 1, 1, 1),
        new Paint({ color: leftColor.toARGB32() }),
      );
    new CupertinoThumbPainter({ color: this.thumb }).paint(
      canvas,
      Rect.fromCircle({ center: new Offset(center, cy), radius: 14 }),
    );
  }
  shouldRepaint(_old: CustomPainter): boolean {
    return true;
  }
}
class CupertinoSliderState extends State<CupertinoSlider> {
  build(context: BuildContext): Widget {
    const widget = this.widget,
      o = widget.options,
      active = resolveCupertinoColor(
        o.activeColor ?? CupertinoTheme.of(context).primaryColor,
        context,
      ),
      thumb = resolveCupertinoColor(o.thumbColor ?? CupertinoColors.white, context),
      track = resolveCupertinoColor(CupertinoColors.systemFill, context);
    return new SliderControl({
      value: widget.value,
      min: widget.min,
      max: widget.max,
      divisions: widget.divisions,
      policy: 'cupertino',
      adjustmentUnit: 0.1,
      ...(o.id === undefined ? {} : { id: o.id }),
      onChanged: o.onChanged
        ? (value, isFast) => {
            if (value === widget.min || value === widget.max) {
              const messenger = context.services.binaryMessenger;
              if (messenger && FoundationPlatform.defaultTargetPlatform === 'iOS') {
                const future = isFast
                  ? HapticFeedback.mediumImpact(messenger)
                  : HapticFeedback.selectionClick(messenger);
                void future.catch((error) => context.services.reportError?.(error));
              }
            }
            this.widget.options.onChanged?.(value);
          }
        : null,
      onChangeStart: o.onChangeStart ?? null,
      onChangeEnd: o.onChangeEnd ?? null,
      mouseCursor:
        FoundationPlatform.hostEnvironment.kind === 'web'
          ? SystemMouseCursors.click
          : MouseCursor.defer,
      geometry: {
        width: 176,
        height: 44,
        trackInset: 22,
        thumbHitRadius: 22,
        minDragExtent: 8,
        expand: false,
      },
      builder: (_context, visual) =>
        new CustomPaint(undefined, {
          size: { width: 176, height: 44 },
          painter: new CupertinoSliderPainter(visual, active, track, thumb),
        }),
    });
  }
}
registerNativeRenderMetadata(CupertinoSliderPainter.prototype, (source) => {
  const v = source.visual,
    visual = v.direction === 'rtl' ? 1 - v.position.value : v.position.value,
    position = v.direction === 'rtl' ? 1 - v.fraction : v.fraction,
    center = 22 - 44 * position;
  const shape: NativeShape = {
    kind: 'stadium',
    radii: Array(8).fill(0),
    strokeWidth: 0,
    strokeAlign: 0,
    strokeColor: 0,
  };
  const rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): NativePaintGeometry => ({ kind: 'linear', rect: [x, y, w, h, dx, dy, dw, dh] });
  const entries: NativePaintEntry[] = [];
  if (visual > 0)
    entries.push({
      kind: 'shape',
      shape,
      color: (v.direction === 'rtl' ? source.track : source.active).toARGB32(),
      geometry: rect(0, 0.5, position, 0, 8, -1, center - 8, 2),
    });
  if (visual < 1)
    entries.push({
      kind: 'shape',
      shape,
      color: (v.direction === 'rtl' ? source.active : source.track).toARGB32(),
      geometry: rect(position, 0.5, 1 - position, 0, center, -1, -center - 8, 2),
    });
  const thumb = rect(position, 0.5, 0, 0, center - 14, -14, 28, 28);
  for (const shadow of new CupertinoThumbPainter({ color: source.thumb }).shadows)
    entries.push({
      kind: 'shadow',
      shape,
      color: shadow.color,
      x: shadow.offset.dx,
      y: shadow.offset.dy,
      blurSigma: shadow.blurSigma,
      spread: shadow.spreadRadius,
      geometry: thumb,
    });
  entries.push(
    {
      kind: 'shape',
      shape,
      color: 0x0a000000,
      geometry: rect(position, 0.5, 0, 0, center - 14.5, -14.5, 29, 29),
    },
    { kind: 'shape', shape, color: source.thumb.toARGB32(), geometry: thumb },
  );
  return { kind: 'paint', entries };
});
