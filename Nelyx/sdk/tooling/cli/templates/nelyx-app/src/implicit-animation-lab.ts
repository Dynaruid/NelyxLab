// SPDX-License-Identifier: BSD-3-Clause
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { BuildContext, Widget } from '@nelyx/core/framework/widgets/framework';
import {
  AnimatedContainer,
  AnimatedScale,
  AnimatedRotation,
  AnimatedSlide,
  AnimatedOpacity,
  AnimatedDefaultTextStyle,
  AnimatedPhysicalModel,
} from '@nelyx/core/framework/widgets/implicit-animations';
import {
  Column,
  Expanded,
  Center,
  Text,
  SizedBox,
  PhysicalShape,
} from '@nelyx/core/framework/widgets/basic';
import { ListView } from '@nelyx/core/framework/widgets/scroll-view';
import { Wrap } from '@nelyx/core/framework/widgets/wrap';
import { CustomClipper } from '@nelyx/core/framework/rendering/clip';
import { Path } from '@nelyx/core/ui/path';
import type { Size } from '@nelyx/core/ui/geometry';
import { Container } from '@nelyx/core/framework/widgets/container';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { WidgetSpan } from '@nelyx/core/framework/widgets/widget-span';
import { Curves } from '@nelyx/core/framework/animation/curves';
import { TextStyle } from '@nelyx/core/framework/painting/text-style';
import { TextSpan } from '@nelyx/core/framework/painting/text-span';
import type { TextOverflow } from '@nelyx/core/framework/painting/text-painter';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { BorderRadius } from '@nelyx/core/framework/painting/border-radius';
import { EdgeInsets } from '@nelyx/core/framework/painting/edge-insets';
import { Alignment } from '@nelyx/core/framework/painting/alignment';
import { Offset } from '@nelyx/core/ui/offset';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';
import { Paint } from '@nelyx/core/ui/paint';
import { Gradient } from '@nelyx/core/ui/shader';

