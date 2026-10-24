// SPDX-License-Identifier: BSD-3-Clause
// Nelyx logical autofill ownership; OS context completion remains explicitly capability-gated.
import {AutofillService} from '../../services/autofill.ts';
import type {AutofillGroupRegistration,AutofillDisposeAction,AutofillRequestResult} from '../../services/autofill.ts';
import type {Disposable} from '../../foundation/disposable.ts';
import {invariant} from '../../foundation/errors.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {StatefulWidget,State,InheritedWidget} from './framework.ts';
import type {BuildContext,Widget,WidgetOptions} from './framework.ts';
import type {ViewControllerContext} from '../../hosting/runtime.ts';

interface SharedService {readonly service:AutofillService;references:number}
const fallbackServices=new WeakMap<ViewControllerContext,SharedService>();
function acquire(context:BuildContext,preferred?:AutofillService):{service:AutofillService;release:()=>void}{
  const services=context.services;if(services.platformServices)return {service:services.platformServices.autofillService,release:()=>{}};
  let entry=fallbackServices.get(services);if(preferred&&entry?.service!==preferred)return {service:preferred,release:()=>{}};if(!entry){entry={service:new AutofillService(services.binaryMessenger??null),references:0};fallbackServices.set(services,entry);}const owned=entry;owned.references++;let live=true;
  return {service:owned.service,release:()=>{if(!live)return;live=false;if(--owned.references===0){owned.service.dispose();if(fallbackServices.get(services)===owned)fallbackServices.delete(services);}}};
}
export interface AutofillGroupOptions extends WidgetOptions {readonly child:Widget;readonly service?:AutofillService;readonly onDisposeAction?:AutofillDisposeAction}
/** Default disposal only releases metadata. Await finish() before navigation to request save/cancel. */
export class AutofillGroup extends StatefulWidget {
  constructor(readonly options:AutofillGroupOptions){super(options.key??null);invariant(['none','commit','cancel'].includes(options.onDisposeAction??'none'),'invalid-autofill-disposition','Unknown autofill dispose action');}
  createState():AutofillGroupState{return new AutofillGroupState();}
  static maybeOf(context:BuildContext):AutofillGroupState|null{return context.maybeDependOn(AutofillScope)?.state??null;}
  static of(context:BuildContext):AutofillGroupState{const state=this.maybeOf(context);invariant(state,'missing-autofill-group','AutofillGroup.of requires an AutofillGroup ancestor');return state;}
}
export class AutofillGroupState extends State<AutofillGroup> {
  private serviceValue:AutofillService|undefined;private registration:AutofillGroupRegistration|undefined;private releaseService:(()=>void)|undefined;
  get service():AutofillService{invariant(this.serviceValue,'closed-autofill-group','Autofill group is not mounted');return this.serviceValue;}
  get section():string{invariant(this.registration?.active,'closed-autofill-group','Autofill group is closed');return this.registration.section;}
  get active():boolean{return this.registration?.active??false;}
  private updateParent():void{
    const parent=AutofillGroup.maybeOf(this.context);invariant(!this.serviceValue||this.widget.options.service===undefined||this.widget.options.service===this.serviceValue,'changed-autofill-service','Use a new key when replacing an AutofillGroup service');
    if(!this.registration){const own=this.widget.options.service?{service:this.widget.options.service,release:()=>{}}:acquire(this.context,parent?.service);invariant(!parent||parent.service===own.service,'foreign-autofill-group','Nested AutofillGroups must share a service');try{this.registration=own.service.beginGroup(this.context.services.owner,{parent:parent?.registration??null});this.serviceValue=own.service;this.releaseService=own.release;}catch(error){own.release();throw error;}}
    else{invariant(!parent||parent.service===this.serviceValue,'foreign-autofill-group','Moving an AutofillGroup across services requires a new key');this.registration.reparent(parent?.registration??null);}
  }
  override initState():void{super.initState();this.updateParent();}
  override didChangeDependencies():void{super.didChangeDependencies();this.updateParent();}
  override didUpdateWidget(old:AutofillGroup):void{super.didUpdateWidget(old);invariant(old.options.service===this.widget.options.service,'changed-autofill-service','Use a new key when replacing an AutofillGroup service');this.updateParent();}
  registerClient(id:string,hints:readonly string[]):Disposable{invariant(this.registration?.active,'closed-autofill-group','Autofill group is closed');return this.registration.registerClient(id,hints);}
  requestAutofill():Promise<AutofillRequestResult>{invariant(this.registration?.active,'closed-autofill-group','Autofill group is closed');return this.service.requestAutofill();}
  finish(shouldSave=true):Promise<AutofillRequestResult>{invariant(this.registration?.active,'closed-autofill-group','Autofill group is closed');return this.registration.finish(shouldSave);}
  build():Widget{return new AutofillScope(this,this.widget.options.child);}
  override dispose():void{
    const registration=this.registration,release=this.releaseService,report=this.context.services.reportError;this.registration=undefined;this.releaseService=undefined;this.serviceValue=undefined;
    const close=registration?.dispose(this.widget.options.onDisposeAction??'none')??Promise.resolve();void close.then(()=>release?.(),exception=>{release?.();if(report)report(exception);else FlutterError.reportError(new FlutterErrorDetails({exception,library:'widgets autofill'}));});super.dispose();
  }
}
class AutofillScope extends InheritedWidget {
  constructor(readonly state:AutofillGroupState,child:Widget){super(child);}
  updateShouldNotify(old:this):boolean{return old.state!==this.state;}
}
