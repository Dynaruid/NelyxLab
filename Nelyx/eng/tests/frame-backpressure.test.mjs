// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import { AppSession } from '@nelyx/core/hosting/runtime';
import { GraphiteRenderer } from '@nelyx/skia-native/renderer';
import { ResourceLease } from '@nelyx/core/hosting/resources';
import { freezeFrame } from '@nelyx/core/ui/frame';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { Semantics } from '@nelyx/core/framework/widgets/semantics';
import { SizedBox } from '@nelyx/core/framework/widgets/basic';
const timeout = 1_200_000;
const metrics = {
  logicalWidth: 100,
  logicalHeight: 100,
  physicalWidth: 100,
  physicalHeight: 100,
  scale: 1,
  viewportGeneration: 1,
  rendererGeneration: 1,
  nativeContextGeneration: 1,
  nativeSurfaceGeneration: 1,
};
function fixture({ scene, observeInput } = {}) {
  const callbacks = new Map(),
    notifications = [],
    submissions = [],
    errors = [];
  let next = 0,
    builds = 0,
    value = 0,
    drawn,
    deny = false,
    nativeRecordings = 0,
    releaseAfterHint = false,
    failSubmission = false;
  const clock = {
    request(callback) {
      const id = ++next;
      callbacks.set(id, callback);
      return {
        dispose() {
          callbacks.delete(id);
        },
      };
    },
  };
  const tick = (timing) => {
    const batch = [...callbacks.values()];
    callbacks.clear();
    batch.forEach((callback) => callback(timing));
  };
  const context = {
    nelyxCoreVersion: () => 1,
    nelyxWireVersion: () => 11,
    nelyxConfigure() {},
    nelyxIdentity: () => 7,
    nelyxNotifications: () => notifications.splice(0),
    nelyxReserve: () => (deny || nativeRecordings >= 2 ? 1 : 0),
    beginRecording: () => ({
      clear(color) {
        drawn = color;
      },
    }),
    finishRecording: () => ({ dispose() {} }),
    nelyxSubmit(_recording, id) {
      if (failSubmission) throw Error('native-recording-failure');
      submissions.push({ id, color: drawn });
    },
    nelyxCancel() {},
    nelyxClose() {
      nativeRecordings = 0;
      for (const id of renderer.leases.keys()) notifications.push(7, id, 0);
    },
    nelyxStats: () => {
      const value = [7, 0, nativeRecordings, 0, 0];
      if (releaseAfterHint) {
        releaseAfterHint = false;
        nativeRecordings = 1;
      }
      return value;
    },
    nelyxReset() {},
    dispose() {},
  };
  const renderer = new GraphiteRenderer(
    { Color: (value) => value, Paint: () => ({ setAntiAlias() {}, dispose() {} }) },
    () => context,
    { id: 'pressure', generation: 1 },
    {
      image() {
        throw Error('Unexpected image');
      },
      paragraph() {
        throw Error('Unexpected paragraph');
      },
    },
  );
  const session = new AppSession(
    {
      id: 'pressure',
      createScene: () => (context) => {
        builds++;
        return scene ? scene(context, value) : [{ op: 'clear', color: value }];
      },
    },
    clock,
  );
  const view = session.attach({
    id: 'pressure',
    generation: 1,
    metrics,
    renderer,
    ownership: 'owned',
    onError: (error) => errors.push(error),
    observeInput,
  });
  return {
    view,
    renderer,
    session,
    callbacks,
    notifications,
    submissions,
    errors,
    tick,
    get builds() {
      return builds;
    },
    set value(next) {
      value = next;
    },
    set deny(next) {
      deny = next;
    },
    set nativeRecordings(next) {
      nativeRecordings = next;
    },
    set releaseAfterHint(next) {
      releaseAfterHint = next;
    },
    set failSubmission(next) {
      failSubmission = next;
    },
  };
}

function deadlineFixture({
  widgets = false,
  notifications = false,
  semanticsUpdateInterval = 50,
} = {}) {
  const callbacks = new Set(),
    errors = [],
    submissions = [],
    actions = [];
  let now = 0,
    builds = 0,
    services,
    root,
    listener;
  const clock = {
    now: () => now,
    request(callback) {
      callbacks.add(callback);
      return {
        dispose() {
          callbacks.delete(callback);
        },
      };
    },
  };
  const renderer = {
    capabilities: { notifications: notifications ? 'submitted-and-retired' : 'unavailable' },
    updateMetrics() {},
    observe(callback) {
      listener = callback;
      return {
        dispose() {
          listener = undefined;
        },
      };
    },
    submit(frame, lease) {
      submissions.push(frame.token);
      listener?.({ kind: 'submitted', token: frame.token, submission: submissions.length });
      lease.transfer();
      lease.returnBy('renderer');
      return { status: 'accepted' };
    },
    dispose() {},
  };
  const session = new AppSession(
    {
      id: 'deadline',
      createView(context) {
        services = context;
        const controller = widgets
          ? (root = new FrameworkRoot(context, {
              id: 'deadline',
              semanticsUpdateInterval,
              createRoot: () =>
                new Semantics({
                  transportId: 'deadline-action',
                  label: 'Action',
                  container: true,
                  onTap: () => actions.push(context.readMetrics().logicalHeight),
                  child: new SizedBox(40, 40),
                }),
            }))
          : {
              build() {
                return [{ op: 'clear', color: 0 }];
              },
              dispose() {},
            };
        const build = controller.build;
        controller.build = function (...args) {
          builds++;
          return build.apply(this, args);
        };
        return controller;
      },
    },
    clock,
  );
  const view = session.attach({
    id: 'deadline',
    generation: 1,
    metrics,
    renderer,
    ownership: 'owned',
    onError: (error) => errors.push(error),
    services: {
      clock,
      assets: new Map(),
      text: {
        createParagraph() {
          throw Error('Unexpected text');
        },
      },
      editing: { capability: 'unavailable' },
      semantics: { capability: 'unavailable' },
    },
  });
  return {
    view,
    session,
    clock,
    callbacks,
    errors,
    submissions,
    actions,
    notify: (event) => listener?.(event),
    get context() {
      return services;
    },
    get root() {
      return root;
    },
    get builds() {
      return builds;
    },
    tick(time) {
      now = time;
      const batch = [...callbacks];
      callbacks.clear();
      for (const callback of batch)
        callback({ tick: now, dispatch: now, queueDelay: 0, clockUncertainty: 0 });
    },
  };
}

