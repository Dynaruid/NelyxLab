// SPDX-License-Identifier: BSD-3-Clause
import {
  Stack,
  Box,
  Column,
  ScrollView,
  Clip,
  Image,
  ImageResource,
  Text,
  ListView,
  ListViewState,
  EditingController,
  GlobalKey,
  ValueKey,
  StatefulWidget,
  State,
  protocol as p,
} from '@nelyx/core/v2';
import type { Widget, NodeOptions, RawInputSample } from '@nelyx/core/v2';
import { FilledButton, Checkbox, Slider, MaterialApp } from '@nelyx/material/v2';
import {
  CupertinoSwitch,
  CupertinoTextField,
  CupertinoTheme,
  CupertinoThemeData,
} from '@nelyx/cupertino/v2';

/** App declares Widgets; C++ owns layout, editing state and published geometry. */
export function engineV2Scene(bytes: Uint8Array, firstInput?: (sample: RawInputSample) => void) {
  const header = new GlobalKey(),
    content = new GlobalKey(),
    lazy = new GlobalKey<ListViewState>(),
    editor = new EditingController('한국어 A😀'),
    counter = new GlobalKey<TestbedState>(),
    image = new ImageResource(bytes);
  const props = (x: number, y: number, width: number, height: number): NodeOptions => ({
    properties: { x, y, width, height },
  });
  const text = (
    x: number,
    y: number,
    width: number,
    height: number,
    value: string,
    size = 18,
    color = 0xff172033,
    direction: 'ltr' | 'rtl' = 'ltr',
  ) =>
    new Text(value, { ...props(x, y, width, height), fontSize: size, textColor: color, direction });
  class Testbed extends StatefulWidget {
    createState() {
      return new TestbedState();
    }
  }
  class TestbedState extends State {
    updates = 0;
    readonly controls = { material: 0, cupertino: 0, slider: 0, gestures: 0, raw: 0 };
    increment() {
      this.setState(() => ++this.updates);
    }
    build(): Widget {
      return new Stack(
        [
          new Box([], { ...props(24, 20, 864, 88), color: 0xff10203b, radius: 20 }),
          new Text(`Nelyx Engine v2${this.updates ? ` · ${this.updates}` : ''}`, {
            key: header,
            ...props(46, 28, 810, 45),
            fontSize: 30,
            textColor: 0xffffffff,
          }),
          text(48, 72, 810, 28, 'C++ scene · Native / CanvasKit · 독립 스크롤', 15, 0xffadc5e8),
          new ScrollView(
            new Column(
              Array.from(
                { length: 12 },
                (_, i) =>
                  new Stack(
                    [
                      new Box([], {
                        ...props(16, 18, 44, 44),
                        color: [0xff286ee9, 0xff16a394, 0xff8a56c9, 0xffdd883b][i % 4]!,
                        radius: 12,
                      }),
                      text(78, 10, 420, 38, `Retained scene ${String(i + 1).padStart(2, '0')}`, 21),
                      text(78, 51, 420, 45, '한국어 텍스트와 네이티브 입력', 16, 0xff596a83),
                    ],
                    {
                      key: new ValueKey(i),
                      ...props(0, 0, 522, 112),
                      color: 0xffffffff,
                      radius: 16,
                    },
                  ),
              ),
              { key: content, properties: { width: 538 }, layout: { gap: 14 } },
            ),
            props(24, 132, 538, 480),
          ),
          text(590, 137, 284, 38, 'Owner separation', 23),
          text(
            590,
            184,
            284,
            84,
            'App는 선언을 보냅니다.\nContent는 기록을 준비합니다.\nRender는 계속 움직입니다.',
            16,
            0xff586981,
          ),
          new Box([], {
            ...props(592, 286, 278, 54),
            color: 0xff286ee9,
            radius: 14,
            motion: { id: 1n, opacity: 0.25, seconds: 1.5 },
          }),
          text(610, 293, 240, 35, 'Native opacity motion', 17, 0xffffffff),
          new ListView(
            {
              generation: 1n,
              itemCount: 2000,
              estimatedExtent: 48,
              cacheItems: 24,
              itemKey: (i) => `testbed-row-${i}`,
              itemBuilder: (i) =>
                new Stack(
                  [
                    ...(i === 0
                      ? [new Clip(new Image(image, props(-4, -2, 52, 52)), props(0, 0, 44, 44))]
                      : []),
                    text(54, 4, 210, 38, `Lazy row ${i + 1}`, 16),
                  ],
                  {
                    properties: { width: 282, height: 44 + (i % 3) * 4 },
                    color: i % 2 ? 0xffe8eef7 : 0xffffffff,
                  },
                ),
            },
            { key: lazy, ...props(590, 366, 282, 142) },
          ),
          new Checkbox(false, () => ++this.controls.material, {
            ...props(590, 280, 28, 28),
            semantics: {
              role: 'checkbox',
              label: 'Material selection',
              flags: p.semanticsFlags.focusable,
              actions: p.semanticsActions.focus | p.semanticsActions.activate,
            },
          }),
          new CupertinoSwitch(false, () => ++this.controls.cupertino, {
            ...props(630, 280, 51, 31),
            semantics: {
              role: 'checkbox',
              label: 'Cupertino selection',
              flags: p.semanticsFlags.focusable,
              actions: p.semanticsActions.focus | p.semanticsActions.activate,
            },
          }),
          new Slider(0.25, () => ++this.controls.slider, { ...props(694, 280, 172, 32) }),
          text(
            590,
            519,
            284,
            54,
            'עברית · العربية · 😀\nWidget / editing / semantics',
            16,
            0xff596a83,
            'rtl',
          ),
          new Box(
            [
              new CupertinoTextField(editor, {
                ...props(10, 8, 258, 40),
                layout: { padding: { left: 8, right: 8, top: 4, bottom: 4 } },
                flags: p.editFlags.multiline,
                semantics: {
                  role: 'textField',
                  label: '입력',
                  hint: '한글과 emoji 입력',
                  flags: p.semanticsFlags.focusable,
                  actions:
                    p.semanticsActions.focus |
                    p.semanticsActions.setValue |
                    p.semanticsActions.setSelection,
                },
              }),
            ],
            { ...props(590, 580, 278, 56), color: 0xffffffff, radius: 8 },
          ),
          new FilledButton('Update title', () => this.increment(), { ...props(590, 650, 278, 44) }),
        ],
        {
          ...props(0, 0, 960, 720),
          color: 0xfff4f6fa,
          gestures: p.gestures.longPress | p.gestures.pinch | p.gestures.panX | p.gestures.panY,
          onGesture: () => ++this.controls.gestures,
          onRawInput: (sample) => {
            if (++this.controls.raw === 1) firstInput?.(sample);
          },
        },
      );
    }
  }
  return {
    root: new MaterialApp(new CupertinoTheme(new CupertinoThemeData(), new Testbed(counter))),
    header,
    editor,
    counter,
    content,
    lazy,
  };
}
