// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Rendering-library semantics fragments from the pinned rendering/object.dart.
import type {RenderObject,PipelineOwner} from './object.ts';
import {SemanticsConfiguration,SemanticsNode,SemanticsOwner,SemanticsTag,AccessibilityFocusBlockType} from '../semantics/semantics.ts';
import type {SemanticsOwnerOptions} from '../semantics/semantics.ts';
import type {Locale} from '../../ui/locale.ts';
import {Rect} from '../../ui/rect.ts';
import {Offset} from '../../ui/offset.ts';
import type {Rect as HostRect} from '../../ui/types.ts';
import {Matrix4} from '../../math/matrix4.ts';
import {MatrixUtils} from '../painting/matrix-utils.ts';
import {valueEquals,hashValues} from '../painting/value-equality.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {invariant} from '../../foundation/errors.ts';
import {DiagnosticableTreeMixin} from '../../foundation/diagnosticable.ts';
import {StringProperty} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder,DiagnosticsNode} from '../../foundation/diagnostics.ts';
import {FlagProperty} from '../../foundation/diagnostic-properties.ts';
import {describeIdentity} from '../../foundation/diagnostics-identity.ts';

function rectValue(value:HostRect):Rect{return value instanceof Rect?value:Rect.fromLTWH(value.x,value.y,value.width,value.height);}
function unionRects(a:Rect|null,b:Rect):Rect{return a===null?b:a.expandToInclude(b);}
function intersectRects(a:Rect|null,b:Rect):Rect{return a===null?b:a.intersect(b);}
function check(condition:unknown,message:string):void{if(FoundationBuildMode.debug)invariant(condition,'render-semantics-invariant',message);}
function addTags(target:Set<SemanticsTag>,tags:Iterable<SemanticsTag>):void{for(const tag of tags)if(![...target].some(other=>valueEquals(tag,other)))target.add(tag);}
function tagSet(tags:Iterable<SemanticsTag>):Set<SemanticsTag>{const result=new Set<SemanticsTag>();addTags(result,tags);return result;}
function sameTags(a:Set<SemanticsTag>|null,b:Set<SemanticsTag>|null):boolean{return a===b||a!==null&&b!==null&&a.size===b.size&&[...a].every(tag=>[...b].some(other=>valueEquals(tag,other)));}

class _SemanticsParentData {
  constructor(readonly mergeIntoParent:boolean,readonly blocksUserActions:boolean,readonly explicitChildNodes:boolean,readonly tagsForChildren:Set<SemanticsTag>|null,readonly localeForChildren:Locale|null,readonly accessibilityFocusBlockType:AccessibilityFocusBlockType|null){}
  equals(other:unknown):boolean{return other instanceof _SemanticsParentData&&this.mergeIntoParent===other.mergeIntoParent&&this.blocksUserActions===other.blocksUserActions&&this.explicitChildNodes===other.explicitChildNodes&&valueEquals(this.localeForChildren,other.localeForChildren)&&this.accessibilityFocusBlockType===other.accessibilityFocusBlockType&&sameTags(this.tagsForChildren,other.tagsForChildren);}
  get hashCode():number{return hashValues([this.mergeIntoParent,this.blocksUserActions,this.explicitChildNodes,this.localeForChildren,this.accessibilityFocusBlockType,[...this.tagsForChildren??[]].reduce((sum,tag)=>(sum+hashValues([tag]))>>>0,0)]);}
}
class _SemanticsConfigurationProvider {
  private writable=false;private originalConfiguration:SemanticsConfiguration|null=null;private effectiveConfiguration:SemanticsConfiguration|null=null;
  constructor(private readonly renderObject:RenderObject){}
  get wasSemanticsBoundary():boolean{return this.originalConfiguration?.isSemanticBoundary??false;}
  get effective():SemanticsConfiguration{return this.effectiveConfiguration??this.original;}
  get original():SemanticsConfiguration{if(this.originalConfiguration===null){const configuration=new SemanticsConfiguration();this.renderObject.describeSemanticsConfiguration(configuration);check(!configuration.explicitChildNodes||configuration.childConfigurationsDelegate===null,'Explicit semantic children cannot have a child configuration delegate');this.effectiveConfiguration=this.originalConfiguration=configuration;}return this.originalConfiguration;}
  private writableConfig():SemanticsConfiguration{if(!this.writable){this.effectiveConfiguration=this.original.copy();this.writable=true;}return this.effectiveConfiguration!;}
  updateConfig(callback:(config:SemanticsConfiguration)=>void):void{callback(this.writableConfig());}
  absorbAll(configs:Iterable<SemanticsConfiguration>):void{for(const child of configs)this.writableConfig().absorb(child);}
  reset():void{this.effectiveConfiguration=this.original;this.writable=false;}
  clear():void{this.writable=false;this.effectiveConfiguration=null;this.originalConfiguration=null;}
}
abstract class _SemanticsFragment extends DiagnosticableTreeMixin(class {}) {
  abstract readonly configToMergeUp:SemanticsConfiguration|null;
  abstract readonly owner:_RenderObjectSemantics;
  mergesToSibling=false;
  abstract markSiblingConfigurationConflict(conflict:boolean):void;
}
class _IncompleteSemanticsFragment extends _SemanticsFragment {
  constructor(readonly configToMergeUp:SemanticsConfiguration,readonly owner:_RenderObjectSemantics){super();}
  markSiblingConfigurationConflict(conflict:boolean):void{check(!conflict,'An incomplete semantics fragment cannot have a sibling conflict');}
}

