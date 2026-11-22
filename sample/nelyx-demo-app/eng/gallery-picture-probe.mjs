// SPDX-License-Identifier: BSD-3-Clause
// Runs only in the WebView opened with --pictures. Never changes the replay.
export function installPictureProbe() {
  window.galleryInspectCanvasKit = (kit) => {
    const recordings = new WeakMap();
    const recorderStates = new WeakMap();
    const pictures = new WeakMap();
    const unsafePaints = new WeakSet();
    const displayCanvases = new WeakSet();
    let nextPicture = 0;
    const counters = () => ({ compiled: 0, replays: 0, bounded: 0, offscreen: 0, testMs: 0 });
    let stats = counters(),
      used = new Set(),
      placements = [],
      misses = [];
    window.galleryPictureDraws = () => {
      const result = { ...stats, distinct: used.size, placements, misses };
      stats = counters();
      used = new Set();
      placements = [];
      misses = [];
      return result;
    };
    function wrap(owner, name, use) {
      const original = owner[name];
      owner[name] = function (...args) {
        return use(this, args, () => Reflect.apply(original, this, args));
      };
    }
    const canvas = kit.Canvas.prototype;
    const paint = kit.Paint.prototype;
    const recorder = kit.PictureRecorder.prototype;
    const isAxisAligned = (m) => m[1] === 0 && m[3] === 0 && m[6] === 0 && m[7] === 0 && m[8] === 1;
    function addBounds(state, target, rect) {
      if (!state.safe) return;
      const m = target.getTotalMatrix();
      // Only simple translations inside the recording. Leave a margin for
      // float rounding and anti-aliasing at the edge of each primitive.
      if (!isAxisAligned(m) || m[0] !== 1 || m[4] !== 1 || !rect.every(Number.isFinite)) {
        state.safe = false;
        return;
      }
      const next = [rect[0] + m[2], rect[1] + m[5], rect[2] + m[2], rect[3] + m[5]];
      const old = state.bounds;
      state.bounds = old
        ? [
            Math.min(old[0], next[0]),
            Math.min(old[1], next[1]),
            Math.max(old[2], next[2]),
            Math.max(old[3], next[3]),
          ]
        : next;
    }
    wrap(kit, 'MakeOnScreenGLSurface', (_kit, _args, call) => {
      const surface = call();
      if (surface)
        wrap(surface, 'getCanvas', (_surface, _args, get) => {
          const output = get();
          displayCanvases.add(output);
          return output;
        });
      return surface;
    });
    wrap(recorder, 'beginRecording', (self, _args, call) => {
      const output = call();
      const state = { safe: true, bounds: null };
      recorderStates.set(self, state);
      recordings.set(output, state);
      return output;
    });
    wrap(recorder, 'finishRecordingAsPicture', (self, _args, call) => {
      const picture = call();
      const state = recorderStates.get(self);
      pictures.set(picture, { id: ++nextPicture, bounds: state?.safe ? state.bounds : null });
      stats.compiled++;
      return picture;
    });
    wrap(paint, 'setStyle', (self, [style], call) => {
      if (style !== kit.PaintStyle.Fill) unsafePaints.add(self);
      return call();
    });
    for (const method of [
      'setBlender',
      'setImageFilter',
      'setMaskFilter',
      'setPathEffect',
      'setShader',
    ])
      wrap(paint, method, (self, _args, call) => {
        unsafePaints.add(self);
        return call();
      });
    wrap(canvas, 'drawPicture', (self, [picture], call) => {
      const known = pictures.get(picture);
      const state = recordings.get(self);
      if (state) {
        if (known?.bounds) addBounds(state, self, known.bounds);
        else state.safe = false;
      }
      if (displayCanvases.has(self)) {
        stats.replays++;
        if (known && used.size < 4096) used.add(known.id);
        if (placements.length < 3)
          placements.push({
            id: known?.id,
            matrix: self.getTotalMatrix(),
            clip: Array.from(self.getDeviceClipBounds()),
          });
        if (known?.bounds) {
          const began = performance.now();
          const matrix = self.getTotalMatrix();
          if (isAxisAligned(matrix) && matrix[0] > 0 && matrix[4] > 0) {
            stats.bounded++;
            const bounds = known.bounds.map((value, index) => value + (index < 2 ? -3 : 3));
            if (self.quickReject(bounds)) {
              stats.offscreen++;
              if (misses.length < 8)
                misses.push({
                  id: known.id,
                  bounds,
                  matrix,
                  clip: Array.from(self.getDeviceClipBounds()),
                });
            }
          }
          stats.testMs += performance.now() - began;
        }
      }
      return call();
    });
    for (const [name, rect, brush] of [
      ['drawRect', 0, 1],
      ['drawRRect', 0, 1],
      ['drawImageRectOptions', 2, 5],
    ]) {
      wrap(canvas, name, (self, args, call) => {
        const state = recordings.get(self);
        if (state?.safe) {
          if (args[brush] && unsafePaints.has(args[brush])) state.safe = false;
          else addBounds(state, self, Array.from(args[rect]).slice(0, 4));
        }
        return call();
      });
    }
    const bounded = new Set(['drawPicture', 'drawRect', 'drawRRect', 'drawImageRectOptions']);
    for (const method of Object.getOwnPropertyNames(canvas)) {
      if (
        (!method.startsWith('draw') || bounded.has(method)) &&
        !['clear', 'saveLayer', 'saveLayerPaint', 'writePixels'].includes(method)
      )
        continue;
      wrap(canvas, method, (self, _args, call) => {
        const state = recordings.get(self);
        if (state) state.safe = false;
        return call();
      });
    }
  };
}
