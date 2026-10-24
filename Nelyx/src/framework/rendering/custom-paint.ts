// SPDX-License-Identifier: BSD-3-Clause
// Reviewed Flutter custom_paint.dart semantics; exact selections are in upstream metadata.
import {invariant} from '../../foundation/errors.ts';
import {Listenable} from '../../foundation/notifier.ts';
import {Key,KeyMap,sameKey} from '../../foundation/key.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {ErrorDescription,ErrorSummary} from '../../foundation/diagnostics.ts';
import {protect} from '../../ui/value-math.ts';
import {SemanticsRole,Tristate} from '../../ui/semantics.ts';
import {identity,multiply,translate,bounds,intersect,inversePaintTransform,transform,captureTransform} from '../../ui/geometry.ts';
import type {Size,Offset,TransformMatrix} from '../../ui/geometry.ts';
import type {Canvas} from '../../ui/canvas.ts';
import type {Rect,SemanticsNode} from '../../ui/types.ts';
import {freezeSemantics,SemanticsProperties,SemanticsConfiguration,SemanticsNode as SourceSemanticsNode} from '../semantics/semantics.ts';
import type {SemanticsTag} from '../semantics/semantics.ts';
import {describeTransportSemantics,setSemanticsTransportProperties} from './semantics-transport.ts';
import type {SemanticsTransportProperties} from './semantics-transport.ts';
import {Rect as SourceRect} from '../../ui/rect.ts';
import {Matrix4} from '../../math/matrix4.ts';
import {fullTransform} from '../../ui/geometry.ts';
import type {PaintingContext} from '../painting/context.ts';
import {RenderProxyBox} from './boxes.ts';
import type {RenderBox,RenderObject,HitTestEntry,PipelineOwner} from './object.ts';
import {BoxConstraints} from './constraints.ts';
import {withRenderPaint,assertOutsideRenderPaint} from './phase.ts';

