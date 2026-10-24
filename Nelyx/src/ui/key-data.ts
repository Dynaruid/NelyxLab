// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2013 The Flutter Authors. All rights reserved.
// KeyData/enums from engine/src/flutter/lib/ui/key.dart at the recorded Flutter pin.
export class KeyEventType {
  private constructor(readonly index:number,readonly name:'down'|'up'|'repeat',readonly label:string){Object.freeze(this);}
  static readonly down=new KeyEventType(0,'down','Key Down');static readonly up=new KeyEventType(1,'up','Key Up');static readonly repeat=new KeyEventType(2,'repeat','Key Repeat');
  static readonly values=Object.freeze([this.down,this.up,this.repeat]);toString():string{return 'KeyEventType.'+this.name;}
}
export class KeyEventDeviceType {
  private constructor(readonly index:number,readonly name:'keyboard'|'directionalPad'|'gamepad'|'joystick'|'hdmi',readonly label:string){Object.freeze(this);}
  static readonly keyboard=new KeyEventDeviceType(0,'keyboard','Keyboard');static readonly directionalPad=new KeyEventDeviceType(1,'directionalPad','Directional Pad');static readonly gamepad=new KeyEventDeviceType(2,'gamepad','Gamepad');static readonly joystick=new KeyEventDeviceType(3,'joystick','Joystick');static readonly hdmi=new KeyEventDeviceType(4,'hdmi','HDMI');
  static readonly values=Object.freeze([this.keyboard,this.directionalPad,this.gamepad,this.joystick,this.hdmi]);toString():string{return 'KeyEventDeviceType.'+this.name;}
}
export interface KeyDataOptions {/** Milliseconds, adapting source Duration. */readonly timeStamp:number;readonly type:KeyEventType;readonly deviceType?:KeyEventDeviceType;readonly physical:number;readonly logical:number;readonly character:string|null;readonly synthesized:boolean}
export class KeyData {
  readonly timeStamp:number;readonly type:KeyEventType;readonly deviceType:KeyEventDeviceType;readonly physical:number;readonly logical:number;readonly character:string|null;readonly synthesized:boolean;
  constructor(options:KeyDataOptions){if(!Number.isFinite(options.timeStamp)||options.timeStamp<0||!Number.isSafeInteger(options.physical)||options.physical<0||!Number.isSafeInteger(options.logical)||options.logical<0||!KeyEventType.values.includes(options.type)||!KeyEventDeviceType.values.includes(options.deviceType??KeyEventDeviceType.keyboard)||!(options.character===null||typeof options.character==='string')||typeof options.synthesized!=='boolean')throw new TypeError('Invalid KeyData fields');this.timeStamp=options.timeStamp;this.type=options.type;this.deviceType=options.deviceType??KeyEventDeviceType.keyboard;this.physical=options.physical;this.logical=options.logical;this.character=options.character;this.synthesized=options.synthesized;Object.freeze(this);}
  private logicalToString():string{const plane=Math.floor(this.logical/0x100000000)&0xff,description:Record<number,string>={0:'Unicode',1:'Unprintable',2:'Flutter',0x11:'Android',0x12:'Fuchsia',0x13:'iOS',0x14:'macOS',0x15:'GTK',0x16:'Windows',0x17:'Web',0x18:'GLFW'};return '0x'+this.logical.toString(16)+(description[plane]?' ('+description[plane]+')':'');}
  private escapeCharacter():string{if(this.character===null)return '<none>';const escaped:Record<string,string>={'\n':'\\n','\t':'\\t','\r':'\\r','\b':'\\b','\f':'\\f'};return '"'+(escaped[this.character]??this.character)+'"';}
  toString():string{const codes=this.character===null?'':' (0x'+Array.from({length:this.character.length},(_,i)=>this.character!.charCodeAt(i).toString(16).padStart(2,'0')).join(' ')+')';return `KeyData(${this.type.label}, physical: 0x${this.physical.toString(16)}, logical: ${this.logicalToString()}, character: ${this.escapeCharacter()}${codes}${this.synthesized?', synthesized':''}`;}
  toStringFull():string{const microseconds=Math.floor(this.timeStamp*1000),seconds=Math.floor(microseconds/1000000),duration=`${Math.floor(seconds/3600)}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}.${String(microseconds%1000000).padStart(6,'0')}`;return `KeyData(type: ${this.type.label}, deviceType: ${this.deviceType.label}, timeStamp: ${duration}, physical: 0x${this.physical.toString(16)}, logical: 0x${this.logical.toString(16)}, character: ${this.escapeCharacter()}, synthesized: ${this.synthesized})`;}
}
