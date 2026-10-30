// SPDX-License-Identifier: BSD-3-Clause
import { StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import type { State, Widget, BuildContext } from '@nelyx/core/framework/widgets/framework';
import { SingleTickerProviderStateMixin } from '@nelyx/core/framework/widgets/ticker-provider';
import { AnimationController } from '@nelyx/core/framework/animation/animation-controller';
import { CurvedAnimation } from '@nelyx/core/framework/animation/animations';
import {
  Animatable,
  Tween,
  CurveTween,
  ConstantTween,
} from '@nelyx/core/framework/animation/tween';
import { TweenSequence } from '@nelyx/core/framework/animation/tween-sequence';
import { TweenSequenceItem } from '@nelyx/core/framework/animation/tween-sequence-item';
import { Curves, CatmullRomSpline } from '@nelyx/core/framework/animation/curves';
import {
  AnimatedBuilder,
  SlideTransition,
  ScaleTransition,
  RotationTransition,
  FadeTransition,
  SizeTransition,
} from '@nelyx/core/framework/widgets/transitions';
import {
  Column,
  Expanded,
  Center,
  Text,
  SizedBox,
  DecoratedBox,
} from '@nelyx/core/framework/widgets/basic';
import { Wrap } from '@nelyx/core/framework/widgets/wrap';
import { AppTheme } from '@nelyx/core/framework/widgets/app-data';
import { Offset } from '@nelyx/core/ui/offset';
import { Scaffold, FilledButton } from '@nelyx/material/widgets';

export class AnimationLab extends StatefulWidget {
  constructor(readonly onBack: () => void) {
    super();
  }
  createState(): State {
    return new AnimationLabState();
  }
}
class AnimationLabState extends SingleTickerProviderStateMixin<AnimationLab> {
  private controller!: AnimationController;
  private curve!: CurvedAnimation;
  private shown = true;
  override initState(): void {
    super.initState();
    this.controller = new AnimationController({
      vsync: this,
      duration: 1600,
      value: 0,
      debugLabel: 'Animation lab',
    });
    this.curve = new CurvedAnimation({
      parent: this.controller,
      curve: Curves.easeInOut,
      reverseCurve: Curves.easeOut,
    });
  }
  override dispose(): void {
    this.curve.dispose();
    this.controller.dispose();
    super.dispose();
  }
  build(context: BuildContext): Widget {
    const theme = AppTheme.of(context),
      path = CatmullRomSpline.precompute([
        new Offset(-0.6, 0),
        new Offset(-0.2, -0.3),
        new Offset(0.2, 0.3),
        new Offset(0.6, 0),
      ]);
    const position = Animatable.fromCallback((t) => path.transform(t)).animate(this.curve),
      scale = new Tween({ begin: 0.65, end: 1.25 }).animate(this.curve),
      turns = new Tween({ begin: 0, end: 1 }).animate(this.curve);
    const opacity = new TweenSequence([
      new TweenSequenceItem({
        tween: new Tween({ begin: 0.2, end: 1 }).chain(new CurveTween({ curve: Curves.easeIn })),
        weight: 2,
      }),
      new TweenSequenceItem({ tween: new ConstantTween(1), weight: 1 }),
      new TweenSequenceItem({ tween: new Tween({ begin: 1, end: 0.4 }), weight: 1 }),
    ]).animate(this.controller);
    const tile = new DecoratedBox(
      new SizedBox(80, 80, new Center(new Text('Nelyx', { color: 0xffffffff, fontSize: 18 }))),
      theme.accent,
      16,
    );
    return new Scaffold(
      'Animation lab',
      new Column(
        [
          new Wrap(
            [
              new FilledButton('animation-back', 'Back', this.widget.onBack),
              new FilledButton('animation-forward', 'Forward', () => {
                void this.controller.forward({ from: 0 }).orCancel.catch(() => {});
              }),
              new FilledButton('animation-reverse', 'Reverse', () => {
                void this.controller.reverse({ from: 1 }).orCancel.catch(() => {});
              }),
              new FilledButton('animation-repeat', 'Repeat', () => {
                void this.controller.repeat({ reverse: true }).orCancel.catch(() => {});
              }),
              new FilledButton('animation-stop', 'Stop', () => {
                this.controller.stop();
                this.setState(() => {});
              }),
              new FilledButton('animation-visible', this.shown ? 'Hide shape' : 'Show shape', () =>
                this.setState(() => {
                  this.shown = !this.shown;
                }),
              ),
            ],
            { spacing: 8, runSpacing: 8 },
          ),
          new AnimatedBuilder({
            animation: this.controller,
            builder: () =>
              new Text(
                `Progress ${this.controller.value.toFixed(2)} · ${this.controller.status.name}${this.controller.isAnimating ? '' : ' · stopped'}`,
                { color: theme.foreground, fontSize: 16 },
              ),
          }),
          new Text('Move, turn, resize and fade along a curved path.', {
            color: theme.foreground,
            fontSize: 14,
          }),
          new Expanded(
            new Center(
              this.shown
                ? new SlideTransition({
                    position,
                    child: new ScaleTransition({
                      scale,
                      filterQuality: 'medium',
                      child: new RotationTransition({
                        turns,
                        child: new FadeTransition({ opacity, child: tile }),
                      }),
                    }),
                  })
                : new SizedBox(80, 80),
            ),
          ),
          new SizedBox(
            undefined,
            64,
            new Center(
              new SizeTransition({
                sizeFactor: this.curve,
                child: new Text('Size transition', { color: theme.foreground, fontSize: 20 }),
              }),
            ),
          ),
        ],
        { spacing: 12, crossAlign: 'stretch', mainSize: 'max' },
      ),
    );
  }
}