export type CustomPainterProperties=Omit<SemanticsNode,'id'|'bounds'|'children'>;
export type SemanticsBuilderCallback=(size:Size)=>readonly CustomPainterSemantics[];
export interface CustomPainterOptions {readonly repaint?:Listenable|null;readonly typeToken?:object|symbol}
export abstract class CustomPainter extends Listenable {
  readonly repaint:Listenable|null;readonly typeToken:object|symbol;
  constructor(options:CustomPainterOptions={}){super();this.repaint=options.repaint??null;this.typeToken=options.typeToken??this.constructor;invariant(!this.repaint||typeof this.repaint.addListener==='function'&&typeof this.repaint.removeListener==='function','invalid-custom-painter','repaint must implement Listenable');}
  addListener(listener:()=>void):void{this.repaint?.addListener(listener);}
  removeListener(listener:()=>void):void{this.repaint?.removeListener(listener);}
  abstract paint(canvas:Canvas,size:Size):void;
  abstract shouldRepaint(oldDelegate:CustomPainter):boolean;
  shouldRebuildSemantics(oldDelegate:CustomPainter):boolean{return this.shouldRepaint(oldDelegate);}
  get semanticsBuilder():SemanticsBuilderCallback|null{return null;}
  hitTest(_position:Offset):boolean|null{return null;}
  toString():string{return this.constructor.name;}
}
export class CustomPainterSemantics {
  readonly key:Key|null;readonly rect:SourceRect;readonly properties:SemanticsProperties;readonly transform:Matrix4|null;readonly tags:Set<SemanticsTag>|null;
  /** @internal Existing host properties are adapted at the boundary. */
  readonly transportProperties:CustomPainterProperties|null;
  constructor(options:{readonly key?:Key|null;readonly rect:Rect;readonly properties:SemanticsProperties|CustomPainterProperties;readonly transform?:Matrix4|readonly number[]|Float64Array|null;readonly tags?:Set<SemanticsTag>|null}){
    invariant(options.key==null||options.key instanceof Key,'invalid-custom-semantics','Semantics key must be an Nelyx Key');this.key=options.key??null;
    this.transform=options.transform==null?null:options.transform instanceof Matrix4?options.transform:Matrix4.fromList(fullTransform(captureTransform(options.transform)));
    this.tags=options.tags??null;this.rect=options.rect instanceof SourceRect?options.rect:SourceRect.fromLTWH(options.rect.x,options.rect.y,options.rect.width,options.rect.height);
    if(options.properties instanceof SemanticsProperties){this.properties=options.properties;this.transportProperties=null;}
    else{const node=freezeSemantics([{...options.properties,id:'validation',bounds:options.rect}])[0]!,{id:_,bounds:__,...properties}=node;this.transportProperties=Object.freeze(properties);const actions=properties.actions;
      this.properties=new SemanticsProperties({label:properties.name,textDirection:properties.name||properties.value?'ltr':null,enabled:properties.enabled,selected:properties.selected??null,checked:properties.checked??null,focused:properties.focused??null,button:properties.role==='button',textField:properties.role==='text-field',image:properties.role==='image',role:properties.role==='list'?SemanticsRole.list:null,value:properties.value??null,onTap:properties.activate??actions?.activate??null,onLongPress:actions?.['long-press']??null,onFocus:actions?.focus??null,onIncrease:actions?.increase??null,onDecrease:actions?.decrease??null,onScrollLeft:actions?.['scroll-left']??null,onScrollRight:actions?.['scroll-right']??null,onScrollUp:actions?.['scroll-up']??actions?.['scroll-backward']??null,onScrollDown:actions?.['scroll-down']??actions?.['scroll-forward']??null});
    }
    protect(this,['key','rect','properties','transform','tags','transportProperties']);
  }
}
interface Subscription {readonly painter:CustomPainter;readonly callback:()=>void;active:boolean;pending:boolean;notified:boolean}
interface SemanticEntry {readonly key:Key|null;readonly id:string;readonly description:CustomPainterSemantics;readonly node:SourceSemanticsNode}
interface PainterSlot {painter:CustomPainter|null;subscription:Subscription|undefined;dirty:boolean;hasBuilder:boolean;entries:readonly SemanticEntry[]}
function failures(errors:unknown[],message:string):void{if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,message);}
function attempt(errors:unknown[],callback:()=>void):void{try{callback();}catch(error){errors.push(error);}}
function preferred(value:Size):Size{invariant(value&&[value.width,value.height].every(n=>typeof n==='number'&&!Number.isNaN(n)&&n>=0),'invalid-custom-paint-size','Preferred size must be nonnegative without NaN');return Object.freeze({width:value.width,height:value.height});}
function painter(value:CustomPainter|null|undefined):CustomPainter|null{invariant(value==null||value instanceof CustomPainter,'invalid-custom-painter','Painter must extend CustomPainter');return value??null;}
let nextRenderId=0;
export interface RenderCustomPaintOptions {readonly painter?:CustomPainter|null;readonly foregroundPainter?:CustomPainter|null;readonly preferredSize?:Size;readonly child?:RenderBox<RenderObject>}
export class RenderCustomPaint extends RenderProxyBox {
  private readonly sourcePainterNodes=new Map<string,SourceSemanticsNode>();
  private readonly background:PainterSlot={painter:null,subscription:undefined,dirty:true,hasBuilder:false,entries:[]};
  private readonly foreground:PainterSlot={painter:null,subscription:undefined,dirty:true,hasBuilder:false,entries:[]};
  private preference:Size;private changing=false;private readonly semanticId=`custom-paint-${++nextRenderId}`;private nextSemanticId=0;
  private get hasSemanticsBuilder():boolean{return this.background.painter?.semanticsBuilder!=null||this.foreground.painter?.semanticsBuilder!=null;}
  override get semanticsTransport():SemanticsTransportProperties|null{return this.hasSemanticsBuilder?{id:this.semanticId,role:'group',name:'',enabled:true}:super.semanticsTransport;}
  override describeSemanticsConfiguration(config:SemanticsConfiguration):void{super.describeSemanticsConfiguration(config);config.isSemanticBoundary=this.hasSemanticsBuilder||config.isSemanticBoundary;}
  override assembleSemanticsNode(node:SourceSemanticsNode,config:SemanticsConfiguration,children:SourceSemanticsNode[]):void {
    const active=new Set<string>(),make=(id:string,properties:SemanticsTransportProperties,rect:Rect,transform:TransformMatrix=identity,descendants:SourceSemanticsNode[]=[]):SourceSemanticsNode=>{active.add(id);let child=this.sourcePainterNodes.get(id);if(!child){child=new SourceSemanticsNode();this.sourcePainterNodes.set(id,child);}const annotation=new SemanticsConfiguration();describeTransportSemantics(annotation,properties,()=>this.showOnScreen(rect));child.updateWith({config:annotation,childrenInInversePaintOrder:descendants});child.rect=SourceRect.fromLTWH(rect.x,rect.y,rect.width,rect.height);child.transform=Matrix4.fromList(fullTransform(transform));setSemanticsTransportProperties(child,properties);return child;};
    const custom=(slot:PainterSlot)=>this.semanticEntries(slot).map(entry=>{active.add(entry.id);this.sourcePainterNodes.set(entry.id,entry.node);setSemanticsTransportProperties(entry.node,{...entry.description.transportProperties??{role:'text' as const,name:'',enabled:true},id:entry.id});return entry.node;});
    const background=custom(this.background),foreground=custom(this.foreground),body=this.hasSemanticsBuilder&&this.semantics?[make(this.semantics.id,this.semantics,this.paintBounds,identity,this.semantics.role==='button'||this.semantics.role==='text-field'?[]:children)]:children;
    super.assembleSemanticsNode(node,config,[...background,...body,...foreground]);for(const id of this.sourcePainterNodes.keys())if(!active.has(id))this.sourcePainterNodes.delete(id);
  }
  /** Source prefix/suffix/keyed reconciliation; null keys are positional only in matching ends. */
  private static _updateSemanticsChildren(oldSemantics:readonly SourceSemanticsNode[]|null,newChildSemantics:readonly CustomPainterSemantics[]|null):SourceSemanticsNode[]{
    oldSemantics??=[];newChildSemantics??=[];
    if(FoundationBuildMode.debug){const keys=new KeyMap<number>(),information:ErrorDescription[]=[];for(let i=0;i<newChildSemantics.length;i++){const child=newChildSemantics[i]!;if(child.key!==null){if(keys.has(child.key))information.push(new ErrorDescription('- duplicate key '+child.key+' found at position '+i));keys.set(child.key,i);}}if(information.length)throw FlutterError.fromParts([new ErrorSummary('Failed to update the list of CustomPainterSemantics:'),...information]);}
    let newChildrenTop=0,oldChildrenTop=0,newChildrenBottom=newChildSemantics.length-1,oldChildrenBottom=oldSemantics.length-1;const newChildren:(SourceSemanticsNode|null)[]=Array(newChildSemantics.length).fill(null);
    while(oldChildrenTop<=oldChildrenBottom&&newChildrenTop<=newChildrenBottom){const oldChild=oldSemantics[oldChildrenTop]!,newSemantics=newChildSemantics[newChildrenTop]!;if(!this._canUpdateSemanticsChild(oldChild,newSemantics))break;newChildren[newChildrenTop]=this._updateSemanticsChild(oldChild,newSemantics);newChildrenTop++;oldChildrenTop++;}
    while(oldChildrenTop<=oldChildrenBottom&&newChildrenTop<=newChildrenBottom){if(!this._canUpdateSemanticsChild(oldSemantics[oldChildrenBottom]!,newChildSemantics[newChildrenBottom]!))break;oldChildrenBottom--;newChildrenBottom--;}
    const haveOldChildren=oldChildrenTop<=oldChildrenBottom,oldKeyedChildren=new KeyMap<SourceSemanticsNode>();if(haveOldChildren)while(oldChildrenTop<=oldChildrenBottom){const oldChild=oldSemantics[oldChildrenTop]!;if(oldChild.key!==null)oldKeyedChildren.set(oldChild.key,oldChild);oldChildrenTop++;}
    while(newChildrenTop<=newChildrenBottom){let oldChild:SourceSemanticsNode|null=null;const newSemantics=newChildSemantics[newChildrenTop]!;if(haveOldChildren&&newSemantics.key!==null){oldChild=oldKeyedChildren.get(newSemantics.key)??null;if(oldChild!==null){if(this._canUpdateSemanticsChild(oldChild,newSemantics))oldKeyedChildren.delete(newSemantics.key);else oldChild=null;}}
      if(FoundationBuildMode.debug)invariant(oldChild===null||this._canUpdateSemanticsChild(oldChild,newSemantics),'invalid-painter-semantics-key','Painter semantics keys must match');const newChild=this._updateSemanticsChild(oldChild,newSemantics);if(FoundationBuildMode.debug)invariant(oldChild===null||oldChild===newChild,'replaced-painter-semantics-node','Updated semantics node must retain identity');newChildren[newChildrenTop++]=newChild;
    }
    if(FoundationBuildMode.debug)invariant(oldChildrenTop===oldChildrenBottom+1&&newChildrenTop===newChildrenBottom+1&&newChildSemantics.length-newChildrenTop===oldSemantics.length-oldChildrenTop,'invalid-painter-semantics-cursors','Painter semantics reconciliation cursors must agree');
    newChildrenBottom=newChildSemantics.length-1;oldChildrenBottom=oldSemantics.length-1;
    while(oldChildrenTop<=oldChildrenBottom&&newChildrenTop<=newChildrenBottom){const oldChild=oldSemantics[oldChildrenTop]!,newSemantics=newChildSemantics[newChildrenTop]!;if(FoundationBuildMode.debug)invariant(this._canUpdateSemanticsChild(oldChild,newSemantics),'invalid-painter-semantics-suffix','Painter semantics suffix keys must match');const newChild=this._updateSemanticsChild(oldChild,newSemantics);if(FoundationBuildMode.debug)invariant(oldChild===newChild,'replaced-painter-semantics-node','Updated semantics node must retain identity');newChildren[newChildrenTop++]=newChild;oldChildrenTop++;}
    if(FoundationBuildMode.debug)invariant(newChildren.every(node=>node!==null),'missing-painter-semantics-node','Every painter semantics slot must be populated');return newChildren as SourceSemanticsNode[];
  }
  private static _canUpdateSemanticsChild(oldChild:SourceSemanticsNode,newSemantics:CustomPainterSemantics):boolean{return sameKey(oldChild.key,newSemantics.key);}
  private static _updateSemanticsChild(oldChild:SourceSemanticsNode|null,newSemantics:CustomPainterSemantics):SourceSemanticsNode{
    if(FoundationBuildMode.debug)invariant(oldChild===null||this._canUpdateSemanticsChild(oldChild,newSemantics),'invalid-painter-semantics-key','Painter semantics keys must match');
    const newChild=oldChild??new SourceSemanticsNode({key:newSemantics.key}),properties=newSemantics.properties,config=new SemanticsConfiguration();
    if (properties.role != null) {
      config.role = properties.role!;
    }
    if (properties.sortKey != null) {
      config.sortKey = properties.sortKey;
    }
    if (properties.checked != null) {
      config.isChecked = properties.checked;
    }
    if (properties.mixed != null) {
      config.isCheckStateMixed = properties.mixed;
    }
    if (properties.selected != null) {
      config.isSelected = properties.selected!;
    }
    if (properties.button != null) {
      config.isButton = properties.button!;
    }
    if (properties.expanded != null) {
      config.isExpanded = properties.expanded;
    }
    if (properties.link != null) {
      config.isLink = properties.link!;
    }
    if (properties.linkUrl != null) {
      config.linkUrl = properties.linkUrl;
    }
    if (properties.textField != null) {
      config.isTextField = properties.textField!;
    }
    if (properties.slider != null) {
      config.isSlider = properties.slider!;
    }
    if (properties.keyboardKey != null) {
      config.isKeyboardKey = properties.keyboardKey!;
    }
    if (properties.readOnly != null) {
      config.isReadOnly = properties.readOnly!;
    }
    if (properties.focusable != null) {
      config.isFocusable = properties.focusable!;
    }
    if (properties.focused != null) {
      config.isFocused = properties.focused;
    }
    if (properties.accessibilityFocusBlockType != null) {
      config.accessibilityFocusBlockType = properties.accessibilityFocusBlockType!;
    }
    if (properties.enabled != null) {
      config.isEnabled = properties.enabled;
    }
    if (properties.inMutuallyExclusiveGroup != null) {
      config.isInMutuallyExclusiveGroup = properties.inMutuallyExclusiveGroup!;
    }
    if (properties.obscured != null) {
      config.isObscured = properties.obscured!;
    }
    if (properties.multiline != null) {
      config.isMultiline = properties.multiline!;
    }
    if (properties.hidden != null) {
      config.isHidden = properties.hidden!;
    }
    if (properties.header != null) {
      config.isHeader = properties.header!;
    }
    if (properties.headingLevel != null) {
      config.headingLevel = properties.headingLevel!;
    }
    if (properties.scopesRoute != null) {
      config.scopesRoute = properties.scopesRoute!;
    }
    if (properties.namesRoute != null) {
      config.namesRoute = properties.namesRoute!;
    }
    if (properties.liveRegion != null) {
      config.liveRegion = properties.liveRegion!;
    }
    if (properties.isRequired != null) {
      config.isRequired = properties.isRequired;
    }
    if (properties.maxValueLength != null) {
      config.maxValueLength = properties.maxValueLength;
    }
    if (properties.currentValueLength != null) {
      config.currentValueLength = properties.currentValueLength;
    }
    if (properties.toggled != null) {
      config.isToggled = properties.toggled;
    }
    if (properties.image != null) {
      config.isImage = properties.image!;
    }
    if (properties.label != null) {
      config.label = properties.label!;
    }
    if (properties.value != null) {
      config.value = properties.value!;
    }
    if (properties.increasedValue != null) {
      config.increasedValue = properties.increasedValue!;
    }
    if (properties.decreasedValue != null) {
      config.decreasedValue = properties.decreasedValue!;
    }
    if (properties.hint != null) {
      config.hint = properties.hint!;
    }
    if (properties.identifier != null) {
      config.identifier = properties.identifier!;
    }
    if (properties.traversalParentIdentifier != null) {
      config.traversalParentIdentifier = properties.traversalParentIdentifier;
    }
    if (properties.traversalChildIdentifier != null) {
      config.traversalChildIdentifier = properties.traversalChildIdentifier;
    }
    if (properties.tooltip != null) {
      config.tooltip = properties.tooltip!;
    }
    if (properties.hintOverrides != null) {
      config.hintOverrides = properties.hintOverrides;
    }
    if (properties.tagForChildren != null) {
      config.addTagForChildren(properties.tagForChildren!);
    }
    if (properties.controlsNodes != null) {
      config.controlsNodes = properties.controlsNodes;
    }
    if (properties.hint != null) {
      config.hint = properties.hint!;
    }
    if (properties.textDirection != null) {
      config.textDirection = properties.textDirection;
    }
    if (config.validationResult != properties.validationResult) {
      config.validationResult = properties.validationResult;
    }
    if (properties.hitTestBehavior != null) {
      config.hitTestBehavior = properties.hitTestBehavior!;
    }
    if (properties.inputType != null) {
      config.inputType = properties.inputType!;
    }
    if (properties.minValue != null) {
      config.minValue = properties.minValue;
    }
    if (properties.maxValue != null) {
      config.maxValue = properties.maxValue;
    }
    if (properties.onTap != null) {
      config.onTap = properties.onTap;
    }
    if (properties.onLongPress != null) {
      config.onLongPress = properties.onLongPress;
    }
    if (properties.onScrollLeft != null) {
      config.onScrollLeft = properties.onScrollLeft;
    }
    if (properties.onScrollRight != null) {
      config.onScrollRight = properties.onScrollRight;
    }
    if (properties.onScrollUp != null) {
      config.onScrollUp = properties.onScrollUp;
    }
    if (properties.onScrollDown != null) {
      config.onScrollDown = properties.onScrollDown;
    }
    if (properties.onIncrease != null) {
      config.onIncrease = properties.onIncrease;
    }
    if (properties.onDecrease != null) {
      config.onDecrease = properties.onDecrease;
    }
    if (properties.onCopy != null) {
      config.onCopy = properties.onCopy;
    }
    if (properties.onCut != null) {
      config.onCut = properties.onCut;
    }
    if (properties.onPaste != null) {
      config.onPaste = properties.onPaste;
    }
    if (properties.onMoveCursorForwardByCharacter != null) {
      config.onMoveCursorForwardByCharacter = properties.onMoveCursorForwardByCharacter;
    }
    if (properties.onMoveCursorBackwardByCharacter != null) {
      config.onMoveCursorBackwardByCharacter = properties.onMoveCursorBackwardByCharacter;
    }
    if (properties.onMoveCursorForwardByWord != null) {
      config.onMoveCursorForwardByWord = properties.onMoveCursorForwardByWord;
    }
    if (properties.onMoveCursorBackwardByWord != null) {
      config.onMoveCursorBackwardByWord = properties.onMoveCursorBackwardByWord;
    }
    if (properties.onSetSelection != null) {
      config.onSetSelection = properties.onSetSelection;
    }
    if (properties.onSetText != null) {
      config.onSetText = properties.onSetText;
    }
    if (properties.onDidGainAccessibilityFocus != null) {
      config.onDidGainAccessibilityFocus = properties.onDidGainAccessibilityFocus;
    }
    if (properties.onDidLoseAccessibilityFocus != null) {
      config.onDidLoseAccessibilityFocus = properties.onDidLoseAccessibilityFocus;
    }
    if (properties.onFocus != null) {
      config.onFocus = properties.onFocus;
    }
    if (properties.onDismiss != null) {
      config.onDismiss = properties.onDismiss;
    }
    if (properties.onExpand != null) {
      config.onExpand = properties.onExpand;
    }
    if (properties.onCollapse != null) {
      config.onCollapse = properties.onCollapse;
    }


    // This field belongs only to the pre-existing host-property adapter.
    if(newSemantics.transportProperties?.scrollPosition!==undefined)config.scrollPosition=newSemantics.transportProperties.scrollPosition;
    newChild.updateWith({config,childrenInInversePaintOrder:[]});newChild.rect=newSemantics.rect;newChild.transform=newSemantics.transform;newChild.tags=newSemantics.tags;return newChild;
  }
  constructor(options:RenderCustomPaintOptions={}){super();invariant(Object.keys(options).every(key=>['painter','foregroundPainter','preferredSize','child'].includes(key)),'unsupported-custom-paint-option','Raster cache hints and unknown options are not implemented');this.preference=preferred(options.preferredSize??{width:0,height:0});this.background.painter=painter(options.painter);this.foreground.painter=painter(options.foregroundPainter);if(options.child)this.child=options.child;}
  get painter():CustomPainter|null{return this.background.painter;}set painter(value:CustomPainter|null){this.updatePainter(this.background,value);}
  get foregroundPainter():CustomPainter|null{return this.foreground.painter;}set foregroundPainter(value:CustomPainter|null){this.updatePainter(this.foreground,value);}
  get preferredSize():Size{return this.preference;}set preferredSize(value:Size){this.assertCanMutateLayoutProperty();const next=preferred(value);if(this.preference.width===next.width&&this.preference.height===next.height)return;this.preference=next;this.markNeedsLayout();}
  private updatePainter(slot:PainterSlot,value:CustomPainter|null):void{
    this.assertCanMutateLayoutProperty();invariant(!this.changing,'reentrant-custom-painter','Painter binding is active');value=painter(value);if(value===slot.painter)return;this.changing=true;const errors:unknown[]=[];
    try{const old=slot.painter,different=!old||!value||old.typeToken!==value.typeToken,repaint=different||value!.shouldRepaint(old!),semantics=different||value!.shouldRebuildSemantics(old!),next=this.attached&&value?this.subscribe(value):undefined,previous=slot.subscription;
      slot.painter=value;slot.subscription=next;slot.dirty ||= semantics;if(next){next.pending=false;next.active=true;}this.retire(previous,errors);if(semantics)attempt(errors,()=>super.markNeedsSemanticsUpdate());if(repaint||next?.notified)attempt(errors,()=>this.markNeedsPaintOnly());
    }finally{this.changing=false;}failures(errors,'Custom painter replacement failed');
  }
  private subscribe(source:CustomPainter):Subscription{const entry:Subscription={painter:source,callback:()=>{if(entry.active&&this.attached&&!this.debugDisposed)this.markNeedsPaintOnly();else if(entry.pending)entry.notified=true;},active:false,pending:true,notified:false};try{source.addListener(entry.callback);return entry;}catch(error){entry.pending=false;const errors=[error];attempt(errors,()=>source.removeListener(entry.callback));failures(errors,'Custom painter listener registration failed');throw error;}}
  private retire(entry:Subscription|undefined,errors:unknown[]):void{if(entry){entry.active=false;entry.pending=false;attempt(errors,()=>entry.painter.removeListener(entry.callback));}}
  override attach(owner:PipelineOwner):void{
    invariant(!this.changing,'reentrant-custom-painter','Painter binding is active');const attached=this.attached;super.attach(owner);if(attached)return;this.changing=true;const pending:Subscription[]=[],errors:unknown[]=[];
    try{for(const slot of [this.background,this.foreground])if(slot.painter)pending.push(this.subscribe(slot.painter));let index=0;for(const slot of [this.background,this.foreground]){slot.subscription=slot.painter?pending[index++]:undefined;if(slot.subscription){slot.subscription.pending=false;slot.subscription.active=true;}}if(pending.some(entry=>entry.notified))this.markNeedsPaintOnly();}
    catch(error){errors.push(error);for(const entry of pending)this.retire(entry,errors);this.background.subscription=undefined;this.foreground.subscription=undefined;if(!this.parent)attempt(errors,()=>super.detach());}
    finally{this.changing=false;}failures(errors,'Custom painter attach failed');
  }
  override detach():void{invariant(!this.changing,'reentrant-custom-painter','Painter binding is active');this.changing=true;const errors:unknown[]=[];try{attempt(errors,()=>super.detach());if(!this.attached)for(const slot of [this.background,this.foreground]){const old=slot.subscription;slot.subscription=undefined;this.retire(old,errors);}}finally{this.changing=false;}failures(errors,'Custom painter detach failed');}
  override dispose():void{assertOutsideRenderPaint();const errors:unknown[]=[];attempt(errors,()=>super.dispose());if(this.debugDisposed)for(const slot of [this.background,this.foreground]){const old=slot.subscription;slot.subscription=undefined;slot.painter=null;slot.entries=[];this.retire(old,errors);}failures(errors,'Custom painter teardown failed');}
  override markNeedsLayout():void{super.markNeedsLayout();this.background.dirty=true;this.foreground.dirty=true;}
  override markNeedsSemanticsUpdate():void{this.background.dirty=true;this.foreground.dirty=true;super.markNeedsSemanticsUpdate();}
  override clearSemantics():void{super.clearSemantics();this.sourcePainterNodes.clear();this.background.entries=[];this.foreground.entries=[];this.background.dirty=true;this.foreground.dirty=true;}
  protected computeSizeForNoChild(constraints:BoxConstraints):Size{return constraints.constrain(this.preference);}
  protected override performLayout(constraints:BoxConstraints):Size{const size=this.child?super.performLayout(constraints):this.computeSizeForNoChild(constraints);this.background.dirty=true;this.foreground.dirty=true;return size;}
  protected override computeDryLayout(constraints:BoxConstraints):Size{return this.child?super.computeDryLayout(constraints):this.computeSizeForNoChild(constraints);}
  protected override computeMinIntrinsicWidth(height:number):number{return this.child?super.computeMinIntrinsicWidth(height):Number.isFinite(this.preference.width)?this.preference.width:0;}
  protected override computeMaxIntrinsicWidth(height:number):number{return this.child?super.computeMaxIntrinsicWidth(height):Number.isFinite(this.preference.width)?this.preference.width:0;}
  protected override computeMinIntrinsicHeight(width:number):number{return this.child?super.computeMinIntrinsicHeight(width):Number.isFinite(this.preference.height)?this.preference.height:0;}
  protected override computeMaxIntrinsicHeight(width:number):number{return this.child?super.computeMaxIntrinsicHeight(width):Number.isFinite(this.preference.height)?this.preference.height:0;}
  private paintWithPainter(context:PaintingContext,delegate:CustomPainter):void{
    const start=context.commands.length;context.save();try{withRenderPaint(()=>delegate.paint(context.canvas,this.size));let depth=1;for(const command of context.commands.slice(start+1)){if(command.op==='save'||command.op==='saveLayer')depth++;else if(command.op==='restore'){depth--;invariant(depth>=1,'unbalanced-custom-painter','Painter restored its enclosing canvas scope');}}invariant(depth===1,'unbalanced-custom-painter','Painter must balance canvas save/saveLayer/restore');context.restore();}
    catch(error){try{context.rollback(start);}catch(cleanup){throw new AggregateError([error,cleanup],'Custom paint and resource rollback failed');}throw error;}
  }
  override paint(context:PaintingContext):void{withRenderPaint(()=>{if(this.painter)this.paintWithPainter(context,this.painter);super.paint(context);if(this.foregroundPainter)this.paintWithPainter(context,this.foregroundPainter);});}
  private painterHit(delegate:CustomPainter|null,position:Offset,fallback:boolean):boolean{if(!delegate)return false;const hit=delegate.hitTest(position);invariant(hit===null||typeof hit==='boolean','invalid-custom-hit-test','Painter hitTest must return boolean or null');return hit??fallback;}
  hitTestSelf(position:Offset):boolean{return this.painterHit(this.painter,position,true);}
  hitTestChildren(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{if(this.painterHit(this.foregroundPainter,position,false))return true;const child=this.child,matrix=child?inversePaintTransform(this.childTransform(child)):null;return !!child&&!!matrix&&child.hitTest(transform(matrix,position),result,multiply(matrix,toLocal));}
  override hitTest(position:Offset,result:HitTestEntry[],toLocal:TransformMatrix=identity):boolean{if(position.x<0||position.y<0||position.x>=this.size.width||position.y>=this.size.height)return false;if(this.hitTestChildren(position,result,toLocal)||this.hitTestSelf(position)){result.push({target:this,transform:toLocal});return true;}return false;}
  private semanticEntries(slot:PainterSlot):readonly SemanticEntry[]{
    if(!slot.dirty)return slot.entries;const build=slot.painter?.semanticsBuilder,descriptions=build?withRenderPaint(()=>build(this.size)):[];
    invariant(Array.isArray(descriptions)&&descriptions.length<=2048,'custom-semantics-budget','Painter semantics builder must return at most 2048 entries');for(const description of descriptions)invariant(description instanceof CustomPainterSemantics,'invalid-custom-semantics','Builder entries must be CustomPainterSemantics');
    const previous=new Map(slot.entries.map(entry=>[entry.node,entry])),nodes=RenderCustomPaint._updateSemanticsChildren(slot.entries.map(entry=>entry.node),descriptions);
    slot.entries=Object.freeze(descriptions.map((description,index)=>{const node=nodes[index]!;return {key:description.key,id:previous.get(node)?.id??`${this.semanticId}-node-${++this.nextSemanticId}`,description,node};}));slot.hasBuilder=!!build;slot.dirty=false;return slot.entries;
  }
  override collectSemantics(output:SemanticsNode[],matrix:TransformMatrix=identity,clip?:Rect):void{
    const custom=(slot:PainterSlot):SemanticsNode[]=>this.semanticEntries(slot).flatMap(entry=>{const item=entry.description,box=bounds(multiply(matrix,multiply(item.transform?captureTransform(item.transform.storage):identity,translate(item.rect.x,item.rect.y))),item.rect),visible=clip?intersect(box,clip):box,data=entry.node.getSemanticsData(),properties=item.transportProperties??{role:data.flagsCollection.isButton?'button' as const:data.flagsCollection.isTextField?'text-field' as const:data.flagsCollection.isImage?'image' as const:'text' as const,name:data.label,enabled:data.flagsCollection.isEnabled!==Tristate.isFalse,...(item.properties.onTap?{activate:item.properties.onTap}:{})};return visible.width>0&&visible.height>0?[{...properties,id:entry.id,bounds:visible}]:[];});
    const background=custom(this.background),foreground=custom(this.foreground),children:SemanticsNode[]=[];super.collectSemantics(children,matrix,clip);const all=[...background,...children,...foreground];
    if(this.background.hasBuilder||this.foreground.hasBuilder){const box=bounds(matrix,this.size),visible=clip?intersect(box,clip):box;if(visible.width>0&&visible.height>0)output.push({id:this.semanticId,role:'group',name:'',enabled:true,bounds:visible,children:all});}else output.push(...all);
  }
}
