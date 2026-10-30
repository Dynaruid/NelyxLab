// SPDX-License-Identifier: BSD-3-Clause
import type {
  CanvasKit,
  Paint,
  Image,
  Shader,
  ColorFilter,
  ImageFilter,
  RuntimeEffect,
} from 'canvaskit-wasm';
import { RuntimeProgramCache } from '@nelyx/core/hosting/runtime-program-cache';
import type { PaintSnapshot } from '@nelyx/core/ui/paint';
import { blendModes } from '@nelyx/core/ui/paint';
import { planeMatrix, tileModes } from '@nelyx/core/ui/paint-effects-data';
import type {
  ColorFilterSnapshot,
  ImageFilterSnapshot,
  ShaderSnapshot,
} from '@nelyx/core/ui/paint-effects-data';
import { resourceKey } from '@nelyx/core/ui/frame';
const invertMatrix = [-1, 0, 0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, 0, 1, 0];
function compileRuntimeProgram(ck: CanvasKit, source: string): RuntimeEffect {
  let diagnostic = '';
  const effect = ck.RuntimeEffect.Make(source, (error) => {
    diagnostic = error;
  });
  if (!effect) throw new Error('Runtime shader compilation failed: ' + diagnostic);
  return effect;
}
function validateRuntimeProgram(effect: RuntimeEffect): void {
  for (let i = 0; i < effect.getUniformCount(); i++)
    if (effect.getUniform(i).isInteger) throw new Error('Runtime shaders require float uniforms');
}
export function createRuntimeShaderCache(ck: CanvasKit): RuntimeProgramCache<RuntimeEffect> {
  return new RuntimeProgramCache(
    (source) => compileRuntimeProgram(ck, source),
    (effect) => effect.delete(),
    validateRuntimeProgram,
  );
}
export function applyPaintEffects(
  ck: CanvasKit,
  paint: Paint,
  value: PaintSnapshot,
  own: <T extends { delete(): void }>(value: T) => T,
  image: (key: string) => Image,
  programs?: RuntimeProgramCache<RuntimeEffect>,
): ImageFilter | null {
  const retain = <T extends { delete(): void }>(native: T | null): T | null =>
    native ? own(native) : null;
  const ownShader = (native: Shader | null): Shader => {
    if (!native) throw new Error('Shader creation failed');
    return own(native);
  };
  const argb = (v: number) =>
      ck.Color((v >>> 16) & 255, (v >>> 8) & 255, v & 255, (v >>> 24) / 255),
    mode = (name: (typeof blendModes)[number]) =>
      ck.BlendMode[(name[0]!.toUpperCase() + name.slice(1)) as Capitalize<typeof name>],
    tile = (name: (typeof tileModes)[number]) =>
      ck.TileMode[
        name === 'repeated'
          ? 'Repeat'
          : name === 'clamp'
            ? 'Clamp'
            : name === 'mirror'
              ? 'Mirror'
              : 'Decal'
      ];
  const color = (filter: ColorFilterSnapshot): ColorFilter | null => {
    switch (filter.kind) {
      case 'colorMode':
        return retain(ck.ColorFilter.MakeBlend(argb(filter.color), mode(filter.blendMode)));
      case 'colorMatrix':
        return retain(
          ck.ColorFilter.MakeMatrix(filter.matrix.map((v, n) => (n % 5 === 4 ? v / 255 : v))),
        );
      case 'linearToSrgb':
        return retain(ck.ColorFilter.MakeLinearToSRGBGamma());
      case 'srgbToLinear':
        return retain(ck.ColorFilter.MakeSRGBToLinearGamma());
    }
  };
  const imageFilter = (
    filter: ImageFilterSnapshot,
    dynamicMode = ck.TileMode.Decal,
  ): ImageFilter | null => {
    switch (filter.kind) {
      case 'blur':
        if (filter.bounds)
          throw new Error('Bounded normalized blur is not implemented by this Skia backend');
        return retain(
          ck.ImageFilter.MakeBlur(
            filter.sigmaX,
            filter.sigmaY,
            filter.tileMode === null ? dynamicMode : tile(filter.tileMode),
            null,
          ),
        );
      case 'dilate':
        return retain(ck.ImageFilter.MakeDilate(filter.radiusX, filter.radiusY, null));
      case 'erode':
        return retain(ck.ImageFilter.MakeErode(filter.radiusX, filter.radiusY, null));
      case 'matrix':
        return retain(
          ck.ImageFilter.MakeMatrixTransform(
            planeMatrix(filter.matrix),
            filter.filterQuality === 'high'
              ? { B: 1 / 3, C: 1 / 3 }
              : {
                  filter:
                    filter.filterQuality === 'none' ? ck.FilterMode.Nearest : ck.FilterMode.Linear,
                  mipmap:
                    filter.filterQuality === 'medium' ? ck.MipmapMode.Linear : ck.MipmapMode.None,
                },
            null,
          ),
        );
      case 'compose':
        return retain(
          ck.ImageFilter.MakeCompose(
            imageFilter(filter.outer, ck.TileMode.Clamp),
            imageFilter(filter.inner, ck.TileMode.Clamp),
          ),
        );
      default: {
        const cf = color(filter);
        return cf ? retain(ck.ImageFilter.MakeColorFilter(cf, null)) : null;
      }
    }
  };
  const shader = (description: ShaderSnapshot): Shader => {
    if (description.kind === 'runtime') {
      const effect = programs
        ? programs.get(description.source)
        : own(compileRuntimeProgram(ck, description.source));
      if (effect.getUniformFloatCount() !== description.uniforms.length)
        throw new Error('Runtime shader uniform count mismatch');
      if (!programs) validateRuntimeProgram(effect);
      return ownShader(effect.makeShader([...description.uniforms]));
    }
    if (description.kind === 'image') {
      const native = image(resourceKey(description.image)),
        m = planeMatrix(description.matrix),
        quality = description.filterQuality ?? value.filterQuality ?? 'none',
        tx = tile(description.tileModeX),
        ty = tile(description.tileModeY);
      return ownShader(
        quality === 'high'
          ? native.makeShaderCubic(tx, ty, 1 / 3, 1 / 3, m)
          : native.makeShaderOptions(
              tx,
              ty,
              quality === 'none' ? ck.FilterMode.Nearest : ck.FilterMode.Linear,
              quality === 'medium' ? ck.MipmapMode.Linear : ck.MipmapMode.None,
              m,
            ),
      );
    }
    const p = description.points,
      colors = description.colors.map(argb),
      stops = description.stops ? [...description.stops] : null,
      tm = tile(description.tileMode),
      m = description.matrix ? planeMatrix(description.matrix) : undefined;
    switch (description.kind) {
      case 'linear':
        return ownShader(
          ck.Shader.MakeLinearGradient([p[0]!, p[1]!], [p[2]!, p[3]!], colors, stops, tm, m),
        );
      case 'radial':
        return ownShader(
          p[0] === p[3] && p[1] === p[4] && p[2] === 0
            ? ck.Shader.MakeRadialGradient([p[3]!, p[4]!], p[5]!, colors, stops, tm, m)
            : ck.Shader.MakeTwoPointConicalGradient(
                [p[0]!, p[1]!],
                p[2]!,
                [p[3]!, p[4]!],
                p[5]!,
                colors,
                stops,
                tm,
                m,
              ),
        );
      case 'sweep':
        return ownShader(
          ck.Shader.MakeSweepGradient(
            p[0]!,
            p[1]!,
            colors,
            stops,
            tm,
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
    const inversion = own(ck.ColorFilter.MakeMatrix(invertMatrix));
    cf = cf ? own(ck.ColorFilter.MakeCompose(inversion, cf)) : inversion;
  }
  paint.setColorFilter(cf);
  const backdrop = value.imageFilter ? imageFilter(value.imageFilter) : null;
  paint.setImageFilter(backdrop);
  paint.setMaskFilter(
    value.maskFilter
      ? retain(
          ck.MaskFilter.MakeBlur(
            ck.BlurStyle[
              value.maskFilter.style === 'normal'
                ? 'Normal'
                : value.maskFilter.style === 'solid'
                  ? 'Solid'
                  : value.maskFilter.style === 'outer'
                    ? 'Outer'
                    : 'Inner'
            ],
            value.maskFilter.sigma,
            true,
          ),
        )
      : null,
  );
  paint.setDither(value.dither ?? false);
  return backdrop;
}
