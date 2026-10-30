import { arrayItem } from '@nelyx/skia-native/runtime/arrays';
import type { Blender, CanvasKit, Paint } from 'canvaskit-wasm';

import type {
  StrokeJoin,
  SkPaint,
  StrokeCap,
  PaintStyle,
} from '@nelyx/skia-native/skia/types/Drawing';
import type { BlendMode } from '@nelyx/skia-native/skia/types/Paint/BlendMode';
import type { SkColor } from '@nelyx/skia-native/skia/types/Color';
import type { SkColorFilter } from '@nelyx/skia-native/skia/types/ColorFilter/ColorFilter';
import type { SkImageFilter } from '@nelyx/skia-native/skia/types/ImageFilter/ImageFilter';
import type { SkShader } from '@nelyx/skia-native/skia/types/Drawing';
import type { SkMaskFilter } from '@nelyx/skia-native/skia/types/MaskFilter';
import type { SkPathEffect } from '@nelyx/skia-native/skia/types/Drawing';

import { HostObject, getEnum } from './Host.ts';
import { JsiSkColorFilter } from './JsiSkColorFilter.ts';
import { JsiSkImageFilter } from './JsiSkImageFilter.ts';
import { JsiSkMaskFilter } from './JsiSkMaskFilter.ts';
import { JsiSkPathEffect } from './JsiSkPathEffect.ts';
import { JsiSkShader } from './JsiSkShader.ts';

// Custom blend mode values (must match TypeScript BlendMode enum)
const kBlendModePlusDarker = 1001;
const kBlendModePlusLighter = 1002;

// SkSL for PlusDarker blend mode
// Formula: rc = max(0, 1 - ((1-dst) + (1-src))) = max(0, src + dst - 1)
const plusDarkerSkSL = `
    vec4 main(vec4 src, vec4 dst) {
        float outAlpha = src.a + dst.a - src.a * dst.a;
        vec3 srcUnpremul = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
        vec3 dstUnpremul = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
        vec3 blended = max(vec3(0.0), srcUnpremul + dstUnpremul - vec3(1.0));
        return vec4(blended * outAlpha, outAlpha);
    }
`;

// SkSL for PlusLighter blend mode
// Formula: rc = min(1, dst + src)
const plusLighterSkSL = `
    vec4 main(vec4 src, vec4 dst) {
        float outAlpha = src.a + dst.a - src.a * dst.a;
        vec3 srcUnpremul = src.a > 0.0 ? src.rgb / src.a : vec3(0.0);
        vec3 dstUnpremul = dst.a > 0.0 ? dst.rgb / dst.a : vec3(0.0);
        vec3 blended = min(vec3(1.0), srcUnpremul + dstUnpremul);
        return vec4(blended * outAlpha, outAlpha);
    }
`;

// Cache for custom blenders per CanvasKit instance
// Using WeakMap ensures blenders are cleaned up when CanvasKit instance is garbage collected
interface BlenderCache {
  plusDarker: Blender | null;
  plusLighter: Blender | null;
}
const blenderCache = new WeakMap<CanvasKit, BlenderCache>();

const getBlenderCache = (ck: CanvasKit): BlenderCache => {
  let cache = blenderCache.get(ck);
  if (!cache) {
    cache = { plusDarker: null, plusLighter: null };
    blenderCache.set(ck, cache);
  }
  return cache;
};

export class JsiSkPaint extends HostObject<Paint, 'Paint'> implements SkPaint {
  constructor(CanvasKit: CanvasKit, ref: Paint) {
    super(CanvasKit, ref, 'Paint');
  }

  copy() {
    return new JsiSkPaint(this.CanvasKit, this.ref.copy());
  }

  assign(paint: SkPaint) {
    const previous = this.ref;
    this.ref = JsiSkPaint.fromValue<Paint>(paint).copy();
    // The replaced ref is a WASM object the GC will not reclaim.
    previous.delete();
  }

  reset() {
    const previous = this.ref;
    this.ref = new this.CanvasKit.Paint();
    previous.delete();
  }

  getAlphaf() {
    return arrayItem(this.getColor(), 3);
  }

  getColor() {
    return this.ref.getColor();
  }

  getStrokeCap() {
    return this.ref.getStrokeCap().value;
  }

  getStrokeJoin() {
    return this.ref.getStrokeJoin().value;
  }

  getStrokeMiter() {
    return this.ref.getStrokeMiter();
  }

  getStrokeWidth() {
    return this.ref.getStrokeWidth();
  }

  setAlphaf(alpha: number) {
    this.ref.setAlphaf(alpha);
  }

  setAntiAlias(aa: boolean) {
    this.ref.setAntiAlias(aa);
  }

  setDither(dither: boolean) {
    this.ref.setDither(dither);
  }

  setBlendMode(blendMode: BlendMode) {
    if (blendMode === kBlendModePlusDarker) {
      // Use custom PlusDarker blender via SkRuntimeEffect
      const cache = getBlenderCache(this.CanvasKit);
      if (!cache.plusDarker) {
        const effect = this.CanvasKit.RuntimeEffect.MakeForBlender(plusDarkerSkSL);
        if (effect) {
          cache.plusDarker = effect.makeBlender([]);
        }
      }
      if (cache.plusDarker) {
        this.ref.setBlender(cache.plusDarker);
      }
    } else if (blendMode === kBlendModePlusLighter) {
      // Use custom PlusLighter blender via SkRuntimeEffect
      const cache = getBlenderCache(this.CanvasKit);
      if (!cache.plusLighter) {
        const effect = this.CanvasKit.RuntimeEffect.MakeForBlender(plusLighterSkSL);
        if (effect) {
          cache.plusLighter = effect.makeBlender([]);
        }
      }
      if (cache.plusLighter) {
        this.ref.setBlender(cache.plusLighter);
      }
    } else {
      this.ref.setBlendMode(getEnum(this.CanvasKit, 'BlendMode', blendMode));
    }
  }

  setColor(color: SkColor) {
    this.ref.setColor(color);
  }

  setColorFilter(filter: SkColorFilter | null) {
    this.ref.setColorFilter(filter ? JsiSkColorFilter.fromValue(filter) : null);
  }

  setImageFilter(filter: SkImageFilter | null) {
    this.ref.setImageFilter(filter ? JsiSkImageFilter.fromValue(filter) : null);
  }

  setMaskFilter(filter: SkMaskFilter | null) {
    this.ref.setMaskFilter(filter ? JsiSkMaskFilter.fromValue(filter) : null);
  }

  setPathEffect(effect: SkPathEffect | null) {
    this.ref.setPathEffect(effect ? JsiSkPathEffect.fromValue(effect) : null);
  }

  setShader(shader: SkShader | null) {
    this.ref.setShader(shader ? JsiSkShader.fromValue(shader) : null);
  }

  setStrokeCap(cap: StrokeCap) {
    this.ref.setStrokeCap(getEnum(this.CanvasKit, 'StrokeCap', cap));
  }

  setStrokeJoin(join: StrokeJoin) {
    this.ref.setStrokeJoin(getEnum(this.CanvasKit, 'StrokeJoin', join));
  }

  setStrokeMiter(limit: number) {
    this.ref.setStrokeMiter(limit);
  }

  setStrokeWidth(width: number) {
    this.ref.setStrokeWidth(width);
  }

  setStyle(style: PaintStyle) {
    this.ref.setStyle({ value: style });
  }
}
