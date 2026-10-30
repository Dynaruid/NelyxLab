// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional port of the pinned activity_indicator.dart, on the owning Core ticker/painter.
import { StatefulWidget, StatelessWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { Widget, BuildContext, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { SizedBox, ConstrainedBox } from '@nelyx/core/framework/widgets/basic';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { Color } from '@nelyx/core/ui/color';
import { Paint } from '@nelyx/core/ui/paint';
import { RRect } from '@nelyx/core/ui/rrect';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Size } from '@nelyx/core/ui/geometry';
import { invariant } from '@nelyx/core/foundation/errors';
import { CupertinoDynamicColor, CupertinoColors } from './colors.ts';
import { coreCupertinoColor, resolveCupertinoColor } from "./internal/colors/color-values.ts";
import type { CupertinoColor } from "./internal/colors/color-values.ts";
const activeTickColor = CupertinoDynamicColor.withBrightness({ color: new Color(0xff3c3c44), darkColor: new Color(0xffebebf5) }), alphaValues = Object.freeze([47, 47, 47, 47, 72, 97, 122, 147]);
export interface CupertinoActivityIndicatorOptions extends WidgetOptions {
    readonly color?: CupertinoColor | null;
    readonly animating?: boolean;
    readonly radius?: number;
}
export interface CupertinoPartiallyRevealedOptions extends Omit<CupertinoActivityIndicatorOptions, 'animating'> {
    readonly progress?: number;
}
export class CupertinoActivityIndicator extends StatefulWidget {
    readonly options: Readonly<CupertinoActivityIndicatorOptions>;
    private revealed = 1;
    constructor(options: CupertinoActivityIndicatorOptions = {}) {
        super(options.key ?? null);
        this.options = Object.freeze({ ...options });
        invariant(Number.isFinite(this.radius) && this.radius > 0, 'invalid-activity-radius', 'Activity radius must be positive');
    }
    static partiallyRevealed(options: CupertinoPartiallyRevealedOptions = {}): CupertinoActivityIndicator {
        const { progress = 1, ...common } = options;
        invariant(Number.isFinite(progress) && progress >= 0 && progress <= 1, 'invalid-activity-progress', 'Activity progress must be within [0,1]');
        const widget = new CupertinoActivityIndicator({ ...common, animating: false });
        widget.revealed = progress;
        return widget;
    }
    get color(): CupertinoColor | null {
        return this.options.color ?? null;
    }
    get animating(): boolean {
        return this.options.animating ?? true;
    }
    get radius(): number {
        return this.options.radius ?? 10;
    }
    get progress(): number {
        return this.revealed;
    }
    createState(): State {
        return new CupertinoActivityIndicatorState();
    }
}
class CupertinoActivityPainter extends CustomPainter {
    constructor(readonly position: AnimationController, readonly color: Color, readonly radius: number, readonly progress: number) {
        super({ repaint: position });
    }
    paint(canvas: Canvas, size: Size): void {
        const paint = new Paint(), count = alphaValues.length, active = Math.floor(count * this.position.value), shape = RRect.fromLTRBXY(-this.radius / 10, -this.radius / 3, this.radius / 10, -this.radius, this.radius / 10, this.radius / 10);
        canvas.save();
        canvas.translate(size.width / 2, size.height / 2);
        for (let i = 0; i < count * this.progress; i++) {
            const t = ((i - active) % count + count) % count;
            paint.color = this.color.withAlpha(this.progress < 1 ? 147 : alphaValues[t]!).toARGB32();
            canvas.drawRRect(shape, paint);
            canvas.rotate(Math.PI * 2 / count);
        }
        canvas.restore();
    }
    shouldRepaint(old: CupertinoActivityPainter): boolean {
        return old.position !== this.position || !old.color.equals(this.color) || old.radius !== this.radius || old.progress !== this.progress;
    }
}
class CupertinoActivityIndicatorState extends SingleTickerProviderStateMixin<CupertinoActivityIndicator> {
    private controller!: AnimationController;
    override initState(): void {
        super.initState();
        this.controller = new AnimationController({ vsync: this, duration: 1000 });
        if (this.widget.animating)
            this.controller.repeat();
    }
    override didUpdateWidget(old: CupertinoActivityIndicator): void {
        super.didUpdateWidget(old);
        if (old.animating !== this.widget.animating) {
            if (this.widget.animating)
                this.controller.repeat();
            else
                this.controller.stop();
        }
    }
    override dispose(): void {
        try {
            this.controller.dispose();
        }
        finally {
            super.dispose();
        }
    }
    build(context: BuildContext): Widget {
        return SizedBox.square(this.widget.radius * 2, new CustomPaint(undefined, { painter: new CupertinoActivityPainter(this.controller, this.widget.options.color == null ? resolveCupertinoColor(activeTickColor, context) : coreCupertinoColor(this.widget.options.color), this.widget.radius, this.widget.progress) }));
    }
}
export interface CupertinoLinearActivityIndicatorOptions extends WidgetOptions {
    readonly progress: number;
    readonly height?: number;
    readonly color?: CupertinoColor | null;
}
class CupertinoLinearActivityPainter extends CustomPainter {
    constructor(readonly progress: number, readonly color: Color, readonly track: Color) {
        super();
    }
    paint(canvas: Canvas, size: Size): void {
        canvas.drawRRect({
            x: 0, y: 0, width: size.width, height: size.height
        }, size.height / 2, new Paint({ color: this.track.toARGB32() }));
        if (this.progress > 0)
            canvas.drawRRect({
                x: 0, y: 0, width: Math.max(0, Math.min(1, this.progress)) * size.width, height: size.height
            }, size.height / 2, new Paint({ color: this.color.toARGB32() }));
    }
    shouldRepaint(old: CupertinoLinearActivityPainter): boolean {
        return old.progress !== this.progress || !old.color.equals(this.color) || !old.track.equals(this.track);
    }
}
export class CupertinoLinearActivityIndicator extends StatelessWidget {
    constructor(readonly options: CupertinoLinearActivityIndicatorOptions) {
        super(options.key ?? null);
        invariant(Number.isFinite(options.progress) && options.progress >= 0 && options.progress <= 1 && Number.isFinite(options.height ?? 4.5) && (options.height ?? 4.5) > 0, 'invalid-linear-activity', 'Activity progress must be within [0,1] with a positive height');
    }
    build(_context: BuildContext): Widget {
        return new ConstrainedBox(new CustomPaint(undefined, { painter: new CupertinoLinearActivityPainter(this.options.progress, coreCupertinoColor(this.options.color ?? CupertinoColors.activeBlue), coreCupertinoColor(CupertinoColors.systemFill)) }), new BoxConstraints(Infinity, Infinity, this.options.height ?? 4.5));
    }
}
