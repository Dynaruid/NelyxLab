import type {DefaultBinaryMessenger} from '@nelyx/core/services/binary-messenger';
import type {FramePictureService} from '@nelyx/core/hosting/pictures';
import type {RasterizationService} from '@nelyx/core/hosting/rasterization';
import { AppSession } from '@nelyx/core/hosting/runtime';
import type { ApplicationDefinition } from '@nelyx/core/hosting/runtime';
import { PlatformApplication } from '@nelyx/core/hosting/platform';
import type { PlatformContext } from '@nelyx/core/hosting/platform';
import type { BackendServices, ResolvedAsset } from '@nelyx/core/hosting/services';
import type { Disposable,DisposalStep } from '@nelyx/core/foundation/disposable';
import {DisposalSequence,PendingDisposalError} from '@nelyx/core/foundation/disposable';
import type { EditingCapabilities } from '@nelyx/core/hosting/interaction';
import type { Renderer, ViewRuntime } from '@nelyx/core/hosting/runtime';
import type { ResourceId, TextLayoutService } from '@nelyx/core/ui/types';
import {ErrorToConsoleDumper} from '@nelyx/core/foundation/flutter-error';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {PlatformMessageConnection} from './platform-messages.ts';
import type {ServicesBinding} from '@nelyx/core/services/binding';
import {PaintingBinding} from '@nelyx/core/framework/painting/binding';
import {PlatformDispatcher} from '@nelyx/core/ui/platform-dispatcher';
import type {PlatformViewRegistration} from '@nelyx/core/ui/platform-dispatcher';
import {PlatformMessageWorkerOwner} from './worker-messages.ts';
import type {ImageService} from '@nelyx/core/hosting/images';

