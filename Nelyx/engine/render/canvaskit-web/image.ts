// SPDX-License-Identifier: BSD-3-Clause
import type { CanvasKit, Canvas, Image, Paint, ColorFilter, BlendMode } from 'canvaskit-wasm';
import { protocol as p } from '../../../runtime/engine-client/schema.ts';
import type { EngineNodeSnapshot } from '../../../runtime/engine-client/codec.ts';
import { readRasterImage } from '../../../runtime/engine-client/raster-image.ts';

export function providerImage(ck: CanvasKit, bytes: Uint8Array, node: EngineNodeSnapshot): Image {
  const raw = readRasterImage(bytes);
  const image = raw
    ? ck.MakeImage(
        {
          width: raw.width,
          height: raw.height,
          colorType: ck.ColorType.RGBA_8888,
          alphaType: ck.AlphaType.Premul,
          colorSpace: ck.ColorSpace.SRGB,
        },
        raw.pixels,
        raw.rowBytes,
      )
    : ck.MakeImageFromEncoded(bytes);
  if (!image) throw Error('Image decode failed');
  const style = node.imagePaint?.style;
  if (style && (image.width() !== style.width || image.height() !== style.height)) {
    image.delete();
    throw Error('Image dimensions differ from the canonical frame');
  }
  return image;
}
const invertMatrix = [-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0];
export function paintImage(
  ck: CanvasKit,
  canvas: Canvas,
  image: Image,
  node: EngineNodeSnapshot,
  paint: Paint,
): void {
  const plan = node.imagePaint;
  if (!plan) {
    const content = node.content ?? { x: 0, y: 0, width: node.width, height: node.height };
    canvas.drawImageRect(
      image,
      ck.XYWHRect(0, 0, image.width(), image.height()),
      ck.XYWHRect(content.x, content.y, content.width, content.height),
      paint,
    );
    return;
  }
  const style = plan.style;
  const blend = (mode: keyof typeof p.imageBlendModes) => {
    const name = mode.charAt(0).toUpperCase() + mode.slice(1);
    const value = (ck.BlendMode as unknown as Record<string, BlendMode>)[name];
    if (!value || !Number.isInteger(value.value)) throw Error('CanvasKit image blend mode missing');
    return value;
  };
  paint.setAntiAlias(!!style.antialias);
  paint.setColor(
    ck.Color(0, 0, 0, Math.round(Math.max(0, Math.min(1, style.opacity ?? 1)) * 255) / 255),
  );
  paint.setBlendMode(blend(style.blendMode ?? 'srcOver'));
  const filters: ColorFilter[] = [];
  try {
    let filter: ColorFilter | null = null;
    if (style.color != null) {
      const color = style.color;
      filter = ck.ColorFilter.MakeBlend(
        ck.Color((color >>> 16) & 255, (color >>> 8) & 255, color & 255, (color >>> 24) / 255),
        blend(style.colorBlendMode ?? 'srcIn'),
      );
      filters.push(filter);
    }
    if (style.invert) {
      const invert = ck.ColorFilter.MakeMatrix(invertMatrix);
      filters.push(invert);
      if (filter) {
        filter = ck.ColorFilter.MakeCompose(invert, filter);
        filters.push(filter);
      } else filter = invert;
    }
    paint.setColorFilter(filter);
  } finally {
    for (const filter of filters) filter.delete();
  }
  const rect = (values: readonly [number, number, number, number], scale = 1) =>
    ck.XYWHRect(values[0] * scale, values[1] * scale, values[2] * scale, values[3] * scale);
  canvas.save();
  try {
    if (plan.clip)
      canvas.clipRect(ck.XYWHRect(0, 0, node.width, node.height), ck.ClipOp.Intersect, false);
    if (plan.flip) {
      canvas.translate(node.width, 0);
      canvas.scale(-1, 1);
    }
    if (plan.center) canvas.scale(1 / (style.scale ?? 1), 1 / (style.scale ?? 1));
    for (const tile of plan.tiles) {
      if (plan.center)
        canvas.drawImageNine(
          image,
          plan.center as [number, number, number, number],
          rect(tile.destination, style.scale ?? 1),
          style.filterQuality === 'none' ? ck.FilterMode.Nearest : ck.FilterMode.Linear,
          paint,
        );
      else if (style.filterQuality === 'high')
        canvas.drawImageRectCubic(
          image,
          rect(tile.source),
          rect(tile.destination),
          1 / 3,
          1 / 3,
          paint,
        );
      else
        canvas.drawImageRectOptions(
          image,
          rect(tile.source),
          rect(tile.destination),
          style.filterQuality === 'none' ? ck.FilterMode.Nearest : ck.FilterMode.Linear,
          style.filterQuality === 'medium' ? ck.MipmapMode.Linear : ck.MipmapMode.None,
          paint,
        );
    }
  } finally {
    canvas.restore();
  }
}