// The render owner holds its fragment on its existing private child-table
// object, never as a child entry. This adds no RenderObject field. GC follows the ordinary
// owner cycle, and a private symbol cannot collide with named table metadata.
const fragmentSlot:unique symbol=Symbol('render-semantics');
// Rendering-library friend view of RenderObject's existing canonical table.
type SemanticsRender={readonly entries:{[fragmentSlot]?:_RenderObjectSemantics};readonly childStore?:{[fragmentSlot]?:_RenderObjectSemantics}};
/** Rendering-library private access without adding public SDK exports. */
export function semanticsFor(render:RenderObject):_RenderObjectSemantics{const storage=(render as unknown as SemanticsRender).entries;let value=storage[fragmentSlot];if(value===undefined||value.renderObject!==render){value=new _RenderObjectSemantics(render);storage[fragmentSlot]=value;}return value;}
export function existingSemanticsFor(render:RenderObject):_RenderObjectSemantics|undefined{const value=(render as unknown as SemanticsRender).childStore?.[fragmentSlot];return value?.renderObject===render?value:undefined;}

export class _RenderObjectSemantics extends _SemanticsFragment {
  private hasSiblingConflict=false;private blocksPreviousSibling:boolean|null=null;private containsIncompleteFragment=false;private pendingWasBoundary:boolean|undefined;
  built=false;cachedSemanticsNode:SemanticsNode|null=null;
  readonly semanticsNodes:SemanticsNode[]=[];readonly mergeUp:_SemanticsFragment[]=[];readonly childrenInSemanticsTree:_RenderObjectSemantics[]=[];readonly siblingMergeGroups:_SemanticsFragment[][]=[];
  private readonly producedSiblingNodesAndOwners=new Map<SemanticsNode,_SemanticsFragment[]>();
  parentData:_SemanticsParentData|null=null;geometry:_SemanticsGeometry|null=null;readonly configProvider:_SemanticsConfigurationProvider;
  parentInSemanticsTree:_RenderObjectSemantics|null=null;private currentTreeShapeToken:object={};firstAncestorNodeWithCleanGeometry:_RenderObjectSemantics|null=null;
  constructor(readonly renderObject:RenderObject){super();this.configProvider=new _SemanticsConfigurationProvider(renderObject);}
  get owner():_RenderObjectSemantics{return this;}
  get parent():_RenderObjectSemantics|null{return this.renderObject.parent?semanticsFor(this.renderObject.parent):null;}
  get parentDataDirty():boolean{return !this.isRoot&&this.parentData===null;}
  get geometryDirty():boolean{return !this.isRoot&&this.geometry===null;}
  get isRoot():boolean{return this.renderObject.parent===undefined;}
  get configToMergeUp():SemanticsConfiguration|null{return this.shouldFormSemanticsNode?null:this.configProvider.effective;}
  get contributesToSemanticsTree():boolean{return this.configProvider.effective.hasBeenAnnotated||this.containsIncompleteFragment||this.configProvider.effective.isSemanticBoundary||this.isRoot;}
  private get needsMergingSiblingNodesIntoSelf():boolean{return this.configProvider.effective.isMergingSemanticsOfDescendants&&this.producedSiblingNodesAndOwners.size>0;}
  get shouldFormSemanticsNode():boolean{if(this.configProvider.effective.isSemanticBoundary||this.isRoot)return true;if(!this.contributesToSemanticsTree)return false;check(this.parentData!==null,'Parent semantics data must be updated before node formation');return this.parentData!.explicitChildNodes||this.hasSiblingConflict;}
  computeAncestorInfo(token:object):void{if(token===this.currentTreeShapeToken)return;this.currentTreeShapeToken=token;if(this.isRoot){this.firstAncestorNodeWithCleanGeometry=this;return;}this.firstAncestorNodeWithCleanGeometry=null;if(this.parentDataDirty)return;let next:_RenderObjectSemantics|null;if(this.shouldFormSemanticsNode){if(!this.geometryDirty)this.firstAncestorNodeWithCleanGeometry=this;next=this.parentInSemanticsTree;}else{next=this;while(!next!.parentDataDirty&&!next!.shouldFormSemanticsNode){next=next!.parent;check(next!==null,'A semantics fragment must have a forming ancestor');}}if(next===null)return;if(this.firstAncestorNodeWithCleanGeometry===null){next.computeAncestorInfo(token);this.firstAncestorNodeWithCleanGeometry=next.firstAncestorNodeWithCleanGeometry;}}
  static debugCheckForParentData(root:RenderObject):void{const visit=(node:_RenderObjectSemantics)=>{check(!node.parentDataDirty,'Semantics parent data is dirty');for(const child of node.nonBlockedChildren())visit(child);};visit(semanticsFor(root));}
  static debugCheckForBuilds(node:_RenderObjectSemantics):void{check(node.built,'Semantics node was not built');for(const child of node.childrenInSemanticsTree)this.debugCheckForBuilds(child);}
  get isBlockingPreviousSibling():boolean{if(this.blocksPreviousSibling!==null)return this.blocksPreviousSibling;this.blocksPreviousSibling=this.configProvider.effective.isBlockingSemanticsOfPreviouslyPaintedNodes;if(this.blocksPreviousSibling)return true;if(this.configProvider.effective.isSemanticBoundary)return false;this.renderObject.visitChildrenForSemantics(child=>{if(semanticsFor(child).isBlockingPreviousSibling)this.blocksPreviousSibling=true;});return this.blocksPreviousSibling;}
  static shouldDrop(node:SemanticsNode):boolean{return node.isInvisible;}
  markNeedsBuild():void{this.built=false;if(!this.parentDataDirty&&!this.shouldFormSemanticsNode)return;for(const group of this.siblingMergeGroups)for(const child of group)if(child instanceof _RenderObjectSemantics&&!child.parentDataDirty&&!child.shouldFormSemanticsNode)child.markNeedsBuild();}
  private nonBlockedChildren():_RenderObjectSemantics[]{const result:_RenderObjectSemantics[]=[];this.renderObject.visitChildrenForSemantics(render=>{const child=semanticsFor(render);if(child.isBlockingPreviousSibling)result.length=0;result.push(child);});return result;}
  private tagsForChildren():Set<SemanticsTag>|null{const own=this.configProvider.original.tagsForChildren;if(this.contributesToSemanticsTree)return own===null?null:tagSet(own);let result=own===null?null:tagSet(own);if(this.parentData?.tagsForChildren){if(result===null)result=this.parentData.tagsForChildren;else addTags(result,this.parentData.tagsForChildren);}return result;}
  updateChildren():void {
    check(this.parentData!==null||this.isRoot,'Parent data may be null only at the render root');this.configProvider.reset();
    const config=this.configProvider.effective,tags=this.tagsForChildren(),explicit=this.isRoot||config.explicitChildNodes||(!this.contributesToSemanticsTree&&(this.parentData?.explicitChildNodes??true));
    const blocked=(this.parentData?.blocksUserActions??false)||config.isBlockingUserActions,focusBlock=this.parentData?.accessibilityFocusBlockType===AccessibilityFocusBlockType.blockSubtree?AccessibilityFocusBlockType.blockSubtree:config.accessibilityFocusBlockType,locale=config.localeForSubtree??this.parentData?.localeForChildren??null;
    this.siblingMergeGroups.length=0;this.mergeUp.length=0;
    const childData=new _SemanticsParentData((this.parentData?.mergeIntoParent??false)||config.isMergingSemanticsOfDescendants,blocked,explicit,tags,locale,focusBlock);this.collectChildren(childData);
    const oldChildren=this.childrenInSemanticsTree.length?new Set(this.childrenInSemanticsTree):null;this.childrenInSemanticsTree.length=0;if(!this.contributesToSemanticsTree)return;
    this.markConflicts(this.mergeUp,true);for(const group of this.siblingMergeGroups)this.markConflicts(group);
    // Capture configurations before absorption, preserving their observation
    // order. The render owner already holds the fragment arrays for this turn.
    let configs:SemanticsConfiguration[]|undefined;for(const fragment of this.mergeUp){const config=fragment.configToMergeUp;if(config!==null)(configs??=[]).push(config);}if(configs)this.configProvider.absorbAll(configs);
    try{for(const child of this.mergeUp)if(child instanceof _RenderObjectSemantics){check(child.contributesToSemanticsTree,'A merged child must contribute');if(child.shouldFormSemanticsNode){for(const descendant of child.childrenInSemanticsTree)descendant.parentInSemanticsTree=child;if(child.geometryDirty)pipelineSemantics(this.renderObject.owner!).geometryDirty.add(child.renderObject);this.childrenInSemanticsTree.push(child);}else{this.childrenInSemanticsTree.push(...child.childrenInSemanticsTree);this.siblingMergeGroups.push(...child.siblingMergeGroups);}}}finally{this.mergeUp.length=0;this.mergeUp.push(this);}
    if(this.isRoot||this.configProvider.effective.isSemanticBoundary)for(const child of this.childrenInSemanticsTree)child.parentInSemanticsTree=this;
    if(oldChildren){for(const child of this.childrenInSemanticsTree)oldChildren.delete(child);for(const child of oldChildren)if(child.parentInSemanticsTree===this)child.parentInSemanticsTree=null;}
    const inheritedTags=this.parentData?.tagsForChildren;if(inheritedTags){check(inheritedTags.size>0,'Inherited tags must not be empty');this.configProvider.updateConfig(config=>{for(const tag of inheritedTags)config.addTagForChildren(tag);});}
    if(focusBlock!==this.configProvider.effective.accessibilityFocusBlockType)this.configProvider.updateConfig(config=>{config.accessibilityFocusBlockType=focusBlock;});
    if(blocked!==this.configProvider.effective.isBlockingUserActions)this.configProvider.updateConfig(config=>{config.isBlockingUserActions=blocked;});
    if(!valueEquals(locale,this.configProvider.effective.locale))this.configProvider.updateConfig(config=>{config.locale=locale;});
    if(focusBlock!==AccessibilityFocusBlockType.none)this.configProvider.updateConfig(config=>{config.isFocused=null;});
  }
  private collectChildren(childData:_SemanticsParentData):void {
    const mergeUp=this.mergeUp,groups=this.siblingMergeGroups,delegate=this.configProvider.effective.childConfigurationsDelegate,configs=delegate===null?null:[] as SemanticsConfiguration[],byConfig=delegate===null?null:new Map<SemanticsConfiguration,_SemanticsFragment>(),assumeIncomplete=delegate!==null&&childData.explicitChildNodes;
    const effectiveData=assumeIncomplete?new _SemanticsParentData(childData.mergeIntoParent,childData.blocksUserActions,false,childData.tagsForChildren,childData.localeForChildren,childData.accessibilityFocusBlockType):childData;
    try{
    for(const child of this.nonBlockedChildren()){check(!child.renderObject.needsLayout,'Semantic children require completed layout');child.didUpdateParentData(effectiveData);for(const fragment of child.mergeUp){const config=fragment.configToMergeUp;if(delegate!==null&&config!==null){configs!.push(config);byConfig!.set(config,fragment);}else mergeUp.push(fragment);}if(!child.contributesToSemanticsTree)groups.push(...child.siblingMergeGroups);}
    this.containsIncompleteFragment=false;
    if(delegate!==null){const result=delegate(configs!),fragmentFor=(config:SemanticsConfiguration)=>{const fragment=byConfig!.get(config);if(fragment)return fragment;this.containsIncompleteFragment=true;return new _IncompleteSemanticsFragment(config,this);};mergeUp.push(...result.mergeUp.map(fragmentFor));for(const group of result.siblingMergeGroups)groups.push([...group].map(fragmentFor));}
    if(!this.containsIncompleteFragment&&assumeIncomplete){mergeUp.length=0;groups.length=0;for(const child of this.nonBlockedChildren()){check(childData.explicitChildNodes,'Explicit children assumption was lost');child.didUpdateParentData(childData);mergeUp.push(...child.mergeUp);if(!child.contributesToSemanticsTree)groups.push(...child.siblingMergeGroups);}}
    }catch(error){mergeUp.length=0;groups.length=0;throw error;}
  }
  private didUpdateParentData(data:_SemanticsParentData):void{if(this.parentData?.equals(data))return;const dirty=this.parentDataDirty;this.markNeedsBuild();this.parentData=data;if(dirty)this.geometry=null;this.updateChildren();}
  markSiblingConfigurationConflict(conflict:boolean):void{this.hasSiblingConflict=conflict;}
  ensureGeometry():void{check(!this.geometryDirty,'Cannot start from dirty semantics geometry');if(this.isRoot){if(!valueEquals(this.geometry?.rect,rectValue(this.renderObject.semanticBounds)))this.markNeedsBuild();this.geometry=_SemanticsGeometry.root(rectValue(this.renderObject.semanticBounds));}this.updateChildGeometry(true);}
  private updateChildGeometry(onlyDirty=false):void{check(this.geometry!==null,'Missing parent semantics geometry');const geometry=this.geometry!;for(const child of this.childrenInSemanticsTree){if(onlyDirty&&!child.geometryDirty)continue;child.updateGeometry(_SemanticsGeometry.computeChildGeometry(null,geometry.paintClipRect,geometry.semanticsClipRect,this,child));}for(const child of this.explicitSiblingChildren()){if(onlyDirty&&!child.geometryDirty)continue;child.updateGeometry(_SemanticsGeometry.computeChildGeometry(geometry.transform,geometry.paintClipRect,geometry.semanticsClipRect,this,child));}}
  private explicitSiblingChildren():_RenderObjectSemantics[]{return this.siblingMergeGroups.flat().filter((fragment):fragment is _RenderObjectSemantics=>fragment instanceof _RenderObjectSemantics).flatMap(child=>child.shouldFormSemanticsNode?[child]:child.childrenInSemanticsTree);}
  clearImmediateChildrenGeometry():void{if(!this.contributesToSemanticsTree){for(const child of this.mergeUp)if(child instanceof _RenderObjectSemantics){if(child.shouldFormSemanticsNode)child.geometry=null;else for(const node of child.childrenInSemanticsTree){check(node.shouldFormSemanticsNode,'A semantics-tree child must form a node');node.geometry=null;}}}else for(const child of this.childrenInSemanticsTree)child.geometry=null;for(const child of this.explicitSiblingChildren())child.geometry=null;}
  // Nelyx nodes snapshot matrix/clip values: a same-size update must refresh geometry without replacing IDs.
  private updateGeometry(geometry:_SemanticsGeometry):void{const current=this.geometry;this.geometry=geometry;if(current!==null){const hidden=this.configProvider.original.isHidden||(!(this.parentData?.mergeIntoParent??false)&&geometry.hidden);if(current.rect.size.equals(geometry.rect.size)&&this.configProvider.effective.isHidden===hidden){const changed=!valueEquals(current.rect,geometry.rect)||!valueEquals(current.transform,geometry.transform)||!valueEquals(current.paintClipRect,geometry.paintClipRect)||!valueEquals(current.semanticsClipRect,geometry.semanticsClipRect);if(changed){if(this.shouldFormSemanticsNode&&this.cachedSemanticsNode!==null)this.updateNodeGeometry();this.updateChildGeometry();}return;}}this.markNeedsBuild();this.updateChildGeometry();}
  ensureSemanticsNode():void{check(this.shouldFormSemanticsNode,'A fragment must form a node before building');if(!this.built)this.buildSemantics(new Set());else this.buildSubtree(new Set());}
  private buildSemantics(used:Set<number>):void{check(this.shouldFormSemanticsNode,'Cannot build a non-forming fragment');if(this.cachedSemanticsNode!==null)for(const node of this.semanticsNodes)if(node!==this.cachedSemanticsNode)node.tags=null;if(!this.built)this.produceNode(used);check(this.built,'Semantics node was not produced');for(const node of this.semanticsNodes)if(node!==this.cachedSemanticsNode){if(this.parentData?.tagsForChildren){node.tags??=new Set();addTags(node.tags,this.parentData.tagsForChildren);}else if(node.tags?.size===0)node.tags=null;}}
  private buildSubtree(used:Set<number>):void {
    const children:SemanticsNode[]=[];
    for(const child of this.childrenInSemanticsTree){if(child.parentDataDirty)continue;check(child.shouldFormSemanticsNode,'A semantics-tree child must form a node');if(child.cachedSemanticsNode!==null&&used.has(child.cachedSemanticsNode.id)){child.markNeedsBuild();child.cachedSemanticsNode=null;}child.buildSemantics(used);children.push(...child.semanticsNodes);}
    const node=this.cachedSemanticsNode!,visible=children.filter(child=>!_RenderObjectSemantics.shouldDrop(child)),hidden=this.configProvider.original.isHidden||(!(this.parentData?.mergeIntoParent??false)&&this.geometry!.hidden);
    if(this.configProvider.effective.isHidden!==hidden)this.configProvider.updateConfig(config=>{config.isHidden=hidden;});
    if(this.configProvider.effective.isSemanticBoundary){if(this.needsMergingSiblingNodesIntoSelf){const inner=new SemanticsNode({showOnScreen:()=>this.renderObject.showOnScreen()});this.renderObject.assembleSemanticsNode(inner,this.configProvider.effective,visible);const config=new SemanticsConfiguration();config.isSemanticBoundary=true;config.isMergingSemanticsOfDescendants=true;node.updateWith({config,childrenInInversePaintOrder:[inner,...this.producedSiblingNodesAndOwners.keys()]});}else this.renderObject.assembleSemanticsNode(node,this.configProvider.effective,visible);}else{check(!this.configProvider.effective.isMergingSemanticsOfDescendants,'Merging descendants requires a boundary');node.updateWith({config:this.configProvider.effective,childrenInInversePaintOrder:visible});}
  }
  private produceNode(used:Set<number>):void{check(!this.built,'Cannot reproduce a built fragment');this.semanticsNodes.length=0;this.producedSiblingNodesAndOwners.clear();const node=this.cachedSemanticsNode??=this.createNode();pipelineSemantics(this.renderObject.owner!).transportSources.add(this.renderObject);node.isMergedIntoParent=this.parentData?.mergeIntoParent??false;node.tags=this.parentData?.tagsForChildren??null;this.updateNodeGeometry();this.mergeSiblings(used);this.buildSubtree(used);this.semanticsNodes.push(node);if(!this.needsMergingSiblingNodesIntoSelf)this.semanticsNodes.push(...this.producedSiblingNodesAndOwners.keys());this.built=true;}
  private createNode():SemanticsNode{const showOnScreen=()=>this.renderObject.showOnScreen();if(this.isRoot){const owner=pipelineSemantics(this.renderObject.owner!).owner;invariant(owner!==null,'missing-semantics-owner','Render semantics requires an enabled owner');return SemanticsNode.root({showOnScreen,owner});}return new SemanticsNode({showOnScreen});}
  private mergeSiblings(used:Set<number>):void {
    for(const group of this.siblingMergeGroups){let config:SemanticsConfiguration|null=null,node:SemanticsNode|null=null;const explicit:_RenderObjectSemantics[]=[];
      for(const fragment of group){if(fragment instanceof _RenderObjectSemantics){if(fragment.shouldFormSemanticsNode){explicit.push(fragment);check(fragment.configToMergeUp===null,'Explicit node cannot merge up');continue;}explicit.push(...fragment.childrenInSemanticsTree);}const merging=fragment.configToMergeUp;if(merging!==null){fragment.mergesToSibling=true;node??=fragment.owner.cachedSemanticsNode;config??=new SemanticsConfiguration();config.absorb(merging);}}
      const children:SemanticsNode[]=[];for(const child of explicit){child.buildSemantics(used);children.push(...child.semanticsNodes);}
      if(config!==null){if(node===null||used.has(node.id))node=new SemanticsNode({showOnScreen:()=>this.renderObject.showOnScreen()});used.add(node.id);for(const fragment of group)if(fragment.configToMergeUp!==null){fragment.owner.built=true;fragment.owner.cachedSemanticsNode=node;pipelineSemantics(fragment.owner.renderObject.owner!).transportSources.add(fragment.owner.renderObject);}node.updateWith({config,childrenInInversePaintOrder:children});this.producedSiblingNodesAndOwners.set(node,group);const tags=tagSet(group.flatMap(fragment=>[...fragment.owner.parentData!.tagsForChildren??[]]));if(tags.size>0){if(node.tags===null)node.tags=tags;else addTags(node.tags,tags);}node.isMergedIntoParent=this.configProvider.effective.isMergingSemanticsOfDescendants||(this.parentData?.mergeIntoParent??false);}
    }
    this.updateSiblingGeometries();
  }
  private updateNodeGeometry():void{const node=this.cachedSemanticsNode!,geometry=this.geometry!;node.rect=geometry.rect;node.transform=geometry.transform;node.parentSemanticsClipRect=geometry.semanticsClipRect;node.parentPaintClipRect=geometry.paintClipRect;}
  private updateSiblingGeometries():void{const main=this.geometry!;for(const[node,group]of this.producedSiblingNodesAndOwners){let rect:Rect|null=null,semanticClip:Rect|null=null,paintClip:Rect|null=null;for(const fragment of group){if(fragment.owner.shouldFormSemanticsNode)continue;const geometry=_SemanticsGeometry.computeChildGeometry(main.transform,main.paintClipRect,main.semanticsClipRect,this,fragment.owner),local=geometry.semanticsClipRect?.intersect(rectValue(fragment.owner.renderObject.semanticBounds))??rectValue(fragment.owner.renderObject.semanticBounds),transformed=MatrixUtils.transformRect(geometry.transform,local);rect=unionRects(rect,transformed);if(geometry.semanticsClipRect!==null){const clip=MatrixUtils.transformRect(geometry.transform,geometry.semanticsClipRect);semanticClip=intersectRects(semanticClip,clip);}if(geometry.paintClipRect!==null){const clip=MatrixUtils.transformRect(geometry.transform,geometry.paintClipRect);paintClip=intersectRects(paintClip,clip);}}invariant(rect!==null,'missing-sibling-semantics-rect','Sibling nodes require fragment geometry');node.rect=rect;node.transform=null;node.parentSemanticsClipRect=semanticClip;node.parentPaintClipRect=paintClip;}}
  invalidateConfiguration():void{
    this.pendingWasBoundary??=this.cachedSemanticsNode!==null&&this.configProvider.wasSemanticsBoundary;
    this.configProvider.clear();this.containsIncompleteFragment=false;
  }
  applyPendingUpdate():void{
    const pipeline=pipelineSemantics(this.renderObject.owner!);pipeline.geometryDirty.add(this.renderObject);
    const produced=this.cachedSemanticsNode,wasBoundary=this.pendingWasBoundary??false;
    let sibling=this.configProvider.effective.childConfigurationsDelegate!==null,boundary=this.configProvider.effective.isSemanticBoundary&&wasBoundary,node=this.renderObject;
    // A fragment stays on its render owner's canonical table. Carry it while
    // walking the live parent links instead of looking it up for every test.
    let semantics:_RenderObjectSemantics=this;
    while(node.parent&&(sibling||!boundary)){
      if(node!==this.renderObject&&semantics.parentDataDirty&&!sibling)break;
      semantics.parentData=null;semantics.blocksPreviousSibling=null;if(boundary)sibling=false;
      const hasDelegate=semantics.configProvider.effective.childConfigurationsDelegate!==null;sibling=sibling||hasDelegate;
      node=node.parent;semantics=semanticsFor(node);boundary=semantics.configProvider.effective.isSemanticBoundary&&semantics.built;
    }
    if(node!==this.renderObject&&produced!==null&&semantics.parentDataDirty)pipeline.dirty.delete(this.renderObject);
    if(!semantics.parentDataDirty||semantics.isRoot){
      check(semantics.configProvider.effective.isSemanticBoundary||!node.parent,'Semantics update target must be a boundary or root');
      pipeline.dirty.add(node);
    }
    this.pendingWasBoundary=undefined;
  }
  private markConflicts(group:_SemanticsFragment[],mergeUp=false):void{let previous:Set<_RenderObjectSemantics>|undefined,conflicts:Set<_SemanticsFragment>|undefined;for(let i=0;i<group.length;i++){const fragment=group[i]!;if(fragment instanceof _RenderObjectSemantics&&fragment.hasSiblingConflict)(previous??=new Set()).add(fragment);fragment.markSiblingConfigurationConflict(false);const config=fragment.configToMergeUp;if(config===null)continue;if(mergeUp&&!this.configProvider.original.isCompatibleWith(config))(conflicts??=new Set()).add(fragment);for(let j=0;j<i;j++){const sibling=group[j]!;if(!config.isCompatibleWith(sibling.configToMergeUp)){(conflicts??=new Set()).add(fragment);conflicts.add(sibling);}}}if(conflicts)for(const fragment of conflicts){fragment.markSiblingConfigurationConflict(true);if(fragment instanceof _RenderObjectSemantics&&!previous?.delete(fragment))fragment.markNeedsBuild();}if(previous)for(const fragment of previous)fragment.markNeedsBuild();}
  clear():void{const pipeline=this.renderObject.owner;if(pipeline)existingPipelineSemantics(pipeline)?.transportSources.delete(this.renderObject);this.built=false;this.cachedSemanticsNode=null;this.parentData=null;this.geometry=null;this.blocksPreviousSibling=null;this.containsIncompleteFragment=false;this.pendingWasBoundary=undefined;this.mergeUp.length=0;this.siblingMergeGroups.length=0;this.childrenInSemanticsTree.length=0;this.semanticsNodes.length=0;this.configProvider.clear();}
  override debugDescribeChildren():readonly DiagnosticsNode[]{return this.childrenInSemanticsTree.map(child=>child.toDiagnosticsNode());}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new StringProperty('owner',describeIdentity(this.renderObject)));properties.add(new FlagProperty('noParentData',this.parentDataDirty,{ifTrue:'NO PARENT DATA'}));properties.add(new FlagProperty('geometry',this.geometryDirty,{ifTrue:'NO GEOMETRY'}));properties.add(new FlagProperty('semanticsBlock',this.configProvider.effective.isBlockingSemanticsOfPreviouslyPaintedNodes,{ifTrue:'BLOCK PREVIOUS'}));if(!this.parentDataDirty&&this.contributesToSemanticsTree)properties.add(new StringProperty('formedSemanticsNode',this.built?'formed '+(this.cachedSemanticsNode?.id??'null'):this.shouldFormSemanticsNode?'needs build':'no semantics node',{quoted:false}));properties.add(new FlagProperty('isSemanticBoundary',this.configProvider.effective.isSemanticBoundary,{ifTrue:'semantic boundary'}));properties.add(new FlagProperty('blocksSemantics',this.isBlockingPreviousSibling,{ifTrue:'BLOCKS SEMANTICS'}));if(this.contributesToSemanticsTree&&this.siblingMergeGroups.length)properties.add(new StringProperty('Sibling group',String(this.siblingMergeGroups),{quoted:false}));}
}

