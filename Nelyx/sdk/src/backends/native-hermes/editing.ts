// SPDX-License-Identifier: BSD-3-Clause
import {WindowsInputView} from '../react-native/windows-input-view.ts';
import {windowsKeyboardRoute} from '../react-native/windows-keyboard-input.ts';
import type {WindowsInputModule,WindowsInputEvents} from '../react-native/windows-input-service.ts';
import type {ReactNativeInteraction} from '../react-native/interaction.ts';
import type {ViewRuntime} from '@nelyx/core/hosting/runtime';
import type {NativeHermesBridge} from './bridge.ts';

/** Adapts the existing RN-neutral nonvisual editor and acknowledged key queue.
 * Only copied packets cross the native boundary; no React/native module owner. */
export function connectNativeEditing(interaction:ReactNativeInteraction,bridge:NativeHermesBridge,onError:(error:unknown)=>void){
  type Reply={operation:number;error:string;status:string;revision:number};
  const pending=new Map<number,{resolve(value:Reply):void;reject(error:Error):void}>(),clients=new Set<number>();let next=0,diagnostics=0,connected=false,listener:((event:unknown)=>void)|undefined,view:ViewRuntime|undefined;
  const diagnose=(kind:string,value:unknown)=>{if(bridge.diagnostics&&diagnostics++<64)bridge.log('NELYX_NATIVE_EDITING '+JSON.stringify({kind,value}));};
  const send=(kind:string,packet:Record<string,unknown>)=>new Promise<Reply>((resolve,reject)=>{if(pending.size>=1024)throw new Error('Native editing request capacity exceeded');const operation=++next;pending.set(operation,{resolve,reject});try{diagnose(kind,{id:packet.id,operation});bridge.editor(kind,{...packet,operation});}catch(error){pending.delete(operation);reject(error);}});
  const identity=(service:number,client:number)=>{if(!connected||service!==1||!clients.has(client))throw new Error('Native editing owner retired');return {id:String(client),generation:1};};
  const module:WindowsInputModule={
    getInputProtocol:()=>3,
    async connect(surface,owner){if(connected||surface!==1||owner.id!==interaction.owner.id||owner.generation!==interaction.owner.generation)throw new Error('Foreign native editing owner');connected=true;return 1;},
    async openClient(service,client,initial,maximum,scope){if(!connected||service!==1||clients.has(client))throw new Error('Duplicate native editor');clients.add(client);await send('attach',{...identity(service,client),...initial,maximum,scope,enabled:true,readOnly:false,multiline:false});return true;},
    async configureClient(service,client,enabled,readOnly,multiline,scope){await send('configure',{...identity(service,client),enabled,readOnly,multiline,scope});return true;},
    async command(service,client,name,args){let kind=name,packet:Record<string,unknown>={};
      if(name==='replace'||name==='replaceComposing'){kind='replace';packet={text:args[0],anchor:args[1],focus:args[2],revision:args[3],request:args[4],cancel:name==='replaceComposing'};}
      else if(name==='geometry'){const value=args[0] as {geometry:unknown;text:string;characters:unknown;nativeRevision:number;selection:{anchor:number;focus:number}};packet={geometry:value.geometry,text:value.text,characters:value.characters,revision:value.nativeRevision,anchor:value.selection.anchor,focus:value.selection.focus};}
      else if(name==='caretBounds'){kind='caret';const value=args[0] as {bounds:unknown;nativeRevision:number};packet={bounds:value.bounds,revision:value.nativeRevision};}
      else if(name==='textPosition'){kind='hit';const value=args[0] as {request:number;position:unknown;nativeRevision:number};packet={request:value.request,position:value.position,revision:value.nativeRevision};}
      else if(name!=='focus'&&name!=='blur')throw new Error('Unknown native editor command');
      await send(kind,{...identity(service,client),...packet});return true;
    },
    async insertText(service,client,text,revision,focusEpoch){const reply=await send('keyboardText',{...identity(service,client),text,revision,focusEpoch});if(!['applied','stale','busy','unavailable','limit'].includes(reply.status))throw new Error('Invalid native keyboard acknowledgement');return {status:reply.status as 'applied'|'stale'|'busy'|'unavailable'|'limit',revision:reply.revision};},
    async closeClient(service,client){await send('detach',identity(service,client));clients.delete(client);return true;},
    async disconnect(service){if(!connected||service!==1)return true;for(const client of [...clients]){await send('detach',identity(service,client));clients.delete(client);}connected=false;return true;},
  };
  const events:WindowsInputEvents={addListener(name,callback){if(name!=='nelyxWindowsInput'||listener)throw new Error('Native editing event owner already attached');listener=callback;return {remove(){listener=undefined;}};}};
  const native=new WindowsInputView(interaction,module,events,1,onError);
  return {
    ready:native.ready,
    bind(attached:ViewRuntime){view=attached;native.bindKeyboard(attached,()=>1);},
    event(kind:string,value:unknown){
      if(kind!=='editor'||(value as {kind:string}).kind==='editing')diagnose(kind,value);
      if(kind==='editor-ack'){const reply=value as Reply,operation=pending.get(reply.operation);if(!operation)return;pending.delete(reply.operation);if(reply.error)operation.reject(new Error(reply.error));else operation.resolve(reply);return;}
      if(kind==='editor'){const event=value as {id:string;generation:number;kind:string;nativeRevision:number};const client=Number(event.id);if(event.generation!==1||!clients.has(client))return;listener?.({service:1,client,type:event.kind==='editing'?'editing':event.kind==='characters'?'inputBounds':'textPosition',value:event.kind==='characters'?{...event,revision:event.nativeRevision}:event});return;}
      const route=view?windowsKeyboardRoute(view):undefined;
      if(kind==='native-key')route?.key({nativeEvent:value as Parameters<NonNullable<typeof route>['key']>[0]['nativeEvent']});
      else if(kind==='native-keyboard-focus')route?.focus({nativeEvent:value as Parameters<NonNullable<typeof route>['focus']>[0]['nativeEvent']});
      else if(kind==='native-text')route?.text({nativeEvent:value as Parameters<NonNullable<typeof route>['text']>[0]['nativeEvent']});
    },
    async dispose(){view=undefined;await native.dispose();},
  };
}