test(
  'a deferred frame waits on its owner clock without building early and runs its callback in the due frame',
  { timeout },
  async () => {
    const f = deadlineFixture(),
      calls = [];
    try {
      f.view.requestFrame();
      f.tick(0);
      assert.equal(f.builds, 1);
      f.context.requestFrameAt(50, () => {
        calls.push('due');
        f.context.requestFrame();
      });
      for (const time of [6, 12, 18, 24, 30, 36, 42, 48]) {
        f.tick(time);
        assert.equal(f.builds, 1);
        assert.deepEqual(calls, []);
      }
      f.tick(50);
      assert.deepEqual(calls, ['due']);
      assert.equal(f.builds, 2, 'A due request uses this tick, without waiting for another vsync');
      assert.equal(f.submissions.length, 2);
      assert.equal(f.callbacks.size, 0);
      assert.deepEqual(f.errors, []);
    } finally {
      await f.session.dispose();
      assert.equal(f.callbacks.size, 0);
    }
  },
);

test(
  'ordinary and forced frames bypass a future wake and cancellation cannot consume a requested redraw',
  { timeout },
  async () => {
    const f = deadlineFixture(),
      calls = [];
    try {
      f.view.requestFrame();
      f.tick(0);
      const future = f.context.requestFrameAt(1000, () => calls.push('late'));
      f.context.requestFrame();
      f.tick(10);
      assert.equal(f.builds, 2);
      assert.deepEqual(calls, []);
      f.view.setVisible(false);
      f.view.requestForcedFrame();
      f.tick(20);
      assert.equal(f.builds, 3);
      assert.deepEqual(calls, []);
      f.view.setVisible(true);
      f.context.requestFrame();
      future.dispose();
      f.tick(30);
      assert.equal(f.builds, 4);
      assert.equal(f.callbacks.size, 0);
      f.context.requestFrame();
      f.tick(40);
      assert.equal(f.builds, 5, 'A stationary explicit redraw must still paint and submit');
      assert.equal(f.submissions.length, 5);
      assert.deepEqual(f.errors, []);
    } finally {
      await f.session.dispose();
    }
  },
);

test(
  'deferred callbacks cancel before reentrant close and a falsey failure stops all future clock work',
  { timeout },
  async () => {
    for (const fail of [false, true]) {
      const f = deadlineFixture(),
        calls = [];
      try {
        f.view.requestFrame();
        f.tick(0);
        f.context.requestFrameAt(10, () => {
          calls.push('first');
          f.context.requestFrameAt(30, () => calls.push('future'));
          if (fail) throw 0;
          f.view.beginClose();
        });
        f.context.requestFrameAt(10, () => calls.push('cancelled sibling'));
        f.tick(10);
        assert.deepEqual(calls, ['first']);
        assert.equal(f.builds, 1);
        assert.equal(f.callbacks.size, 0);
        assert.equal(f.view.status, fail ? 'failed' : 'closing');
        assert.deepEqual(f.errors, fail ? [0] : []);
        f.tick(100);
        assert.deepEqual(calls, ['first']);
      } finally {
        await f.session.dispose();
        assert.equal(f.callbacks.size, 0);
      }
    }
  },
);

test('invalid deferred deadlines do not acquire a frame clock callback', { timeout }, async () => {
  const f = deadlineFixture();
  try {
    for (const value of [NaN, Infinity, -Infinity])
      assert.throws(() => f.context.requestFrameAt(value, () => {}), /finite/);
    assert.equal(f.callbacks.size, 0);
    assert.equal(f.builds, 0);
  } finally {
    await f.session.dispose();
  }
});

test(
  'a failed native retirement releases deferred callbacks before the owner closes',
  { timeout },
  async () => {
    const f = deadlineFixture({ notifications: true }),
      calls = [];
    try {
      f.view.requestFrame();
      f.tick(0);
      f.context.requestFrameAt(1000, () => calls.push('late'));
      f.notify({
        kind: 'failed',
        token: f.submissions[0],
        submission: 1,
        reason: 'native-failure',
      });
      assert.equal(f.view.status, 'failed');
      assert.equal(
        f.view.deferredFrames.size,
        0,
        'A failed owner must not retain callbacks until disposal',
      );
      f.tick(1000);
      assert.deepEqual(calls, []);
      assert.equal(f.callbacks.size, 0);
      assert.equal(f.builds, 1);
    } finally {
      await f.session.dispose();
    }
  },
);