interface _SemanticsGeometryPath {readonly transform:Matrix4;readonly paint:Rect|null;readonly semantic:Rect|null}
// Paths are local to a single pipeline flush. Sibling semantics nodes often
// share many non-semantic render ancestors; apply each shared edge only once.
// A flush already owns every participating render node until its finally.
// Strong maps have exactly that bounded lifetime; no per-edge weak roots are
// needed for temporary geometry work, including on a failed flush.
const geometryPaths=new WeakMap<PipelineOwner,Map<_RenderObjectSemantics,Map<RenderObject,_SemanticsGeometryPath>>>();
class _SemanticsGeometry {
  constructor(readonly paintClipRect:Rect|null,readonly semanticsClipRect:Rect|null,readonly transform:Matrix4,readonly rect:Rect,readonly hidden:boolean){}
  static root(rect:Rect):_SemanticsGeometry{return new _SemanticsGeometry(null,null,Matrix4.identity(),rect,false);}
  get isVisible():boolean{return !this.rect.isEmpty&&!this.transform.isZero();}
  static computeChildGeometry(parentTransform:Matrix4|null,parentPaintClip:Rect|null,parentSemanticsClip:Rect|null,parent:_RenderObjectSemantics,child:_RenderObjectSemantics):_SemanticsGeometry{
    let render=child.renderObject;const parentRender=parent.renderObject,cache=geometryPaths.get(parentRender.owner!);let paths=cache?.get(parent);
    if(cache&&!paths){paths=new Map();cache.set(parent,paths);}
    check(render!==parentRender,'Child geometry requires distinct render ancestors');
    const chain=[render];while(render!==parentRender&&!paths?.has(render)){check(render.depth>parentRender.depth&&render.parent!==undefined,'Semantics geometry parent must be an ancestor');render=render.parent!;chain.push(render);}
    const path=paths?.get(render),transform=path?.transform.clone()??Matrix4.identity();let paint=path?.paint??null,semantic=path?.semantic??null;
    for(let i=chain.length-1;i>0;i--){
      const parent=chain[i]!,node=chain[i-1]!,localPaint=this.transformRect(parent.describeApproximatePaintClip(node),transform,MatrixUtils.transformRect),localSemantic=this.transformRect(parent.describeSemanticsClip(node),transform,MatrixUtils.transformRect);
      paint=this.intersect(paint,localPaint);semantic=localSemantic??(semantic===null?null:semantic.intersect(localPaint??semantic));parent.applyPaintTransform(node,transform);
      // Only forks and requested endpoints can be reused by another path.
      // Linear wrappers keep one working matrix instead of cloning every edge.
      if(paths&&(i===1||node.children.length>1))paths.set(node,{transform:transform.clone(),paint,semantic});
    }
    semantic??=this.intersect(paint,parentSemanticsClip);paint=this.intersect(paint,parentPaintClip);
    if(paint!==null||semantic!==null){
      const translation=MatrixUtils.getAsTranslation(transform);
      if(translation!==null&&Number.isFinite(translation.dx)&&Number.isFinite(translation.dy)){
        // Viewport/box offsets need only a rect shift, not a cloned 4x4 inverse.
        const offset=new Offset(-translation.dx,-translation.dy),shift=(rect:Rect|null)=>rect===null?null:rect.isEmpty?Rect.zero:rect.shift(offset);
        semantic=shift(semantic);paint=shift(paint);
      }else{const inverse=transform.clone(),invertible=inverse.invert()!==0;semantic=invertible?this.transformRect(semantic,inverse,MatrixUtils.transformRect):null;paint=invertible?this.transformRect(paint,inverse,MatrixUtils.transformRect):null;}
    }
    if(parentTransform!==null)MatrixUtils.multiplyInPlace(parentTransform,transform);let rect=semantic?.intersect(rectValue(child.renderObject.semanticBounds))??rectValue(child.renderObject.semanticBounds),hidden=false;if(paint!==null){const painted=paint.intersect(rect);hidden=painted.isEmpty&&!rect.isEmpty;if(!hidden)rect=painted;}return new _SemanticsGeometry(paint,semantic,transform,rect,hidden);
  }
  private static transformRect(rect:HostRect|null,transform:Matrix4,apply:(transform:Matrix4,rect:Rect)=>Rect=(matrix,rect)=>MatrixUtils.inverseTransformRect(matrix,rect)):Rect|null{if(rect===null)return null;const value=rectValue(rect);if(value.isEmpty||transform.isZero())return Rect.zero;return apply(transform,value);}
  private static intersect(a:Rect|null,b:Rect|null):Rect|null{return b===null?a:a?.intersect(b)??b;}
}

