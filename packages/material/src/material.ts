// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned material.dart surface/ink contracts on the existing Core render and ticker owners.
import { StatefulWidget, State, SingleChildRenderObjectWidget } from '@nelyx/core/framework/widgets/framework'; import type { BuildContext, Widget, WidgetOptions } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key'; import { TickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider'; import type { TickerProvider } from '@nelyx/core/framework/animation/ticker';
import { RenderProxyBox } from '@nelyx/core/framework/rendering/boxes'; import { RenderObject, RenderBox } from '@nelyx/core/framework/rendering/object'; import type { PaintingContext } from '@nelyx/core/framework/painting/context';
import { LookupBoundary } from '@nelyx/core/framework/widgets/lookup-boundary'; import { NotificationListener, LayoutChangedNotification } from '@nelyx/core/framework/widgets/notification-listener';
import { AnimatedDefaultTextStyle, AnimatedPhysicalModel, ImplicitlyAnimatedWidget, AnimatedWidgetBaseState } from '@nelyx/core/framework/widgets/implicit-animations'; import type { ImplicitlyAnimatedWidgetOptions, TweenVisitor } from '@nelyx/core/framework/widgets/implicit-animations';
import { Tween, ColorTween } from '@nelyx/core/framework/animation/tween'; import { Curves } from '@nelyx/core/framework/animation/curves'; import { Color } from '@nelyx/core/ui/color'; import type { Clip } from '@nelyx/core/ui/clip';
import { Matrix4 } from '@nelyx/core/math/matrix4'; import { Rect } from '@nelyx/core/ui/rect'; import type { Canvas } from '@nelyx/core/ui/canvas'; import type { Size } from '@nelyx/core/ui/geometry';
import { ShapeBorder } from '@nelyx/core/framework/painting/borders'; import { CircleBorder } from '@nelyx/core/framework/painting/circle-border'; import { RoundedRectangleBorder } from '@nelyx/core/framework/painting/rounded-rectangle-border';
import { BorderRadius, BorderRadiusGeometry } from '@nelyx/core/framework/painting/border-radius'; import type { TextStyle } from '@nelyx/core/framework/painting/text-style'; import { ShapeBorderClipper } from '@nelyx/core/framework/rendering/shape-border-clipper';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint'; import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint'; import { PhysicalShape } from '@nelyx/core/framework/widgets/basic'; import { ClipPath } from '@nelyx/core/framework/widgets/clip'; import { Directionality } from '@nelyx/core/framework/widgets/app-data';
import { invariant } from '@nelyx/core/foundation/errors'; import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics'; import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics'; import { Theme } from './theme.ts'; import { ElevationOverlay } from './elevation-overlay.ts';
import { MaterialInkRender, MaterialInkController, materialDefaultSplashRadius } from "./internal/material/material-ink-owner.ts"; export { InkFeature, MaterialInkController } from "./internal/material/material-ink-owner.ts"; export type { InkFeatureOptions } from "./internal/material/material-ink-owner.ts";
import { MaterialType } from "./generated/material/material-values.generated.ts"; export { MaterialType } from "./generated/material/material-values.generated.ts";
export interface MaterialOptions extends WidgetOptions {
    readonly type?: MaterialType;
    /** @dartType double */
    readonly elevation?: number;
    readonly color?: Color | null;
    readonly shadowColor?: Color | null;
    readonly surfaceTintColor?: Color | null;
    readonly textStyle?: TextStyle | null;
    readonly borderRadius?: BorderRadiusGeometry | null;
    readonly shape?: ShapeBorder | null;
    readonly borderOnForeground?: boolean;
    readonly clipBehavior?: Clip;
    readonly animationDuration?: number;
    readonly child?: Widget | null;
    readonly animateColor?: boolean;
}
export class Material extends StatefulWidget {


    readonly type: MaterialType;
    /** @dartType double */
    readonly elevation: number;
    readonly color: Color | null;
    readonly shadowColor: Color | null;
    readonly surfaceTintColor: Color | null;
    readonly textStyle: TextStyle | null;
    readonly borderRadius: BorderRadiusGeometry | null;
    readonly shape: ShapeBorder | null;
    readonly borderOnForeground: boolean;
    readonly clipBehavior: Clip;
    readonly animationDuration: number;
    readonly child: Widget | null;
    readonly animateColor: boolean;

    /** Original Duration is represented in host milliseconds. */