test(
  'a hidden owner keeps due work dormant until visible even when it receives a forced frame',
  { timeout },
  async () => {
    const f = deadlineFixture(),
      calls = [];
    try {
      f.context.requestFrameAt(10, () => {
        calls.push('hide');
        f.view.setVisible(false);
      });
      f.context.requestFrameAt(10, () => calls.push('visible again'));
      f.tick(10);
      assert.deepEqual(calls, ['hide']);
      assert.equal(f.builds, 0);
      assert.equal(f.callbacks.size, 0);
      f.view.requestForcedFrame();
      f.tick(20);
      assert.equal(f.builds, 1);
      assert.deepEqual(calls, ['hide']);
      f.view.setVisible(true);
      f.tick(30);
      assert.deepEqual(calls, ['hide', 'visible again']);
      assert.equal(f.builds, 2);
      assert.equal(f.callbacks.size, 0);
    } finally {
      await f.session.dispose();
    }
  },
);

test(
  'cancelling a deferred wake cannot consume a sibling View request on the same clock',
  { timeout },
  async () => {
    const callbacks = new Set(),
      contexts = new Map(),
      builds = [],
      calls = [];
    const clock = {
      now: () => 10,
      request(callback) {
        callbacks.add(callback);
        return {
          dispose() {
            callbacks.delete(callback);
          },
        };
      },
    };
    const session = new AppSession(
      {
        id: 'siblings',
        createView(context) {
          contexts.set(context.owner.id, context);
          return {
            build() {
              builds.push(context.owner.id);
              return [{ op: 'clear', color: 0 }];
            },
            dispose() {},
          };
        },
      },
      clock,
    );
    const attach = (id) =>
      session.attach({
        id,
        generation: 1,
        metrics,
        ownership: 'owned',
        renderer: {
          capabilities: { notifications: 'unavailable' },
          updateMetrics() {},
          submit(_frame, lease) {
            lease.transfer();
            lease.returnBy('renderer');
            return { status: 'accepted' };
          },
          dispose() {},
        },
        services: {
          clock,
          assets: new Map(),
          text: {
            createParagraph() {
              throw Error('Unexpected text');
            },
          },
          editing: { capability: 'unavailable' },
          semantics: { capability: 'unavailable' },
        },
      });
    try {
      attach('first');
      const sibling = attach('second');
      const cancelled = contexts.get('first').requestFrameAt(10, () => calls.push('cancelled'));
      contexts.get('second').requestFrameAt(10, () => calls.push('due'));
      sibling.requestFrame();
      cancelled.dispose();
      assert.equal(callbacks.size, 1);
      const batch = [...callbacks];
      callbacks.clear();
      for (const callback of batch)
        callback({ tick: 10, dispatch: 10, queueDelay: 0, clockUncertainty: 0 });
      assert.deepEqual(calls, ['due']);
      assert.deepEqual(builds, ['second']);
      assert.equal(callbacks.size, 0);
    } finally {
      await session.dispose();
      assert.equal(callbacks.size, 0);
    }
  },
);

test(
  'size-only semantics requests one deadline frame while resize, time dilation and actions keep their existing fences',
  { timeout },
  async () => {
    const f = deadlineFixture({ widgets: true });
    let captures = 0;
    const resize = (height, time) => {
      f.view.updateMetrics({
        ...f.view.currentMetrics,
        logicalHeight: height,
        physicalHeight: height,
        viewportGeneration: f.view.currentMetrics.viewportGeneration + 1,
      });
      f.tick(time);
    };
    try {
      f.view.requestFrame();
      f.tick(0);
      const capture = f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);
      f.root.sourceSemanticsSnapshot.capture = (...args) => {
        captures++;
        return capture(...args);
      };
      f.root.scheduler.timeDilation = 10;
      resize(120, 1);
      const before = f.builds;
      assert.notEqual(f.root.semanticsWake, undefined);
      for (const time of [7, 13, 19, 25, 31, 37, 43, 49]) {
        f.tick(time);
        assert.equal(
          f.builds,
          before,
          'Deadline polling must not repaint Root before semantics is due',
        );
        assert.equal(captures, 0);
      }
      f.tick(51);
      assert.equal(f.builds, before + 1);
      assert.equal(captures, 1);
      assert.equal(f.root.nodes.find((node) => node.id === 'deadline-action').bounds.height, 120);
      assert.equal(f.callbacks.size, 0);
      resize(140, 60);
      const older = f.root.nodes.find((node) => node.id === 'deadline-action');
      resize(160, 80);
      const pending = f.builds;
      f.tick(110);
      assert.equal(f.builds, pending, 'A later resize replaces the earlier trailing deadline');
      f.tick(130);
      assert.equal(captures, 2);
      assert.equal(f.root.nodes.find((node) => node.id === 'deadline-action').bounds.height, 160);
      resize(180, 140);
      older.actions.activate();
      f.tick(141);
      assert.deepEqual(f.actions, [], 'Superseded source snapshots cannot perform an action');
      const current = f.root.nodes.find((node) => node.id === 'deadline-action');
      current.actions.activate();
      f.tick(142);
      assert.deepEqual(f.actions, [180]);
      assert.equal(f.root.semanticsWake, undefined);
      assert.deepEqual(f.errors, []);
    } finally {
      await f.session.dispose();
      assert.equal(f.callbacks.size, 0);
    }
  },
);