const pipelines=new WeakMap<PipelineOwner,RenderSemanticsPipeline>();
export function pipelineSemantics(owner:PipelineOwner):RenderSemanticsPipeline{let state=pipelines.get(owner);if(!state){state=new RenderSemanticsPipeline(owner);pipelines.set(owner,state);}return state;}
export function existingPipelineSemantics(owner:PipelineOwner):RenderSemanticsPipeline|undefined{return pipelines.get(owner);}
/** The app owns enablement; fragment/configuration/geometry processing follows the source queues. */
export class RenderSemanticsPipeline {
  /** Render fragments with a produced node; detached trees never stay in the transport index. */
  readonly transportSources=new Set<RenderObject>();
  owner:SemanticsOwner|null=null;readonly dirty=new Set<RenderObject>();readonly geometryDirty=new Set<RenderObject>();private readonly pendingConfigurations=new Set<RenderObject>();private readonly pendingGeometryConfigurations=new Set<RenderObject>();private readonly deferredGeometry=new Set<RenderObject>();private readonly offsetDirty=new Set<RenderObject>();private flushing=false;
  private changeRevision=0;
  /** New invalidations, including motion added to an already dirty subtree. */
  get updateRevision():number{return this.changeRevision;}
  constructor(private readonly pipeline:PipelineOwner){}
  private contributes(render:RenderObject):boolean{return render.owner===this.pipeline&&!render.needsLayout&&existingSemanticsFor(render)?.parentDataDirty===false;}
  get hasConfigurationChanges():boolean{
    if(this.dirty.size>0)return true;
    // Unvisited/offstage fragments join through their parent's structural
    // update. Their own layout must not flush the active accessibility tree.
    for(const render of this.pendingConfigurations)if(this.contributes(render))return true;
    return false;
  }
  /** @internal Read before flushing; transport metadata may change even when
   * its source annotation has the same serialized values. */
  get hasPendingChanges():boolean{
    if(this.dirty.size>0||this.geometryDirty.size>0||this.owner?.hasPendingUpdates===true)return true;
    for(const pending of [this.pendingConfigurations,this.pendingGeometryConfigurations])for(const render of pending)if(this.contributes(render))return true;
    // Deferred fragments outside the current semantic tree cannot affect its
    // transport snapshot until they are ready. Keep them for the normal flush;
    // offsetDirty is provenance for that geometry work, not another work queue.
    for(const render of this.deferredGeometry)if(render.owner===this.pipeline&&!render.needsLayout&&existingSemanticsFor(render)?.parentDataDirty===false)return true;
    return false;
  }
  enable(options:SemanticsOwnerOptions,scheduleRoot=true):void{invariant(this.owner===null,'duplicate-semantics-owner','Semantics owner is already enabled');this.owner=new SemanticsOwner(options);const root=this.pipeline.rootNode;if(root&&scheduleRoot){root.clearSemantics();root.scheduleInitialSemantics();}}
  disable():void{const owner=this.owner;if(owner===null)return;this.owner=null;const errors:unknown[]=[];for(const run of [()=>owner.rootSemanticsNode?.detach(),()=>this.pipeline.rootNode?.clearSemantics(),()=>owner.dispose()])try{run();}catch(error){errors.push(error);}this.transportSources.clear();this.pendingConfigurations.clear();this.pendingGeometryConfigurations.clear();this.dirty.clear();this.geometryDirty.clear();this.deferredGeometry.clear();this.offsetDirty.clear();if(errors.length)throw new AggregateError(errors,'Semantics owner retirement failed');}
  rootChanged(previous:RenderObject|undefined,current:RenderObject|undefined):void{if(this.owner===null)return;this.transportSources.clear();this.pendingConfigurations.clear();this.pendingGeometryConfigurations.clear();if(previous){this.owner.rootSemanticsNode?.detach();previous.clearSemantics();}if(current){current.clearSemantics();this.dirty.add(current);this.geometryDirty.add(current);}}
  detached(render:RenderObject):void{this.transportSources.delete(render);this.pendingConfigurations.delete(render);this.pendingGeometryConfigurations.delete(render);this.dirty.delete(render);this.geometryDirty.delete(render);this.deferredGeometry.delete(render);this.offsetDirty.delete(render);}
  requestUpdate(render:RenderObject,geometryOnly=false):void{
    invariant(!this.flushing,'semantics-mutation-during-flush','Cannot invalidate semantics during its flush');
    this.changeRevision++;
    const state=existingSemanticsFor(render);state?.invalidateConfiguration();
    if(geometryOnly&&state&&!this.pendingConfigurations.has(render))this.pendingGeometryConfigurations.add(render);
    else{this.pendingGeometryConfigurations.delete(render);this.pendingConfigurations.add(render);}
    // A caller may enable semantics after attaching the root. Its first
    // invalidation still has to admit that unvisited tree's initial commit.
    if(!state){const root=this.pipeline.rootNode;if(root&&!existingSemanticsFor(root)){this.dirty.add(root);this.geometryDirty.add(root);}}
  }
  offsetChanged(render:RenderObject):void{this.changeRevision++;this.geometryDirty.add(render);this.offsetDirty.add(render);}
  flush():void{
    const owner=this.owner;if(owner===null)return;invariant(!this.flushing,'reentrant-semantics-flush','Cannot flush semantics recursively');this.flushing=true;geometryPaths.set(this.pipeline,new Map());
    let nodes:RenderObject[]=[];
    try{
      for(const pending of [this.pendingConfigurations,this.pendingGeometryConfigurations])for(const render of pending){
        if(render.owner!==this.pipeline){pending.delete(render);continue;}
        if(render.needsLayout)continue;
        // Unvisited new fragments are collected by their parent's structural
        // update. Hidden/private render children need no fragment at all.
        existingSemanticsFor(render)?.applyPendingUpdate();pending.delete(render);
      }
      nodes=[...this.dirty].filter(node=>!node.needsLayout&&node.owner===this.pipeline).sort((a,b)=>a.depth-b.depth);this.dirty.clear();const root=this.pipeline.rootNode;for(const node of nodes){const semantics=semanticsFor(node);if(!semantics.parentDataDirty)semantics.updateChildren();}
      if(FoundationBuildMode.debug){check(nodes.length===0||root!==undefined,'Semantic updates need a render root');if(root)_RenderObjectSemantics.debugCheckForParentData(root);}
      for(const node of this.deferredGeometry)this.geometryDirty.add(node);this.deferredGeometry.clear();const geometry:RenderObject[]=[];
      for(const node of this.geometryDirty){if(node.needsLayout||node.owner!==this.pipeline)continue;if(semanticsFor(node).parentDataDirty){this.deferredGeometry.add(node);continue;}geometry.push(node);}this.geometryDirty.clear();
      for(const node of geometry){const semantics=semanticsFor(node);if(semantics.shouldFormSemanticsNode&&semantics.geometryDirty)continue;if(semantics.shouldFormSemanticsNode&&node.isRelayoutBoundary){semantics.geometry=null;
        // A root rebuilds its own rect directly in ensureGeometry, without
        // updateGeometry's descendant refresh. Its clip/transform may still
        // change, so its immediate semantic children must also become dirty.
        if(!semantics.isRoot)continue;
      }semantics.clearImmediateChildrenGeometry();}
      const token={},ensure=new Set<_RenderObjectSemantics>(),moved=new Set<_RenderObjectSemantics>();for(const node of geometry){const semantics=semanticsFor(node);semantics.computeAncestorInfo(token);if(semantics.firstAncestorNodeWithCleanGeometry){ensure.add(semantics.firstAncestorNodeWithCleanGeometry);if(this.offsetDirty.delete(node))moved.add(semantics.firstAncestorNodeWithCleanGeometry);}}for(const node of [...ensure].sort((a,b)=>a.renderObject.depth-b.renderObject.depth))node.ensureGeometry();
      const assembled=new Set<_RenderObjectSemantics>();
      const assemble=(target:_RenderObjectSemantics)=>{if(!target.parentDataDirty&&!assembled.has(target)){target.ensureSemanticsNode();assembled.add(target);}};
      for(const node of nodes.reverse()){const semantics=semanticsFor(node);semantics.computeAncestorInfo(token);const targets:_RenderObjectSemantics[]=[];if(semantics.geometryDirty){if(semantics.firstAncestorNodeWithCleanGeometry)targets.push(semantics.firstAncestorNodeWithCleanGeometry);}else{if(!semantics.geometry!.isVisible&&!semantics.isRoot){const parent=semantics.parentInSemanticsTree;if(parent){if(!parent.geometryDirty)targets.push(parent);else if(parent.firstAncestorNodeWithCleanGeometry)targets.push(parent.firstAncestorNodeWithCleanGeometry);}}targets.push(semantics);}for(const target of targets)assemble(target);}
      // Offset changes preserve configurations and parent data. Geometry can
      // still change clipping/visibility, so assemble its affected subtree even
      // when there were no configuration updates in this flush.
      for(const target of moved)assemble(target);
      if(FoundationBuildMode.debug&&root)_RenderObjectSemantics.debugCheckForBuilds(semanticsFor(root));owner.sendSemanticsUpdate();this.pipeline.visitChildren(child=>child.flushSemantics());check(this.dirty.size===0,'Child PipelineOwners must not dirty nodes in their parent');check(this.geometryDirty.size===0,'Child PipelineOwners must not dirty geometry in their parent');
    }catch(error){for(const node of nodes)if(node.owner===this.pipeline)this.dirty.add(node);throw error;}
    finally{geometryPaths.delete(this.pipeline);this.flushing=false;}
  }
}
