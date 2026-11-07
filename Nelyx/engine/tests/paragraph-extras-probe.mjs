// SPDX-License-Identifier: BSD-3-Clause
import { ParagraphBuilder } from '@nelyx/core/ui/paragraph-builder';
import { ParagraphStyle } from '@nelyx/core/ui/paragraph-style';
import { ParagraphConstraints } from '@nelyx/core/ui/paragraph-constraints';
import { Canvas } from '@nelyx/core/ui/canvas';
import { Offset } from '@nelyx/core/ui/offset';
import { Size } from '@nelyx/core/ui/size';
import { TextPainter } from '@nelyx/core/framework/painting/text-painter';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { StrutStyle } from '@nelyx/core/framework/painting/strut-style';
import { PlaceholderDimensions } from '@nelyx/core/framework/painting/placeholder-dimensions';
import { WidgetSpan } from '@nelyx/core/framework/widgets/widget-span';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
import { RenderParagraph } from '@nelyx/core/framework/rendering/paragraph';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import { paragraphOptionsBytes } from '../../runtime/engine-client/paragraph.ts';
const check = (value, message) => {
  if (!value) throw Error(message);
};
export function paragraphExtrasProbe(context, service) {
  const inputs = [];
  for (const direction of ['ltr', 'rtl']) {
    const compressed = direction === 'rtl',
      strutStyle = {
        fontSize: compressed ? 8 : 30,
        height: compressed ? 0.5 : 1.25,
        leading: 0,
        forceStrutHeight: compressed,
        leadingDistribution: 'even',
      },
      builder = new ParagraphBuilder(
        new ParagraphStyle({ fontSize: 18, textDirection: direction, strutStyle }),
        context,
      ),
      canvas = new Canvas();
    let paragraph;
    try {
      builder.pushStyle({ color: 0xff2255cc });
      builder.addText('Q😀 ');
      for (const [i, alignment] of [
        'baseline',
        'aboveBaseline',
        'belowBaseline',
        'top',
        'bottom',
        'middle',
      ].entries()) {
        builder.addPlaceholder(20 + i, 28 + i, alignment, {
          scale: 1.25,
          baseline: i % 2 ? 'ideographic' : 'alphabetic',
          baselineOffset: 15,
        });
        builder.addText(i % 2 ? ' אב ' : ' A ');
      }
      builder.pop();
      paragraph = builder.build();
      paragraph.layout(new ParagraphConstraints({ width: 220 }));
      const layout = paragraph._layoutSnapshot(),
        boxes = paragraph.getBoxesForPlaceholders();
      check(boxes.length === 6, 'All six SkParagraph placeholder alignments return geometry');
      boxes.forEach((box, i) => {
        check(
          Math.abs(box.right - box.left - (20 + i) * 1.25) < 0.001 &&
            Math.abs(box.bottom - box.top - (28 + i) * 1.25) < 0.001,
          'Placeholder scale and dimensions survive C++ layout',
        );
        check(['ltr', 'rtl'].includes(box.direction), 'Placeholder writing direction');
      });
      check(
        paragraph.getPositionForOffset(new Offset(boxes[0].left + 1, boxes[0].top + 1)).offset >= 0,
        'Placeholder hit query is synchronous',
      );
      canvas.drawParagraph(paragraph, Offset.zero);
      const paint = service.capturePaint(canvas.commands[0].resource),
        { height, ...options } = paint.input.paragraph;
      check(
        paint.input.paragraph.strut.forceStrutHeight === compressed,
        'Strut reaches copied paint input',
      );
      inputs.push({
        input: {
          ...paint.input,
          paragraphData: Array.from(
            paragraphOptionsBytes({ ...options, ...(height === null ? {} : { height }) }),
          ),
        },
        width: paint.width,
        height: paint.height,
        baseline: paint.baseline,
        unbounded: paint.unbounded,
        boxes: layout.placeholderBoxes,
      });
    } finally {
      canvas.dispose();
      paragraph?.dispose();
      builder.dispose();
    }
  }
  check(inputs[1].height < inputs[0].height, 'Forced small strut changes actual C++ line height');
  const alignments = ['baseline', 'aboveBaseline', 'belowBaseline', 'top', 'bottom', 'middle'],
    painter = new TextPainter(
      {
        text: new TextSpan({
          text: 'Q😀 ',
          style: new TextStyle({ fontSize: 18, color: 0xff2255cc }),
          children: alignments.flatMap((alignment) => [
            new WidgetSpan(new SizedBox(20, 30), { alignment, baseline: 'alphabetic' }),
            new TextSpan({ text: ' A ' }),
          ]),
        }),
        textDirection: 'ltr',
        strutStyle: new StrutStyle({ fontSize: 24, height: 1.4, leadingDistribution: 'even' }),
      },
      context,
    ),
    canvas = new Canvas();
  try {
    painter.setPlaceholderDimensions(
      alignments.map(
        (alignment, i) =>
          new PlaceholderDimensions({
            size: new Size(25 + i, 35 + i),
            alignment,
            baseline: 'alphabetic',
            baselineOffset: 18,
          }),
      ),
    );
    painter.layout({ minWidth: 220, maxWidth: 220 });
    check(
      painter.inlinePlaceholderBoxes.length === 6,
      'Canonical TextPainter accepts explicit WidgetSpan dimensions synchronously',
    );
    painter.paint(canvas, Offset.zero);
    const layout = painter._layoutSnapshot(),
      paint = service.capturePaint(canvas.commands[0].resource),
      { height, ...options } = paint.input.paragraph;
    inputs.push({
      input: {
        ...paint.input,
        paragraphData: Array.from(
          paragraphOptionsBytes({ ...options, ...(height === null ? {} : { height }) }),
        ),
      },
      width: paint.width,
      height: paint.height,
      baseline: paint.baseline,
      unbounded: paint.unbounded,
      boxes: layout.placeholderBoxes,
    });
  } finally {
    canvas.dispose();
    painter.dispose();
  }
  const render = new RenderParagraph(
    new TextSpan({ text: 'M', style: new TextStyle({ fontSize: 18 }) }),
    { textDirection: 'ltr' },
    context,
  );
  let baselines;
  try {
    const constraints = new BoxConstraints(0, 100, 0, 100);
    render.layout(constraints);
    baselines = {
      alphabetic: render.getDistanceToActualBaseline('alphabetic'),
      ideographic: render.getDistanceToActualBaseline('ideographic'),
      dryAlphabetic: render.getDryBaseline(constraints, 'alphabetic'),
      dryIdeographic: render.getDryBaseline(constraints, 'ideographic'),
    };
    check(
      baselines.ideographic > baselines.alphabetic,
      'Canonical RenderParagraph distinguishes its real ideographic baseline',
    );
    check(
      Math.abs(baselines.alphabetic - baselines.dryAlphabetic) < 1e-5 &&
        Math.abs(baselines.ideographic - baselines.dryIdeographic) < 1e-5,
      'Canonical RenderParagraph dry and actual baselines agree',
    );
  } finally {
    render.dispose();
  }
  return { inputs, baselines };
}
