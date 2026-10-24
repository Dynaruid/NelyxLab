// SPDX-License-Identifier: BSD-3-Clause
import type {ViewOwner} from '@nelyx/core/ui/types';
import {PendingDisposalError} from '@nelyx/core/foundation/disposable';
import type {ReactNativeInteraction,ReactNativeEditorPort,NativeEditingSnapshot,NativeTextPositionRequest} from './interaction.ts';
export interface WindowsInputModule {
  getInputProtocol():number;
  connect(surface:number,owner:ViewOwner):Promise<number>;
  openClient(service:number,client:number,initial:{owner:ViewOwner;text:string;anchor:number;focus:number},maximum:number,scope:number):Promise<boolean>;
  configureClient(service:number,client:number,enabled:boolean,readOnly:boolean,multiline:boolean,scope:number):Promise<boolean>;
  command(service:number,client:number,name:string,args:readonly unknown[]):Promise<boolean>;
  insertText(service:number,client:number,text:string,revision:number,focusEpoch:number):Promise<{readonly status:'applied'|'stale'|'busy'|'unavailable'|'limit';readonly revision:number}>;
  closeClient(service:number,client:number):Promise<boolean>;
  disconnect(service:number):Promise<boolean>;
}
export interface WindowsInputEvents {addListener(name:string,listener:(event:unknown)=>void):{remove():void}}
export interface WindowsInputClient {readonly client:number;dispose():Promise<void>}
export interface WindowsInputConfiguration {readonly enabled:boolean;readonly readOnly:boolean;readonly multiline:boolean;readonly scope:number}
interface Client {readonly id:string;readonly client:number;readonly generation:number;readonly token:object;active:boolean;opened:boolean;focused:boolean;revision:number;sequence:number;receipts:Map<number,number|undefined>;opening?:Promise<void>;closing?:Promise<void>;detach?:()=>void}
const owners=new WeakMap<ReactNativeInteraction,object>();
function positive(value:number):boolean{return Number.isSafeInteger(value)&&value>0;}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid Windows input event');return value as Record<string,unknown>;}
/** A View service owns native endpoints independently of semantics proxy Views.
 * Disposal fences JS ingress synchronously and awaits actual native retirement. */
