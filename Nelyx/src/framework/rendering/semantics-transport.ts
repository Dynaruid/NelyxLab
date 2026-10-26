// SPDX-License-Identifier: BSD-3-Clause
// Boundary between the source semantics owner and Nelyx's existing host overlay API.
import {SemanticsConfiguration,SemanticsNode,SemanticsTag,DebugSemanticsDumpOrder} from '../semantics/semantics.ts';
import {AttributedString} from '../semantics/attributed-string.ts';
import {SemanticsAction} from '../../ui/semantics-action.ts';
import {Tristate,CheckedState,SemanticsRole} from '../../ui/semantics.ts';
import type {SemanticsNode as HostNode,SemanticsAction as HostAction,Rect,ViewOwner,ViewMetrics,TextInputGeometry,SemanticsTextNavigation,SemanticsTextParagraph} from '../../ui/types.ts';
import type {TransformMatrix} from '../../ui/geometry.ts';
import {bounds,multiply,translate,identity,intersect,fullTransform} from '../../ui/geometry.ts';
import {captureMatrix4} from '../../ui/matrix4.ts';
import {invariant} from '../../foundation/errors.ts';
import type {RenderObject,PipelineOwner} from './object.ts';
import {existingSemanticsFor,existingPipelineSemantics} from './semantics-pipeline.ts';
import {TextSelection} from '../../services/text-editing.ts';

export type SemanticsTransportProperties=Omit<HostNode,'bounds'|'children'|'editorGeometry'>;
type Mutable<Value>={-readonly [Key in keyof Value]:Value[Key]};
const nodeProperties=new WeakMap<SemanticsNode,SemanticsTransportProperties>();
const renderRanges=new WeakMap<RenderObject,NonNullable<HostNode['numericRange']>>();
const renderRangeActions=new WeakMap<RenderObject,NonNullable<HostNode['rangeActions']>>();
export function setSemanticsTransportRange(render:RenderObject,value:HostNode['numericRange']|null,actions:HostNode['rangeActions']|null=null):boolean{
  const previousActions=renderRangeActions.get(render),changedActions=previousActions?.setValue!==actions?.setValue;
  if(actions&&value)renderRangeActions.set(render,Object.freeze({...actions}));else renderRangeActions.delete(render);
  if(value==null)return renderRanges.delete(render)||changedActions;
  const next=Object.freeze({...value}),previous=renderRanges.get(render),keys=Object.keys(next) as (keyof typeof next)[];
  if(previous&&keys.length===Object.keys(previous).length&&keys.every(key=>Object.hasOwn(previous,key)&&Object.is(previous[key],next[key])))return changedActions;
  renderRanges.set(render,next);return true;
}
/** Stable identities for manually assembled nodes (paragraph spans and painters). */
export function setSemanticsTransportProperties(node:SemanticsNode,properties:SemanticsTransportProperties):void{nodeProperties.set(node,properties);}
export function describeTransportSemantics(config:SemanticsConfiguration,value:SemanticsTransportProperties,showOnScreen:()=>void):void {
  config.isSemanticBoundary=value.role!=='text';
  config.attributedLabel=new AttributedString(value.name,{attributes:value.nameAttributes??[]});
  if(value.name||value.value)config.textDirection='ltr';
  config.identifier=value.semanticsIdentifier??'';config.isButton=value.role==='button';config.isTextField=value.role==='text-field';config.isImage=value.role==='image';config.isLink=value.isLink??false;
  config.tooltip=value.tooltip??'';
  if(value.role==='text-field'){config.isReadOnly=value.readOnly??false;config.isObscured=value.obscured??false;config.isMultiline=value.multiline??false;if(value.textSelection)config.textSelection=new TextSelection({baseOffset:value.textSelection.anchor,extentOffset:value.textSelection.focus});}
  if(value.role==='list'){config.role=SemanticsRole.list;config.explicitChildNodes=true;}
  config.isEnabled=value.enabled;if(value.selected!==undefined)config.isSelected=value.selected;config.isChecked=value.checked??null;config.isFocused=value.focusable===false?null:value.focused??(value.focusable?false:null);
  if(value.value!==undefined)config.value=value.value;if(value.scrollPosition!==undefined)config.scrollPosition=value.scrollPosition;if(value.indexInParent!==undefined)config.indexInParent=value.indexInParent;
  describeTransportActions(config,value,showOnScreen);
  for(const tag of value.tags??[])if(tag instanceof SemanticsTag)config.addTagForChildren(tag);
}
export function describeTransportActions(config:SemanticsConfiguration,value:SemanticsTransportProperties,showOnScreen:()=>void):void {
  const actions=value.actions;
  if(value.textActions?.setText)config.onSetText=value.textActions.setText;
  if(value.textActions?.setSelection)config.onSetSelection=selection=>value.textActions!.setSelection!({anchor:selection.baseOffset,focus:selection.extentOffset});
  if(value.textActions?.scrollRange)config.onShowOnScreen=range=>{if(range)value.textActions!.scrollRange!(range.start,range.end,range.alignToTop);else showOnScreen();};
  if(value.activate??actions?.activate)config.onTap=value.activate??actions!.activate!;
  if(actions?.focus)config.onFocus=actions.focus;
  if(actions?.['long-press'])config.onLongPress=actions['long-press'];
  if(actions?.increase)config.onIncrease=actions.increase;if(actions?.decrease)config.onDecrease=actions.decrease;
  if(actions?.['scroll-left'])config.onScrollLeft=actions['scroll-left'];if(actions?.['scroll-right'])config.onScrollRight=actions['scroll-right'];
  if(actions?.['scroll-up']??actions?.['scroll-backward'])config.onScrollUp=actions?.['scroll-up']??actions!['scroll-backward']!;
  if(actions?.['scroll-down']??actions?.['scroll-forward'])config.onScrollDown=actions?.['scroll-down']??actions!['scroll-forward']!;
}
const actionTypes:readonly [HostAction,SemanticsAction][]=[['activate',SemanticsAction.tap],['focus',SemanticsAction.focus],['long-press',SemanticsAction.longPress],['increase',SemanticsAction.increase],['decrease',SemanticsAction.decrease],['scroll-left',SemanticsAction.scrollLeft],['scroll-right',SemanticsAction.scrollRight],['scroll-up',SemanticsAction.scrollUp],['scroll-down',SemanticsAction.scrollDown]];

