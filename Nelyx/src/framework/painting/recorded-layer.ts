// SPDX-License-Identifier: BSD-3-Clause
// Internal bridge from Canvas state scopes to the framework's actual layer tree.
import {invariant} from '../../foundation/errors.ts';
import {ContainerLayer} from '../rendering/layer.ts';
import type {AnnotationResult} from '../rendering/layer.ts';
import type {Layer} from '../rendering/layer.ts';
import type {SceneBuilder} from '../../ui/scene.ts';
import {freezePaintCommand} from '../../ui/frame.ts';
import {releaseCommandResources} from '../../ui/resource-retention.ts';
import type {PaintCommand} from '../../ui/types.ts';
import {matrix4Identity,matrix4FromAffine,captureMatrix4,multiplyMatrix4} from '../../ui/matrix4.ts';
import type {Matrix4Storage} from '../../ui/matrix4.ts';
import type {Matrix2D} from '../../ui/geometry.ts';
import {contains,transform,inverse,captureTransform} from '../../ui/geometry.ts';
import type {Offset} from '../../ui/geometry.ts';
import {RRect} from '../../ui/rrect.ts';
import {Radius} from '../../ui/radius.ts';
export class RecordedCanvasLayer extends ContainerLayer {
  private readonly prefix:PaintCommand[]=[];
  constructor(command:PaintCommand){super();this.appendState(command);}
  appendState(command:PaintCommand):void{this.assertMutable();invariant(!this.hasChildren&&this.engineLayer===null,'closed-canvas-layer','Canvas scope has already been used');invariant(['transform','clip','clipRect','clipRRect','clipPath','saveLayer','saveBackdropFilter'].includes(command.op),'invalid-canvas-layer','Expected a Canvas state operation');this.prefix.push(freezePaintCommand(command));}
  override addToScene(builder:SceneBuilder):void{this.engineLayer=builder._pushCommands(this.prefix,this.engineLayer);this.addChildrenToScene(builder);builder.pop();}
  override applyTransform(child:Layer|null,transform:Matrix4Storage=matrix4Identity):Matrix4Storage{
    let result=super.applyTransform(child,transform);for(const command of this.prefix)if(command.op==='transform')result=multiplyMatrix4(result,command.matrix.length===6?matrix4FromAffine(command.matrix as unknown as Matrix2D):captureMatrix4(command.matrix));return result;
  }
  override findAnnotations<T extends {}>(result:AnnotationResult<T>,localPosition:Offset,options:{readonly onlyFirst:boolean}):boolean{
    let point=localPosition;
    for(const command of this.prefix){
      if(command.op==='transform'){const matrix=inverse(captureTransform(command.matrix));if(!matrix)return false;point=transform(matrix,point);if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return false;}
      else if(command.op==='clip'||command.op==='clipRect'){const inside=contains(command.rect,point);if(command.op==='clip'||command.clipOp==='intersect'){if(!inside)return false;}else if(inside)return false;}
      else if(command.op==='clipRRect'){let shape:RRect;if('rrect'in command){const v=command.rrect.values;shape=new RRect(v[0],v[1],v[2],v[3],{topLeft:new Radius(v[4],v[5]),topRight:new Radius(v[6],v[7]),bottomRight:new Radius(v[8],v[9]),bottomLeft:new Radius(v[10],v[11])});}else shape=RRect.fromRectXY(command.rect,command.radius,command.radius);if(shape.contains(point)===(command.clipOp==='difference'))return false;}
      else if(command.op==='clipPath'){invariant(result.options.paths,'missing-path-queries','Canvas clipPath annotation search requires an engine geometry service');const inside=result.options.paths.contains(command.path,point);invariant(typeof inside==='boolean','invalid-path-query-result','Engine containment must return a boolean');if(inside===(command.clipOp==='difference'))return false;}
    }
    return super.findAnnotations(result,point,options);
  }
  override dispose():void{const errors:unknown[]=[];try{super.dispose();}catch(error){errors.push(error);}if(this.debugDisposed)try{releaseCommandResources(this.prefix);}catch(error){errors.push(error);}if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Canvas layer retirement failed');}
}
