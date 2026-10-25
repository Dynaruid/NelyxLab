// SPDX-License-Identifier: BSD-3-Clause
import type {BackendServices} from '@nelyx/core/hosting/services';
import type {ViewOwner} from '@nelyx/core/ui/types';
import {FramePictureService} from '@nelyx/core/hosting/pictures';
import {RasterizationService} from '@nelyx/core/hosting/rasterization';
import {ImageService} from '@nelyx/core/hosting/images';
import {GraphiteRenderer,createPathQueries,createRuntimeShaderCache} from '@nelyx/skia-native/renderer';
import type {NelyxGraphiteContext} from '@nelyx/skia-native/renderer';
import {NativeTextLayoutService} from '@nelyx/skia-native/text';
import {createFramePictureBackend} from '@nelyx/skia-native/pictures';
import {createRasterizationBackend} from '@nelyx/skia-native/rasterization';
import type {Skia} from '@nelyx/skia-native/skia/types/Skia';
import type {NativeAssetBackend,NativeAssetConfiguration,LoadedNativeAssets} from './native-assets.ts';
import {createNativeImageBackend} from './native-images.ts';
import {NativeImageMemory} from './image-memory.ts';
import {OwnedDisposal} from './owned-disposal.ts';

export type NativeEnginePorts=Pick<BackendServices<NativeTextLayoutService>,'renderer'|'text'|'paths'|'pictures'|'rasterization'|'images'>;
export interface NativeEngineOptions {
  readonly api:Skia;
  /** Ownership transfers here; the renderer retires this same context. */
  readonly context:NelyxGraphiteContext;
  readonly owner:ViewOwner;
  readonly assets:LoadedNativeAssets;
  readonly configuration:NativeAssetConfiguration;
  resolveSource:NativeAssetBackend['resolveSource'];
  assertOpen():void;
}
export type NativeEngineServices=ReturnType<typeof createNativeEngineServices>;

/** One native resource composition for an AppSession. Bootstrap owns the
 * services it creates; this owner drains their renderer before returning the
 * shared programs. Hosts provide surface/clock/input, with no duplicate engine
 * resource maps or RN-shaped native service registry. */
export function createNativeEngineServices(options:NativeEngineOptions){
  const {api,context,owner,assets,configuration}=options;
  const images=new Map(assets.images),memory=new NativeImageMemory(),programs=createRuntimeShaderCache(api);
  let text:NativeTextLayoutService|undefined,renderer:GraphiteRenderer|undefined,closed=false;
  const ensure=()=>{if(closed)throw new Error('Native engine owner closed');options.assertOpen();};
  const image=(key:string)=>{const value=images.get(key);if(!value)throw new Error('Stale native engine image');return value;};
  const paragraph=(key:string)=>{if(!text)throw new Error('Native paragraph owner is not initialized');return text.paintResource(key);};
  const pictures=createFramePictureBackend(api,{runtimePrograms:programs,image,paragraph,picture:key=>pictures.picture(key)},()=>context.nelyxIdentity());
  const resources={nativeDisplayLists:true,runtimePrograms:programs,image,paragraph,picture:(key:string)=>pictures.picture(key)};
  const services:NativeEnginePorts={
    renderer:{create(){ensure();if(renderer)throw new Error('Native renderer already has an owner');return renderer=new GraphiteRenderer(api,()=>context,owner,resources);}},
    text:{create(registry){ensure();if(text)throw new Error('Native text service already has an owner');return text=new NativeTextLayoutService(api,registry,owner,assets.fonts,image,programs);}},
    paths:createPathQueries(api,ensure),
    pictures:{create(registry){ensure();return new FramePictureService(registry,pictures,owner);}},
    rasterization:{create(registry){ensure();return new RasterizationService(registry,createRasterizationBackend(api,images,resources,owner,memory,ensure,resource=>registry.isRetained(resource),()=>registry.allocateId(`${owner.id}:${owner.generation}:raster`)));}},
    images:{create(registry,clock,time){ensure();return new ImageService(registry,createNativeImageBackend(api,source=>options.resolveSource(source),images,configuration,owner,memory,()=>registry.allocateId(`${owner.id}:${owner.generation}:image`)),clock,time);}},
  };
  const retirement=new OwnedDisposal([
    {name:'renderer',run:()=>renderer?.dispose()},
    // Startup can fail before bootstrap obtains a renderer. Its unused context
    // still has an owner and must not depend on VM finalizers for retirement.
    {name:'unused-context-close',run:()=>{if(!renderer)context.nelyxClose();}},
    {name:'unused-context-reset',run:()=>{if(!renderer)context.nelyxReset();}},
    {name:'unused-context-wrapper',run:()=>{if(!renderer)context.dispose();}},
    {name:'runtime-programs',run:()=>programs.dispose()},
  ]);
  return Object.freeze({services,
    get hasPendingSubmissions(){return renderer?.hasPendingSubmissions??false;},
    pollNotifications:()=>renderer?.pollNotifications()??0,
    setVisible(value:boolean){if(!closed)renderer?.setVisible(value);},
    dispose():Promise<void>{closed=true;return retirement.dispose();},
  });
}