test(
  'disposing the widget scheduler cancels its deferred semantics wake before Root or View retirement',
  { timeout },
  async () => {
    const f = deadlineFixture({ widgets: true });
    try {
      f.view.requestFrame();
      f.tick(0);
      f.view.updateMetrics({
        ...metrics,
        logicalHeight: 120,
        physicalHeight: 120,
        viewportGeneration: 2,
      });
      f.tick(1);
      assert.notEqual(f.root.semanticsWake, undefined);
      assert.equal(f.callbacks.size, 1);
      const before = f.builds;
      f.root.scheduler.dispose();
      assert.equal(f.root.semanticsWake, undefined);
      assert.equal(f.callbacks.size, 0);
      f.tick(100);
      assert.equal(f.builds, before);
      assert.deepEqual(f.errors, []);
    } finally {
      await f.session.dispose();
    }
  },
);

test(
  'a long accessibility interval bounds continuous motion and publishes after a quiet period without early repaint',
  { timeout },
  async () => {
    const f = deadlineFixture({ widgets: true, semanticsUpdateInterval: 1000 });
    let captures = 0;
    const resize = (height, time) => {
      f.view.updateMetrics({
        ...f.view.currentMetrics,
        logicalHeight: height,
        physicalHeight: height,
        viewportGeneration: f.view.currentMetrics.viewportGeneration + 1,
      });
      f.tick(time);
    };
    try {
      f.view.requestFrame();
      f.tick(0);
      const capture = f.root.sourceSemanticsSnapshot.capture.bind(f.root.sourceSemanticsSnapshot);
      f.root.sourceSemanticsSnapshot.capture = (...args) => {
        captures++;
        return capture(...args);
      };
      for (let i = 0; i < 20; i++) {
        resize(120 + i, 10 + i * 50);
        assert.equal(captures, 0);
      }
      f.tick(1000);
      assert.equal(captures, 1, 'Continuous motion cannot postpone publication beyond one second');
      assert.equal(f.root.nodes.find((node) => node.id === 'deadline-action').bounds.height, 139);
      resize(200, 1010);
      const before = f.builds;
      f.tick(1050);
      f.tick(1109);
      assert.equal(f.builds, before, 'A pending quiet deadline does not repaint while polling');
      f.tick(1110);
      assert.equal(captures, 2);
      assert.equal(f.root.nodes.find((node) => node.id === 'deadline-action').bounds.height, 200);
      assert.equal(f.root.semanticsWake, undefined);
      assert.equal(f.callbacks.size, 0);
      assert.deepEqual(f.errors, []);
    } finally {
      await f.session.dispose();
      assert.equal(f.callbacks.size, 0);
    }
  },
);

test(
  'native retirement reentry observes the same renderer close before GPU leases and event identities retire',
  { timeout },
  async () => {
    const f = fixture();
    let reentered,
      retired = 0;
    try {
      const lease = new ResourceLease([], () => {
        retired++;
        reentered = f.renderer.dispose();
        void reentered.catch(() => {});
      });
      const frame = freezeFrame(f.view.capture(), [{ op: 'clear', color: 0 }]);
      assert.equal(f.renderer.submit(frame, lease).status, 'accepted');
      const closing = f.renderer.dispose();
      await closing;
      assert.equal(reentered, closing);
      await reentered;
      assert.equal(retired, 1);
      assert.equal(lease.released, true);
      assert.equal(f.renderer.hasPendingSubmissions, false);
    } finally {
      await f.session.dispose();
    }
  },
);

test(
  'close during native submission or its accepted notification waits for lease transfer and never calls a retired controller',
  { timeout },
  async () => {
    for (const boundary of ['native', 'accepted', 'busy']) {
      const f = fixture(),
        calls = [];
      let closing;
      f.view.controller = {
        frameSubmitted() {
          calls.push('submitted-after-close');
        },
        dispose() {
          calls.push('controller-close');
        },
      };
      const close = () => {
        if (!closing) {
          calls.push('close-request');
          closing = f.view.dispose();
          void closing.catch(() => {});
        }
      };
      const context = f.renderer.context();
      let observer;
      if (boundary === 'accepted')
        observer = f.renderer.observe((event) => {
          if (event.kind === 'submitted') close();
        });
      else if (boundary === 'native') {
        const submit = context.nelyxSubmit;
        context.nelyxSubmit = function (...args) {
          close();
          return submit.apply(this, args);
        };
      } else {
        const reserve = context.nelyxReserve;
        context.nelyxReserve = function (...args) {
          close();
          f.deny = true;
          return reserve.apply(this, args);
        };
      }
      try {
        f.view.requestFrame();
        f.tick();
        assert(closing);
        await closing;
        assert.deepEqual(f.errors, []);
        assert.deepEqual(calls, ['close-request', 'controller-close']);
        assert.equal(f.renderer.leases.size, 0);
        assert.equal(f.submissions.length, boundary === 'busy' ? 0 : 1);
      } finally {
        observer?.dispose();
        await f.session.dispose();
        assert.equal(f.callbacks.size, 0);
      }
    }
  },
);

