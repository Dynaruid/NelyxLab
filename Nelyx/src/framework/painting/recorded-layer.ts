// SPDX-License-Identifier: BSD-3-Clause
// One recording owns Canvas state and real Layer insertions. State scopes are
// instructions, rather than a second mutable Layer/EngineLayer hierarchy.
import {invariant} from '../../foundation/errors.ts';
import {ContainerLayer,Layer} from '../rendering/layer.ts';
import type {AnnotationResult} from '../rendering/layer.ts';
import type {SceneBuilder} from '../../ui/scene.ts';
import {freezePaintCommand} from '../../ui/frame.ts';
import {releaseCommandResources} from '../../ui/resource-retention.ts';
import type {PaintCommand} from '../../ui/types.ts';
import {matrix4Identity,matrix4FromAffine,captureMatrix4,multiplyMatrix4} from '../../ui/matrix4.ts';
import type {Matrix4Storage} from '../../ui/matrix4.ts';
import {contains,transform,inverse,captureTransform,identity} from '../../ui/geometry.ts';
import type {Matrix2D,Offset} from '../../ui/geometry.ts';
import {RRect} from '../../ui/rrect.ts';
import {Radius} from '../../ui/radius.ts';

interface Scope {
  readonly parent:Scope|null;
  readonly commands:PaintCommand[];
  readonly entries:Array<Scope|Layer>;
  scene:readonly PaintCommand[];
  closes:boolean;
}
const none:readonly PaintCommand[]=Object.freeze([]);
const save:readonly PaintCommand[]=Object.freeze([freezePaintCommand({op:'save'})]);
const restore:readonly PaintCommand[]=Object.freeze([freezePaintCommand({op:'restore'})]);
const scope=(parent:Scope|null):Scope=>({parent,commands:[],entries:[],scene:none,closes:false});
const isIdentity=(matrix:readonly number[])=>{const expected=matrix.length===6?identity:matrix4Identity;return expected.length===matrix.length&&expected.every((value,index)=>matrix[index]===value);};

/** Preserve operation order, including clip queries and singular transforms.
 * Combining prefix matrices would change rounding and clip semantics. */
function pointInScope<T extends {}>(commands:readonly PaintCommand[],position:Offset,result:AnnotationResult<T>):Offset|null{
  let point=position;
  for(const command of commands){
    if(command.op==='transform'){const matrix=inverse(captureTransform(command.matrix));if(!matrix)return null;point=transform(matrix,point);if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return null;}
    else if(command.op==='clip'||command.op==='clipRect'){const inside=contains(command.rect,point);if(command.op==='clip'||command.clipOp==='intersect'){if(!inside)return null;}else if(inside)return null;}
    else if(command.op==='clipRRect'){let shape:RRect;if('rrect'in command){const v=command.rrect.values;shape=new RRect(v[0],v[1],v[2],v[3],{topLeft:new Radius(v[4],v[5]),topRight:new Radius(v[6],v[7]),bottomRight:new Radius(v[8],v[9]),bottomLeft:new Radius(v[10],v[11])});}else shape=RRect.fromRectXY(command.rect,command.radius,command.radius);if(shape.contains(point)===(command.clipOp==='difference'))return null;}
    else if(command.op==='clipPath'){if(!(result.options.paths))invariant(false,'missing-path-queries','Canvas clipPath annotation search requires an engine geometry service');const inside=result.options.paths.contains(command.path,point);if(!(typeof inside==='boolean'))invariant(false,'invalid-path-query-result','Engine containment must return a boolean');if(inside===(command.clipOp==='difference'))return null;}
  }
  return point;
}

