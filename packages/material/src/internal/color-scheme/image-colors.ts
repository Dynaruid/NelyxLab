// Copyright 2021 Google LLC
// SPDX-License-Identifier: Apache-2.0
// Dart MCU 0.13.0 Wsmeans/Celebi selection on typed JS vectors; see package notices.
import {QuantizerWu, labFromArgb, argbFromLab, Score} from '@material/material-color-utilities';
import {SeededRandom} from '@nelyx/core/internal/math/seeded-random';
import {invariant} from '@nelyx/core/foundation/errors';

/** @dartType List<double> */
type Lab = readonly [number, number, number];
function lab(color: number): Lab {
    const value = labFromArgb(color);
    return [value[0]!, value[1]!, value[2]!];
}
function distance(a: Lab, b: Lab): number {
    const l = a[0] - b[0], x = a[1] - b[1], y = a[2] - b[2];
    return l * l + x * x + y * y;
}
/**
 * @dartParam input Iterable<int>
 * @dartParam maxColors int
 * @dartReturn Map<int, int>
 */
export function quantizeMaterialImage(input: readonly number[], maxColors = 128): Map<number, number> {
    invariant(Number.isSafeInteger(maxColors) && maxColors >= 1 && maxColors <= 256, 'invalid-palette-size', 'Material image palette size must be 1..256');
    if (input.length === 0) return new Map();
    const pixelToCount = new Map<number, number>(), points: Lab[] = [], pixels: number[] = [];
    for (const pixel of input) {
        invariant(Number.isSafeInteger(pixel) && pixel >= 0 && pixel <= 0xffffffff, 'invalid-palette-color', 'Material image pixels must be ARGB uint32 integers');
        const count = (pixelToCount.get(pixel) ?? 0) + 1;
        pixelToCount.set(pixel, count);
        if (count === 1) {points.push(lab(pixel)); pixels.push(pixel);}
    }
    const counts = pixels.map(pixel => pixelToCount.get(pixel)!);
    const clusterCount = Math.min(maxColors, points.length);
    const clusters: Lab[] = new QuantizerWu().quantize([...input], maxColors).map(lab);
    if (clusters.length < clusterCount) {
        const random = new SeededRandom(0x42688), indices: number[] = [];
        for (let i = clusters.length; i < clusterCount; i++) {
            let index = random.nextInt(points.length);
            while (indices.includes(index)) index = random.nextInt(points.length);
            indices.push(index);
        }
        for (const index of indices) clusters.push(points[index]!);
    }
    const clusterIndices = points.map((_, index) => index % clusterCount);
    const matrix = Array.from({length: clusterCount}, () => Array.from({length: clusterCount}, (_, index) => ({distance: 0, index})));
    // oxlint-disable-next-line unicorn/no-new-array -- The numeric argument is the required length; preserve preallocation and sparse storage semantics.
    const populations: number[] = new Array(clusterCount).fill(0);
    for (let iteration = 0; iteration < 5; iteration++) {
        for (let i = 0; i < clusterCount; i++) {
            for (let j = i + 1; j < clusterCount; j++) {
                const value = distance(clusters[i]!, clusters[j]!);
                matrix[j]![i]!.distance = value; matrix[j]![i]!.index = i;
                matrix[i]![j]!.distance = value; matrix[i]![j]!.index = j;
            }
            matrix[i]!.sort((a, b) => a.distance - b.distance);
        }
        let moved = 0;
        for (let i = 0; i < points.length; i++) {
            const point = points[i]!, previous = clusterIndices[i]!;
            const previousDistance = distance(point, clusters[previous]!);
            let minimum = previousDistance, next = -1;
            for (let j = 0; j < clusterCount; j++) {
                if (matrix[previous]![j]!.distance >= 4 * previousDistance) continue;
                const candidate = distance(point, clusters[j]!);
                if (candidate < minimum) {minimum = candidate; next = j;}
            }
            if (next !== -1) {moved++; clusterIndices[i] = next;}
        }
        if (moved === 0 && iteration > 0) break;
        // oxlint-disable-next-line unicorn/no-new-array -- The numeric argument is the required length; preserve preallocation and sparse storage semantics.
        const a: number[] = new Array(clusterCount).fill(0), b: number[] = new Array(clusterCount).fill(0), c: number[] = new Array(clusterCount).fill(0);
        populations.fill(0);
        for (let i = 0; i < points.length; i++) {
            const cluster = clusterIndices[i]!, point = points[i]!, count = counts[i]!;
            populations[cluster]! += count;
            a[cluster]! += point[0] * count; b[cluster]! += point[1] * count; c[cluster]! += point[2] * count;
        }
        for (let i = 0; i < clusterCount; i++) {
            const count = populations[i]!;
            clusters[i] = count === 0 ? [0, 0, 0] : [a[i]! / count, b[i]! / count, c[i]! / count];
        }
    }
    const result = new Map<number, number>();
    for (let i = 0; i < clusterCount; i++) {
        const count = populations[i]!;
        if (count === 0) continue;
        const point = clusters[i]!, color = argbFromLab(point[0], point[1], point[2]);
        if (!result.has(color)) result.set(color, count);
    }
    return result;
}
export function materialImageSeed(rgba: Uint8Array): number {
    invariant(rgba.length > 0 && rgba.length % 4 === 0, 'invalid-palette-pixels', 'Expected nonempty RGBA image pixels');
    const abgr: number[] = [];
    for (let i = 0; i < rgba.length; i += 4) abgr.push(((rgba[i + 3]! << 24) | (rgba[i + 2]! << 16) | (rgba[i + 1]! << 8) | rgba[i]!) >>> 0);
    const colors = new Map<number, number>();
    for (const [pixel, count] of quantizeMaterialImage(abgr)) {
        // Original fromImageProvider quantizes AABBGGRR, then scores AARRGGBB.
        const argb = ((pixel & 0xff00ff00) | ((pixel & 0xff) << 16) | ((pixel >>> 16) & 0xff)) >>> 0;
        colors.set(argb, count);
    }
    return Score.score(colors, {desired: 1})[0]!;
}