    constructor({ key = null, type = MaterialType.canvas, elevation = 0, color = null, shadowColor = null, surfaceTintColor = null, textStyle = null, borderRadius = null, shape = null, borderOnForeground = true, clipBehavior = 'none', animationDuration = 200, child = null, animateColor = false }: MaterialOptions = {}) {
        super(key);
        invariant(MaterialType.values.includes(type), 'invalid-material-type', 'Unknown MaterialType');
        invariant(Number.isFinite(elevation) && elevation >= 0, 'invalid-material-elevation', 'Material elevation must be finite and nonnegative');
        invariant(!(shape && borderRadius) && !(type === MaterialType.circle && (shape || borderRadius)), 'conflicting-material-shape', 'Material circle cannot specify a shape/radius and shape and radius are exclusive');
        invariant(Number.isFinite(animationDuration) && animationDuration >= 0, 'invalid-material-duration', 'Material duration must be finite and nonnegative');
        this.type = type;
        this.elevation = elevation;
        this.color = color;
        this.shadowColor = shadowColor;
        this.surfaceTintColor = surfaceTintColor;
        this.textStyle = textStyle;
        this.borderRadius = borderRadius;
        this.shape = shape;
        this.borderOnForeground = borderOnForeground;
        this.clipBehavior = clipBehavior;
        this.animationDuration = animationDuration;
        this.child = child;
        this.animateColor = animateColor;
    }

    /** @dartType double */
    static readonly defaultSplashRadius = materialDefaultSplashRadius;


    static maybeOf(context: BuildContext): MaterialInkController | null {
        return LookupBoundary.findAncestorRenderObjectOfType(context, MaterialInkRender);
    }


    static of(context: BuildContext): MaterialInkController {
        const controller = this.maybeOf(context);
        invariant(controller !== null, 'missing-material', 'Material.of requires a Material ancestor within the closest LookupBoundary');
        return controller;
    }


    createState(): State {
        return new MaterialState();
    }


    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        for (const key of ['type', 'elevation', 'color', 'shadowColor', 'surfaceTintColor', 'textStyle', 'shape', 'borderOnForeground', 'borderRadius'] as const) properties.add(new DiagnosticsProperty(key, this[key]));
    }


}
class MaterialState extends TickerProviderStateMixin<Material> {


    private readonly inkKey = new GlobalKey();
    private renderer: MaterialInkRender | null = null;


    build(context: BuildContext): Widget {
        const widget = this.widget, theme = Theme.of(context), background = widget.color ?? (widget.type === MaterialType.canvas ? theme.canvasColor : widget.type === MaterialType.card ? theme.cardColor : null), shadow = widget.shadowColor ?? new Color(theme.colorScheme.shadow);
        invariant(background !== null || widget.type === MaterialType.transparency, 'missing-material-color', 'Material button and circle require a color');


        const child = widget.child ? new AnimatedDefaultTextStyle({ style: widget.textStyle ?? theme.textTheme.bodyMedium!, duration: widget.animationDuration, child: widget.child }) : undefined;


        const contents = new NotificationListener({
notificationType: LayoutChangedNotification, onNotification: () => {
                this.renderer?.didChangeLayout();
                return false;
            }, child: new InkFeatures({
key: this.inkKey, color: background, vsync: this, absorbHitTest: widget.type !== MaterialType.transparency, ...child ? { child } : {}, onCreated: render => {
                    this.renderer = render;
                }
})
});


        let shape = widget.borderRadius ? new RoundedRectangleBorder({ borderRadius: widget.borderRadius }) : widget.shape;


        if (widget.type === MaterialType.canvas && shape === null) {
            const color = ElevationOverlay.applySurfaceTint(background!, widget.surfaceTintColor, widget.elevation);
            return new AnimatedPhysicalModel({ curve: Curves.fastOutSlowIn, duration: widget.animationDuration, clipBehavior: widget.clipBehavior, elevation: widget.elevation, color: color.toARGB32(), shadowColor: shadow.toARGB32(), animateColor: widget.animateColor, child: contents });
        }


        shape ??= widget.type === MaterialType.circle ? new CircleBorder() : new RoundedRectangleBorder({ borderRadius: widget.type === MaterialType.card || widget.type === MaterialType.button ? BorderRadius.circular(2) : BorderRadius.zero });


        if (widget.type === MaterialType.transparency) return new ClipPath(borderPaint(contents, shape, true, context), { clipper: new ShapeBorderClipper({ shape, textDirection: context.maybeDependOn(Directionality)?.direction ?? null }), clipBehavior: widget.clipBehavior });


        return new MaterialInterior({ curve: Curves.fastOutSlowIn, duration: widget.animationDuration, child: contents, shape, borderOnForeground: widget.borderOnForeground, clipBehavior: widget.clipBehavior, elevation: widget.elevation, color: background!, shadowColor: shadow, surfaceTintColor: widget.surfaceTintColor });


    }


