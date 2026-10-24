// SPDX-License-Identifier: BSD-3-Clause
import {StatefulWidget,StatelessWidget,Element} from './framework.ts';
import type {Widget,BuildContext} from './framework.ts';
import type {Key} from '../../foundation/key.ts';
import {ValueKey} from '../../foundation/key.ts';
import {TickerProviderStateMixin} from './ticker-provider.ts';
import {AnimationStyle} from '../animation/animation-style.ts';
import {Curve} from '../animation/curves.ts';
import {Builder,Padding,Row,SizedBox,Text,Center} from './basic.ts';
import {EdgeInsets} from '../painting/edge-insets.ts';
import {checkedInteger} from '../../ui/value-math.ts';
import {RepaintBoundary} from './repaint-boundary.ts';
import type {RenderObject} from '../rendering/object.ts';
import {GestureDetector} from './gesture-detector.ts';
import type {DiagnosticsNode} from '../../foundation/diagnostics.ts';
import {DartInt,castSourceDartInt} from '../../foundation/dart-numeric.ts';
import {dartValueEquals,dartValueHash,dartValueString} from '../../foundation/dart-value.ts';
import {dartListClear,dartListAdd,dartListAddAll,dartListReversed} from '../../foundation/dart-mutable-list.ts';
export type TreeRuntimeType=Function;
export abstract class TreeStatefulHost extends StatefulWidget{
  constructor({key=null}:{key?:Key|null}={}){super(key);}
}
/** The source tree mixin contributes abstract contracts only. Ticker ownership
 * and State lifecycle are supplied by the actual Core provider superclass. */
export abstract class TreeStateHost<W extends StatefulWidget> extends TickerProviderStateMixin<W>{}
/** Source content keeps the registered Dart value's own string semantics. */
export function treeContentString(value:unknown):string{return dartValueString(value);}
/** The source node diagnostic joins its nullable integer depth with "root". */
export function treeDepthString(value:unknown):string{
  if(value==='root')return value;
  if(typeof value==='number'&&Number.isSafeInteger(value))return String(value);
  throw new TypeError('Source tree diagnostic depth must be root or a safe integer');
}
const indentationConstants=new WeakMap<Function,Map<number|string,unknown>>();
/** Named source constants are canonical only within their actual class owner. */
export function treeIndentationConstant<T>(owner:Function,create:(value:number)=>T,value:number):T{
  let cache=indentationConstants.get(owner);
  if(!cache){cache=new Map();indentationConstants.set(owner,cache);}
  const key=Object.is(value,-0)?'-0':value;
  if(!cache.has(key))cache.set(key,create(value));
  return cache.get(key)as T;
}
const animationStyles=new Map<Curve|null,Map<number|null,AnimationStyle>>();
/** Selected source const constructor uses only curve and duration. */
export function treeAnimationStyleConstant(owner:typeof AnimationStyle,{curve=null,duration=null}:{curve?:Curve|null;duration?:number|null}):AnimationStyle{
  if(owner!==AnimationStyle||curve!==null&&!(curve instanceof Curve)||duration!==null&&(!Number.isFinite(duration)||duration<0))throw new TypeError('Invalid tree animation style constant');
  let durations=animationStyles.get(curve);if(!durations){durations=new Map();animationStyles.set(curve,durations);}
  let value=durations.get(duration);if(!value){value=new AnimationStyle({curve,duration});durations.set(duration,value);}return value;
}
export function treeBuilder({builder}:{builder:(context:BuildContext)=>Widget}):Builder{return new Builder(builder);}
export function treeTapDetector({child,onTap}:{child:Widget;onTap:()=>void}):GestureDetector{return new GestureDetector(child,{onTap});}
export function treeDescribeElement(context:BuildContext,name:string):DiagnosticsNode{
  if(!(context instanceof Element))throw new TypeError('Tree diagnostics require an actual Element');return context.toDiagnosticsNode({name});
}
export function treePadding({padding,child}:{padding:EdgeInsets;child:Widget}):Padding{return new Padding(padding,child);}
export function treeRow({children}:{children:readonly Widget[]}):Row{return new Row(children);}
export function treeRepaintBoundary({child}:{child:Widget}):RepaintBoundary{return new RepaintBoundary(child);}
export function treeRenderParent(render:RenderObject):RenderObject|null{return render.parent??null;}
export function treeSquare({dimension,child=null}:{dimension:number;child?:Widget|null}):SizedBox{return SizedBox.square(dimension,child??undefined);}
const indexKeyToken=Symbol('source tree int key');
export function treeIndexKey(index:DartInt):ValueKey<DartInt>{castSourceDartInt(index);return new ValueKey(index,indexKeyToken,dartValueEquals,dartValueHash);}
const paddingConstants=new Map<number,EdgeInsets>();
export function treeEdgeInsetsConstant(owner:typeof EdgeInsets,value:number):EdgeInsets{
  if(owner!==EdgeInsets||!Number.isFinite(value))throw new TypeError('Invalid tree padding constant');
  let result=paddingConstants.get(value);if(!result){result=EdgeInsets.all(value);paddingConstants.set(value,result);}return result;
}
let spacer:SizedBox|undefined;
export function treeSpacerConstant(owner:typeof SizedBox,{width}:{width:number}):SizedBox{
  if(owner!==SizedBox||width!==8)throw new TypeError('Only the selected tree spacer constant is admitted');
  if(!spacer){spacer=new SizedBox(width);Object.freeze(spacer);}return spacer;
}
/** The selected default builder uses a Unicode arrow with no IconData font override. This
 * boundary admits that exact IconData/size pair, not the general Icon API. */
