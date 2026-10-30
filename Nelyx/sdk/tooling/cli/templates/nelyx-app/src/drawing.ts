// SPDX-License-Identifier: BSD-3-Clause
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import type { ViewControllerContext } from '@nelyx/core/hosting/runtime';
import type { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { Column, Row, Padding, SizedBox, Text } from '@nelyx/core/framework/widgets/basic';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import { CustomPainter } from '@nelyx/core/framework/rendering/custom-paint';
import { Image as ImageWidget } from '@nelyx/core/framework/widgets/image';
import { RawImage } from '@nelyx/core/framework/widgets/raw-image';
import { RepaintBoundary } from '@nelyx/core/framework/widgets/repaint-boundary';
import { SingleChildScrollView, ScrollController } from '@nelyx/core/framework/widgets/scroll';
import { allInsets } from '@nelyx/core/ui/geometry';
import type { Size } from '@nelyx/core/ui/geometry';
import { Canvas } from '@nelyx/core/ui/canvas';
import { PictureRecorder } from '@nelyx/core/ui/picture-recorder';
import type { Picture } from '@nelyx/core/ui/picture';
import type { Image } from '@nelyx/core/ui/image';
import { Paint } from '@nelyx/core/ui/paint';
import { Gradient } from '@nelyx/core/ui/shader';
import { Path } from '@nelyx/core/ui/path';

/** Existing consumer app flow for native Picture reuse, image codecs and snapshot ownership. */
export class DrawingLab extends StatefulWidget {
  constructor(
    readonly services: ViewControllerContext,
    readonly scheduler: FrameScheduler,
    readonly back: () => void,
  ) {
    super();
  }
  createState(): State {
    return new DrawingState();
  }
}
class DrawingState extends State<DrawingLab> {
  private picture!: Picture;
  private captured: Image | null = null;
  private alternate = false;
  private busy = false;
  private epoch = 0;
  private status = 'Ready';
  private readonly scroll = new ScrollController();
  override initState(): void {
    this.picture = record(false);
  }
  override dispose(): void {
    this.epoch++;
    this.picture.dispose();
    this.captured?.dispose();
    this.scroll.dispose();
  }
  private change(): void {
    const picture = record(!this.alternate),
      old = this.picture;
    this.setState(() => {
      this.alternate = !this.alternate;
      this.picture = picture;
      this.status = 'Colors changed';
    });
    old.dispose();
  }
  private async capture(): Promise<void> {
    if (this.busy) return;
    const rasterizer = this.widget.services.rasterizer;
    if (!rasterizer) {
      this.setState(() => {
        this.status = 'Image capture unavailable';
      });
      return;
    }
    const epoch = ++this.epoch;
    this.setState(() => {
      this.busy = true;
      this.status = 'Capturing…';
    });
    try {
      const image = await this.picture.toImage(128, 96, rasterizer);
      if (!this.mounted || epoch !== this.epoch) {
        image.dispose();
        return;
      }
      const old = this.captured;
      this.setState(() => {
        this.captured = image;
        this.busy = false;
        this.status = 'Captured · 128×96';
      });
      old?.dispose();
    } catch {
      if (this.mounted && epoch === this.epoch)
        this.setState(() => {
          this.busy = false;
          this.status = 'Image capture failed';
        });
    }
  }
  build(): Widget {
    const theme = AppTheme.of(this.context),
      label = (text: string) => new Text(text, { color: theme.foreground, fontSize: 18 });
    return new Scaffold(
      'Drawing lab',
      new SingleChildScrollView(
        new Padding(
          allInsets(16),
          new Column(
            [
              new FilledButton('drawing-back', 'Back', this.widget.back),
              label('Draw, capture, then change the colors.'),
              new RepaintBoundary(
                new SizedBox(
                  128,
                  96,
                  new CustomPaint(undefined, { painter: new PicturePainter(this.picture) }),
                ),
              ),
              new Row(
                [
                  new FilledButton('drawing-capture', 'Capture image', () => {
                    void this.capture();
                  }),
                  new FilledButton('drawing-colors', 'Change colors', () => this.change()),
                ],
                { spacing: 12 },
              ),
              label(this.status),
              new SizedBox(
                128,
                96,
                this.captured
                  ? new RawImage({
                      image: this.captured,
                      width: 128,
                      height: 96,
                      filterQuality: 'none',
                    })
                  : label('Your captured image appears here.'),
              ),
              label('Images'),
              new Row(
                [
                  ImageWidget.asset('sample-image', {
                    width: 48,
                    height: 48,
                    fit: 'cover',
                    semanticLabel: 'Static image',
                    errorBuilder: () => label('Static image unavailable'),
                  }),
                  ImageWidget.asset('sample-animation', {
                    width: 48,
                    height: 48,
                    fit: 'cover',
                    semanticLabel: 'Animated image',
                    errorBuilder: () => label('Animated image unavailable'),
                  }),
                ],
                { spacing: 16 },
              ),
            ],
            { spacing: 12, crossAlign: 'start' },
          ),
        ),
        this.scroll,
        this.widget.scheduler,
      ),
    );
  }
}
function record(alternate: boolean): Picture {
  const recorder = new PictureRecorder(),
    canvas = new Canvas(recorder),
    colors = alternate ? [0xfff97316, 0xfffacc15] : [0xff2563eb, 0xff2dd4bf];
  try {
    canvas.drawRect(
      { x: 0, y: 0, width: 128, height: 96 },
      new Paint({ shader: Gradient.linear({ x: 0, y: 0 }, { x: 128, y: 96 }, colors) }),
    );
    canvas.saveLayer({ x: 8, y: 8, width: 112, height: 80 }, new Paint({ color: 0xddffffff }));
    const path = new Path();
    path.moveTo(16, 65);
    path.cubicTo(34, 2, 94, 2, 112, 65);
    path.conicTo(64, 102, 16, 65, 0.7);
    path.close();
    canvas.drawPath(path, new Paint({ color: 0xfff8fafc }));
    canvas.restore();
    canvas.drawLine(
      { x: 40, y: 58 },
      { x: 58, y: 74 },
      new Paint({ color: 0xff163554, strokeWidth: 6, strokeCap: 'round' }),
    );
    canvas.drawLine(
      { x: 58, y: 74 },
      { x: 89, y: 35 },
      new Paint({ color: 0xff163554, strokeWidth: 6, strokeCap: 'round' }),
    );
    return recorder.endRecording();
  } finally {
    canvas.dispose();
  }
}
class PicturePainter extends CustomPainter {
  constructor(private readonly picture: Picture) {
    super();
  }
  paint(canvas: Canvas, size: Size): void {
    canvas.scale(size.width / 128, size.height / 96);
    canvas.drawPicture(this.picture);
  }
  shouldRepaint(old: PicturePainter): boolean {
    return this.picture !== old.picture;
  }
}
