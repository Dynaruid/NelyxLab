import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Animation, AnimationStatus } from '@nelyx/core/framework/animation/animation';
import { SnapshotWidget } from '@nelyx/core/framework/widgets/snapshot-widget';
import { State, StatefulWidget } from '@nelyx/core/framework/widgets/framework';
import { MediaQuery } from '@nelyx/core/framework/widgets/app-data';
import { SizedBox, ColoredBox } from '@nelyx/core/framework/widgets/basic';
import { RasterizationService } from '@nelyx/core/hosting/rasterization';
import { engineFixture } from './engine-fixture.mjs';
export const wrap = (child) =>
    new MediaQuery(
      {
        width: 240,
        height: 160,
        scale: 1,
        textScale: 1,
        safeArea: { top: 0, left: 0, right: 0, bottom: 0 },
        keyboardInset: 0,
      },
      child,
    ),
  flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
  };
export class Motion extends Animation {
  constructor(value = 0, status = AnimationStatus.dismissed) {
    super();
    this.current = value;
    this.state = status;
    this.values = [];
    this.statuses = [];
  }
  get value() {
    return this.current;
  }
  get status() {
    return this.state;
  }
  addListener(l) {
    this.values.push(l);
  }
  removeListener(l) {
    const i = this.values.indexOf(l);
    if (i >= 0) this.values.splice(i, 1);
  }
  addStatusListener(l) {
    this.statuses.push(l);
  }
  removeStatusListener(l) {
    const i = this.statuses.indexOf(l);
    if (i >= 0) this.statuses.splice(i, 1);
  }
  set(value, status) {
    const old = this.state;
    this.current = value;
    this.state = status;
    if (old !== status) {
      const snapshot1 = [...this.statuses];
      for (const l of snapshot1) l(status);
    }
    const snapshot2 = [...this.values];
    for (const l of snapshot2) l();
  }
}
export class Probe extends StatefulWidget {
  constructor(counts, color = 0xffff0000) {
    super();
    this.counts = counts;
    this.color = color;
  }
  createState() {
    this.counts.created++;
    return new ProbeState();
  }
}
class ProbeState extends State {
  build() {
    return new ColoredBox({ color: this.widget.color, child: SizedBox.expand() });
  }
  dispose() {
    this.widget.counts.disposed++;
    super.dispose();
  }
}
export const snapshots = (f) => {
  const values = [];
  const visit = (e) => {
    if (e.widget instanceof SnapshotWidget) values.push(e.widget);
    e.visitChildren(visit);
  };
  if (f.root.root) visit(f.root.root);
  return values;
};
export async function ownedFixture() {
  const f = await engineFixture(),
    { ck, library } = f,
    context = f.root.context,
    captures = [];
  let id = 0,
    live = 0;
  const rasterizer = new RasterizationService(
    context.resources,
    {
      rasterize(capture, width, height) {
        const surface = ck.MakeSurface(width, height);
        assert(surface);
        let image;
        try {
          surface.getCanvas().clear(ck.TRANSPARENT);
          library.replay(surface.getCanvas(), capture.frame);
          surface.flush();
          image = surface.makeImageSnapshot();
          const bytes = image.encodeToBytes();
          assert(bytes);
          const decoded = library.decode(
            {
              kind: 'image',
              id: 'zoom-cpu-' + ++id,
              sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
            },
            bytes,
          );
          captures.push({ width, height });
          live++;
          return {
            ...decoded,
            width,
            height,
            duration: 0,
            retire() {
              decoded.retire();
              live--;
            },
          };
        } finally {
          image?.delete();
          surface.delete();
        }
      },
      dispose() {},
    },
    { bitmapCache: false },
  );
  context.rasterizer = rasterizer;
  return {
    ...f,
    captures,
    get liveImages() {
      return live;
    },
    async close() {
      f.set(new SizedBox());
      await rasterizer.dispose();
      await f.close();
      assert.equal(live, 0);
      assert.equal(library.debugRasterizationStats.pictures, 0);
    },
  };
}
