// SPDX-License-Identifier: BSD-3-Clause
// Reviewed Flutter rendering/wrap.dart; provenance and deliberate pin corrections are in upstream/flutter-coverage.json.
import {invariant} from '../../foundation/errors.ts';
import type {Size,Offset} from '../../ui/geometry.ts';
import type {PaintingContext} from '../painting/context.ts';
import {BoxConstraints} from './constraints.ts';
import {RenderBox,ContainerBoxParentData} from './object.ts';
import type {RenderObject,TextBaseline} from './object.ts';
export type WrapAlignment='start'|'end'|'center'|'spaceBetween'|'spaceAround'|'spaceEvenly';
export type WrapCrossAlignment='start'|'end'|'center';
/** Existing frame replay supports antialiased rectangle clipping. Other Clip modes need the paint/layer expansion. */
export type WrapClipBehavior='none'|'antiAlias';
export interface RenderWrapOptions {
  readonly children?:readonly RenderBox<RenderObject>[];readonly direction?:'horizontal'|'vertical';readonly alignment?:WrapAlignment;readonly spacing?:number;
  readonly runAlignment?:WrapAlignment;readonly runSpacing?:number;readonly crossAxisAlignment?:WrapCrossAlignment;
  readonly textDirection?:'ltr'|'rtl'|null;readonly verticalDirection?:'up'|'down';readonly clipBehavior?:WrapClipBehavior;
}
export class WrapParentData extends ContainerBoxParentData<RenderBox<RenderObject>> {}
interface ChildMeasure {readonly child:RenderBox<RenderObject>;readonly size:Size}
interface Run {main:number;cross:number;readonly children:ChildMeasure[]}
interface Measurement {readonly size:Size;readonly children:readonly ChildMeasure[];readonly offsets:ReadonlyMap<RenderBox<RenderObject>,Offset>;readonly constraints:BoxConstraints;readonly overflow:boolean}
const alignments:readonly WrapAlignment[]=['start','end','center','spaceBetween','spaceAround','spaceEvenly'];
function choice<T>(value:T,values:readonly T[]):T{invariant(values.includes(value),'invalid-wrap-option','Unknown Wrap option');return value;}
function finite(value:number):number{invariant(Number.isFinite(value),'invalid-wrap-spacing','Wrap spacing must be finite');return value;}
function distribute(alignment:WrapAlignment,free:number,spacing:number,count:number,flipped:boolean):readonly [number,number]{
  switch(alignment){case 'start':return [flipped?free:0,spacing];case 'end':return [flipped?0:free,spacing];case 'center':return [free/2,spacing];case 'spaceBetween':return count<2?[flipped?free:0,spacing]:[0,free/(count-1)+spacing];case 'spaceAround':return [free/count/2,free/count+spacing];case 'spaceEvenly':return [free/(count+1),free/(count+1)+spacing];}
}
export class RenderWrap extends RenderBox {
  private axis:'horizontal'|'vertical';private mainAlignment:WrapAlignment;private gap:number;private runsAlignment:WrapAlignment;private runGap:number;
  private crossAlignment:WrapCrossAlignment;private textFlow:'ltr'|'rtl'|null;private verticalFlow:'up'|'down';private clipping:WrapClipBehavior;private visualOverflow=false;
  constructor(options:RenderWrapOptions={}){super();this.axis=choice(options.direction??'horizontal',['horizontal','vertical']);this.mainAlignment=choice(options.alignment??'start',alignments);this.gap=finite(options.spacing??0);this.runsAlignment=choice(options.runAlignment??'start',alignments);this.runGap=finite(options.runSpacing??0);this.crossAlignment=choice(options.crossAxisAlignment??'start',['start','end','center']);this.textFlow=choice(options.textDirection??null,['ltr','rtl',null]);this.verticalFlow=choice(options.verticalDirection??'down',['up','down']);this.clipping=choice(options.clipBehavior??'none',['none','antiAlias']);if(options.children)this.setChildren(options.children);}
  private change<T>(old:T,value:T,assign:()=>void):void{if(old!==value){assign();this.markNeedsLayout();}}
  get direction():'horizontal'|'vertical'{return this.axis;}set direction(value:'horizontal'|'vertical'){this.assertCanMutateLayoutProperty();choice(value,['horizontal','vertical']);this.change(this.axis,value,()=>{this.axis=value;});}
  get alignment():WrapAlignment{return this.mainAlignment;}set alignment(value:WrapAlignment){this.assertCanMutateLayoutProperty();choice(value,alignments);this.change(this.mainAlignment,value,()=>{this.mainAlignment=value;});}
  get spacing():number{return this.gap;}set spacing(value:number){this.assertCanMutateLayoutProperty();finite(value);this.change(this.gap,value,()=>{this.gap=value;});}
  get runAlignment():WrapAlignment{return this.runsAlignment;}set runAlignment(value:WrapAlignment){this.assertCanMutateLayoutProperty();choice(value,alignments);this.change(this.runsAlignment,value,()=>{this.runsAlignment=value;});}
  get runSpacing():number{return this.runGap;}set runSpacing(value:number){this.assertCanMutateLayoutProperty();finite(value);this.change(this.runGap,value,()=>{this.runGap=value;});}
  get crossAxisAlignment():WrapCrossAlignment{return this.crossAlignment;}set crossAxisAlignment(value:WrapCrossAlignment){this.assertCanMutateLayoutProperty();choice(value,['start','end','center']);this.change(this.crossAlignment,value,()=>{this.crossAlignment=value;});}
  get textDirection():'ltr'|'rtl'|null{return this.textFlow;}set textDirection(value:'ltr'|'rtl'|null){this.assertCanMutateLayoutProperty();choice(value,['ltr','rtl',null]);this.change(this.textFlow,value,()=>{this.textFlow=value;});}
  get verticalDirection():'up'|'down'{return this.verticalFlow;}set verticalDirection(value:'up'|'down'){this.assertCanMutateLayoutProperty();choice(value,['up','down']);this.change(this.verticalFlow,value,()=>{this.verticalFlow=value;});}
  get clipBehavior():WrapClipBehavior{return this.clipping;}set clipBehavior(value:WrapClipBehavior){this.assertCanMutateLayoutProperty();choice(value,['none','antiAlias']);if(value!==this.clipping){this.clipping=value;this.markNeedsPaint();}}
  override setupParentData(child:RenderObject):void{invariant(child instanceof RenderBox,'invalid-wrap-child','Wrap requires box children');if(!(child.parentData instanceof WrapParentData))child.parentData=new WrapParentData();}
  private validateDirections():void{const horizontal=this.axis==='horizontal',needs=horizontal?this.children.length>1||this.mainAlignment==='start'||this.mainAlignment==='end':this.runsAlignment==='start'||this.runsAlignment==='end'||this.crossAlignment!=='center';invariant(this.textFlow!==null||!needs,'missing-wrap-direction','Wrap requires textDirection to resolve horizontal order/start/end');}
  private measure(constraints:BoxConstraints,dry:boolean,position=true):Measurement{
    if(position)this.validateDirections();const horizontal=this.axis==='horizontal',inner=horizontal?new BoxConstraints(0,constraints.maxWidth):new BoxConstraints(0,Infinity,0,constraints.maxHeight),limit=horizontal?constraints.maxWidth:constraints.maxHeight;
    const runs:Run[]=[],children:ChildMeasure[]=[];let run:Run|undefined;
    for(const child of this.children){let size:Size;if(dry)size=child.getDryLayout(inner);else{child.layout(inner,{parentUsesSize:true});size=child.size;}const main=horizontal?size.width:size.height,cross=horizontal?size.height:size.width,item={child,size};children.push(item);
      if(!run||run.main+main+this.gap-limit>1e-10){run={main,cross,children:[item]};runs.push(run);}else{run.main+=main+this.gap;run.cross=Math.max(run.cross,cross);run.children.push(item);}}
    let naturalMain=0,naturalCross=0;for(const run of runs){naturalMain=Math.max(naturalMain,run.main);naturalCross+=run.cross;}naturalCross+=this.runGap*Math.max(0,runs.length-1);
    const size=constraints.constrain(horizontal?{width:naturalMain,height:naturalCross}:{width:naturalCross,height:naturalMain}),main=horizontal?size.width:size.height,cross=horizontal?size.height:size.width,offsets=new Map<RenderBox<RenderObject>,Offset>();let overflow=naturalMain>main||naturalCross>cross;
    if(position&&runs.length){const flipMain=horizontal?this.textFlow==='rtl':this.verticalFlow==='up',flipCross=horizontal?this.verticalFlow==='up':this.textFlow==='rtl',crossFactor=this.crossAlignment==='center'?0.5:(this.crossAlignment==='end')!==flipCross?1:0,[runLeading,runBetween]=distribute(this.runsAlignment,Math.max(0,cross-naturalCross),this.runGap,runs.length,flipCross);let crossOffset=runLeading;
      for(const run of flipCross?[...runs].reverse():runs){const [childLeading,childBetween]=distribute(this.mainAlignment,Math.max(0,main-run.main),this.gap,run.children.length,flipMain);let mainOffset=childLeading;
        for(const item of flipMain?[...run.children].reverse():run.children){const itemMain=horizontal?item.size.width:item.size.height,itemCross=horizontal?item.size.height:item.size.width,crossPosition=crossOffset+crossFactor*(run.cross-itemCross),offset=horizontal?{x:mainOffset,y:crossPosition}:{x:crossPosition,y:mainOffset};offsets.set(item.child,offset);overflow||=offset.x<0||offset.y<0||offset.x+item.size.width>size.width+1e-10||offset.y+item.size.height>size.height+1e-10;mainOffset+=itemMain+childBetween;}crossOffset+=run.cross+runBetween;}}
    return {size,children,offsets,constraints:inner,overflow};
  }
  protected override performLayout(constraints:BoxConstraints):Size{const result=this.measure(constraints,false);for(const [child,offset]of result.offsets)child.layoutOffset=offset;this.visualOverflow=result.overflow;return result.size;}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return this.measure(constraints,true,false).size;}
  protected override computeDryBaseline(constraints:BoxConstraints,baseline:TextBaseline):number|null{const result=this.measure(constraints,true);let highest:number|null=null;for(const {child}of result.children){const value=child.getDryBaseline(result.constraints,baseline);if(value!==null){const position=value+result.offsets.get(child)!.y;highest=highest===null?position:Math.min(highest,position);}}return highest;}
  protected override computeDistanceToActualBaseline(baseline:TextBaseline):number|null{let highest:number|null=null;for(const child of this.children){const value=child.getDistanceToActualBaseline(baseline);if(value!==null){const position=value+child.layoutOffset.y;highest=highest===null?position:Math.min(highest,position);}}return highest;}
  private intrinsicMain(min:boolean):number{let value=0,cursor=0,start=0,end=0;for(const child of this.children){const extent=this.axis==='horizontal'?(min?child.getMinIntrinsicWidth(Infinity):child.getMaxIntrinsicWidth(Infinity)):(min?child.getMinIntrinsicHeight(Infinity):child.getMaxIntrinsicHeight(Infinity));if(min)value=Math.max(value,extent);else{start=Math.min(start,cursor);end=Math.max(end,cursor+extent);cursor+=extent+this.gap;}}return min?value:Math.max(0,end-start);}
  protected override computeMinIntrinsicWidth(height:number):number{return this.axis==='horizontal'?this.intrinsicMain(true):this.getDryLayout(new BoxConstraints(0,Infinity,0,height)).width;}
  protected override computeMaxIntrinsicWidth(height:number):number{return this.axis==='horizontal'?this.intrinsicMain(false):this.getDryLayout(new BoxConstraints(0,Infinity,0,height)).width;}
  protected override computeMinIntrinsicHeight(width:number):number{return this.axis==='vertical'?this.intrinsicMain(true):this.getDryLayout(new BoxConstraints(0,width)).height;}
  protected override computeMaxIntrinsicHeight(width:number):number{return this.axis==='vertical'?this.intrinsicMain(false):this.getDryLayout(new BoxConstraints(0,width)).height;}
  override get clips():boolean{return this.visualOverflow&&this.clipping!=='none';}
  override paint(context:PaintingContext):void{if(this.clips){context.save();context.clip({x:0,y:0,...this.size});try{super.paint(context);}finally{context.restore();}}else super.paint(context);}
}
RenderBox._registerGeometryLayoutSemantics(RenderWrap.prototype);
