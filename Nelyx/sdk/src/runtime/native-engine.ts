// SPDX-License-Identifier: BSD-3-Clause
import type { BackendServices } from '@nelyx/core/hosting/services';
import type { ViewOwner } from '@nelyx/core/ui/types';
import { FramePictureService } from '@nelyx/core/hosting/pictures';
import { RasterizationService } from '@nelyx/core/hosting/rasterization';
import { ImageService } from '@nelyx/core/hosting/images';
import {
  GraphiteRenderer,
  createPathQueries,
  createRuntimeShaderCache,
} from '@nelyx/skia-native/renderer';
import type {
  NelyxGraphiteContext,
  GraphiteRetirementClock,
  GraphiteResources,
} from '@nelyx/skia-native/renderer';
import { NativeTextLayoutService } from '@nelyx/skia-native/text';
import { createFramePictureBackend } from '@nelyx/skia-native/pictures';
import { createRasterizationBackend } from '@nelyx/skia-native/rasterization';
import {
  createInputGeometryService,
  createRetainedInputGeometryService,
} from '@nelyx/skia-native/input-geometry';
import { createSceneCompositionService } from '@nelyx/skia-native/scene-composition';
import { createSemanticsGeometryService } from '@nelyx/skia-native/semantics-geometry';
import type { Skia } from '@nelyx/skia-native/skia/types/Skia';
import type {
  NativeAssetBackend,
  NativeAssetConfiguration,
  LoadedNativeAssets,
} from './native-assets.ts';
import { createNativeImageBackend } from './native-images.ts';
import { NativeImageMemory } from './image-memory.ts';
import { OwnedDisposal } from './owned-disposal.ts';

export type NativeEnginePorts = Pick<
  BackendServices<NativeTextLayoutService>,
  | 'renderer'
  | 'text'
  | 'paths'
  | 'pictures'
  | 'rasterization'
  | 'images'
  | 'inputGeometry'
  | 'sceneComposition'
  | 'semanticsGeometry'
>;
export interface NativeEngineOptions {
  readonly latestInputAdmission?: boolean;
  readonly inputBatches?: boolean;
  readonly api: Skia;
  /** Ownership transfers here; the renderer retires this same context. */
  readonly context: NelyxGraphiteContext;
  readonly owner: ViewOwner;
  /** @internal Unadopted geometry candidate. Production keeps the TS path. */
  readonly inputGeometry?: boolean | 'retained';
  readonly sceneComposition?: boolean;
  readonly semanticsGeometry?: boolean;
  /** @internal Independently measured scene candidates. */
  readonly sceneBatch?: 'path' | 'paint' | 'all';
  readonly retirement?: GraphiteRetirementClock;
  readonly assets: LoadedNativeAssets;
  readonly configuration: NativeAssetConfiguration;
  resolveSource: NativeAssetBackend['resolveSource'];
  assertOpen(): void;
}
export type NativeEngineServices = ReturnType<typeof createNativeEngineServices>;

/** One native resource composition for an AppSession. Bootstrap owns the
 * services it creates; this owner drains their renderer before returning the
 * shared programs. Hosts provide surface/clock/input, with no duplicate engine
 * resource maps or RN-shaped native service registry. */
