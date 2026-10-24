import type {Disposable} from '@nelyx/core/foundation/disposable';

export interface ReloadChange {readonly kind:'application'|'bundled-code'|'native'|'provider'|'bootstrap'|'asset'|'sdk-host'|'runtime-budget';readonly revision:string}
export interface ReloadLifetime {readonly generation:number;isCurrent():boolean}
export interface ReloadOptions<Factory,Application extends Disposable> {
  readonly load:(revision:string)=>Factory|Promise<Factory>;
  readonly open:(factory:Factory,lifetime:ReloadLifetime)=>Application|Promise<Application>;
}
interface OwnedApplication<Application>{application:Application;generation:number;revision:string;close?:Promise<void>}
const failedOwners=new Set<object>();
/** Full replacement only: invalidate callbacks, drain the old owner, then open the new factory. */
export class ApplicationReload<Factory,Application extends Disposable> implements Disposable {
  private owned:OwnedApplication<Application>|undefined;
  private job:Promise<Application>|undefined;
  private revision='';
  private generation=0;
  private epoch=0;
  private closing=false;
  private restart=false;
  private state:'idle'|'draining'|'opening'|'open'|'failed'|'restart-required'|'closing'|'closed'='idle';
  private closePromise:Promise<void>|undefined;
  constructor(private readonly options:ReloadOptions<Factory,Application>){}
  get current():Application|undefined{return this.state==='open'?this.owned?.application:undefined;}
  start(revision:string):Promise<Application>{if(this.owned||this.generation)return Promise.reject(new Error('Reload supervisor already started'));return this.replace(revision);}
  reload(change:ReloadChange):Promise<Application> {
    if(typeof change.revision!=='string'||!change.revision||change.revision.length>256)return Promise.reject(new Error('Invalid reload revision'));
    if(!['application','bundled-code','native','provider','bootstrap','asset','sdk-host','runtime-budget'].includes(change.kind))return Promise.reject(new Error('Unknown reload change'));
    if(change.kind!=='application'&&change.kind!=='bundled-code'){
      this.restart=true;this.epoch++;
      const close=this.dispose();return close.then(()=>{this.state='restart-required';throw new Error(`Process restart required for ${change.kind}`);});
    }
    return this.replace(change.revision);
  }
  private replace(revision:string):Promise<Application> {
    if(typeof revision!=='string'||!revision||revision.length>256)return Promise.reject(new Error('Invalid reload revision'));
    if(this.closing||this.restart||this.state==='failed')return Promise.reject(new Error(`Reload unavailable: ${this.state}`));
    if(this.job)return revision===this.revision?this.job:Promise.reject(new Error('Reload busy; retain only the latest pending revision'));
    this.revision=revision;const generation=++this.generation,epoch=++this.epoch,previous=this.owned;
    this.state='draining';
    if(previous)this.beginClose(previous); // Call dispose synchronously to block platform callbacks now.
    const lifetime=Object.freeze({generation,isCurrent:()=>!this.closing&&!this.restart&&epoch===this.epoch});
    const job=(async()=>{
      if(previous){await this.drain(previous);if(this.owned===previous)this.owned=undefined;}
      if(!lifetime.isCurrent())throw new Error('Reload stopped before factory load');
      this.state='opening';const factory=await this.options.load(revision);
      if(!lifetime.isCurrent())throw new Error('Reload stopped before application open');
      const application=await this.options.open(factory,lifetime),owned={application,generation,revision};this.owned=owned;
      if(!lifetime.isCurrent()){await this.drain(owned);this.owned=undefined;throw new Error('Reload stopped during application open');}
      this.state='open';return application;
    })().catch(error=>{if(!this.closing){this.state='failed';failedOwners.add(this);}throw error;});
    this.job=job;const clear=()=>{if(this.job===job)this.job=undefined;};void job.then(clear,clear);return job;
  }
  private beginClose(owned:OwnedApplication<Application>):Promise<void>{
    if(!owned.close){try{owned.close=Promise.resolve(owned.application.dispose());}catch(error){owned.close=Promise.reject(error);}}
    return owned.close;
  }
  private async drain(owned:OwnedApplication<Application>):Promise<void>{
    try{await this.beginClose(owned);}catch(error){failedOwners.add(this);throw error;}
  }
  dispose():Promise<void>{
    if(this.closePromise)return this.closePromise;this.closing=true;this.epoch++;this.state='closing';
    if(this.owned)this.beginClose(this.owned);
    this.closePromise=(async()=>{
      if(this.job)try{await this.job;}catch(error){if(!String(error).includes('Reload stopped'))throw error;}
      if(this.owned){await this.drain(this.owned);this.owned=undefined;}
      failedOwners.delete(this);this.state=this.restart?'restart-required':'closed';
    })().catch(error=>{this.state='failed';failedOwners.add(this);throw error;});return this.closePromise;
  }
}