/** A published host action belongs to one accepted snapshot and its live source owner. */
export class SemanticsTransportSnapshot {
  private generation:object|null=null;private nextId=0;private readonly ids=new WeakMap<SemanticsNode,string>();
  private deferredGeneration:object|null=null;
  private pendingGeneration:object|null=null;
  constructor(private readonly pipeline:PipelineOwner,private readonly isLive:()=>boolean,private readonly deferAction?:(source:SemanticsNode,action:HostAction)=>void,private readonly deferRangeAction?:(source:SemanticsNode,value:number,range:NonNullable<HostNode['numericRange']>)=>void){}
  invalidate():void{this.generation=null;this.deferredGeneration=null;this.pendingGeneration=null;}
  /** Only the last published generation may request a fresh action after motion. */
  defer():void{this.pendingGeneration=null;if(this.generation!==null){this.deferredGeneration=this.generation;this.generation=null;}}
  capture(root:RenderObject,transform:TransformMatrix=identity,frame?:{readonly owner:ViewOwner;readonly metrics:ViewMetrics;readonly inputGeometryToken?:object}):{nodes:HostNode[];commit:()=>boolean} {
    const owner=this.pipeline.semanticsOwner;invariant(owner!==null,'missing-semantics-owner','A transport snapshot requires a source owner');const rootNode=owner.rootSemanticsNode,generation={};this.pendingGeneration=generation;
    const commit=()=>{if(this.pendingGeneration!==generation)return false;this.pendingGeneration=null;if(!this.isLive()||this.pipeline.semanticsOwner!==owner||owner.rootSemanticsNode!==rootNode)return false;this.generation=rootNode===null?null:generation;this.deferredGeneration=null;return true;};
    if(rootNode===null)return {nodes:[],commit};
    const ranges=new Map<SemanticsNode,NonNullable<HostNode['numericRange']>>(),rangeActions=new Map<SemanticsNode,NonNullable<HostNode['rangeActions']>>(),properties=new Map<SemanticsNode,SemanticsTransportProperties>(),editors=new Map<SemanticsNode,NonNullable<HostNode['editorGeometry']>>();
    const inputGeometry=new Map<SemanticsNode,TextInputGeometry>(),textNavigation=new Map<SemanticsNode,SemanticsTextNavigation>(),textParagraphs=new Map<SemanticsNode,SemanticsTextParagraph>();
    const identify=(render:RenderObject)=>{const state=existingSemanticsFor(render),value=render.semanticsTransport;const range=renderRanges.get(render);if(range&&state?.cachedSemanticsNode?.owner===owner){ranges.set(state.cachedSemanticsNode,range);const action=renderRangeActions.get(render);if(action)rangeActions.set(state.cachedSemanticsNode,action);}if(state?.cachedSemanticsNode?.owner===owner&&!state.parentDataDirty&&state.shouldFormSemanticsNode&&value!==null){properties.set(state.cachedSemanticsNode,value);
      if(value.role==='text-field'){
        const matrix=fullTransform(multiply(transform,render.getTransformTo(root))),scaleX=matrix[0],scaleY=matrix[5],local=render.semanticBounds;
        const geometry=frame?render.readTextInputGeometry(frame.owner,frame.metrics,frame.inputGeometryToken):null;
        if(geometry){inputGeometry.set(state.cachedSemanticsNode,geometry);const navigation=render.coreTextNavigation;if(navigation)textNavigation.set(state.cachedSemanticsNode,navigation);const paragraph=render.coreTextParagraph;if(paragraph)textParagraphs.set(state.cachedSemanticsNode,paragraph);}
        // Positive axis-aligned scale/translation includes source stretch. Do
        // not represent rotation, perspective or shear as a text font-size change.
        if(scaleX>0&&scaleY>0&&matrix[1]===0&&matrix[4]===0&&matrix[3]===0&&matrix[7]===0&&matrix[15]===1){
          const full=bounds(multiply(matrix,translate(local.x,local.y)),{width:local.width,height:local.height});
          if([full.x,full.y,full.width,full.height,scaleX,scaleY].every(Number.isFinite))editors.set(state.cachedSemanticsNode,{bounds:full,scaleX,scaleY});
        }
      }
    }};
    for(const render of existingPipelineSemantics(this.pipeline)!.transportSources)if(render.owner===this.pipeline)identify(render);
    const rootClip=bounds(transform,{width:root.semanticBounds.width,height:root.semanticBounds.height});let count=0;
    const visit=(node:SemanticsNode,parentTransform:TransformMatrix,clip:Rect,depth:number):HostNode[]=>{
      invariant(++count<=2048&&depth<=64,'semantics-budget','Source semantics exceeds the host snapshot budget');const data=node.getSemanticsData();if(node.isInvisible||data.flagsCollection.isHidden)return [];
      const matrix=node.transform?multiply(parentTransform,captureMatrix4(node.transform.storage)):parentTransform,projected=bounds(multiply(matrix,translate(data.rect.left,data.rect.top)),{width:data.rect.width,height:data.rect.height});if(![projected.x,projected.y,projected.width,projected.height].every(Number.isFinite))return [];
      let visibleClip=clip;if(node.parentPaintClipRect){const p=node.parentPaintClipRect,projectedClip=bounds(multiply(matrix,translate(p.left,p.top)),{width:p.width,height:p.height});if(![projectedClip.x,projectedClip.y,projectedClip.width,projectedClip.height].every(Number.isFinite))return [];visibleClip=intersect(visibleClip,projectedClip);}
      const rect=intersect(projected,visibleClip);if(rect.width<=0||rect.height<=0)return [];
      const children=node.mergeAllDescendantsIntoThisNode?[]:node.debugListChildrenInOrder(DebugSemanticsDumpOrder.traversalOrder).flatMap(child=>visit(child,matrix,visibleClip,depth+1));
      const metadata=properties.get(node)??nodeProperties.get(node),numericRange=ranges.get(node)??metadata?.numericRange,flags=data.flagsCollection;
      const actions:Partial<Record<HostAction,()=>void>>={};let hasActions=false;for(const[name,action]of actionTypes)if(data.hasAction(action)){hasActions=true;actions[name]=()=>{if(metadata?.enabled===false||!this.isLive()||this.pipeline.semanticsOwner!==owner||owner.getSemanticsNode(node.id)!==node)return;if(this.deferredGeneration===generation){this.deferAction?.(node,name);return;}if(this.generation!==generation||node.isInvisible)return;const current=node.getSemanticsData();if(current.flagsCollection.isHidden||current.flagsCollection.isEnabled===Tristate.isFalse||!current.hasAction(action))return;owner.performAction(node.id,action);};}
      const forward=actions['scroll-down']??actions['scroll-right'],backward=actions['scroll-up']??actions['scroll-left'];if(forward)actions['scroll-forward']=forward;if(backward)actions['scroll-backward']=backward;
      // An unannotated synthetic root is a transport container, not a user-facing control.
      if(node===rootNode&&!metadata&&!data.label&&!data.value&&!data.tooltip&&!hasActions)return children;
      let id=metadata?.id??this.ids.get(node);if(id===undefined){id='source-semantics-'+ ++this.nextId;this.ids.set(node,id);}
      const role:HostNode['role']=flags.isTextField?'text-field':flags.isButton?'button':flags.isImage?'image':data.role===SemanticsRole.list?'list':metadata?.role??(actions.activate?'button':children.length?'group':'text');
      const geometry=role==='text-field'?inputGeometry.get(node):undefined,navigation=role==='text-field'&&!flags.isObscured?textNavigation.get(node):undefined;const paragraph=role==='text-field'&&!flags.isObscured?textParagraphs.get(node):undefined;
      const result:Mutable<HostNode>={id,sourceNodeId:node.id,role,name:data.label,nameAttributes:data.attributedLabel.attributes,enabled:flags.isEnabled!==Tristate.isFalse&&(metadata?.enabled??true),bounds:rect};
      if(navigation)result.textNavigation=navigation;if(paragraph)result.textParagraph=paragraph;
      if(role==='text-field'){
        const performText=(action:SemanticsAction,args:unknown)=>{if(metadata?.enabled===false||this.generation!==generation||!this.isLive()||this.pipeline.semanticsOwner!==owner||owner.getSemanticsNode(node.id)!==node||node.isInvisible)return;const current=node.getSemanticsData();if(current.flagsCollection.isHidden||current.flagsCollection.isEnabled===Tristate.isFalse||!current.hasAction(action))return;owner.performAction(node.id,action,args);};
        const textActions:Mutable<NonNullable<HostNode['textActions']>>={};
        if(data.hasAction(SemanticsAction.setText))textActions.setText=text=>performText(SemanticsAction.setText,text);
        if(data.hasAction(SemanticsAction.setSelection))textActions.setSelection=selection=>performText(SemanticsAction.setSelection,new Map([['base',selection.anchor],['extent',selection.focus]]));
        if(metadata?.textActions?.scrollRange&&data.hasAction(SemanticsAction.showOnScreen))textActions.scrollRange=(start,end,alignToTop)=>performText(SemanticsAction.showOnScreen,Object.freeze({start,end,alignToTop}));
        if(textActions.setText||textActions.setSelection||textActions.scrollRange)result.textActions=textActions;
        if(metadata?.textInputRevision!==undefined)result.textInputRevision=metadata.textInputRevision;
        if(metadata?.textRevision!==undefined)result.textRevision=metadata.textRevision;
        if(metadata?.textInputGeneration!==undefined)result.textInputGeneration=metadata.textInputGeneration;
        result.readOnly=flags.isReadOnly;result.obscured=flags.isObscured;result.multiline=flags.isMultiline;
        if(data.textSelection?.isValid)result.textSelection={anchor:data.textSelection.baseOffset,focus:data.textSelection.extentOffset};
        if(editors.has(node))result.editorGeometry=editors.get(node)!;
        if(metadata?.editorStyle)result.editorStyle=metadata.editorStyle;
      }
      if(geometry)result.textInputGeometry=geometry;if(flags.isSlider)result.isSlider=true;
      if(data.textDirection)result.textDirection=data.textDirection;if(numericRange)result.numericRange=numericRange;
      const rangeAction=rangeActions.get(node)??metadata?.rangeActions;
      if(numericRange&&rangeAction&&(data.hasAction(SemanticsAction.increase)||data.hasAction(SemanticsAction.decrease)))result.rangeActions={setValue:value=>{
        if(!Number.isFinite(value)||value<numericRange.min||value>numericRange.max||metadata?.enabled===false||!this.isLive()||this.pipeline.semanticsOwner!==owner||owner.getSemanticsNode(node.id)!==node||node.isInvisible)return;
        if(this.deferredGeneration===generation){this.deferRangeAction?.(node,value,numericRange);return;}if(this.generation!==generation)return;
        const current=node.getSemanticsData();if(current.flagsCollection.isHidden||current.flagsCollection.isEnabled===Tristate.isFalse||!current.hasAction(SemanticsAction.increase)&&!current.hasAction(SemanticsAction.decrease))return;
        rangeAction.setValue(value);
      }};
      if(data.role!==SemanticsRole.none)result.sourceRole=data.role;if(data.minValue)result.minValue=data.minValue;if(data.maxValue)result.maxValue=data.maxValue;
      if(data.tooltip)result.tooltip=data.tooltip;if(data.identifier)result.semanticsIdentifier=data.identifier;if(flags.isLink)result.isLink=true;
      if(data.value||metadata?.value!==undefined)result.value=data.value;
      if(flags.isSelected!==Tristate.none)result.selected=flags.isSelected===Tristate.isTrue;
      if(flags.isChecked===CheckedState.isTrue||flags.isChecked===CheckedState.isFalse)result.checked=flags.isChecked===CheckedState.isTrue;
      if(flags.isFocused!==Tristate.none){result.focused=flags.isFocused===Tristate.isTrue;result.focusable=true;}else if(metadata?.focusable!==undefined)result.focusable=metadata.focusable;
      if(data.scrollPosition!==null)result.scrollPosition=data.scrollPosition;if(node.indexInParent!==null)result.indexInParent=node.indexInParent;
      if(data.tags!==null)result.tags=[...data.tags];else if(metadata?.tags)result.tags=metadata.tags;
      if(actions.activate)result.activate=actions.activate;if(hasActions)result.actions=actions;if(children.length)result.children=children;
      return [result];
    };
    const nodes=visit(rootNode,transform,rootClip,0);return {nodes,commit};
  }
}
