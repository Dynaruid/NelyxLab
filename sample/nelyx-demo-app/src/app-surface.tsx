// SPDX-License-Identifier: BSD-3-Clause
import { describeError } from '@nelyx/core/foundation/errors';
import { ValueNotifier } from '@nelyx/core/foundation/notifier';
import { RenderEditable } from '@nelyx/core/framework/rendering/editable';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { visibleSelectionBounds } from '@nelyx/core/framework/widgets/text-selection-toolbar-anchors';
import { TextSelection } from '@nelyx/core/services/text-editing';
import { FrameDiagnostics } from '@nelyx/core/ui/frame';
import { Rect } from '@nelyx/core/ui/rect';
import { TextPosition } from '@nelyx/core/ui/text-position';
import type { WebSkiaLibrary } from '@nelyx/skia-web/library';
import { useMemo, useState } from 'react';
import type { WebApplication, WebRenderMode } from '@nelyx/sdk/frontend/dom/application';
import { getFrontendHost } from '@nelyx/sdk/frontend/dom/environment';
import { ApplicationSurface } from '@nelyx/sdk/frontend/dom/surface';
import type { FrontendProps } from '@nelyx/vite/client';
import { main } from './app.ts';

const modePreference = 'nelyx.demo.renderMode';

function initialMode(frontend: FrontendProps['options']): WebRenderMode {
  if (frontend.renderMode) return frontend.renderMode;
  const { target, os } = getFrontendHost();
  const defaultMode =
    target === 'tauri' && os === 'iOS' && window.isSecureContext && window.crossOriginIsolated
      ? 'auto'
      : 'direct';
  try {
    const saved = localStorage.getItem(modePreference);
    return saved === 'auto' || saved === 'direct' ? saved : defaultMode;
  } catch {
    return defaultMode;
  }
}

declare global {
  interface Window {
    nelyxDemoFrameProbe?: (
      read: () => {
        frames: ReturnType<FrameDiagnostics['drain']>;
        sections?: FrameworkRoot['buildOwner']['preparationStats'];
        dormant?: NonNullable<FrameworkRoot['buildOwner']['maybeDormantChildren']>['debugStats'];
        pictures?: WebSkiaLibrary['debugRasterizationStats'];
        rendering: WebApplication['rendering'];
      },
      dispose: () => Promise<void>,
    ) => void;
    nelyxDemoEditorGeometryProbe?: (
      read: (id: string) => ReturnType<typeof editorGeometry>,
    ) => void;
  }
}

function editorGeometry(root: RenderObject | undefined, id: string, viewport: Rect) {
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
  const { left, top, right, bottom } = visibleSelectionBounds(render, viewport);
  return {
    scroll: render.scrollOffset,
    visible: { left, top, right, bottom },
    caret: [render.localToGlobal(caret.topLeft), render.localToGlobal(caret.bottomRight)],
    corners: [
      render.localToGlobal({ x: 0, y: 0 }),
      render.localToGlobal({ x: render.size.width, y: render.size.height }),
    ],
    endpoints: render.getEndpointsForSelection(range).map(({ point, direction }, index) => ({
      ...render.localToGlobal(point),
      direction,
      lineHeight: render.getLocalRectForCaret(
        new TextPosition({ offset: index === 0 ? range.start : range.end }),
      ).height,
    })),
    selectionBoxes: render
      .getBoxesForSelection(range)
      .map((box) => [render.localToGlobal(box.topLeft), render.localToGlobal(box.bottomRight)]),
  };
}

function attachFrameProbe(application: WebApplication): void {
  const view = application.view;
  const controller = view.controller;
  if (controller instanceof FrameworkRoot)
    window.nelyxDemoEditorGeometryProbe?.((id) => {
      const { logicalWidth, logicalHeight } = view.currentMetrics;
      return editorGeometry(
        controller.pipeline.rootNode,
        id,
        Rect.fromLTWH(0, 0, logicalWidth, logicalHeight),
      );
    });
  if (!window.nelyxDemoFrameProbe) return;
  const diagnostics = new FrameDiagnostics(performance, 16384),
    text = application.text as WebSkiaLibrary;
  view.frameDiagnostics = diagnostics;
  window.nelyxDemoFrameProbe(
    () => {
      const owner =
        view.controller instanceof FrameworkRoot ? view.controller.buildOwner : undefined;
      return {
        frames: diagnostics.drain(),
        ...(owner ? { sections: owner.preparationStats } : {}),
        ...(owner?.maybeDormantChildren ? { dormant: owner.maybeDormantChildren.debugStats } : {}),
        pictures: text.debugRasterizationStats,
        rendering: application.rendering,
      };
    },
    () => application.dispose(),
  );
}

export function App({
  options: frontend,
  create = main,
}: FrontendProps & { create?: typeof main }) {
  const [request, setRequest] = useState(() => ({
    mode: initialMode(frontend),
    showSettings: false,
  }));
  const [error, setError] = useState('');
  const options = useMemo(
    () => ({
      ...frontend,
      renderMode: request.mode,
      // The gallery clears and redraws the whole canvas on every submitted frame.
      preserveDrawingBuffer: false,
      ...(getFrontendHost().os === 'android' ? { maxRasterScale: 2 } : {}),
    }),
    [frontend, request],
  );
  const activeApplication = useMemo(
    () => new ValueNotifier<WebApplication | undefined>(undefined),
    [options, create],
  );
  const definition = useMemo(() => {
    const { definition } = create(undefined, {
      renderSettings: {
        mode: request.mode,
        application: activeApplication,
        showOnStartup: request.showSettings,
        selectMode(mode) {
          // Reselecting automatic mode can retry a worker that fell back to direct.
          if (
            mode === request.mode &&
            (mode === 'direct' || activeApplication.value?.rendering.path !== 'direct')
          )
            return;
          setError('');
          setRequest({ mode, showSettings: true });
        },
      },
    });
    return {
      ...definition,
      // AssetImage resolves the bundled WebP through ImageService on demand.
      assets: definition.assets ?? options.manifest.filter(({ kind }) => kind === 'font'),
    };
  }, [activeApplication, create, options.manifest, request]);
  function ready(application: WebApplication) {
    attachFrameProbe(application);
    activeApplication.value = application;
    if (request.showSettings) {
      try {
        localStorage.setItem(modePreference, request.mode);
      } catch {
        // The current session can still switch if storage is unavailable.
      }
    }
  }
  return (
    <>
      {error && <p role="alert">{error}</p>}
      <ApplicationSurface
        definition={definition}
        options={options}
        onReady={ready}
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
