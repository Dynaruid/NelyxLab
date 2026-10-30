// SPDX-License-Identifier: BSD-3-Clause
import {
  State,
  StatefulWidget,
  StatelessWidget,
  Element,
} from '@nelyx/core/framework/widgets/framework';
import type { BuildContext } from '@nelyx/core/framework/widgets/framework';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import type { ViewControllerContext } from '@nelyx/core/hosting/runtime';
import type { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { Column, Padding, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { SelectableText } from '@nelyx/core/framework/widgets/selectable-text';
import { TextSelectionController } from '@nelyx/core/framework/painting/text-selection-controller';
import { TextScaler } from '@nelyx/core/framework/painting/text-scaler';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { WidgetSpan } from '@nelyx/core/framework/widgets/widget-span';
import { FontWeight, FontVariation, FontFeature, TextDecoration } from '@nelyx/core/ui/typography';
import { StrutStyle } from '@nelyx/core/framework/painting/strut-style';
import { SingleChildScrollView, ScrollController } from '@nelyx/core/framework/widgets/scroll';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';
import { Clipboard, ClipboardData } from '@nelyx/core/services/clipboard';
import { SemanticsService } from '@nelyx/core/framework/semantics/semantics-service';
import { FocusSemanticEvent } from '@nelyx/core/framework/semantics/semantics-event';
import { Feedback } from '@nelyx/core/framework/widgets/feedback';
import { GestureDetector } from '@nelyx/core/framework/widgets/gesture-detector';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { OrdinalSortKey } from '@nelyx/core/framework/semantics/semantics';
import { allInsets } from '@nelyx/core/ui/geometry';
import { Locale } from '@nelyx/core/ui/locale';
import { TapGestureRecognizer } from '@nelyx/core/framework/gestures/tap';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import {
  CustomPainter,
  CustomPainterSemantics,
} from '@nelyx/core/framework/rendering/custom-paint';
import { ParagraphBuilder } from '@nelyx/core/ui/paragraph-builder';
import { ParagraphStyle } from '@nelyx/core/ui/paragraph-style';
import { ParagraphConstraints } from '@nelyx/core/ui/paragraph-constraints';
import { Offset } from '@nelyx/core/ui/offset';
import { Paint } from '@nelyx/core/ui/paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import type { Size } from '@nelyx/core/ui/geometry';
const first =
  '본문을 드래그해서 선택하세요.\nSelect and copy this document.\n한국어 English é 👩‍💻 אבג العربية';
const second = '새 본문입니다.\nThe selection resets when the document changes.';
export class TextLab extends StatefulWidget {
  constructor(
    readonly services: ViewControllerContext,
    readonly scheduler: FrameScheduler,
    readonly back: () => void,
  ) {
    super();
  }
  createState(): State {
    return new TextLabState();
  }
}
class TextLabState extends State<TextLab> {
  private readonly feedbackKey = new GlobalKey('Text lab feedback');
  private readonly controller = new TextSelectionController(first);
  private readonly scroll = new ScrollController();
  private scale = 1;
  private status = 'Ready';
  private epoch = 0;
  private inlineCount = 0;
  private link!: TapGestureRecognizer;
  override initState(): void {
    super.initState();
    this.link = new TapGestureRecognizer({
      binding: (this.context as Element).owner.gestureBinding,
    });
    this.link.onTap = () => {
      if (this.mounted)
        this.setState(() => {
          this.inlineCount++;
          this.status = 'Inline link ' + this.inlineCount;
        });
    };
  }
  override dispose(): void {
    this.epoch++;
    this.link.dispose();
    this.controller.dispose();
    this.scroll.dispose();
    super.dispose();
  }
  private async copy(): Promise<void> {
    const messenger = this.widget.services.binaryMessenger;
    if (!messenger) {
      this.setState(() => {
        this.status = 'Clipboard unavailable';
      });
      return;
    }
    const epoch = this.epoch;
    try {
      await this.controller.copy({
        writeText: (text) => Clipboard.setData(new ClipboardData(text), messenger),
      });
      if (this.mounted && epoch === this.epoch)
        this.setState(() => {
          this.status = this.controller.selectedText ? 'Copied' : 'Select text first';
        });
    } catch (error) {
      if (this.mounted && epoch === this.epoch)
        this.setState(() => {
          this.status = 'Copy failed: ' + String(error);
        });
    }
  }
  private async announce(): Promise<void> {
    const view = this.widget.services.platformView;
    if (!view) {
      this.setState(() => {
        this.status = 'Announcements unavailable';
      });
      return;
    }
    const epoch = this.epoch;
    try {
      await SemanticsService.sendAnnouncement(view, 'Text lab announcement', 'ltr');
      if (this.mounted && epoch === this.epoch)
        this.setState(() => {
          this.status = 'Announcement requested';
        });
    } catch (error) {
      if (this.mounted && epoch === this.epoch)
        this.setState(() => {
          this.status = 'Announcement failed: ' + String(error);
        });
    }
  }
  build(): Widget {
    return new Scaffold(
      'Text lab',
      new SingleChildScrollView(
        new Padding(
          allInsets(16),
          new Column(
            [
              new Text('Drag to select, then copy. Ctrl+A and Ctrl+C also work.'),
              new SizedBox(undefined, 12),
              SelectableText.rich(
                new TextSpan({
                  children: [
                    new TextSpan({
                      text: this.controller.text.slice(0, this.controller.text.indexOf('\n') + 1),
                    }),
                    new TextSpan({
                      text: this.controller.text.slice(this.controller.text.indexOf('\n') + 1),
                      style: new TextStyle({ color: 0xffb7d7ff, fontWeight: FontWeight.w600 }),
                    }),
                  ],
                }),
                {
                  controller: this.controller,
                  fontSize: 22,
                  textScaler: TextScaler.linear(this.scale),
                  onCopyError: (error) =>
                    this.setState(() => {
                      this.status = 'Copy failed: ' + String(error);
                    }),
                },
              ),
              new SizedBox(undefined, 12),
              Text.rich(
                new TextSpan({
                  text: 'Rich body · ',
                  children: [
                    new TextSpan({
                      text: 'variable font ',
                      style: new TextStyle({
                        fontFamily: 'NelyxSlab',
                        fontSize: 25,
                        color: 0xff40a8ff,
                        fontVariations: [FontVariation.weight(750)],
                        fontFeatures: [FontFeature.tabularFigures()],
                        decoration: TextDecoration.underline,
                      }),
                    }),
                    new TextSpan({ text: '한국어 👩‍💻 אבג العربية ' }),
                    new TextSpan({
                      text: 'Inline link ',
                      locale: new Locale('en'),
                      semanticsIdentifier: 'text-inline-link',
                      recognizer: this.link,
                      style: new TextStyle({
                        color: 0xff40a8ff,
                        decoration: TextDecoration.underline,
                      }),
                    }),
                    new TextSpan({ text: 'API ', spellOut: true, locale: new Locale('en') }),
                    // The paragraph assigns 0, 1, 2 and 3 to its four text semantics runs.
                    // Give the inline control its place between the API run and the tail.
                    new WidgetSpan(
                      new Semantics(
                        new FilledButton('text-inline', 'Inline action', () =>
                          this.setState(() => {
                            this.inlineCount++;
                            this.status = 'Inline action ' + this.inlineCount;
                          }),
                        ),
                        { container: true, sortKey: new OrdinalSortKey(2.5) },
                      ),
                      { alignment: 'middle' },
                    ),
                    new TextSpan({ text: ' continues after the widget.' }),
                  ],
                }),
                {
                  fontSize: 22,
                  textScaler: TextScaler.linear(this.scale),
                  strutStyle: new StrutStyle({ fontSize: 22, height: 1.3 }),
                },
              ),
              new SizedBox(undefined, 16),
              new Text('Soft hyphens: shown / hidden', { fontSize: 16 }),
              new CustomPaint(undefined, {
                size: { width: 280, height: 80 * this.scale },
                painter: new ParagraphPreview(this.widget.services, this.scale),
              }),
              new SizedBox(undefined, 16),
              new FilledButton('text-select-all', 'Select all', () => this.controller.selectAll()),
              new FilledButton('text-copy', 'Copy selection', () => {
                void this.copy();
              }),
              new FilledButton('text-scale', 'Change text size', () =>
                this.setState(() => {
                  this.scale = this.scale === 1 ? 1.5 : 1;
                }),
              ),
              new FilledButton('text-replace', 'Change document', () =>
                this.setState(() => {
                  this.controller.text = this.controller.text === first ? second : first;
                  this.status = 'Document changed';
                }),
              ),
              new FilledButton('text-announce', 'Announce message', () => {
                void this.announce();
              }),
              new FeedbackTarget(this.feedbackKey, (status) => {
                if (this.mounted)
                  this.setState(() => {
                    this.status = status;
                  });
              }),
              new FilledButton('text-focus-feedback', 'Focus feedback control', () => {
                this.feedbackKey.currentContext
                  ?.findRenderObject()
                  ?.sendSemanticsEvent(new FocusSemanticEvent());
                this.setState(() => {
                  this.status = 'Focus event requested';
                });
              }),
              new Text(this.status),
              new SelectionSummary(this.controller),
              new FilledButton('text-back', 'Back', this.widget.back),
            ],
            { mainAxisSize: 'min', crossAxisAlignment: 'start' },
          ),
        ),
        this.scroll,
        this.widget.scheduler,
      ),
    );
  }
}
/** The key and callbacks belong to the target's actual mounted render context. */
class FeedbackTarget extends StatelessWidget {
  constructor(
    key: GlobalKey,
    private readonly report: (status: string) => void,
  ) {
    super(key);
  }
  build(context: BuildContext): Widget {
    const request = (longPress: boolean) => {
      const result = longPress ? Feedback.forLongPress(context) : Feedback.forTap(context);
      void result.then(
        () => {
          if (context.mounted)
            this.report(longPress ? 'Long press feedback requested' : 'Tap feedback requested');
        },
        (error) => {
          if (context.mounted) this.report('Feedback failed: ' + String(error));
        },
      );
    };
    return new GestureDetector(new Padding(allInsets(14), new Text('Feedback control')), {
      semanticsId: 'text-feedback',
      label: 'Feedback control',
      onTap: () => request(false),
      onLongPress: () => request(true),
    });
  }
}
/** Direct dart:ui-style paragraph use with explicit application engine ownership. */
class ParagraphPreview extends CustomPainter {
  lastResults: readonly {
    policy: string;
    lines: number;
    firstLine: number | null;
    unscaledAscent: number;
    firstGlyphEnd: number | null;
  }[] = [];
  constructor(
    private readonly services: ViewControllerContext,
    private readonly textScale: number,
  ) {
    super();
  }
  paint(canvas: Canvas, size: Size): void {
    const font = this.services.defaultFont;
    if (!font) return;
    const results = [];
    for (const [index, hyphens] of (['manual', 'hidden'] as const).entries()) {
      const builder = new ParagraphBuilder(
        new ParagraphStyle({ fontSize: 24 * this.textScale, hyphens }),
        {
          text: this.services.text,
          resources: this.services.resources,
          font,
          scale: this.services.readMetrics().scale,
          color: 0xffe8eef8,
        },
      );
      builder.addText('ab\u00adcd');
      const paragraph = builder.build();
      try {
        paragraph.layout(new ParagraphConstraints({ width: 36 * this.textScale }));
        const x = (index * size.width) / 2,
          metrics = paragraph.computeLineMetrics(),
          firstLine = paragraph.getLineNumberAt(0),
          glyph = paragraph.getGlyphInfoAt(0);
        for (const line of metrics)
          canvas.rect({ x, y: line.baseline, width: paragraph.width, height: 1 }, 0xff3b536d);
        if (glyph) {
          const box = glyph.graphemeClusterLayoutBounds;
          canvas.drawRect(
            { x: x + box.left, y: box.top, width: box.width, height: box.height },
            new Paint({ color: 0xff40a8ff, style: 'stroke', strokeWidth: 1 }),
          );
        }
        canvas.drawParagraph(paragraph, new Offset(x, 0));
        results.push({
          policy: hyphens,
          lines: paragraph.numberOfLines,
          firstLine,
          unscaledAscent: metrics[0]?.unscaledAscent ?? 0,
          firstGlyphEnd: glyph?.graphemeClusterCodeUnitRange.end ?? null,
        });
      } finally {
        paragraph.dispose();
      }
    }
    this.lastResults = results;
  }
  shouldRepaint(old: CustomPainter): boolean {
    return (
      !(old instanceof ParagraphPreview) ||
      old.services !== this.services ||
      old.textScale !== this.textScale
    );
  }
  override get semanticsBuilder() {
    return (size: Size) => [
      new CustomPainterSemantics({
        rect: { x: 0, y: 0, width: size.width, height: size.height },
        properties: {
          role: 'text',
          name: 'Soft hyphens shown on the left and hidden on the right',
          enabled: true,
        },
      }),
    ];
  }
}
class SelectionSummary extends StatefulWidget {
  constructor(readonly controller: TextSelectionController) {
    super();
  }
  createState(): State {
    return new SelectionSummaryState();
  }
}
class SelectionSummaryState extends State<SelectionSummary> {
  private readonly changed = () => {
    if (this.mounted) this.setState(() => {});
  };
  override initState(): void {
    this.widget.controller.addListener(this.changed);
  }
  override dispose(): void {
    this.widget.controller.removeListener(this.changed);
  }
  build(): Widget {
    return new Text(
      this.widget.controller.selectedText
        ? 'Selection: ' + this.widget.controller.selectedText
        : 'Selection: none',
      { fontSize: 14 },
    );
  }
}
