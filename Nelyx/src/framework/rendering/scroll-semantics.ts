// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Internal source widgets/scrollable.dart semantics renderer; no public package entry.
import {SemanticsNode as SourceSemanticsNode} from '../semantics/semantics.ts';
import type {SemanticsConfiguration} from '../semantics/semantics.ts';
import {setSemanticsTransportProperties} from './semantics-transport.ts';
import type {SemanticsTransportProperties} from './semantics-transport.ts';
import {RenderViewport} from './viewport.ts';
import {RenderProxyBox} from './boxes.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import type {ScrollPosition} from '../widgets/scroll-position.ts';
import {Axis} from '../painting/basic-types.ts';
import {Offset} from '../../ui/offset.ts';
import type {SemanticsNode,Rect} from '../../ui/types.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';
let nextScrollSemantics=0;
/** Source two-pane assembly; host list identities are separate snapshot metadata. */
export class _RenderScrollSemantics extends RenderProxyBox {
  private readonly id='source-scroll-semantics-'+ ++nextScrollSemantics;private currentPosition:ScrollPosition;private implicitScrolling:boolean;private childCount:number|null;private innerNode:SourceSemanticsNode|null=null;
  private describedExtents:{readonly min:number;readonly max:number}|undefined;
  private readonly changed=()=>{
    const extents=this.describedExtents;
    if(extents&&this.position.haveDimensions&&extents.min===this.position.minScrollExtent&&extents.max===this.position.maxScrollExtent&&this.describedScrollable===this.scrollable&&this.hasStaticLayoutSemantics(_RenderScrollSemantics.prototype,_RenderScrollSemantics.prototype.describeSemanticsConfiguration))this.markNeedsSemanticsGeometryUpdate();
    else this.markNeedsSemanticsUpdate();
  };
  private readonly onScrollToOffset=(offset:Offset):void=>this.position.jumpTo(this.axis===Axis.horizontal?offset.dx:offset.dy);
  private describedScrollable:boolean|undefined;
  constructor(position:ScrollPosition,allowImplicitScrolling:boolean,public axis:Axis,semanticChildCount:number|null){super();this.currentPosition=position;this.implicitScrolling=allowImplicitScrolling;this.childCount=semanticChildCount;position.addListener(this.changed);}
  get position():ScrollPosition{return this.currentPosition;}set position(value:ScrollPosition){if(this.currentPosition===value)return;this.currentPosition.removeListener(this.changed);this.currentPosition=value;value.addListener(this.changed);this.markNeedsSemanticsUpdate();}
  get allowImplicitScrolling():boolean{return this.implicitScrolling;}set allowImplicitScrolling(value:boolean){if(value===this.implicitScrolling)return;this.implicitScrolling=value;this.markNeedsSemanticsUpdate();}
  get semanticChildCount():number|null{return this.childCount;}set semanticChildCount(value:number|null){if(value===this.childCount)return;this.childCount=value;this.markNeedsSemanticsUpdate();}
  protected override get hasSourceSemanticsConfiguration():boolean{return true;}
  override get semanticsTransport():SemanticsTransportProperties{return {id:this.id,role:this.innerNode===null?'list':'group',name:'',enabled:true};}
  private get scrollable():boolean{return this.position.haveDimensions&&this.position.maxScrollExtent>this.position.minScrollExtent&&this.allowImplicitScrolling;}
  protected override markNeedsPaintAfterLayout():void{
    if(this.hasStaticLayoutSemantics(_RenderScrollSemantics.prototype,_RenderScrollSemantics.prototype.describeSemanticsConfiguration)&&!Object.hasOwn(this,'assembleSemanticsNode')){
      this.markNeedsPaintAfterGeometryLayout();
      if(this.describedScrollable===this.scrollable)this.markNeedsSemanticsGeometryUpdate();else this.markNeedsSemanticsUpdate();
    }else super.markNeedsPaintAfterLayout();
  }
  override describeSemanticsConfiguration(config:SemanticsConfiguration):void{super.describeSemanticsConfiguration(config);config.isSemanticBoundary=true;config.hasImplicitScrolling=this.allowImplicitScrolling;this.describedScrollable=this.scrollable;this.describedExtents=this.position.haveDimensions?{min:this.position.minScrollExtent,max:this.position.maxScrollExtent}:undefined;if(this.position.haveDimensions){config.scrollPosition=this.position.pixels;config.scrollExtentMax=this.position.maxScrollExtent;config.scrollExtentMin=this.position.minScrollExtent;config.scrollChildCount=this.semanticChildCount;if(this.describedScrollable)config.onScrollToOffset=this.onScrollToOffset;}}
  override assembleSemanticsNode(node:SourceSemanticsNode,config:SemanticsConfiguration,children:SourceSemanticsNode[]):void{
    if(children.length===0||!children[0]!.isTagged(RenderViewport.useTwoPaneSemantics)){this.innerNode=null;super.assembleSemanticsNode(node,config,children);return;}
    (this.innerNode??=new SourceSemanticsNode({showOnScreen:()=>this.showOnScreen()})).rect=node.rect;let firstVisibleIndex:number|null=null;const excluded=[this.innerNode],included:SourceSemanticsNode[]=[];
    for(const child of children){if(FoundationBuildMode.debug)invariant(child.isTagged(RenderViewport.useTwoPaneSemantics),'missing-two-pane-tag','All viewport semantics children must have the two-pane tag');if(child.isTagged(RenderViewport.excludeFromScrolling))excluded.push(child);else{if(!child.flagsCollection.isHidden)firstVisibleIndex??=child.indexInParent;included.push(child);}}
    config.scrollIndex=firstVisibleIndex;node.updateWith({config:null,childrenInInversePaintOrder:excluded});this.innerNode.updateWith({config,childrenInInversePaintOrder:included});setSemanticsTransportProperties(this.innerNode,{id:this.id+'-scrolling',role:'list',name:'',enabled:true});
  }
  override clearSemantics():void{super.clearSemantics();this.innerNode=null;}
  override collectSemantics(output:SemanticsNode[],matrix?:TransformMatrix,clip?:Rect):void{this.semantics=this.semanticsTransport;super.collectSemantics(output,matrix,clip);}
  override dispose():void{this.currentPosition.removeListener(this.changed);super.dispose();}
}
