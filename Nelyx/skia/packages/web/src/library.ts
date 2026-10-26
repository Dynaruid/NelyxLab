import {readWebImageBytes} from './image-bytes.ts';
import {paragraphApiVersion} from './paragraph-api.ts';
import type {OwnedParagraph} from './paragraph-api.ts';
import {createEnginePath} from './path.ts';
import {invariant} from '@nelyx/core/foundation/errors';
import type {PathSnapshot,PathQueryService} from '@nelyx/core/ui/path';
import type {Offset} from '@nelyx/core/ui/geometry';
import type {CanvasKit,GrDirectContext,Surface,Image,TypefaceFontProvider,Paragraph,WebGLContextHandle} from 'canvaskit-wasm';
import type {Renderer} from '@nelyx/core/hosting/runtime';
import type {ResourceLease,ResourceRegistry} from '@nelyx/core/hosting/resources';
import type {AssetRef} from '@nelyx/core/foundation/assets';
import type {Disposable} from '@nelyx/core/foundation/disposable';
import type {PaintFrame,RendererCapabilities,RendererNotification,SubmitResult,ViewMetrics,ViewOwner,TextLayoutInput,TextLayout,TextLayoutService,ResourceId,TextLayoutRequest,TextBoxQuery,TextBoxGeometry} from '@nelyx/core/ui/types';
import {isCurrent,resourceKey} from '@nelyx/core/ui/frame';
import {RendererEvents} from '@nelyx/core/hosting/renderer-events';
import {freezeTextInput,freezeTextLayout,freezeTextRect,textRange,textLimits} from '@nelyx/core/ui/text';
import type {PaintSnapshot,BlendMode} from '@nelyx/core/ui/paint';
import {Paint as UiPaint} from '@nelyx/core/ui/paint';
import type {TextRunStyle} from '@nelyx/core/ui/text-styles';
import {applyPaintEffects,createRuntimeShaderCache} from './paint-effects.ts';
import {imageTargetSize} from '@nelyx/core/hosting/images';
import type {ImageDecodeOptions,NativeImageCodec,NativeImageFrame} from '@nelyx/core/hosting/images';
import {imageLimits} from '@nelyx/core/hosting/images';
import {NativePictureCache,NativeRetirementError} from '@nelyx/core/hosting/rasterization';
import type {PictureCapture} from '@nelyx/core/ui/picture';
import type {FramePictureBackend} from '@nelyx/core/hosting/pictures';
import {ParagraphFontCatalog,ParagraphFontProviders} from '@nelyx/core/hosting/text-fonts';
import {TextLayoutCache} from '@nelyx/core/hosting/text-layout-cache';
import {TextLayoutBudget} from '@nelyx/core/hosting/text-layout-budget';
import {TextPaintResources} from '@nelyx/core/hosting/text-paints';
import type {FontProviderLease} from '@nelyx/core/hosting/text-fonts';
import {buildStyledText} from '@nelyx/core/ui/text-builder';
import {webTextStyle,webParagraphStyle} from './text-style.ts';

