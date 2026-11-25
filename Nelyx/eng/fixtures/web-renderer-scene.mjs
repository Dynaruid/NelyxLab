// SPDX-License-Identifier: BSD-3-Clause
// Use as the Vite entry of a supplied Demo copy to verify actual renderer pixels.
import { createElement, Fragment, useEffect, useState } from 'react';
import { startFrontend } from '@nelyx/vite/client';
import { ApplicationSurface } from '@nelyx/sdk/frontend/dom/surface';
import { Picture } from '@nelyx/core/ui/picture';
import { Paint } from '@nelyx/core/ui/paint';

const area = (x, y, width, height) => ({ x, y, width, height });
const plain = new Paint().snapshot();
const clip = {
  fillType: 'nonZero',
  operations: [{ verb: 'addRect', values: [11.25, 13.5, 229.75, 129.5] }],
};
const path = {
  fillType: 'evenOdd',
  operations: [
    { verb: 'addRect', values: [16, 60, 72, 110] },
    { verb: 'addOval', values: [24, 68, 65, 102] },
  ],
};

function App({ options }) {
  const [revision, setRevision] = useState(0);
  const mounted = revision % 2 === 0;
  return createElement(
    Fragment,
    null,
    createElement(
      'button',
      { onClick: () => setRevision((value) => value + 1) },
      mounted ? 'Unmount renderer scene' : 'Mount renderer scene',
    ),
    mounted && createElement(RendererScene, { options, revision }),
  );
}

function RendererScene({ options, revision }) {
  useEffect(() => {
    const effects = (window.rendererSceneEffects ??= { setups: 0, cleanups: 0 });
    effects.setups++;
    return () => {
      effects.cleanups++;
    };
  }, []);
  const definition = {
    id: 'nelyx.renderer-scene',
    accessibilityEnabled: false,
    createView({
      assets,
      text,
      pictures,
      rasterizer,
      paths,
      resources,
      requestFrame,
      dialogWindows,
    }) {
      const layout = text.layout({
        text: '안녕 A 👋 שלום',
        width: 230,
        font: assets.get('sample-font'),
        fontSize: 19,
        locale: 'ko',
        direction: 'ltr',
        scale: 1,
        color: 0xfff8d579,
        style: { fontWeight: 600, fontVariations: [{ axis: 'wght', value: 610 }] },
      });
      const backing = Picture._fromRecording([
        { op: 'clear', color: 0xffd41824 },
        { op: 'rrect', rect: area(7, 7, 18, 18), radius: 4, color: 0xc800ff00 },
      ]);
      const image = backing.toImageSync(32, 32, rasterizer);
      backing.dispose();
      const child = Picture._fromRecording([
        { op: 'drawPath', path, paint: { ...plain, color: 0xff72ceec } },
        {
          op: 'drawImageRect',
          resource: image.resource,
          src: area(0, 0, 32, 32),
          dst: area(89.25, 63, 42, 42),
          paint: { ...plain, filterQuality: 'high' },
        },
        { op: 'paragraph', resource: layout.resource, x: 18.25000000001, y: 23.25 },
      ]);
      const nested = Picture._fromRecording([
        { op: 'save' },
        { op: 'clipPath', path: clip, clipOp: 'intersect', doAntiAlias: true },
        { op: 'drawPicture', resource: pictures.resource(child) },
        { op: 'restore' },
      ]);
      const commands = [
        { op: 'clear', color: 0xff293849 },
        { op: 'drawPicture', resource: pictures.resource(nested) },
        { op: 'image', resource: assets.get('component-image'), rect: area(147, 61, 74, 56) },
        {
          op: 'drawRect',
          rect: area(147.75, 20, 65, 33),
          paint: {
            ...plain,
            shader: {
              kind: 'runtime',
              source:
                'uniform float alpha;\nhalf4 main(float2 p) { return half4(.4, .1, .65, alpha); }',
              uniforms: [1],
            },
          },
        },
        {
          op: 'drawRect',
          rect: area(17.25, 118, 94, 9),
          paint: {
            ...plain,
            shader: {
              kind: 'linear',
              colors: [0xffffac00, 0xff34c7ad],
              stops: null,
              tileMode: 'clamp',
              points: [17, 0, 111, 0],
              matrix: null,
            },
          },
        },
      ];
      window.openRendererDialog = () => {
        window.rendererDialogClosed = false;
        const opening = dialogWindows.open({
          title: 'Renderer dialog',
          requestFocus: true,
          createApplication: () => ({
            id: 'nelyx.renderer-dialog',
            assets: [],
            createScene: () => () => [
              { op: 'clear', color: 0xff293849 },
              { op: 'rect', rect: area(12, 12, 96, 45), color: 0xffcc6655 },
            ],
          }),
        });
        if (!opening) throw new Error('Renderer dialog did not open');
        void opening.then(() => {
          window.rendererDialogClosed = true;
        });
      };
      let large;
      window.drawLargeRendererScene = () => {
        large ??= Picture._fromRecording([
          { op: 'rect', rect: area(-16, -16, 4, 4), color: 0xff000000 },
        ]);
        requestFrame();
      };
      window.dropLargeRendererPicture = () => {
        large?.dispose();
        large = undefined;
        requestFrame();
      };
      window.readNestedRendererPixels = async () => {
        const recording = Picture._fromRecording([
          { op: 'clear', color: 0xff293849 },
          { op: 'drawPicture', resource: pictures.resource(nested) },
        ]);
        try {
          const raster = recording.toImageSync(256, 144, rasterizer);
          try {
            const hash = await crypto.subtle.digest('SHA-256', await raster.toByteData());
            return new Uint8Array(hash).toHex();
          } finally {
            raster.dispose();
          }
        } finally {
          recording.dispose();
        }
      };
      window.rendererGeometry = {
        lines: layout.lines,
        boxes: text.range(layout, 2, 8),
        glyph: text.closestGlyph(layout, 42, 10),
        unresolved: layout.unresolvedGlyphs,
      };
      window.rendererContains = paths.contains(clip, { x: 13, y: 18 });
      window.rendererPictureStats = () => pictures.debugStats;
      void image.toByteData().then((data) => {
        window.rendererReadback = [...data.subarray(0, 4)];
      });
      return {
        build() {
          return large
            ? [
                ...commands,
                { op: 'drawPicture', resource: pictures.resource(large) },
                ...Array.from({ length: 2000 }, () => ({
                  op: 'rect',
                  rect: area(-16, -16, 4, 4),
                  color: 0xff000000,
                })),
              ]
            : commands;
        },
        dispose() {
          large?.dispose();
          nested.dispose();
          child.dispose();
          image.dispose();
          resources.releaseProducer(layout.resource);
        },
      };
    },
  };
  return createElement(
    Fragment,
    null,
    createElement('button', { onClick: () => window.openRendererDialog() }, 'Open renderer dialog'),
    createElement(ApplicationSurface, {
      definition,
      options: { ...options, enableDialogWindows: true },
      style: { width: 256, height: 144 },
      onError(error) {
        document.body.insertAdjacentText('beforeend', String(error));
        throw error;
      },
      onReady(application) {
        window.readRendererScene = () => ({
          revision,
          rendering: application.rendering,
          geometry: window.rendererGeometry,
          readback: window.rendererReadback,
          contains: window.rendererContains,
          rasterization: application.text.debugRasterizationStats,
          pictures: window.rendererPictureStats(),
        });
      },
    }),
  );
}
startFrontend(App);
