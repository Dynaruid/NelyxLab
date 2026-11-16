// Diagnostic entry template, copied into the selected Source app by the runner.
import { main as application } from './src/index.ts';
import { ParagraphBuilder } from '@nelyx/core/ui/paragraph-builder';
import { ParagraphStyle } from '@nelyx/core/ui/paragraph-style';
import { ParagraphConstraints } from '@nelyx/core/ui/paragraph-constraints';
import { Canvas } from '@nelyx/core/ui/canvas';
import { Paint } from '@nelyx/core/ui/paint';
import { Path } from '@nelyx/core/ui/path';
import { RRect } from '@nelyx/core/ui/rrect';
import { Radius } from '@nelyx/core/ui/radius';
import { Gradient } from '@nelyx/core/ui/shader';
import { MaskFilter } from '@nelyx/core/ui/mask-filter';
import { ImageFilter } from '@nelyx/core/ui/image-filter';
import { FrameDiagnostics } from './windows/runner/node_modules/@nelyx/core/dist/ui/frame-diagnostics.js';
import { submitNativeScene } from './windows/runner/node_modules/@nelyx/skia-native/dist/scene.js';

const host = globalThis.NelyxNativeHost;
function check(value, message) {
  if (!value) throw Error(message);
}
function equal(a, b, label) {
  check(JSON.stringify(a) === JSON.stringify(b), label + ' differs');
}
function textChecks(context) {
  const service = context.text,
    font = context.assets.get('sample-font');
  check(font && service.setNativeParagraphTransactions, 'Native text service unavailable');
  const original = service.nativeParagraphTransactionExecution().enabled;
  const cases = [
    { name: 'korean-emoji-fallback', text: '한글 😀 é English', width: 96 },
    { name: 'rtl', text: 'مرحبا שלום 123', width: 100, textDirection: 'rtl', locale: 'ar' },
    { name: 'line-breaks', text: 'first\n둘째\nthird line', width: 70 },
    {
      name: 'ellipsis',
      text: 'A long 한글 paragraph with ellipsis',
      width: 30,
      maxLines: 2,
      ellipsis: '…',
    },
    { name: 'infinite-unlimited', text: '한글 😀\nUnlimited', width: Infinity },
    { name: 'zero-width', text: 'a😀', width: 0 },
    { name: 'placeholder', text: 'A', width: 120, placeholder: true },
    { name: 'foreground-background', text: 'styled 한글', width: 120, paints: true },
    { name: 'variation', text: 'Variable 한글', width: 120, variation: true },
    { name: 'soft-hyphen', text: 'ab\u00adcdef ghij', width: 24, hyphens: 'hidden' },
    {
      name: 'large-style-builder-fallback',
      text: 'styled',
      width: 120,
      largeStyle: true,
      fallback: true,
    },
    {
      name: 'placeholder-builder-fallback',
      text: 'A',
      width: 120,
      farPlaceholder: true,
      fallback: true,
    },
  ];
  const timings = [],
    work = [];
  try {
    for (let round = 0; round < 3; round++)
      for (const item of cases) {
        const results = [],
          durations = [];
        for (const transaction of round === 1 ? [true, false] : [false, true]) {
          service.setNativeParagraphTransactions(false);
          if (transaction) service.setNativeParagraphTransactions(true);
          const builder = new ParagraphBuilder(
            new ParagraphStyle({
              fontSize: 14,
              textDirection: item.textDirection ?? 'ltr',
              locale: item.locale ?? 'ko-KR',
              maxLines: item.maxLines ?? null,
              ellipsis: item.ellipsis ?? null,
              hyphens: item.hyphens,
            }),
            { text: service, resources: context.resources, font, scale: 1, transient: true },
          );
          let paragraph;
          try {
            if (item.paints)
              builder.pushStyle({
                foreground: new Paint({ color: 0xff123456 }).snapshot(),
                background: new Paint({ color: 0xffefcdef }).snapshot(),
              });
            if (item.variation)
              builder.pushStyle({ fontVariations: [{ axis: 'wght', value: 600 }] });
            if (item.largeStyle) {
              const fontFamilies = Array.from(
                { length: 64 },
                (_, index) => 'family-' + index + '-'.repeat(190),
              );
              for (let run = 0; run < 40; run++) {
                builder.pushStyle({ fontFamilies });
                builder.addText('a');
                builder.pop();
              }
            } else builder.addText(item.text);
            if (item.placeholder) {
              builder.addPlaceholder(12, 18, 'baseline', {
                baseline: 'alphabetic',
                baselineOffset: 14,
              });
              builder.addText(' 한글');
            }
            if (item.farPlaceholder)
              builder.addPlaceholder(12, 18, 'top', { baselineOffset: 33554432 });
            if (item.paints || item.variation) builder.pop();
            paragraph = builder.build();
            const start = host.now();
            paragraph.layout(new ParagraphConstraints({ width: item.width }));
            durations[Number(transaction)] = host.now() - start;
            const layout = paragraph._layoutSnapshot(),
              { resource, input, ...geometry } = layout;
            results[Number(transaction)] = {
              geometry,
              boxes: paragraph.getBoxesForRange(0, input.text.length),
              placeholders: paragraph.getBoxesForPlaceholders(),
              word: service.wordBoundary(layout, 0),
              glyph: service.glyphAt(layout, 0),
            };
            if (transaction) {
              const before = service.nativeParagraphTransactionExecution();
              check(
                before.textTransactions === (item.fallback ? 0 : 1),
                'Wrong transaction/builder route',
              );
              check(
                before.tsFallbacks === (item.fallback ? 1 : 0),
                'Unexpected transaction fallback',
              );
              if (!item.paints) {
                paragraph.layout(new ParagraphConstraints({ width: item.width }));
                const after = service.nativeParagraphTransactionExecution();
                check(
                  after.textTransactions === before.textTransactions &&
                    after.tsFallbacks === before.tsFallbacks &&
                    after.cacheHits === before.cacheHits + 1,
                  'Cache hit prepared/executed another transaction',
                );
              }
              if (round === 0)
                work.push({
                  name: item.name,
                  operations: before.textOperations,
                  bytes: before.textBytes,
                  fallbacks: before.fallbackReasons,
                });
            }
          } catch (error) {
            host.log(
              'NATIVE_BOUNDARY_FAILURE ' +
                JSON.stringify({
                  stage: 'text',
                  name: item.name,
                  transaction,
                  error: String(error.stack ?? error),
                }),
            );
            throw error;
          } finally {
            paragraph?.dispose();
            builder.dispose();
          }
        }
        equal(results[0], results[1], item.name);
        timings.push({
          round,
          name: item.name,
          builderMs: durations[0],
          transactionMs: durations[1],
        });
      }
    const malformed = new ParagraphBuilder(new ParagraphStyle(), {
      text: service,
      resources: context.resources,
      font,
      scale: 1,
      transient: true,
    });
    try {
      let rejected = false;
      try {
        malformed.addText('\ud800');
      } catch {
        rejected = true;
      }
      check(rejected, 'Malformed UTF-16 was accepted');
    } finally {
      malformed.dispose();
    }
    return { cases: cases.length, timings, work };
  } finally {
    service.setNativeParagraphTransactions(false);
    if (original) service.setNativeParagraphTransactions(true);
  }
}
function sceneChecks(context) {
  const api = globalThis.SkiaApi,
    source = new Canvas(),
    path = new Path();
  path.moveTo(8, 8);
  path.lineTo(82, 14);
  path.lineTo(45, 82);
  path.close();
  const shape = new RRect(12, 12, 86, 86, {
    topLeft: new Radius(3, 7),
    topRight: new Radius(11, 4),
    bottomRight: new Radius(13, 9),
    bottomLeft: new Radius(5, 15),
  });
  const gradient = Gradient.linear({ x: 0, y: 0 }, { x: 90, y: 90 }, [0xff112233, 0xffabcdef]);
  try {
    source.save();
    source.clipRect({ x: 1, y: 1, width: 94, height: 94 });
    source.clipRRect(shape);
    source.translate(1, 1);
    source.drawShadow(path, 0x88000000, 3, true, 1);
    source.drawPath(
      path,
      new Paint({ color: 0xff2367ac, style: 'stroke', strokeWidth: 3, strokeJoin: 'round' }),
    );
    source.drawRRect(shape, new Paint({ color: 0xffaabbcc }));
    source.save();
    source.clipPath(path, { clipOp: 'difference', doAntiAlias: true });
    source.drawOval({ x: 10, y: 10, width: 60, height: 65 }, new Paint({ shader: gradient }));
    source.restore();
    source.saveLayer(null, new Paint({ imageFilter: ImageFilter.blur({ sigmaX: 1, sigmaY: 1 }) }));
    source.drawRect(
      { x: 22, y: 22, width: 40, height: 25 },
      new Paint({ color: 0xffee2211, maskFilter: MaskFilter.blur('normal', 1) }),
    );
    source.restore();
    source.restore();
    const frame = {
      token: { owner: context.owner, metrics: context.readMetrics(), sequence: 1 },
      commands: source.commands,
      resources: [],
    };
    const results = [],
      baseline = [];
    const modes = [undefined, 'path', 'paint', 'all'];
    for (let round = 0; round < 3; round++)
      for (const mode of [...modes.slice(round), ...modes.slice(0, round)]) {
        const diagnostics = new FrameDiagnostics({ now: () => host.now() });
        let recorder, bounds, picture, surface, canvas, image;
        try {
          recorder = api.PictureRecorder();
          bounds = api.XYWHRect(0, 0, 96, 96);
          recorder.beginRecording(bounds);
          submitNativeScene(
            api,
            recorder,
            frame,
            {
              sceneBatch: mode,
              image() {
                throw Error('Unexpected image');
              },
              paragraph() {
                throw Error('Unexpected paragraph');
              },
            },
            undefined,
            diagnostics,
          );
          picture = recorder.finishRecordingAsPicture();
          surface = api.Surface.Make(96, 96);
          check(surface, 'Raster surface unavailable');
          canvas = surface.getCanvas();
          canvas.clear(api.Color(0x00000000));
          canvas.drawPicture(picture);
          image = surface.makeImageSnapshot();
          const pixels = image.readPixels();
          check(pixels?.length === 96 * 96 * 4, 'Pixel readback failed');
          if (mode === undefined && !baseline.length) baseline.push(...pixels);
          else
            check(
              pixels.every((value, index) => value === baseline[index]),
              'Scene pixels differ: ' + mode,
            );
          const samples = diagnostics.drain();
          check(!samples.invalid && !samples.overwritten, 'Scene diagnostics lost');
          results.push({
            round,
            mode: mode ?? 'none',
            wrappers: samples.samples.find((s) => s.stage === 'scene-wrappers').count,
            packetMs: samples.samples.find((s) => s.stage === 'packet').duration,
            replayMs: samples.samples.find((s) => s.stage === 'native-replay').duration,
          });
        } catch (error) {
          host.log(
            'NATIVE_BOUNDARY_FAILURE ' +
              JSON.stringify({
                stage: 'scene',
                mode: mode ?? 'none',
                error: String(error.stack ?? error),
              }),
          );
          throw error;
        } finally {
          image?.dispose();
          surface?.nelyxRetire();
          surface?.dispose();
          picture?.dispose();
          bounds?.dispose();
          recorder?.dispose();
        }
      }
    return results;
  } finally {
    source.dispose();
    gradient.dispose();
  }
}
export function main() {
  const result = application(),
    create = result.definition.createView;
  return {
    ...result,
    definition: {
      ...result.definition,
      createView(context) {
        const text = textChecks(context);
        host.log('NATIVE_BOUNDARY_TEXT_PASS ' + JSON.stringify(text));
        const scene = sceneChecks(context);
        host.log('NATIVE_BOUNDARY_PASS ' + JSON.stringify({ text, scene }));
        return create(context);
      },
    },
  };
}