interface Font {resource:ResourceId;provider:TypefaceFontProvider;family:string;bytes:Uint8Array;sourceBytes:number}
interface Entry {layout:TextLayout;paragraph:Paragraph;fonts:FontProviderLease<Font,TypefaceFontProvider>;paintResources:TextPaintResources}
interface Pending {fence:WebGLSync;lease:ResourceLease;started:number}
/** Fork-owned CanvasKit resources and replay; no React, RN or native bootstrap import. */
export class WebSkiaLibrary implements Renderer,TextLayoutService,PathQueryService {
  private readonly runtimePrograms:ReturnType<typeof createRuntimeShaderCache>;
  get debugRuntimePrograms(){return this.runtimePrograms.debugStats;}
  readonly capabilities:RendererCapabilities=Object.freeze({admission:'bounded',completion:'gpu-retired',present:'unobserved',textRanges:true,nativeIdentity:true,notifications:'submitted-and-retired'});
  private images=new Map<string,Image>();private fonts=new Map<string,Font>();private paragraphs=new Map<string,Entry>();
  private pending=new Map<number,Pending>();private events:RendererEvents;
  private metrics:ViewMetrics|undefined;private context:GrDirectContext|undefined;private surface:Surface|undefined;private handle:WebGLContextHandle|undefined;private gl:WebGL2RenderingContext|undefined;
  private registry:ResourceRegistry|undefined;private sequence=0;private closed=false;private lost=false;private visible=true;private timer:ReturnType<typeof setTimeout>|undefined;
  private closePromise:Promise<void>|undefined;
  private layoutCache:TextLayoutCache<Font>|undefined;private textBudget:TextLayoutBudget|undefined;private fontCatalog:ParagraphFontCatalog<Font>|undefined;
  private failed=false;
  private providers:ParagraphFontProviders<Font,TypefaceFontProvider>|undefined;private textFailed=false;private readonly uncertainText:unknown[]=[];
  private dynamicImageBytes=0;private codecBytes=0;
  private pictures:NativePictureCache<import('canvaskit-wasm').SkPicture>|undefined;
  private pictureCompilations=0;
  private unconfirmedPicture:NativeRetirementError|undefined;
  private failPicture(errors:readonly unknown[],owners:readonly unknown[]):never{this.unconfirmedPicture=new NativeRetirementError(errors,owners);throw this.unconfirmedPicture;}
  private retireFrameEntry(entry:{native:import('canvaskit-wasm').SkPicture|null;failure?:NativeRetirementError}):void{if(entry.failure)throw entry.failure;try{entry.native?.delete();entry.native=null;}catch(error){entry.failure=new NativeRetirementError([error],[entry.native]);this.unconfirmedPicture=entry.failure;throw entry.failure;}}
  private readonly framePictures=new Map<string,{capture:PictureCapture;native:import('canvaskit-wasm').SkPicture|null;bytes:number;failure?:NativeRetirementError}>();
  private framePictureCompilations=0;
  readonly framePictureBackend:FramePictureBackend={compile:(capture,descriptor)=>{this.ensureOpen();if(this.lost)throw new Error('Web picture context lost');const key=resourceKey(descriptor);if(this.framePictures.has(key))throw new Error('Duplicate Web frame picture');const native=this.compilePicture(capture,true);let bytes:number;try{bytes=native.approximateBytesUsed();}catch(error){try{native.delete();}catch(cleanup){this.failPicture([error,cleanup],[native]);}throw error;}const entry={capture,native:native as import('canvaskit-wasm').SkPicture|null,bytes};this.framePictures.set(key,entry);let retired=false;return {bytes,retire:()=>{if(retired)return;this.retireFrameEntry(entry);this.framePictures.delete(key);retired=true;}};}};
  private allocateResource(kind:string):ResourceId{let resource:ResourceId;do{resource=this.registry?.allocateId(`${this.owner.id}:${this.owner.generation}:${kind}`)??{id:`${this.owner.id}:${this.owner.generation}:${kind}:${++this.sequence}`,generation:1};}while(this.images.has(resourceKey(resource))||this.fonts.has(resourceKey(resource))||this.paragraphs.has(resourceKey(resource))||this.framePictures.has(resourceKey(resource)));return resource;}
  private framePicture(key:string):import('canvaskit-wasm').SkPicture{const entry=this.framePictures.get(key);if(!entry)throw new Error('Web frame picture retired');if(!entry.native){const native=this.compilePicture(entry.capture,true);try{if(native.approximateBytesUsed()>entry.bytes)throw new Error('Restored Web picture exceeded admitted memory budget');}catch(error){try{native.delete();}catch(cleanup){this.failPicture([error,cleanup],[native]);}throw error;}entry.native=native;}return entry.native;}
  private retireFrameNative():void{const errors:unknown[]=[];for(const entry of this.framePictures.values())try{this.retireFrameEntry(entry);}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Web native frame pictures retirement failed');}
  constructor(private ck:CanvasKit,private canvas:HTMLCanvasElement,private owner:ViewOwner){this.events=new RendererEvents(owner);this.runtimePrograms=createRuntimeShaderCache(ck);}
  contains(path:PathSnapshot,point:Offset):boolean{this.ensureOpen();if(!Number.isFinite(point.x)||!Number.isFinite(point.y))throw new Error('Path query point must be finite');const native=createEnginePath(this.ck,path),errors:unknown[]=[];let value=false;try{value=native.contains(point.x,point.y);}catch(error){errors.push(error);}finally{try{native.delete();}catch(error){errors.push(error);}}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Web path query/retirement failed');return value;}
  bind(registry:ResourceRegistry){if(this.registry)throw new Error('Web Skia registry already bound');this.registry=registry;this.fontCatalog=new ParagraphFontCatalog(registry);this.textBudget=new TextLayoutBudget(registry);this.providers=new ParagraphFontProviders(registry,this.fontCatalog,fonts=>{if(fonts.length===1)return {provider:fonts[0]!.source.provider,retire(){}};const provider=this.ck.TypefaceFontProvider.Make();try{for(const font of fonts)provider.registerFont(font.source.bytes,font.family);return {provider,retire:()=>provider.delete()};}catch(error){provider.delete();throw error;}});}
  observe(listener:(event:RendererNotification)=>void):Disposable{return this.events.subscribe(listener);}
  // Frame bounds are advisory. Compute actual draw bounds so scaling the initial
  // FLT_MAX cull rect cannot overflow and discard a multi-run paragraph at DPR > 1.
  private compilePicture(capture:PictureCapture,unbounded=false):import('canvaskit-wasm').SkPicture{const recorder=new this.ck.PictureRecorder(),errors:unknown[]=[],unknownOwners:unknown[]=[];let picture:import('canvaskit-wasm').SkPicture|undefined;try{const canvas=recorder.beginRecording(unbounded?this.ck.LTRBRect(-3.4028234663852886e38,-3.4028234663852886e38,3.4028234663852886e38,3.4028234663852886e38):this.ck.XYWHRect(0,0,imageLimits.dimension,imageLimits.dimension),unbounded);this.replay(canvas,capture.frame);picture=recorder.finishRecordingAsPicture();if(unbounded)this.framePictureCompilations++;else this.pictureCompilations++;}catch(error){errors.push(error);}finally{try{recorder.delete();}catch(error){unknownOwners.push(recorder);errors.push(error);}}if(errors.length){try{picture?.delete();}catch(error){unknownOwners.push(picture);errors.push(error);}if(unknownOwners.length)this.failPicture(errors,unknownOwners);if(errors.length===1)throw errors[0];throw new AggregateError(errors,'Web picture recording/retirement failed');}return picture!;}
  get debugRasterizationStats(){return Object.freeze({pictures:this.pictures?.debugEntryCount??0,pictureBytes:this.pictures?.debugBytes??0,pictureCompilations:this.pictureCompilations,framePictures:this.framePictures.size,framePictureCompilations:this.framePictureCompilations,dynamicImageBytes:this.dynamicImageBytes});}
  get debugOwner(){return this.owner;}
  get debugTextStats(){const values=[...this.paragraphs.values()],producers=values.reduce((sum,entry)=>sum+(this.registry?.initialProducerCount(entry.layout.resource)??0),0),live=values.filter(entry=>this.registry?.hasInitialProducer(entry.layout.resource)).length;return Object.freeze({cache:this.layoutCache?.debugStats,paragraphs:this.paragraphs.size,producers,retainedOnly:this.paragraphs.size-live,fontProviders:this.providers?.debugProviderCount??0,fontProviderSourceBytes:this.providers?.debugSourceBytes??0,failed:this.textFailed});}
  retirePictures():void{this.pictures?.dispose();this.pictures=undefined;}
  /** Actual GPU rendering/readback produces a CPU-restorable sRGB image resource. */
  rasterize(capture:PictureCapture,width:number,height:number):NativeImageFrame{
    this.ensureOpen();if(this.lost||this.failed)throw new Error('Web rasterization GPU context unavailable');this.ensureGpuContext();imageTargetSize(width,height);const cost=width*height*4;if(this.images.size>=1024||this.dynamicImageBytes+this.codecBytes+cost*3>256*1024*1024)throw new Error('Web rasterization image/temporary byte budget');
    let resource:{id:string;generation:number},key:string;do{resource=this.allocateResource('raster');key=resourceKey(resource);}while(this.images.has(key)||this.fonts.has(key)||this.paragraphs.has(key)||this.registry?.isRetained(resource));
    this.pictures??=new NativePictureCache(c=>this.compilePicture(c),picture=>picture.approximateBytesUsed(),picture=>picture.delete());const picture=this.pictures.get(capture),info={width,height,colorType:this.ck.ColorType.RGBA_8888,alphaType:this.ck.AlphaType.Premul,colorSpace:this.ck.ColorSpace.SRGB},errors:unknown[]=[];let surface:Surface|null=null,texture:Image|null=null,output:Image|null=null;
    try{surface=this.ck.MakeRenderTarget(this.context!,info);if(!surface)throw new Error('Web rasterization GPU surface unavailable');surface.getCanvas().clear(this.ck.Color(0,0,0,0));surface.getCanvas().drawPicture(picture);surface.flush();texture=surface.makeImageSnapshot();const pixels=texture.readPixels(0,0,info);if(!(pixels instanceof Uint8Array)||pixels.byteLength!==cost)throw new Error('Web rasterization GPU readback failed');output=this.ck.MakeImage(info,pixels,width*4);if(!output)throw new Error('Web raster image copy failed');}catch(error){errors.push(error);}finally{for(const cleanup of [()=>texture?.delete(),()=>surface?.delete()])try{cleanup();}catch(error){errors.push(error);}}
    if(errors.length){try{output?.delete();}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];throw new AggregateError(errors,'Web rasterization/temporary retirement failed');}
    const image=output!;this.images.set(key,image);this.dynamicImageBytes+=cost;let retired=false;
    return {descriptor:{...resource,kind:'image'},width,height,duration:0,readBytes:async format=>{if(retired)throw new Error('Web raster image retired');return readWebImageBytes(this.ck,image,format);},retire:()=>{if(retired)return;image.delete();retired=true;this.images.delete(key);this.dynamicImageBytes-=cost;}};
  }
  /** CPU codec/resampling is separate from the GPU-only surface renderer. */
  instantiateImageCodec(bytes:Uint8Array,options:ImageDecodeOptions={}):NativeImageCodec{
    this.ensureOpen();const animated=this.ck.MakeAnimatedImageFromEncoded(bytes),still=animated?null:this.ck.MakeImageFromEncoded(bytes);if(!animated&&!still)throw new Error('CanvasKit image codec creation failed');const frameCount=animated?.getFrameCount()??1,repetitionCount=frameCount===1?0:animated!.getRepetitionCount(),naturalWidth=animated?animated.width():still!.width(),naturalHeight=animated?animated.height():still!.height(),codecCost=naturalWidth*naturalHeight*4*(frameCount>1?3:1);let target:{width:number;height:number};try{target=imageTargetSize(naturalWidth,naturalHeight,options);if(this.codecBytes+this.dynamicImageBytes+codecCost>256*1024*1024)throw new Error('Web codec memory budget');}catch(error){animated?.delete();still?.delete();throw error;}this.codecBytes+=codecCost;let dead=false,index=0;
    return {frameCount,repetitionCount,getNextFrame:():NativeImageFrame=>{this.ensureOpen();if(dead)throw new Error('CanvasKit codec disposed');if(animated&&index>0){if(index%frameCount===0)animated.reset();else if(animated.decodeNextFrame()===-1)throw new Error('Image animation frame decode failed');}index++;const raw=animated?animated.makeImageAtCurrentFrame():still;if(!raw)throw new Error('CanvasKit image frame decode failed');let surface:Surface|null=null,output:Image|null=null;try{const size=target,cost=size.width*size.height*4;if(this.images.size>=1024||this.dynamicImageBytes+this.codecBytes+cost>256*1024*1024)throw new Error('Web dynamic image resource/byte budget');surface=this.ck.MakeSurface(size.width,size.height);if(!surface)throw new Error('CanvasKit image resize surface creation failed');surface.getCanvas().drawImageRectOptions(raw,this.ck.XYWHRect(0,0,raw.width(),raw.height()),this.ck.XYWHRect(0,0,size.width,size.height),this.ck.FilterMode.Linear,this.ck.MipmapMode.None);output=surface.makeImageSnapshot();const image=output,resource=this.allocateResource('image'),key=resourceKey(resource);this.images.set(key,image);this.dynamicImageBytes+=cost;output=null;let retired=false;return {descriptor:{...resource,kind:'image'},width:size.width,height:size.height,duration:frameCount===1?0:animated!.currentFrameDuration(),readBytes:async format=>{if(retired)throw new Error('Web image retired');return readWebImageBytes(this.ck,image,format);},retire:()=>{if(retired)return;retired=true;image.delete();this.images.delete(key);this.dynamicImageBytes-=cost;}};}finally{output?.delete();surface?.delete();if(animated)raw.delete();}},dispose:()=>{if(dead)return;dead=true;animated?.delete();still?.delete();this.codecBytes-=codecCost;}};
  }
  decode(asset:AssetRef&{fontFamily?:string},bytes:Uint8Array){
    this.ensureOpen();const resource={id:asset.id,generation:1},key=resourceKey(resource);if(this.images.has(key)||this.fonts.has(key))throw new Error('Duplicate web resource');
    if(this.images.size+this.fonts.size>=64)throw new Error('Web asset count budget');
    let native:Image|TypefaceFontProvider;
    if(asset.kind==='image'){const image=this.ck.MakeImageFromEncoded(bytes);if(!image)throw new Error('CanvasKit image decode failed');native=image;this.images.set(key,image);}
    else{if(!asset.fontFamily)throw new Error('Bundled font family required');const typeface=this.ck.Typeface.MakeTypefaceFromData(new Uint8Array(bytes).buffer);if(!typeface)throw new Error('CanvasKit font decode failed');typeface.delete();const provider=this.ck.TypefaceFontProvider.Make(),source=new Uint8Array(bytes);try{provider.registerFont(source,asset.fontFamily);}catch(error){provider.delete();throw error;}native=provider;this.fonts.set(key,{resource,provider,family:asset.fontFamily,bytes:source,sourceBytes:source.length});}
    let retired=false;
    return {descriptor:{...resource,kind:asset.kind,asset:Object.freeze({id:asset.id,kind:asset.kind,sha256:asset.sha256})},retire:()=>{if(retired)return;retired=true;native.delete();if(asset.kind==='image'){this.images.delete(key);}else{this.fonts.delete(key);}}};
  }
  fontFamily(resource:ResourceId):string{this.ensureOpen();const font=this.fonts.get(resourceKey(resource));if(!font||!this.registry?.has(resource))throw new Error('Stale font resource');return font.family;}
  layout(input:TextLayoutInput,request?:TextLayoutRequest):TextLayout {
    this.ensureOpen();if(this.textFailed)throw Error('Web paragraph native retirement failed');const snapshot=freezeTextInput(input),font=this.fonts.get(resourceKey(snapshot.font)),registry=this.registry;
    if(!font||!registry?.has(snapshot.font))throw new Error('Stale font resource');
    const catalog=this.fontCatalog!.capture(this.fonts.values()),cache=this.layoutCache??=new TextLayoutCache(registry,this.fontCatalog!),cacheKey=cache.key(snapshot,catalog),cached=cache.reuse(cacheKey,retained=>this.textBudget!.admit(snapshot,request,retained,cache));if(cached)return cached;
    const primaryFamily=catalog.fonts.find(value=>value.source===font)?.family;if(primaryFamily===undefined)throw new Error('Primary paragraph font is not in the captured catalog');
    const fonts=this.providers!.acquire(snapshot.font,catalog);let paragraph:Paragraph|undefined,admitted=false,paintResources:TextPaintResources|undefined;
    const temporary:{delete():void}[]=[],uncertainTemporary:{delete():void}[]=[];
    const own=<T extends {delete():void}>(value:T):T=>{temporary.push(value);return value;};
    const releaseTemporary=()=>{const errors:unknown[]=[];for(const value of temporary.splice(0).reverse())try{value.delete();}catch(error){uncertainTemporary.push(value);errors.push(error);}if(errors.length)throw new AggregateError(errors,'Web text paint wrapper retirement failed');};
    let builder:ReturnType<CanvasKit['ParagraphBuilder']['MakeFromFontProvider']>|undefined;
    try{
      paintResources=new TextPaintResources(registry,snapshot);
      builder=this.ck.ParagraphBuilder.MakeFromFontProvider(webParagraphStyle(this.ck,snapshot,primaryFamily,fonts.families),fonts.provider);
      const push=(style:TextRunStyle)=>{const native=webTextStyle(this.ck,snapshot,style,primaryFamily,fonts.families);if(!style.foreground&&!style.background){builder!.pushStyle(native);return;}const foreground=own(new this.ck.Paint()),background=own(new this.ck.Paint());this.configurePaint(foreground,style.foreground??new UiPaint({color:style.color??snapshot.color??0xffeef5ff}).snapshot(),own);this.configurePaint(background,style.background??new UiPaint({color:style.backgroundColor??0}).snapshot(),own);builder!.pushPaintStyle(native,foreground,background);};
      buildStyledText(snapshot,{push,pop:()=>builder!.pop(),addText:text=>builder!.addText(text),addPlaceholder:p=>builder!.addPlaceholder(p.width,p.height,this.ck.PlaceholderAlignment[p.alignment[0]!.toUpperCase()+p.alignment.slice(1) as 'Baseline'|'AboveBaseline'|'BelowBaseline'|'Top'|'Bottom'|'Middle'],p.baseline==='ideographic'?this.ck.TextBaseline.Ideographic:this.ck.TextBaseline.Alphabetic,p.baselineOffset)});
      paragraph=builder.build();builder.delete();builder=undefined;releaseTemporary();paragraph.layout(snapshot.width);
      const resource=this.allocateResource('paragraph');
      const placeholderBoxes=paragraph.getRectsForPlaceholders();
      const layout=freezeTextLayout(resource,snapshot,{width:paragraph.getMaxWidth(),height:paragraph.getHeight(),alphabeticBaseline:paragraph.getAlphabeticBaseline(),ideographicBaseline:paragraph.getIdeographicBaseline(),minIntrinsicWidth:paragraph.getMinIntrinsicWidth(),maxIntrinsicWidth:paragraph.getMaxIntrinsicWidth(),longestLine:paragraph.getLongestLine(),overflow:paragraph.didExceedMaxLines(),unresolvedGlyphs:paragraph.unresolvedCodepoints().length,lines:paragraph.getLineMetrics().map(value=>{const line=value as typeof value&{unscaledAscent?:number};return {start:line.startIndex,end:line.endIndex,baseline:line.baseline,height:line.height,bounds:{x:line.left,y:line.baseline-line.ascent,width:line.width,height:line.ascent+line.descent},...(line.unscaledAscent!==undefined?{metrics:{hardBreak:line.isHardBreak,ascent:line.ascent,descent:line.descent,unscaledAscent:line.unscaledAscent,height:line.height,width:line.width,left:line.left,baseline:line.baseline,lineNumber:line.lineNumber}}:{})};}),placeholderBoxes:placeholderBoxes.map(box=>freezeTextRect({x:box.rect[0]!,y:box.rect[1]!,width:box.rect[2]!-box.rect[0]!,height:box.rect[3]!-box.rect[1]!})),placeholderDirections:placeholderBoxes.map(box=>box.dir===this.ck.TextDirection.RTL?'rtl':'ltr')});
      const key=resourceKey(resource),entry={layout,paragraph,fonts,paintResources};
      const registration=this.textBudget!.registration(layout,snapshot);
      registry.register({...resource,kind:'paragraph'},()=>{try{entry.paragraph.delete();}catch(error){this.textFailed=true;this.uncertainText.push(entry);throw error;}cache.forget(cacheKey,layout);this.paragraphs.delete(key);const errors:unknown[]=[];for(const cleanup of [()=>entry.paintResources.dispose(),()=>entry.fonts.release()])try{cleanup();}catch(error){this.textFailed=true;errors.push(error);}if(errors.length)throw new AggregateError(errors,'Web paragraph dependency retirement failed');},registration);admitted=true;this.paragraphs.set(key,entry);try{registry.bindResource(layout.resource);cache.remember(cacheKey,layout,registration.cost,request?.transient!==true);}catch(error){registry.releaseProducer(resource);throw error;}return layout;
    }catch(error){if(admitted)throw error;const errors=[error];let retired=uncertainTemporary.length===0;for(const cleanup of [()=>paragraph?.delete(),()=>builder?.delete(),releaseTemporary])try{cleanup();}catch(failure){retired=false;errors.push(failure);}if(retired){for(const cleanup of [()=>paintResources?.dispose(),()=>fonts.release()])try{cleanup();}catch(failure){this.textFailed=true;errors.push(failure);}}else{this.textFailed=true;this.uncertainText.push({paragraph,builder,fonts,paintResources,uncertainTemporary});}if(errors.length===1)throw error;throw new AggregateError(errors,'Web paragraph construction/retirement failed');}
  }
  private entry(layout:TextLayout){this.ensureOpen();const entry=this.paragraphs.get(resourceKey(layout.resource));if(entry?.layout!==layout||!this.registry?.hasInitialProducer(layout.resource))throw new Error('Stale/foreign web paragraph');return entry;}
  range(layout:TextLayout,start:number,end:number){textRange(layout,start,end);return Object.freeze(this.entry(layout).paragraph.getRectsForRange(start,end,this.ck.RectHeightStyle.Tight,this.ck.RectWidthStyle.Tight).map(value=>freezeTextRect({x:value.rect[0]!,y:value.rect[1]!,width:value.rect[2]!-value.rect[0]!,height:value.rect[3]!-value.rect[1]!})));}
  boxes(layout:TextLayout,start:number,end:number,{heightStyle='tight',widthStyle='tight'}:TextBoxQuery={}):readonly TextBoxGeometry[]{
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<0||start>0xffffffff||end>0xffffffff)throw new Error('Text box range is outside Uint32 ABI');const height={tight:this.ck.RectHeightStyle.Tight,max:this.ck.RectHeightStyle.Max,includeLineSpacingMiddle:this.ck.RectHeightStyle.IncludeLineSpacingMiddle,includeLineSpacingTop:this.ck.RectHeightStyle.IncludeLineSpacingTop,includeLineSpacingBottom:this.ck.RectHeightStyle.IncludeLineSpacingBottom,strut:this.ck.RectHeightStyle.Strut}[heightStyle],width={tight:this.ck.RectWidthStyle.Tight,max:this.ck.RectWidthStyle.Max}[widthStyle];
    if(!height||!width)throw new Error('Unknown text box height/width style');
    return Object.freeze(this.entry(layout).paragraph.getRectsForRange(start,end,height,width).map(value=>Object.freeze({rect:freezeTextRect({x:value.rect[0]!,y:value.rect[1]!,width:value.rect[2]!-value.rect[0]!,height:value.rect[3]!-value.rect[1]!}),direction:value.dir===this.ck.TextDirection.RTL?'rtl' as const:'ltr' as const})));
  }
  closestGlyph(layout:TextLayout,x:number,y:number){if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('Nonfinite paragraph hit');const glyph=this.entry(layout).paragraph.getClosestGlyphInfoAtCoordinate(x,y);if(!glyph)return null;const bounds=glyph.graphemeLayoutBounds,range=glyph.graphemeClusterTextRange;textRange(layout,range.start,range.end);return Object.freeze({start:range.start,end:range.end,direction:glyph.dir===this.ck.TextDirection.RTL?'rtl' as const:'ltr' as const,bounds:freezeTextRect({x:bounds[0]!,y:bounds[1]!,width:bounds[2]!-bounds[0]!,height:bounds[3]!-bounds[1]!})});}
  hit(layout:TextLayout,x:number,y:number){if(!Number.isFinite(x)||!Number.isFinite(y))throw new Error('Nonfinite paragraph hit');const paragraph=this.entry(layout).paragraph,hit=paragraph.getGlyphPositionAtCoordinate(x,y),glyph=paragraph.getClosestGlyphInfoAtCoordinate(x,y),bounds=glyph?.graphemeLayoutBounds,range=glyph?.graphemeClusterTextRange;return Object.freeze({position:hit.pos,affinity:hit.affinity===this.ck.Affinity.Upstream?'upstream' as const:'downstream' as const,...(glyph&&bounds&&range&&!glyph.isEllipsis?{start:range.start,end:range.end,direction:glyph.dir===this.ck.TextDirection.RTL?'rtl' as const:'ltr' as const,bounds:freezeTextRect({x:bounds[0]!,y:bounds[1]!,width:bounds[2]!-bounds[0]!,height:bounds[3]!-bounds[1]!})}:{})});}
  glyphAt(layout:TextLayout,offset:number){const paragraph=this.entry(layout).paragraph;if(!Number.isInteger(offset)||offset<0||offset>layout.input.text.length)throw new Error('Glyph offset outside UTF16 body');const glyph=paragraph.getGlyphInfoAt(offset);if(!glyph)return null;const bounds=glyph.graphemeLayoutBounds,range=glyph.graphemeClusterTextRange;textRange(layout,range.start,range.end);return Object.freeze({start:range.start,end:range.end,bounds:freezeTextRect({x:bounds[0]!,y:bounds[1]!,width:bounds[2]!-bounds[0]!,height:bounds[3]!-bounds[1]!}),direction:glyph.dir===this.ck.TextDirection.RTL?'rtl' as const:'ltr' as const,isEllipsis:glyph.isEllipsis});}
  lineNumberAt(layout:TextLayout,offset:number):number|null{const paragraph=this.entry(layout).paragraph,text=layout.input.text;invariant(Number.isInteger(offset)&&offset>=0&&offset<=0xffffffff,'invalid-line-offset','Line offset outside Uint32 ABI');if(offset>=text.length)return null;let bytes=0;for(let unit=0;unit<offset;){const scalar=text.codePointAt(unit)!;if(scalar>0xffff&&unit+1===offset)break;bytes+=scalar<=0x7f?1:scalar<=0x7ff?2:scalar<=0xffff?3:4;unit+=scalar>0xffff?2:1;}const native=paragraph as OwnedParagraph;invariant(paragraphApiVersion(this.ck)!==1||typeof native.nelyxLineNumberAtUTF16==='function','paragraph-api-mismatch','Owned runtime is missing UTF16 line lookup');const result=paragraphApiVersion(this.ck)===1?native.nelyxLineNumberAtUTF16!(offset):paragraph.getLineNumberAt(bytes);invariant(Number.isInteger(result)&&result>=-1&&result<layout.lines.length,'invalid-line-number','Malformed engine line number');return result<0?null:result;}
  wordBoundary(layout:TextLayout,offset:number){const paragraph=this.entry(layout).paragraph;if(!Number.isInteger(offset)||offset<0||offset>0xffffffff)throw new Error('Word offset outside Uint32 ABI');const range=paragraph.getWordBoundary(offset);textRange(layout,range.start,range.end);return Object.freeze({start:range.start,end:range.end});}
  private color(value:number){return this.ck.Color((value>>>16)&255,(value>>>8)&255,value&255,(value>>>24)/255);}
  private rect(value:{x:number;y:number;width:number;height:number}){return this.ck.XYWHRect(value.x,value.y,value.width,value.height);}
  private configurePaint(paint:import('canvaskit-wasm').Paint,value:PaintSnapshot,own:<T extends {delete():void}>(value:T)=>T){const mode=(value.blendMode[0]!.toUpperCase()+value.blendMode.slice(1)) as Capitalize<BlendMode>;paint.setColor(this.color(value.color));paint.setAntiAlias(value.isAntiAlias);paint.setStyle(value.style==='stroke'?this.ck.PaintStyle.Stroke:this.ck.PaintStyle.Fill);paint.setStrokeWidth(value.strokeWidth);paint.setStrokeMiter(value.strokeMiterLimit);paint.setStrokeCap(this.ck.StrokeCap[value.strokeCap==='butt'?'Butt':value.strokeCap==='round'?'Round':'Square']);paint.setStrokeJoin(this.ck.StrokeJoin[value.strokeJoin==='miter'?'Miter':value.strokeJoin==='round'?'Round':'Bevel']);paint.setBlendMode(this.ck.BlendMode[mode]);return applyPaintEffects(this.ck,paint,value,own,key=>{const image=this.images.get(key);if(!image)throw new Error('Web shader image retired');return image;},this.runtimePrograms);}
  updateMetrics(metrics:ViewMetrics):void {
    this.ensureOpen();this.metrics=metrics;if(this.lost)return;
    this.dropSurface();this.canvas.width=metrics.physicalWidth;this.canvas.height=metrics.physicalHeight;
    if(!metrics.physicalWidth||!metrics.physicalHeight)return;
    this.ensureGpuContext();
    const surface=this.ck.MakeOnScreenGLSurface(this.context!,metrics.physicalWidth,metrics.physicalHeight,this.ck.ColorSpace.SRGB);if(!surface)throw new Error('CanvasKit GPU surface failed');this.surface=surface;
  }
  private ensureGpuContext():void{
    if(!this.context){const handle=this.ck.GetWebGLContext(this.canvas,{majorVersion:2,alpha:1,antialias:0,stencil:8,preserveDrawingBuffer:1});if(!handle)throw new Error('CanvasKit WebGL2 creation failed');this.handle=handle;
      const gl=this.canvas.getContext('webgl2');if(!gl){this.ck.deleteContext(handle);this.handle=undefined;throw new Error('WebGL2 fence API unavailable');}this.gl=gl;
      const context=this.ck.MakeWebGLContext(handle);if(!context){this.ck.deleteContext(handle);this.handle=undefined;throw new Error('CanvasKit GPU context failed');}
      try{context.setResourceCacheLimitBytes(32*1024*1024);this.context=context;}
      catch(error){context.delete();this.ck.deleteContext(handle);this.handle=undefined;this.gl=undefined;throw error;}
    }
  }
  submit(frame:PaintFrame,lease:ResourceLease):SubmitResult {
    if(this.closed)return {status:'rejected',reason:'closed'};
    if(!this.metrics||!isCurrent(frame,this.owner,this.metrics))return {status:'rejected',reason:'stale'};
    if(!this.metrics.physicalWidth||!this.metrics.physicalHeight)return {status:'rejected',reason:'zero-size'};
    if(frame.estimatedBytes>512*1024)return {status:'rejected',reason:'oversize'};
    if(this.lost||this.failed||!this.visible||this.pending.size>=2||this.pending.has(frame.token.sequence)){return {status:'rejected',reason:'busy'};}
    const surface=this.surface,gl=this.gl;if(!surface||!gl)throw new Error('Web GPU surface unavailable');
    this.replay(surface.getCanvas(),frame,this.metrics.scale);surface.flush();const fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!fence)throw new Error('WebGL fence creation failed');gl.flush();lease.transfer();this.pending.set(frame.token.sequence,{fence,lease,started:performance.now()});this.events.accepted(frame.token.sequence,frame.token);this.schedule();return {status:'accepted',submission:frame.token.sequence};
  }
  private replay(canvas:import('canvaskit-wasm').Canvas,frame:PaintFrame,scale=1):void{
    const saveCount=canvas.getSaveCount(),errors:unknown[]=[],paths:({delete():void})[]=[];let paint:import('canvaskit-wasm').Paint|undefined;
    const own=<T extends {delete():void}>(value:T):T=>{paths.push(value);return value;};
    try{paint=new this.ck.Paint();paint.setAntiAlias(true);const imageRefs=new Map<PaintFrame['commands'][number],Image>(),paragraphRefs=new Map<PaintFrame['commands'][number],Entry>();const styles=new Map<PaintFrame['commands'][number],import('canvaskit-wasm').Paint>(),backdrops=new Map<PaintFrame['commands'][number],import('canvaskit-wasm').ImageFilter|null>();for(const command of frame.commands)if('paint'in command){const value=own(new this.ck.Paint());const filter=this.configurePaint(value,command.paint,own);if(command.op==='saveBackdropFilter'){backdrops.set(command,filter);value.setImageFilter(null);}styles.set(command,value);}for(const command of frame.commands)if('resource'in command){if(command.op==='drawPicture'){this.framePicture(resourceKey(command.resource));}else if(command.op==='paragraph'){const value=this.paragraphs.get(resourceKey(command.resource));if(!value)throw new Error('Web paragraph retired');paragraphRefs.set(command,value);}else{const value=this.images.get(resourceKey(command.resource));if(!value)throw new Error('Web image retired');imageRefs.set(command,value);}}canvas.save();canvas.scale(scale,scale);for(const command of frame.commands){const styled=styles.get(command)!;switch(command.op){
      case 'drawPicture':canvas.drawPicture(this.framePicture(resourceKey(command.resource)));break;
      case 'clear':canvas.clear(this.color(command.color));break;
      case 'save':canvas.save();break;case 'restore':canvas.restore();break;
      case 'transform':{if(command.matrix.length===16)canvas.concat(command.matrix.map((_,index)=>command.matrix[(index%4)*4+Math.floor(index/4)]!));else{const [a,b,c,d,x,y]=command.matrix as readonly [number,number,number,number,number,number];canvas.concat([a,c,x,b,d,y,0,0,1]);}break;}
      case 'clip':canvas.clipRect(this.rect(command.rect),this.ck.ClipOp.Intersect,true);break;
      case 'rect':case 'rrect':paint.setColor(this.color(command.color));if(command.op==='rect')canvas.drawRect(this.rect(command.rect),paint);else canvas.drawRRect(this.ck.RRectXY(this.rect(command.rect),command.radius,command.radius),paint);break;
      case 'image':{const image=imageRefs.get(command)!;paint.setColor(this.color(0xff000000));canvas.drawImageRect(image,this.ck.XYWHRect(0,0,image.width(),image.height()),this.rect(command.rect),paint);break;}
      case 'drawImageRect':case 'drawImageNine':{const image=imageRefs.get(command)!;const quality=command.paint.filterQuality??'none',source=this.rect(command.op==='drawImageRect'?command.src:command.center),dst=this.rect(command.dst);if(command.op==='drawImageNine')canvas.drawImageNine(image,Int32Array.from(source),dst,quality==='none'?this.ck.FilterMode.Nearest:this.ck.FilterMode.Linear,styled);else if(quality==='high')canvas.drawImageRectCubic(image,source,dst,1/3,1/3,styled);else canvas.drawImageRectOptions(image,source,dst,quality==='none'?this.ck.FilterMode.Nearest:this.ck.FilterMode.Linear,quality==='medium'?this.ck.MipmapMode.Linear:this.ck.MipmapMode.None,styled);break;}
      case 'paragraph':{const paragraph=paragraphRefs.get(command)!;canvas.drawParagraph(paragraph.paragraph,command.x,command.y);break;}
      case 'drawRect':case 'drawOval':if(command.op==='drawRect')canvas.drawRect(this.rect(command.rect),styled);else canvas.drawOval(this.rect(command.rect),styled);break;
      case 'drawRRect':canvas.drawRRect('rrect'in command?Float32Array.from(command.rrect.values):this.ck.RRectXY(this.rect(command.rect),command.radius,command.radius),styled);break;
      case 'drawLine':canvas.drawLine(command.from.x,command.from.y,command.to.x,command.to.y,styled);break;
      case 'saveBackdropFilter':canvas.saveLayer(styled,null,backdrops.get(command)??null);break;
      case 'saveLayer':canvas.saveLayer(styled,command.bounds?this.rect(command.bounds):null);break;
      case 'clipRect':case 'clipRRect':{const op=command.clipOp==='intersect'?this.ck.ClipOp.Intersect:this.ck.ClipOp.Difference;if(command.op==='clipRect')canvas.clipRect(this.rect(command.rect),op,command.doAntiAlias);else canvas.clipRRect('rrect'in command?Float32Array.from(command.rrect.values):this.ck.RRectXY(this.rect(command.rect),command.radius,command.radius),op,command.doAntiAlias);break;}
      case 'drawShadow':{
        // Flutter DlSkCanvasDispatcher::DrawShadow at the pinned engine revision.
        const path=own(createEnginePath(this.ck,command.path)),color=command.color,alpha=color>>>24;
        const rgb=[(color>>>16)&255,(color>>>8)&255,color&255] as const;
        const tonal=this.ck.computeTonalColors({ambient:this.ck.Color(...rgb,Math.trunc(Math.fround(.039)*alpha)/255),spot:this.ck.Color(...rgb,Math.trunc(.25*alpha)/255)});
        canvas.drawShadow(path,[0,0,Math.fround(Math.fround(command.devicePixelRatio)*Math.fround(command.elevation))],[0,-1,1],Math.fround(800/600),tonal.ambient,tonal.spot,4|(command.transparentOccluder?1:0));break;
      }
      case 'drawPaint':canvas.drawPaint(styled);break;
      case 'drawPath':case 'clipPath':{
        const path=own(createEnginePath(this.ck,command.path));if(command.op==='drawPath'){canvas.drawPath(path,styled);}else canvas.clipPath(path,command.clipOp==='intersect'?this.ck.ClipOp.Intersect:this.ck.ClipOp.Difference,command.doAntiAlias);break;
      }
      default:throw new Error('Unsupported Web paint command: '+String((command as {op:string}).op));
    }}}
    catch(error){errors.push(error);}finally{for(const cleanup of [()=>canvas.restoreToCount(saveCount),...paths.reverse().map(path=>()=>path.delete()),()=>paint?.delete()])try{cleanup();}catch(error){errors.push(error);}}
    if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Web paint replay/temporary disposal failed');
  }
  private schedule(){if(this.timer!==undefined||this.closed||!this.pending.size)return;this.timer=setTimeout(()=>{this.timer=undefined;this.poll();},5);}
  private poll(){if(this.closed||this.lost)return;const gl=this.gl!;
    for(const [id,pending] of this.pending){const status=gl.clientWaitSync(pending.fence,0,0);if(status===gl.ALREADY_SIGNALED||status===gl.CONDITION_SATISFIED){this.pending.delete(id);gl.deleteSync(pending.fence);try{pending.lease.returnBy('renderer');}finally{this.events.retired(id,'gpu-retired');}}else if(status===gl.WAIT_FAILED||performance.now()-pending.started>5000){this.failed=true;this.events.failed(id,status===gl.WAIT_FAILED?'WebGL fence failed; lease retained until owned drain':'WebGL fence timeout; lease retained until owned drain');}}
    if(!this.failed)this.schedule();
  }
  setVisible(value:boolean){this.visible=value;}
  lose(){if(this.closed||this.lost)return;this.lost=true;this.clearTimer();this.retirePictures();this.retireFrameNative();this.runtimePrograms.clear();this.dropContext(true);this.releasePending('discarded');}
  restore(){this.ensureOpen();this.lost=false;this.failed=false;}
  private clearTimer(){if(this.timer!==undefined){clearTimeout(this.timer);this.timer=undefined;}}
  private releasePending(result:'discarded'|'drained'){for(const [id,pending] of this.pending){this.pending.delete(id);if(!this.lost)this.gl?.deleteSync(pending.fence);try{pending.lease.returnBy('renderer');}finally{this.events.retired(id,result);}}}
  private dropSurface(){if(this.surface){this.surface.delete();this.surface=undefined;}}
  private dropContext(abandon=false){this.dropSurface();if(this.context){if(abandon)this.context.releaseResourcesAndAbandonContext();this.context.delete();this.context=undefined;}if(this.handle!==undefined){this.ck.deleteContext(this.handle);this.handle=undefined;}}
  private ensureOpen(){if(this.runtimePrograms.retirementError)throw this.runtimePrograms.retirementError;if(this.unconfirmedPicture)throw this.unconfirmedPicture;if(this.closed)throw new Error('Web Skia library closed');}
  dispose():Promise<void>{
    if(this.closePromise)return this.closePromise;
    let resolve!:()=>void,reject!:(error:unknown)=>void;
    const closing=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});this.closePromise=closing;this.closed=true;
    try{
      this.events.stop();this.clearTimer();
      if(this.runtimePrograms.retirementError)throw this.runtimePrograms.retirementError;if(this.unconfirmedPicture)throw this.unconfirmedPicture;
      this.retirePictures();if(!this.lost)this.gl?.finish();this.releasePending('drained');this.retireFrameNative();this.runtimePrograms.dispose();this.dropContext(this.lost);
      if(this.gl&&!this.gl.isContextLost())this.gl.getExtension('WEBGL_lose_context')?.loseContext();this.gl=undefined;this.events.drain();resolve();
    }catch(error){reject(error);}
    return closing;
  }
}