export function createNativeEngineServices(options: NativeEngineOptions) {
  const { api, context, owner, assets, configuration } = options;
  const images = new Map(assets.images),
    memory = new NativeImageMemory(),
    programs = createRuntimeShaderCache(api);
  let text: NativeTextLayoutService | undefined,
    renderer: GraphiteRenderer | undefined,
    closed = false,
    inputMailbox: { close(): void } | undefined,
    unavailableService: string | undefined;
  const ensure = () => {
    if (closed) throw new Error('Native engine owner closed');
    if (unavailableService)
      throw new Error('Requested C++ capability is unavailable: ' + unavailableService);
    options.assertOpen();
  };
  const image = (key: string) => {
    const value = images.get(key);
    if (!value) throw new Error('Stale native engine image');
    return value;
  };
  const paragraph = (key: string) => {
    if (!text) throw new Error('Native paragraph owner is not initialized');
    return text.paintResource(key);
  };
  const resources: GraphiteResources = {
    ...(options.sceneBatch ? { sceneBatch: options.sceneBatch } : {}),
    nativeDisplayLists: true,
    runtimePrograms: programs,
    image,
    paragraph,
    picture: (key) => pictures.picture(key),
  };
  const pictures = createFramePictureBackend(api, resources, () => context.nelyxIdentity());
  const inputGeometry =
    options.inputGeometry === 'retained'
      ? createRetainedInputGeometryService(api, owner, ensure)
      : options.inputGeometry
        ? createInputGeometryService(api, owner, ensure)
        : undefined;
  const sceneComposition = options.sceneComposition
    ? createSceneCompositionService(api, owner, ensure)
    : undefined;
  const semanticsGeometry = options.semanticsGeometry
    ? createSemanticsGeometryService(api, owner, ensure)
    : undefined;
  unavailableService =
    options.inputGeometry === 'retained' && !api.nelyxReportInputGeometryStatus
      ? 'retained-input-geometry-status'
      : options.inputGeometry && !inputGeometry
        ? 'input-geometry'
        : options.sceneComposition && !sceneComposition
          ? 'scene-composition'
          : options.semanticsGeometry && !semanticsGeometry
            ? 'semantics-geometry'
            : undefined;
  const services: NativeEnginePorts = {
    ...(semanticsGeometry ? { semanticsGeometry } : {}),
    ...(sceneComposition ? { sceneComposition } : {}),
    ...(inputGeometry ? { inputGeometry } : {}),
    renderer: {
      create() {
        ensure();
        if (renderer) throw new Error('Native renderer already has an owner');
        api.nelyxReportInputGeometryStatus?.(
          JSON.stringify({
            schema: 1,
            kind: 'request',
            ownerGeneration: owner.generation,
            inputGeometry:
              options.inputGeometry === 'retained'
                ? 'retained'
                : options.inputGeometry
                  ? 'snapshot'
                  : 'ts',
            sceneComposition: !!options.sceneComposition,
            semanticsGeometry: !!options.semanticsGeometry,
            sceneBatch: options.sceneBatch ?? 'none',
          }),
        );
        renderer = new GraphiteRenderer(api, () => context, owner, resources, options.retirement);
        renderer.latestInputAdmission = options.latestInputAdmission === true;
        if (options.inputBatches) {
          const host = (
            globalThis as {
              NelyxWindowsHost?: {
                inputMailbox?(operation: number, id: number, pending: number): number | undefined;
              };
            }
          ).NelyxWindowsHost;
          if (!host?.inputMailbox)
            throw new Error('Requested shared native input accounting missing');
          const port = host.inputMailbox.bind(host),
            id = port(0, 0, 0);
          if (!Number.isSafeInteger(id) || id! < 1)
            throw new Error('Invalid native input mailbox owner');
          renderer.setQueuedInputCount = (count) => {
            port(1, id!, count);
          };
          inputMailbox = {
            close() {
              port(2, id!, 0);
            },
          };
          renderer.retireInput = () => {
            inputMailbox?.close();
            inputMailbox = undefined;
          };
        }
        if (renderer.latestInputAdmission) {
          const host = (
            globalThis as {
              NelyxWindowsHost?: {
                inputAdmissionVersion?: number;
                captureInputWatermark?(): number;
                hasPendingInputThrough?(watermark: number): boolean;
              };
            }
          ).NelyxWindowsHost;
          if (
            host?.inputAdmissionVersion !== 1 ||
            !host.captureInputWatermark ||
            !host.hasPendingInputThrough
          )
            throw new Error('Requested native input watermark capability missing');
          renderer.captureInputWatermark = () => host.captureInputWatermark!();
          renderer.hasUndeliveredInput = (watermark) => host.hasPendingInputThrough!(watermark);
        }
        return renderer;
      },
    },
    text: {
      create(registry) {
        ensure();
        if (text) throw new Error('Native text service already has an owner');
        return (text = new NativeTextLayoutService(
          api,
          registry,
          owner,
          assets.fonts,
          image,
          programs,
        ));
      },
    },
    paths: createPathQueries(api, ensure),
    pictures: {
      create(registry) {
        ensure();
        return new FramePictureService(registry, pictures, owner);
      },
    },
    rasterization: {
      create(registry) {
        ensure();
        return new RasterizationService(
          registry,
          createRasterizationBackend(
            api,
            images,
            resources,
            owner,
            memory,
            ensure,
            (resource) => registry.isRetained(resource),
            () => registry.allocateId(`${owner.id}:${owner.generation}:raster`),
          ),
        );
      },
    },
    images: {
      create(registry, clock, time) {
        ensure();
        return new ImageService(
          registry,
          createNativeImageBackend(
            api,
            (source) => options.resolveSource(source),
            images,
            configuration,
            owner,
            memory,
            () => registry.allocateId(`${owner.id}:${owner.generation}:image`),
          ),
          clock,
          time,
        );
      },
    },
  };
  const retirement = new OwnedDisposal([
    { name: 'semantics-geometry', run: () => semanticsGeometry?.dispose() },
    { name: 'scene-composition', run: () => sceneComposition?.dispose() },
    { name: 'input-geometry', run: () => inputGeometry?.dispose() },
    { name: 'renderer', run: () => renderer?.dispose() },
    {
      name: 'input-mailbox',
      run: () => {
        inputMailbox?.close();
        inputMailbox = undefined;
      },
    },
    // Startup can fail before bootstrap obtains a renderer. Its unused context
    // still has an owner and must not depend on VM finalizers for retirement.
    {
      name: 'unused-context-close',
      run: () => {
        if (!renderer) context.nelyxClose();
      },
    },
    {
      name: 'unused-context-reset',
      run: () => {
        if (!renderer) context.nelyxReset();
      },
    },
    {
      name: 'unused-context-wrapper',
      run: () => {
        if (!renderer) context.dispose();
      },
    },
    { name: 'runtime-programs', run: () => programs.dispose() },
  ]);
  return Object.freeze({
    services,
    get hasPendingSubmissions() {
      return renderer?.hasPendingSubmissions ?? false;
    },
    pollNotifications: () => renderer?.pollNotifications() ?? 0,
    setVisible(value: boolean) {
      if (!closed) renderer?.setVisible(value);
    },
    dispose(): Promise<void> {
      closed = true;
      return retirement.dispose();
    },
  });
}