export class ImplicitAnimationLab extends StatefulWidget {
  constructor(readonly onBack: () => void) {
    super();
  }
  createState(): State<ImplicitAnimationLab> {
    return new ImplicitAnimationLabState();
  }
}
class ImplicitAnimationLabState extends State<ImplicitAnimationLab> {
  private target = false;
  private shown = true;
  private wrapping = false;
  private overflow: TextOverflow = 'fade';
  private ends = 0;
  private animateColors = true;
  private readonly textPaintA = new Paint({
    style: 'stroke',
    strokeWidth: 1,
    shader: Gradient.linear({ x: 0, y: 0 }, { x: 300, y: 0 }, [0xffc52b61, 0xff2454c5]),
  });
  private readonly textPaintB = new Paint({
    shader: Gradient.linear({ x: 0, y: 0 }, { x: 300, y: 0 }, [0xff6132a5, 0xff008b9a]),
  });
  private readonly textBackground = new Paint({ color: 0xfff5e9bd });
  override dispose(): void {
    this.textPaintA.shader?.dispose();
    this.textPaintB.shader?.dispose();
    super.dispose();
  }
  build(context: BuildContext): Widget {
    const theme = AppTheme.of(context),
      animated = { duration: 1200, curve: Curves.easeInOut },
      body = 'Animated text · 한국어 · abcdefghijklmnopqrstuvwxyz';
    return new Scaffold(
      'Implicit animations',
      new Column(
        [
          new Wrap(
            [
              new FilledButton('implicit-back', 'Back', this.widget.onBack),
              new FilledButton('implicit-toggle', 'Toggle target', () =>
                this.setState(() => {
                  this.target = !this.target;
                }),
              ),
              new FilledButton('implicit-wrap', this.wrapping ? 'No wrap' : 'Wrap text', () =>
                this.setState(() => {
                  this.wrapping = !this.wrapping;
                }),
              ),
              new FilledButton('implicit-overflow', `Overflow: ${this.overflow}`, () =>
                this.setState(() => {
                  const modes: readonly TextOverflow[] = ['fade', 'ellipsis', 'clip', 'visible'];
                  this.overflow = modes[(modes.indexOf(this.overflow) + 1) % modes.length]!;
                }),
              ),
              new FilledButton(
                'implicit-shown',
                this.shown ? 'Remove examples' : 'Show examples',
                () =>
                  this.setState(() => {
                    this.shown = !this.shown;
                  }),
              ),
              new FilledButton(
                'implicit-colors',
                this.animateColors ? 'Snap colors' : 'Animate colors',
                () =>
                  this.setState(() => {
                    this.animateColors = !this.animateColors;
                  }),
              ),
            ],
            { spacing: 8, runSpacing: 8 },
          ),
          new Text(`Target ${this.target ? 'B' : 'A'} · completed ${this.ends}`, {
            color: theme.foreground,
            fontSize: 16,
          }),
          new Expanded(
            this.shown
              ? new ListView({
                  children: [
                    new SizedBox(
                      undefined,
                      240,
                      new Center(
                        new AnimatedSlide({
                          ...animated,
                          offset: new Offset(this.target ? 0.1 : -0.1, 0),
                          child: new AnimatedScale({
                            ...animated,
                            scale: this.target ? 1.1 : 0.85,
                            filterQuality: 'medium',
                            child: new AnimatedRotation({
                              ...animated,
                              turns: this.target ? 0.04 : 0,
                              child: new AnimatedOpacity({
                                ...animated,
                                opacity: this.target ? 1 : 0.55,
                                child: new AnimatedContainer({
                                  ...animated,
                                  width: this.target ? 180 : 108,
                                  height: this.target ? 144 : 100,
                                  padding: EdgeInsets.all(this.target ? 12 : 6),
                                  margin: EdgeInsets.all(4),
                                  alignment: Alignment.center,
                                  decoration: new BoxDecoration({
                                    color: this.target ? theme.accent : 0xff456090,
                                    borderRadius: BorderRadius.circular(this.target ? 36 : 8),
                                  }),
                                  clipBehavior: 'antiAlias',
                                  onEnd: () => {
                                    if (this.mounted)
                                      this.setState(() => {
                                        this.ends++;
                                      });
                                  },
                                  child: new Text('Nelyx', { color: 0xffffffff, fontSize: 20 }),
                                }),
                              }),
                            }),
                          }),
                        }),
                      ),
                    ),
                    new Text('Change the target again while it is moving.', {
                      color: theme.foreground,
                      fontSize: 14,
                    }),
                    new Container({
                      height: 180,
                      color: 0xffedf2f8,
                      child: new Center(
                        new AnimatedPhysicalModel({
                          ...animated,
                          elevation: this.target ? 20 : 2,
                          borderRadius: BorderRadius.circular(this.target ? 28 : 8),
                          shape: this.target ? 'circle' : 'rectangle',
                          color: this.target ? 0xff426cc5 : 0xff59718d,
                          shadowColor: this.target ? 0xff26143d : 0xff000000,
                          animateColor: this.animateColors,
                          animateShadowColor: this.animateColors,
                          clipBehavior: 'antiAliasWithSaveLayer',
                          child: new SizedBox(
                            140,
                            80,
                            new Center(
                              new Text(`Elevation ${this.target ? 20 : 2}`, {
                                color: 0xffffffff,
                                fontSize: 16,
                              }),
                            ),
                          ),
                        }),
                      ),
                    }),
                    new Text('Path clip and shadow', { color: theme.foreground, fontSize: 14 }),
                    new Container({
                      height: 190,
                      color: 0xffedf2f8,
                      child: new Center(
                        new PhysicalShape({
                          clipper: new CutoutClipper(this.target ? 0.65 : 0.35),
                          elevation: this.target ? 20 : 2,
                          color: this.target ? 0xff426cc5 : 0xff59718d,
                          clipBehavior: 'antiAliasWithSaveLayer',
                          child: new SizedBox(
                            180,
                            100,
                            new Center(
                              new Text(`Shape ${this.target ? 'B' : 'A'}`, {
                                color: 0xffffffff,
                                fontSize: 16,
                              }),
                            ),
                          ),
                        }),
                      ),
                    }),
                    new Text('Paint text and baseline', { color: theme.foreground, fontSize: 14 }),
                    new Container({
                      height: 120,
                      padding: EdgeInsets.all(12),
                      color: 0xffedf2f8,
                      child: new Center(
                        new AnimatedDefaultTextStyle({
                          ...animated,
                          style: new TextStyle({
                            fontSize: this.target ? 34 : 24,
                            foreground: this.target ? this.textPaintB : this.textPaintA,
                            background: this.textBackground,
                            textBaseline: this.target ? 'alphabetic' : 'ideographic',
                          }),
                          child: new Text('Paint · 한국어', { maxLines: 1, overflow: 'clip' }),
                        }),
                      ),
                    }),
                    new AnimatedDefaultTextStyle({
                      ...animated,
                      style: new TextStyle({
                        fontSize: this.target ? 26 : 16,
                        color: this.target ? theme.accent : theme.foreground,
                        letterSpacing: this.target ? 1 : 0,
                      }),
                      softWrap: this.wrapping,
                      overflow: this.overflow,
                      maxLines: 2,
                      child: new Column(
                        [
                          new Text('Plain Text', { color: theme.foreground, fontSize: 14 }),
                          new Container({ height: 72, child: new Text(body) }),
                          new Text('Rich Text', { color: theme.foreground, fontSize: 14 }),
                          new Container({
                            height: 72,
                            child: Text.rich(new TextSpan({ text: body })),
                          }),
                          new Text('Inline child: parent width', {
                            color: theme.foreground,
                            fontSize: 14,
                          }),
                          new Container({
                            height: 48,
                            child: Text.rich(
                              new TextSpan({
                                text: 'Inline ',
                                children: [
                                  new WidgetSpan(new Container({ height: 8, color: theme.accent })),
                                ],
                              }),
                              { softWrap: false, overflow: 'clip' },
                            ),
                          }),
                        ],
                        { crossAlign: 'stretch', mainSize: 'min', spacing: 8 },
                      ),
                    }),
                  ],
                })
              : new Center(new Text('Examples removed', { color: theme.foreground })),
          ),
        ],
        { crossAlign: 'stretch', spacing: 12 },
      ),
    );
  }
}
class CutoutClipper extends CustomClipper<Path> {
  constructor(private readonly holeFraction: number) {
    super();
  }
  getClip(size: Size): Path {
    const path = new Path();
    path.fillType = 'evenOdd';
    path.moveTo(0, size.height);
    path.lineTo(size.width / 2, 0);
    path.lineTo(size.width, size.height);
    path.close();
    path.addOval({
      x: size.width * this.holeFraction - 16,
      y: size.height * 0.75 - 16,
      width: 32,
      height: 32,
    });
    return path;
  }
  shouldReclip(previous: CustomClipper<Path>): boolean {
    return !(previous instanceof CutoutClipper) || previous.holeFraction !== this.holeFraction;
  }
}
