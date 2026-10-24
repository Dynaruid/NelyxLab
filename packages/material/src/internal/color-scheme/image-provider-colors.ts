// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Original image load/112px nearest raster policy on explicit Core View owners.
import {invariant} from '@nelyx/core/foundation/errors';
import type {Disposable} from '@nelyx/core/foundation/disposable';
import {ImageConfiguration} from '@nelyx/core/framework/painting/image-configuration';
import type {ImageProvider} from '@nelyx/core/framework/painting/image-provider';
import {ImageStreamListener} from '@nelyx/core/framework/painting/image-stream';
import type {ImageInfo} from '@nelyx/core/framework/painting/image-stream';
import {PictureRecorder} from '@nelyx/core/ui/picture-recorder';
import type {Picture} from '@nelyx/core/ui/picture';
import type {RasterizationService} from '@nelyx/core/hosting/rasterization';
import type {Image} from '@nelyx/core/ui/image';
import {Canvas} from '@nelyx/core/ui/canvas';
import {Paint} from '@nelyx/core/ui/paint';
import {Size} from '@nelyx/core/ui/size';
import {Rect} from '@nelyx/core/ui/rect';

async function scaledPixels(info: ImageInfo, configuration: ImageConfiguration, rasterizer: RasterizationService): Promise<Uint8Array> {
    const recorder = new PictureRecorder(), canvas = new Canvas(recorder);
    let picture: Picture | undefined, image: Image | undefined, pixels: Uint8Array | null = null;
    const errors: unknown[] = [];
    try {
        invariant(configuration.images !== null && !configuration.images.isClosed, 'closed-image-owner', 'ColorScheme image owner closed');
        const original = info.image, maximum = 112;
        let width = original.width, height = original.height;
        if (width > maximum || height > maximum) {
            width = original.width > original.height ? maximum : maximum / original.height * original.width;
            height = original.height > original.width ? maximum : maximum / original.width * original.height;
        }
        canvas.drawImageRect(original, Rect.fromLTWH(0, 0, original.width, original.height), Rect.fromLTWH(0, 0, width, height), new Paint({filterQuality: 'none', isAntiAlias: false}));
        picture = recorder.endRecording();
        image = await picture.toImage(Math.trunc(width), Math.trunc(height), rasterizer);
        invariant(configuration.images !== null && !configuration.images.isClosed, 'closed-image-owner', 'ColorScheme image owner closed');
        pixels = await image.toByteData();
        invariant(pixels !== null && pixels.length === image.width * image.height * 4, 'invalid-palette-pixels', 'Image rasterizer did not return complete RGBA pixels');
        invariant(!configuration.images.isClosed, 'closed-image-owner', 'ColorScheme image owner closed');
    } catch (error) {errors.push(error);}
    for (const cleanup of [() => image?.dispose(), () => picture?.dispose(), () => canvas.dispose(), () => info.dispose()]) {
        try {cleanup();} catch (error) {errors.push(error);}
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'ColorScheme image extraction/retirement failed');
    return pixels!;
}

export function imageProviderPixels(provider: ImageProvider, configuration: ImageConfiguration, rasterizer: RasterizationService): Promise<Uint8Array> {
    invariant(configuration instanceof ImageConfiguration, 'invalid-image-configuration', 'Expected a canonical Core ImageConfiguration');
    const images = configuration.images;
    invariant(images !== null && !images.isClosed, 'missing-image-owner', 'ColorScheme.fromImageProvider requires an open ImageService');
    invariant(rasterizer && typeof rasterizer.rasterize === 'function', 'missing-rasterizer', 'ColorScheme.fromImageProvider requires the owning rasterization service');
    invariant(rasterizer.resources === images.resources, 'image-owner-mismatch', 'Image and rasterization services must share the same View resource owner');
    const resolved = configuration.copyWith({size: new Size(112, 112)}), stream = provider.resolve(resolved);
    return new Promise<Uint8Array>((resolve, reject) => {
        let completed = false, received = false, attached = false;
        let timer: Disposable | undefined, close: Disposable | undefined;
        const detach = () => {if (attached) {attached = false; stream.removeListener(listener);} timer?.dispose(); timer = undefined;};
        const finish = (pixels: Uint8Array | null, error?: unknown) => {
            if (completed) return;
            completed = true;
            const errors: unknown[] = error === undefined ? [] : [error];
            for (const cleanup of [detach, () => close?.dispose()]) {try {cleanup();} catch (failure) {errors.push(failure);}}
            close = undefined;
            if (errors.length) reject(errors.length === 1 ? errors[0] : new AggregateError(errors, 'ColorScheme image load/retirement failed'));
            else resolve(pixels!);
        };
        const listener = new ImageStreamListener(info => {
            if (received || completed) {info.dispose(); return;}
            received = true;
            try {detach();} catch (error) {try {info.dispose();} catch (cleanup) {finish(null, new AggregateError([error, cleanup], 'Image listener retirement failed')); return;} finish(null, error); return;}
            if (completed || images.isClosed) {info.dispose(); return;}
            const operation = Promise.resolve().then(() => scaledPixels(info, resolved, rasterizer));
            void images.trackImageOperation(operation).then(pixels => finish(pixels), error => finish(null, error));
        }, {onError: error => finish(null, new Error('Failed to render image: ' + String(error), {cause: error}))});
        close = images.addCloseListener(() => finish(null, new Error('ColorScheme image owner closed')));
        if (completed) {close.dispose(); return;}
        timer = images.scheduleTimer(() => {const error = new Error('Timeout occurred trying to load image'); error.name = 'TimeoutError'; finish(null, error);}, 5000);
        if (!completed) {
            attached = true;
            try {stream.addListener(listener);} catch (error) {finish(null, error);}
        }
    });
}
