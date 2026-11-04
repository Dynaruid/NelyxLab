// SPDX-License-Identifier: BSD-3-Clause
import { commands as c } from '@nelyx/core/v2';
import type { NodeHandle } from '@nelyx/core/v2';

/** The first engine-v2 Testbed scene uses explicit fixed-layout declarations.
 * Widget/Element and general layout migration remain a separate stage. */
export function engineV2Scene(image: Uint8Array) {
  const changes: Uint8Array[] = [];
  let next = 0;
  const childCounts = new Map<number, number>();
  const node = (
    kind: Parameters<typeof c.create>[1],
    parent: NodeHandle | null,
    x: number,
    y: number,
    width: number,
    height: number,
    color = 0,
    radius = 0,
  ) => {
    const handle = { slot: ++next, generation: 1 };
    changes.push(
      c.create(handle, kind),
      c.properties(handle, { x, y, width, height }),
      c.paint(handle, color, radius),
    );
    if (parent) {
      const index = childCounts.get(parent.slot) ?? 0;
      childCounts.set(parent.slot, index + 1);
      changes.push(c.attach(handle, parent, index));
    }
    return handle;
  };
  const text = (
    parent: NodeHandle,
    x: number,
    y: number,
    width: number,
    height: number,
    value: string,
    size = 18,
    color = 0xff172033,
  ) => {
    const handle = node('paragraph', parent, x, y, width, height);
    changes.push(c.text(handle, value, size, color));
    return handle;
  };
  const root = node('stack', null, 0, 0, 960, 720, 0xfff4f6fa);
  node('box', root, 24, 20, 864, 88, 0xff10203b, 20);
  const header = text(root, 46, 28, 810, 45, 'Nelyx Engine v2', 30, 0xffffffff);
  text(root, 48, 72, 810, 28, 'C++ scene · Native / CanvasKit · 독립 스크롤', 15, 0xffadc5e8);
  const scroll = node('scrollViewport', root, 24, 132, 538, 480);
  changes.push(c.properties(scroll, { x: 24, y: 132, width: 538, height: 480, maximum: 1120 }));
  const content = node('stack', scroll, 0, 0, 538, 1600);
  for (let i = 0; i < 12; ++i) {
    const row = node('stack', content, 0, i * 126, 522, 112, 0xffffffff, 16);
    node('box', row, 16, 18, 44, 44, [0xff286ee9, 0xff16a394, 0xff8a56c9, 0xffdd883b][i % 4]!, 12);
    text(row, 78, 10, 420, 38, `Retained scene ${String(i + 1).padStart(2, '0')}`, 21);
    text(row, 78, 51, 420, 45, '한국어 텍스트와 네이티브 입력', 16, 0xff596a83);
  }
  text(root, 590, 137, 284, 38, 'Owner separation', 23);
  text(
    root,
    590,
    184,
    284,
    84,
    'App는 선언을 보냅니다.\nContent는 기록을 준비합니다.\nRender는 계속 움직입니다.',
    16,
    0xff586981,
  );
  const pulse = node('box', root, 592, 286, 278, 54, 0xff286ee9, 14);
  changes.push(c.motion(pulse, 1n, 0n, 0.25, 1.5));
  text(root, 610, 293, 240, 35, 'Native opacity motion', 17, 0xffffffff);
  const clip = node('clip', root, 590, 366, 282, 180);
  const picture = node('image', clip, -28, -16, 338, 212);
  changes.push(
    c.acquireResource({ slot: 1, generation: 1 }, image),
    c.bindResource(picture, { slot: 1, generation: 1 }),
  );
  text(root, 590, 559, 284, 67, 'Clip · Image · Paragraph\nWheel / pointer drag', 16, 0xff596a83);
  return { commands: changes, header };
}
