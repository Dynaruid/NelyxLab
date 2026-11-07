// SPDX-License-Identifier: BSD-3-Clause
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import { StrutStyle } from '@nelyx/core/framework/painting/strut-style';
import { TextPosition } from '@nelyx/core/ui/text-position';
import { FontWeight, TextDecoration, FontFeature, FontVariation } from '@nelyx/core/ui/typography';
import { Shadow } from '@nelyx/core/ui/shadow';
import { Paint } from '@nelyx/core/ui/paint';
import { Canvas } from '@nelyx/core/ui/canvas';
import { Offset } from '@nelyx/core/ui/offset';
import { paragraphOptionsBytes } from '../../runtime/engine-client/paragraph.ts';
const check = (value, message) => {
  if (!value) throw Error(message);
};
export function richTextProbe(context, service) {
  const inputs = [],
    geometry = [];
  for (const revision of [0, 1]) {
    const span = new TextSpan({
        text: 'A😀 ',
        style: new TextStyle({
          fontSize: 18,
          color: 0xffdd3300,
          fontFeatures: [FontFeature.disable('liga')],
          shadows: [new Shadow({ color: 0xff00bbdd, offset: new Offset(-12, -4), blurRadius: 3 })],
        }),
        children: [
          new TextSpan({
            text: 'MMMM ',
            style: new TextStyle({
              fontSize: revision ? 30 : 26,
              color: 0xff2255cc,
              fontWeight: FontWeight.w700,
              fontVariations: [FontVariation.weight(revision ? 900 : 250)],
              fontStyle: 'italic',
              backgroundColor: 0xffffee99,
              decoration: TextDecoration.combine([
                TextDecoration.underline,
                TextDecoration.lineThrough,
              ]),
              decorationStyle: 'wavy',
              decorationColor: 0xff009966,
              decorationThickness: 2,
            }),
          }),
          new TextSpan({
            text: 'e\u0301 אבג مرحبا 한글',
            style: new TextStyle({
              fontSize: 22,
              foreground: new Paint({ color: 0xff882277 }),
              fontFamily: 'NelyxDefault',
              fontFamilyFallback: ['NelyxArabic', 'NelyxHebrew'],
              locale: 'he',
              shadows: [
                new Shadow({ color: 0xffcc5500, offset: new Offset(24, 30) }),
                new Shadow({ color: 0xff00bbdd, offset: new Offset(-12, -4), blurRadius: 3 }),
              ],
            }),
          }),
        ],
      }),
      painter = new TextPainter(
        {
          text: span,
          textDirection: revision ? 'rtl' : 'ltr',
          textScaler: TextScaler.linear(1.25),
          strutStyle: new StrutStyle({
            fontSize: 24,
            height: 1.4,
            leading: 0.2,
            forceStrutHeight: revision === 0,
            leadingDistribution: revision ? 'proportional' : 'even',
          }),
        },
        context,
      ),
      canvas = new Canvas();
    try {
      check(
        painter.layout({ minWidth: 180, maxWidth: 180 }) === undefined,
        'Rich layout is synchronous',
      );
      const layout = painter._layoutSnapshot(),
        glyph = service.glyphAt(layout, 1);
      check(glyph?.start === 1 && glyph.end === 3, 'Rich UTF16 emoji query');
      check(
        painter.getBoxesForSelection({ anchor: 1, focus: 3 }).length > 0,
        'Rich selection boxes',
      );
      check(painter.getClosestGlyphForOffset(new Offset(25, 10)) !== null, 'Rich closest glyph');
      check(
        painter.getFullHeightForCaret(new TextPosition({ offset: 1 }), { width: 1 }) > 0,
        'Strut caret query uses actual C++ metrics',
      );
      painter.paint(canvas, Offset.zero);
      const paint = service.capturePaint(canvas.commands[0].resource),
        runs = paint.input.paragraph.runs;
      check(
        runs?.length === 3 &&
          runs[0].fontSize === 22.5 &&
          runs[1].fontSize === (revision ? 37.5 : 32.5) &&
          runs[2].fontSize === 27.5,
        'Inherited scale and distinct styles survive Source recording',
      );
      check(
        runs[1].fontWeight === 700 &&
          runs[1].fontStyle === 'italic' &&
          runs[1].decoration === 5 &&
          runs[1].backgroundColor === 0xffffee99 &&
          runs[2].color === 0xff882277 &&
          runs[0].fontFeatures[0].name === 'liga' &&
          runs[0].fontFeatures[0].value === 0 &&
          runs[1].fontVariations[0].value === (revision ? 900 : 250) &&
          runs[2].shadows.length === 2 &&
          runs[2].shadows[0].offset.y === 30 &&
          runs[2].shadows[1].blurSigma === Shadow.convertRadiusToSigma(3),
        'Rich paint declarations',
      );
      const { height, ...paragraph } = paint.input.paragraph;
      check(
        paragraph.strut.fontSize === 30 && paragraph.strut.forceStrutHeight === (revision === 0),
        'Source scaler and strut flags survive recording',
      );
      inputs.push({
        input: {
          ...paint.input,
          paragraphData: Array.from(
            paragraphOptionsBytes({ ...paragraph, ...(height === null ? {} : { height }) }),
          ),
        },
        unbounded: paint.unbounded,
        width: paint.width,
        height: paint.height,
        baseline: paint.baseline,
      });
      geometry.push({
        width: painter.width,
        height: painter.height,
        baseline: paint.baseline,
        lines: painter.computeLineMetrics().length,
      });
    } finally {
      canvas.dispose();
      painter.dispose();
    }
  }
  check(
    inputs[0].input.paragraph.runs[1].fontSize === 32.5,
    'An updated painter cannot mutate an earlier copied DTO',
  );
  const effects = [];
  for (const [ligatures, weight, explicit] of [
    [0, 200, null],
    [1, 200, null],
    [1, 200, 900],
    [1, 900, null],
  ]) {
    const painter = new TextPainter(
      {
        text: new TextSpan({
          text: 'ffi AV 111',
          style: new TextStyle({
            fontSize: 36,
            fontWeight: new FontWeight(weight),
            fontFeatures: [new FontFeature('liga', ligatures)],
            ...(explicit === null ? {} : { fontVariations: [FontVariation.weight(explicit)] }),
          }),
        }),
        textDirection: 'ltr',
      },
      context,
    );
    try {
      painter.layout({ maxWidth: 400 });
      effects.push(painter._layoutSnapshot().maxIntrinsicWidth);
    } finally {
      painter.dispose();
    }
  }
  check(Math.abs(effects[0] - effects[1]) > 0.1, 'OpenType liga changes actual C++ shaping');
  check(effects[2] - effects[1] > 2, 'Explicit weight axis changes actual C++ geometry');
  check(Math.abs(effects[2] - effects[3]) < 0.001, 'Explicit wght overrides the lower fontWeight');
  return { inputs, geometry, effects };
}
