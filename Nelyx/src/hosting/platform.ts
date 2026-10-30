import type { FrameClock } from '../foundation/clock.ts';
import type { Disposable } from '../foundation/disposable.ts';
import type { RendererCapabilities, ResourceId, TextLayoutService, ViewMetrics, ViewOwner } from '../ui/types.ts';
import { AppSession } from './runtime.ts';
import type { ApplicationDefinition, Renderer, ViewRuntime } from './runtime.ts';
import type { ResourceRegistry } from './resources.ts';

export type PlatformId = 'web' | 'ios' | 'android' | 'windows' | 'macos' | 'linux';
export type RuntimeId = 'browser' | 'hermes' | 'v8' | 'jsc';
export type HostKind = 'react-dom' | 'fabric' | 'native-hermes';
export type ReactNativePlatform = Exclude<PlatformId, 'web'>;
export type RendererKind = 'skia-graphite' | 'skia-ganesh';
export type GpuBackend = 'webgl2' | 'vulkan' | 'metal' | 'd3d12' | 'opengl';
export interface BackendIdentity {
  readonly target: PlatformId;
  readonly runtime: RuntimeId;
  readonly host: HostKind;
  readonly renderer: RendererKind;
  readonly gpuBackend: GpuBackend;
  readonly gpuImplementation: 'dawn' | 'browser-webgl2' | 'native-opengl' | 'native-vulkan';
  readonly profile: string;
}
export interface PlatformContext<TText extends TextLayoutService = TextLayoutService> {
  readonly session: AppSession;
  readonly text: TText;
  readonly image: ResourceId;
  readonly font: ResourceId;
  readonly metrics: ViewMetrics;
}
/** Implemented by SDK backends; applications consume the platform entry points. */
export interface PlatformBackend<TText extends TextLayoutService = TextLayoutService> {
  readonly platform: PlatformId;
  readonly owner: ViewOwner;
  readonly metrics: ViewMetrics;
  readonly clock: FrameClock;
  readonly renderer: Renderer;
  readonly image: ResourceId;
  readonly font: ResourceId;
  createTextService(resources: ResourceRegistry): TText;
}
export class PlatformApplication<TText extends TextLayoutService = TextLayoutService> implements Disposable {
  constructor(readonly platform: PlatformId, readonly session: AppSession, readonly view: ViewRuntime, readonly text: TText, readonly capabilities: RendererCapabilities) {}
  dispose(): Promise<void> { return this.session.dispose(); }
}
/** The SDK owns session creation, resource registration, attachment and shutdown. */
export async function connectPlatformApplication<TText extends TextLayoutService>(
  definition: ApplicationDefinition,
  backend: PlatformBackend<TText>,
  initialize?: (context: PlatformContext<TText>) => void,
): Promise<PlatformApplication<TText>> {
  const session = new AppSession(definition, backend.clock, []);
  let attached = false;
  try {
    session.resources.register({ ...backend.image, kind: 'image' }, () => {});
    session.resources.register({ ...backend.font, kind: 'font' }, () => {});
    const text = backend.createTextService(session.resources);
    initialize?.({ session, text, image: backend.image, font: backend.font, metrics: backend.metrics });
    const view = session.attach({ ...backend.owner, metrics: backend.metrics, renderer: backend.renderer, ownership: 'owned' });
    attached = true;
    return new PlatformApplication(backend.platform, session, view, text, backend.renderer.capabilities);
  } catch (error) {
    const failures: unknown[] = [error];
    try { await session.dispose(); } catch (failure) { failures.push(failure); }
    if (!attached) try { await backend.renderer.dispose(); } catch (failure) { failures.push(failure); }
    if (failures.length > 1) throw new AggregateError(failures, 'platform initialization and cleanup failed');
    throw error;
  }
}
