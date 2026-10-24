// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Direct source enums/helpers only; dart:ui exports remain in their own modules.
class PaintingEnum {
  protected constructor(readonly index:number,readonly name:string,private readonly label:string){Object.freeze(this);}
  toString():string{return this.label+'.'+this.name;}
}
export class RenderComparison extends PaintingEnum {
  static readonly identical=new RenderComparison(0,'identical');static readonly metadata=new RenderComparison(1,'metadata');static readonly paint=new RenderComparison(2,'paint');static readonly layout=new RenderComparison(3,'layout');
  static readonly values=Object.freeze([RenderComparison.identical,RenderComparison.metadata,RenderComparison.paint,RenderComparison.layout]);private constructor(index:number,name:string){super(index,name,'RenderComparison');}
}
export class Axis extends PaintingEnum {
  static readonly horizontal=new Axis(0,'horizontal');static readonly vertical=new Axis(1,'vertical');static readonly values=Object.freeze([Axis.horizontal,Axis.vertical]);private constructor(index:number,name:string){super(index,name,'Axis');}
}
export class VerticalDirection extends PaintingEnum {
  static readonly up=new VerticalDirection(0,'up');static readonly down=new VerticalDirection(1,'down');static readonly values=Object.freeze([VerticalDirection.up,VerticalDirection.down]);private constructor(index:number,name:string){super(index,name,'VerticalDirection');}
}
export class AxisDirection extends PaintingEnum {
  static readonly up=new AxisDirection(0,'up');static readonly right=new AxisDirection(1,'right');static readonly down=new AxisDirection(2,'down');static readonly left=new AxisDirection(3,'left');static readonly values=Object.freeze([AxisDirection.up,AxisDirection.right,AxisDirection.down,AxisDirection.left]);private constructor(index:number,name:string){super(index,name,'AxisDirection');}
}
export function flipAxis(direction:Axis):Axis{switch(direction){case Axis.horizontal:return Axis.vertical;case Axis.vertical:return Axis.horizontal;default:throw new TypeError('Unknown Axis');}}
export function axisDirectionToAxis(direction:AxisDirection):Axis{switch(direction){case AxisDirection.up:case AxisDirection.down:return Axis.vertical;case AxisDirection.left:case AxisDirection.right:return Axis.horizontal;default:throw new TypeError('Unknown AxisDirection');}}
export function textDirectionToAxisDirection(direction:'ltr'|'rtl'):AxisDirection{switch(direction){case 'rtl':return AxisDirection.left;case 'ltr':return AxisDirection.right;default:throw new TypeError('Unknown text direction');}}
export function flipAxisDirection(direction:AxisDirection):AxisDirection{switch(direction){case AxisDirection.up:return AxisDirection.down;case AxisDirection.right:return AxisDirection.left;case AxisDirection.down:return AxisDirection.up;case AxisDirection.left:return AxisDirection.right;default:throw new TypeError('Unknown AxisDirection');}}
export function axisDirectionIsReversed(direction:AxisDirection):boolean{switch(direction){case AxisDirection.up:case AxisDirection.left:return true;case AxisDirection.down:case AxisDirection.right:return false;default:throw new TypeError('Unknown AxisDirection');}}
