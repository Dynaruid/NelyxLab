// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import { InteractiveInkFeature, InteractiveInkFeatureFactory } from './ink-feature.ts';
import type { InteractiveInkFeatureOptions, InkFactoryOptions } from './ink-feature.ts';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Matrix4 } from '@nelyx/core/math/matrix4';
class NoSplashFactory extends InteractiveInkFeatureFactory {
    create({ controller, referenceBox, color, onRemoved }: InkFactoryOptions): NoSplash {
        return new NoSplash({
            controller, referenceBox, color, ...onRemoved ? { onRemoved } : {}
        });
    }
}
/** Complete original no-visual feature: it owns no ticker/paint registration and removes on confirm/cancel. */
export class NoSplash extends InteractiveInkFeature {
    static readonly splashFactory: InteractiveInkFeatureFactory = Object.freeze(new NoSplashFactory());
    constructor(options: Omit<InteractiveInkFeatureOptions, 'customBorder'>) {
        super(options);
    }
    protected paintFeature(_canvas: Canvas, _transform: Matrix4): void {
    }
    override confirm(): void {
        super.confirm();
        this.dispose();
    }
    override cancel(): void {
        super.cancel();
        this.dispose();
    }
}