export class TreeArrowIconData{readonly codePoint=0x25ba;constructor(){Object.freeze(this);}}
export class TreeArrowIcon extends StatelessWidget{
  constructor(readonly icon:TreeArrowIconData,readonly size:number){super();Object.freeze(this);}
  build():Widget{return new SizedBox(this.size,this.size,new Center(new Text(String.fromCodePoint(this.icon.codePoint),{fontSize:this.size})));}
}
const arrowData=new TreeArrowIconData();let arrow:TreeArrowIcon|undefined;
export function treeArrowDataConstant(owner:typeof TreeArrowIconData,codePoint:number):TreeArrowIconData{
  if(owner!==TreeArrowIconData||codePoint!==0x25ba)throw new TypeError('Only the selected Unicode tree arrow is admitted');return arrowData;
}
export function treeArrowConstant(owner:typeof TreeArrowIcon,icon:TreeArrowIconData,{size}:{size:number}):TreeArrowIcon{
  if(owner!==TreeArrowIcon||icon!==arrowData||size!==14)throw new TypeError('Only the selected tree arrow size is admitted');return arrow??=new TreeArrowIcon(icon,size);
}
export function treeListEmpty(values:readonly unknown[]):boolean{return values.length===0;}
export function treeListNotEmpty(values:readonly unknown[]):boolean{return values.length!==0;}
export function treeListRead<T>(values:readonly T[],index:number):T{checkedInteger(index);if(index<0||index>=values.length)throw new RangeError('Tree list index is out of range');return values[index]!;}
export function treeListClear<T>(values:T[]):void{dartListClear(values);}
export function treeListAdd<T>(values:T[],value:T):void{dartListAdd(values,value);}
export function treeListAddAll<T>(values:T[],other:Iterable<T>):void{dartListAddAll(values,other);}
export function treeListIndexOf<T>(values:readonly T[],value:T):number{return values.indexOf(value);}
export function treeListContains<T>(values:Iterable<T>,value:T):boolean{for(const candidate of values)if(candidate===value)return true;return false;}
export function treeIterableForEach<T>(values:Iterable<T>,action:(value:T)=>void):void{for(const value of values)action(value);}
export function treeListReversed<T>(values:T[]):Iterable<T>{return dartListReversed(values);}
