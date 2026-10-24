// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// Pinned dart:ui pointer.dart enum identities; PointerData/packet dispatch is a separate family.
import {invariant} from '../foundation/errors.ts';
export class PointerChange {
  private constructor(readonly index:number,readonly name:'cancel'|'add'|'remove'|'hover'|'down'|'move'|'up'|'panZoomStart'|'panZoomUpdate'|'panZoomEnd'){Object.freeze(this);}
  static readonly cancel=new PointerChange(0,'cancel');
  static readonly add=new PointerChange(1,'add');
  static readonly remove=new PointerChange(2,'remove');
  static readonly hover=new PointerChange(3,'hover');
  static readonly down=new PointerChange(4,'down');
  static readonly move=new PointerChange(5,'move');
  static readonly up=new PointerChange(6,'up');
  static readonly panZoomStart=new PointerChange(7,'panZoomStart');
  static readonly panZoomUpdate=new PointerChange(8,'panZoomUpdate');
  static readonly panZoomEnd=new PointerChange(9,'panZoomEnd');
  static readonly values=Object.freeze([this.cancel,this.add,this.remove,this.hover,this.down,this.move,this.up,this.panZoomStart,this.panZoomUpdate,this.panZoomEnd]);
  toString():string{return 'PointerChange.'+this.name;}
}
export class PointerDeviceKind {
  private constructor(readonly index:number,readonly name:'touch'|'mouse'|'stylus'|'invertedStylus'|'trackpad'|'unknown'){Object.freeze(this);}
  static readonly touch=new PointerDeviceKind(0,'touch');
  static readonly mouse=new PointerDeviceKind(1,'mouse');
  static readonly stylus=new PointerDeviceKind(2,'stylus');
  static readonly invertedStylus=new PointerDeviceKind(3,'invertedStylus');
  static readonly trackpad=new PointerDeviceKind(4,'trackpad');
  static readonly unknown=new PointerDeviceKind(5,'unknown');
  static readonly values=Object.freeze([this.touch,this.mouse,this.stylus,this.invertedStylus,this.trackpad,this.unknown]);
  toString():string{return 'PointerDeviceKind.'+this.name;}
}
export class PointerSignalKind {
  private constructor(readonly index:number,readonly name:'none'|'scroll'|'scrollInertiaCancel'|'scale'|'unknown'){Object.freeze(this);}
  static readonly none=new PointerSignalKind(0,'none');
  static readonly scroll=new PointerSignalKind(1,'scroll');
  static readonly scrollInertiaCancel=new PointerSignalKind(2,'scrollInertiaCancel');
  static readonly scale=new PointerSignalKind(3,'scale');
  static readonly unknown=new PointerSignalKind(4,'unknown');
  static readonly values=Object.freeze([this.none,this.scroll,this.scrollInertiaCancel,this.scale,this.unknown]);
  toString():string{return 'PointerSignalKind.'+this.name;}
}

export type PointerDataRespondCallback=(options:{readonly allowPlatformDefault:boolean})=>void;
export interface PointerDataOptions {
  readonly viewId?:number|string|undefined;
  readonly embedderId?:number|undefined;
  readonly timeStamp?:number|undefined;
  readonly change?:PointerChange|undefined;
  readonly kind?:PointerDeviceKind|undefined;
  readonly signalKind?:PointerSignalKind|null|undefined;
  readonly device?:number|undefined;
  readonly pointerIdentifier?:number|undefined;
  readonly physicalX?:number|undefined;
  readonly physicalY?:number|undefined;
  readonly physicalDeltaX?:number|undefined;
  readonly physicalDeltaY?:number|undefined;
  readonly buttons?:number|undefined;
  readonly obscured?:boolean|undefined;
  readonly synthesized?:boolean|undefined;
  readonly pressure?:number|undefined;
  readonly pressureMin?:number|undefined;
  readonly pressureMax?:number|undefined;
  readonly distance?:number|undefined;
  readonly distanceMax?:number|undefined;
  readonly size?:number|undefined;
  readonly radiusMajor?:number|undefined;
  readonly radiusMinor?:number|undefined;
  readonly radiusMin?:number|undefined;
  readonly radiusMax?:number|undefined;
  readonly orientation?:number|undefined;
  readonly tilt?:number|undefined;
  readonly platformData?:number|undefined;
  readonly scrollDeltaX?:number|undefined;
  readonly scrollDeltaY?:number|undefined;
  readonly panX?:number|undefined;
  readonly panY?:number|undefined;
  readonly panDeltaX?:number|undefined;
  readonly panDeltaY?:number|undefined;
  readonly scale?:number|undefined;
  readonly rotation?:number|undefined;
  readonly onRespond?:PointerDataRespondCallback|undefined;
}
/** Raw physical-pixel data with source defaults. Host packet observation and
 * engine binary packet decoding are separate; this class does not invent them. */