// A failed native drain still owns resources, callbacks and host dependencies.
const failedOwners = new Set<unknown>();
async function disposeAll(values: readonly Disposable[], errors: unknown[]): Promise<void> {
  for (const value of new Set(values)) try { await value.dispose(); } catch (error) { errors.push(error); }
}
async function drainMessages(messages:PlatformMessageConnection|undefined,errors:unknown[]):Promise<void>{try{await messages?.dispose();}catch(error){if(!messages?.retired)throw error;errors.push(error);}}
export class ComposedApplication<TText extends TextLayoutService = TextLayoutService> extends PlatformApplication<TText> {
  private closing: Promise<void> | undefined;
  private shutdown:DisposalSequence|undefined;
  get shutdownStatus(){return this.shutdown?.status??Object.freeze({state:this.closing?'closing' as const:'open' as const,phase:null,recoverable:false});}
  /** Resume only the explicit completion callback supplied by a blocked owner. */
  retryDispose():Promise<void>{return this.resumeShutdown();}
  private resumeShutdown():Promise<void>{if(!this.shutdown)return this.closing??this.dispose();if(this.shutdown.status.state==='closing'||this.shutdown.status.state==='closed')return this.closing!;if(!this.shutdown.status.recoverable)return Promise.reject(new Error('No explicitly recoverable application shutdown is pending'));return this.closing=this.shutdown.retryDispose().catch(error=>{if(error instanceof PendingDisposalError)throw new PendingDisposalError([error],()=>this.resumeShutdown());throw error;});}
  private readonly stopErrors:unknown[]=[];
  get binaryMessenger():DefaultBinaryMessenger|undefined{return this.messages?.binaryMessenger;}
  get platformServices():ServicesBinding|undefined{return this.osServices;}
  get platformView(){return this.platformViewRegistration?.view;}
  private workers:PlatformMessageWorkerOwner|undefined;
  /** Transfer each endpoint to a background worker together with this owner's token. */
  get workerDispatcher():PlatformMessageWorkerOwner{if(!this.messages||this.messages.retired)throw new Error('An active platform messenger is required for workers');return this.workers??=new PlatformMessageWorkerOwner(this.messages.binaryMessenger);}
  get identity() { return this.services.identity; }
  get hostCapabilities(): Readonly<{editing: EditingCapabilities; semantics: BackendServices['semantics']['capability']}> { return Object.freeze({ editing: this.services.editing.capabilities, semantics: this.services.semantics.capability }); }
  constructor(
    session: AppSession, view: ViewRuntime, text: TText, renderer: Renderer,
    readonly services: BackendServices<TText>, readonly assets: ReadonlyMap<string, ResourceId>,
    private readonly stop: () => void, private readonly binding: Disposable, private readonly startup: Disposable | undefined,
    private readonly messages:PlatformMessageConnection|undefined,
    private readonly osServices:ServicesBinding|undefined=undefined,
    private readonly imageOwner:ImageService|undefined=undefined,
    private readonly rasterOwner:RasterizationService|undefined=undefined,
    private readonly pictureOwner:FramePictureService|undefined=undefined,
    private readonly platformViewRegistration:PlatformViewRegistration|undefined=undefined,
  ) { super(services.identity.target, session, view, text, renderer.capabilities); }
  override dispose(): Promise<void> {
    if (!this.closing) {let resolve!:()=>void,reject!:(error:unknown)=>void;this.closing=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});for(const stop of [()=>this.stop(),()=>this.platformViewRegistration?.dispose(),()=>this.services.nativeSelectionContextMenu?.stop(),()=>this.session.beginClose(),()=>this.imageOwner?.stop(),()=>this.rasterOwner?.stop(),()=>this.pictureOwner?.stop(),()=>this.messages?.stop()])try{stop();}catch(error){this.stopErrors.push(error);}void Promise.resolve().then(()=>this.close()).then(resolve,reject);}
    return this.closing;
  }
  private async close(): Promise<void> {
    const errors:unknown[]=[...this.stopErrors];
    const checked=(run:()=>void|Promise<void>,message:string)=>async()=>{try{await run();}catch(error){failedOwners.add(this);if(error instanceof PendingDisposalError)throw new PendingDisposalError([...errors,error],error.retry);throw new AggregateError([...errors,error],message);}};
    const bestEffort=(value:Disposable)=>async()=>{try{await value.dispose();}catch(error){if(error instanceof PendingDisposalError){failedOwners.add(this);throw error;}errors.push(error);}};
    const steps:DisposalStep[]=[
      ...[...new Set([this.binding,...(this.startup?[this.startup]:[])])].map((value,index)=>({name:'binding-'+index,run:bestEffort(value)})),
      {name:'pictures',run:checked(()=>this.pictureOwner?.dispose(),'picture drain failed; backend services retained')},
      {name:'raster',run:checked(()=>this.rasterOwner?.dispose(),'image decoder drain failed; backend services retained')},
      {name:'images',run:checked(()=>this.imageOwner?.dispose(),'image decoder drain failed; backend services retained')},
      {name:'messages',run:checked(()=>drainMessages(this.messages,errors),'native drain failed; backend services retained')},
      ...(this.workers?[{name:'workers',run:bestEffort(this.workers)}]:[]),
      {name:'session',run:checked(()=>this.session.dispose(),'native drain failed; backend services retained')},
      ...[...new Set([...(this.services.nativeSelectionContextMenu?[this.services.nativeSelectionContextMenu]:[]),this.services.semantics,this.services.editing,this.services.assets,this.services.surface])].map((value,index)=>({name:'backend-'+index,run:bestEffort(value)})),
      {name:'completion',run:()=>{if(errors.length){failedOwners.add(this);throw new AggregateError(errors,'application shutdown failed');}failedOwners.delete(this);}},
    ];
    this.shutdown=new DisposalSequence(steps);try{await this.shutdown.dispose();}catch(error){if(error instanceof PendingDisposalError)throw new PendingDisposalError([error],()=>this.resumeShutdown());throw error;}
  }

}
/** SDK composition: resolve -> startup -> attach; close stops callbacks before drain. */
export async function bootstrapApplication<TText extends TextLayoutService>(
  definition: ApplicationDefinition, services: BackendServices<TText>,
  initialize?: (context: PlatformContext<TText>) => void,
): Promise<ComposedApplication<TText>> {
  ErrorToConsoleDumper.useWebConsole=services.identity.target==='web';
  FoundationPlatform.configure(services.foundationPlatform??(services.identity.target==='web'?{kind:'web',operatingSystem:'unknown'}:{kind:'native',operatingSystem:services.identity.target}));
  const session = new AppSession(definition, services.clock, []);
  const registered = new Set<ResolvedAsset>();
  let resolved: readonly ResolvedAsset[] = [], renderer: Renderer | undefined, view: ViewRuntime | undefined;
  let startup: void | Disposable = undefined, binding: Disposable | undefined, alive = true;
  let application: ComposedApplication<TText> | undefined, closeRequested = false;
  let messages:PlatformMessageConnection|undefined;
  let platformViewRegistration:PlatformViewRegistration|undefined;
  let osServices:ServicesBinding|undefined;
  let imageOwner:ImageService|undefined;
  let rasterOwner:RasterizationService|undefined;
  let pictureOwner:FramePictureService|undefined;
  try {
    if(services.useDefaultBinaryMessenger&&!services.platformMessages)throw new Error('A default binary messenger requires a platform message port');
    if(services.platformMessages){messages=new PlatformMessageConnection(services.platformMessages,{useAsDefault:services.useDefaultBinaryMessenger??false});messages.attach();}
    if(messages)platformViewRegistration=PlatformDispatcher.forMessenger(messages.binaryMessenger).registerViewIdentity(services.platformViewId??0,{implicit:true,isLive:()=>alive});
    if(services.initializePlatformServices){if(!messages)throw new Error('OS services require a platform message port');osServices=new PaintingBinding(messages.binaryMessenger);await osServices.ready;}
    const declaredIds = new Set<string>();
    for (const declared of definition.assets ?? []) {
      if (!declared.id || declaredIds.has(declared.id) || !/^[a-f0-9]{64}$/.test(declared.sha256) || !['image', 'font'].includes(declared.kind))
        throw new Error(`Invalid or duplicate declared asset: ${declared.id}`);
      declaredIds.add(declared.id);
    }
    resolved = await services.assets.resolve(definition.assets ?? []);
    const assets = new Map<string, ResourceId>();
    for (const asset of resolved) {
      if (assets.has(asset.descriptor.id)) throw new Error(`Duplicate asset: ${asset.descriptor.id}`);
      session.resources.register(asset.descriptor, () => asset.retire()); registered.add(asset);
      const resource=session.resources.captureResource(asset.descriptor);
      assets.set(asset.descriptor.id,resource);
    }
    for (const declared of definition.assets ?? []) {
      const match = resolved.find(asset => asset.descriptor.id === declared.id);
      if (!match || match.descriptor.kind !== declared.kind || match.descriptor.asset?.sha256 !== declared.sha256)
        throw new Error(`Unresolved or mismatched declared asset: ${declared.id}`);
    }
    renderer = await services.renderer.create(services.surface, session.resources);
    const text = services.text.create(session.resources);
    pictureOwner=services.pictures?.create(session.resources);
    rasterOwner=services.rasterization?.create(session.resources);
    imageOwner=services.images?.create(session.resources,services.clock,{now:()=>performance.now(),scheduleTimer(callback,milliseconds){const id=setTimeout(callback,milliseconds);return {dispose(){clearTimeout(id);}};}});
    if(imageOwner&&osServices instanceof PaintingBinding)osServices.registerImageService(imageOwner);
    startup = await definition.startup?.({ resources: session.resources, assets, text, metrics: services.surface.readMetrics(), owner: services.surface.owner, editing: services.editing, semantics: services.semantics,...(services.nativeSelectionContextMenu?{nativeSelectionContextMenu:services.nativeSelectionContextMenu}:{}),...(rasterOwner?{rasterizer:rasterOwner}:{}),...(pictureOwner?{pictures:pictureOwner}:{}),...(services.paths?{paths:services.paths}:{}),...(imageOwner?{images:imageOwner}:{}),...(platformViewRegistration?{platformView:platformViewRegistration.view}:{}),...(messages?{binaryMessenger:messages.binaryMessenger}:{}),...(osServices?{platformServices:osServices}:{}) });
    if (initialize) {
      const image = assets.get(resolved.find(asset => asset.descriptor.kind === 'image')?.descriptor.id ?? '');
      const font = assets.get(resolved.find(asset => asset.descriptor.kind === 'font')?.descriptor.id ?? '');
      if (!image || !font) throw new Error('Legacy initialize requires an image and a font; use ApplicationDefinition.startup for arbitrary assets');
      initialize({ session, text, image, font, metrics: services.surface.readMetrics() });
    }
    view = session.attach({ ...services.surface.owner, metrics: services.surface.readMetrics(), renderer, ownership: 'owned',
      onError:error=>{void application?.dispose().catch(()=>{});if(services.reportError)services.reportError(error);else throw error;},
      services:{assets,text,clock:{now:()=>performance.now()},editing:services.editing,semantics:services.semantics,...(services.nativeSelectionContextMenu?{nativeSelectionContextMenu:services.nativeSelectionContextMenu}:{}),...(rasterOwner?{rasterizer:rasterOwner}:{}),...(pictureOwner?{pictures:pictureOwner}:{}),...(services.paths?{paths:services.paths}:{}),...(imageOwner?{images:imageOwner}:{}),...(platformViewRegistration?{platformView:platformViewRegistration.view}:{}),...(messages?{binaryMessenger:messages.binaryMessenger}:{}),...(osServices?{platformServices:osServices}:{})} });
    const attached = view;
    binding = services.surface.attach(view, event => {
      if (!alive) return;
      if (event.kind === 'metrics') attached.updateMetrics(event.metrics);
      else if (event.kind === 'visibility') { attached.setVisible(event.visible); if(event.visible)attached.requestFrame(); }
      else if (event.kind === 'close' || event.kind === 'context-lost') {
        closeRequested = true;
        if (application) void application.dispose().catch(() => {}); // dispose retains a rejected promise and its native owners.
        else attached.beginClose();
      }
    });
    application = new ComposedApplication(session, view, text, renderer, services, assets, () => { alive = false; }, binding, startup || undefined,messages,osServices,imageOwner,rasterOwner,pictureOwner,platformViewRegistration);
    if (closeRequested) await application.dispose();
    return application;
  } catch (error) {
    alive = false;
    const errors: unknown[] = [error];
    for(const stop of [()=>platformViewRegistration?.dispose(),()=>services.nativeSelectionContextMenu?.stop(),()=>session.beginClose(),()=>imageOwner?.stop(),()=>rasterOwner?.stop(),()=>pictureOwner?.stop(),()=>messages?.stop()])try{stop();}catch(failure){errors.push(failure);}
    if (application) throw error; // Ownership already transferred, including a failed early close.
    await disposeAll([...(binding ? [binding] : []), ...(startup ? [startup] : [])], errors);
    try {pictureOwner?.dispose();await rasterOwner?.dispose();await imageOwner?.dispose();await drainMessages(messages,errors); if (!view && renderer) await renderer.dispose(); await session.dispose(); }
    catch (failure) { failedOwners.add({ session, services, resolved, renderer, startup, imageOwner, rasterOwner, pictureOwner, messages, osServices }); throw new AggregateError([...errors, failure], 'initialization drain failed; services retained'); }
    for (const asset of resolved) if (!registered.has(asset)) try { asset.retire(); } catch (failure) { errors.push(failure); }
    await disposeAll([...(services.nativeSelectionContextMenu?[services.nativeSelectionContextMenu]:[]), services.semantics, services.editing, services.assets, services.surface], errors);
    if (errors.length > 1) throw new AggregateError(errors, 'application initialization and cleanup failed');
    throw error;
  }
}
