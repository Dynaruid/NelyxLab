// SPDX-License-Identifier: BSD-3-Clause
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import { allInsets } from '@nelyx/core/ui/geometry';
import { StatefulWidget, State } from '@nelyx/core/framework/widgets/framework';
import { Flow } from '@nelyx/core/framework/widgets/flow';
import { FlowDelegate } from '@nelyx/core/framework/rendering/flow';
import type { FlowPaintingContext } from '@nelyx/core/framework/rendering/flow';
import { Paint } from '@nelyx/core/ui/paint';
import { ClipRect, ClipRRect, ClipOval } from '@nelyx/core/framework/widgets/clip';
import { CustomClipper } from '@nelyx/core/framework/rendering/clip';
import type { Rect } from '@nelyx/core/ui/types';
import { Path } from '@nelyx/core/ui/path';
import { RRect } from '@nelyx/core/ui/rrect';
import { Radius } from '@nelyx/core/ui/radius';
import { BorderRadiusDirectional } from '@nelyx/core/framework/painting/border-radius';
import { BoxDecoration } from '@nelyx/core/framework/painting/box-decoration';
import { DecorationImage } from '@nelyx/core/framework/painting/decoration-image';
import { AssetImage } from '@nelyx/core/framework/painting/image-provider';
import { Image } from '@nelyx/core/framework/widgets/image';
import { BorderDirectional } from '@nelyx/core/framework/painting/box-border';
import { BorderSide } from '@nelyx/core/framework/painting/borders';
import { BoxShadow } from '@nelyx/core/framework/painting/box-shadow';
import { LinearGradient, GradientRotation } from '@nelyx/core/framework/painting/gradient';
import { CustomPaint } from '@nelyx/core/framework/widgets/custom-paint';
import {
  CustomPainter,
  CustomPainterSemantics,
} from '@nelyx/core/framework/rendering/custom-paint';
import type { Canvas } from '@nelyx/core/ui/canvas';
import { Wrap } from '@nelyx/core/framework/widgets/wrap';
import { ListBody } from '@nelyx/core/framework/widgets/list-body';
import { Table, TableRow, TableCell } from '@nelyx/core/framework/widgets/table';
import { FixedColumnWidth } from '@nelyx/core/framework/rendering/table';
import { ValueKey } from '@nelyx/core/foundation/key';
import {
  CustomSingleChildLayout,
  CustomMultiChildLayout,
  LayoutId,
} from '@nelyx/core/framework/widgets/custom-layout';
import {
  SingleChildLayoutDelegate,
  MultiChildLayoutDelegate,
} from '@nelyx/core/framework/rendering/custom-layout';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import type { Size } from '@nelyx/core/ui/geometry';
import { Size as SizeValue } from '@nelyx/core/ui/size';
import { Offset } from '@nelyx/core/ui/offset';
import { Matrix4 } from '@nelyx/core/math/matrix4';
import { AlignmentDirectional } from '@nelyx/core/framework/painting/alignment';
import type { Widget } from '@nelyx/core/framework/widgets/framework';
import {
  Column,
  Row,
  Expanded,
  Padding,
  Text,
  DecoratedBox,
  SizedBox,
  safeArea,
  Builder,
  Transform,
  Center,
} from '@nelyx/core/framework/widgets/basic';
import { EditableText, TextEditingController } from '@nelyx/core/framework/widgets/editable-text';
import { widgetApplication } from '@nelyx/core/framework/widgets/root';
import type { ViewControllerContext } from '@nelyx/core/hosting/runtime';
import type { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import {
  LazyList,
  ScrollController,
  SingleChildScrollView,
} from '@nelyx/core/framework/widgets/scroll';
import { Navigator, NavigatorController, Route } from '@nelyx/core/framework/widgets/navigation';
import {
  MaterialApp,
  Scaffold,
  FilledButton,
  ListTile,
  AlertDialog,
  showDialog,
} from '@nelyx/material/widgets';
import { KeyboardLab } from './keyboard-lab.ts';
import { PointerLab } from './pointer-lab.ts';
import { GestureArenaLab } from './gesture-arena-lab.ts';
import { GestureRecognizerLab } from './gesture-recognizer-lab.ts';
import { GestureFamilyLab } from './gesture-family-lab.ts';
import { GestureSurfacesLab } from './gesture-surfaces-lab.ts';
import { ScrollMotionLab } from './scroll-motion-lab.ts';
import { SliverLab } from './sliver-lab.ts';
import { AnimationLab } from './animation-lab.ts';
import { ImplicitAnimationLab } from './implicit-animation-lab.ts';
import { TraversalLab } from './traversal-lab.ts';
import {
  CupertinoTheme,
  CupertinoPageScaffold,
  CupertinoButton,
  CupertinoTextField,
} from '@nelyx/cupertino/widgets';
import {
  darkAppTheme,
  lightAppTheme,
  AppTheme,
  Localizations,
  MediaQuery,
  Directionality,
  mediaFromView,
} from '@nelyx/core/framework/widgets/app-data';
import { AnimationController, easeInOut } from '@nelyx/core/framework/animation/animation';
import { FocusNode } from '@nelyx/core/framework/widgets/focus';
import { GlobalKey } from '@nelyx/core/framework/widgets/global-key';
import type { Disposable } from '@nelyx/core/foundation/disposable';
import { DrawingLab } from './drawing.ts';
import { TextLab } from './text-lab.ts';
export interface ApplicationState {
  readonly initialText: string;
}
export function createApplicationState(): ApplicationState {
  return { initialText: '안녕하세요 Nelyx!' };
}
export function defineApplication(state: ApplicationState): ApplicationDefinition {
  return widgetApplication({
    id: 'nelyx.sample',
    defaultFont: 'sample-font',
    createRoot: (context, scheduler) => new SampleApp(state.initialText, context, scheduler),
  });
}
class SampleApp extends StatefulWidget {
  constructor(
    readonly initialText: string,
    readonly services: ViewControllerContext,
    readonly scheduler: FrameScheduler,
  ) {
    super();
  }
  createState(): State {
    return new SampleState();
  }
}
class SampleState extends State<SampleApp> {
  private count = 0;
  private editor!: TextEditingController;
  private second!: TextEditingController;
  private readonly secondFocus = new FocusNode();
  private readonly secondEditorKey = new GlobalKey('sample second editor');
  private secondOnRight = false;
  private readonly navigator = new NavigatorController();
  private readonly scroll = new ScrollController();
  private readonly pageScroll = new ScrollController();
  private light = false;
  private locale = 'ko';
  private decorationRtl = false;
  private animation!: AnimationController;
  private servicesObserver: Disposable | undefined;
  private serviceStatus = '';
  private serviceEpoch = 0;
  override initState(): void {
    this.editor = new TextEditingController(this.widget.initialText);
    this.second = new TextEditingController('TypeScript UI');
    this.animation = new AnimationController(this.widget.scheduler, 250);
    this.servicesObserver = this.widget.services.platformServices?.addObserver({
      didChangeEnvironment: () => {
        if (this.mounted) this.setState(() => {});
      },
      didReceiveServiceError: (error) => {
        if (this.mounted)
          this.setState(() => {
            this.serviceStatus = String(error);
          });
      },
    });
  }
  override dispose(): void {
    this.serviceEpoch++;
    this.servicesObserver?.dispose();
    this.editor.dispose();
    this.second.dispose();
    this.secondFocus.dispose();
    this.scroll.dispose();
    this.pageScroll.dispose();
    this.navigator.dispose();
    this.animation.dispose();
  }
  private async clipboard(copy: boolean): Promise<void> {
    const epoch = ++this.serviceEpoch;
    try {
      const services = this.widget.services.platformServices;
      if (!services) throw new Error('OS services unavailable');
      if (copy) {
        await services.writeText(this.editor.text);
      } else {
        const text = await services.readText();
        if (!this.mounted || epoch !== this.serviceEpoch) return;
        this.editor.replace(text, { anchor: text.length, focus: text.length });
      }
      if (this.mounted && epoch === this.serviceEpoch)
        this.setState(() => {
          this.serviceStatus = copy ? 'Copied' : 'Pasted';
        });
    } catch (error) {
      if (this.mounted && epoch === this.serviceEpoch)
        this.setState(() => {
          this.serviceStatus = String(error);
        });
    }
  }
  private async systemBack(): Promise<void> {
    const epoch = ++this.serviceEpoch;
    try {
      await this.widget.services.platformServices?.popSystemNavigator();
    } catch (error) {
      if (this.mounted && epoch === this.serviceEpoch)
        this.setState(() => {
          this.serviceStatus = String(error);
        });
    }
  }
  build(): Widget {
    const media = mediaFromView(this.context);
    return new MediaQuery(
      media,
      new MaterialApp(
        safeArea(
          new Navigator(this.navigator, new Route((context) => this.home(context), 'home')),
          media,
        ),
        this.light ? lightAppTheme : darkAppTheme,
        this.locale,
        {
          ko: { list: '목록', theme: '테마 전환', locale: 'English' },
          en: { list: 'Items', theme: 'Change theme', locale: '한국어' },
        },
      ),
    );
  }
  private home(context: import('@nelyx/core/framework/widgets/framework').BuildContext): Widget {
    const theme = AppTheme.of(context),
      messages = Localizations.of(context),
      media = MediaQuery.of(context),
      height = Math.max(
        80,
        media.height -
          media.safeArea.top -
          Math.max(media.safeArea.bottom, media.keyboardInset) -
          526,
      );
    const counterTransform = Matrix4.identity();
    counterTransform.setEntry(3, 0, 0.0002);
    return new Scaffold(
      'Nelyx',
      new SingleChildScrollView(
        new Column(
          [
            new FilledButton('drawing-lab', 'Drawing lab', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new DrawingLab(this.widget.services, this.widget.scheduler, () => {
                        this.navigator.pop();
                      }),
                    'drawing',
                  ),
                )
                .catch(() => {});
            }),
            new FilledButton('text-lab', 'Text lab', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new TextLab(this.widget.services, this.widget.scheduler, () => {
                        this.navigator.pop();
                      }),
                    'text',
                  ),
                )
                .catch(() => {});
            }),
            new FilledButton('keyboard-lab', 'Keyboard lab', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new KeyboardLab(() => {
                        this.navigator.pop();
                      }, this.widget.scheduler),
                    'keyboard',
                  ),
                )
                .catch(() => {});
            }),
            new FilledButton('pointer-lab', 'Pointer dispatch', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new PointerLab(this.widget.scheduler, () => {
                        this.navigator.pop();
                      }),
                    'pointer',
                  ),
                )
                .catch(() => {});
            }),
            new FilledButton('gesture-arena-lab', 'Gesture arena', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new GestureArenaLab(() => {
                        this.navigator.pop();
                      }),
                    'gesture-arena',
                  ),
                )
                .catch(() => {});
            }),
            new FilledButton('gesture-recognizer-lab', 'Gesture recognizers', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new GestureRecognizerLab(() => {
                        this.navigator.pop();
                      }),
                    'gesture-recognizers',
                  ),
                )
                .catch(() => {});
            }),
            new FilledButton('gesture-family-lab', 'Gesture families', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new GestureFamilyLab(() => {
                        this.navigator.pop();
                      }),
                    'gesture-families',
                  ),
                )
                .catch(() => {});
            }),
            new FilledButton('gesture-surfaces-lab', 'Gesture surfaces', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new GestureSurfacesLab(this.widget.scheduler, () => {
                        this.navigator.pop();
                      }),
                    'gesture-surfaces',
                  ),
                )
                .catch(() => {});
            }),
            new FilledButton('scroll-motion-lab', 'Scroll motion', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new ScrollMotionLab(this.widget.scheduler, () => {
                        this.navigator.pop();
                      }),
                    'scroll-motion',
                  ),
                )
                .catch(() => {});
            }),
            new FilledButton('sliver-lab', 'Mixed list + grid', () => {
              void this.navigator.push(
                new Route(
                  () =>
                    new SliverLab(() => {
                      this.navigator.pop();
                    }),
                  'sliver-lab',
                ),
              );
            }),
            new FilledButton('animation-lab', 'Animation lab', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new AnimationLab(() => {
                        this.navigator.pop();
                      }),
                    'animation-lab',
                  ),
                )
                .catch(() => {});
            }),
            new FilledButton('implicit-animation-lab', 'Implicit animations', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new ImplicitAnimationLab(() => {
                        this.navigator.pop();
                      }),
                    'implicit-animation-lab',
                  ),
                )
                .catch(() => {});
            }),
            new FilledButton('traversal-lab', 'Traversal lab', () => {
              void this.navigator
                .push(
                  new Route(
                    () =>
                      new TraversalLab(this.widget.scheduler, () => {
                        this.navigator.pop();
                      }),
                    'traversal',
                  ),
                )
                .catch(() => {});
            }),
            new Row(
              [
                new Builder(
                  () =>
                    new Expanded(
                      new Wrap([
                        new Text(`안녕하세요! Counter ${this.count}`, {
                          fontSize: 22,
                          locale: 'ko-KR',
                          color: theme.foreground,
                        }),
                      ]),
                    ),
                ),
                new SizedBox(
                  48,
                  48,
                  new ClipRRect(
                    new Flow(
                      [
                        Image.asset('sample-image', {
                          width: 48,
                          height: 48,
                          fit: 'cover',
                          semanticLabel: 'Nelyx sample image',
                          errorBuilder: () =>
                            new Text('Image unavailable', { color: theme.foreground }),
                        }),
                        new CustomPaint(undefined, {
                          painter: new PaintMarkPainter(this.animation),
                        }),
                      ],
                      new PaintMarkFlowDelegate(this.animation),
                    ),
                    {
                      borderRadius: BorderRadiusDirectional.only({
                        topStart: Radius.elliptical(10, 4),
                        topEnd: Radius.elliptical(4, 12),
                        bottomStart: Radius.elliptical(3, 8),
                        bottomEnd: Radius.elliptical(8, 3),
                      }),
                      clipBehavior: 'antiAliasWithSaveLayer',
                    },
                  ),
                ),
              ],
              { spacing: 12, crossAlign: 'center' },
            ),
            new Transform(
              new Center(
                new SizedBox(
                  240,
                  54,
                  new ClipOval(
                    new FilledButton('increment', `카운터 증가 · ${this.count}`, () => {
                      this.setState(() => this.count++);
                      void this.animation.animateTo(this.count % 2, 250, easeInOut).catch(() => {});
                    }),
                    { clipper: new CounterOvalClipper(this.animation) },
                  ),
                ),
              ),
              counterTransform.storage,
              null,
              { alignment: AlignmentDirectional.topStart },
            ),
            new ClipRect(
              new CustomSingleChildLayout(
                new DecoratedBox(new SizedBox(), theme.accent, 3),
                new ProgressLayout(this.animation),
              ),
            ),
            new Directionality(
              this.decorationRtl ? 'rtl' : 'ltr',
              new DecoratedBox(
                new Padding(
                  allInsets(14),
                  new Column(
                    [
                      new Text(
                        `Image · gradient · shadow · ${this.decorationRtl ? 'RTL' : 'LTR'} border`,
                        { color: 0xffffffff, fontSize: 18 },
                      ),
                      new FilledButton('decoration-direction', 'Switch decoration direction', () =>
                        this.setState(() => {
                          this.decorationRtl = !this.decorationRtl;
                        }),
                      ),
                    ],
                    { spacing: 8, crossAlign: 'stretch' },
                  ),
                ),
                {
                  decoration: new BoxDecoration({
                    image: new DecorationImage({
                      image: new AssetImage('sample-image'),
                      fit: 'cover',
                      opacity: 0.16,
                      matchTextDirection: true,
                    }),
                    gradient: new LinearGradient({
                      begin: AlignmentDirectional.centerStart,
                      end: AlignmentDirectional.centerEnd,
                      colors: [0xff245875, 0xff673b80],
                      transform: new GradientRotation(0.12),
                    }),
                    borderRadius: BorderRadiusDirectional.only({
                      topStart: Radius.circular(24),
                      topEnd: Radius.circular(6),
                      bottomStart: Radius.circular(6),
                      bottomEnd: Radius.circular(24),
                    }),
                    border: new BorderDirectional({
                      top: new BorderSide({ color: 0xffe1b55c, width: 2 }),
                      bottom: new BorderSide({ color: 0xffe1b55c, width: 2 }),
                      start: new BorderSide({ color: 0xffe1b55c, width: 8 }),
                      end: new BorderSide({ color: 0xffe1b55c, width: 2 }),
                    }),
                    boxShadow: [
                      new BoxShadow({
                        color: 0x70000000,
                        offset: new Offset(0, 4),
                        blurRadius: 6,
                        spreadRadius: 1,
                      }),
                    ],
                  }),
                },
              ),
            ),
            new EditableText('editor', this.editor, 'Nelyx editor', undefined, 48, null, {
              action: 'next',
              onSubmitted: () => this.secondFocus.requestFocus(),
            }),
            new CustomMultiChildLayout(
              [
                new LayoutId(
                  new Column([
                    this.secondOnRight
                      ? new SizedBox(undefined, 48)
                      : new EditableText(
                          'second-editor',
                          this.second,
                          'Second editor',
                          this.secondFocus,
                          48,
                          this.secondEditorKey,
                        ),
                  ]),
                  'left',
                ),
                new LayoutId(
                  new Column([
                    this.secondOnRight
                      ? new EditableText(
                          'second-editor',
                          this.second,
                          'Second editor',
                          this.secondFocus,
                          48,
                          this.secondEditorKey,
                        )
                      : new SizedBox(undefined, 48),
                  ]),
                  'right',
                ),
              ],
              new EditorSlotsLayout(),
            ),
            new FilledButton(
              'move-editor',
              this.secondOnRight ? 'Move editor left' : 'Move editor right',
              () =>
                this.setState(() => {
                  this.secondOnRight = !this.secondOnRight;
                }),
            ),
            new Wrap(
              [
                new FilledButton('clipboard-copy', 'Copy', () => {
                  void this.clipboard(true);
                }),
                new FilledButton('clipboard-paste', 'Paste', () => {
                  void this.clipboard(false);
                }),
                ...(this.widget.services.platformServices?.environment?.capabilities.navigation ===
                'available'
                  ? [
                      new FilledButton('system-back', 'System back', () => {
                        void this.systemBack();
                      }),
                    ]
                  : []),
              ],
              { spacing: 12, runSpacing: 12 },
            ),
            new Text(
              [
                this.widget.services.platformServices?.environment?.locales?.join(', '),
                this.widget.services.platformServices?.environment?.brightness,
                this.widget.services.platformServices?.lifecycleState,
                this.serviceStatus,
              ]
                .filter(Boolean)
                .join(' · '),
              { color: theme.foreground },
            ),
            new ListBody([
              new Wrap(
                [
                  new FilledButton('theme', messages.text('theme'), () =>
                    this.setState(() => {
                      this.light = !this.light;
                    }),
                  ),
                  new FilledButton('locale', messages.text('locale'), () =>
                    this.setState(() => {
                      this.locale = this.locale === 'ko' ? 'en' : 'ko';
                    }),
                  ),
                ],
                { spacing: 12, runSpacing: 12 },
              ),
              new SizedBox(undefined, 12),
              new Text(messages.text('list'), { color: theme.foreground }),
            ]),
            new LazyList({
              itemCount: 1000,
              itemExtent: 64,
              height,
              controller: this.scroll,
              scheduler: this.widget.scheduler,
              cacheExtent: 128,
              keepAliveCount: 2,
              itemBuilder: (index) =>
                new ListTile('item-' + index, `Item ${index + 1}`, () => {
                  void this.navigator
                    .push(new Route(() => this.detail(index), 'detail'))
                    .catch(() => {});
                }),
            }),
          ],
          { spacing: 12, crossAlign: 'stretch' },
        ),
        this.pageScroll,
        this.widget.scheduler,
      ),
    );
  }
  private detail(index: number): Widget {
    return new Detail(index, this.second.text, this.navigator);
  }
}
class CounterOvalClipper extends CustomClipper<Rect> {
  constructor(readonly animation: AnimationController) {
    super({ reclip: animation });
  }
  getClip(size: Size): Rect {
    const inset = Math.min(2 * this.animation.value, size.width / 2, size.height / 2);
    return { x: inset, y: inset, width: size.width - 2 * inset, height: size.height - 2 * inset };
  }
  override getApproximateClipRect(size: Size): Rect {
    return this.getClip(size);
  }
  shouldReclip(old: CounterOvalClipper): boolean {
    return old.animation !== this.animation;
  }
}
class ProgressLayout extends SingleChildLayoutDelegate {
  constructor(readonly animation: AnimationController) {
    super({ relayout: animation });
  }
  override getSize(constraints: BoxConstraints): Size {
    return new SizeValue(constraints.maxWidth, 6);
  }
  override getConstraintsForChild(): BoxConstraints {
    return BoxConstraints.tightFor(40 + this.animation.value * 120, 6);
  }
  shouldRelayout(old: ProgressLayout): boolean {
    return old.animation !== this.animation;
  }
}
class EditorSlotsLayout extends MultiChildLayoutDelegate {
  override getSize(constraints: BoxConstraints): Size {
    return new SizeValue(constraints.maxWidth, 48);
  }
  performLayout(size: Size): void {
    const width = Math.max(0, (size.width - 12) / 2);
    this.layoutChild('left', BoxConstraints.tight(new SizeValue(width, size.height)));
    this.positionChild('left', Offset.zero);
    this.layoutChild('right', BoxConstraints.tight(new SizeValue(width, size.height)));
    this.positionChild('right', new Offset(width + 12, 0));
  }
  shouldRelayout(): boolean {
    return false;
  }
}
class Detail extends StatefulWidget {
  constructor(
    readonly index: number,
    readonly text: string,
    readonly navigator: NavigatorController,
  ) {
    super();
  }
  createState(): State {
    return new DetailState();
  }
}
class DetailState extends State<Detail> {
  private editor!: TextEditingController;
  override initState(): void {
    this.editor = new TextEditingController(this.widget.text);
  }
  override dispose(): void {
    this.editor.dispose();
  }
  build(): Widget {
    return new CupertinoTheme(
      new CupertinoPageScaffold(
        `Item ${this.widget.index + 1}`,
        new Padding(
          allInsets(24),
          new Column(
            [
              new Table(
                [
                  new TableRow(
                    [
                      new Text('Item'),
                      new TableCell(new Text(`Item ${this.widget.index + 1}`), {
                        verticalAlignment: 'middle',
                      }),
                    ],
                    { key: new ValueKey('item') },
                  ),
                  new TableRow([new Text('Initial text'), new Text(this.widget.text)], {
                    key: new ValueKey('text'),
                  }),
                ],
                {
                  columnWidths: new Map([[0, new FixedColumnWidth(96)]]),
                  defaultVerticalAlignment: 'middle',
                },
              ),
              new CupertinoTextField('detail-editor', this.editor, 'Detail editor'),
              new CupertinoButton('open-dialog', 'Open dialog', () => {
                void showDialog(
                  this.widget.navigator,
                  () =>
                    new AlertDialog('sample-dialog', 'Nelyx', new Text(this.editor.text), () => {
                      this.widget.navigator.pop('closed');
                    }),
                ).catch(() => {});
              }),
            ],
            { spacing: 20, crossAlign: 'stretch' },
          ),
        ),
        () => {
          this.widget.navigator.pop();
        },
      ),
    );
  }
}

