// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Slot-owned M3 input layout on the canonical Core render protocol.
import {MultiChildRenderObjectWidget,LeafRenderObjectWidget} from '@nelyx/core/framework/widgets/framework';
import type {Widget,BuildContext} from '@nelyx/core/framework/widgets/framework';
import {KeyedSubtree} from '@nelyx/core/framework/widgets/basic';
import {ValueKey} from '@nelyx/core/foundation/key';
import type {Key} from '@nelyx/core/foundation/key';
import {RenderBox} from '@nelyx/core/framework/rendering/object';
import {RenderRepaintBoundary} from '@nelyx/core/framework/rendering/repaint-boundary';
import type {RenderObject,TextBaseline,PipelineOwner} from '@nelyx/core/framework/rendering/object';
import type {ValueListenable} from '@nelyx/core/foundation/notifier';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import type {PaintingContext} from '@nelyx/core/framework/painting/context';
import type {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import type {TextAlignVertical} from '@nelyx/core/framework/painting/text-align-vertical';
import {Paint} from '@nelyx/core/ui/paint';
import {Rect} from '@nelyx/core/ui/rect';
import {multiply} from '@nelyx/core/ui/geometry';
import type {Size,Offset,TransformMatrix} from '@nelyx/core/ui/geometry';
import {invariant} from '@nelyx/core/foundation/errors';
import type {InputBorder} from '../../input-border.ts';

export type DecorationSlot='container'|'icon'|'input'|'hint'|'prefixIcon'|'suffixIcon'|'prefix'|'suffix'|'label'|'helperError'|'counter';
export interface DecorationLayoutConfiguration {
    readonly padding:EdgeInsets;readonly direction:'ltr'|'rtl';readonly baseline:TextBaseline;
    readonly floatingLabelHeight:number;readonly labelProgress:number;readonly labelAlignment:number;readonly outline:boolean;readonly borderStrokeOffset:number;
    readonly hasLabel:boolean;readonly labelVisible:boolean;readonly isEmpty:boolean;readonly isCollapsed:boolean;readonly isDense:boolean;
    readonly maintainHintSize:boolean;readonly maintainLabelSize:boolean;readonly alignLabelWithHint:boolean;
    readonly density:{readonly width:number;readonly height:number};readonly inputGap:number;readonly expands:boolean;readonly vertical:TextAlignVertical|null;
}
export interface DecorationBorderConfiguration {readonly border:InputBorder;readonly fill:number;readonly direction:'ltr'|'rtl';readonly progress:number}
export class DecorationBorder extends LeafRenderObjectWidget {
    constructor(readonly configuration:DecorationBorderConfiguration,key:Key|null=null,readonly animation:ValueListenable<DecorationBorderConfiguration>|null=null){super(key);}
    createRenderObject():RenderObject{return new RenderDecorationBorder(this.configuration,this.animation);}
    updateRenderObject(_context:BuildContext,object:RenderObject):void{invariant(object instanceof RenderDecorationBorder,'invalid-decoration-border','Expected the input border render owner');object.configure(this.configuration,this.animation);}
}
class RenderDecorationBorder extends RenderRepaintBoundary {
    private listening=false;
    private readonly animationChanged=()=>{if(this.attached)this.markNeedsPaintOnly();};
    private gapStartValue:number|null=null;private gapExtentValue=0;
    get gapStart():number|null{return this.gapStartValue;}
    set gapStart(value:number|null){if(value===this.gapStartValue)return;this.gapStartValue=value;this.markNeedsPaintOnly();}
    get gapExtent():number{return this.gapExtentValue;}
    set gapExtent(value:number){if(value===this.gapExtentValue)return;this.gapExtentValue=value;this.markNeedsPaintOnly();}
    protected override get childCountLimit():number{return 0;}
    constructor(private configuration:DecorationBorderConfiguration,private animation:ValueListenable<DecorationBorderConfiguration>|null){super();}
    private startListening():void{if(!this.listening&&this.animation&&this.attached){this.animation.addListener(this.animationChanged);this.listening=true;}}
    private stopListening():void{if(this.listening){this.listening=false;this.animation!.removeListener(this.animationChanged);}}
    override attach(owner:PipelineOwner):void{super.attach(owner);this.startListening();}
    override detach():void{try{super.detach();}finally{if(!this.attached)this.stopListening();}}
    override dispose():void{try{super.dispose();}finally{if(this.debugDisposed)this.stopListening();}}
    configure(value:DecorationBorderConfiguration,animation:ValueListenable<DecorationBorderConfiguration>|null):void{if(this.animation!==animation){this.stopListening();this.animation=animation;this.startListening();}this.configuration=value;this.markNeedsPaintOnly();}
    protected override computeDryLayout(constraints:BoxConstraints):Size{return constraints.smallest;}
    protected override performLayout(constraints:BoxConstraints):Size{return this.computeDryLayout(constraints);}
    protected override paintContents(context:PaintingContext):void {
        const c=this.animation?.value??this.configuration,rect=Rect.fromLTWH(0,0,this.size.width,this.size.height);
        if(c.fill>>>24){const path=c.border.getOuterPath(rect,{textDirection:c.direction});context.drawPath(path,new Paint({color:c.fill}));}
        c.border.paint(context,rect,{textDirection:c.direction,gapStart:this.gapStart,gapExtent:this.gapExtent,gapPercentage:c.progress});
    }
}
export class DecorationLayout extends MultiChildRenderObjectWidget {
    readonly slots:readonly DecorationSlot[];
    constructor(slots:ReadonlyMap<DecorationSlot,Widget>,readonly configuration:DecorationLayoutConfiguration){
        super([...slots].map(([slot,child])=>new KeyedSubtree({key:new ValueKey(slot),child})));this.slots=Object.freeze([...slots.keys()]);
    }
    createRenderObject():RenderObject{return new RenderInputDecoration(this.slots,this.configuration);}
    updateRenderObject(_context:BuildContext,object:RenderObject):void{invariant(object instanceof RenderInputDecoration,'invalid-input-decorator-render','Expected the canonical input decoration render owner');object.configure(this.slots,this.configuration);}
}
interface Measured {readonly size:Size;readonly baseline:number;readonly constraints:BoxConstraints}
interface Measurement {readonly size:Size;readonly offsets:ReadonlyMap<DecorationSlot,Offset>;readonly baseline:number;readonly labelScale:number;readonly gapStart:number|null;readonly gapExtent:number}
const zero:Measured={size:{width:0,height:0},baseline:0,constraints:new BoxConstraints()};
const layoutFields=['direction','baseline','floatingLabelHeight','labelProgress','labelAlignment','outline','borderStrokeOffset','hasLabel','labelVisible','isEmpty','isCollapsed','isDense','maintainHintSize','maintainLabelSize','alignLabelWithHint','inputGap','expands'] as const;
const captureLayout=(value:DecorationLayoutConfiguration):DecorationLayoutConfiguration=>Object.freeze({...value,density:Object.freeze({...value.density})});
export class RenderInputDecoration extends RenderBox {
    private measured:Measurement|null=null;
    private slots:readonly DecorationSlot[];private configuration:DecorationLayoutConfiguration;
    constructor(slots:readonly DecorationSlot[],configuration:DecorationLayoutConfiguration){super();this.slots=Object.freeze([...slots]);this.configuration=captureLayout(configuration);}
    configure(slots:readonly DecorationSlot[],configuration:DecorationLayoutConfiguration):void{
        const previous=this.configuration,changed=this.slots.length!==slots.length||this.slots.some((slot,index)=>slot!==slots[index])||!previous.padding.equals(configuration.padding)||layoutFields.some(field=>previous[field]!==configuration[field])||previous.density.width!==configuration.density.width||previous.density.height!==configuration.density.height||previous.vertical?.y!==configuration.vertical?.y;
        this.slots=Object.freeze([...slots]);this.configuration=captureLayout(configuration);if(changed)this.markNeedsLayout();
    }
    private childFor(slot:DecorationSlot):RenderBox<RenderObject>|undefined{return this.children[this.slots.indexOf(slot)];}
    get container():RenderBox<RenderObject>|null{return this.childFor('container')??null;}
    private measure(constraints:BoxConstraints,dry:boolean,intrinsic=false):Measurement {
        invariant(constraints.hasBoundedWidth,'unbounded-input-decoration','InputDecorator requires bounded width');
        const c=this.configuration,p=c.padding,startPadding=c.direction==='rtl'?p.right:p.left,endPadding=c.direction==='rtl'?p.left:p.right,width=constraints.maxWidth,measured=new Map<DecorationSlot,Measured>(),offsets=new Map<DecorationSlot,Offset>();
        invariant(intrinsic||!c.expands||constraints.hasBoundedHeight,'unbounded-expanded-input','Expanded input requires bounded height');
        const measure=(slot:DecorationSlot,box:BoxConstraints):Measured=>{
            const child=this.childFor(slot);if(!child)return zero;
            const size=dry?child.getDryLayout(box):(child.layout(box,{parentUsesSize:true}),child.size);
            const baseline=(dry?child.getDryBaseline(box,c.baseline):child.getDistanceToActualBaseline(c.baseline))??size.height;
            const value={size,baseline,constraints:box};measured.set(slot,value);return value;
        };
        const loose=new BoxConstraints(0,width,0,constraints.maxHeight),icon=measure('icon',loose),containerWidth=Math.max(0,width-icon.size.width);
        const prefixIcon=measure('prefixIcon',new BoxConstraints(0,containerWidth,0,constraints.maxHeight));
        const suffixIcon=measure('suffixIcon',new BoxConstraints(0,Math.max(0,containerWidth-prefixIcon.size.width),0,constraints.maxHeight));
        const start=this.childFor('prefixIcon')?prefixIcon.size.width+4:startPadding+c.inputGap;
        const finish=this.childFor('suffixIcon')?suffixIcon.size.width+4:endPadding+c.inputGap;
        const inlineWidth=Math.max(0,containerWidth-start-finish),prefix=measure('prefix',new BoxConstraints(0,inlineWidth,0,constraints.maxHeight));
        const suffix=measure('suffix',new BoxConstraints(0,Math.max(0,inlineWidth-prefix.size.width),0,constraints.maxHeight));
        const prefixGap=this.childFor('prefix')?4:0,suffixGap=this.childFor('suffix')?4:0;
        const inputWidth=Math.max(0,inlineWidth-prefix.size.width-suffix.size.width-prefixGap-suffixGap);
        const counter=measure('counter',new BoxConstraints(0,Math.max(0,containerWidth-p.horizontal),0,Infinity));
        const helper=measure('helperError',new BoxConstraints(0,Math.max(0,containerWidth-p.horizontal-counter.size.width-(this.childFor('counter')?16:0)),0,Infinity));
        const footerHeight=Math.max(counter.size.height,helper.size.height),footerAscent=Math.max(counter.baseline,helper.baseline);
        const footer=footerHeight>0?4+footerAscent+Math.max(counter.size.height-counter.baseline,helper.size.height-helper.baseline):0;
        const floating=c.hasLabel&&!c.outline&&!c.isCollapsed?c.floatingLabelHeight:0;
        const maxInputHeight=Math.max(0,constraints.maxHeight-p.vertical-floating-footer);
        const inputConstraints=new BoxConstraints(inputWidth,inputWidth,0,maxInputHeight),input=measure('input',inputConstraints),hint=measure('hint',inputConstraints.loosen());
        const labelScale=1-.25*c.labelProgress,label=measure('label',new BoxConstraints(0,Math.max(0,inlineWidth/labelScale),0,Infinity));
        const useHint=c.isEmpty||c.maintainHintSize;
        const labelInRow=c.hasLabel&&c.labelProgress===0&&(c.labelVisible||c.maintainLabelSize);
        const ascent=Math.max(input.baseline,prefix.baseline,suffix.baseline,useHint?hint.baseline:0,labelInRow?label.baseline:0);
        const descent=Math.max(input.size.height-input.baseline,prefix.size.height-prefix.baseline,suffix.size.height-suffix.baseline,useHint?hint.size.height-hint.baseline:0,labelInRow?label.size.height-label.baseline:0);
        const rowHeight=ascent+descent,minHeight=c.isDense||c.isCollapsed?0:48;
        const naturalHeight=Math.max(minHeight,p.top+floating+rowHeight+p.bottom+c.density.height,prefixIcon.size.height,suffixIcon.size.height);
        const availableHeight=Math.max(0,constraints.maxHeight-footer),containerHeight=c.expands&&!intrinsic?availableHeight:Math.min(Math.max(0,naturalHeight),availableHeight);
        const result=constraints.constrain({width,height:Math.max(icon.size.height,containerHeight+footer)});
        const containerX=c.direction==='ltr'?icon.size.width:0;
        const contentTop=Math.max(0,p.top+floating+c.density.height/2),contentBottom=containerHeight-p.bottom-c.density.height/2;
        const alignment=c.vertical?.y??(c.outline?-0.0:-1),available=Math.max(0,contentBottom-contentTop-rowHeight);
        const rowTop=contentTop+available*(alignment+1)/2,baseline=rowTop+ascent;
        const place=(slot:DecorationSlot,logicalX:number,y:number)=>{
            const item=measured.get(slot);if(!item)return;
            offsets.set(slot,{x:containerX+(c.direction==='ltr'?logicalX:containerWidth-logicalX-item.size.width),y});
        };
        const inputStart=start+prefix.size.width+prefixGap;
        place('input',inputStart,baseline-input.baseline);place('hint',inputStart,baseline-hint.baseline);
        place('prefix',start,baseline-prefix.baseline);place('suffix',containerWidth-finish-suffix.size.width,baseline-suffix.baseline);
        place('prefixIcon',0,(containerHeight-prefixIcon.size.height)/2);place('suffixIcon',containerWidth-suffixIcon.size.width,(containerHeight-suffixIcon.size.height)/2);
        if(this.childFor('icon'))offsets.set('icon',{x:c.direction==='ltr'?0:containerWidth,y:(containerHeight-icon.size.height)/2});
        const inlineLabelY=c.alignLabelWithHint?baseline-label.baseline:(containerHeight-label.size.height)/2;
        const floatingLabelY=c.outline?-label.size.height*.75/2-c.borderStrokeOffset/2:p.top+c.density.height/2;
        const floatingStart=startPadding+(c.outline?c.inputGap:0),floatingX=floatingStart+(containerWidth-p.horizontal-label.size.width*.75)*((c.labelAlignment+1)/2);
        const logicalLabelX=inputStart*(1-c.labelProgress)+floatingX*c.labelProgress;
        if(this.childFor('label'))offsets.set('label',{x:containerX+(c.direction==='ltr'?logicalLabelX:containerWidth-logicalLabelX-label.size.width*labelScale),y:inlineLabelY*(1-c.labelProgress)+floatingLabelY*c.labelProgress});
        place('helperError',startPadding+c.inputGap,containerHeight+4+footerAscent-helper.baseline);
        place('counter',containerWidth-endPadding-c.inputGap-counter.size.width,containerHeight+4+footerAscent-counter.baseline);
        if(this.childFor('container')){
            measure('container',BoxConstraints.tight({width:containerWidth,height:containerHeight}));offsets.set('container',{x:containerX,y:0});
        }
        return {size:result,offsets,baseline,labelScale,gapStart:this.childFor('label')?(c.direction==='rtl'?containerWidth-floatingX:floatingX):null,gapExtent:label.size.width*.75};
    }
    protected override performLayout(constraints:BoxConstraints):Size {
        const measured=this.measure(constraints,false);this.measured=measured;
        this.slots.forEach((slot,index)=>{const offset=measured.offsets.get(slot);if(offset)this.children[index]!.layoutOffset=offset;});
        const border=this.childFor('container');if(border instanceof RenderDecorationBorder){border.gapStart=measured.gapStart;border.gapExtent=measured.gapExtent;}
        return measured.size;
    }
    protected override computeDryLayout(constraints:BoxConstraints):Size{return this.measure(constraints,true).size;}
    protected override computeDryBaseline(constraints:BoxConstraints,_baseline:TextBaseline):number{return this.measure(constraints,true).baseline;}
    protected override computeDistanceToActualBaseline(_baseline:TextBaseline):number|null{return this.measured?.baseline??null;}
    protected override childTransform(child:RenderObject):TransformMatrix {
        const matrix=super.childTransform(child),scale=this.measured?.labelScale??1;return child===this.childFor('label')?multiply(matrix,[scale,0,0,scale,0,0]):matrix;
    }
    private intrinsicWidth(max:boolean,height:number):number {
        const c=this.configuration,p=c.padding,get=(slot:DecorationSlot)=>{const child=this.childFor(slot);return child?(max?child.getMaxIntrinsicWidth(height):child.getMinIntrinsicWidth(height)):0;};
        const start=this.childFor('prefixIcon')?get('prefixIcon')+4:p.left+c.inputGap,finish=this.childFor('suffixIcon')?get('suffixIcon')+4:p.right+c.inputGap;
        const content=Math.max(get('input'),c.isEmpty||c.maintainHintSize?get('hint'):0,c.labelVisible||c.maintainLabelSize?get('label'):0)+get('prefix')+get('suffix')+(this.childFor('prefix')?4:0)+(this.childFor('suffix')?4:0);
        return get('icon')+Math.max(start+content+finish,p.horizontal+get('helperError')+get('counter')+(this.childFor('counter')?16:0));
    }
    protected override computeMinIntrinsicWidth(height:number):number{return this.intrinsicWidth(false,height);}
    protected override computeMaxIntrinsicWidth(height:number):number{return this.intrinsicWidth(true,height);}
    protected override computeMinIntrinsicHeight(width:number):number{return this.measure(new BoxConstraints(0,Number.isFinite(width)?width:this.intrinsicWidth(false,Infinity)),true,true).size.height;}
    protected override computeMaxIntrinsicHeight(width:number):number{return this.measure(new BoxConstraints(0,Number.isFinite(width)?width:this.intrinsicWidth(true,Infinity)),true,true).size.height;}
}
