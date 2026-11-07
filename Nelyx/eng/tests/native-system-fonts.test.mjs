// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemFontsNotifier } from '@nelyx/core/framework/painting/binding';
import { FrameScheduler } from '@nelyx/core/framework/scheduler/scheduler';
import { BoxConstraints } from '@nelyx/core/framework/rendering/constraints';
import {
  RenderBox,
  RelayoutWhenSystemFontsChangeMixin,
  claimNativeRenderObject,
  bindNativeSystemFonts,
} from '@nelyx/core/framework/rendering/object';
const timeout = 1_200_000;
class FontBox extends RelayoutWhenSystemFontsChangeMixin(RenderBox) {
  notices = 0;
  systemFontsDidChange() {
    super.systemFontsDidChange();
    ++this.notices;
  }
}
function scope() {
  const notifier = createSystemFontsNotifier(),
    scheduler = new FrameScheduler({ now: () => 0 }, () => {});
  return { notifier, scheduler, context: { systemFonts: notifier.systemFonts, scheduler } };
}
function frame(scheduler) {
  scheduler.beginFrame(16);
  scheduler.endFrame();
}
test(
  'Native-owned Source fonts coalesce on the canonical frame path, retain layout guards and reject a foreign owner',
  { timeout },
  () => {
    const a = scope(),
      box = new FontBox(),
      owner = {};
    let invalidated = 0,
      live = true;
    try {
      claimNativeRenderObject(box, owner, () => ++invalidated);
      const isLive = () => live;
      bindNativeSystemFonts(box, owner, a.context, isLive);
      bindNativeSystemFonts(box, owner, a.context, isLive);
      assert.equal(box.attached, false);
      assert.throws(
        () => bindNativeSystemFonts(box, {}, a.context, isLive),
        /live configuration owner/,
      );
      a.notifier.notify();
      a.notifier.notify();
      assert.equal(box.notices, 0);
      frame(a.scheduler);
      assert.equal(box.notices, 1);
      assert.ok(invalidated > 0);
      assert.throws(
        () => box.layout(new BoxConstraints(0, 10, 0, 10)),
        /TS renderer fallback|Synchronous layout/,
      );
      a.notifier.notify();
      live = false;
      frame(a.scheduler);
      assert.equal(box.notices, 1);
    } finally {
      box.dispose();
      a.scheduler.dispose();
      a.notifier.dispose();
    }
  },
);
test(
  'Native font scope replacement and disposal cancel old callbacks and release Source listeners',
  { timeout },
  () => {
    const a = scope(),
      b = scope(),
      box = new FontBox(),
      owner = {},
      isLive = () => true;
    try {
      claimNativeRenderObject(box, owner);
      bindNativeSystemFonts(box, owner, a.context, isLive);
      a.notifier.notify();
      bindNativeSystemFonts(box, owner, b.context, isLive);
      frame(a.scheduler);
      assert.equal(box.notices, 0);
      b.notifier.notify();
      frame(b.scheduler);
      assert.equal(box.notices, 1);
      b.notifier.notify();
      box.dispose();
      frame(b.scheduler);
      assert.equal(box.notices, 1);
      assert.throws(
        () => bindNativeSystemFonts(box, owner, b.context, isLive),
        /live configuration owner/,
      );
      a.notifier.notify();
      b.notifier.notify();
      assert.equal(box.notices, 1);
    } finally {
      box.dispose();
      a.scheduler.dispose();
      b.scheduler.dispose();
      a.notifier.dispose();
      b.notifier.dispose();
    }
  },
);
