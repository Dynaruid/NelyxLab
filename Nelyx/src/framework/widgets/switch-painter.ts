// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Functional source Switch painter; Core owns decoration/image/text resolution and retirement.
import { CustomPainter } from '../rendering/custom-paint.ts';
import { ChangeNotifier } from '../../foundation/notifier.ts';
import type { Canvas } from '../../ui/canvas.ts';
import { Paint } from '../../ui/paint.ts';
import { Color } from '../../ui/color.ts';
import { sourceColorLerp } from '../../ui/color-source-adapter.ts';
import { Offset } from '../../ui/offset.ts';
import { Size } from '../../ui/size.ts';
import { Rect } from '../../ui/rect.ts';
import { RRect } from '../../ui/rrect.ts';
import { Cubic } from '../animation/curves.ts';
import { AnimationStatus } from '../animation/animation.ts';
import type { BoxShadow } from '../painting/box-shadow.ts';
import type { ToggleableMotionProfile } from './toggleable-control.ts';
import type { ToggleableMotion } from './toggleable-control.ts';
import { BoxDecoration } from '../painting/box-decoration.ts';
import type { BoxPainter } from '../painting/decoration.ts';
import { BorderRadius } from '../painting/border-radius.ts';
import { DecorationImage } from '../painting/decoration-image.ts';
import type { ImageProvider } from '../painting/image-provider.ts';
import type { ImageErrorListener } from '../painting/image-stream.ts';
import type { ImageConfiguration } from '../painting/image-configuration.ts';
import { TextPainter } from '../painting/text-painter.ts';
import type { ParagraphContext } from '../../ui/paragraph.ts';
import { TextSpan } from '../painting/text-span.ts';
import { TextStyle } from '../painting/text-style.ts';
import { FontVariation } from '../../ui/typography.ts';
import type { IconThemeData } from './icon-theme-data.ts';
import type { Icon } from './icon.ts';
import { valueEquals } from '../painting/value-equality.ts';
import { invariant } from '../../foundation/errors.ts';
export interface SwitchConfig {
    readonly isCupertino: boolean;
    readonly trackWidth: number; readonly trackHeight: number;
    readonly activeRadius: number; readonly inactiveRadius: number; readonly pressedRadius: number;
    readonly iconRadius: number; readonly transitionalWidth: number; readonly transitionalHeight: number;
    readonly shadows: readonly BoxShadow[];
    readonly motion: ToggleableMotionProfile;
}

export interface SwitchPaintValues {
    readonly activeColor: Color; readonly inactiveColor: Color;
    readonly activePressedColor: Color; readonly inactivePressedColor: Color;
    readonly activeTrackColor: Color; readonly inactiveTrackColor: Color;
    readonly activeOutline: Color | null; readonly inactiveOutline: Color | null;
    readonly activeOutlineWidth: number | null; readonly inactiveOutlineWidth: number | null;
    readonly activeIcon: Icon | null; readonly inactiveIcon: Icon | null;
    readonly activeIconColor: Color; readonly inactiveIconColor: Color;
    readonly activeRadius: number; readonly inactiveRadius: number;
    readonly activeReaction: Color; readonly inactiveReaction: Color;
    readonly focusColor: Color; readonly hoverColor: Color; readonly splashRadius: number;
}


