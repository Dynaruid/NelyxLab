// SPDX-License-Identifier: BSD-3-Clause
import { AppTextLayoutService } from '@nelyx/core/v2/original';
import { ResourceRegistry } from '@nelyx/core/hosting/resources';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { TextSelection } from '@nelyx/core/services/text-editing';
import { Offset } from '@nelyx/core/ui/offset';
import { Canvas } from '@nelyx/core/ui/canvas';
import { nativePaintBody } from '../../runtime/engine-client/native-paint.ts';
import { paragraphOptionsBytes } from '../../runtime/engine-client/paragraph.ts';
import { richTextProbe } from './rich-text-probe.mjs';
import { paragraphExtrasProbe } from './paragraph-extras-probe.mjs';
import { paintPlacementBytes } from '../../runtime/engine-client/paint-placement.ts';

const check = (value, message) => {
  if (!value) throw Error(message);
};
const rejects = (action, message) => {
  let rejected = false;
  try {
    action();
  } catch {
    rejected = true;
  }
  check(rejected, message);
};
/** Same canonical Source API consumer in real Hermes and owned CanvasKit. */
export function appTextProbe(backend) {
  const resources = new ResourceRegistry(),
    font = resources.allocateId('probe-font');
  resources.register({ ...font, kind: 'font' }, () => {});
  const text = new AppTextLayoutService(
    backend,
    resources,
    resources.captureResource(font),
    (reason) => {
      throw Error('Unsupported: ' + reason);
    },
  );
  const context = { text, resources, font, scale: 1 },
    style = new TextStyle({ fontSize: 18, color: 0xff172033 }),
    span = (value) => new TextSpan({ text: value, style }),
    painter = new TextPainter(
      { text: span('한글 A😀 e\u0301 word\nאבג مرحبا'), textDirection: 'ltr' },
      context,
    ),
    layouts = [],
    paintInputs = [];
  let hold, result, canvas;
  try {
    check(
      painter.layout({ minWidth: 180, maxWidth: 180 }) === undefined,
      'TextPainter.layout must return synchronously',
    );
    const original = painter._layoutSnapshot(),
      geometry = {
        width: painter.width,
        height: painter.height,
        alphabeticBaseline: original.alphabeticBaseline,
        longestLine: original.longestLine,
        lines: painter.computeLineMetrics().map((line) => ({ ...line })),
      };
    check(
      geometry.width === 180 && geometry.height > 30 && geometry.lines.length >= 2,
      'Actual C++ line metrics',
    );
    const glyph = text.glyphAt(original, 5),
      boxes = painter.getBoxesForSelection(new TextSelection({ baseOffset: 4, extentOffset: 6 }));
    check(
      glyph?.start === 4 && glyph.end === 6 && boxes.length > 0,
      'UTF16 emoji cluster and selection boxes',
    );
    check(painter.getPositionForOffset(new Offset(45, 8)).offset >= 0, 'Source coordinate hit');
    check(painter.getClosestGlyphForOffset(new Offset(45, 8)) !== null, 'Source closest glyph');
    const word = painter.getWordBoundary({ offset: 11 });
    check(word.start === 10 && word.end === 14, 'C++ UTF16 word boundary');
    check(
      text.lineNumberAt(original, 15) === 1 &&
        text.lineNumberAt(original, original.input.text.length) === null,
      'C++ line query and end caret',
    );
    canvas = new Canvas();
    painter.paint(canvas, new Offset(3, 5));
    const command = canvas.commands[0],
      paint = text.capturePaint(command.resource);
    check(
      command.op === 'paragraph' &&
        command.x === 3 &&
        command.y === 5 &&
        paint.input.text === original.input.text &&
        paint.fontRevision === 1n &&
        paint.width === 180 &&
        paint.height === original.height,
      'Source TextPainter.paint copies exact immutable configuration',
    );
    paintInputs.push({
      input: {
        ...paint.input,
        paragraphData: Array.from(
          paragraphOptionsBytes({
            ...paint.input.paragraph,
            ...(paint.input.paragraph.height === null ? { height: undefined } : {}),
          }),
        ),
      },
      unbounded: paint.unbounded,
      width: paint.width,
      height: paint.height,
      baseline: paint.baseline,
    });
    let foreignReads = 0;
    rejects(
      () =>
        text.hit(
          new Proxy(
            {},
            {
              get() {
                ++foreignReads;
                throw Error('Foreign fields must not be read');
              },
            },
          ),
          0,
          0,
        ),
      'Foreign layout identity',
    );
    rejects(
      () =>
        text.capturePaint(
          new Proxy(
            {},
            {
              get() {
                ++foreignReads;
                throw Error('Foreign paint fields');
              },
            },
          ),
        ),
      'Foreign paint resource rejected',
    );
    check(foreignReads === 0, 'Foreign layout/paint rejected without reading their fields');
    const beforeInvalid = text.execution;
    rejects(
      () => text.layout({ ...original.input, text: '\ud800', runs: [] }),
      'Malformed UTF16 rejected',
    );
    rejects(() => text.layout({ ...original.input, width: -1 }), 'Invalid width rejected');
    rejects(
      () => text.layout({ ...original.input, style: { foreground: { invalid: true } } }),
      'Custom style rejected',
    );
    check(
      text.execution.layouts === beforeInvalid.layouts,
      'Rejected configuration must not shape',
    );
    hold = resources.acquire([original.resource]);
    painter.text = span('updated 한글 label');
    painter.layout({ minWidth: 180, maxWidth: 180 });
    const current = painter._layoutSnapshot(),
      input = current.input;
    check(current !== original && current.height > 0, 'Replacement is a new immutable paragraph');
    rejects(() => text.hit(original, 0, 0), 'Old producer no longer queryable');
    check(text.execution.paragraphs === 2, 'Held old paragraph remains charged');
    check(
      text.capturePaint(command.resource).input.text === original.input.text,
      'A recording outlives the old producer without changing its text',
    );
    canvas.dispose();
    canvas = undefined;
    hold.returnBy('caller');
    hold = undefined;
    check(text.execution.paragraphs === 1, 'Old paragraph retires with its actual holder');
    rejects(
      () => text.capturePaint(command.resource),
      'Retired recording cannot mint a paint snapshot',
    );
    painter.dispose();
    check(text.execution.paragraphs === 0, 'Source dispose releases its producer');
    const unboundedPainter = new TextPainter(
        { text: span('unbounded 한글 label'), textDirection: 'ltr' },
        context,
      ),
      unboundedCanvas = new Canvas();
    try {
      unboundedPainter.layout();
      unboundedPainter.paint(unboundedCanvas, Offset.zero);
      const paint = text.capturePaint(unboundedCanvas.commands[0].resource);
      paintInputs.push({
        input: {
          ...paint.input,
          paragraphData: Array.from(
            paragraphOptionsBytes({
              ...paint.input.paragraph,
              ...(paint.input.paragraph.height === null ? { height: undefined } : {}),
            }),
          ),
        },
        unbounded: paint.unbounded,
        width: paint.width,
        height: paint.height,
        baseline: paint.baseline,
      });
      check(
        paint.unbounded && Number.isFinite(paint.width) && paint.width > 0,
        'Keep unbounded C++ layout separate from finite recording bounds',
      );
    } finally {
      unboundedCanvas.dispose();
      unboundedPainter.dispose();
    }
    const rich = richTextProbe(context, text);
    const extras = paragraphExtrasProbe(context, text);
    // The full Source style budgets must survive the JSI byte-array boundary.
    const denseStyle = {
        fontFeatures: Array.from({ length: 64 }, () => ({ name: 'liga', value: 0 })),
        fontVariations: Array.from({ length: 64 }, () => ({ axis: 'TEST', value: 1 })),
        shadows: Array.from({ length: 16 }, () => ({
          color: 0,
          offset: { x: 0, y: 0 },
          blurSigma: 0,
        })),
      },
      dense = text.layout({
        ...input,
        text: 'x'.repeat(256),
        runs: Array.from({ length: 256 }, (_, i) => ({ start: i, end: i + 1, style: denseStyle })),
        width: 400,
      }),
      densePaint = text.capturePaint(dense.resource),
      { height: denseHeight, ...denseOptions } = densePaint.input.paragraph,
      denseBytes = paragraphOptionsBytes({
        ...denseOptions,
        ...(denseHeight === null ? {} : { height: denseHeight }),
      }).length;
    check(
      denseBytes > 262144 && denseBytes < 1048576,
      'Full admitted style metadata crosses the old 256KiB ceiling',
    );
    check(
      densePaint.input.paragraph.runs.length === 256,
      'Dense styles are copied and remain bounded',
    );
    resources.releaseProducer(dense.resource);
    // Aggregate UTF16 admission, including the exact live replacement credit.
    const large = {
      ...input,
      text: 'X'.repeat(4096),
      runs: [],
      width: Infinity,
      maxLines: 1,
      unlimitedLines: false,
    };
    for (let i = 0; i < 16; ++i) layouts.push(text.layout(large));
    const full = text.execution;
    rejects(() => text.layout(large), 'Aggregate text budget must reject the 17th full input');
    check(
      text.execution.layouts === full.layouts && text.execution.paragraphs === 16,
      'Budget failure preserves live paragraphs and actual work count',
    );
    const previous = layouts.pop(),
      next = text.layout(large, { replacing: previous });
    check(
      text.execution.paragraphs === 17,
      'Replacement retains old resource until caller releases it',
    );
    resources.releaseProducer(previous.resource);
    layouts.push(next);
    for (const layout of layouts.splice(0)) resources.releaseProducer(layout.resource);
    const cached = new TextPainter({ text: span('cached font'), textDirection: 'ltr' }, context);
    try {
      cached.layout({ minWidth: 180, maxWidth: 180 });
      const work = text.execution.layouts;
      rejects(() => text.observeFontRevision(2n), 'Changed font revision is unavailable');
      rejects(
        () => cached.layout({ minWidth: 180, maxWidth: 180 }),
        'A cached painter cannot bypass an invalid observed font',
      );
      rejects(
        () => text.layout(large),
        'Known stale font must prevent any later synchronous layout',
      );
      check(text.execution.layouts === work, 'Stale cached fonts do not shape');
    } finally {
      cached.dispose();
    }
    const execution = text.execution;
    check(
      execution.layouts > 0 && execution.layouts === execution.sdkLayouts,
      'C++ and SDK layout work agree',
    );
    check(
      execution.queries > 0 && execution.queries === execution.sdkQueries,
      'C++ and SDK query work agree',
    );
    check(
      execution.paragraphs === 0 && execution.tsFallbacks === 0,
      'No remaining paragraph or TS fallback',
    );
    const pathShape = {
      kind: 'rrect',
      radii: Array(8).fill(0),
      strokeWidth: 0,
      strokeColor: 0,
      strokeAlign: 0,
    };
    const pathInput = Array.from(
      nativePaintBody([
        {
          kind: 'path',
          shape: pathShape,
          color: 0x80284870,
          geometry: { kind: 'program', rect: [0, 0, 256, 128] },
          path: {
            commands: [
              ['move', 100, 64],
              ['line', 90, 54],
              ['line', 110, 54],
              ['close'],
              ['rrect', 70, 26, 60, 32, 16, 16, 16, 16, 16, 16, 16, 16],
            ],
          },
        },
        {
          kind: 'path',
          shape: pathShape,
          color: 0x80284870,
          geometry: { kind: 'program', rect: [0, 0, 256, 128] },
          path: {
            fillRule: 'evenOdd',
            commands: [
              ['rect', 160, 20, 60, 60],
              ['rect', 175, 35, 30, 30],
            ],
          },
        },
      ]),
    );
    const liveShift = {
        op: 'max',
        args: [0, { op: 'subtract', args: [40, { op: 'worldX', args: [100, 64] }] }],
      },
      livePathInput = Array.from(
        nativePaintBody([
          {
            kind: 'path',
            shape: pathShape,
            color: 0x80284870,
            geometry: { kind: 'program', rect: [0, 0, 256, 128] },
            path: {
              commands: [
                ['move', 100, 64],
                ['line', 90, 54],
                ['line', 110, 54],
                ['close'],
                [
                  'rrect',
                  { op: 'add', args: [70, liveShift] },
                  26,
                  60,
                  32,
                  16,
                  16,
                  16,
                  16,
                  16,
                  16,
                  16,
                  16,
                ],
              ],
            },
          },
        ]),
      );
    const orderedEntry = (kind, extra = {}) => ({ kind, color: 0, shape: pathShape, ...extra }),
      orderedRect = (rect, color) =>
        orderedEntry('shape', { color, geometry: { kind: 'program', rect } }),
      orderedInput = Array.from(
        nativePaintBody([
          orderedRect([0, 0, 300, 180], 0xffeeeeee),
          orderedEntry('save'),
          orderedEntry('clip', { geometry: { kind: 'program', rect: [150, 0, 100, 40] } }),
          orderedEntry('paragraph', { reference: { slot: 2, generation: 1 } }),
          orderedRect([150, 0, 45, 40], 0xff337744),
          orderedEntry('restore'),
          orderedEntry('children'),
          orderedEntry('paragraph', { reference: { slot: 3, generation: 1 } }),
          orderedRect([10, 50, 35, 25], 0xff775599),
        ]),
      ),
      orderedPlacements = paintInputs.map((input, i) =>
        Array.from(
          paintPlacementBytes({
            fontRevision: 1n,
            unbounded: input.unbounded,
            width: input.width,
            height: input.height,
            baseline: input.baseline,
            rect: [i ? 10 : 160, i ? 50 : 5, input.width, input.height],
          }),
        ),
      );
    result = {
      rich,
      extras,
      denseBytes,
      geometry,
      glyph,
      execution,
      paintInputs,
      pathInput,
      livePathInput,
      orderedInput,
      orderedPlacements,
    };
  } finally {
    painter.dispose();
    canvas?.dispose();
    hold?.returnBy('caller');
    for (const layout of layouts) resources.releaseProducer(layout.resource);
    resources.dispose();
    text.close();
  }
  return { ...result, closed: text.execution };
}