test(
  'an unknown scheduled submission reports its native failure and retains uncertain resources until drain',
  { timeout },
  async () => {
    const f = fixture();
    try {
      f.failSubmission = true;
      f.view.requestFrame();
      f.tick();
      assert.equal(f.view.status, 'failed');
      assert.equal(f.errors.length, 1);
      assert.match(String(f.errors[0]), /Renderer submission failed:.*native-recording-failure/);
      f.view.requestFrame();
      f.tick();
      assert.equal(f.errors.length, 1);
      assert.equal(f.submissions.length, 0);
    } finally {
      await f.session.dispose();
      assert.equal(f.view.status, 'closed');
      assert.equal(f.callbacks.size, 0);
    }
  },
);

test(
  'input mailbox drains updates in order before the same tick builds and treats contact, key and viewport changes as boundaries',
  { timeout },
  async () => {
    const f = fixture(),
      events = [];
    f.view.controller = {
      pointer(event) {
        events.push([event.kind, event.deltaY, event.viewportGeneration]);
        f.view.requestFrame();
      },
      key() {
        events.push(['key']);
        return true;
      },
      dispose() {},
    };
    const packet = (kind, deltaY = 0) => ({
      kind,
      pointer: 4,
      device: 'mouse',
      buttons: 0,
      x: 12,
      y: 15,
      timestamp: 100 + events.length,
      viewportGeneration: 1,
      deltaY,
    });
    try {
      f.view.queuePointer(packet('wheel', 0.25));
      f.view.queuePointer(packet('wheel', -0.125));
      assert.equal(events.length, 0);
      assert.equal(f.callbacks.size, 1);
      f.tick();
      assert.deepEqual(events, [
        ['wheel', 0.25, 1],
        ['wheel', -0.125, 1],
      ]);
      assert.equal(f.builds, 1);
      assert.equal(f.view.capture().inputSequence, 2);
      f.view.queuePointer(packet('move', 1));
      f.view.queuePointer(packet('up'));
      assert.deepEqual(
        events.slice(-2).map((event) => event[0]),
        ['move', 'up'],
      );
      f.view.queuePointer(packet('wheel', 2));
      assert(f.view.dispatchKey({ kind: 'down' }));
      assert.deepEqual(
        events.slice(-2).map((event) => event[0]),
        ['wheel', 'key'],
      );
      f.view.queuePointer(packet('wheel', 3));
      f.view.updateMetrics({ ...metrics, viewportGeneration: 2 });
      assert.deepEqual(events.at(-1), ['wheel', 3, 1]);
      const count = events.length;
      f.view.queuePointer(packet('wheel', 99));
      f.tick();
      assert.equal(
        events.length,
        count,
        'An old epoch cannot be reassigned to current input geometry',
      );
    } finally {
      await f.session.dispose();
    }
  },
);
test(
  'numeric input observations distinguish queued, handled and rejected packets without affecting delivery or handler failures',
  { timeout },
  async () => {
    const observed = [],
      handled = [],
      failure = Error('original controller failure');
    let fail = false;
    const f = fixture({
      observeInput: (event) => {
        observed.push(event);
        assert(Object.isFrozen(event));
        if (event.stage === 'queued') throw Error('observer failure');
      },
    });
    f.view.controller = {
      pointer(event) {
        if (fail) throw failure;
        handled.push(event.inputSequence);
        f.view.requestFrame();
      },
      dispose() {},
    };
    const packet = {
      kind: 'wheel',
      pointer: 1,
      device: 'trackpad',
      buttons: 0,
      x: 1,
      y: 1,
      timestamp: 10,
      viewportGeneration: 1,
      deltaY: 1,
      inputSequence: 71,
    };
    try {
      f.view.queuePointer(packet);
      assert.deepEqual(handled, []);
      assert.deepEqual(
        observed.map((event) => event.stage),
        ['queued'],
      );
      assert.equal(observed[0].pending, 1);
      assert.equal(f.callbacks.size, 1);
      f.tick();
      assert.deepEqual(handled, [71]);
      assert.deepEqual(
        observed.map((event) => event.stage),
        ['queued', 'dispatch-begin', 'dispatch-end'],
      );
      assert.equal(observed.at(-1).nativeInputSequence, 71);
      assert.equal(observed.at(-1).inputSequence, 1);
      assert.equal(observed.at(-1).reason, 0);
      assert.equal(f.builds, 1);
      assert.equal(f.callbacks.size, 0);
      f.view.queuePointer({ ...packet, viewportGeneration: 0 });
      assert.equal(observed.at(-1).stage, 'drop');
      assert.equal(observed.at(-1).reason, 3);
      assert.deepEqual(handled, [71]);
      f.view.setVisible(false);
      f.view.queuePointer(packet);
      assert.equal(observed.at(-1).reason, 2);
      f.view.setVisible(true);
      fail = true;
      assert.throws(
        () => f.view.dispatchPointer({ ...packet, kind: 'panZoomStart', inputSequence: 72 }),
        (error) => error === failure,
      );
      assert.equal(observed.at(-1).stage, 'dispatch-end');
      assert.equal(observed.at(-1).reason, 4);
    } finally {
      await f.session.dispose();
    }
  },
);

