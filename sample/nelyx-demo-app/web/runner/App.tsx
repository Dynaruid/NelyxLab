// SPDX-License-Identifier: BSD-3-Clause
import { describeError } from '@nelyx/core/foundation/errors';
import { RenderEditable } from '@nelyx/core/framework/rendering/editable';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { TextSelection } from '@nelyx/core/services/text-editing';
import { FrameDiagnostics } from '@nelyx/core/ui/frame';
import type { WebSkiaLibrary } from '@nelyx/skia-web/library';
import { useMemo, useState } from 'react';
import type { WebApplication } from '@nelyx/sdk/platforms/web/application';
import { getWebDeployment } from '@nelyx/sdk/platforms/web/environment';
import { ApplicationSurface } from '@nelyx/sdk/platforms/web/surface';
import { main } from 'virtual:nelyx-app';
import { applicationOptions } from './configuration.ts';

declare global {
  interface Window {
    nelyxDemoFrameProbe?: (
      read: () => {
        frames: ReturnType<FrameDiagnostics['drain']>;
        sections?: FrameworkRoot['buildOwner']['preparationStats'];
        dormant?: NonNullable<FrameworkRoot['buildOwner']['maybeDormantChildren']>['debugStats'];
        pictures?: WebSkiaLibrary['debugRasterizationStats'];
      },
    ) => void;
    nelyxDemoEditorGeometryProbe?: (
      read: (id: string) => ReturnType<typeof editorGeometry>,
    ) => void;
  }
}

function editorGeometry(root: RenderObject | undefined, id: string) {
  let editor: RenderEditable | undefined;
  function visit(render: RenderObject): void {
    if (editor) return;
    if (
      render instanceof RenderEditable &&
      (render.semantics?.id === id || render.plainText === id)
    )
      editor = render;
    else render.visitChildren(visit);
  }
  if (root) visit(root);
  if (!editor?.hasSize || editor.needsLayout || !editor.isDisplayed) return null;
  const render = editor;
  const selection = render.semantics?.textSelection;
  if (!selection) return null;
  const range = new TextSelection({
    baseOffset: selection.anchor,
    extentOffset: selection.focus,
  });
  const { caret } = render.editingGeometry;
  return {
    scroll: render.scrollOffset,
    caret: [render.localToGlobal(caret.topLeft), render.localToGlobal(caret.bottomRight)],
    corners: [
      render.localToGlobal({ x: 0, y: 0 }),
      render.localToGlobal({ x: render.size.width, y: render.size.height }),
    ],
    endpoints: render
      .getEndpointsForSelection(range)
      .map(({ point, direction }) => ({ ...render.localToGlobal(point), direction })),
    selectionBoxes: render
      .getBoxesForSelection(range)
      .map((box) => [render.localToGlobal(box.topLeft), render.localToGlobal(box.bottomRight)]),
  };
}

function attachFrameProbe(application: WebApplication): void {
  const view = application.view;
  const controller = view.controller;
  if (controller instanceof FrameworkRoot)
    window.nelyxDemoEditorGeometryProbe?.((id) => editorGeometry(controller.pipeline.rootNode, id));
  if (!window.nelyxDemoFrameProbe) return;
  const diagnostics = new FrameDiagnostics(performance, 16384),
    text = application.text as WebSkiaLibrary;
  view.frameDiagnostics = diagnostics;
  window.nelyxDemoFrameProbe(() => {
    const owner = view.controller instanceof FrameworkRoot ? view.controller.buildOwner : undefined;
    return {
      frames: diagnostics.drain(),
      ...(owner ? { sections: owner.preparationStats } : {}),
      ...(owner?.maybeDormantChildren ? { dormant: owner.maybeDormantChildren.debugStats } : {}),
      pictures: text.debugRasterizationStats,
    };
  });
}

export function App() {
  const shared = useMemo(() => main(), []);
  const options = useMemo(
    () => ({
      ...applicationOptions(),
      // The gallery clears and redraws the whole canvas on every submitted frame.
      preserveDrawingBuffer: false,
      ...(getWebDeployment().os === 'android' ? { maxRasterScale: 2 } : {}),
    }),
    [],
  );
  const definition = useMemo(
    () => ({
      ...shared.definition,
      // AssetImage resolves the bundled WebP through ImageService on demand.
      assets: shared.definition.assets ?? options.manifest.filter(({ kind }) => kind === 'font'),
    }),
    [shared.definition, options.manifest],
  );
  const [error, setError] = useState('');
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <ApplicationSurface
        definition={definition}
        options={options}
        onReady={attachFrameProbe}
        style={{ flex: 1, width: '100%', height: '100%' }}
        onError={(error) => {
          const message = describeError(error);
          console.error(message, error);
          setError(message);
        }}
      />
    </>
  );
}