class PaintMarkFlowDelegate extends FlowDelegate {
  constructor(readonly animation: AnimationController) {
    super({ repaint: animation });
  }
  paintChildren(context: FlowPaintingContext): void {
    context.paintChild(0);
    const value = this.animation.value,
      transform = Matrix4.translationValues(2 * value, 0, 0);
    transform.setEntry(3, 0, 0.001 * value);
    context.paintChild(1, { transform: transform.storage, opacity: 0.8 });
  }
  shouldRepaint(old: PaintMarkFlowDelegate): boolean {
    return old.animation !== this.animation;
  }
}
class PaintMarkPainter extends CustomPainter {
  constructor(readonly animation: AnimationController) {
    super({ repaint: animation });
  }
  paint(canvas: Canvas, size: Size): void {
    const value = this.animation.value,
      cosine = Math.cos((value * Math.PI) / 3),
      sine = Math.sin((value * Math.PI) / 3),
      clip = new Path();
    clip.addPolygon(
      [
        { x: 0, y: 6 },
        { x: 6, y: 0 },
        { x: size.width - 6, y: 0 },
        { x: size.width, y: 6 },
        { x: size.width, y: size.height - 6 },
        { x: size.width - 6, y: size.height },
        { x: 6, y: size.height },
        { x: 0, y: size.height - 6 },
      ],
      true,
    );
    canvas.clipPath(clip);
    canvas.drawRRect(
      RRect.fromRectAndCorners(
        { x: 2, y: 2, width: size.width - 4, height: size.height - 4 },
        {
          topLeft: Radius.elliptical(10, 4),
          topRight: Radius.elliptical(4, 10),
          bottomRight: Radius.elliptical(10, 4),
          bottomLeft: Radius.elliptical(4, 10),
        },
      ),
      new Paint({ color: 0xffffffff, style: 'stroke', strokeWidth: 3 }),
    );
    const badge = new Path();
    badge.addRRect(
      RRect.fromRectAndCorners(
        { x: 31, y: 34, width: 12, height: 10 },
        {
          topLeft: Radius.elliptical(1, 4),
          topRight: Radius.elliptical(4, 2),
          bottomRight: Radius.elliptical(2, 4),
          bottomLeft: Radius.elliptical(4, 2),
        },
      ),
    );
    canvas.drawPath(badge, new Paint({ color: 0xff163554, style: 'stroke', strokeWidth: 1.5 }));
    canvas.save();
    canvas.translate(24, 22);
    canvas.transform(
      new Float64Array([1, 0, 0, 0, 0, cosine, sine, 0, 0, -sine, cosine, 0, 0, 0, 0, 1]),
    );
    canvas.transform(new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 6, 1]));
    const outline = new Path();
    outline.moveTo(-12, 0);
    outline.cubicTo(-12, -16, 12, -16, 12, 0);
    outline.conicTo(0, 16, -12, 0, 0.8);
    outline.close();
    canvas.drawPath(outline, new Paint({ color: 0xff163554, style: 'stroke', strokeWidth: 4 }));
    canvas.restore();
    canvas.drawLine(
      { x: 19 + 8 * value, y: 30 - 8 * value },
      { x: 30 + 6 * value, y: 40 - 24 * value },
      new Paint({ color: 0xff163554, strokeWidth: 5, strokeCap: 'round' }),
    );
  }
  shouldRepaint(old: PaintMarkPainter): boolean {
    return old.animation !== this.animation;
  }
  override get semanticsBuilder() {
    return (size: Size) => [
      new CustomPainterSemantics({
        key: new ValueKey('paint-mark'),
        rect: { x: 0, y: 0, ...size },
        properties: { role: 'image', name: 'Nelyx painted mark', enabled: true },
      }),
    ];
  }
}