test(
  'reentrant input cannot grow the mailbox beyond its capacity or keep an owner in an endless drain',
  { timeout },
  async () => {
    for (const mode of ['overflow', 'cycle']) {
      const f = fixture(),
        packet = {
          kind: 'wheel',
          pointer: 4,
          device: 'mouse',
          buttons: 0,
          x: 12,
          y: 15,
          timestamp: 10,
          viewportGeneration: 1,
          deltaY: 0.25,
        };
      f.view.controller = {
        pointer() {
          if (mode === 'overflow') for (let i = 0; i < 257; i++) f.view.queuePointer(packet);
          else f.view.queuePointer(packet);
        },
        dispose() {},
      };
      try {
        f.view.queuePointer(packet);
        f.tick();
        assert.equal(f.errors.length, 1);
        assert.match(
          String(f.errors[0]),
          mode === 'overflow' ? /256-packet mailbox/ : /30 batches/,
        );
        assert(f.view.pointerMailbox.length <= 256);
      } finally {
        await f.session.dispose();
      }
    }
  },
);

test(
  'a retained native front recording applies backpressure after its JS lease has retired',
  { timeout },
  async () => {
    const f = fixture();
    try {
      f.view.requestFrame();
      f.tick();
      f.notifications.push(7, 1, 0);
      f.renderer.pollNotifications();
      assert.equal(f.renderer.leases.size, 0);
      f.nativeRecordings = 2;
      f.value = 42;
      f.view.requestFrame();
      f.tick();
      assert.equal(
        f.builds,
        2,
        'Prepare one CPU frame while native still owns the front and queued frame',
      );
      f.value = 99;
      f.view.requestFrame();
      f.tick();
      f.tick();
      assert.equal(
        f.builds,
        2,
        'Full native ownership must not repeatedly rebuild the prepared frame',
      );
      f.nativeRecordings = 1;
      f.tick();
      assert.equal(f.builds, 3);
      assert.deepEqual(
        f.submissions.map((frame) => frame.color),
        [0, 99],
        'The obsolete CPU frame was never submitted and must not delay new state',
      );
    } finally {
      await f.session.dispose();
    }
  },
);
test(
  'native backpressure coalesces scene work and resumes with the latest state and viewport after real retirement',
  { timeout },
  async () => {
    const f = fixture();
    try {
      for (let i = 0; i < 2; i++) {
        f.value = i;
        f.view.requestFrame();
        f.tick();
      }
      assert.equal(f.builds, 2);
      assert.equal(f.renderer.leases.size, 2);
      for (let i = 0; i < 12; i++) {
        f.value = i + 2;
        f.view.requestFrame();
        f.tick();
      }
      assert.equal(f.builds, 3, 'Full native slots keep exactly one prepared CPU scene');
      assert.equal(f.submissions.length, 2);
      assert.equal(f.callbacks.size, 1);
      f.value = 99;
      f.view.updateMetrics({
        ...metrics,
        logicalWidth: 200,
        physicalWidth: 200,
        viewportGeneration: 2,
      });
      f.notifications.push(7, 1, 0);
      f.tick();
      assert.equal(f.builds, 4);
      assert.equal(f.submissions.at(-1).color, 99);
      assert.equal(f.view.currentMetrics.viewportGeneration, 2);
      assert.equal(f.renderer.leases.size, 2);
      assert.deepEqual(f.errors, []);
    } finally {
      await f.session.dispose();
      assert.equal(f.renderer.leases.size, 0);
      assert.equal(f.callbacks.size, 0);
    }
  },
);

test(
  'a credit becoming free after a busy hint cannot submit obsolete input before the replacement tick',
  { timeout },
  async () => {
    const f = fixture();
    try {
      f.nativeRecordings = 2;
      f.value = 42;
      f.view.requestFrame();
      f.tick();
      f.value = 99;
      f.view.requestFrame();
      f.releaseAfterHint = true;
      f.tick();
      assert.equal(f.builds, 1);
      assert.deepEqual(f.submissions, []);
      assert.equal(f.callbacks.size, 1);
      f.tick();
      assert.equal(f.builds, 2);
      assert.deepEqual(
        f.submissions.map((frame) => frame.color),
        [99],
      );
    } finally {
      await f.session.dispose();
    }
  },
);