    override dispose(): void {
        try {
            this.renderer?.retire();
        } finally {
            super.dispose();
        }
    }


}
interface InkFeaturesOptions extends WidgetOptions {
    readonly child?: Widget;
    readonly color: Color | null;
    readonly vsync: TickerProvider;
    readonly absorbHitTest: boolean;
    readonly onCreated: (render: MaterialInkRender) => void;
}
class InkFeatures extends SingleChildRenderObjectWidget {


    constructor(readonly options: InkFeaturesOptions) {
        super(options.child, options);
    }


    createRenderObject(): MaterialInkRender {
        const render = new MaterialInkRender(this.options.vsync, this.options.color, this.options.absorbHitTest);
        this.options.onCreated(render);
        return render;
    }


    override updateRenderObject(_context: BuildContext, render: RenderObject): void {
        invariant(render instanceof MaterialInkRender && render.vsync === this.options.vsync, 'material-ink-owner-change', 'Material ink renderer requires the same State ticker owner');
        render.color = this.options.color;
        render.absorbHitTest = this.options.absorbHitTest;
    }


}
export class ShapeBorderTween extends Tween<ShapeBorder | null> {
    /** @dartParam t double */
    override lerp(t: number): ShapeBorder | null {
        return ShapeBorder.lerp(this.begin, this.end, t);
    }
}
interface InteriorOptions extends ImplicitlyAnimatedWidgetOptions {
    readonly child: Widget;
    readonly shape: ShapeBorder;
    readonly borderOnForeground: boolean;
    readonly clipBehavior: Clip;
    readonly elevation: number;
    readonly color: Color;
    readonly shadowColor: Color;
    readonly surfaceTintColor: Color | null;
}
class MaterialInterior extends ImplicitlyAnimatedWidget {
    constructor(readonly options: InteriorOptions) {
        super(options);
    }
    createState(): MaterialInteriorState {
        return new MaterialInteriorState();
    }
}
class MaterialInteriorState extends AnimatedWidgetBaseState<MaterialInterior> {


    private elevation: Tween<number> | null = null;
    private shadow: Tween<Color | null> | null = null;
    private tint: Tween<Color | null> | null = null;
    private border: Tween<ShapeBorder | null> | null = null;


    protected forEachTween(visitor: TweenVisitor): void {
        const w = this.widget.options;
        this.elevation = visitor(this.elevation, w.elevation, value => new Tween({ begin: value }));
        this.shadow = visitor<Color | null>(this.shadow, w.shadowColor, value => new ColorTween({ begin: value }));
        this.tint = w.surfaceTintColor !== null ? visitor<Color | null>(this.tint, w.surfaceTintColor, value => new ColorTween({ begin: value })) : null;
        this.border = visitor<ShapeBorder | null>(this.border, w.shape, value => new ShapeBorderTween({ begin: value }));
    }


    build(context: BuildContext): Widget {
        const w = this.widget.options, shape = this.border!.evaluate(this.animation)!, elevation = this.elevation!.evaluate(this.animation), color = ElevationOverlay.applySurfaceTint(w.color, this.tint?.evaluate(this.animation) ?? null, elevation);
        return new PhysicalShape({ clipper: new ShapeBorderClipper({ shape, textDirection: context.maybeDependOn(Directionality)?.direction ?? null }), clipBehavior: w.clipBehavior, elevation, color: color.toARGB32(), shadowColor: this.shadow!.evaluate(this.animation)!.toARGB32(), child: borderPaint(w.child, shape, w.borderOnForeground, context) });
    }


}
class ShapePainter extends CustomPainter {
    constructor(readonly border: ShapeBorder, readonly direction: 'ltr' | 'rtl' | null) {
        super();
    }
    paint(canvas: Canvas, size: Size): void {
        this.border.paint(canvas, Rect.fromLTWH(0, 0, size.width, size.height), { textDirection: this.direction });
    }
    shouldRepaint(old: CustomPainter): boolean {
        return !(old instanceof ShapePainter) || old.border !== this.border || old.direction !== this.direction;
    }
}
function borderPaint(child: Widget, shape: ShapeBorder, foreground: boolean, context: BuildContext): Widget {
    const painter = new ShapePainter(shape, context.maybeDependOn(Directionality)?.direction ?? null);
    return new CustomPaint(child, foreground ? { foregroundPainter: painter } : { painter });
}
