import type { AssetRef } from '@nelyx/core/foundation/assets';
import { FramePictureService } from '@nelyx/core/hosting/pictures';
import { RasterizationService } from '@nelyx/core/hosting/rasterization';
import type { ApplicationDefinition, ViewRuntime } from '@nelyx/core/hosting/runtime';
import type { BackendServices, SurfaceEvent } from '@nelyx/core/hosting/services';
import type { BackendIdentity } from '@nelyx/core/hosting/platform';
import type { ViewMetrics, ViewOwner } from '@nelyx/core/ui/types';
import type { WebSkiaLibrary } from '@nelyx/skia-web/library';
import type { BrowserRenderer } from './renderer.ts';
import { ManifestAssetService, selectManifestAssets } from '../../runtime/assets.ts';
import type { ResolvedAppAsset as AppAsset } from '../../runtime/config.ts';
import { createDomInteraction } from './interaction.ts';
import { BrowserFrameClock } from './frame-clock.ts';
import { BrowserMouseCursor } from './mouse-cursor.ts';
import {
  BrowserSelectionContextMenu,
  supportsNativeBrowserContextMenu,
} from './selection-context-menu.ts';
import { sha256 } from './canvaskit.ts';
import { isAppUrl } from './local-url.ts';
import { bindCanvasInput } from './input.ts';
import { createBrowserEnvironment } from './environment.ts';
import type { WebSafeAreaSource } from './environment.ts';
import { getBrowserPlatformEnvironment } from './platform.ts';
import { ImageService } from '@nelyx/core/hosting/images';
import { readImageUrl, encodeImageAssetManifest } from '../../runtime/image-loading.ts';
import { bindViewLocale } from './view-locale.ts';
type ResolvedWebDefinition = {
  -readonly [Key in keyof ApplicationDefinition]: ApplicationDefinition[Key];
} & { assets: readonly AssetRef[] };
/** Read only declared resources while CanvasKit starts. Integrity is checked at decode. */
export async function readBrowserAssets(
  manifest: readonly AppAsset[],
  root: URL,
  declarations: readonly AssetRef[],
  signal: AbortSignal,
): Promise<Map<string, Uint8Array<ArrayBuffer>>> {
  if (manifest.length > 64 || !isAppUrl(root, root)) throw new Error('Web asset root/count');
  let total = 0;
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  await Promise.all(
    selectManifestAssets(manifest, declarations).map(async (asset) => {
      const url = new URL(asset.path, root);
      if (!isAppUrl(url, root)) throw new Error('Web asset escaped app root');
      const response = await fetch(url, { redirect: 'error', signal });
      if (!response.ok) throw new Error('Web asset HTTP ' + response.status);
      const bytes = new Uint8Array(await response.arrayBuffer());
      total += bytes.byteLength;
      if (bytes.byteLength > 16 * 1024 * 1024 || total > 64 * 1024 * 1024)
        throw new Error('Web asset byte budget');
      files.set(asset.id, bytes);
    }),
  );
  return files;
}
export function createWebServices(
  library: WebSkiaLibrary,
  display: BrowserRenderer,
  canvas: HTMLCanvasElement,
  input: HTMLInputElement,
  button: HTMLButtonElement,
  identity: BackendIdentity,
  owner: ViewOwner,
  manifest: readonly AppAsset[],
  root: URL,
  definition: ApplicationDefinition,
  files: Map<string, Uint8Array<ArrayBuffer>>,
  safeArea?: WebSafeAreaSource,
  options?: {
    readonly canvasViewport?: HTMLElement;
    readonly maxRasterScale?: number;
    readonly localeBoundary?: HTMLElement;
    readonly ownsDocument?: boolean;
  },
): {
  services: BackendServices;
  cursor: BrowserMouseCursor;
  selectionContextMenu: BrowserSelectionContextMenu;
  definition: ResolvedWebDefinition;
} {
  if (manifest.length > 64 || !isAppUrl(root, root)) throw new Error('Web asset root/count');
  const document = canvas.ownerDocument,
    window = document.defaultView!,
    frameTimeOffset = window.performance.timeOrigin - performance.timeOrigin;
  const canvasViewport = options?.canvasViewport;
  const readViewport = () => canvasViewport ?? canvas;
  let nativeSelectionContextMenu: BrowserSelectionContextMenu | undefined;
  const cursor = new BrowserMouseCursor(canvas),
    interaction = createDomInteraction(
      input,
      button,
      cursor,
      () => {
        const element = readViewport();
        return {
          bounds: element.getBoundingClientRect(),
          width: element.clientWidth,
          height: element.clientHeight,
          generation: viewport,
        };
      },
      definition.accessibilityEnabled !== false,
      supportsNativeBrowserContextMenu(window)
        ? () => nativeSelectionContextMenu?.nativeMenuEnabled === true
        : undefined,
    ),
    cssFonts = new Set<FontFace>(),
    fontSet = document.fonts as FontFaceSet & {
      add(face: FontFace): void;
      delete(face: FontFace): boolean;
    };
  let closed = false,
    notify: ((event: SurfaceEvent) => void) | undefined,
    viewport = 1,
    renderer = 1,
    surface = 1,
    context = 1;
  const environment = createBrowserEnvironment(readViewport, safeArea);
  let viewLocale: ReturnType<typeof bindViewLocale> | undefined;
  try {
    const selectionContextMenu = new BrowserSelectionContextMenu(
      canvas,
      owner,
      cursor,
      canvasViewport !== undefined,
    );
    nativeSelectionContextMenu = selectionContextMenu;
    const frames = new BrowserFrameClock(
        window,
        (callback) => {
          if (closed) return;
          try {
            display.pollCompletedFrames();
            // Some hosts update DPR without a resize event for the layout box.
            if (current.scale !== (window.devicePixelRatio || 1)) resize();
            if (!closed) callback();
          } finally {
            selectionContextMenu.refresh();
          }
        },
        frameTimeOffset,
      ),
      idleWork = new Set<number>();
    function metrics(): ViewMetrics {
      const element = readViewport(),
        width = element.clientWidth,
        height = element.clientHeight,
        scale = window.devicePixelRatio || 1;
      return Object.freeze({
        logicalWidth: width,
        logicalHeight: height,
        physicalWidth: Math.round(width * scale),
        physicalHeight: Math.round(height * scale),
        scale,
        viewportGeneration: viewport,
        rendererGeneration: renderer,
        nativeContextGeneration: context,
        nativeSurfaceGeneration: surface,
        environment: environment.read(),
      });
    }
    let current = metrics(),
      observer: ResizeObserver | undefined,
      media: MediaQueryList | undefined;
    function fitCanvas(scale: number): void {
      if (!canvasViewport) return;
      const rasterScale = Math.min(scale, options?.maxRasterScale ?? Infinity);
      const style = canvas.style;
      style.position = 'absolute';
      style.top = '0';
      style.left = '0';
      // The element fills the viewport after transforming. Its bitmap keeps its
      // intrinsic size under the same transform, independent of viewport changes.
      style.width = style.height = `${100 * rasterScale}%`;
      style.objectFit = 'none';
      style.objectPosition = 'left top';
      style.transformOrigin = '0 0';
      style.transform = rasterScale === 1 ? '' : `scale(${1 / rasterScale})`;
    }
    fitCanvas(current.scale);
    let attachedView: ViewRuntime | undefined;
    let stopInput: ReturnType<typeof bindCanvasInput> | undefined,
      stopSafeArea: (() => void) | undefined;
    const resize = (): boolean => {
      if (closed || !notify) return false;
      const next = metrics(),
        backingChanged =
          next.logicalWidth !== current.logicalWidth ||
          next.logicalHeight !== current.logicalHeight ||
          next.scale !== current.scale;
      if (
        !backingChanged &&
        JSON.stringify(next.environment) === JSON.stringify(current.environment)
      )
        return false;
      if (next.scale !== current.scale) {
        fitCanvas(next.scale);
        watchDpi();
      }
      current = Object.freeze({
        ...next,
        viewportGeneration: ++viewport,
        nativeSurfaceGeneration: backingChanged ? ++surface : surface,
      });
      notify({ kind: 'metrics', metrics: current });
      return backingChanged;
    };
    const watchDpi = () => {
      media?.removeEventListener('change', resize);
      media = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      media.addEventListener('change', resize);
    };
    const lost = (event: Event) => {
      event.preventDefault();
      if (closed) return;
      display.lose();
      display.setVisible(false);
    };
    const restored = () => {
      if (closed) return;
      display.restore();
      display.setVisible(!document.hidden);
      publishGeneration();
      notify?.({ kind: 'visibility', visible: !document.hidden });
    };
    function publishGeneration(): void {
      if (closed) return;
      renderer++;
      context++;
      surface++;
      viewport++;
      current = metrics();
      fitCanvas(current.scale);
      notify?.({ kind: 'metrics', metrics: current });
    }
    const visibility = () => {
      const visible = !document.hidden;
      if (visible) resize();
      display.setVisible(visible);
      notify?.({ kind: 'visibility', visible });
    };
    function attachCanvas(view: ViewRuntime): void {
      let keySurface: HTMLElement | null = canvas.parentElement;
      while (keySurface && !keySurface.contains(input)) keySurface = keySurface.parentElement;
      if (!keySurface) throw new Error('Web controls require an attached common input surface');
      stopInput = bindCanvasInput(canvas, view, {
        ...(canvasViewport ? { viewport: canvasViewport } : {}),
        keySurface,
        ownsSemanticsTarget: interaction.ownsSemanticsTarget,
        ownsSemanticsAdjustmentTarget: interaction.ownsSemanticsAdjustmentTarget,
        ownsEditingTarget: interaction.ownsEditingTarget,
        ownsNativeSelectionTarget: (target) => selectionContextMenu.ownsTarget(target),
        usesNativeEditingMenu: interaction.usesNativeEditingMenu,
      });
      observer?.observe(readViewport());
    }
    function listenForContext(): void {
      canvas.addEventListener('webglcontextlost', lost);
      canvas.addEventListener('webglcontextrestored', restored);
    }
    function detachCanvas(replacing = false): void {
      stopInput?.(replacing);
      stopInput = undefined;
      observer?.unobserve(readViewport());
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    }
    const stop = () => {
      detachCanvas();
      attachedView = undefined;
      stopSafeArea?.();
      stopSafeArea = undefined;
      observer?.disconnect();
      observer = undefined;
      media?.removeEventListener('change', resize);
      media = undefined;
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', resize, true);
      window.visualViewport?.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('scroll', resize);
      document.removeEventListener('visibilitychange', visibility);
      notify = undefined;
    };
    display.bindSurface({
      submitPrepared: () => attachedView?.submitPreparedFrame(),
      replace(create) {
        const previous = canvas,
          previousParent = previous.parentElement,
          focus = document.activeElement === previous;
        detachCanvas(true);
        cursor.remove(previous);
        const replacement = create(previous);
        if (
          replacement === previous ||
          replacement.parentElement !== previousParent ||
          replacement.ownerDocument !== document ||
          !replacement.isConnected
        )
          throw new Error('Invalid Web display canvas replacement');
        canvas = replacement;
        fitCanvas(current.scale);
        cursor.replaceCanvas(canvas);
        selectionContextMenu.replaceCanvas(canvas);
        listenForContext();
        if (attachedView) attachCanvas(attachedView);
        if (focus) canvas.focus({ preventScroll: true });
        return canvas;
      },
      publishGeneration,
      closeFailedView: () => notify?.({ kind: 'context-lost' }),
    });
    const assets = new ManifestAssetService(
      manifest,
      {
        async load(ref) {
          const bytes = files.get(ref.id);
          if (!bytes) throw new Error('Missing prepared Web asset');
          files.delete(ref.id);
          return bytes;
        },
      },
      {
        async decode(asset, bytes) {
          const decoded = library.decode(asset, bytes);
          let face: FontFace | undefined;
          try {
            if (asset.kind === 'font') {
              try {
                face = await new window.FontFace(
                  asset.fontFamily!,
                  bytes.buffer instanceof ArrayBuffer
                    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
                    : new Uint8Array(bytes),
                ).load();
              } catch (error) {
                // CanvasKit can read font formats that the browser rejects, such as bitmap emoji.
                if (!(error instanceof window.DOMException) || error.name !== 'SyntaxError')
                  throw error;
              }
            }
            if (face) {
              fontSet.add(face);
              cssFonts.add(face);
            }
            return {
              descriptor: decoded.descriptor,
              retire() {
                if (face) {
                  fontSet.delete(face);
                  cssFonts.delete(face);
                }
                decoded.retire();
              },
            };
          } catch (error) {
            decoded.retire();
            throw error;
          }
        },
      },
      sha256,
    );
    viewLocale = bindViewLocale(
      () => options?.localeBoundary ?? canvas,
      options?.ownsDocument === true,
    );
    const services: BackendServices = {
      identity,
      setViewLocale: viewLocale.update,
      foundationPlatform: getBrowserPlatformEnvironment(),
      clock: {
        ...(typeof window.requestIdleCallback === 'function' &&
        typeof window.cancelIdleCallback === 'function'
          ? {
              requestIdle(callback: (timeRemaining: () => number) => void) {
                if (closed) throw new Error('Web clock closed');
                const id = window.requestIdleCallback((deadline) => {
                  if (idleWork.delete(id) && !closed) callback(() => deadline.timeRemaining());
                });
                idleWork.add(id);
                return {
                  dispose() {
                    if (idleWork.delete(id)) window.cancelIdleCallback(id);
                  },
                };
              },
            }
          : {}),
        request(callback, inputDriven) {
          return frames.request(callback, inputDriven);
        },
      },
      assets,
      images: {
        create(resources, clock, time) {
          return new ImageService(
            resources,
            {
              assetManifestBytes: encodeImageAssetManifest(manifest),
              instantiateCodec: (bytes, options) =>
                library.instantiateBrowserImageCodec(bytes, options),
              async loadAsset(key, signal, progress) {
                const asset = manifest.find((x) => x.id === key || x.path === key);
                if (!asset || asset.kind !== 'image')
                  throw new Error('Unknown image asset: ' + key);
                const url = new URL(asset.path, root);
                if (!isAppUrl(url, root)) throw new Error('Image asset escaped app root');
                const bytes = await readImageUrl(url.href, {}, signal, progress, 'error');
                if ((await sha256(bytes)) !== asset.sha256)
                  throw new Error('Image asset content hash mismatch: ' + key);
                return bytes;
              },
              loadNetwork: (url, headers, signal, progress) =>
                readImageUrl(new URL(url, root).href, headers, signal, progress),
            },
            clock,
            time,
          );
        },
      },
      pictures: {
        create: (resources) =>
          new FramePictureService(resources, library.framePictureBackend, owner),
      },
      rasterization: {
        create: (resources) =>
          new RasterizationService(resources, {
            rasterize: (capture, width, height) => library.rasterize(capture, width, height),
            dispose: () => library.retirePictures(),
          }),
      },
      renderer: {
        create(_surface, resources) {
          library.bind(resources);
          return display;
        },
      },
      paths: library,
      text: { create: () => library },
      editing: interaction.editing,
      semantics: interaction.semantics,
      nativeSelectionContextMenu: selectionContextMenu,
      surface: {
        owner,
        readMetrics: () => current,
        attach(view: ViewRuntime, callback) {
          if (closed || notify) throw new Error('Web surface closed/already attached');
          notify = callback;
          attachedView = view;
          observer = new window.ResizeObserver(() => {
            if (resize()) frames.offerResize();
          });
          attachCanvas(view);
          window.addEventListener('resize', resize);
          window.addEventListener('scroll', resize, true);
          window.visualViewport?.addEventListener('resize', resize);
          window.visualViewport?.addEventListener('scroll', resize);
          document.addEventListener('visibilitychange', visibility);
          watchDpi();
          stopSafeArea = safeArea?.subscribe(resize);
          resize();
          let alive = true;
          return {
            dispose() {
              if (!alive) return;
              alive = false;
              stop();
            },
          };
        },
        async dispose() {
          if (closed) return;
          closed = true;
          viewLocale?.dispose();
          stop();
          environment.dispose();
          frames.dispose();
          for (const id of idleWork) window.cancelIdleCallback(id);
          idleWork.clear();
          interaction.dispose();
          selectionContextMenu.dispose();
          cursor.dispose();
          assets.dispose();
          for (const face of cssFonts) fontSet.delete(face);
          cssFonts.clear();
          await display.dispose();
        },
      },
    };
    display.setVisible(!document.hidden);
    listenForContext();
    return {
      services,
      cursor,
      selectionContextMenu,
      definition: {
        ...definition,
        assets: definition.assets ?? manifest.map(({ id, kind, sha256 }) => ({ id, kind, sha256 })),
      },
    };
  } catch (error) {
    const errors = [error];
    for (const close of [
      () => viewLocale?.dispose(),
      () => nativeSelectionContextMenu?.dispose(),
      () => environment.dispose(),
      () => interaction.dispose(),
      () => cursor.dispose(),
    ])
      try {
        close();
      } catch (failure) {
        errors.push(failure);
      }
    if (errors.length > 1)
      throw new AggregateError(errors, 'Web service initialization cleanup failed');
    throw error;
  }
}