export class WindowsInputService {
  static async connect(interaction:ReactNativeInteraction,module:WindowsInputModule,events:WindowsInputEvents,surface:number,onError:(error:unknown)=>void):Promise<WindowsInputService>{
    if(module.getInputProtocol()!==3||typeof module.insertText!=='function')throw new Error('Rebuild Windows nonvisual input protocol 3 bindings');if(!positive(surface))throw new Error('Actual Windows surface React tag required');if(owners.has(interaction))throw new Error('Windows input interaction already connected');
    const token={};owners.set(interaction,token);let native:number|undefined;
    try{native=await module.connect(surface,interaction.owner);if(!positive(native))throw new Error('Invalid Windows input service identity');return new WindowsInputService(interaction,module,events,native,token,onError);}
    catch(error){
      const retire=async():Promise<void>=>{try{if(native!==undefined&&positive(native))await module.disconnect(native);}catch(failure){throw new PendingDisposalError([failure],retire);}if(owners.get(interaction)===token)owners.delete(interaction);};
      try{await retire();}catch(failure){throw new PendingDisposalError([error,failure],retire);}throw error;
    }
  }
  private readonly clients=new Map<number,Client>();
  private readonly fields=new Map<string,Client>();
  private readonly handles=new WeakMap<WindowsInputClient,Client>();
  private readonly subscription:{remove():void};
  private readonly pending=new Set<Promise<void>>();private readonly waiters=new Set<()=>void>();
  private next=0;private stopped=false;private closing:Promise<void>|undefined;private failed=false;
  private constructor(private readonly interaction:ReactNativeInteraction,private readonly module:WindowsInputModule,events:WindowsInputEvents,readonly identity:number,private readonly token:object,private readonly onError:(error:unknown)=>void){this.subscription=events.addListener('nelyxWindowsInput',event=>{try{this.event(event);}catch(error){this.fail(error);}});}
  async attach(id:string,options:{readonly maximum:number;readonly scope:number;readonly configuration?:Omit<WindowsInputConfiguration,'scope'>}):Promise<WindowsInputClient>{
    if(this.stopped)throw new Error('Windows input service retired');if(this.fields.has(id))throw new Error('Windows input field already attached');if(!Number.isSafeInteger(options.maximum)||options.maximum<=0||options.maximum>65536||!Number.isSafeInteger(options.scope)||options.scope<0)throw new Error('Invalid Windows input budget/scope');
    const initial=this.interaction.editorCoreValue(id)??this.interaction.editorValue(id),generation=this.interaction.editorGeneration(id);if(!initial||!generation)throw new Error('Core editing client required');if(!positive(++this.next))throw new Error('Windows input client identity exhausted');
    const client:Client={id,client:this.next,generation,token:{},active:true,opened:false,focused:false,revision:0,sequence:0,receipts:new Map()};this.clients.set(client.client,client);this.fields.set(id,client);
    client.opening=(async()=>{
      if(!await this.module.openClient(this.identity,client.client,{owner:this.interaction.owner,text:initial.text,anchor:initial.selection.anchor,focus:initial.selection.focus},options.maximum,options.scope))throw new Error('Windows native input client did not open');client.opened=true;
      if(!this.live(client))return;if(this.interaction.editorGeneration(id)!==generation){client.active=false;await this.module.closeClient(this.identity,client.client);client.opened=false;this.clients.delete(client.client);this.fields.delete(id);return;}
      if(options.configuration){const configuration=options.configuration;if(!await this.module.configureClient(this.identity,client.client,configuration.enabled,configuration.readOnly,configuration.multiline,options.scope))throw new Error('Windows initial input configuration rejected');}
      if(!this.live(client))return;if(this.interaction.editorGeneration(id)!==generation){client.active=false;await this.module.closeClient(this.identity,client.client);client.opened=false;this.clients.delete(client.client);this.fields.delete(id);return;}
      const send=(name:string,args:readonly unknown[])=>{if(!this.live(client))throw new Error('Windows input client retired');this.send(client,name,args);};
      const replace=(name:string,text:string,selection:{start:number;end:number},revision=client.revision,request?:number)=>{if(!positive(++client.sequence))throw new Error('Windows input request identity exhausted');const native=client.sequence;client.receipts.set(native,request);try{send(name,[text,selection.start,selection.end,revision,native]);}catch(error){client.receipts.delete(native);throw error;}};
      const port:ReactNativeEditorPort={replace:(...args)=>replace('replace',...args),replaceComposing:(...args)=>replace('replaceComposing',...args),focus:()=>send('focus',[]),blur:()=>send('blur',[]),updateGeometry:(geometry,text,characters,nativeRevision,selection)=>send('geometry',[{geometry,text,characters,nativeRevision,selection}]),updateCaretBounds:(bounds,nativeRevision)=>send('caretBounds',[{bounds,nativeRevision}]),updateTextPosition:(request,position,nativeRevision)=>send('textPosition',[{request,position,nativeRevision}])};
      const detach=this.interaction.attachEditor(id,client.token,port);if(this.live(client))client.detach=detach;else detach();
    })();
    try{await client.opening;}catch(error){if(!this.stopped)this.fail(error);throw error;}
    const handle:WindowsInputClient={client:client.client,dispose:()=>this.closeClient(client)};this.handles.set(handle,client);return handle;
  }
  async configure(client:WindowsInputClient,options:WindowsInputConfiguration):Promise<void>{
    const current=this.handles.get(client);if(!current||!this.live(current))throw new Error('Windows input client retired');await current.opening;if(!this.live(current))return;
    if(!await this.module.configureClient(this.identity,client.client,options.enabled,options.readOnly,options.multiline,options.scope))throw new Error('Windows input configuration rejected');
  }
  /** Key dispatch waits for both native command completion and its observed
   * editing receipt. A resolved module Promise alone is not a Core update. */
  async flush():Promise<void>{
    const deadline=Date.now()+5000;
    for(;;){if(this.stopped)throw new Error('Windows input service retired');if(!this.pending.size&&![...this.clients.values()].some(client=>this.live(client)&&client.receipts.size))return;await this.waitProgress(deadline);}
  }
  async keyboardText(text:string,focusEpoch:number):Promise<void>{
    if(!positive(focusEpoch))throw new Error('Native TSF character focus epoch required');
    await this.flush();const focused=[...this.clients.values()].filter(client=>this.live(client)&&client.focused);if(!focused.length)return;if(focused.length!==1)throw new Error('Ambiguous Windows keyboard input owner');const client=focused[0]!,deadline=Date.now()+5000;
    for(let attempt=0;attempt<24;attempt++){
      if(!this.live(client)||!client.focused)return;
      const result=record(await this.until(this.module.insertText(this.identity,client.client,text,client.revision,focusEpoch),deadline));
      if(!['applied','stale','busy','unavailable','limit'].includes(String(result.status))||!Number.isSafeInteger(result.revision)||Number(result.revision)<0)throw new Error('Invalid Windows keyboard text result');
      if(result.status==='busy'){if(Date.now()>=deadline)break;await new Promise(resolve=>setTimeout(resolve,Math.min(250,16*2**Math.min(attempt,4))));continue;}
      if(result.status==='stale')throw new Error('Windows keyboard text lost its native document revision');
      if(result.status!=='applied')return;
      while(this.live(client)&&client.revision<Number(result.revision))await this.waitProgress(deadline);await this.flush();return;
    }
    throw new Error('Windows keyboard text remained locked; input was not dropped');
  }
  private progress():void{for(const done of [...this.waiters])done();}
  private until<T>(operation:Promise<T>,deadline:number):Promise<T>{
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);this.waiters.delete(retired);};
      const retired=()=>{if(this.stopped){cleanup();reject(new Error('Windows input service retired'));}};
      const timer=setTimeout(()=>{cleanup();reject(new Error('Windows input native operation timed out'));},Math.max(0,deadline-Date.now()));
      this.waiters.add(retired);operation.then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});retired();
    });
  }
  private waitProgress(deadline:number):Promise<void>{
    if(Date.now()>=deadline)return Promise.reject(new Error('Windows input editing acknowledgement timed out'));
    return new Promise(resolve=>{const done=()=>{clearTimeout(timer);this.waiters.delete(done);resolve();};const timer=setTimeout(done,deadline-Date.now());this.waiters.add(done);});
  }
  dispose():Promise<void>{
    if(this.closing)return this.closing;this.stopped=true;this.subscription.remove();for(const client of this.clients.values()){client.active=false;client.detach?.();delete client.detach;client.receipts.clear();}this.progress();
    this.closing=(async()=>{await this.module.disconnect(this.identity);this.clients.clear();this.fields.clear();if(owners.get(this.interaction)===this.token)owners.delete(this.interaction);})();
    this.closing=this.closing.catch(error=>{this.closing=undefined;throw error;});return this.closing;
  }
  private live(client:Client):boolean{return !this.stopped&&client.active&&this.clients.get(client.client)===client;}
  private closeClient(client:Client):Promise<void>{
    if(client.closing)return client.closing;client.active=false;client.detach?.();delete client.detach;client.receipts.clear();this.progress();
    client.closing=(async()=>{await client.opening;if(this.stopped){await this.dispose();return;}if(client.opened)await this.module.closeClient(this.identity,client.client);if(this.clients.get(client.client)===client)this.clients.delete(client.client);if(this.fields.get(client.id)===client)this.fields.delete(client.id);})();
    client.closing=client.closing.catch(error=>{delete client.closing;throw error;});return client.closing;
  }
  private send(client:Client,name:string,args:readonly unknown[]):void{
    const operation=(async()=>{if(!await this.module.command(this.identity,client.client,name,args)&&this.live(client))throw new Error('Windows native input command rejected');})();
    // Layout/query replies can continue while TSF observes a live caret.
    // They neither acknowledge an edit nor precede the next document value.
    // Waiting for global coordinate traffic to become empty starves keys.
    if(['replace','replaceComposing','focus','blur'].includes(name))this.pending.add(operation);
    const settled=()=>{this.pending.delete(operation);this.progress();};void operation.then(settled,error=>{settled();if(this.live(client))this.fail(error);});
  }
  private event(packet:unknown):void{
    if(this.stopped)return;const event=record(packet);if(event.service!==this.identity)return;if(event.client===0&&event.type==='serviceError')throw new Error(String(record(event.value).message));
    if(typeof event.client!=='number'||!positive(event.client))throw new Error('Invalid Windows input client event');const client=this.clients.get(event.client);if(!client||!this.live(client)||!client.detach)return;const value=record(event.value);
    if(event.type==='editing'){
      const snapshot=value as unknown as NativeEditingSnapshot;if(!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0)throw new Error('Invalid Windows input revision');
      let normalized=snapshot;
      if(snapshot.source==='programmatic'){
        if(snapshot.request===undefined||!client.receipts.has(snapshot.request))return;const origin=client.receipts.get(snapshot.request);client.receipts.delete(snapshot.request);
        // An implicit caller has no public request id. Do not let its older
        // native receipt acknowledge a newer pending Core replacement. The
        // latest receipt (including a stale retry) supplies the real shadow.
        if(snapshot.request<client.sequence){client.revision=Math.max(client.revision,snapshot.revision);this.progress();return;}
        const {request:unused,...rest}=snapshot;normalized=origin===undefined?rest:{...rest,request:origin};
      }
      if(snapshot.revision<client.revision){this.progress();return;}client.revision=snapshot.revision;this.interaction.observeSnapshot(client.token,normalized);if(this.live(client)&&typeof snapshot.focused==='boolean')client.focused=snapshot.focused;this.progress();
    }else if(event.type==='inputBounds')this.interaction.requestCharacterBounds(client.token,value.start as number,value.end as number,value.revision as number,value.layoutEpoch as number);
    else if(event.type==='textPosition')this.interaction.requestTextPosition(client.token,value as unknown as NativeTextPositionRequest);
    else if(event.type==='inputError')throw new Error(String(value.message));
    else throw new Error('Unknown Windows input event type');
  }
  private fail(error:unknown):void{if(this.failed||this.stopped)return;this.failed=true;void this.dispose().catch(failure=>this.onError(failure));this.onError(error);}
}
