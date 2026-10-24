// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Pinned ink_decoration.dart on the existing image, decoration and Material ink owners.
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import type { Widget, WidgetOptions, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Padding, Builder, SizedBox, ConstrainedBox } from '@nelyx/core/framework/widgets/basic';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { RenderBox } from '@nelyx/core/framework/rendering/object';
import { Visibility } from '@nelyx/core/framework/widgets/visibility';
import { createLocalImageConfiguration } from '@nelyx/core/framework/widgets/image';
import { EdgeInsets, EdgeInsetsGeometry } from '@nelyx/core/framework/painting/edge-insets';
import { Decoration } from '@nelyx/core/framework/painting/decoration';
import type { BoxPainter } from '@nelyx/core/framework/painting/decoration';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { DecorationImage } from '@nelyx/core/framework/painting/decoration-image';
import type { ImageProvider } from '@nelyx/core/framework/painting/image-provider';
import type { ImageErrorListener } from '@nelyx/core/framework/painting/image-stream';
import type { ImageRepeat } from '@nelyx/core/framework/painting/decoration-image';
import type { BoxFit } from '@nelyx/core/framework/painting/box-fit';
import type { AlignmentGeometry } from '@nelyx/core/framework/painting/alignment';
import type { ColorFilter } from '@nelyx/core/ui/color-filter';
import type { Rect } from '@nelyx/core/ui/rect';
import { ImageConfiguration } from '@nelyx/core/framework/painting/image-configuration';
import { MatrixUtils } from '@nelyx/core/framework/painting/matrix-utils';
import { valueEquals } from '@nelyx/core/framework/painting/value-equality';
import type { Matrix4 } from '@nelyx/core/math/matrix4';
import { Offset } from '@nelyx/core/ui/offset';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Color } from '@nelyx/core/ui/color';
import { DiagnosticsProperty } from '@nelyx/core/foundation/diagnostics';
import type { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import { invariant } from '@nelyx/core/foundation/errors';
import { Material, InkFeature } from './material.ts';
import type { InkFeatureOptions } from './material.ts';
export interface InkOptions extends WidgetOptions {
    readonly child?: Widget | null;
    readonly padding?: EdgeInsetsGeometry | null;
    readonly decoration?: Decoration | null;
    readonly color?: Color | null; /** @dartType double? */
    readonly width?: number | null; /** @dartType double? */
    readonly height?: number | null;
}
export interface InkImageOptions extends Omit<InkOptions, 'color' | 'decoration'> {
    readonly image: ImageProvider;
    readonly onImageError?: ImageErrorListener | null;
    readonly colorFilter?: ColorFilter | null;
    readonly fit?: BoxFit | null;
    readonly alignment?: AlignmentGeometry;
    readonly centerSlice?: Rect | null;
    readonly repeat?: ImageRepeat;
    readonly matchTextDirection?: boolean;
}
export class Ink extends StatefulWidget {
    readonly child: Widget | null;
    readonly padding: EdgeInsetsGeometry | null;
    readonly decoration: Decoration | null; /** @dartType double? */
    readonly width: number | null; /** @dartType double? */
    readonly height: number | null;
    constructor({ key = null, child = null, padding = null, decoration = null, color = null, width = null, height = null }: InkOptions = {}) {
        super(key);
        invariant(padding === null || padding.isNonNegative, 'invalid-ink-padding', 'Ink padding must be nonnegative');
        invariant(decoration === null || decoration.debugAssertIsValid(), 'invalid-ink-decoration', 'Ink requires a valid decoration');
        invariant(color === null || decoration === null, 'conflicting-ink-decoration', 'Ink color and decoration are exclusive');
        this.child = child;
        this.padding = padding;
        this.decoration = decoration ?? (color !== null ? new BoxDecoration({ color: color.toARGB32() }) : null);
        this.width = width;
        this.height = height;
    }
    static image({ image, onImageError = null, colorFilter = null, fit = null, alignment, centerSlice = null, repeat = 'noRepeat', matchTextDirection = false, ...options }: InkImageOptions): Ink {
        return new Ink({ ...options, decoration: new BoxDecoration({ image: new DecorationImage({
                    image, onError: onImageError, colorFilter, fit, ...alignment ? { alignment } : {}, centerSlice, repeat, matchTextDirection
                }) }) });
    }
    get paddingIncludingDecoration(): EdgeInsetsGeometry {
        return (this.padding ?? EdgeInsets.zero).add(this.decoration?.padding ?? EdgeInsets.zero);
    }
    createState(): State {
        return new InkState();
    }
    override debugFillProperties(properties: DiagnosticPropertiesBuilder): void {
        super.debugFillProperties(properties);
        properties.add(new DiagnosticsProperty('padding', this.padding, { defaultValue: null }));
        properties.add(new DiagnosticsProperty('bg', this.decoration, { defaultValue: null }));
    }
}
class InkState extends State<Ink> {
    private readonly boxKey = new GlobalKey();
    private ink: InkDecoration | null = null;
    private readonly removed = () => {
        this.ink = null;
    };
    private buildContents(context: BuildContext): Widget {
        if (this.ink === null) {
            const reference = this.boxKey.currentContext?.findRenderObject();
            invariant(reference instanceof RenderBox, 'missing-ink-reference', 'Ink requires its actual Padding render box');
            this.ink = new InkDecoration({
                decoration: this.widget.decoration, isVisible: Visibility.of(context), configuration: createLocalImageConfiguration(context), controller: Material.of(context), referenceBox: reference, onRemoved: this.removed
            });
        }
        else {
            this.ink.decoration = this.widget.decoration;
            this.ink.isVisible = Visibility.of(context);
            this.ink.configuration = createLocalImageConfiguration(context);
        }
        return this.widget.child ?? new ConstrainedBox(undefined, BoxConstraints.expand());
    }
    build(context: BuildContext): Widget {
        Material.of(context);
        let result: Widget = new Padding(this.widget.paddingIncludingDecoration, new Builder(c => this.buildContents(c)), this.boxKey);
        if (this.widget.width !== null || this.widget.height !== null)
            result = new SizedBox(this.widget.width ?? undefined, this.widget.height ?? undefined, result);
        return result;
    }
    override deactivate(): void {
        try {
            this.ink?.dispose();
        }
        finally {
            super.deactivate();
        }
    }
    override dispose(): void {
        try {
            this.ink?.dispose();
        }
        finally {
            super.dispose();
        }
    }
}
export interface InkDecorationOptions extends InkFeatureOptions {
    readonly decoration: Decoration | null;
    readonly configuration: ImageConfiguration;
    readonly isVisible?: boolean;
}
export class InkDecoration extends InkFeature {
    private painter: BoxPainter | null = null;
    private currentDecoration: Decoration | null = null;
    private visible = true;
    private currentConfiguration: ImageConfiguration;
    constructor({ decoration, configuration, isVisible = true, ...options }: InkDecorationOptions) {
        super(options);
        this.currentConfiguration = configuration;
        this.decoration = decoration;
        this.isVisible = isVisible;
        this.controller.addInkFeature(this);
    }
    private assertLive(): void {
        invariant(!this.debugDisposed, 'disposed-ink-decoration', 'InkDecoration is disposed');
    }
    get decoration(): Decoration | null {
        return this.currentDecoration;
    }
    set decoration(value: Decoration | null) {
        this.assertLive();
        if (valueEquals(value, this.currentDecoration))
            return;
        this.currentDecoration = value;
        this.painter?.dispose();
        this.painter = value?.createBoxPainter(() => {
            if (!this.debugDisposed)
                this.controller.markNeedsPaint();
        }) ?? null;
        this.controller.markNeedsPaint();
    }
    get isVisible(): boolean {
        return this.visible;
    }
    set isVisible(value: boolean) {
        this.assertLive();
        if (value === this.visible)
            return;
        this.visible = value;
        this.controller.markNeedsPaint();
    }
    get configuration(): ImageConfiguration {
        return this.currentConfiguration;
    }
    set configuration(value: ImageConfiguration) {
        this.assertLive();
        if (value.equals(this.currentConfiguration))
            return;
        this.currentConfiguration = value;
        this.controller.markNeedsPaint();
    }
    protected paintFeature(canvas: Canvas, transform: Matrix4): void {
        if (this.painter === null || !this.visible)
            return;
        const origin = MatrixUtils.getAsTranslation(transform), configuration = this.currentConfiguration.copyWith({ size: this.referenceBox.size });
        if (origin === null) {
            canvas.save();
            try {
                canvas.transform(transform.storage);
                this.painter.paint(canvas, Offset.zero, configuration);
            }
            finally {
                canvas.restore();
            }
        }
        else
            this.painter.paint(canvas, origin, configuration);
    }
    override dispose(): void {
        if (this.debugDisposed)
            return;
        const painter = this.painter;
        this.painter = null;
        try {
            painter?.dispose();
        }
        finally {
            super.dispose();
        }
    }
}
