import type {AssetRef} from '@nelyx/core/foundation/assets';
import {FramePictureService} from '@nelyx/core/hosting/pictures';
import {RasterizationService} from '@nelyx/core/hosting/rasterization';
import type {ApplicationDefinition,ViewRuntime} from '@nelyx/core/hosting/runtime';
import type {BackendServices,SurfaceEvent} from '@nelyx/core/hosting/services';
import type {BackendIdentity} from '@nelyx/core/hosting/platform';
import type {ViewMetrics,ViewOwner} from '@nelyx/core/ui/types';
import type {WebSkiaLibrary} from '@nelyx/skia-web/library';
import {ManifestAssetService} from '../../runtime/assets.ts';
import type {ResolvedAppAsset as AppAsset} from '../../runtime/config.ts';
import {createDomInteraction} from './interaction.ts';
import {BrowserMouseCursor} from './mouse-cursor.ts';
import {BrowserSelectionContextMenu} from './selection-context-menu.ts';
import {sha256} from './canvaskit.ts';
import {bindCanvasInput} from './input.ts';
import {createBrowserEnvironment} from './environment.ts';
import {getBrowserPlatformEnvironment} from './platform.ts';
import {ImageService} from '@nelyx/core/hosting/images';
import {readImageUrl,encodeImageAssetManifest} from '../../runtime/image-loading.ts';
type ResolvedWebDefinition={-readonly [Key in keyof ApplicationDefinition]:ApplicationDefinition[Key]}&{assets:readonly AssetRef[]};
export function createWebServices(library:WebSkiaLibrary,canvas:HTMLCanvasElement,input:HTMLInputElement,button:HTMLButtonElement,identity:BackendIdentity,owner:ViewOwner,manifest:readonly AppAsset[],root:URL,definition:ApplicationDefinition):{services:BackendServices;cursor:BrowserMouseCursor;selectionContextMenu:BrowserSelectionContextMenu;definition:ResolvedWebDefinition}{
  if(manifest.length>64||!['http:','https:'].includes(root.protocol)||!root.href.endsWith('/'))throw new Error('Web asset root/count');
  const cursor=new BrowserMouseCursor(canvas),interaction=createDomInteraction(input,button,cursor,()=>({bounds:canvas.getBoundingClientRect(),width:canvas.clientWidth,height:canvas.clientHeight,generation:viewport}),definition.accessibilityEnabled!==false),cssFonts=new Set<FontFace>(),fontSet=document.fonts as FontFaceSet&{add(face:FontFace):void;delete(face:FontFace):boolean};let totalAssetBytes=0;let closed=false,notify:((event:SurfaceEvent)=>void)|undefined,viewport=1,renderer=1,surface=1,context=1;
  const environment=createBrowserEnvironment(canvas);
  let nativeSelectionContextMenu:BrowserSelectionContextMenu|undefined;
  try {
  const selectionContextMenu=new BrowserSelectionContextMenu(canvas,owner,cursor);nativeSelectionContextMenu=selectionContextMenu;
  const frames=new Set<number>();
  function metrics():ViewMetrics {const width=canvas.clientWidth,height=canvas.clientHeight,scale=window.devicePixelRatio||1;return Object.freeze({logicalWidth:width,logicalHeight:height,physicalWidth:Math.round(width*scale),physicalHeight:Math.round(height*scale),scale,viewportGeneration:viewport,rendererGeneration:renderer,nativeContextGeneration:context,nativeSurfaceGeneration:surface,environment:environment.read()});}
  let current=metrics(),observer:ResizeObserver|undefined,media:MediaQueryList|undefined;
  let stopInput:(()=>void)|undefined;
  const resize=()=>{if(closed||!notify)return;const next=metrics(),backingChanged=next.logicalWidth!==current.logicalWidth||next.logicalHeight!==current.logicalHeight||next.scale!==current.scale;if(!backingChanged&&JSON.stringify(next.environment)===JSON.stringify(current.environment))return;viewport++;if(backingChanged)surface++;current=metrics();notify({kind:'metrics',metrics:current});};
  const dpi=()=>{resize();watchDpi();};
  const watchDpi=()=>{media?.removeEventListener('change',dpi);media=matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);media.addEventListener('change',dpi);};
  const lost=(event:Event)=>{event.preventDefault();if(closed)return;library.lose();library.setVisible(false);};
  const restored=()=>{if(closed||!notify)return;library.restore();renderer++;context++;surface++;viewport++;current=metrics();library.setVisible(!document.hidden);notify({kind:'metrics',metrics:current});notify({kind:'visibility',visible:!document.hidden});};
  const visibility=()=>{library.setVisible(!document.hidden);notify?.({kind:'visibility',visible:!document.hidden});};
  const stop=()=>{stopInput?.();stopInput=undefined;if(observer){observer.disconnect();observer=undefined;}media?.removeEventListener('change',dpi);media=undefined;window.removeEventListener('resize',resize);window.removeEventListener('scroll',resize,true);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);document.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);notify=undefined;};
  const assets=new ManifestAssetService(manifest,{async load(ref){const asset=manifest.find(value=>value.id===ref.id);if(!asset)throw new Error('Unknown web asset');const url=new URL(asset.path,root);if(!url.href.startsWith(root.href)||url.origin!==root.origin)throw new Error('Web asset escaped app root');const response=await fetch(url);if(!response.ok)throw new Error('Web asset HTTP '+response.status);const bytes=new Uint8Array(await response.arrayBuffer());totalAssetBytes+=bytes.byteLength;if(bytes.byteLength>16*1024*1024||totalAssetBytes>64*1024*1024)throw new Error('Web asset byte budget');return bytes;}},{async decode(asset,bytes){const decoded=library.decode(asset,bytes);let face:FontFace|undefined;try{if(asset.kind==='font'){face=await new FontFace(asset.fontFamily!,new Uint8Array(bytes)).load();fontSet.add(face);cssFonts.add(face);}return {descriptor:decoded.descriptor,retire(){if(face){fontSet.delete(face);cssFonts.delete(face);}decoded.retire();}};}catch(error){decoded.retire();throw error;}}},sha256);
  const services:BackendServices={identity,foundationPlatform:getBrowserPlatformEnvironment(),clock:{request(callback){if(closed)throw new Error('Web clock closed');const id=requestAnimationFrame(()=>{if(!frames.delete(id))return;if(!closed)try{callback();}finally{selectionContextMenu.refresh();}});frames.add(id);return {dispose(){if(frames.delete(id)){cancelAnimationFrame(id);}}};}},assets,
    images:{create(resources,clock,time){return new ImageService(resources,{assetManifestBytes:encodeImageAssetManifest(manifest),instantiateCodec:(bytes,options)=>library.instantiateImageCodec(bytes,options),async loadAsset(key,signal,progress){const asset=manifest.find(x=>x.id===key||x.path===key);if(!asset||asset.kind!=='image')throw new Error('Unknown image asset: '+key);const url=new URL(asset.path,root);if(url.origin!==root.origin||!url.href.startsWith(root.href))throw new Error('Image asset escaped app root');const bytes=await readImageUrl(url.href,{},signal,progress);if(await sha256(bytes)!==asset.sha256)throw new Error('Image asset content hash mismatch: '+key);return bytes;},loadNetwork:(url,headers,signal,progress)=>readImageUrl(new URL(url,root).href,headers,signal,progress)},clock,time);}},
    pictures:{create:resources=>new FramePictureService(resources,library.framePictureBackend,owner)},
    rasterization:{create:resources=>new RasterizationService(resources,{rasterize:(capture,width,height)=>library.rasterize(capture,width,height),dispose:()=>library.retirePictures()})},
    renderer:{create(_surface,resources){library.bind(resources);return library;}},paths:library,text:{create:()=>library},editing:interaction.editing,semantics:interaction.semantics,nativeSelectionContextMenu:selectionContextMenu,
    surface:{owner,readMetrics:()=>current,attach(view:ViewRuntime,callback){if(closed||notify)throw new Error('Web surface closed/already attached');notify=callback;let keySurface:HTMLElement|null=canvas.parentElement;while(keySurface&&!keySurface.contains(input))keySurface=keySurface.parentElement;if(!keySurface)throw new Error('Web controls require an attached common input surface');stopInput=bindCanvasInput(canvas,view,{keySurface,ownsSemanticsTarget:interaction.ownsSemanticsTarget,ownsEditingTarget:interaction.ownsEditingTarget,ownsNativeSelectionTarget:target=>selectionContextMenu.ownsTarget(target)});observer=new ResizeObserver(resize);observer.observe(canvas);window.addEventListener('resize',resize);window.addEventListener('scroll',resize,true);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);document.addEventListener('visibilitychange',visibility);canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);watchDpi();let alive=true;return {dispose(){if(!alive)return;alive=false;stop();}};},async dispose(){if(closed)return;closed=true;stop();environment.dispose();for(const id of frames){cancelAnimationFrame(id);}frames.clear();interaction.dispose();selectionContextMenu.dispose();cursor.dispose();assets.dispose();for(const face of cssFonts)fontSet.delete(face);cssFonts.clear();await library.dispose();}}};
  return {services,cursor,selectionContextMenu,definition:{...definition,assets:definition.assets??manifest.map(({id,kind,sha256})=>({id,kind,sha256}))}};
  }catch(error){const errors=[error];for(const close of [()=>nativeSelectionContextMenu?.dispose(),()=>environment.dispose(),()=>interaction.dispose(),()=>cursor.dispose()])try{close();}catch(failure){errors.push(failure);}if(errors.length>1)throw new AggregateError(errors,'Web service initialization cleanup failed');throw error;}
}
