// SPDX-License-Identifier: BSD-3-Clause
import type {EditingConfiguration} from '@nelyx/core/hosting/interaction';
import {PendingDisposalError} from '@nelyx/core/foundation/disposable';
import type {NativeInteraction} from '../../runtime/native-interaction.ts';
import {WindowsInputService} from './input-service.ts';
import {WindowsKeyQueue} from './key-queue.ts';
import type {ViewRuntime} from '@nelyx/core/hosting/runtime';
import type {WindowsInputClient,WindowsInputConfiguration,WindowsInputEvents,WindowsInputModule} from './input-service.ts';

// InputScope values from the Windows SDK inputscope.h. These describe the OS
// input scope, not a native text control or an alternative editor configuration.
function inputScope(configuration:EditingConfiguration):number{
  if(configuration.obscureText)return 31;
  return {text:57,number:29,decimal:29,phone:32,email:5,url:1}[configuration.keyboardType];
}
interface Client {readonly generation:number;readonly handle:WindowsInputClient;configuration:WindowsInputConfiguration}
/** One nonvisual input lease for a Core View. Clipped accessibility nodes do
 * not create or retire its clients. Native shutdown is part of this lease. */
export class WindowsInputView {
  readonly ready:Promise<void>;
  private readonly connecting:Promise<WindowsInputService>;
  private readonly unsubscribe:()=>void;
  private readonly clients=new Map<string,Client>();
  private service:WindowsInputService|undefined;
  private keyboard:WindowsKeyQueue|undefined;
  private running:Promise<void>|undefined;
  private closing:Promise<void>|undefined;
  private dirty=false;private queued=false;private stopped=false;private failed=false;
  constructor(private readonly interaction:NativeInteraction,module:WindowsInputModule,events:WindowsInputEvents,surface:number,private readonly onError:(error:unknown)=>void){
    this.unsubscribe=interaction.subscribe(this.schedule);
    this.connecting=WindowsInputService.connect(interaction,module,events,surface,error=>this.fail(error));
    this.ready=this.connecting.then(async service=>{this.service=service;if(this.stopped){await service.dispose();return;}await this.reconcile();});
    // The caller can await ready; a later reconciliation failure must still be
    // reported when no caller is currently awaiting a native operation.
    void this.ready.catch(error=>this.fail(error));
  }
  private configuration(id:string):WindowsInputConfiguration{
    const configuration=this.interaction.editorConfiguration(id);if(!configuration)throw new Error('Core Windows input configuration required');
    const state=this.interaction.editorInputState(id);
    return {enabled:state.enabled&&state.focusable,readOnly:configuration.readOnly,multiline:configuration.multiline,scope:inputScope(configuration)};
  }
  bindKeyboard(view:ViewRuntime,readGeneration:()=>number|undefined):void{
    if(this.stopped||this.keyboard)throw new Error('Windows input keyboard owner unavailable');
    if(view.owner.id!==this.interaction.owner.id||view.owner.generation!==this.interaction.owner.generation)throw new Error('Foreign Core View cannot own this Windows input keyboard');
    this.keyboard=new WindowsKeyQueue(view,readGeneration,async()=>{await this.ready;await this.reconcile();await this.service!.flush();},async(handled,text,focusEpoch)=>{await this.reconcile();await this.service!.flush();if(!handled&&text!==null)await this.service!.keyboardText(text,focusEpoch!);},error=>this.fail(error));
  }
  private readonly schedule=():void=>{
    if(this.stopped)return;this.dirty=true;if(!this.service||this.queued||this.running)return;this.queued=true;
    queueMicrotask(()=>{this.queued=false;if(!this.stopped)void this.reconcile().catch(error=>this.fail(error));});
  };
  private reconcile():Promise<void>{
    this.dirty=true;if(this.running)return this.running;
    const run=async()=>{
      const service=this.service;if(!service||this.stopped)return;
      while(this.dirty&&!this.stopped){
        this.dirty=false;const desired=new Map(this.interaction.editorClients.map(client=>[client.id,client.generation]));
        for(const [id,client]of this.clients)if(desired.get(id)!==client.generation){await client.handle.dispose();this.clients.delete(id);if(this.stopped)return;}
        for(const [id,generation]of desired){
          if(this.stopped)return;if(this.interaction.editorGeneration(id)!==generation){this.dirty=true;continue;}
          const configuration=this.configuration(id),current=this.clients.get(id);
          if(!current){
            const handle=await service.attach(id,{maximum:65536,scope:configuration.scope,configuration});
            if(this.stopped)return;
            if(this.interaction.editorGeneration(id)!==generation){await handle.dispose();this.dirty=true;continue;}
            this.clients.set(id,{generation,handle,configuration});
          }else if(Object.keys(configuration).some(key=>configuration[key as keyof WindowsInputConfiguration]!==current.configuration[key as keyof WindowsInputConfiguration])){
            await service.configure(current.handle,configuration);if(this.stopped)return;current.configuration=configuration;
          }
        }
      }
    };
    const pending=run();this.running=pending;
    // Clear only this operation. A notification arriving after the final
    // iteration must enqueue another pass instead of disappearing at await.
    void pending.then(()=>{if(this.running===pending)this.running=undefined;if(this.dirty&&!this.stopped)this.schedule();},()=>{if(this.running===pending)this.running=undefined;});
    return pending;
  }
  dispose():Promise<void>{
    if(this.closing)return this.closing;this.stopped=true;this.keyboard?.dispose();this.unsubscribe();
    // Begin synchronous service ingress fencing before waiting for an in-flight
    // open/configure. The native disconnect owns all remaining client closes.
    const retirement=this.service?this.service.dispose():this.connecting.then(service=>service.dispose(),error=>{if(error instanceof PendingDisposalError)return error.retry();});
    this.closing=(async()=>{await retirement;const pending=this.running;if(pending)await Promise.allSettled([pending]);this.clients.clear();})();
    this.closing=this.closing.catch(error=>{this.closing=undefined;throw error;});return this.closing;
  }
  private fail(error:unknown):void{
    if(this.stopped||this.failed)return;this.failed=true;
    try{this.onError(error);}finally{void this.dispose().catch(failure=>{if(failure!==error)this.onError(failure);});}
  }
}
