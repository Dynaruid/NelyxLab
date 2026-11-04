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
  Button,
  EditableText,
  EditingController,
  GlobalKey,
  ValueKey,
  StatefulWidget,
  State,
  protocol as p,
} from '@nelyx/core/v2';
import type { Widget, NodeOptions } from '@nelyx/core/v2';

/** App declares Widgets; C++ owns layout, editing state and published geometry. */
export function engineV2Scene(bytes: Uint8Array) {
  const header = new GlobalKey(),
    content = new GlobalKey(),
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
          new Clip(new Image(image, props(-28, -16, 338, 212)), props(590, 366, 282, 142)),
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
              new EditableText(editor, {
                ...props(10, 8, 258, 40),
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
          new Button('Update title', () => this.increment(), { ...props(590, 650, 278, 44) }),
        ],
        { ...props(0, 0, 960, 720), color: 0xfff4f6fa },
      );
    }
  }
  return { root: new Testbed(counter), header, editor, counter, content };
}
