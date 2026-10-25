// SPDX-License-Identifier: BSD-3-Clause
import type {ViewRuntime} from '@nelyx/core/hosting/runtime';
import type {NativeKeyObservation,NativeKeyboardFocusObservation,NativeTextObservation} from '@nelyx/core/ui/input';
import {bindWindowsKeyboardRoute,windowsKeyConnection} from './keyboard-input.ts';
import type {WindowsKeyboardPacket} from './keyboard-input.ts';
type Packet={kind:'key';data:NativeKeyObservation}|{kind:'focus';data:NativeKeyboardFocusObservation}|{kind:'text';data:NativeTextObservation};
/** Serialize actual native key/focus packets around observed editing receipts.
 * Core shortcuts run before printable text; the next key sees that real text.
 * This does not manufacture characters or replay TSF-consumed key messages. */
export class WindowsKeyQueue {
  private readonly packets:Packet[]=[];private readonly connection;private readonly detach:()=>void;
  private stopped=false;private running:Promise<void>|undefined;
  constructor(view:ViewRuntime,private readonly readGeneration:()=>number|undefined,private readonly before:()=>Promise<void>,private readonly after:(handled:boolean,text:string|null,focusEpoch?:number)=>Promise<void>,private readonly onError:(error:unknown)=>void){
    this.connection=windowsKeyConnection(view,readGeneration);this.detach=bindWindowsKeyboardRoute(view,this);
  }
  key(event:WindowsKeyboardPacket<NativeKeyObservation>):void{this.enqueue({kind:'key',data:Object.freeze({...event.nativeEvent})});}
  focus(event:WindowsKeyboardPacket<NativeKeyboardFocusObservation>):void{this.enqueue({kind:'focus',data:Object.freeze({...event.nativeEvent})});}
  text(event:WindowsKeyboardPacket<NativeTextObservation>):void{this.enqueue({kind:'text',data:Object.freeze({...event.nativeEvent})});}
  private enqueue(packet:Packet):void{
    if(this.stopped||packet.data.viewGeneration!==this.readGeneration())return;
    if(this.packets.length>=256){this.fail(new Error('Windows key queue capacity exceeded'));return;}
    this.packets.push(packet);this.start();
  }
  private start():void{
    if(this.running||this.stopped)return;
    const run=async()=>{while(!this.stopped&&this.packets.length){const packet=this.packets.shift()!;await this.before();if(this.stopped)return;
      const data=packet.data;if(data.viewGeneration!==this.readGeneration()||data.sequence<=this.connection.sequenceNumber)continue;
      if(packet.kind==='focus'){this.connection.focus({nativeEvent:packet.data});await this.after(true,null);continue;}
      if(packet.kind==='text'){const text=this.connection.text({nativeEvent:packet.data});if(text!==null)await this.after(false,text,packet.data.focusEpoch);continue;}
      const key=packet.data,handled=this.connection.key({nativeEvent:key});if(this.stopped||key.viewGeneration!==this.readGeneration()||this.connection.sequenceNumber!==key.sequence)continue;
      // Alt-only system characters and dead keys are not text input. Actual
      // AltGr characters retain their Ctrl+Alt observation and can be written.
      const printable=key.kind==='down'&&!key.dead&&key.characterCodePoint>=0x20&&key.characterCodePoint!==0x7f&&!(key.modifiers&1536)&&(!(key.modifiers&64)||!!(key.modifiers&8));
      if(key.repeatCount>0xffff)throw new Error('Invalid Windows native repeat count');
      const text=printable?String.fromCodePoint(key.characterCodePoint).repeat(Math.max(1,key.repeatCount)):null;
      if(!handled&&text!==null&&key.focusEpoch<=0)throw new Error('Native printable key lacks its owning TSF character observation');
      if(text!==null)await this.after(handled,text,key.focusEpoch);else await this.after(handled,null);
    }};
    const pending=run();this.running=pending;void pending.then(()=>{if(this.running===pending)this.running=undefined;if(this.packets.length)this.start();},error=>{this.running=undefined;if(!this.stopped)this.fail(error);});
  }
  private fail(error:unknown):void{this.dispose();this.onError(error);}
  dispose():void{if(this.stopped)return;this.stopped=true;this.packets.length=0;this.detach();}
}
