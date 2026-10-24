// SPDX-License-Identifier: BSD-3-Clause
// CPU ownership sidecars never enter serialized frame values or native packets.
import type {ResourceId,PaintCommand} from './types.ts';
export interface ResourceHold {dispose():void}
export type ResourceRetainer=()=>ResourceHold;
const factories=new WeakMap<ResourceId,{retain:ResourceRetainer;owner:object|null}>(),commandHolds=new WeakMap<PaintCommand,readonly ResourceHold[]>(),frameHolds=new WeakMap<readonly ResourceId[],readonly ResourceHold[]>();
export function bindResourceRetainer(resource:ResourceId,retain:ResourceRetainer,owner:object|null=null):void{factories.set(resource,{retain,owner});}
export function resourceOwner(resource:ResourceId):object|null{return factories.get(resource)?.owner??null;}
export function copyResourceId(resource:ResourceId):ResourceId{const copy=Object.freeze({id:resource.id,generation:resource.generation}),binding=factories.get(resource);if(binding)factories.set(copy,binding);return copy;}
export function retainResource(resource:ResourceId):ResourceHold|null{return factories.get(resource)?.retain()??null;}
function disposeAll(holds:readonly ResourceHold[]):void{let errors:unknown[]|undefined;for(let index=0;index<holds.length;index++)try{holds[index]!.dispose();}catch(error){(errors??=[]).push(error);}if(errors?.length===1)throw errors[0];if(errors)throw new AggregateError(errors,'Recorded resource retirement failed');}
export function retainCommandResources(command:PaintCommand):void{if(!('resource'in command)&&!('paint'in command&&command.paint.shader?.kind==='image'))return;const holds:ResourceHold[]=[];try{if('resource'in command){const hold=retainResource(command.resource);if(hold)holds.push(hold);}if('paint'in command&&command.paint.shader?.kind==='image'){const hold=retainResource(command.paint.shader.image);if(hold)holds.push(hold);}if(holds.length)commandHolds.set(command,holds);}catch(error){try{disposeAll(holds);}catch(cleanup){throw new AggregateError([error,cleanup],'Resource capture and rollback failed');}throw error;}}
export function releaseCommandResources(commands:readonly PaintCommand[]):void{let holds:ResourceHold[]|undefined;for(let index=0;index<commands.length;index++){const command=commands[index]!,owned=commandHolds.get(command);if(owned){
  // Deleting the sidecar already deduplicates repeated command identities.
  // Detach every hold before invoking retirement callbacks, including failures.
  commandHolds.delete(command);holds??=[];for(let hold=0;hold<owned.length;hold++)holds.push(owned[hold]!);
}}if(holds)disposeAll(holds);}
/** Transfer the newly captured command ownership to one frame admission. */
export function ownFrameResources(resources:readonly ResourceId[],commands:readonly PaintCommand[]):void{let holds:ResourceHold[]|undefined;for(let index=0;index<commands.length;index++){const command=commands[index]!,owned=commandHolds.get(command);if(owned){commandHolds.delete(command);holds??=[];for(let hold=0;hold<owned.length;hold++)holds.push(owned[hold]!);}}if(holds)frameHolds.set(resources,holds);}
export function releaseFrameResources(resources:readonly ResourceId[]):void{const holds=frameHolds.get(resources);if(holds){frameHolds.delete(resources);disposeAll(holds);}}
