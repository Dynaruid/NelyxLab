// SPDX-License-Identifier: BSD-3-Clause
import type { CanvasKit, Image, Paragraph, SkPicture } from 'canvaskit-wasm';
import type { PaintFrame } from '@nelyx/core/ui/types';
import { resourceKey } from '@nelyx/core/ui/frame';
import type { BlendMode, PaintSnapshot } from '@nelyx/core/ui/paint';
import { applyPaintEffects } from './paint-effects.ts';
import type { createRuntimeShaderCache } from './paint-effects.ts';
import { createEnginePath } from './path.ts';

export interface WebParagraphDrawing {
  readonly paragraph: Paragraph;
  readonly hyphens: readonly { paragraph: Paragraph; x: number; y: number }[] | undefined;
}

interface ReplayResources {
  image(key: string): Image | undefined;
  paragraph(key: string): WebParagraphDrawing | undefined;
  picture(key: string): SkPicture;
}

export class WebSkiaReplay {
  constructor(
    private readonly ck: CanvasKit,
    private readonly resources: ReplayResources,
    private readonly runtimePrograms: ReturnType<typeof createRuntimeShaderCache>,
  ) {}
  private color(value: number) {
    return this.ck.Color(
      (value >>> 16) & 255,
      (value >>> 8) & 255,
      value & 255,
      (value >>> 24) / 255,
    );
  }
  private rect(value: { x: number; y: number; width: number; height: number }) {
    return this.ck.XYWHRect(value.x, value.y, value.width, value.height);
  }
  configurePaint(
    paint: import('canvaskit-wasm').Paint,
    value: PaintSnapshot,
    own: <T extends { delete(): void }>(value: T) => T,
  ) {
    const mode = (value.blendMode[0]!.toUpperCase() +
      value.blendMode.slice(1)) as Capitalize<BlendMode>;
    paint.setColor(this.color(value.color));
    paint.setAntiAlias(value.isAntiAlias);
    paint.setStyle(value.style === 'stroke' ? this.ck.PaintStyle.Stroke : this.ck.PaintStyle.Fill);
    paint.setStrokeWidth(value.strokeWidth);
    paint.setStrokeMiter(value.strokeMiterLimit);
    paint.setStrokeCap(
      this.ck.StrokeCap[
        value.strokeCap === 'butt' ? 'Butt' : value.strokeCap === 'round' ? 'Round' : 'Square'
      ],
    );
    paint.setStrokeJoin(
      this.ck.StrokeJoin[
        value.strokeJoin === 'miter' ? 'Miter' : value.strokeJoin === 'round' ? 'Round' : 'Bevel'
      ],
    );
    paint.setBlendMode(this.ck.BlendMode[mode]);
    return applyPaintEffects(
      this.ck,
      paint,
      value,
      own,
      (key) => {
        const image = this.resources.image(key);
        if (!image) throw new Error('Web shader image retired');
        return image;
      },
      this.runtimePrograms,
    );
  }
  draw(canvas: import('canvaskit-wasm').Canvas, frame: PaintFrame, scale = 1): void {
    const saveCount = canvas.getSaveCount(),
      errors: unknown[] = [],
      paths: { delete(): void }[] = [];
    type Command = PaintFrame['commands'][number];
    let paint: import('canvaskit-wasm').Paint | undefined,
      imageRefs: Map<Command, Image> | undefined,
      paragraphRefs: Map<Command, WebParagraphDrawing> | undefined,
      pictureRefs: import('canvaskit-wasm').SkPicture[] | undefined,
      styles: Map<Command, import('canvaskit-wasm').Paint> | undefined,
      backdrops: Map<Command, import('canvaskit-wasm').ImageFilter | null> | undefined;
    const own = <T extends { delete(): void }>(value: T): T => {
      paths.push(value);
      return value;
    };
    try {
      // Scrolling usually replays retained pictures and transforms. Only
      // prepare temporary paints and lookup tables for commands that use them.
      for (const command of frame.commands) {
        if (!paint && (command.op === 'rect' || command.op === 'rrect' || command.op === 'image')) {
          paint = new this.ck.Paint();
          paint.setAntiAlias(true);
        }
        if ('paint' in command) {
          const value = own(new this.ck.Paint());
          const filter = this.configurePaint(value, command.paint, own);
          if (command.op === 'saveBackdropFilter') {
            (backdrops ??= new Map()).set(command, filter);
            value.setImageFilter(null);
          }
          (styles ??= new Map()).set(command, value);
        }
      }
      for (const command of frame.commands)
        if ('resource' in command) {
          if (command.op === 'drawPicture') {
            (pictureRefs ??= []).push(this.resources.picture(resourceKey(command.resource)));
          } else if (command.op === 'paragraph') {
            const value = this.resources.paragraph(resourceKey(command.resource));
            if (!value) throw new Error('Web paragraph retired');
            (paragraphRefs ??= new Map()).set(command, value);
          } else {
            const value = this.resources.image(resourceKey(command.resource));
            if (!value) throw new Error('Web image retired');
            (imageRefs ??= new Map()).set(command, value);
          }
        }
      canvas.save();
      if (scale !== 1) canvas.scale(scale, scale);
      let pictureIndex = 0;
      for (const command of frame.commands) {
        const styled = ('paint' in command ? styles!.get(command) : undefined)!;
        switch (command.op) {
          case 'drawPicture':
            canvas.drawPicture(pictureRefs![pictureIndex++]!);
            break;
          case 'clear':
            canvas.clear(this.color(command.color));
            break;
          case 'save':
            canvas.save();
            break;
          case 'restore':
            canvas.restore();
            break;
          case 'transform': {
            if (command.matrix.length === 16)
              canvas.concat(
                command.matrix.map(
                  (_, index) => command.matrix[(index % 4) * 4 + Math.floor(index / 4)]!,
                ),
              );
            else {
              const [a, b, c, d, x, y] = command.matrix as readonly [
                number,
                number,
                number,
                number,
                number,
                number,
              ];
              if (a === 1 && b === 0 && c === 0 && d === 1) canvas.translate(x, y);
              else canvas.concat([a, c, x, b, d, y, 0, 0, 1]);
            }
            break;
          }
          case 'clip':
            canvas.clipRect(this.rect(command.rect), this.ck.ClipOp.Intersect, true);
            break;
          case 'rect':
          case 'rrect': {
            const solid = paint!;
            solid.setColor(this.color(command.color));
            if (command.op === 'rect') canvas.drawRect(this.rect(command.rect), solid);
            else
              canvas.drawRRect(
                this.ck.RRectXY(this.rect(command.rect), command.radius, command.radius),
                solid,
              );
            break;
          }
          case 'image': {
            const image = imageRefs!.get(command)!,
              solid = paint!;
            solid.setColor(this.color(0xff000000));
            canvas.drawImageRect(
              image,
              this.ck.XYWHRect(0, 0, image.width(), image.height()),
              this.rect(command.rect),
              solid,
            );
            break;
          }
          case 'drawImageRect':
          case 'drawImageNine': {
            const image = imageRefs!.get(command)!;
            const quality = command.paint.filterQuality ?? 'none',
              source = this.rect(command.op === 'drawImageRect' ? command.src : command.center),
              dst = this.rect(command.dst);
            if (command.op === 'drawImageNine')
              canvas.drawImageNine(
                image,
                Int32Array.from(source),
                dst,
                quality === 'none' ? this.ck.FilterMode.Nearest : this.ck.FilterMode.Linear,
                styled,
              );
            else if (quality === 'high')
              canvas.drawImageRectCubic(image, source, dst, 1 / 3, 1 / 3, styled);
            else
              canvas.drawImageRectOptions(
                image,
                source,
                dst,
                quality === 'none' ? this.ck.FilterMode.Nearest : this.ck.FilterMode.Linear,
                quality === 'medium' ? this.ck.MipmapMode.Linear : this.ck.MipmapMode.None,
                styled,
              );
            break;
          }
          case 'paragraph': {
            const drawing = paragraphRefs!.get(command)!;
            canvas.drawParagraph(drawing.paragraph, command.x, command.y);
            if (drawing.hyphens)
              for (const hyphen of drawing.hyphens)
                canvas.drawParagraph(hyphen.paragraph, command.x + hyphen.x, command.y + hyphen.y);
            break;
          }
          case 'drawRect':
          case 'drawOval':
            if (command.op === 'drawRect') canvas.drawRect(this.rect(command.rect), styled);
            else canvas.drawOval(this.rect(command.rect), styled);
            break;
          case 'drawRRect':
            canvas.drawRRect(
              'rrect' in command
                ? Float32Array.from(command.rrect.values)
                : this.ck.RRectXY(this.rect(command.rect), command.radius, command.radius),
              styled,
            );
            break;
          case 'drawLine':
            canvas.drawLine(command.from.x, command.from.y, command.to.x, command.to.y, styled);
            break;
          case 'saveBackdropFilter':
            canvas.saveLayer(styled, null, backdrops?.get(command) ?? null);
            break;
          case 'saveLayer':
            canvas.saveLayer(styled, command.bounds ? this.rect(command.bounds) : null);
            break;
          case 'clipRect':
          case 'clipRRect': {
            const op =
              command.clipOp === 'intersect' ? this.ck.ClipOp.Intersect : this.ck.ClipOp.Difference;
            if (command.op === 'clipRect')
              canvas.clipRect(this.rect(command.rect), op, command.doAntiAlias);
            else
              canvas.clipRRect(
                'rrect' in command
                  ? Float32Array.from(command.rrect.values)
                  : this.ck.RRectXY(this.rect(command.rect), command.radius, command.radius),
                op,
                command.doAntiAlias,
              );
            break;
          }
          case 'drawShadow': {
            // Flutter DlSkCanvasDispatcher::DrawShadow at the pinned engine revision.
            const path = own(createEnginePath(this.ck, command.path)),
              color = command.color,
              alpha = color >>> 24;
            const rgb = [(color >>> 16) & 255, (color >>> 8) & 255, color & 255] as const;
            const tonal = this.ck.computeTonalColors({
              ambient: this.ck.Color(...rgb, Math.trunc(Math.fround(0.039) * alpha) / 255),
              spot: this.ck.Color(...rgb, Math.trunc(0.25 * alpha) / 255),
            });
            canvas.drawShadow(
              path,
              [
                0,
                0,
                Math.fround(Math.fround(command.devicePixelRatio) * Math.fround(command.elevation)),
              ],
              [0, -1, 1],
              Math.fround(800 / 600),
              tonal.ambient,
              tonal.spot,
              4 | (command.transparentOccluder ? 1 : 0),
            );
            break;
          }
          case 'drawPaint':
            canvas.drawPaint(styled);
            break;
          case 'drawPath':
          case 'clipPath': {
            const path = own(createEnginePath(this.ck, command.path));
            if (command.op === 'drawPath') {
              canvas.drawPath(path, styled);
            } else
              canvas.clipPath(
                path,
                command.clipOp === 'intersect'
                  ? this.ck.ClipOp.Intersect
                  : this.ck.ClipOp.Difference,
                command.doAntiAlias,
              );
            break;
          }
          default:
            throw new Error(
              'Unsupported Web paint command: ' + String((command as { op: string }).op),
            );
        }
      }
    } catch (error) {
      errors.push(error);
    } finally {
      try {
        canvas.restoreToCount(saveCount);
      } catch (error) {
        errors.push(error);
      }
      for (let index = paths.length - 1; index >= 0; index--)
        try {
          paths[index]!.delete();
        } catch (error) {
          errors.push(error);
        }
      try {
        paint?.delete();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length)
      throw new AggregateError(errors, 'Web paint replay/temporary disposal failed');
  }
}
