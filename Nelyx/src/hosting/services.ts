import type { Clock, FrameClock } from '../foundation/clock.ts';
import type { Disposable } from '../foundation/disposable.ts';
import type { AssetRef } from '../foundation/assets.ts';
import type { Renderer, ViewRuntime,ViewInputObservation } from './runtime.ts';
import type { ResourceRegistry } from './resources.ts';
import type { BackendIdentity } from './platform.ts';
import type { ResourceDescriptor, TextLayoutService, ViewMetrics, ViewOwner } from '../ui/types.ts';
import type { EditingHost, SemanticsHost } from './interaction.ts';
import type {FoundationPlatformEnvironment} from '../foundation/platform.ts';
import type {PlatformMessagePort} from './platform-messages.ts';
import type {ImageService,ImageTiming} from './images.ts';

/** Hosts publish complete generations; callbacks must stop when the binding is disposed. */
export type SurfaceEvent =
  | { readonly kind: 'metrics'; readonly metrics: ViewMetrics }
  | { readonly kind: 'visibility'; readonly visible: boolean }
  | { readonly kind: 'context-lost' | 'close' };
export interface SurfaceHost extends Disposable {
  readonly owner: ViewOwner;
  readMetrics(): ViewMetrics;
  attach(view: ViewRuntime, notify: (event: SurfaceEvent) => void): Disposable;
}
export interface ResolvedAsset {
  readonly descriptor: ResourceDescriptor;
  /** The registry calls retire only after producer and frame leases are returned. */
  retire(): void;
}
export interface AssetService extends Disposable {
  resolve(declarations: readonly AssetRef[]): Promise<readonly ResolvedAsset[]>;
}
export interface RendererFactory { create(surface: SurfaceHost, resources: ResourceRegistry): Renderer | Promise<Renderer> }
export interface TextServiceFactory<TText extends TextLayoutService = TextLayoutService> {
  create(resources: ResourceRegistry): TText;
}
export interface BackendServices<TText extends TextLayoutService = TextLayoutService> {
  readonly observeInput?:(event:ViewInputObservation)=>void;
  readonly nativeSelectionContextMenu?:import('./interaction.ts').NativeSelectionContextMenuHost;
  readonly pictures?:{create(resources:ResourceRegistry):import('./pictures.ts').FramePictureService};
  readonly rasterization?:{create(resources:ResourceRegistry):import('./rasterization.ts').RasterizationService};
  readonly paths?:import('../ui/path.ts').PathQueryService;
  readonly images?:{create(resources:ResourceRegistry,clock:FrameClock,time:ImageTiming):ImageService};
  /** Built-in OS plugins opt in; a custom byte-only transport can omit this. */
  readonly initializePlatformServices?:boolean;
  /** Ownership transfers to SDK bootstrap, which stops ingress before draining it. */
  readonly platformMessages?:PlatformMessagePort;
  /** Integer engine-facing identity for this surface within its app messenger. */
  readonly platformViewId?:number;
  /** Opt in only for the single default messenger owner of this JS realm. */
  readonly useDefaultBinaryMessenger?:boolean;
  readonly foundationPlatform?:FoundationPlatformEnvironment;
  readonly reportError?:(error:unknown)=>void;
  readonly identity: BackendIdentity;
  readonly surface: SurfaceHost;
  readonly clock: FrameClock;
  readonly assets: AssetService;
  readonly renderer: RendererFactory;
  readonly text: TextServiceFactory<TText>;
  readonly editing: EditingHost;
  readonly semantics: SemanticsHost;
}