export class PointerData {
  readonly viewId:number|string;
  readonly embedderId:number;
  readonly timeStamp:number;
  readonly change:PointerChange;
  readonly kind:PointerDeviceKind;
  readonly signalKind:PointerSignalKind|null;
  readonly device:number;
  readonly pointerIdentifier:number;
  readonly physicalX:number;
  readonly physicalY:number;
  readonly physicalDeltaX:number;
  readonly physicalDeltaY:number;
  readonly buttons:number;
  readonly obscured:boolean;
  readonly synthesized:boolean;
  readonly pressure:number;
  readonly pressureMin:number;
  readonly pressureMax:number;
  readonly distance:number;
  readonly distanceMax:number;
  readonly size:number;
  readonly radiusMajor:number;
  readonly radiusMinor:number;
  readonly radiusMin:number;
  readonly radiusMax:number;
  readonly orientation:number;
  readonly tilt:number;
  readonly platformData:number;
  readonly scrollDeltaX:number;
  readonly scrollDeltaY:number;
  readonly panX:number;
  readonly panY:number;
  readonly panDeltaX:number;
  readonly panDeltaY:number;
  readonly scale:number;
  readonly rotation:number;
  private readonly onRespond:PointerDataRespondCallback|undefined;
  constructor(options:PointerDataOptions={}){
    this.viewId=options.viewId??0;
    this.embedderId=options.embedderId??0;
    this.timeStamp=options.timeStamp??0;
    this.change=options.change??PointerChange.cancel;
    this.kind=options.kind??PointerDeviceKind.touch;
    this.signalKind=options.signalKind??null;
    this.device=options.device??0;
    this.pointerIdentifier=options.pointerIdentifier??0;
    this.physicalX=options.physicalX??0.0;
    this.physicalY=options.physicalY??0.0;
    this.physicalDeltaX=options.physicalDeltaX??0.0;
    this.physicalDeltaY=options.physicalDeltaY??0.0;
    this.buttons=options.buttons??0;
    this.obscured=options.obscured??false;
    this.synthesized=options.synthesized??false;
    this.pressure=options.pressure??0.0;
    this.pressureMin=options.pressureMin??0.0;
    this.pressureMax=options.pressureMax??0.0;
    this.distance=options.distance??0.0;
    this.distanceMax=options.distanceMax??0.0;
    this.size=options.size??0.0;
    this.radiusMajor=options.radiusMajor??0.0;
    this.radiusMinor=options.radiusMinor??0.0;
    this.radiusMin=options.radiusMin??0.0;
    this.radiusMax=options.radiusMax??0.0;
    this.orientation=options.orientation??0.0;
    this.tilt=options.tilt??0.0;
    this.platformData=options.platformData??0;
    this.scrollDeltaX=options.scrollDeltaX??0.0;
    this.scrollDeltaY=options.scrollDeltaY??0.0;
    this.panX=options.panX??0.0;
    this.panY=options.panY??0.0;
    this.panDeltaX=options.panDeltaX??0.0;
    this.panDeltaY=options.panDeltaY??0.0;
    this.scale=options.scale??0.0;
    this.rotation=options.rotation??0.0;
    this.onRespond=options.onRespond;invariant(this.change instanceof PointerChange&&this.kind instanceof PointerDeviceKind&&(this.signalKind===null||this.signalKind instanceof PointerSignalKind),'invalid-pointer-data-kind','PointerData requires actual pointer enum values');for(const value of [this.embedderId,this.device,this.pointerIdentifier,this.buttons,this.platformData])invariant(Number.isSafeInteger(value),'invalid-pointer-data-integer','PointerData integer exceeds safe range');if(new.target===PointerData)Object.freeze(this);
  }
  respond(options:{readonly allowPlatformDefault:boolean}):void{this.onRespond?.(options);}
  toString():string{return `PointerData(viewId: ${this.viewId}, x: ${this.physicalX}, y: ${this.physicalY})`;}
  toStringFull():string{return this.constructor.name+'('+['embedderId: '+this.embedderId,'timeStamp: '+this.timeStamp,'change: '+this.change,'kind: '+this.kind,'signalKind: '+this.signalKind,'device: '+this.device,'pointerIdentifier: '+this.pointerIdentifier,'physicalX: '+this.physicalX,'physicalY: '+this.physicalY,'physicalDeltaX: '+this.physicalDeltaX,'physicalDeltaY: '+this.physicalDeltaY,'buttons: '+this.buttons,'synthesized: '+this.synthesized,'pressure: '+this.pressure,'pressureMin: '+this.pressureMin,'pressureMax: '+this.pressureMax,'distance: '+this.distance,'distanceMax: '+this.distanceMax,'size: '+this.size,'radiusMajor: '+this.radiusMajor,'radiusMinor: '+this.radiusMinor,'radiusMin: '+this.radiusMin,'radiusMax: '+this.radiusMax,'orientation: '+this.orientation,'tilt: '+this.tilt,'platformData: '+this.platformData,'scrollDeltaX: '+this.scrollDeltaX,'scrollDeltaY: '+this.scrollDeltaY,'panX: '+this.panX,'panY: '+this.panY,'panDeltaX: '+this.panDeltaX,'panDeltaY: '+this.panDeltaY,'scale: '+this.scale,'rotation: '+this.rotation,'viewId: '+this.viewId].join(', ')+')';}
}
/** Packet ownership snapshots the supplied iterable; unlike a Dart final
 * list, callers cannot mutate another owner's event batch after admission. */
export class PointerDataPacket {
  readonly data:readonly PointerData[];
  constructor({data=[]}:{readonly data?:Iterable<PointerData>}={}){this.data=Object.freeze([...data]);if(!this.data.every(value=>value instanceof PointerData))throw new TypeError('PointerDataPacket requires PointerData');if(new.target===PointerDataPacket)Object.freeze(this);}
}