test(
  'replacing an obsolete CPU frame holds its resources through capture and retires them without native submission',
  { timeout },
  async () => {
    for (const fail of [false, true]) {
      const resource = { id: 'obsolete-cpu-paragraph', generation: 1, kind: 'paragraph' };
      let retired = 0,
        captures = 0;
      const f = fixture({
        scene(context, value) {
          if (value === 42) return [{ op: 'paragraph', resource, x: 0, y: 0 }];
          captures++;
          assert(
            context.resources.isRetained(resource),
            'Old caller lease must survive the replacement scene callback',
          );
          if (fail) throw Error('replacement-scene-failure');
          return [{ op: 'clear', color: value }];
        },
      });
      f.session.resources.register(resource, () => retired++);
      try {
        f.nativeRecordings = 2;
        f.value = 42;
        f.view.requestFrame();
        f.tick();
        f.session.resources.releaseProducer(resource);
        for (const value of [55, 66, 99]) {
          f.value = value;
          f.view.requestFrame();
          f.tick();
        }
        assert.equal(captures, 0);
        assert.equal(retired, 0);
        assert.equal(f.builds, 1);
        f.nativeRecordings = 1;
        f.tick();
        assert.equal(captures, 1);
        if (fail) {
          assert.equal(f.view.status, 'failed');
          assert.match(String(f.errors[0]), /replacement-scene-failure/);
          assert.equal(retired, 0);
          assert.deepEqual(f.submissions, []);
        } else {
          assert.deepEqual(f.errors, []);
          assert.equal(retired, 1);
          assert.deepEqual(
            f.submissions.map((frame) => frame.color),
            [99],
          );
        }
      } finally {
        await f.session.dispose();
      }
      assert.equal(retired, 1);
      assert.equal(f.renderer.leases.size, 0);
      assert.equal(f.callbacks.size, 0);
    }
  },
);
test(
  'a close reentered by capture, controller admission or old-frame retirement cannot strand a replacement lease',
  { timeout },
  async () => {
    for (const boundary of ['capture', 'admission', 'retirement', 'pump']) {
      const next = { id: 'close-during-' + boundary, generation: 1, kind: 'paragraph' },
        old = { id: 'old-before-close', generation: 1, kind: 'paragraph' };
      let closing,
        retired = 0,
        closed = false;
      const close = () => {
        if (!closed) {
          closed = true;
          closing = f.view.dispose();
          void closing.catch(() => {});
        }
      };
      const f = fixture({
        scene(_context, value) {
          if (boundary === 'retirement' && value === 42)
            return [{ op: 'paragraph', resource: old, x: 0, y: 0 }];
          return [
            {
              get op() {
                if (boundary === 'capture') close();
                return 'paragraph';
              },
              resource: next,
              x: 0,
              y: 0,
            },
          ];
        },
      });
      f.session.resources.register(next, () => retired++);
      f.session.resources.register(old, close);
      try {
        f.nativeRecordings = 2;
        if (boundary === 'retirement') {
          f.value = 42;
          f.view.requestFrame();
          f.tick();
          f.session.resources.releaseProducer(old);
          f.nativeRecordings = 1;
          f.value = 99;
        }
        if (boundary === 'pump') {
          f.view.requestFrame();
          f.tick();
        }
        if (boundary === 'admission' || boundary === 'pump')
          f.view.controller = {
            shouldSubmitFrame() {
              close();
              return true;
            },
            dispose() {},
          };
        if (boundary === 'pump') f.view.pump();
        else {
          f.view.requestFrame();
          f.tick();
        }
        assert(closed, 'The close callback must run');
        await closing;
        f.session.resources.releaseProducer(next);
        assert.equal(
          retired,
          1,
          'The replacement must return its caller hold before the closed View completes',
        );
        assert.deepEqual(f.submissions, []);
        assert.deepEqual(f.errors, []);
      } finally {
        await f.session.dispose();
        assert.equal(f.callbacks.size, 0);
      }
    }
  },
);
test(
  'replacement failure retains both falsey old-frame retirement and new-lease cleanup errors',
  { timeout },
  async () => {
    const old = { id: 'old-retirement-failure', generation: 1, kind: 'paragraph' },
      next = { id: 'new-retirement-failure', generation: 1, kind: 'paragraph' };
    const f = fixture({
      scene(_context, value) {
        return [{ op: 'paragraph', resource: value === 42 ? old : next, x: 0, y: 0 }];
      },
    });
    f.session.resources.register(old, () => {
      f.session.resources.releaseProducer(next);
      throw 0;
    });
    f.session.resources.register(next, () => {
      throw undefined;
    });
    try {
      f.nativeRecordings = 2;
      f.value = 42;
      f.view.requestFrame();
      f.tick();
      f.session.resources.releaseProducer(old);
      f.nativeRecordings = 1;
      f.value = 99;
      f.view.requestFrame();
      f.tick();
      assert.equal(f.errors.length, 1);
      assert(f.errors[0] instanceof AggregateError);
      const errors = f.errors[0].errors;
      assert.equal(errors.length, 2);
      assert(errors.every((error) => error instanceof AggregateError));
      assert.deepEqual(errors[0].errors, [0]);
      assert.deepEqual(errors[1].errors, [undefined]);
      assert.deepEqual(f.submissions, []);
    } finally {
      await f.session.dispose();
      assert.equal(f.callbacks.size, 0);
    }
  },
);
test(
  'controller admission failure preserves its original falsey error alongside caller lease retirement',
  { timeout },
  async () => {
    const resource = { id: 'admission-retirement-failure', generation: 1, kind: 'paragraph' },
      f = fixture({
        scene() {
          return [{ op: 'paragraph', resource, x: 0, y: 0 }];
        },
      });
    f.session.resources.register(resource, () => {
      throw undefined;
    });
    try {
      f.nativeRecordings = 2;
      f.view.requestFrame();
      f.tick();
      f.session.resources.releaseProducer(resource);
      f.view.controller = {
        shouldSubmitFrame() {
          throw 0;
        },
        dispose() {},
      };
      assert.throws(
        () => f.view.pump(),
        (error) =>
          error instanceof AggregateError &&
          error.errors[0] === 0 &&
          error.errors[1] instanceof AggregateError &&
          error.errors[1].errors.length === 1 &&
          error.errors[1].errors[0] === undefined,
      );
    } finally {
      await f.session.dispose();
    }
  },
);
test(
  'submit remains authoritative when native admission changes after the build hint',
  { timeout },
  async () => {
    const f = fixture();
    try {
      f.deny = true;
      f.value = 17;
      f.view.requestFrame();
      f.tick();
      assert.equal(f.builds, 1);
      assert.equal(f.submissions.length, 0);
      assert.equal(f.renderer.leases.size, 0);
      f.tick();
      assert.equal(f.builds, 1, 'A busy caller-owned frame retries without another invalidation');
      f.deny = false;
      f.tick();
      assert.equal(f.builds, 1);
      assert.equal(f.submissions[0].color, 17);
      assert.equal(f.renderer.leases.size, 1);
    } finally {
      await f.session.dispose();
    }
  },
);