export interface SwitchPainterOptions extends SwitchPaintValues, ToggleableMotion {
    readonly config: SwitchConfig; readonly position: number; readonly rtl: boolean;
    readonly surface: Color; readonly isFocused: boolean; readonly isHovered: boolean;
    readonly activeImage: ImageProvider | null; readonly inactiveImage: ImageProvider | null;
    readonly activeError: ImageErrorListener | null; readonly inactiveError: ImageErrorListener | null;
    readonly configuration: ImageConfiguration; readonly iconTheme: IconThemeData;
    readonly paragraphContext: ParagraphContext | null;
    /** Source Cupertino-only painter policy; Material adaptive retains its original motion. */
    readonly cupertino?: boolean;
    readonly onOffLabels?: {readonly on: Color; readonly off: Color} | null;
}
/** @dartType double */ const onLabelWidth = 1;
/** @dartType double */ const onLabelHeight = 10;
/** @dartType double */ const onLabelPadding = 11;
/** @dartType double */ const offLabelWidth = 1;
/** @dartType double */ const offLabelPadding = 12;
/** @dartType double */ const offLabelRadius = 5;
/** @dartType double */ const cupertinoThumbRadius = 14;
/** @dartType double */ const cupertinoThumbExtension = 7;
const firstCurve = new Cubic(.31, 0, .56, 1), secondCurve = new Cubic(.20, 0, 0, 1);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const sizeLerp = (a: Size, b: Size, t: number) => new Size(lerp(a.width, b.width, t), lerp(a.height, b.height, t));
function nullableLerp(a: number | null, b: number | null, t: number): number | null { return a === null && b === null ? null : lerp(a ?? 0, b ?? 0, t); }
export class SwitchPainter extends CustomPainter {
    private values: SwitchPainterOptions | null = null;
    private textPainter: TextPainter | null = null;
    private decoration: BoxPainter | null = null;
    private cachedColor: Color | null = null; private cachedImage: ImageProvider | null = null; private cachedError: ImageErrorListener | null = null; private cachedHeight: number | null = null;
    private painting = false; private retired = false; private stopPress = false;
    private pressedInactive: number | null = null; private pressedActive: number | null = null; private extension = 0;
    constructor(private readonly signal = new ChangeNotifier()) { super({repaint: signal}); }
    get options(): SwitchPainterOptions { invariant(this.values !== null, 'unconfigured-switch-painter', 'Switch painter needs current values'); return this.values; }
    update(values: SwitchPainterOptions): void { invariant(!this.retired, 'disposed-switch-painter', 'Cannot update a retired switch painter'); this.values = values; this.signal.notifyListeners(); }
    private readonly decorationChanged = () => { if (!this.painting && !this.retired) this.signal.notifyListeners(); };
    private thumbSize(): Size {
        const o = this.options, c = o.config, t = o.position;
        if (o.cupertino) { this.extension = o.reaction * cupertinoThumbExtension; return new Size(cupertinoThumbRadius * 2 + this.extension, cupertinoThumbRadius * 2); }
        if (o.reactionStatus === AnimationStatus.reverse && !this.stopPress) this.stopPress = true; else this.stopPress = false;
        if (!this.stopPress) {
            this.extension = c.isCupertino ? o.reaction * 7 : 0;
            if (o.reactionStatus === AnimationStatus.completed) { this.pressedInactive = lerp(o.inactiveRadius, c.pressedRadius, o.reaction); this.pressedActive = lerp(o.activeRadius, c.pressedRadius, o.reaction); }
            if (t === 0) { this.pressedInactive = lerp(o.inactiveRadius, c.pressedRadius, o.reaction); this.pressedActive = o.activeRadius; }
            if (t === 1) { this.pressedActive = lerp(o.activeRadius, c.pressedRadius, o.reaction); this.pressedInactive = o.inactiveRadius; }
        }
        const a = this.pressedInactive ?? o.inactiveRadius, b = this.pressedActive ?? o.activeRadius;
        const inactive = new Size(a * 2 + this.extension, a * 2), active = new Size(b * 2 + this.extension, b * 2);
        if (c.isCupertino) return o.reactionStatus === AnimationStatus.completed ? inactive : sizeLerp(inactive, active, t);
        if (o.reactionStatus === AnimationStatus.completed) return new Size(c.pressedRadius * 2, c.pressedRadius * 2);
        const transitional = new Size(c.transitionalWidth, c.transitionalHeight), raw = o.rawPosition;
        if (o.positionStatus === AnimationStatus.dismissed || o.positionStatus === AnimationStatus.forward) {
            if (raw < .11) return sizeLerp(inactive, transitional, firstCurve.transform(raw / .11));
            if (raw < .83) return sizeLerp(transitional, active, secondCurve.transform((raw - .11) / .72));
            return active;
        }
        if (raw < .17) return inactive;
        if (raw < .89) return sizeLerp(inactive, transitional, secondCurve.flipped.transform((raw - .17) / (.89 - .17)));
        return sizeLerp(transitional, active, firstCurve.flipped.transform((raw - .89) / (1 - .89)));
    }
    private icon(canvas: Canvas, icon: Icon, origin: Offset, size: Size, color: Color): void {
        const data = icon.icon; if (data === null) return;
        const context = this.options.paragraphContext;
        invariant(context !== null, 'missing-switch-font', 'Switch thumb icons require an application font');
        if (this.textPainter === null) this.textPainter = new TextPainter({}, context); else this.textPainter._updateContext(context);
        const theme = this.options.iconTheme, iconSize = icon.size ?? 16, variations: FontVariation[] = [];
        for (const [axis, value] of [['FILL', icon.fill ?? theme.fill], ['wght', icon.weight ?? theme.weight], ['GRAD', icon.grade ?? theme.grade], ['opsz', icon.opticalSize ?? theme.opticalSize]] as const) if (value !== null) variations.push(new FontVariation(axis, value));
        this.textPainter.textDirection = this.options.rtl ? 'rtl' : 'ltr';
        this.textPainter.text = new TextSpan({text: String.fromCodePoint(data.codePoint), style: new TextStyle({fontVariations: variations, color: color.toARGB32(), fontSize: iconSize, inherit: false, fontFamily: data.fontFamily, package: data.fontPackage, shadows: icon.shadows ?? theme.shadows})});
        this.textPainter.layout(); this.textPainter.paint(canvas, origin.add(new Offset((size.width - iconSize) / 2, (size.height - iconSize) / 2)));
    }
    paint(canvas: Canvas, size: Size): void {
        invariant(!this.retired, 'disposed-switch-painter', 'Cannot paint a retired Switch');
        const o = this.options, c = o.config, colorT = o.colorPosition, thumbSize = this.thumbSize(), visual = o.rtl ? 1 - o.position : o.position;
        const trackOffset = new Offset((size.width - c.trackWidth) / 2, (size.height - c.trackHeight) / 2), trackRadius = c.trackHeight / 2;
        const thumbOffset = new Offset(trackOffset.dx + trackRadius + this.extension / 2 - thumbSize.width / 2 + visual * (c.trackWidth - c.trackHeight - this.extension), trackOffset.dy + trackRadius - thumbSize.height / 2);
        const track = Rect.fromLTWH(trackOffset.dx, trackOffset.dy, c.trackWidth, c.trackHeight), trackRRect = RRect.fromRectXY(track, trackRadius, trackRadius);
        canvas.drawRRect(trackRRect, new Paint({color: sourceColorLerp(o.inactiveTrackColor, o.activeTrackColor, o.cupertino ? o.position : colorT)!.toARGB32()}));
        const outline = o.inactiveOutline === null || o.activeOutline === null ? null : sourceColorLerp(o.inactiveOutline, o.activeOutline, colorT);
        if (outline !== null) canvas.drawRRect(RRect.fromRectXY(track.deflate(1), trackRadius, trackRadius), new Paint({color: outline.toARGB32(), style: 'stroke', strokeWidth: nullableLerp(o.inactiveOutlineWidth, o.activeOutlineWidth, colorT) ?? 2}));
        if (c.isCupertino) {
            if (o.isFocused) canvas.drawRRect(trackRRect.inflate(1.75), new Paint({color: o.focusColor.toARGB32(), style: 'stroke', strokeWidth: 3.5}));
            canvas.clipRRect(trackRRect);
        }
        if (o.reaction !== 0 || o.reactionFocusFade !== 0 || o.reactionHoverFade !== 0) {
            const color = sourceColorLerp(sourceColorLerp(sourceColorLerp(o.inactiveReaction, o.activeReaction, o.position), o.hoverColor, o.reactionHoverFade), o.focusColor, o.reactionFocusFade)!;
            const radius = o.isFocused || o.isHovered ? o.splashRadius : o.splashRadius * o.reaction;
            if (radius > 0) canvas.drawCircle(new Offset(thumbOffset.dx + thumbSize.height / 2, size.height / 2), radius, new Paint({color: color.toARGB32()}));
        }
        if (o.onOffLabels) {
            const reaction = 1 - o.reaction, onOpacity = o.position * reaction, offOpacity = (1 - o.position) * reaction;
            const on = new Offset(o.rtl ? track.right - onLabelPadding : track.left + onLabelPadding, track.center.dy), off = new Offset(o.rtl ? track.left + offLabelPadding : track.right - offLabelPadding, track.center.dy);
            canvas.drawRect(Rect.fromCenter({center: on, width: onLabelWidth, height: onLabelHeight}), new Paint({color: o.onOffLabels.on.withOpacity(onOpacity).toARGB32()}));
            canvas.drawCircle(off, offLabelRadius, new Paint({color: o.onOffLabels.off.withOpacity(offOpacity).toARGB32(), style: 'stroke', strokeWidth: offLabelWidth}));
        }
        const thumbColor = Color.alphaBlend(o.reaction !== 0 ? sourceColorLerp(o.inactivePressedColor, o.activePressedColor, colorT)! : o.positionStatus === AnimationStatus.forward ? sourceColorLerp(o.inactivePressedColor, o.activeColor, colorT)! : o.positionStatus === AnimationStatus.reverse ? sourceColorLerp(o.inactiveColor, o.activePressedColor, colorT)! : sourceColorLerp(o.inactiveColor, o.activeColor, colorT)!, o.surface);
        const image = o.position < .5 ? o.inactiveImage : o.activeImage, error = o.position < .5 ? o.inactiveError : o.activeError, icon = o.position < .5 ? o.inactiveIcon : o.activeIcon;
        this.painting = true;
        try {
            if (this.decoration === null || !thumbColor.equals(this.cachedColor) || !valueEquals(image, this.cachedImage) || error !== this.cachedError || thumbSize.height !== this.cachedHeight) {
                this.decoration?.dispose(); this.cachedColor = thumbColor; this.cachedImage = image; this.cachedError = error; this.cachedHeight = thumbSize.height;
                this.decoration = new BoxDecoration({color: thumbColor.toARGB32(), image: image === null ? null : new DecorationImage({image, onError: error}), borderRadius: BorderRadius.circular(thumbSize.height / 2), boxShadow: c.isCupertino ? null : c.shadows}).createBoxPainter(this.decorationChanged);
            }
            if (c.isCupertino) {
                const bounds = RRect.fromRectXY(Rect.fromLTWH(thumbOffset.dx, thumbOffset.dy, thumbSize.width, thumbSize.height), thumbSize.height / 2, thumbSize.height / 2);
                for (const shadow of c.shadows) canvas.drawRRect(bounds.shift(shadow.offset), shadow.toPaint());
                canvas.drawRRect(bounds.inflate(.5), new Paint({color: 0x0a000000}));
            }
            this.decoration.paint(canvas, thumbOffset, o.configuration.copyWith({size: thumbSize}));
            if (icon !== null) this.icon(canvas, icon, thumbOffset, thumbSize, sourceColorLerp(o.inactiveIconColor, o.activeIconColor, colorT)!);
        } finally { this.painting = false; }
    }
    shouldRepaint(_old: SwitchPainter): boolean { return true; }
    dispose(): void {
        if (this.retired) return; this.retired = true; const errors: unknown[] = [];
        for (const close of [() => this.decoration?.dispose(), () => this.textPainter?.dispose(), () => this.signal.dispose()]) try {close();} catch (error) {errors.push(error);}
        this.decoration = null; this.values = null;
        if (errors.length) throw new AggregateError(errors, 'Switch painter retirement failed');
    }
}