export class RecordedCompositionLayer extends ContainerLayer {
  private readonly program=scope(null);
  private readonly scopes:Scope[]=[this.program];
  private readonly childScopes=new Map<Layer,Scope>();
  private readonly states:PaintCommand[]=[];
  private readonly stack:Scope[]=[];
  private current=this.program;
  private sealed=false;
  private assertRecording():void{this.assertMutable();if(!(this.sealed===false))invariant(false,'closed-canvas-layer','Canvas recording has already ended');}
  private push(command:PaintCommand):void{const next=scope(this.current);next.commands.push(command);this.current.entries.push(next);this.scopes.push(next);this.current=next;}
  appendState(command:PaintCommand):void{
    this.assertRecording();
    if(command.op==='save'){this.stack.push(this.current);return;}
    if(command.op==='restore'){if(!(this.stack.length>0))invariant(false,'unbalanced-save','restore without save');this.current=this.stack.pop()!;return;}
    if(!(['transform','clip','clipRect','clipRRect','clipPath','saveLayer','saveBackdropFilter'].includes(command.op)))invariant(false,'invalid-canvas-layer','Expected a Canvas state operation');
    const captured=freezePaintCommand(command);this.states.push(captured);
    if(command.op==='saveLayer'||command.op==='saveBackdropFilter'){this.stack.push(this.current);this.push(captured);}
    else if(this.current!==this.program&&this.current.entries.length===0&&!this.stack.includes(this.current))this.current.commands.push(captured);
    else this.push(captured);
  }
  appendRecordedChild(child:Layer):void{this.assertRecording();this.appendAt(child,this.current);}
  /** Public appends are untransformed siblings outside private state scopes. */
  override append(child:Layer):void{this.appendAt(child,this.program);}
  private appendAt(child:Layer,parent:Scope):void{
    this.assertMutable();if(this.childScopes.has(child))invariant(false,'owned-child-layer','Only a live detached root layer can be appended');
    this.childScopes.set(child,parent);parent.entries.push(child);
    try{super.append(child);}catch(error){if(child._parent!==this){parent.entries.splice(parent.entries.indexOf(child),1);this.childScopes.delete(child);}throw error;}
  }
  override _removeChild(child:Layer):void{
    try{super._removeChild(child);}finally{
      if(child._parent!==this){const parent=this.childScopes.get(child);if(parent){const index=parent.entries.indexOf(child);if(index!==-1)parent.entries.splice(index,1);this.childScopes.delete(child);}}
    }
  }
  seal():void{
    this.assertRecording();if(!(this.stack.length===0))invariant(false,'unbalanced-save','unclosed save');
    for(const node of this.scopes){node.scene=Object.freeze(node.commands.filter(command=>command.op!=='transform'||!isIdentity(command.matrix)));node.closes=node.scene.length>0;}
    this.sealed=true;
  }
  /** Detach observers retain the old transform after sibling unlinking. */
  private containsChild(child:Layer):boolean{return child._parent===this&&(child._previous?child._previous._next===child:this.firstChild===child);}
  override addToScene(builder:SceneBuilder):void{
    this.assertMutable();if(!(this.sealed))invariant(false,'unfinished-canvas-layer','Finish the Canvas recording before composition');
    this.engineLayer=builder._pushCommands(none,this.engineLayer);
    const pending=[{node:this.program,index:0,entered:false}];
    while(pending.length){
      const frame=pending[pending.length-1]!,node=frame.node;
      if(!frame.entered){frame.entered=true;if(node.closes){const first=node.scene[0]!.op;if(first!=='saveLayer'&&first!=='saveBackdropFilter')builder._appendCanvasCommands(save);builder._appendCanvasCommands(node.scene);}}
      const entry=node.entries[frame.index++];
      if(entry instanceof Layer){if(this.containsChild(entry))entry._addToSceneWithRetainedRendering(builder);}
      else if(entry)pending.push({node:entry,index:0,entered:false});
      else{if(node.closes)builder._appendCanvasCommands(restore);pending.pop();}
    }
    builder.pop();
  }
  override applyTransform(child:Layer|null,matrix:Matrix4Storage=matrix4Identity):Matrix4Storage{
    let result=super.applyTransform(child,matrix);if(child===null)return result;
    const path:Scope[]=[];for(let node=this.childScopes.get(child);node;node=node.parent??undefined)path.push(node);
    for(let index=path.length-1;index>=0;index--)for(const command of path[index]!.commands)if(command.op==='transform')result=multiplyMatrix4(result,command.matrix.length===6?matrix4FromAffine(command.matrix as unknown as Matrix2D):captureMatrix4(command.matrix));
    return result;
  }
  protected override findChildrenAnnotations<T extends {}>(result:AnnotationResult<T>,position:Offset,options:{readonly onlyFirst:boolean}):boolean{
    const pending=[{node:this.program,point:position,index:this.program.entries.length-1}];
    while(pending.length){
      const frame=pending[pending.length-1]!;
      if(frame.index<0){pending.pop();if(pending.length&&options.onlyFirst&&!result.isEmpty)return false;continue;}
      const entry=frame.node.entries[frame.index--]!;
      if(entry instanceof Layer){if(this.containsChild(entry)){const absorbed=entry.findAnnotations(result,frame.point,options);if(absorbed||options.onlyFirst&&!result.isEmpty)return absorbed;}}
      else{const point=pointInScope(entry.commands,frame.point,result);if(point)pending.push({node:entry,point,index:entry.entries.length-1});else if(options.onlyFirst&&!result.isEmpty)return false;}
    }
    return false;
  }
  override dispose():void{
    const errors:unknown[]=[];try{super.dispose();}catch(error){errors.push(error);}
    if(this.debugDisposed){
      try{releaseCommandResources(this.states);}catch(error){errors.push(error);}
      this.states.length=0;this.childScopes.clear();
      // A caller can retain a disposed Layer. Drop its complete private program,
      // including the last active scope's parent chain and captured commands.
      for(const node of this.scopes){node.commands.length=0;node.entries.length=0;node.scene=none;node.closes=false;}
      this.current=this.program;this.scopes.length=0;this.stack.length=0;
    }
    if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Canvas recording retirement failed');
  }
}
