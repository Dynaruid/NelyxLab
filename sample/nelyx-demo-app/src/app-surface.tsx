// SPDX-License-Identifier: BSD-3-Clause
import { describeError } from '@nelyx/core/foundation/errors';
import { RenderEditable } from '@nelyx/core/framework/rendering/editable';
import type { RenderObject } from '@nelyx/core/framework/rendering/object';
import { FrameworkRoot } from '@nelyx/core/framework/widgets/root';
import { visibleSelectionBounds } from '@nelyx/core/framework/widgets/text-selection-toolbar-anchors';
import { TextSelection } from '@nelyx/core/services/text-editing';
import { FrameDiagnostics } from '@nelyx/core/ui/frame';
import { Rect } from '@nelyx/core/ui/rect';
import { TextPosition } from '@nelyx/core/ui/text-position';
import type { WebSkiaLibrary } from '@nelyx/skia-web/library';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { WebApplication } from '@nelyx/sdk/frontend/dom/application';
import { getFrontendHost } from '@nelyx/sdk/frontend/dom/environment';
import { ApplicationSurface } from '@nelyx/sdk/frontend/dom/surface';
import type { FrontendProps } from '@nelyx/vite/client';
import { main } from './app.ts';
import { renderToggleGutter } from './layout.ts';

const modePreference = 'nelyx.demo.renderMode';
type RenderMode = NonNullable<FrontendProps['options']['renderMode']>;

function initialMode(frontend: FrontendProps['options']): RenderMode {
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
  const shared = useMemo(() => create(), [create]);
  const [request, setRequest] = useState(() => ({ mode: initialMode(frontend) }));
  const [path, setPath] = useState<WebApplication['rendering']['path']>();
  const [error, setError] = useState('');
  const toggle = useRef<HTMLButtonElement>(null);
  const observer = useRef<MutationObserver | undefined>(undefined);
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
  const definition = useMemo(
    () => ({
      ...shared.definition,
      // AssetImage resolves the bundled WebP through ImageService on demand.
      assets: shared.definition.assets ?? options.manifest.filter(({ kind }) => kind === 'font'),
    }),
    [shared.definition, options.manifest],
  );
  useEffect(() => () => observer.current?.disconnect(), [options]);
  function ready(application: WebApplication) {
    attachFrameProbe(application);
    setPath(application.rendering.path);
    // A worker can recover on a new canvas or fall back to direct after startup.
    const parent = toggle.current?.parentElement?.querySelector('canvas')?.parentElement;
    if (parent && application.rendering.path !== 'direct') {
      observer.current = new MutationObserver((records) => {
        if (records.some(({ target }) => target === parent || target instanceof HTMLCanvasElement))
          setPath(application.rendering.path);
      });
      observer.current.observe(parent, {
        subtree: true,
        childList: true,
        attributeFilter: ['data-nelyx-render-path'],
      });
    }
  }
  const worker = path === 'worker-transfer' || path === 'worker-shared';
  const pending = !path && !error;
  function switchMode() {
    const mode = (path ? worker : request.mode !== 'direct') ? 'direct' : 'auto';
    try {
      localStorage.setItem(modePreference, mode);
    } catch {
      // The current session can still switch if storage is unavailable.
    }
    setError('');
    setPath(undefined);
    setRequest({ mode });
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
      <button
        className="render-mode-toggle"
        type="button"
        ref={toggle}
        style={{ width: renderToggleGutter - 12 }}
        aria-label="워커 렌더링"
        aria-pressed={worker}
        disabled={pending}
        title={worker ? '직접 렌더링으로 전환' : '워커 렌더링으로 전환'}
        onClick={switchMode}
      >
        <span aria-hidden="true">⇄</span>{' '}
        {pending ? '준비' : path ? (worker ? '워커' : '직접') : '재시도'}
      </button>
      {path === 'direct' && request.mode !== 'direct' && (
        <output className="render-mode-notice">워커를 사용할 수 없어 직접 렌더링 중입니다.</output>
      )}
    </>
  );
}