test(
  'a forced input-geometry frame observes current state while native admission is blocked',
  { timeout },
  async () => {
    const f = fixture();
    try {
      f.nativeRecordings = 2;
      f.value = 42;
      f.view.requestFrame();
      f.tick();
      assert.equal(f.builds, 1);
      f.value = 99;
      f.view.requestForcedFrame();
      f.tick();
      assert.equal(f.builds, 2, 'Input geometry must not wait for an old prepared GPU frame');
      assert.equal(f.submissions.length, 0);
      f.nativeRecordings = 1;
      f.tick();
      assert.equal(f.builds, 2);
      assert.deepEqual(
        f.submissions.map((frame) => frame.color),
        [99],
      );
    } finally {
      await f.session.dispose();
    }
  },
);

test(
  'optional work admission reads live native/input/visibility state and is absent without an observed deadline',
  { timeout },
  async () => {
    const timing = {
      tick: 10,
      dispatch: 10,
      queueDelay: 0,
      clockUncertainty: 0,
      observedDeadline: 30,
    };
    for (const scenario of ['missing', 'native-busy', 'input-backlog', 'forced', 'generation']) {
      let guard, before, after;
      let f;
      f = fixture({
        scene: (context) => {
          guard = context.canRunOptionalWork;
          before = guard?.();
          if (scenario === 'input-backlog') {
            f.view.queuePointer({
              kind: 'wheel',
              pointer: 1,
              device: 'mouse',
              buttons: 0,
              x: 1,
              y: 1,
              timestamp: 10,
              viewportGeneration: 1,
              deltaY: 1,
            });
            after = guard();
          }
          return [{ op: 'clear', color: 1 }];
        },
      });
      try {
        f.view.requestFrame();
        if (scenario === 'native-busy') f.nativeRecordings = 2;
        if (scenario === 'forced') f.view.requestForcedFrame();
        f.tick(scenario === 'missing' ? undefined : timing);
        assert.equal(f.builds, 1);
        assert.deepEqual(f.errors, []);
        if (scenario === 'missing') assert.equal(guard, undefined);
        else if (scenario === 'native-busy' || scenario === 'forced') assert.equal(before, false);
        else assert.equal(before, true);
        if (scenario === 'input-backlog') assert.equal(after, false);
        if (scenario === 'generation') {
          f.view.updateMetrics({ ...metrics, viewportGeneration: 2 });
          assert.equal(guard(), false);
        }
        f.view.setVisible(false);
        if (guard) assert.equal(guard(), false);
      } finally {
        await f.session.dispose();
        assert.equal(f.callbacks.size, 0);
      }
      if (guard)
        assert.equal(guard(), false, 'Closing does not call a disposed native admission API');
    }
  },
);
test(
  'resume discards a prepared pre-hide frame and builds the latest visible state',
  { timeout },
  async () => {
    const f = fixture();
    try {
      f.nativeRecordings = 2;
      f.value = 42;
      f.view.requestFrame();
      f.tick();
      assert.equal(f.builds, 1);
      assert.equal(f.submissions.length, 0);
      f.view.setVisible(false);
      f.value = 99;
      f.view.requestFrame();
      assert.equal(f.callbacks.size, 0);
      f.nativeRecordings = 1;
      f.view.setVisible(true);
      f.tick();
      assert.equal(f.builds, 2);
      assert.deepEqual(
        f.submissions.map((frame) => frame.color),
        [99],
      );
    } finally {
      await f.session.dispose();
    }
  },
);
test(
  'closing a blocked view cancels retries and an invalid retirement still fails its owner',
  { timeout },
  async () => {
    const f = fixture();
    try {
      for (let i = 0; i < 2; i++) {
        f.view.requestFrame();
        f.tick();
      }
      f.view.requestFrame();
      f.tick();
      const late = [...f.callbacks.values()][0];
      f.session.beginClose();
      late();
      assert.equal(f.builds, 3);
      assert.equal(f.callbacks.size, 0);
    } finally {
      await f.session.dispose();
    }
    const g = fixture();
    try {
      g.view.requestFrame();
      g.notifications.push(999, 1, 0);
      g.tick();
      assert.equal(g.builds, 1);
      assert.equal(g.view.status, 'failed');
      assert.equal(g.errors.length, 1);
    } finally {
      await g.session.dispose();
    }
  },
);
