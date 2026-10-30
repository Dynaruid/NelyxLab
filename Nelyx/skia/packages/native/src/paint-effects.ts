// SPDX-License-Identifier: BSD-3-Clause
import type { Skia } from './skia/types/Skia.ts';
import { RuntimeProgramCache } from '@nelyx/core/hosting/runtime-program-cache';
import type { SkRuntimeEffect } from './skia/types/Drawing.ts';
import type { SkPaint, SkImage, SkShader, SkMatrix } from './skia/types/Drawing.ts';
import type { SkColorFilter } from './skia/types/ColorFilter/ColorFilter.ts';
import type { SkImageFilter, TileMode } from './skia/types/ImageFilter/ImageFilter.ts';
import type { BlendMode } from './skia/types/Paint/BlendMode.ts';
import type { PaintSnapshot } from '@nelyx/core/ui/paint';
import { blendModes } from '@nelyx/core/ui/paint';
import { tileModes, blurStyles, planeMatrix } from '@nelyx/core/ui/paint-effects-data';
import type {
  ColorFilterSnapshot,
  ImageFilterSnapshot,
  ShaderSnapshot,
} from '@nelyx/core/ui/paint-effects-data';
import { resourceKey } from '@nelyx/core/ui/frame';
const invertMatrix = [-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0];
function compileRuntimeProgram(api: Skia, source: string): SkRuntimeEffect {
  const effect = api.RuntimeEffect.Make(source);
  if (!effect) throw new Error('Runtime shader compilation failed');
  return effect;
}
function validateRuntimeProgram(effect: SkRuntimeEffect): void {
  for (let i = 0; i < effect.getUniformCount(); i++)
    if (effect.getUniform(i).isInteger) throw new Error('Runtime shaders require float uniforms');
}
export function createRuntimeShaderCache(api: Skia): RuntimeProgramCache<SkRuntimeEffect> {
  return new RuntimeProgramCache(
    (source) => compileRuntimeProgram(api, source),
    (effect) => effect.dispose(),
    validateRuntimeProgram,
  );
}
/** Temporary wrappers release after recording; Skia retains native references. */
export function applyPaintEffects(
  api: Skia,
  paint: SkPaint,
  value: PaintSnapshot,
  own: <T>(value: T) => T,
  image: (key: string) => SkImage,
  programs?: RuntimeProgramCache<SkRuntimeEffect>,
): SkImageFilter | null {
  const matrix = (values: readonly number[]) => own(api.Matrix(planeMatrix(values)));
  const ownShader = (native: SkShader): SkShader => {
    own(native);
    if (typeof native.nelyxIsValid !== 'function')
      throw new Error('Matching Nelyx shader validity binding is required');
    if (!native.nelyxIsValid()) throw new Error('Shader creation failed');
    return native;
  };
  const color = (filter: ColorFilterSnapshot): SkColorFilter => {
    switch (filter.kind) {
      case 'colorMode':
        return own(
          api.ColorFilter.MakeBlend(
            api.Color(filter.color),
            blendModes.indexOf(filter.blendMode) as BlendMode,
          ),
        );
      case 'colorMatrix':
        return own(
          api.ColorFilter.MakeMatrix(filter.matrix.map((v, n) => (n % 5 === 4 ? v / 255 : v))),
        );
      case 'linearToSrgb':
        return own(api.ColorFilter.MakeLinearToSRGBGamma());
      case 'srgbToLinear':
        return own(api.ColorFilter.MakeSRGBToLinearGamma());
    }
  };
  const imageFilter = (filter: ImageFilterSnapshot, dynamicMode = 3): SkImageFilter => {
    switch (filter.kind) {
      case 'blur':
        if (filter.bounds)
          throw new Error('Bounded normalized blur is not implemented by this Skia backend');
        return own(
          api.ImageFilter.MakeBlur(
            filter.sigmaX,
            filter.sigmaY,
            (filter.tileMode === null
              ? dynamicMode
              : tileModes.indexOf(filter.tileMode)) as TileMode,
          ),
        );
      case 'dilate':
        return own(api.ImageFilter.MakeDilate(filter.radiusX, filter.radiusY));
      case 'erode':
        return own(api.ImageFilter.MakeErode(filter.radiusX, filter.radiusY));
      case 'matrix': {
        const m = matrix(filter.matrix);
        if (filter.filterQuality === 'high') {
          const extended = api.ImageFilter as typeof api.ImageFilter & {
            MakeMatrixTransformCubic?: (matrix: SkMatrix, B: number, C: number) => SkImageFilter;
          };
          if (!extended.MakeMatrixTransformCubic)
            throw new Error('Matching Nelyx cubic image-filter binding is required');
          return own(extended.MakeMatrixTransformCubic(m, 1 / 3, 1 / 3));
        }
        return own(
          api.ImageFilter.MakeMatrixTransform(
            m,
            filter.filterQuality === 'none' ? 0 : 1,
            filter.filterQuality === 'medium' ? 2 : 0,
          ),
        );
      }
      case 'compose':
        return own(
          api.ImageFilter.MakeCompose(imageFilter(filter.outer, 0), imageFilter(filter.inner, 0)),
        );
      default:
        return own(api.ImageFilter.MakeColorFilter(color(filter)));
    }
  };
  const shader = (description: ShaderSnapshot): SkShader => {
    if (description.kind === 'runtime') {
      const effect = programs
        ? programs.get(description.source)
        : own(compileRuntimeProgram(api, description.source));
      if (effect.getUniformFloatCount() !== description.uniforms.length)
        throw new Error('Runtime shader uniform count mismatch');
      if (!programs) validateRuntimeProgram(effect);
      return ownShader(effect.makeShader([...description.uniforms]));
    }
    if (description.kind === 'image') {
      const native = image(resourceKey(description.image)),
        m = matrix(description.matrix),
        quality = description.filterQuality ?? value.filterQuality ?? 'none',
        tx = tileModes.indexOf(description.tileModeX) as TileMode,
        ty = tileModes.indexOf(description.tileModeY) as TileMode;
      return ownShader(
        quality === 'high'
          ? native.makeShaderCubic(tx, ty, 1 / 3, 1 / 3, m)
          : native.makeShaderOptions(
              tx,
              ty,
              quality === 'none' ? 0 : 1,
              quality === 'medium' ? 2 : 0,
              m,
            ),
      );
    }
    const p = description.points,
      colors = description.colors.map((v) => api.Color(v)),
      stops = description.stops ? [...description.stops] : null,
      mode = tileModes.indexOf(description.tileMode) as TileMode,
      m = description.matrix ? matrix(description.matrix) : undefined;
    switch (description.kind) {
      case 'linear':
        return ownShader(
          api.Shader.MakeLinearGradient(
            { x: p[0]!, y: p[1]! },
            { x: p[2]!, y: p[3]! },
            colors,
            stops,
            mode,
            m,
          ),
        );
      case 'radial':
        return ownShader(
          p[0] === p[3] && p[1] === p[4] && p[2] === 0
            ? api.Shader.MakeRadialGradient({ x: p[3]!, y: p[4]! }, p[5]!, colors, stops, mode, m)
            : api.Shader.MakeTwoPointConicalGradient(
                { x: p[0]!, y: p[1]! },
                p[2]!,
                { x: p[3]!, y: p[4]! },
                p[5]!,
                colors,
                stops,
                mode,
                m,
              ),
        );
      case 'sweep':
        return ownShader(
          api.Shader.MakeSweepGradient(
            p[0]!,
            p[1]!,
            colors,
            stops,
            mode,
            m,
            0,
            (p[2]! * 180) / Math.PI,
            (p[3]! * 180) / Math.PI,
          ),
        );
    }
  };
  paint.setShader(value.shader ? shader(value.shader) : null);
  let cf = value.colorFilter ? color(value.colorFilter) : null;
  if (value.invertColors) {
    const inversion = own(api.ColorFilter.MakeMatrix([...invertMatrix]));
    cf = cf ? own(api.ColorFilter.MakeCompose(inversion, cf)) : inversion;
  }
  paint.setColorFilter(cf);
  const backdrop = value.imageFilter ? imageFilter(value.imageFilter) : null;
  paint.setImageFilter(backdrop);
  paint.setMaskFilter(
    value.maskFilter
      ? own(
          api.MaskFilter.MakeBlur(
            blurStyles.indexOf(value.maskFilter.style),
            value.maskFilter.sigma,
            true,
          ),
        )
      : null,
  );
  paint.setDither(value.dither ?? false);
  return backdrop;
}
