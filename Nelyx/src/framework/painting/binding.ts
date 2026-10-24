// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Source painting/binding.dart system-font contract, scoped to an app messenger.
import {ServicesBinding} from '../../services/binding.ts';
import {Listenable} from '../../foundation/notifier.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import type {ImageService} from '../../hosting/images.ts';
import {imageCacheFor,imageAssetBundleFor} from './image-provider.ts';

class _SystemFontsNotifier extends Listenable {
  private readonly callbacks=new Set<()=>void>();
  private revision=0;
  private retired=false;
  notifyListeners():void{
    if(this.retired)return;
    const revision=this.revision;
    for(const callback of this.callbacks){
      if(this.retired)return;
      if(this.revision!==revision)this.concurrentMutation();
      callback();
    }
    if(!this.retired&&this.revision!==revision)this.concurrentMutation();
  }
  private concurrentMutation():never{const error=new Error('System font listeners changed during notification');error.name='ConcurrentModificationError';throw error;}
  addListener(listener:()=>void):void{if(this.retired)throw new FlutterError('The painting binding is closed');if(!this.callbacks.has(listener)){this.callbacks.add(listener);this.revision++;}}
  removeListener(listener:()=>void):void{if(this.callbacks.delete(listener))this.revision++;}
  /** App retirement is explicit in Nelyx, unlike the source process singleton. */
  retire():void{this.retired=true;if(this.callbacks.size){this.callbacks.clear();this.revision++;}}
}

/** App-owned painting system messages. Image/codec and shader warm-up members
 * remain separate source obligations; this class does not fabricate those APIs. */
export class PaintingBinding extends ServicesBinding {
  private readonly fonts=new _SystemFontsNotifier();
  private readonly imageOwners=new Map<ImageService,Disposable>();
  static override get instance():PaintingBinding{const owner=ServicesBinding.instance;if(!(owner instanceof PaintingBinding))throw new FlutterError('The default application has no initialized PaintingBinding');return owner;}
  get systemFonts():Listenable{return this.fonts;}
  /** Connect this application's image caches to OS pressure without transferring
   * codec/GPU ownership from the SDK's ImageService. Live image handles survive. */
  registerImageService(images:ImageService):Disposable{
    if(this.isClosed)throw new FlutterError('The painting binding is closed');
    if(this.imageOwners.has(images))throw new FlutterError('Image service is already registered');
    const release=()=>{const listener=this.imageOwners.get(images);this.imageOwners.delete(images);listener?.dispose();};
    this.imageOwners.set(images,images.addCloseListener(release));return {dispose:release};
  }
  override handleMemoryPressure():void{
    if(this.isClosed)return;const errors:unknown[]=[];
    for(const images of this.imageOwners.keys())if(!images.isClosed){
      for(const clear of [()=>imageCacheFor(images).clear(),()=>imageAssetBundleFor(images).clear()])try{clear();}catch(error){errors.push(error);}
    }
    try{super.handleMemoryPressure();}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'Painting cache pressure cleanup failed');
  }
  override async handleSystemMessage(systemMessage:unknown):Promise<void>{
    await super.handleSystemMessage(systemMessage);
    if(!this.isClosed&&(systemMessage as Map<string,unknown>).get('type')==='fontsChange')this.fonts.notifyListeners();
  }
  override dispose():void{
    const errors:unknown[]=[];
    try{super.dispose();}catch(error){errors.push(error);}
    this.fonts?.retire();
    if(this.imageOwners){for(const listener of this.imageOwners.values())try{listener.dispose();}catch(error){errors.push(error);}this.imageOwners.clear();}
    if(errors.length)throw new AggregateError(errors,'Painting binding cleanup failed');
  }
}
