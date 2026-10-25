// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {SemanticsAction} from '../../ui/semantics-action.ts';
import {invariant,exceptionStack} from '../../foundation/errors.ts';
import {freezeEditorStyle} from '../../hosting/editor-style.ts';
import {freezeTextInputGeometry} from '../../ui/editing.ts';
import type {SemanticsNode as TransportSemanticsNode,SemanticsTextNavigation,SemanticsTextRange} from '../../ui/types.ts';
import {textOffset} from '../../ui/text.ts';
import {StringAttribute} from '../../ui/string-attribute.ts';
import {protect,finalFieldProtector,fixed} from '../../ui/value-math.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {Diagnosticable,DiagnosticableTree,DiagnosticableTreeMixin} from '../../foundation/diagnosticable.ts';
import {StringProperty,DiagnosticsProperty,DiagnosticableNode,ErrorDescription} from '../../foundation/diagnostics.ts';
import type {DiagnosticPropertiesBuilder,DiagnosticsPropertyOptions,DiagnosticsStringOptions,DiagnosticsOptions,DiagnosticsNode} from '../../foundation/diagnostics.ts';
import {DoubleProperty,IntProperty,EnumProperty,IterableProperty,MessageProperty,FlagProperty} from '../../foundation/diagnostic-properties.ts';
import {SemanticsFlag,SemanticsFlags,CheckedState,Tristate,SemanticsRole,SemanticsInputType,SemanticsValidationResult,SemanticsHitTestBehavior,SemanticsUpdateBuilder} from '../../ui/semantics.ts';
import type {SemanticsUpdate} from '../../ui/semantics.ts';
import {hashValues,valueEquals,listEquals} from '../painting/value-equality.ts';
import {Rect as RectValue} from '../../ui/rect.ts';
import {Matrix4} from '../../math/matrix4.ts';
import {TransformProperty,MatrixUtils} from '../painting/matrix-utils.ts';
import {Vector3} from '../../math/vector3.ts';
import {numericObjectStorage} from '../../math/numeric-helpers.ts';
import type {Key} from '../../foundation/key.ts';
import {ChangeNotifier} from '../../foundation/notifier.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FlutterErrorDetails} from '../../foundation/assertions.ts';
import {SystemChannels,SystemChannelSet} from '../../services/system-channels.ts';
import type {BinaryMessenger} from '../../services/binary-messenger.ts';
import type {BasicMessageChannel} from '../../services/platform-channel.ts';
import type {SemanticsEvent} from './semantics-event.ts';
import {FoundationPlatform} from '../../foundation/platform.ts';
import type {Locale} from '../../ui/locale.ts';
import {Offset} from '../../ui/offset.ts';
import {TextSelection} from '../../services/text-editing.ts';
import {AttributedString} from './attributed-string.ts';
/** Debug-only role requirements from the pinned framework semantics tree. */
class _DebugSemanticsRoleChecks {
  static check(node:SemanticsNode):FlutterError|null {
    const error=this.roleError(node)??this.generalError(node);
    return error===null?null:new FlutterError(error);
  }
  private static roleError(node:SemanticsNode):string|null {
    const data=node.getSemanticsData(),role=node.role;
    const hasMenuAncestor=():boolean=>{for(let parent=node.parent;parent!==null;parent=parent.parent)if(parent.role===SemanticsRole.menu||parent.role===SemanticsRole.menuBar)return true;return false;};
    const childrenError=(allowed:readonly SemanticsRole[],message:string):string|null=>{let error:string|null=null;node.visitChildren(child=>{if(!allowed.includes(child.getSemanticsData().role))error=message;return error===null;});return error;};
    switch(role){
      case SemanticsRole.progressBar:return this.progressBar(data);
      case SemanticsRole.slider:return this.slider(data);
      case SemanticsRole.tab:
        if(data.flagsCollection.isSelected===Tristate.none)return 'A tab needs selected states';
        return !node.areUserActionsBlocked&&data.flagsCollection.isEnabled!==Tristate.isFalse&&!data.hasAction(SemanticsAction.tap)?'A tab must have a tap action':null;
      case SemanticsRole.tabBar:return node.childrenCount<1?'a TabBar cannot be empty':childrenError([SemanticsRole.tab],'Children of TabBar must have the tab role');
      case SemanticsRole.table:return childrenError([SemanticsRole.row],'Children of Table must have the row role');
      case SemanticsRole.row:return node.parent?.role!==SemanticsRole.table?'A row must be a child of a table':childrenError([SemanticsRole.cell,SemanticsRole.columnHeader],'Children of Row must have the cell or columnHeader role');
      case SemanticsRole.cell:return node.parent?.role!==SemanticsRole.row&&node.parent?.role!==SemanticsRole.cell?'A cell must be a child of a row or another cell':null;
      case SemanticsRole.columnHeader:return node.parent?.role!==SemanticsRole.row&&node.parent?.role!==SemanticsRole.cell?'A columnHeader must be a child or another cell':null;
      case SemanticsRole.radioGroup:{
        let checked=false,error:string|null=null;
        const visit=(child:SemanticsNode):boolean=>{const childData=child.getSemanticsData();if(childData.role===SemanticsRole.radioGroup)return error===null;if(!childData.flagsCollection.isInMutuallyExclusiveGroup){child.visitChildren(visit);return error===null;}if(childData.flagsCollection.isChecked===CheckedState.isTrue){if(checked){error='Radio groups must not have multiple checked children';return false;}checked=true;}return true;};
        node.visitChildren(visit);return error;
      }
      case SemanticsRole.menu:return node.childrenCount<1?'a menu cannot be empty':null;
      case SemanticsRole.menuBar:return node.childrenCount<1?'a menu bar cannot be empty':null;
      case SemanticsRole.menuItem:return hasMenuAncestor()?null:'A menu item must be a child of a menu or a menu bar';
      case SemanticsRole.menuItemCheckbox:
        if(data.flagsCollection.isChecked===CheckedState.none)return 'a menu item checkbox must be checkable';
        return hasMenuAncestor()?null:'A menu item checkbox must be a child of a menu or a menu bar';
      case SemanticsRole.menuItemRadio:
        if(data.flagsCollection.isChecked===CheckedState.none)return 'a menu item radio must be checkable';
        return hasMenuAncestor()?null:'A menu item radio must be a child of a menu or a menu bar';
      case SemanticsRole.alert:case SemanticsRole.status:
        return data.flagsCollection.isLiveRegion?`Node ${node.id} has role SemanticsRole.${data.role} but is also a live region. A node can not have SemanticsRole.${data.role} and be live region at the same time. Either remove the role or the live region`:null;
      case SemanticsRole.listItem:{
        const parent=node.parent;
        if(parent===null)return `Semantics node ${node.id} has role SemanticsRole.${data.role} but doesn't have a parent`;
        return parent.getSemanticsData().role!==SemanticsRole.list?`Semantics node ${node.id} has role SemanticsRole.${data.role}, but its parent node ${parent.id} doesn't have the role SemanticsRole.list. Please assign the SemanticsRole.list to node ${parent.id}`:null;
      }
      case SemanticsRole.complementary:case SemanticsRole.contentInfo:case SemanticsRole.main:
        for(let parent=node.parent;parent!==null;parent=parent.parent)if(this.isLandmark(parent.getSemanticsData().role))return `The ${role} landmark role should not contained within any other landmark roles.`;
        return this.landmarkLabel(node,data);
      case SemanticsRole.navigation:return this.landmarkLabel(node,data);
      case SemanticsRole.region:return data.label.length===0?'A region role should include a label that describes the purpose of the content.':null;
      case SemanticsRole.dragHandle:case SemanticsRole.spinButton:case SemanticsRole.comboBox:case SemanticsRole.tooltip:case SemanticsRole.hotKey:return `Missing checks for role SemanticsRole.${data.role}`;
      default:return null;
    }
  }
  private static isLandmark(role:SemanticsRole):boolean{return role===SemanticsRole.complementary||role===SemanticsRole.contentInfo||role===SemanticsRole.main||role===SemanticsRole.navigation||role===SemanticsRole.region;}
  private static landmarkLabel(node:SemanticsNode,data:SemanticsData):string|null {
    invariant(node.owner!==null,'detached-semantics-landmark','Landmark validation requires an attached node');
    let count=0;
    for(const other of ownerState(node.owner)._nodes.values())if(other.getSemanticsData().role===node.role&&++count>1)return data.label.length===0?`The ${node.role} landmark role should have a unique label as it is used more than once.`:null;
    return null;
  }
  private static number(value:string):number|null {
    const text=value.trim();
    // Dart double.tryParse rejects JS-only forms such as empty strings and hex.
    if(!/^[+-]?(?:NaN|Infinity|(?:(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?))$/.test(text))return null;
    return /^[+-]?NaN$/.test(text)?NaN:Number(text);
  }
  private static progressBar(data:SemanticsData):string|null {
    if(data.value.length===0||!data.minValue||!data.maxValue)return 'A progress bar must have a value, a minValue, a maxValue.';
    const min=this.number(data.minValue),max=this.number(data.maxValue),value=this.number(data.value),percent=data.value.endsWith('%')?this.number(data.value.slice(0,-1)):null;
    if(min===null||max===null||value===null&&percent===null)return `Progress bar value, minValue, and maxValue must be valid numbers. value: "${data.value}", minValue: "${data.minValue}", maxValue: "${data.maxValue}"`;
    if(min>=max)return `Progress bar minValue (${data.minValue}) must be less than maxValue (${data.maxValue})`;
    if(value!==null)return value<min||value>max?`Progress bar value (${data.value}) must be between minValue (${data.minValue}) and maxValue (${data.maxValue})`:null;
    return percent!==null&&(percent<0||percent>100)?`Progress bar percentage value (${data.value}) must be between 0% and 100%`:null;
  }
  private static slider(data:SemanticsData):string|null {
    if(data.value.length===0)return 'A slider must have a value';
    if(!data.minValue)return 'A slider must have a minValue';
    if(!data.maxValue)return 'A slider must have a maxValue';
    const value=this.number(data.value.replaceAll('%','')),min=this.number(data.minValue),max=this.number(data.maxValue);
    if(value===null||min===null||max===null)return `Slider value, minValue, and maxValue must be valid numbers. value: "${data.value}", minValue: "${data.minValue}", maxValue: "${data.maxValue}"`;
    if(min>=max)return `Slider minValue (${data.minValue}) must be less than maxValue (${data.maxValue})`;
    if(data.value.includes('%'))return value<0||value>100?`Slider percentage value (${data.value}) must be between 0% and 100%`:null;
    return value<min||value>max?`Slider value (${data.value}) must be between minValue (${data.minValue}) and maxValue (${data.maxValue})`:null;
  }
  private static generalError(node:SemanticsNode):string|null {
    const data=node.getSemanticsData(),expanded=data.flagsCollection.isExpanded;
    if(expanded!==Tristate.none){const expand=data.hasAction(SemanticsAction.expand),collapse=data.hasAction(SemanticsAction.collapse);if(expand&&collapse)return 'An expandable node cannot have both expand and collapse actions set at the same time.';if(expanded===Tristate.isTrue&&expand)return 'An expanded node cannot have an expand action.';if(expanded===Tristate.isFalse&&collapse)return 'A collapsed node cannot have a collapse action.';}
    return data.flagsCollection.isAccessibilityFocusBlocked&&data.flagsCollection.isFocused!==Tristate.none?'A node that is keyboard focusable cannot be set to accessibility unfocusable':null;
  }
}

export class AttributedStringProperty extends DiagnosticsProperty<AttributedString> {
  readonly showWhenEmpty:boolean;
  constructor(name:string,value:AttributedString|null,options:DiagnosticsPropertyOptions<AttributedString>&{readonly showWhenEmpty?:boolean}={}){super(name,value,{...options,typeName:'AttributedString'});this.showWhenEmpty=options.showWhenEmpty??false;protect(this,['showWhenEmpty']);}
  override get isInteresting():boolean{return super.isInteresting&&(this.showWhenEmpty||this.value!==null&&this.value.string.length>0);}
  override valueToString(options:DiagnosticsStringOptions={}):string{const value=this.value;if(value===null)return 'null';const text=options.parentConfiguration?.lineBreakProperties===false?value.string.replaceAll('\n','\\n'):value.string;return `"${text}"${value.attributes.length===0?'':` [${value.attributes.join(', ')}]`}`;}
}
export const AccessibilityFocusBlockType=Object.freeze({none:'none',blockSubtree:'blockSubtree',blockNode:'blockNode'} as const);
export type AccessibilityFocusBlockType=typeof AccessibilityFocusBlockType[keyof typeof AccessibilityFocusBlockType];
/** Source ordering groups unnamed keys before named keys; names use UTF-16 ordering. */
export abstract class SemanticsSortKey extends Diagnosticable(class {}) {
  readonly name:string|null;
  constructor({name=null}:{readonly name?:string|null}={}){super();this.name=name;protect(this,['name']);}
  compareTo(other:SemanticsSortKey):number{
    if(FoundationBuildMode.debug)invariant(this.constructor===other.constructor,'incompatible-semantics-sort-key','Semantics sort keys can only be compared to other sort keys of the same type.');
    if(this.name===other.name)return this.doCompare(other);
    if(this.name===null)return -1;if(other.name===null)return 1;
    return this.name<other.name?-1:1;
  }
  protected abstract doCompare(other:SemanticsSortKey):number;
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new StringProperty('name',this.name,{defaultValue:null}));}
}
export class OrdinalSortKey extends SemanticsSortKey {
  constructor(readonly order:number,options:{readonly name?:string|null}={}){super(options);if(FoundationBuildMode.debug)invariant(order>-Infinity&&order<Infinity,'nonfinite-semantics-order','Semantics order must be finite');protect(this,['order']);}
  protected override doCompare(other:OrdinalSortKey):number{invariant(other instanceof OrdinalSortKey,'invalid-ordinal-sort-key','Ordinal ordering requires an OrdinalSortKey');if(other.order===this.order)return 0;if(Number.isNaN(this.order))return Number.isNaN(other.order)?0:1;if(Number.isNaN(other.order))return -1;return this.order<other.order?-1:1;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DoubleProperty('order',this.order,{defaultValue:null}));}
}
/** Value-equal actions share the source registry identity, including across distinct instances. */
export class CustomSemanticsAction {
  readonly label:string|null;readonly hint:string|null;readonly action:SemanticsAction|null;
  constructor({label}:{readonly label:string}){if(FoundationBuildMode.debug)invariant(label!=='','empty-semantics-action-label','Custom action label cannot be empty');this.label=label;this.hint=null;this.action=null;protect(this,['label','hint','action']);}
  static overridingAction({hint,action}:{readonly hint:string;readonly action:SemanticsAction}):CustomSemanticsAction{
    if(FoundationBuildMode.debug)invariant(hint!=='','empty-semantics-action-hint','Custom action hint cannot be empty');
    const result=Object.create(CustomSemanticsAction.prototype) as CustomSemanticsAction;Object.defineProperties(result,{label:{value:null,enumerable:true},hint:{value:hint,enumerable:true},action:{value:action,enumerable:true}});return result;
  }
  equals(other:unknown):boolean{return other instanceof CustomSemanticsAction&&other.constructor===this.constructor&&other.label===this.label&&other.hint===this.hint&&other.action===this.action;}
  get hashCode():number{return hashValues(this.label,this.hint,this.action);}
  private static nextId=0;
  private static readonly actions=new Map<number,CustomSemanticsAction>();
  private static readonly ids=new Map<number,{action:CustomSemanticsAction;id:number}[]>();
  private static identifierOf(action:CustomSemanticsAction):number|null{return this.ids.get(action.hashCode)?.find(entry=>entry.action.equals(action))?.id??null;}
  static getIdentifier(action:CustomSemanticsAction):number{const previous=this.identifierOf(action);if(previous!==null)return previous;const id=this.nextId++,hash=action.hashCode,bucket=this.ids.get(hash)??[];bucket.push({action,id});this.ids.set(hash,bucket);this.actions.set(id,action);return id;}
  static getAction(id:number):CustomSemanticsAction|null{return this.actions.get(id)??null;}
  static resetForTests():void{if(FoundationBuildMode.debug){this.actions.clear();this.ids.clear();this.nextId=0;}}
  toString():string{return `CustomSemanticsAction(${CustomSemanticsAction.identifierOf(this)}, label:${this.label}, hint:${this.hint}, action:${this.action})`;}
}
export class SemanticsHintOverrides extends DiagnosticableTree {
  readonly onTapHint:string|null;readonly onLongPressHint:string|null;
  constructor({onTapHint=null,onLongPressHint=null}:{readonly onTapHint?:string|null;readonly onLongPressHint?:string|null}={}){super();if(FoundationBuildMode.debug)invariant(onTapHint!==''&&onLongPressHint!=='','empty-semantics-hint','Semantics hints cannot be empty');this.onTapHint=onTapHint;this.onLongPressHint=onLongPressHint;protect(this,['onTapHint','onLongPressHint']);}
  get isNotEmpty():boolean{return this.onTapHint!==null||this.onLongPressHint!==null;}
  equals(other:unknown):boolean{return other instanceof SemanticsHintOverrides&&other.constructor===this.constructor&&other.onTapHint===this.onTapHint&&other.onLongPressHint===this.onLongPressHint;}
  get hashCode():number{return hashValues(this.onTapHint,this.onLongPressHint);}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new StringProperty('onTapHint',this.onTapHint,{defaultValue:null}));properties.add(new StringProperty('onLongPressHint',this.onLongPressHint,{defaultValue:null}));}
}
/** The debug name does not determine identity; reuse a tag instance for const-like identity. */
export class SemanticsTag {
  constructor(readonly name:string){protect(this,['name']);}
  toString():string{return `${objectRuntimeType(this,'SemanticsTag')}(${this.name})`;}
}
export type MoveCursorHandler=(extendSelection:boolean)=>void;
export type SetSelectionHandler=(selection:TextSelection)=>void;
export type SetTextHandler=(text:string)=>void;
/** Immutable source annotations. Collection values retain their source identity. */
export interface SemanticsPropertiesOptions {
  readonly enabled?:boolean|null;
  readonly checked?:boolean|null;
  readonly mixed?:boolean|null;
  readonly expanded?:boolean|null;
  readonly toggled?:boolean|null;
  readonly selected?:boolean|null;
  readonly button?:boolean|null;
  readonly link?:boolean|null;
  readonly header?:boolean|null;
  readonly textField?:boolean|null;
  readonly slider?:boolean|null;
  readonly keyboardKey?:boolean|null;
  readonly readOnly?:boolean|null;
  readonly focusable?:boolean|null;
  readonly focused?:boolean|null;
  readonly accessibilityFocusBlockType?:AccessibilityFocusBlockType|null;
  readonly inMutuallyExclusiveGroup?:boolean|null;
  readonly hidden?:boolean|null;
  readonly obscured?:boolean|null;
  readonly multiline?:boolean|null;
  readonly scopesRoute?:boolean|null;
  readonly namesRoute?:boolean|null;
  readonly image?:boolean|null;
  readonly liveRegion?:boolean|null;
  readonly isRequired?:boolean|null;
  readonly maxValueLength?:number|null;
  readonly currentValueLength?:number|null;
  readonly identifier?:string|null;
  readonly traversalParentIdentifier?:unknown|null;
  readonly traversalChildIdentifier?:unknown|null;
  readonly label?:string|null;
  readonly attributedLabel?:AttributedString|null;
  readonly value?:string|null;
  readonly attributedValue?:AttributedString|null;
  readonly increasedValue?:string|null;
  readonly attributedIncreasedValue?:AttributedString|null;
  readonly decreasedValue?:string|null;
  readonly attributedDecreasedValue?:AttributedString|null;
  readonly hint?:string|null;
  readonly attributedHint?:AttributedString|null;
  readonly tooltip?:string|null;
  readonly headingLevel?:number|null;
  readonly hintOverrides?:SemanticsHintOverrides|null;
  readonly textDirection?:'ltr'|'rtl'|null;
  readonly sortKey?:SemanticsSortKey|null;
  readonly tagForChildren?:SemanticsTag|null;
  readonly linkUrl?:string|null;
  readonly onTap?:(()=>void)|null;
  readonly onLongPress?:(()=>void)|null;
  readonly onScrollLeft?:(()=>void)|null;
  readonly onScrollRight?:(()=>void)|null;
  readonly onScrollUp?:(()=>void)|null;
  readonly onScrollDown?:(()=>void)|null;
  readonly onIncrease?:(()=>void)|null;
  readonly onDecrease?:(()=>void)|null;
  readonly onCopy?:(()=>void)|null;
  readonly onCut?:(()=>void)|null;
  readonly onPaste?:(()=>void)|null;
  readonly onMoveCursorForwardByCharacter?:MoveCursorHandler|null;
  readonly onMoveCursorBackwardByCharacter?:MoveCursorHandler|null;
  readonly onMoveCursorForwardByWord?:MoveCursorHandler|null;
  readonly onMoveCursorBackwardByWord?:MoveCursorHandler|null;
  readonly onSetSelection?:SetSelectionHandler|null;
  readonly onSetText?:SetTextHandler|null;
  readonly onDidGainAccessibilityFocus?:(()=>void)|null;
  readonly onDidLoseAccessibilityFocus?:(()=>void)|null;
  readonly onFocus?:(()=>void)|null;
  readonly onDismiss?:(()=>void)|null;
  readonly onExpand?:(()=>void)|null;
  readonly onCollapse?:(()=>void)|null;
  readonly customSemanticsActions?:Map<CustomSemanticsAction,()=>void>|null;
  readonly role?:SemanticsRole|null;
  readonly controlsNodes?:Set<string>|null;
  readonly validationResult?:SemanticsValidationResult;
  readonly hitTestBehavior?:SemanticsHitTestBehavior|null;
  readonly inputType?:SemanticsInputType|null;
  readonly maxValue?:string|null;
  readonly minValue?:string|null;
}
const protectSemanticsProperties=finalFieldProtector(["enabled","checked","mixed","expanded","toggled","selected","button","link","header","textField","slider","keyboardKey","readOnly","focusable","focused","accessibilityFocusBlockType","inMutuallyExclusiveGroup","hidden","obscured","multiline","scopesRoute","namesRoute","image","liveRegion","isRequired","maxValueLength","currentValueLength","identifier","traversalParentIdentifier","traversalChildIdentifier","label","attributedLabel","value","attributedValue","increasedValue","attributedIncreasedValue","decreasedValue","attributedDecreasedValue","hint","attributedHint","tooltip","headingLevel","hintOverrides","textDirection","sortKey","tagForChildren","linkUrl","onTap","onLongPress","onScrollLeft","onScrollRight","onScrollUp","onScrollDown","onIncrease","onDecrease","onCopy","onCut","onPaste","onMoveCursorForwardByCharacter","onMoveCursorBackwardByCharacter","onMoveCursorForwardByWord","onMoveCursorBackwardByWord","onSetSelection","onSetText","onDidGainAccessibilityFocus","onDidLoseAccessibilityFocus","onFocus","onDismiss","onExpand","onCollapse","customSemanticsActions","role","controlsNodes","validationResult","hitTestBehavior","inputType","maxValue","minValue"]);
export class SemanticsProperties extends DiagnosticableTree {
  readonly enabled:boolean|null;
  readonly checked:boolean|null;
  readonly mixed:boolean|null;
  readonly expanded:boolean|null;
  readonly toggled:boolean|null;
  readonly selected:boolean|null;
  readonly button:boolean|null;
  readonly link:boolean|null;
  readonly header:boolean|null;
  readonly textField:boolean|null;
  readonly slider:boolean|null;
  readonly keyboardKey:boolean|null;
  readonly readOnly:boolean|null;
  readonly focusable:boolean|null;
  readonly focused:boolean|null;
  readonly accessibilityFocusBlockType:AccessibilityFocusBlockType|null;
  readonly inMutuallyExclusiveGroup:boolean|null;
  readonly hidden:boolean|null;
  readonly obscured:boolean|null;
  readonly multiline:boolean|null;
  readonly scopesRoute:boolean|null;
  readonly namesRoute:boolean|null;
  readonly image:boolean|null;
  readonly liveRegion:boolean|null;
  readonly isRequired:boolean|null;
  readonly maxValueLength:number|null;
  readonly currentValueLength:number|null;
  readonly identifier:string|null;
  readonly traversalParentIdentifier:unknown|null;
  readonly traversalChildIdentifier:unknown|null;
  readonly label:string|null;
  readonly attributedLabel:AttributedString|null;
  readonly value:string|null;
  readonly attributedValue:AttributedString|null;
  readonly increasedValue:string|null;
  readonly attributedIncreasedValue:AttributedString|null;
  readonly decreasedValue:string|null;
  readonly attributedDecreasedValue:AttributedString|null;
  readonly hint:string|null;
  readonly attributedHint:AttributedString|null;
  readonly tooltip:string|null;
  readonly headingLevel:number|null;
  readonly hintOverrides:SemanticsHintOverrides|null;
  readonly textDirection:'ltr'|'rtl'|null;
  readonly sortKey:SemanticsSortKey|null;
  readonly tagForChildren:SemanticsTag|null;
  readonly linkUrl:string|null;
  readonly onTap:(()=>void)|null;
  readonly onLongPress:(()=>void)|null;
  readonly onScrollLeft:(()=>void)|null;
  readonly onScrollRight:(()=>void)|null;
  readonly onScrollUp:(()=>void)|null;
  readonly onScrollDown:(()=>void)|null;
  readonly onIncrease:(()=>void)|null;
  readonly onDecrease:(()=>void)|null;
  readonly onCopy:(()=>void)|null;
  readonly onCut:(()=>void)|null;
  readonly onPaste:(()=>void)|null;
  readonly onMoveCursorForwardByCharacter:MoveCursorHandler|null;
  readonly onMoveCursorBackwardByCharacter:MoveCursorHandler|null;
  readonly onMoveCursorForwardByWord:MoveCursorHandler|null;
  readonly onMoveCursorBackwardByWord:MoveCursorHandler|null;
  readonly onSetSelection:SetSelectionHandler|null;
  readonly onSetText:SetTextHandler|null;
  readonly onDidGainAccessibilityFocus:(()=>void)|null;
  readonly onDidLoseAccessibilityFocus:(()=>void)|null;
  readonly onFocus:(()=>void)|null;
  readonly onDismiss:(()=>void)|null;
  readonly onExpand:(()=>void)|null;
  readonly onCollapse:(()=>void)|null;
  readonly customSemanticsActions:Map<CustomSemanticsAction,()=>void>|null;
  readonly role:SemanticsRole|null;
  readonly controlsNodes:Set<string>|null;
  readonly validationResult:SemanticsValidationResult;
  readonly hitTestBehavior:SemanticsHitTestBehavior|null;
  readonly inputType:SemanticsInputType|null;
  readonly maxValue:string|null;
  readonly minValue:string|null;
  constructor(options:SemanticsPropertiesOptions={}){super();
    this.enabled=options.enabled??null;
    this.checked=options.checked??null;
    this.mixed=options.mixed??null;
    this.expanded=options.expanded??null;
    this.toggled=options.toggled??null;
    this.selected=options.selected??null;
    this.button=options.button??null;
    this.link=options.link??null;
    this.header=options.header??null;
    this.textField=options.textField??null;
    this.slider=options.slider??null;
    this.keyboardKey=options.keyboardKey??null;
    this.readOnly=options.readOnly??null;
    this.focusable=options.focusable??null;
    this.focused=options.focused??null;
    this.accessibilityFocusBlockType=options.accessibilityFocusBlockType??null;
    this.inMutuallyExclusiveGroup=options.inMutuallyExclusiveGroup??null;
    this.hidden=options.hidden??null;
    this.obscured=options.obscured??null;
    this.multiline=options.multiline??null;
    this.scopesRoute=options.scopesRoute??null;
    this.namesRoute=options.namesRoute??null;
    this.image=options.image??null;
    this.liveRegion=options.liveRegion??null;
    this.isRequired=options.isRequired??null;
    this.maxValueLength=options.maxValueLength??null;
    this.currentValueLength=options.currentValueLength??null;
    this.identifier=options.identifier??null;
    this.traversalParentIdentifier=options.traversalParentIdentifier??null;
    this.traversalChildIdentifier=options.traversalChildIdentifier??null;
    this.label=options.label??null;
    this.attributedLabel=options.attributedLabel??null;
    this.value=options.value??null;
    this.attributedValue=options.attributedValue??null;
    this.increasedValue=options.increasedValue??null;
    this.attributedIncreasedValue=options.attributedIncreasedValue??null;
    this.decreasedValue=options.decreasedValue??null;
    this.attributedDecreasedValue=options.attributedDecreasedValue??null;
    this.hint=options.hint??null;
    this.attributedHint=options.attributedHint??null;
    this.tooltip=options.tooltip??null;
    this.headingLevel=options.headingLevel??null;
    this.hintOverrides=options.hintOverrides??null;
    this.textDirection=options.textDirection??null;
    this.sortKey=options.sortKey??null;
    this.tagForChildren=options.tagForChildren??null;
    this.linkUrl=options.linkUrl??null;
    this.onTap=options.onTap??null;
    this.onLongPress=options.onLongPress??null;
    this.onScrollLeft=options.onScrollLeft??null;
    this.onScrollRight=options.onScrollRight??null;
    this.onScrollUp=options.onScrollUp??null;
    this.onScrollDown=options.onScrollDown??null;
    this.onIncrease=options.onIncrease??null;
    this.onDecrease=options.onDecrease??null;
    this.onCopy=options.onCopy??null;
    this.onCut=options.onCut??null;
    this.onPaste=options.onPaste??null;
    this.onMoveCursorForwardByCharacter=options.onMoveCursorForwardByCharacter??null;
    this.onMoveCursorBackwardByCharacter=options.onMoveCursorBackwardByCharacter??null;
    this.onMoveCursorForwardByWord=options.onMoveCursorForwardByWord??null;
    this.onMoveCursorBackwardByWord=options.onMoveCursorBackwardByWord??null;
    this.onSetSelection=options.onSetSelection??null;
    this.onSetText=options.onSetText??null;
    this.onDidGainAccessibilityFocus=options.onDidGainAccessibilityFocus??null;
    this.onDidLoseAccessibilityFocus=options.onDidLoseAccessibilityFocus??null;
    this.onFocus=options.onFocus??null;
    this.onDismiss=options.onDismiss??null;
    this.onExpand=options.onExpand??null;
    this.onCollapse=options.onCollapse??null;
    this.customSemanticsActions=options.customSemanticsActions??null;
    this.role=options.role??null;
    this.controlsNodes=options.controlsNodes??null;
    this.validationResult=options.validationResult??SemanticsValidationResult.none;
    this.hitTestBehavior=options.hitTestBehavior??null;
    this.inputType=options.inputType??null;
    this.maxValue=options.maxValue??null;
    this.minValue=options.minValue??null;
    if(FoundationBuildMode.debug){
      for(const name of ['label','value','increasedValue','decreasedValue','hint'] as const){const attributed=('attributed'+name[0]!.toUpperCase()+name.slice(1)) as 'attributedLabel'|'attributedValue'|'attributedIncreasedValue'|'attributedDecreasedValue'|'attributedHint';invariant(this[name]===null||this[attributed]===null,'conflicting-semantics-text','Only one of '+name+' or '+attributed+' should be provided');}
      invariant(this.headingLevel===null||(this.headingLevel>0&&this.headingLevel<=6),'invalid-semantics-heading','Heading level must be between 1 and 6');
      invariant(this.linkUrl===null||(this.link??false),'invalid-semantics-link','If linkUrl is set then link must be true');
    }
    // Base value construction is complete. Shallow freezing keeps collection
    // aliasing while avoiding a descriptor conversion for every final field.
    // Derived values remain extensible until their own constructor has run.
    if(new.target===SemanticsProperties)Object.freeze(this);else protectSemanticsProperties(this);
  }
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);
    for(const name of ['checked','mixed','expanded','selected','isRequired'] as const)properties.add(new DiagnosticsProperty(name,this[name],{defaultValue:null}));
    properties.add(new StringProperty('identifier',this.identifier,{defaultValue:null}));
    for(const name of ['traversalParentIdentifier','traversalChildIdentifier'] as const)properties.add(new DiagnosticsProperty(name,this[name],{defaultValue:null}));
    properties.add(new StringProperty('label',this.label,{defaultValue:null}));properties.add(new AttributedStringProperty('attributedLabel',this.attributedLabel,{defaultValue:null}));
    properties.add(new StringProperty('value',this.value,{defaultValue:null}));properties.add(new AttributedStringProperty('attributedValue',this.attributedValue,{defaultValue:null}));
    // The pinned diagnostics use value for these two plain-text entries.
    properties.add(new StringProperty('increasedValue',this.value,{defaultValue:null}));properties.add(new AttributedStringProperty('attributedIncreasedValue',this.attributedIncreasedValue,{defaultValue:null}));
    properties.add(new StringProperty('decreasedValue',this.value,{defaultValue:null}));properties.add(new AttributedStringProperty('attributedDecreasedValue',this.attributedDecreasedValue,{defaultValue:null}));
    properties.add(new StringProperty('hint',this.hint,{defaultValue:null}));properties.add(new AttributedStringProperty('attributedHint',this.attributedHint,{defaultValue:null}));properties.add(new StringProperty('tooltip',this.tooltip,{defaultValue:null}));
    properties.add(new EnumProperty('textDirection',this.textDirection,{defaultValue:null}));properties.add(new EnumProperty('role',this.role,{defaultValue:null}));properties.add(new EnumProperty('validationResult',this.validationResult,{defaultValue:SemanticsValidationResult.none}));
    properties.add(new DiagnosticsProperty('sortKey',this.sortKey,{defaultValue:null}));properties.add(new DiagnosticsProperty('hintOverrides',this.hintOverrides,{defaultValue:null}));
  }
  override toStringShort():string{return objectRuntimeType(this,'SemanticsProperties');}
}

const textNavigationSnapshots=new WeakMap<SemanticsTextNavigation,{readonly text:string;readonly value:SemanticsTextNavigation}>();
function freezeTextNavigation(node:TransportSemanticsNode):SemanticsTextNavigation|undefined {
  const navigation=node.textNavigation;if(!navigation)return undefined;
  invariant(node.role==='text-field'&&!node.obscured&&typeof node.value==='string'&&node.value.length<=4096,'invalid-semantics-text-navigation','Text navigation requires an unobscured Core editing value');
  const text=node.value,cached=textNavigationSnapshots.get(navigation);if(cached?.text===text)return cached.value;
  const copy=(stops:readonly number[])=>{invariant(Array.isArray(stops)&&stops.length>0&&stops.length<=4097&&stops[0]===0&&stops.at(-1)===text.length,'invalid-semantics-text-navigation','Text unit stops must cover the complete UTF-16 document');let previous=-1;for(const at of stops){textOffset(text,at);invariant(at>previous,'invalid-semantics-text-navigation','Text unit stops must be strictly ordered');previous=at;}return Object.freeze([...stops]);};
  const value=Object.freeze({characters:copy(navigation.characters),...(navigation.words?{words:copy(navigation.words)}:{}),...(navigation.lines?{lines:copy(navigation.lines)}:{})});
  // Only cache immutable callers. Mutable public inputs are copied afresh.
  if(Object.isFrozen(navigation)&&[navigation.characters,navigation.words,navigation.lines].every(stops=>!stops||Object.isFrozen(stops)))textNavigationSnapshots.set(navigation,{text,value});
  textNavigationSnapshots.set(value,{text,value});return value;
}
// Only arrays produced by this validator are trusted. Object.freeze on public
// input alone neither validates its tree nor freezes its nested values.
const frozenSemanticsTrees=new WeakSet<readonly TransportSemanticsNode[]>();
/** Bounded, unique tree snapshot used by platform bridges. Functions remain in the JS owner. */
export function freezeSemantics(nodes:readonly TransportSemanticsNode[]):readonly TransportSemanticsNode[]{
  if(frozenSemanticsTrees.has(nodes))return nodes;
  const ids=new Set<string>(),sourceIds=new Set<number>(),ancestors=new Set<TransportSemanticsNode>();let count=0;
  const visit=(node:TransportSemanticsNode,depth:number):TransportSemanticsNode=>{
    invariant(++count<=2048&&depth<=64&&!ancestors.has(node),'semantics-budget','Semantics tree exceeds count/depth budget or contains a cycle');
    invariant(!!node.id&&!ids.has(node.id)&&['button','text-field','text','image','group','list'].includes(node.role),'invalid-semantics','Semantics id/role must be valid and globally unique within a View');ids.add(node.id);
    invariant(typeof node.name==='string'&&typeof node.enabled==='boolean'&&(!node.activate||typeof node.activate==='function')&&Object.entries(node.actions??{}).every(([key,value])=>['activate','focus','scroll-forward','scroll-backward','increase','decrease','long-press','scroll-left','scroll-right','scroll-up','scroll-down'].includes(key)&&typeof value==='function'),'invalid-semantics-action','Invalid semantics label/state/action');
    if(node.textActions)invariant(node.role==='text-field'&&Object.entries(node.textActions).every(([key,value])=>['setText','setSelection','scrollRange'].includes(key)&&typeof value==='function'),'invalid-semantics-text-action','Typed text actions belong to text fields');
    invariant(node.textInputRevision===undefined||node.role==='text-field'&&Number.isSafeInteger(node.textInputRevision)&&node.textInputRevision>=0,'invalid-semantics-text-revision','Text revisions belong to their Core editor');
    invariant(node.textRevision===undefined||node.role==='text-field'&&Number.isSafeInteger(node.textRevision)&&node.textRevision>=0,'invalid-semantics-text-revision','Text content revisions belong to their Core editor');
    invariant(node.textInputGeneration===undefined||node.role==='text-field'&&Number.isSafeInteger(node.textInputGeneration)&&node.textInputGeneration>0,'invalid-semantics-text-generation','Text generations identify their live Core editing owner');
    const textNavigation=freezeTextNavigation(node);
    invariant(node.focusable===undefined||typeof node.focusable==='boolean','invalid-semantics-focus','Semantics focusable must be boolean');
    invariant(node.sourceRole===undefined||Object.values(SemanticsRole).includes(node.sourceRole),'invalid-semantics-source-role','Unknown source semantics role');
    invariant((node.minValue===undefined||typeof node.minValue==='string')&&(node.maxValue===undefined||typeof node.maxValue==='string'),'invalid-semantics-range','Semantics ranges must retain source strings');
    invariant(node.textDirection===undefined||node.textDirection==='ltr'||node.textDirection==='rtl','invalid-semantics-direction','Semantics direction must be ltr or rtl');
    invariant(node.isSlider===undefined||typeof node.isSlider==='boolean','invalid-semantics-slider','Slider flag must be boolean');
    if(node.numericRange){const {min,max,value,smallChange,largeChange}=node.numericRange;invariant([min,max,value].every(Number.isFinite)&&min<=max&&value>=min&&value<=max&&[smallChange,largeChange].every(step=>step===undefined||Number.isFinite(step)&&step>=0),'invalid-semantics-numeric-range','Embedding numeric range and optional changes must be finite and ordered');}
    if(node.rangeActions)invariant(!!node.numericRange&&typeof node.rangeActions.setValue==='function'&&Object.keys(node.rangeActions).length===1,'invalid-semantics-range-action','Absolute range actions require a numeric range');
    if(node.sourceNodeId!==undefined){invariant(Number.isSafeInteger(node.sourceNodeId)&&node.sourceNodeId>=0&&!sourceIds.has(node.sourceNodeId),'invalid-semantics-source-id','Source node ids must be unique nonnegative safe integers');sourceIds.add(node.sourceNodeId);}
    invariant(node.isLink===undefined||typeof node.isLink==='boolean','invalid-semantics-link','Semantics link state must be boolean');
    invariant(node.semanticsIdentifier===undefined||typeof node.semanticsIdentifier==='string','invalid-semantics-identifier','Semantics identifier must be a string');
    invariant(node.tooltip===undefined||typeof node.tooltip==='string','invalid-semantics-tooltip','Semantics tooltip must be a string');
    if(node.nameAttributes)for(const attribute of node.nameAttributes)invariant(attribute instanceof StringAttribute&&attribute.range.isValid&&attribute.range.isNormalized&&attribute.range.end<=node.name.length,'invalid-semantics-attribute','Semantics attributes must describe ranges inside their label');
    if(node.tags)invariant(node.tags.every(tag=>tag instanceof SemanticsTag),'invalid-semantics-tag','Semantics tags must use framework tag identities');
    invariant(node.indexInParent===undefined||Number.isSafeInteger(node.indexInParent)&&node.indexInParent>=0,'invalid-semantics-index','Semantics index must be a nonnegative safe integer');
    const {x,y,width,height}=node.bounds,bounds=Object.freeze({x,y,width,height});
    invariant([x,y,width,height].every(Number.isFinite)&&width>=0&&height>=0,'invalid-semantics-bounds','Semantics bounds must be finite');
    let editorGeometry:TransportSemanticsNode['editorGeometry'];
    if(node.editorGeometry){const {scaleX,scaleY,bounds:full}=node.editorGeometry;invariant(node.role==='text-field'&&Number.isFinite(scaleX)&&scaleX>0&&Number.isFinite(scaleY)&&scaleY>0&&[full.x,full.y,full.width,full.height].every(Number.isFinite)&&full.width>=0&&full.height>=0,'invalid-editor-geometry','Editor geometry requires finite full bounds and positive axis scales');editorGeometry=Object.freeze({scaleX,scaleY,bounds:Object.freeze({...full})});}
    invariant(node.editorStyle===undefined||node.role==='text-field','invalid-editor-style','Only text fields carry editor styling');
    const editorStyle=node.editorStyle?freezeEditorStyle(node.editorStyle):undefined;
    invariant(node.textInputGeometry===undefined||node.role==='text-field','invalid-text-input-geometry','Only text fields carry Core input geometry');
    const textInputGeometry=node.textInputGeometry?freezeTextInputGeometry(node.textInputGeometry):undefined;
    let textParagraph:TransportSemanticsNode['textParagraph'];
    if(node.textParagraph){
      const {resource,reference,paintOffset}=node.textParagraph;
      invariant(node.role==='text-field'&&!node.obscured&&textInputGeometry!==undefined,'invalid-semantics-paragraph','A native paragraph reference requires current unobscured Core text geometry');
      invariant(typeof resource.id==='string'&&resource.id.length>0&&resource.id.length<=1024&&Number.isSafeInteger(resource.generation)&&resource.generation>=0&&reference.protocol==='native-paragraph-v1'&&Number.isSafeInteger(reference.token)&&reference.token>0&&[paintOffset.x,paintOffset.y].every(Number.isFinite),'invalid-semantics-paragraph','Invalid Core paragraph resource, query ticket or paint origin');
      textParagraph=Object.freeze({resource:Object.freeze({...resource}),reference:Object.freeze({...reference}),paintOffset:Object.freeze({...paintOffset})});
    }
    if(node.textSelection)invariant(node.role==='text-field'&&[node.textSelection.anchor,node.textSelection.focus].every(offset=>Number.isSafeInteger(offset)&&offset>=0&&offset<=(node.value?.length??0)),'invalid-text-selection','Text field semantics selection must index its Core value');
    for(const flag of [node.readOnly,node.obscured,node.multiline])invariant(flag===undefined||node.role==='text-field'&&typeof flag==='boolean','invalid-text-field-semantics','Editing semantics flags belong to text fields');
    ancestors.add(node);const children=node.children?.map(child=>visit(child,depth+1));ancestors.delete(node);
    return Object.freeze({...node,bounds,...(textNavigation?{textNavigation}:{}),...(textParagraph?{textParagraph}:{}),...(node.textActions?{textActions:Object.freeze({...node.textActions})}:{}),...(node.rangeActions?{rangeActions:Object.freeze({...node.rangeActions})}:{}),...(node.textSelection?{textSelection:Object.freeze({...node.textSelection})}:{}),...(textInputGeometry?{textInputGeometry}:{}),...(node.numericRange?{numericRange:Object.freeze({...node.numericRange})}:{}),...(editorGeometry?{editorGeometry}:{}),...(editorStyle?{editorStyle}:{}),...(node.tags?{tags:Object.freeze([...node.tags])}:{}),...(node.nameAttributes?{nameAttributes:Object.freeze([...node.nameAttributes])}:{}),...(node.actions?{actions:Object.freeze({...node.actions})}:{}),...(children?{children:Object.freeze(children)}:{})});
  };
  const snapshot=Object.freeze(nodes.map(node=>visit(node,0)));frozenSemanticsTrees.add(snapshot);return snapshot;
}
export function flattenSemantics(nodes:readonly TransportSemanticsNode[]):readonly TransportSemanticsNode[]{const output:TransportSemanticsNode[]=[];const visit=(node:TransportSemanticsNode)=>{output.push(node);node.children?.forEach(visit);};nodes.forEach(visit);return output;}

export type SemanticsActionHandler=(args:unknown)=>void;
export type ChildSemanticsConfigurationsDelegate=(children:readonly SemanticsConfiguration[])=>ChildSemanticsConfigurationsResult;
export class ChildSemanticsConfigurationsResult {
  /** @internal Use ChildSemanticsConfigurationsResultBuilder. Lists retain source aliasing. */
  constructor(readonly mergeUp:SemanticsConfiguration[],readonly siblingMergeGroups:SemanticsConfiguration[][]){protect(this,['mergeUp','siblingMergeGroups']);}
}
export class ChildSemanticsConfigurationsResultBuilder {
  private readonly mergeUp:SemanticsConfiguration[]=[];
  private readonly siblingMergeGroups:SemanticsConfiguration[][]=[];
  markAsMergeUp(config:SemanticsConfiguration):void{this.mergeUp.push(config);}
  markAsSiblingMergeGroup(configs:SemanticsConfiguration[]):void{this.siblingMergeGroups.push(configs);}
  build():ChildSemanticsConfigurationsResult{if(FoundationBuildMode.debug){const seen=new Set<SemanticsConfiguration>();for(const config of [...this.mergeUp,...this.siblingMergeGroups.flat()]){invariant(!seen.has(config),'duplicate-semantics-configuration','Duplicated SemanticsConfigurations');seen.add(config);}}return new ChildSemanticsConfigurationsResult(this.mergeUp,this.siblingMergeGroups);}
}
const unblockedActions=SemanticsAction.didGainAccessibilityFocus.index|SemanticsAction.didLoseAccessibilityFocus.index;
function tristate(value:boolean|null):Tristate{return value===null?Tristate.none:value?Tristate.isTrue:Tristate.isFalse;}
function concat(a:AttributedString,b:AttributedString,direction:'ltr'|'rtl'|null,otherDirection:'ltr'|'rtl'|null):AttributedString{if(b.string==='')return a;if(direction!==otherDirection&&otherDirection!==null)b=new AttributedString(otherDirection==='rtl'?'\u202b':'\u202a').add(b).add(new AttributedString('\u202c'));return a.string===''?b:a.add(new AttributedString('\n')).add(b);}
/** Original callbacks are separate from adapted action handlers. A lazy, fixed
 * shape keeps frequently copied annotations small; explicit JS values, including
 * undefined, remain distinct from unassigned callbacks. */
class SemanticsConfigurationCallbacks {
  onTap:(()=>void)|null=null;
  onLongPress:(()=>void)|null=null;
  onScrollLeft:(()=>void)|null=null;
  onDismiss:(()=>void)|null=null;
  onScrollRight:(()=>void)|null=null;
  onScrollUp:(()=>void)|null=null;
  onScrollDown:(()=>void)|null=null;
  onIncrease:(()=>void)|null=null;
  onDecrease:(()=>void)|null=null;
  onCopy:(()=>void)|null=null;
  onCut:(()=>void)|null=null;
  onPaste:(()=>void)|null=null;
  onShowOnScreen:((range?:SemanticsTextRange)=>void)|null=null;
  onDidGainAccessibilityFocus:(()=>void)|null=null;
  onDidLoseAccessibilityFocus:(()=>void)|null=null;
  onFocus:(()=>void)|null=null;
  onExpand:(()=>void)|null=null;
  onCollapse:(()=>void)|null=null;
  onScrollToOffset:((value:Offset)=>void)|null=null;
  onMoveCursorForwardByCharacter:((value:boolean)=>void)|null=null;
  onMoveCursorForwardByWord:((value:boolean)=>void)|null=null;
  onMoveCursorBackwardByCharacter:((value:boolean)=>void)|null=null;
  onMoveCursorBackwardByWord:((value:boolean)=>void)|null=null;
  onSetSelection:((value:TextSelection)=>void)|null=null;
  onSetText:((value:string)=>void)|null=null;
}
// These five private defaults are immutable values, including their empty
// attribute array. Copy/merge replaces a field instead of mutating the value.
const emptyConfigurationText=new AttributedString('');
// Most render fragments carry no actions. Keep one small owned table so an
// empty configuration does not eagerly allocate two Maps. Its mutable slots
// also retain Map mutation semantics after the configuration itself is frozen.
class SemanticsConfigurationActionTables {
  actions:Map<SemanticsAction,SemanticsActionHandler>|undefined;
  custom:Map<CustomSemanticsAction,()=>void>|undefined;
}
/** Source annotations and merge rules. linkUrl uses the existing host URI string representation. */
export class SemanticsConfiguration {
  private _callbacks:SemanticsConfigurationCallbacks|null=null;
  locale:Locale|null=null;
  isBlockingUserActions=false;
  explicitChildNodes=false;
  isBlockingSemanticsOfPreviouslyPaintedNodes=false;
  private readonly _actionTables=new SemanticsConfigurationActionTables();
  private get _actions():Map<SemanticsAction,SemanticsActionHandler>{return this._actionTables.actions??=new Map();}
  private get _customSemanticsActions():Map<CustomSemanticsAction,()=>void>{return this._actionTables.custom??=new Map();}
  private set _customSemanticsActions(value:Map<CustomSemanticsAction,()=>void>){this._actionTables.custom=value;}
  private _tagsForChildren:SemanticsTag[]|null=null;
  private _actionsAsBits=0;
  private get _effectiveActionsAsBits():number{return this.isBlockingUserActions?this._actionsAsBits&unblockedActions:this._actionsAsBits;}
  private _addAction(action:SemanticsAction,handler:SemanticsActionHandler):void{this._actions.set(action,handler);this._actionsAsBits|=action.index;this._hasBeenAnnotated=true;}
  private _addArgumentlessAction(action:SemanticsAction,handler:(()=>void)|null):void{invariant(handler!==null,'null-semantics-handler','Semantics action handler cannot be null');this._addAction(action,args=>{if(FoundationBuildMode.debug)invariant(args==null,'unexpected-semantics-arguments','This action takes no arguments');handler();});}
  getActionHandler(action:SemanticsAction):SemanticsActionHandler|null{return this._actionTables.actions?.get(action)??null;}
  private _isSemanticBoundary:boolean=false;
  private _localeForSubtree:Locale|null=null;
  private _hasBeenAnnotated:boolean=false;
  private _childConfigurationsDelegate:ChildSemanticsConfigurationsDelegate|null=null;
  private _sortKey:SemanticsSortKey|null=null;
  private _indexInParent:number|null=null;
  private _scrollChildCount:number|null=null;
  private _scrollIndex:number|null=null;
  private _platformViewId:number|null=null;
  private _maxValueLength:number|null=null;
  private _currentValueLength:number|null=null;
  private _isMergingSemanticsOfDescendants:boolean=false;
  private _identifier:string='';
  private _traversalParentIdentifier:unknown|null=null;
  private _traversalChildIdentifier:unknown|null=null;
  private _role:SemanticsRole=SemanticsRole.none;
  private _attributedLabel:AttributedString=emptyConfigurationText;
  private _attributedValue:AttributedString=emptyConfigurationText;
  private _attributedIncreasedValue:AttributedString=emptyConfigurationText;
  private _attributedDecreasedValue:AttributedString=emptyConfigurationText;
  private _attributedHint:AttributedString=emptyConfigurationText;
  private _tooltip:string='';
  private _hintOverrides:SemanticsHintOverrides|null=null;
  private _textDirection:'ltr'|'rtl'|null=null;
  private _accessibilityFocusBlockType:AccessibilityFocusBlockType=AccessibilityFocusBlockType.none;
  private _linkUrl:string|null=null;
  private _headingLevel:number=0;
  private _textSelection:TextSelection|null=null;
  private _scrollPosition:number|null=null;
  private _scrollExtentMax:number|null=null;
  private _scrollExtentMin:number|null=null;
  private _controlsNodes:Set<string>|null=null;
  private _validationResult:SemanticsValidationResult=SemanticsValidationResult.none;
  private _hitTestBehavior:SemanticsHitTestBehavior=SemanticsHitTestBehavior.defer;
  private _inputType:SemanticsInputType=SemanticsInputType.none;
  private _maxValue:string|null=null;
  private _minValue:string|null=null;
  private _flags:SemanticsFlags=SemanticsFlags.none;
  get isSemanticBoundary():boolean{return this._isSemanticBoundary;}
  get localeForSubtree():Locale|null{return this._localeForSubtree;}
  get hasBeenAnnotated():boolean{return this._hasBeenAnnotated;}
  get childConfigurationsDelegate():ChildSemanticsConfigurationsDelegate|null{return this._childConfigurationsDelegate;}
  get sortKey():SemanticsSortKey|null{return this._sortKey;}
  get indexInParent():number|null{return this._indexInParent;}
  get scrollChildCount():number|null{return this._scrollChildCount;}
  get scrollIndex():number|null{return this._scrollIndex;}
  get platformViewId():number|null{return this._platformViewId;}
  get maxValueLength():number|null{return this._maxValueLength;}
  get currentValueLength():number|null{return this._currentValueLength;}
  get isMergingSemanticsOfDescendants():boolean{return this._isMergingSemanticsOfDescendants;}
  get identifier():string{return this._identifier;}
  get traversalParentIdentifier():unknown|null{return this._traversalParentIdentifier;}
  get traversalChildIdentifier():unknown|null{return this._traversalChildIdentifier;}
  get role():SemanticsRole{return this._role;}
  get label():string{return this._attributedLabel.string;}
  get attributedLabel():AttributedString{return this._attributedLabel;}
  get value():string{return this._attributedValue.string;}
  get attributedValue():AttributedString{return this._attributedValue;}
  get increasedValue():string{return this._attributedIncreasedValue.string;}
  get attributedIncreasedValue():AttributedString{return this._attributedIncreasedValue;}
  get decreasedValue():string{return this._attributedDecreasedValue.string;}
  get attributedDecreasedValue():AttributedString{return this._attributedDecreasedValue;}
  get hint():string{return this._attributedHint.string;}
  get attributedHint():AttributedString{return this._attributedHint;}
  get tooltip():string{return this._tooltip;}
  get hintOverrides():SemanticsHintOverrides|null{return this._hintOverrides;}
  get scopesRoute():boolean{return this._flags.scopesRoute;}
  get namesRoute():boolean{return this._flags.namesRoute;}
  get isImage():boolean{return this._flags.isImage;}
  get liveRegion():boolean{return this._flags.isLiveRegion;}
  get textDirection():'ltr'|'rtl'|null{return this._textDirection;}
  get isSelected():boolean{return this._flags.isSelected == Tristate.isTrue;}
  get isExpanded():boolean|null{return this._flags.isExpanded.toBoolOrNull();}
  get isEnabled():boolean|null{return this._flags.isEnabled.toBoolOrNull();}
  get isChecked():boolean|null{return this._flags.isChecked == CheckedState.none ? null : this._flags.isChecked == CheckedState.isTrue;}
  get isCheckStateMixed():boolean|null{return this._flags.isChecked == CheckedState.none ? null : this._flags.isChecked == CheckedState.mixed;}
  get isToggled():boolean|null{return this._flags.isToggled.toBoolOrNull();}
  get isInMutuallyExclusiveGroup():boolean{return this._flags.isInMutuallyExclusiveGroup;}
  get isFocusable():boolean{return this._flags.isFocused != Tristate.none;}
  get isFocused():boolean|null{return this._flags.isFocused.toBoolOrNull();}
  get accessibilityFocusBlockType():AccessibilityFocusBlockType{return this._accessibilityFocusBlockType;}
  get isButton():boolean{return this._flags.isButton;}
  get isLink():boolean{return this._flags.isLink;}
  get linkUrl():string|null{return this._linkUrl;}
  get isHeader():boolean{return this._flags.isHeader;}
  get headingLevel():number{return this._headingLevel;}
  get isSlider():boolean{return this._flags.isSlider;}
  get isKeyboardKey():boolean{return this._flags.isKeyboardKey;}
  get isHidden():boolean{return this._flags.isHidden;}
  get isTextField():boolean{return this._flags.isTextField;}
  get isReadOnly():boolean{return this._flags.isReadOnly;}
  get isObscured():boolean{return this._flags.isObscured;}
  get isMultiline():boolean{return this._flags.isMultiline;}
  get isRequired():boolean|null{return this._flags.isRequired.toBoolOrNull();}
  get hasImplicitScrolling():boolean{return this._flags.hasImplicitScrolling;}
  get textSelection():TextSelection|null{return this._textSelection;}
  get scrollPosition():number|null{return this._scrollPosition;}
  get scrollExtentMax():number|null{return this._scrollExtentMax;}
  get scrollExtentMin():number|null{return this._scrollExtentMin;}
  get controlsNodes():Set<string>|null{return this._controlsNodes;}
  get validationResult():SemanticsValidationResult{return this._validationResult;}
  get hitTestBehavior():SemanticsHitTestBehavior{return this._hitTestBehavior;}
  get inputType():SemanticsInputType{return this._inputType;}
  get maxValue():string|null{return this._maxValue;}
  get minValue():string|null{return this._minValue;}
  set isSemanticBoundary(value:boolean){if(FoundationBuildMode.debug)invariant(!this.isMergingSemanticsOfDescendants || value,'invalid-semantics-configuration','Invalid this.isSemanticBoundary');
    this._isSemanticBoundary = value;}
  set localeForSubtree(value:Locale|null){if(FoundationBuildMode.debug)invariant(value !== null,'invalid-semantics-configuration','Invalid this.localeForSubtree');
    this._localeForSubtree = value;
    this._hasBeenAnnotated = true;}
  set childConfigurationsDelegate(value:ChildSemanticsConfigurationsDelegate|null){if(FoundationBuildMode.debug)invariant(value !== null,'invalid-semantics-configuration','Invalid this.childConfigurationsDelegate');
    this._childConfigurationsDelegate = value;}
  set sortKey(value:SemanticsSortKey|null){if(FoundationBuildMode.debug)invariant(value !== null,'invalid-semantics-configuration','Invalid this.sortKey');
    this._sortKey = value;
    this._hasBeenAnnotated = true;}
  set indexInParent(value:number|null){this._indexInParent = value;
    this._hasBeenAnnotated = true;}
  set scrollChildCount(value:number|null){if (valueEquals(value,this.scrollChildCount)) {
      return;
    }
    this._scrollChildCount = value;
    this._hasBeenAnnotated = true;}
  set scrollIndex(value:number|null){if (valueEquals(value,this.scrollIndex)) {
      return;
    }
    this._scrollIndex = value;
    this._hasBeenAnnotated = true;}
  set platformViewId(value:number|null){if (valueEquals(value,this.platformViewId)) {
      return;
    }
    this._platformViewId = value;
    this._hasBeenAnnotated = true;}
  set maxValueLength(value:number|null){if (valueEquals(value,this.maxValueLength)) {
      return;
    }
    this._maxValueLength = value;
    this._hasBeenAnnotated = true;}
  set currentValueLength(value:number|null){if (valueEquals(value,this.currentValueLength)) {
      return;
    }
    this._currentValueLength = value;
    this._hasBeenAnnotated = true;}
  set isMergingSemanticsOfDescendants(value:boolean){if(FoundationBuildMode.debug)invariant(this.isSemanticBoundary,'invalid-semantics-configuration','Invalid this.isMergingSemanticsOfDescendants');
    this._isMergingSemanticsOfDescendants = value;
    this._hasBeenAnnotated = true;}
  set identifier(identifier:string){this._identifier = identifier;
    this._hasBeenAnnotated = true;}
  set traversalParentIdentifier(value:unknown|null){if (valueEquals(value,this.traversalParentIdentifier)) {
      return;
    }
    this._traversalParentIdentifier = value;
    this._hasBeenAnnotated = true;}
  set traversalChildIdentifier(value:unknown|null){if (valueEquals(value,this.traversalChildIdentifier)) {
      return;
    }
    this._traversalChildIdentifier = value;
    this._hasBeenAnnotated = true;}
  set role(value:SemanticsRole){this._role = value;
    this._hasBeenAnnotated = true;}
  set label(label:string){this._attributedLabel = new AttributedString(label);
    this._hasBeenAnnotated = true;}
  set attributedLabel(attributedLabel:AttributedString){this._attributedLabel = attributedLabel;
    this._hasBeenAnnotated = true;}
  set value(value:string){this._attributedValue = new AttributedString(value);
    this._hasBeenAnnotated = true;}
  set attributedValue(attributedValue:AttributedString){this._attributedValue = attributedValue;
    this._hasBeenAnnotated = true;}
  set increasedValue(increasedValue:string){this._attributedIncreasedValue = new AttributedString(increasedValue);
    this._hasBeenAnnotated = true;}
  set attributedIncreasedValue(attributedIncreasedValue:AttributedString){this._attributedIncreasedValue = attributedIncreasedValue;
    this._hasBeenAnnotated = true;}
  set decreasedValue(decreasedValue:string){this._attributedDecreasedValue = new AttributedString(decreasedValue);
    this._hasBeenAnnotated = true;}
  set attributedDecreasedValue(attributedDecreasedValue:AttributedString){this._attributedDecreasedValue = attributedDecreasedValue;
    this._hasBeenAnnotated = true;}
  set hint(hint:string){this._attributedHint = new AttributedString(hint);
    this._hasBeenAnnotated = true;}
  set attributedHint(attributedHint:AttributedString){this._attributedHint = attributedHint;
    this._hasBeenAnnotated = true;}
  set tooltip(tooltip:string){this._tooltip = tooltip;
    this._hasBeenAnnotated = true;}
  set hintOverrides(value:SemanticsHintOverrides|null){if (value == null) {
      return;
    }
    this._hintOverrides = value;
    this._hasBeenAnnotated = true;}
  set scopesRoute(value:boolean){this._flags = this._flags.copyWith({scopesRoute: value});
    this._hasBeenAnnotated = true;}
  set namesRoute(value:boolean){this._flags = this._flags.copyWith({namesRoute: value});
    this._hasBeenAnnotated = true;}
  set isImage(value:boolean){this._flags = this._flags.copyWith({isImage: value});
    this._hasBeenAnnotated = true;}
  set liveRegion(value:boolean){this._flags = this._flags.copyWith({isLiveRegion: value});
    this._hasBeenAnnotated = true;}
  set textDirection(textDirection:'ltr'|'rtl'|null){this._textDirection = textDirection;
    this._hasBeenAnnotated = true;}
  set isSelected(value:boolean){this._flags = this._flags.copyWith({isSelected: tristate(value)});
    this._hasBeenAnnotated = true;}
  set isExpanded(value:boolean|null){this._flags = this._flags.copyWith({isExpanded: tristate(value)});
    this._hasBeenAnnotated = true;}
  set isEnabled(value:boolean|null){this._flags = this._flags.copyWith({isEnabled: tristate(value)});
    this._hasBeenAnnotated = true;}
  set isChecked(value:boolean|null){if (value !== null) {
      this._flags = this._flags.copyWith({isChecked: value ? CheckedState.isTrue : CheckedState.isFalse});
    }
    this._hasBeenAnnotated = true;}
  set isCheckStateMixed(value:boolean|null){if (value ?? false) {
      this._flags = this._flags.copyWith({isChecked: CheckedState.mixed});
    }
    this._hasBeenAnnotated = true;}
  set isToggled(value:boolean|null){this._flags = this._flags.copyWith({isToggled: tristate(value)});
    this._hasBeenAnnotated = true;}
  set isInMutuallyExclusiveGroup(value:boolean){this._flags = this._flags.copyWith({isInMutuallyExclusiveGroup: value});
    this._hasBeenAnnotated = true;}
  set isFocusable(value:boolean){if (!value) {
      this._flags = this._flags.copyWith({isFocused: Tristate.none});
    } else {
      if (this._flags.isFocused == Tristate.none) {
        this._flags = this._flags.copyWith({isFocused: Tristate.isFalse});
      }
    }
    this._hasBeenAnnotated = true;}
  set isFocused(value:boolean|null){this._flags = this._flags.copyWith({isFocused: tristate(value)});
    this._hasBeenAnnotated = true;}
  set accessibilityFocusBlockType(value:AccessibilityFocusBlockType){if (this._accessibilityFocusBlockType == value) {
      return;
    }
    this._accessibilityFocusBlockType = value;
    this._flags = this._flags.copyWith({
      isAccessibilityFocusBlocked: value != AccessibilityFocusBlockType.none,
    });
    this._hasBeenAnnotated = true;}
  set isButton(value:boolean){this._flags = this._flags.copyWith({isButton: value});
    this._hasBeenAnnotated = true;}
  set isLink(value:boolean){this._flags = this._flags.copyWith({isLink: value});
    this._hasBeenAnnotated = true;}
  set linkUrl(value:string|null){if (valueEquals(value,this._linkUrl)) {
      return;
    }
    this._linkUrl = value;
    this._hasBeenAnnotated = true;}
  set isHeader(value:boolean){this._flags = this._flags.copyWith({isHeader: value});
    this._hasBeenAnnotated = true;}
  set headingLevel(value:number){if(FoundationBuildMode.debug)invariant(value >= 0 && value <= 6,'invalid-semantics-configuration','Invalid this.headingLevel');
    if (valueEquals(value,this.headingLevel)) {
      return;
    }
    this._headingLevel = value;
    this._hasBeenAnnotated = true;}
  set isSlider(value:boolean){this._flags = this._flags.copyWith({isSlider: value});
    this._hasBeenAnnotated = true;}
  set isKeyboardKey(value:boolean){this._flags = this._flags.copyWith({isKeyboardKey: value});
    this._hasBeenAnnotated = true;}
  set isHidden(value:boolean){this._flags = this._flags.copyWith({isHidden: value});
    this._hasBeenAnnotated = true;}
  set isTextField(value:boolean){this._flags = this._flags.copyWith({isTextField: value});
    this._hasBeenAnnotated = true;}
  set isReadOnly(value:boolean){this._flags = this._flags.copyWith({isReadOnly: value});
    this._hasBeenAnnotated = true;}
  set isObscured(value:boolean){this._flags = this._flags.copyWith({isObscured: value});
    this._hasBeenAnnotated = true;}
  set isMultiline(value:boolean){this._flags = this._flags.copyWith({isMultiline: value});
    this._hasBeenAnnotated = true;}
  set isRequired(value:boolean|null){this._flags = this._flags.copyWith({isRequired: tristate(value)});
    this._hasBeenAnnotated = true;}
  set hasImplicitScrolling(value:boolean){this._flags = this._flags.copyWith({hasImplicitScrolling: value});
    this._hasBeenAnnotated = true;}
  set textSelection(value:TextSelection|null){if(FoundationBuildMode.debug)invariant(value !== null,'invalid-semantics-configuration','Invalid this.textSelection');
    this._textSelection = value;
    this._hasBeenAnnotated = true;}
  set scrollPosition(value:number|null){if(FoundationBuildMode.debug)invariant(value !== null,'invalid-semantics-configuration','Invalid this.scrollPosition');
    this._scrollPosition = value;
    this._hasBeenAnnotated = true;}
  set scrollExtentMax(value:number|null){if(FoundationBuildMode.debug)invariant(value !== null,'invalid-semantics-configuration','Invalid this.scrollExtentMax');
    this._scrollExtentMax = value;
    this._hasBeenAnnotated = true;}
  set scrollExtentMin(value:number|null){if(FoundationBuildMode.debug)invariant(value !== null,'invalid-semantics-configuration','Invalid this.scrollExtentMin');
    this._scrollExtentMin = value;
    this._hasBeenAnnotated = true;}
  set controlsNodes(value:Set<string>|null){if(FoundationBuildMode.debug)invariant(value !== null,'invalid-semantics-configuration','Invalid this.controlsNodes');
    this._controlsNodes = value;
    this._hasBeenAnnotated = true;}
  set validationResult(value:SemanticsValidationResult){this._validationResult = value;
    this._hasBeenAnnotated = true;}
  set hitTestBehavior(value:SemanticsHitTestBehavior){this._hitTestBehavior = value;
    this._hasBeenAnnotated = true;}
  set inputType(value:SemanticsInputType){this._inputType = value;
    this._hasBeenAnnotated = true;}
  set maxValue(value:string|null){this._maxValue = value;
    this._hasBeenAnnotated = true;}
  set minValue(value:string|null){this._minValue = value;
    this._hasBeenAnnotated = true;}

  get onTap():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onTap;}
  set onTap(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.tap,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onTap=value;}

  get onLongPress():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onLongPress;}
  set onLongPress(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.longPress,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onLongPress=value;}

  get onScrollLeft():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onScrollLeft;}
  set onScrollLeft(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.scrollLeft,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onScrollLeft=value;}

  get onDismiss():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onDismiss;}
  set onDismiss(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.dismiss,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onDismiss=value;}

  get onScrollRight():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onScrollRight;}
  set onScrollRight(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.scrollRight,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onScrollRight=value;}

  get onScrollUp():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onScrollUp;}
  set onScrollUp(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.scrollUp,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onScrollUp=value;}

  get onScrollDown():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onScrollDown;}
  set onScrollDown(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.scrollDown,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onScrollDown=value;}

  get onIncrease():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onIncrease;}
  set onIncrease(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.increase,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onIncrease=value;}

  get onDecrease():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onDecrease;}
  set onDecrease(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.decrease,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onDecrease=value;}

  get onCopy():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onCopy;}
  set onCopy(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.copy,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onCopy=value;}

  get onCut():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onCut;}
  set onCut(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.cut,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onCut=value;}

  get onPaste():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onPaste;}
  set onPaste(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.paste,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onPaste=value;}

  /** Core text providers may target a document range; ordinary requests have no argument. */
  get onShowOnScreen():((range?:SemanticsTextRange)=>void)|null{return this._callbacks===null?null:this._callbacks.onShowOnScreen;}
  set onShowOnScreen(value:((range?:SemanticsTextRange)=>void)|null){
    invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');
    this._addAction(SemanticsAction.showOnScreen,args=>{
      if(args==null){value();return;}
      invariant(typeof args==='object'&&'start' in args&&'end' in args&&'alignToTop' in args,'invalid-semantics-text-range','A text reveal requires an ordered UTF-16 range');
      const {start,end,alignToTop}=args;
      invariant(typeof start==='number'&&Number.isSafeInteger(start)&&start>=0&&typeof end==='number'&&Number.isSafeInteger(end)&&end>=start&&typeof alignToTop==='boolean','invalid-semantics-text-range','A text reveal requires an ordered UTF-16 range');
      value(Object.freeze({start,end,alignToTop}));
    });(this._callbacks??=new SemanticsConfigurationCallbacks()).onShowOnScreen=value;
  }

  get onDidGainAccessibilityFocus():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onDidGainAccessibilityFocus;}
  set onDidGainAccessibilityFocus(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.didGainAccessibilityFocus,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onDidGainAccessibilityFocus=value;}

  get onDidLoseAccessibilityFocus():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onDidLoseAccessibilityFocus;}
  set onDidLoseAccessibilityFocus(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.didLoseAccessibilityFocus,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onDidLoseAccessibilityFocus=value;}

  get onFocus():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onFocus;}
  set onFocus(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.focus,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onFocus=value;}

  get onExpand():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onExpand;}
  set onExpand(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.expand,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onExpand=value;}

  get onCollapse():(()=>void)|null{return this._callbacks===null?null:this._callbacks.onCollapse;}
  set onCollapse(value:(()=>void)|null){this._addArgumentlessAction(SemanticsAction.collapse,value);(this._callbacks??=new SemanticsConfigurationCallbacks()).onCollapse=value;}

  get onScrollToOffset():((value:Offset)=>void)|null{return this._callbacks===null?null:this._callbacks.onScrollToOffset;}
  set onScrollToOffset(value:((value:Offset)=>void)|null){if(FoundationBuildMode.debug)invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');this._addAction(SemanticsAction.scrollToOffset,args=>{const convert=():Offset=>{invariant(args instanceof Float64Array&&args.length>=2,'invalid-semantics-offset','Scroll offset requires a Float64Array');return new Offset(args[0]!,args[1]!);};const argument=convert();invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');value(argument);});(this._callbacks??=new SemanticsConfigurationCallbacks()).onScrollToOffset=value;}

  get onMoveCursorForwardByCharacter():((value:boolean)=>void)|null{return this._callbacks===null?null:this._callbacks.onMoveCursorForwardByCharacter;}
  set onMoveCursorForwardByCharacter(value:((value:boolean)=>void)|null){if(FoundationBuildMode.debug)invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');this._addAction(SemanticsAction.moveCursorForwardByCharacter,args=>{const convert=():boolean=>{invariant(typeof args==='boolean','invalid-semantics-selection','Cursor selection argument must be boolean');return args;};const argument=convert();invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');value(argument);});(this._callbacks??=new SemanticsConfigurationCallbacks()).onMoveCursorForwardByCharacter=value;}

  get onMoveCursorForwardByWord():((value:boolean)=>void)|null{return this._callbacks===null?null:this._callbacks.onMoveCursorForwardByWord;}
  set onMoveCursorForwardByWord(value:((value:boolean)=>void)|null){if(FoundationBuildMode.debug)invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');this._addAction(SemanticsAction.moveCursorForwardByWord,args=>{const convert=():boolean=>{invariant(typeof args==='boolean','invalid-semantics-selection','Cursor selection argument must be boolean');return args;};const argument=convert();invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');value(argument);});(this._callbacks??=new SemanticsConfigurationCallbacks()).onMoveCursorForwardByCharacter=value;}

  get onMoveCursorBackwardByCharacter():((value:boolean)=>void)|null{return this._callbacks===null?null:this._callbacks.onMoveCursorBackwardByCharacter;}
  set onMoveCursorBackwardByCharacter(value:((value:boolean)=>void)|null){if(FoundationBuildMode.debug)invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');this._addAction(SemanticsAction.moveCursorBackwardByCharacter,args=>{const convert=():boolean=>{invariant(typeof args==='boolean','invalid-semantics-selection','Cursor selection argument must be boolean');return args;};const argument=convert();invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');value(argument);});(this._callbacks??=new SemanticsConfigurationCallbacks()).onMoveCursorBackwardByCharacter=value;}

  get onMoveCursorBackwardByWord():((value:boolean)=>void)|null{return this._callbacks===null?null:this._callbacks.onMoveCursorBackwardByWord;}
  set onMoveCursorBackwardByWord(value:((value:boolean)=>void)|null){if(FoundationBuildMode.debug)invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');this._addAction(SemanticsAction.moveCursorBackwardByWord,args=>{const convert=():boolean=>{invariant(typeof args==='boolean','invalid-semantics-selection','Cursor selection argument must be boolean');return args;};const argument=convert();invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');value(argument);});(this._callbacks??=new SemanticsConfigurationCallbacks()).onMoveCursorBackwardByCharacter=value;}

  get onSetSelection():((value:TextSelection)=>void)|null{return this._callbacks===null?null:this._callbacks.onSetSelection;}
  set onSetSelection(value:((value:TextSelection)=>void)|null){if(FoundationBuildMode.debug)invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');this._addAction(SemanticsAction.setSelection,args=>{const convert=():TextSelection=>{invariant(args instanceof Map,'invalid-semantics-selection','Selection arguments require a Map');const base=args.get('base'),extent=args.get('extent');invariant(Number.isSafeInteger(base)&&Number.isSafeInteger(extent),'invalid-semantics-selection','Selection offsets must be integers');return new TextSelection({baseOffset:base,extentOffset:extent});};const argument=convert();invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');value(argument);});(this._callbacks??=new SemanticsConfigurationCallbacks()).onSetSelection=value;}

  get onSetText():((value:string)=>void)|null{return this._callbacks===null?null:this._callbacks.onSetText;}
  set onSetText(value:((value:string)=>void)|null){if(FoundationBuildMode.debug)invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');this._addAction(SemanticsAction.setText,args=>{const convert=():string=>{invariant(typeof args==='string','invalid-semantics-text','Text argument must be a string');return args;};const argument=convert();invariant(value!==null,'null-semantics-handler','Semantics action handler cannot be null');value(argument);});(this._callbacks??=new SemanticsConfigurationCallbacks()).onSetText=value;}
  get customSemanticsActions():Map<CustomSemanticsAction,()=>void>{return this._customSemanticsActions;}
  set customSemanticsActions(value:Map<CustomSemanticsAction,()=>void>){this._hasBeenAnnotated=true;this._actionsAsBits|=SemanticsAction.customAction.index;this._customSemanticsActions=value;this._actions.set(SemanticsAction.customAction,args=>this._onCustomSemanticsAction(args));}
  private _onCustomSemanticsAction(args:unknown):void{invariant(Number.isSafeInteger(args),'invalid-custom-action-id','Custom action requires an integer id');const action=CustomSemanticsAction.getAction(args as number);if(action===null)return;let callback:(()=>void)|undefined;for(const [key,value]of this._customSemanticsActions)if(key.equals(action))callback=value;callback?.();}
  get tagsForChildren():Iterable<SemanticsTag>|null{return this._tagsForChildren;}
  tagsChildrenWith(tag:SemanticsTag):boolean{return this._tagsForChildren?.some(value=>valueEquals(value,tag))??false;}
  addTagForChildren(tag:SemanticsTag):void{this._tagsForChildren??=[];if(!this.tagsChildrenWith(tag))this._tagsForChildren.push(tag);}
  private get _hasExplicitRole():boolean{return this._role!==SemanticsRole.none||this._flags.isTextField||this._flags.isHeader&&FoundationPlatform.hostEnvironment.kind==='web'||this._flags.isSlider||this._flags.isLink||this._flags.scopesRoute||this._flags.isImage||this._flags.isKeyboardKey;}
  isCompatibleWith(other:SemanticsConfiguration|null):boolean{
    if(other===null||!other.hasBeenAnnotated)return true;
    if(!valueEquals(this._traversalChildIdentifier,other._traversalChildIdentifier))return false;
    if(!this.hasBeenAnnotated)return true;
    if((this._actionsAsBits&other._actionsAsBits)!==0||this._flags.hasConflictingFlags(other._flags))return false;
    if(this._platformViewId!==null&&other._platformViewId!==null||this._maxValueLength!==null&&other._maxValueLength!==null||this._currentValueLength!==null&&other._currentValueLength!==null)return false;
    if(this._attributedValue.string!==''&&other._attributedValue.string!=='')return false;
    if(!valueEquals(this._localeForSubtree,other._localeForSubtree)||this._hasExplicitRole&&other._hasExplicitRole)return false;
    if(this._hitTestBehavior!==SemanticsHitTestBehavior.defer||other._hitTestBehavior!==SemanticsHitTestBehavior.defer)return false;
    if(this._minValue!==null&&other._minValue!==null||this._maxValue!==null&&other._maxValue!==null)return false;
    return true;
  }
  absorb(child:SemanticsConfiguration):void{
    if(FoundationBuildMode.debug)invariant(!this.explicitChildNodes,'explicit-semantics-children','Explicit child nodes cannot be absorbed');
    if(!child.hasBeenAnnotated)return;
    if(child._actionTables.actions)for(const [action,handler]of child._actionTables.actions)if(!child.isBlockingUserActions||(action.index&unblockedActions)>0)this._actions.set(action,handler);
    this._actionsAsBits|=child._effectiveActionsAsBits;
    if(child._actionTables.custom)for(const [action,handler]of child._actionTables.custom){const existing=[...this._customSemanticsActions.keys()].find(key=>key.equals(action));this._customSemanticsActions.set(existing??action,handler);}
    this._flags=this._flags.merge(child._flags);
    this._linkUrl??=child._linkUrl;
    this._textSelection??=child._textSelection;
    this._scrollPosition??=child._scrollPosition;
    this._scrollExtentMax??=child._scrollExtentMax;
    this._scrollExtentMin??=child._scrollExtentMin;
    this._hintOverrides??=child._hintOverrides;
    this._indexInParent??=child.indexInParent;
    this._scrollIndex??=child._scrollIndex;
    this._scrollChildCount??=child._scrollChildCount;
    this._platformViewId??=child._platformViewId;
    this._maxValueLength??=child._maxValueLength;
    this._currentValueLength??=child._currentValueLength;
    if(this._traversalChildIdentifier===null)this._traversalParentIdentifier??=child._traversalParentIdentifier;
    this._traversalChildIdentifier??=child._traversalChildIdentifier;
    this._headingLevel=this._headingLevel===0?child._headingLevel:this._headingLevel;
    this.textDirection??=child.textDirection;
    this._sortKey??=child._sortKey;
    if(this._identifier==='')this._identifier=child._identifier;
    this._attributedLabel=concat(this._attributedLabel,child._attributedLabel,this.textDirection,child.textDirection);
    if(this._attributedValue.string==='')this._attributedValue=child._attributedValue;
    if(this._attributedIncreasedValue.string==='')this._attributedIncreasedValue=child._attributedIncreasedValue;
    if(this._attributedDecreasedValue.string==='')this._attributedDecreasedValue=child._attributedDecreasedValue;
    if(this._role===SemanticsRole.none)this._role=child._role;
    if(this._inputType===SemanticsInputType.none)this._inputType=child._inputType;
    this._attributedHint=concat(this._attributedHint,child._attributedHint,this.textDirection,child.textDirection);
    if(this._tooltip==='')this._tooltip=child._tooltip;
    if(this._controlsNodes===null)this._controlsNodes=child._controlsNodes;else if(child._controlsNodes!==null)this._controlsNodes=new Set([...this._controlsNodes,...child._controlsNodes]);
    if(child._validationResult!==this._validationResult){if(child._validationResult===SemanticsValidationResult.invalid)this._validationResult=SemanticsValidationResult.invalid;else if(this._validationResult===SemanticsValidationResult.none)this._validationResult=child._validationResult;}
    this._accessibilityFocusBlockType=this._accessibilityFocusBlockType===AccessibilityFocusBlockType.blockSubtree||child._accessibilityFocusBlockType===AccessibilityFocusBlockType.blockSubtree?AccessibilityFocusBlockType.blockSubtree:this._accessibilityFocusBlockType===AccessibilityFocusBlockType.blockNode||child._accessibilityFocusBlockType===AccessibilityFocusBlockType.blockNode?AccessibilityFocusBlockType.blockNode:AccessibilityFocusBlockType.none;
    this._minValue??=child._minValue;
    this._maxValue??=child._maxValue;
    if(this._hitTestBehavior===SemanticsHitTestBehavior.defer&&child._hitTestBehavior!==SemanticsHitTestBehavior.defer)this._hitTestBehavior=child._hitTestBehavior;
    this._hasBeenAnnotated=this.hasBeenAnnotated||child.hasBeenAnnotated;
  }
  copy():SemanticsConfiguration{const result=new SemanticsConfiguration();
    result._isSemanticBoundary=this._isSemanticBoundary;
    result.explicitChildNodes=this.explicitChildNodes;
    result.isBlockingSemanticsOfPreviouslyPaintedNodes=this.isBlockingSemanticsOfPreviouslyPaintedNodes;
    result._hasBeenAnnotated=this.hasBeenAnnotated;
    result._isMergingSemanticsOfDescendants=this._isMergingSemanticsOfDescendants;
    result._textDirection=this._textDirection;
    result._sortKey=this._sortKey;
    result._identifier=this._identifier;
    result._traversalParentIdentifier=this._traversalParentIdentifier;
    result._traversalChildIdentifier=this._traversalChildIdentifier;
    result._attributedLabel=this._attributedLabel;
    result._attributedIncreasedValue=this._attributedIncreasedValue;
    result._attributedValue=this._attributedValue;
    result._attributedDecreasedValue=this._attributedDecreasedValue;
    result._attributedHint=this._attributedHint;
    result._accessibilityFocusBlockType=this._accessibilityFocusBlockType;
    result._hintOverrides=this._hintOverrides;
    result._tooltip=this._tooltip;
    result._flags=this._flags;
    result._tagsForChildren=this._tagsForChildren;
    result._textSelection=this._textSelection;
    result._scrollPosition=this._scrollPosition;
    result._scrollExtentMax=this._scrollExtentMax;
    result._scrollExtentMin=this._scrollExtentMin;
    result._actionsAsBits=this._actionsAsBits;
    result._indexInParent=this.indexInParent;
    result._scrollIndex=this._scrollIndex;
    result._scrollChildCount=this._scrollChildCount;
    result._platformViewId=this._platformViewId;
    result._maxValueLength=this._maxValueLength;
    result._currentValueLength=this._currentValueLength;
    result.isBlockingUserActions=this.isBlockingUserActions;
    result._headingLevel=this._headingLevel;
    result._linkUrl=this._linkUrl;
    result._role=this._role;
    result._controlsNodes=this._controlsNodes;
    result._validationResult=this._validationResult;
    result._inputType=this._inputType;
    result._hitTestBehavior=this._hitTestBehavior;
    result._traversalChildIdentifier=this._traversalChildIdentifier;
    result._traversalParentIdentifier=this._traversalParentIdentifier;
    result._minValue=this._minValue;
    result._maxValue=this._maxValue;
    if(this._actionTables.actions)for(const [action,handler]of this._actionTables.actions)result._actions.set(action,handler);
    if(this._actionTables.custom)for(const [action,handler]of this._actionTables.custom)result._customSemanticsActions.set(action,handler);
    return result;
  }
}

export interface SemanticsDataOptions {
  readonly flagsCollection:SemanticsFlags;
  readonly actions:number;
  readonly identifier:string;
  readonly traversalParentIdentifier:unknown|null;
  readonly traversalChildIdentifier:unknown|null;
  readonly attributedLabel:AttributedString;
  readonly attributedValue:AttributedString;
  readonly attributedIncreasedValue:AttributedString;
  readonly attributedDecreasedValue:AttributedString;
  readonly attributedHint:AttributedString;
  readonly tooltip:string;
  readonly headingLevel:number;
  readonly textDirection:'ltr'|'rtl'|null;
  readonly textSelection:TextSelection|null;
  readonly scrollChildCount:number|null;
  readonly scrollIndex:number|null;
  readonly scrollPosition:number|null;
  readonly scrollExtentMax:number|null;
  readonly scrollExtentMin:number|null;
  readonly platformViewId:number|null;
  readonly maxValueLength:number|null;
  readonly currentValueLength:number|null;
  readonly linkUrl:string|null;
  readonly rect:RectValue;
  readonly tags?:Set<SemanticsTag>|null;
  readonly transform?:Matrix4|null;
  readonly customSemanticsActionIds?:readonly number[]|null;
  readonly role:SemanticsRole;
  readonly controlsNodes:Set<string>|null;
  readonly validationResult:SemanticsValidationResult;
  readonly hitTestBehavior:SemanticsHitTestBehavior;
  readonly inputType:SemanticsInputType;
  readonly locale:Locale|null;
  readonly maxValue:string|null;
  readonly minValue:string|null;
}
/** Node annotations before engine submission. Mutable collections retain source aliasing. */
const protectSemanticsData=finalFieldProtector(["flagsCollection","actions","identifier","traversalParentIdentifier","traversalChildIdentifier","attributedLabel","attributedValue","attributedIncreasedValue","attributedDecreasedValue","attributedHint","tooltip","headingLevel","textDirection","textSelection","scrollChildCount","scrollIndex","scrollPosition","scrollExtentMax","scrollExtentMin","platformViewId","maxValueLength","currentValueLength","linkUrl","rect","tags","transform","customSemanticsActionIds","role","controlsNodes","validationResult","hitTestBehavior","inputType","locale","maxValue","minValue"]);
export class SemanticsData extends Diagnosticable(class {}) {
  readonly flagsCollection:SemanticsFlags;
  readonly actions:number;
  readonly identifier:string;
  readonly traversalParentIdentifier:unknown|null;
  readonly traversalChildIdentifier:unknown|null;
  readonly attributedLabel:AttributedString;
  readonly attributedValue:AttributedString;
  readonly attributedIncreasedValue:AttributedString;
  readonly attributedDecreasedValue:AttributedString;
  readonly attributedHint:AttributedString;
  readonly tooltip:string;
  readonly headingLevel:number;
  readonly textDirection:'ltr'|'rtl'|null;
  readonly textSelection:TextSelection|null;
  readonly scrollChildCount:number|null;
  readonly scrollIndex:number|null;
  readonly scrollPosition:number|null;
  readonly scrollExtentMax:number|null;
  readonly scrollExtentMin:number|null;
  readonly platformViewId:number|null;
  readonly maxValueLength:number|null;
  readonly currentValueLength:number|null;
  readonly linkUrl:string|null;
  readonly rect:RectValue;
  readonly tags:Set<SemanticsTag>|null;
  readonly transform:Matrix4|null;
  readonly customSemanticsActionIds:readonly number[]|null;
  readonly role:SemanticsRole;
  readonly controlsNodes:Set<string>|null;
  readonly validationResult:SemanticsValidationResult;
  readonly hitTestBehavior:SemanticsHitTestBehavior;
  readonly inputType:SemanticsInputType;
  readonly locale:Locale|null;
  readonly maxValue:string|null;
  readonly minValue:string|null;
  constructor(options:SemanticsDataOptions){super();
    this.flagsCollection=options.flagsCollection;
    this.actions=options.actions;
    this.identifier=options.identifier;
    this.traversalParentIdentifier=options.traversalParentIdentifier;
    this.traversalChildIdentifier=options.traversalChildIdentifier;
    this.attributedLabel=options.attributedLabel;
    this.attributedValue=options.attributedValue;
    this.attributedIncreasedValue=options.attributedIncreasedValue;
    this.attributedDecreasedValue=options.attributedDecreasedValue;
    this.attributedHint=options.attributedHint;
    this.tooltip=options.tooltip;
    this.headingLevel=options.headingLevel;
    this.textDirection=options.textDirection;
    this.textSelection=options.textSelection;
    this.scrollChildCount=options.scrollChildCount;
    this.scrollIndex=options.scrollIndex;
    this.scrollPosition=options.scrollPosition;
    this.scrollExtentMax=options.scrollExtentMax;
    this.scrollExtentMin=options.scrollExtentMin;
    this.platformViewId=options.platformViewId;
    this.maxValueLength=options.maxValueLength;
    this.currentValueLength=options.currentValueLength;
    this.linkUrl=options.linkUrl;
    this.rect=options.rect;
    this.tags=options.tags??null;
    this.transform=options.transform??null;
    this.customSemanticsActionIds=options.customSemanticsActionIds??null;
    this.role=options.role;
    this.controlsNodes=options.controlsNodes;
    this.validationResult=options.validationResult;
    this.hitTestBehavior=options.hitTestBehavior;
    this.inputType=options.inputType;
    this.locale=options.locale;
    this.maxValue=options.maxValue;
    this.minValue=options.minValue;
    if(FoundationBuildMode.debug){for(const [name,text]of [['tooltip',this.tooltip],['label',this.label],['value',this.value],['decreasedValue',this.decreasedValue],['increasedValue',this.increasedValue],['hint',this.hint]])invariant(text===''||this.textDirection!==null,'missing-semantics-direction',`SemanticsData with ${name} requires textDirection`);invariant(this.headingLevel>=0&&this.headingLevel<=6,'invalid-semantics-heading','Heading level must be between 0 and 6');invariant(this.linkUrl===null||this.flagsCollection.isLink,'invalid-semantics-link','A link URL requires the isLink flag');}
    if(new.target===SemanticsData)Object.freeze(this);else protectSemanticsData(this);
  }
  /** @deprecated Use flagsCollection. The legacy mask excludes new non-bitmask flags. */
  get flags():number{return semanticsFlagsBitMask(this.flagsCollection);}
  get label():string{return this.attributedLabel.string;}
  get value():string{return this.attributedValue.string;}
  get increasedValue():string{return this.attributedIncreasedValue.string;}
  get decreasedValue():string{return this.attributedDecreasedValue.string;}
  get hint():string{return this.attributedHint.string;}
  /** @deprecated Use flagsCollection. */
  hasFlag(flag:SemanticsFlag):boolean{return (this.flags&flag.index)!==0;}
  hasAction(action:SemanticsAction):boolean{return (this.actions&action.index)!==0;}
  toJson():Record<string,unknown>{return {label:this.label,value:this.value,hint:this.hint,tooltip:this.tooltip,increasedValue:this.increasedValue,decreasedValue:this.decreasedValue,flags:SemanticsFlag.values.filter(flag=>this.hasFlag(flag)).map(flag=>flag.name),actions:SemanticsAction.values.filter(action=>this.hasAction(action)).map(action=>action.name),rect:{left:this.rect.left,top:this.rect.top,width:this.rect.width,height:this.rect.height},...(this.transform===null?{}:{transform:Array.from(this.transform.storage)})};}
  override toStringShort():string{return objectRuntimeType(this,'SemanticsData');}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);properties.add(new DiagnosticsProperty('rect',this.rect,{showName:false}));properties.add(new TransformProperty('transform',this.transform,{showName:false,defaultValue:null}));invariant(this.customSemanticsActionIds!==null,'null-custom-semantics-actions','Semantics diagnostics require a custom action list');const custom=this.customSemanticsActionIds.map(id=>{const action=CustomSemanticsAction.getAction(id);invariant(action!==null,'missing-custom-semantics-action','Unknown custom action');return action.label;});properties.add(new IterableProperty('actions',SemanticsAction.values.filter(action=>this.hasAction(action)).map(action=>action.name),{ifEmpty:null}));properties.add(new IterableProperty('customActions',custom,{ifEmpty:null}));properties.add(new IterableProperty('flags',this.flagsCollection.toStrings(),{ifEmpty:null}));properties.add(new StringProperty('identifier',this.identifier,{defaultValue:''}));properties.add(new DiagnosticsProperty('traversalParentIdentifier',this.traversalParentIdentifier,{defaultValue:null}));properties.add(new DiagnosticsProperty('traversalChildIdentifier',this.traversalChildIdentifier,{defaultValue:null}));
    properties.add(new AttributedStringProperty('label',this.attributedLabel));
    properties.add(new AttributedStringProperty('value',this.attributedValue));
    properties.add(new AttributedStringProperty('increasedValue',this.attributedIncreasedValue));
    properties.add(new AttributedStringProperty('decreasedValue',this.attributedDecreasedValue));
    properties.add(new AttributedStringProperty('hint',this.attributedHint));
    properties.add(new StringProperty('tooltip',this.tooltip,{defaultValue:''}));properties.add(new EnumProperty('textDirection',this.textDirection,{defaultValue:null}));if(this.textSelection?.isValid)properties.add(new MessageProperty('textSelection',`[${this.textSelection.start}, ${this.textSelection.end}]`));
    properties.add(new IntProperty('platformViewId',this.platformViewId,{defaultValue:null}));
    properties.add(new IntProperty('maxValueLength',this.maxValueLength,{defaultValue:null}));
    properties.add(new IntProperty('currentValueLength',this.currentValueLength,{defaultValue:null}));
    properties.add(new IntProperty('scrollChildren',this.scrollChildCount,{defaultValue:null}));
    properties.add(new IntProperty('scrollIndex',this.scrollIndex,{defaultValue:null}));
    properties.add(new DoubleProperty('scrollExtentMin',this.scrollExtentMin,{defaultValue:null}));
    properties.add(new DoubleProperty('scrollPosition',this.scrollPosition,{defaultValue:null}));
    properties.add(new DoubleProperty('scrollExtentMax',this.scrollExtentMax,{defaultValue:null}));
    properties.add(new IntProperty('headingLevel',this.headingLevel,{defaultValue:0}));properties.add(new DiagnosticsProperty('linkUrl',this.linkUrl,{defaultValue:null}));if(this.controlsNodes!==null)properties.add(new IterableProperty('controls',this.controlsNodes,{ifEmpty:null}));if(this.role!==SemanticsRole.none)properties.add(new EnumProperty('role',this.role,{defaultValue:SemanticsRole.none}));if(this.validationResult!==SemanticsValidationResult.none)properties.add(new EnumProperty('validationResult',this.validationResult,{defaultValue:SemanticsValidationResult.none}));properties.add(new StringProperty('minValue',this.minValue,{defaultValue:null}));properties.add(new StringProperty('maxValue',this.maxValue,{defaultValue:null}));
  }
  equals(other:unknown):boolean{return other instanceof SemanticsData&&valueEquals(other.flags,this.flags)&&valueEquals(other.actions,this.actions)&&valueEquals(other.identifier,this.identifier)&&valueEquals(other.traversalParentIdentifier,this.traversalParentIdentifier)&&valueEquals(other.traversalChildIdentifier,this.traversalChildIdentifier)&&valueEquals(other.attributedLabel,this.attributedLabel)&&valueEquals(other.attributedValue,this.attributedValue)&&valueEquals(other.attributedIncreasedValue,this.attributedIncreasedValue)&&valueEquals(other.attributedDecreasedValue,this.attributedDecreasedValue)&&valueEquals(other.attributedHint,this.attributedHint)&&valueEquals(other.tooltip,this.tooltip)&&valueEquals(other.textDirection,this.textDirection)&&valueEquals(other.rect,this.rect)&&valueEquals(other.scrollChildCount,this.scrollChildCount)&&valueEquals(other.scrollIndex,this.scrollIndex)&&valueEquals(other.textSelection,this.textSelection)&&valueEquals(other.scrollPosition,this.scrollPosition)&&valueEquals(other.scrollExtentMax,this.scrollExtentMax)&&valueEquals(other.scrollExtentMin,this.scrollExtentMin)&&valueEquals(other.platformViewId,this.platformViewId)&&valueEquals(other.maxValueLength,this.maxValueLength)&&valueEquals(other.currentValueLength,this.currentValueLength)&&valueEquals(other.transform,this.transform)&&valueEquals(other.headingLevel,this.headingLevel)&&valueEquals(other.linkUrl,this.linkUrl)&&valueEquals(other.role,this.role)&&valueEquals(other.validationResult,this.validationResult)&&valueEquals(other.inputType,this.inputType)&&valueEquals(other.hitTestBehavior,this.hitTestBehavior)&&valueEquals(other.traversalParentIdentifier,this.traversalParentIdentifier)&&valueEquals(other.traversalChildIdentifier,this.traversalChildIdentifier)&&valueEquals(other.minValue,this.minValue)&&valueEquals(other.maxValue,this.maxValue)&&semanticsSetEquals(other.tags,this.tags)&&listEquals(other.customSemanticsActionIds,this.customSemanticsActionIds)&&semanticsSetEquals(other.controlsNodes,this.controlsNodes);}
  get hashCode():number{return hashValues(
    this.flags,
    this.actions,
    this.identifier,
    this.attributedLabel,
    this.attributedValue,
    this.attributedIncreasedValue,
    this.attributedDecreasedValue,
    this.attributedHint,
    this.tooltip,
    this.textDirection,
    this.rect,
    this.tags,
    this.textSelection,
    this.scrollChildCount,
    this.scrollIndex,
    this.scrollPosition,
    this.scrollExtentMax,
    this.scrollExtentMin,
    this.platformViewId,
    hashValues(
      this.maxValueLength,
      this.currentValueLength,
      this.transform,
      this.headingLevel,
      this.linkUrl,
      this.customSemanticsActionIds===null?null:hashValues(...this.customSemanticsActionIds),
      this.role,
      this.validationResult,
      this.controlsNodes===null?null:hashValues(...this.controlsNodes),
      this.inputType,
      this.hitTestBehavior,
      this.traversalParentIdentifier,
      this.traversalChildIdentifier,
      this.minValue,
      this.maxValue,
    ));}
}
function semanticsSetEquals<T>(a:ReadonlySet<T>|null,b:ReadonlySet<T>|null):boolean{return a===b||a!==null&&b!==null&&a.size===b.size&&[...a].every(value=>[...b].some(other=>valueEquals(value,other)));}
function semanticsFlagsBitMask(flags:SemanticsFlags):number {
  let bitmask = 0;
  if (flags.isChecked != CheckedState.none) {
    bitmask |= 1 << 0;
  }
  if (flags.isChecked == CheckedState.isTrue) {
    bitmask |= 1 << 1;
  }
  if (flags.isSelected == Tristate.isTrue) {
    bitmask |= 1 << 2;
  }
  if (flags.isButton) {
    bitmask |= 1 << 3;
  }
  if (flags.isTextField) {
    bitmask |= 1 << 4;
  }
  if (flags.isFocused == Tristate.isTrue) {
    bitmask |= 1 << 5;
  }
  if (flags.isEnabled != Tristate.none) {
    bitmask |= 1 << 6;
  }
  if (flags.isEnabled == Tristate.isTrue) {
    bitmask |= 1 << 7;
  }
  if (flags.isInMutuallyExclusiveGroup) {
    bitmask |= 1 << 8;
  }
  if (flags.isHeader) {
    bitmask |= 1 << 9;
  }
  if (flags.isObscured) {
    bitmask |= 1 << 10;
  }
  if (flags.scopesRoute) {
    bitmask |= 1 << 11;
  }
  if (flags.namesRoute) {
    bitmask |= 1 << 12;
  }
  if (flags.isHidden) {
    bitmask |= 1 << 13;
  }
  if (flags.isImage) {
    bitmask |= 1 << 14;
  }
  if (flags.isLiveRegion) {
    bitmask |= 1 << 15;
  }
  if (flags.isToggled != Tristate.none) {
    bitmask |= 1 << 16;
  }
  if (flags.isToggled == Tristate.isTrue) {
    bitmask |= 1 << 17;
  }
  if (flags.hasImplicitScrolling) {
    bitmask |= 1 << 18;
  }
  if (flags.isMultiline) {
    bitmask |= 1 << 19;
  }
  if (flags.isReadOnly) {
    bitmask |= 1 << 20;
  }
  if (flags.isFocused != Tristate.none) {
    bitmask |= 1 << 21;
  }
  if (flags.isLink) {
    bitmask |= 1 << 22;
  }
  if (flags.isSlider) {
    bitmask |= 1 << 23;
  }
  if (flags.isKeyboardKey) {
    bitmask |= 1 << 24;
  }
  if (flags.isChecked == CheckedState.mixed) {
    bitmask |= 1 << 25;
  }
  if (flags.isExpanded != Tristate.none) {
    bitmask |= 1 << 26;
  }
  if (flags.isExpanded == Tristate.isTrue) {
    bitmask |= 1 << 27;
  }
  if (flags.isSelected != Tristate.none) {
    bitmask |= 1 << 28;
  }
  if (flags.isRequired != Tristate.none) {
    bitmask |= 1 << 29;
  }
  if (flags.isRequired == Tristate.isTrue) {
    bitmask |= 1 << 30;
  }
  return bitmask;
}

export type SemanticsNodeVisitor=(node:SemanticsNode)=>boolean;
export type SemanticsUpdateCallback=(update:SemanticsUpdate)=>void;
export const DebugSemanticsDumpOrder=Object.freeze({inverseHitTest:'inverseHitTest',traversalOrder:'traversalOrder'} as const);
export type DebugSemanticsDumpOrder=typeof DebugSemanticsDumpOrder[keyof typeof DebugSemanticsDumpOrder];
interface ConfigurationState {readonly _flags:SemanticsFlags;readonly _actions:Map<SemanticsAction,SemanticsActionHandler>;readonly _customSemanticsActions:Map<CustomSemanticsAction,()=>void>;readonly _actionsAsBits:number}
// Dart library privacy is represented by module-local friend views. The actual
// fields stay TypeScript-private on their declaring classes.
const configurationState=(config:SemanticsConfiguration)=>config as unknown as ConfigurationState;
interface OwnerState {readonly accessibility:BasicMessageChannel<unknown>;readonly _nodes:Map<number,SemanticsNode>;readonly _dirtyNodes:Set<SemanticsNode>;readonly _detachedNodes:Set<SemanticsNode>;readonly _traversalParentNodes:Map<unknown,SemanticsNode>;readonly _traversalChildNodes:Map<unknown,Set<SemanticsNode>>}
const ownerState=(owner:SemanticsOwner)=>owner as unknown as OwnerState;
interface NodeState {readonly _actions:Map<SemanticsAction,SemanticsActionHandler>;readonly _children:SemanticsNode[]|null;readonly _showOnScreen:(()=>void)|null;readonly _traversalTransform:Matrix4|null;_dirty:boolean;_markDirty():void;_visitDescendants(visitor:SemanticsNodeVisitor):boolean;_canHandleAction(action:SemanticsAction,args:unknown):boolean;_addToUpdate(builder:SemanticsUpdateBuilder|null,customActions:Set<number>):void}
const nodeState=(node:SemanticsNode)=>node as unknown as NodeState;
type MutableSemanticsData={-readonly [Key in keyof Required<SemanticsDataOptions>]:Required<SemanticsDataOptions>[Key]};
const emptyNodeConfiguration=new SemanticsConfiguration(),rootSemanticsOwner=Symbol('root semantics owner');
function defaultSemanticsData():MutableSemanticsData{return {flagsCollection:SemanticsFlags.none,actions:0,identifier:'',traversalParentIdentifier:null,traversalChildIdentifier:null,attributedLabel:emptyNodeConfiguration.attributedLabel,attributedValue:emptyNodeConfiguration.attributedValue,attributedIncreasedValue:emptyNodeConfiguration.attributedIncreasedValue,attributedDecreasedValue:emptyNodeConfiguration.attributedDecreasedValue,attributedHint:emptyNodeConfiguration.attributedHint,tooltip:'',textDirection:null,rect:RectValue.zero,textSelection:null,scrollIndex:null,scrollChildCount:null,scrollPosition:null,scrollExtentMax:null,scrollExtentMin:null,platformViewId:null,maxValueLength:null,currentValueLength:null,headingLevel:0,linkUrl:null,role:SemanticsRole.none,controlsNodes:null,validationResult:SemanticsValidationResult.none,hitTestBehavior:SemanticsHitTestBehavior.defer,inputType:SemanticsInputType.none,locale:null,minValue:null,maxValue:null,tags:null,transform:null,customSemanticsActionIds:[]};}
export interface SemanticsNodeOptions {readonly key?:Key|null;readonly showOnScreen?:(()=>void)|null}
/** Source tree, annotation, merge and traversal contracts. Host updates are explicit. */
export class SemanticsNode extends DiagnosticableTreeMixin(class {}) {
  private static lastIdentifier=0;
  private static generateId():number{this.lastIdentifier=(this.lastIdentifier+1)%65535;return this.lastIdentifier;}
  readonly key:Key|null;
  private _id:number;
  private readonly _showOnScreen:(()=>void)|null;
  private data=defaultSemanticsData();
  private _transform:Matrix4|null=null;
  private _traversalChildTransform:Matrix4|null=null;
  private _rect=RectValue.zero;
  parentSemanticsClipRect:RectValue|null=null;
  parentPaintClipRect:RectValue|null=null;
  indexInParent:number|null=null;
  tags:Set<SemanticsTag>|null=null;
  private _isMergedIntoParent=false;
  private _areUserActionsBlocked=false;
  private _mergeAllDescendantsIntoThisNode=false;
  private _children:SemanticsNode[]|null=null;
  private traversalOrderCache:{direction:'ltr'|'rtl'|null;debug:boolean;geometry:readonly {node:SemanticsNode;rect:RectValue;transform:readonly number[]|null}[];order:readonly SemanticsNode[]}|undefined;
  private debugPreviousChildren:SemanticsNode[]=[];
  private _dead=false;
  private _owner:SemanticsOwner|null=null;
  private _parent:SemanticsNode|null=null;
  private _traversalParent:SemanticsNode|null=null;
  private _depth=0;
  private _dirty=false;
  private _actions=configurationState(emptyNodeConfiguration)._actions;
  private _customSemanticsActions=configurationState(emptyNodeConfiguration)._customSemanticsActions;
  private _actionsAsBits=0;
  private _sortKey:SemanticsSortKey|null=null;
  private _hintOverrides:SemanticsHintOverrides|null=null;
  private _isMultiline:boolean|null=null;
  constructor(options:SemanticsNodeOptions={}){super();const rootOwner=(options as SemanticsNodeOptions&{[rootSemanticsOwner]?:SemanticsOwner})[rootSemanticsOwner];this.key=options.key??null;this._showOnScreen=options.showOnScreen??null;this._id=rootOwner?0:SemanticsNode.generateId();protect(this,['key']);if(rootOwner)this.attach(rootOwner);}
  static root(options:SemanticsNodeOptions&{readonly owner:SemanticsOwner}):SemanticsNode{return new SemanticsNode({...options,[rootSemanticsOwner]:options.owner} as SemanticsNodeOptions);}
  get id():number{return this._id;}
  get transform():Matrix4|null{return this._transform;}
  set transform(value:Matrix4|null){if(!MatrixUtils.matrixEquals(this._transform,value)){this._transform=value===null||MatrixUtils.isIdentity(value)?null:value;this._markDirty();}}
  private get _traversalTransform():Matrix4|null{return FoundationPlatform.hostEnvironment.kind==='web'?this.transform:this._traversalChildTransform??this.transform;}
  get rect():RectValue{return this._rect;}
  set rect(value:RectValue){if(FoundationBuildMode.debug)invariant(value.isFinite,'nonfinite-semantics-rect','Semantics rect must be finite');if(!this._rect.equals(value)){this._rect=value;this._markDirty();}}
  get isInvisible():boolean{return !this.isMergedIntoParent&&(this.rect.isEmpty||(this.transform?.isZero()??false));}
  get isMergedIntoParent():boolean{return this._isMergedIntoParent;}
  set isMergedIntoParent(value:boolean){if(this._isMergedIntoParent===value)return;this._isMergedIntoParent=value;this.parent?._markDirty();}
  get areUserActionsBlocked():boolean{return this._areUserActionsBlocked;}
  set areUserActionsBlocked(value:boolean){if(this._areUserActionsBlocked===value)return;this._areUserActionsBlocked=value;this._markDirty();}
  get isPartOfNodeMerging():boolean{return this.mergeAllDescendantsIntoThisNode||this.isMergedIntoParent;}
  get mergeAllDescendantsIntoThisNode():boolean{return this._mergeAllDescendantsIntoThisNode;}
  private _replaceChildren(children:SemanticsNode[]):void{
    if(FoundationBuildMode.debug){invariant(!children.includes(this),'self-semantics-child','A node cannot be its own child');invariant(new Set(children).size===children.length,'duplicate-semantics-child','Duplicate semantics children');}
    for(const child of this._children??[])child._dead=true;for(const child of children)child._dead=false;let changed=false;
    for(const child of this._children??[])if(child._dead){if(child.parent===this)this._dropChild(child);changed=true;}
    for(const child of children)if(child.parent!==this){child.parent?._dropChild(child);if(FoundationBuildMode.debug)invariant(!child.attached,'attached-semantics-child','Adopting an already attached semantics child');this._adoptChild(child);changed=true;}
    if(FoundationBuildMode.debug){if(children===this._children)invariant(children.length===this.debugPreviousChildren.length&&children.every((child,index)=>child===this.debugPreviousChildren[index]),'mutated-semantics-children','Create a new child list instead of mutating the previous list');this.debugPreviousChildren=[...children];let ancestor:SemanticsNode=this;while(ancestor.parent!==null)ancestor=ancestor.parent;invariant(!children.includes(ancestor),'cyclic-semantics-tree','Semantics tree contains an ancestor cycle');}
    if(!changed&&this._children!==null){if(FoundationBuildMode.debug)invariant(children.length===this._children.length,'inconsistent-semantics-children','Unexpected child count');changed=this._children.some((child,index)=>child.id!==children[index]!.id);}
    this._children=children;if(changed){this.traversalOrderCache=undefined;this._markDirty();}
  }
  get hasChildren():boolean{return (this._children?.length??0)>0;}
  get childrenCount():number{return this._children?.length??0;}
  get childrenCountInTraversalOrder():number{return this._childrenInTraversalOrder().length;}
  visitChildren(visitor:SemanticsNodeVisitor):void{for(const child of this._children??[])if(!visitor(child))return;}
  private _visitDescendants(visitor:SemanticsNodeVisitor):boolean{for(const child of this._children??[])if(!visitor(child)||!child._visitDescendants(visitor))return false;return true;}
  get owner():SemanticsOwner|null{return this._owner;}
  get attached():boolean{return this._owner!==null;}
  get parent():SemanticsNode|null{return this._parent;}
  get traversalParent():SemanticsNode|null{return this._traversalParent??this.parent;}
  set traversalParent(value:SemanticsNode|null){if(this._traversalParent===value)return;this._traversalParent=value;this._markDirty();}
  get depth():number{return this._depth;}
  private _redepthChild(child:SemanticsNode):void{if(FoundationBuildMode.debug)invariant(child.owner===this.owner,'different-semantics-owner','Parent and child owners must match');if(child._depth<=this._depth){child._depth=this._depth+1;for(const descendant of child._children??[])child._redepthChild(descendant);}}
  private _updateChildMergeFlagRecursively(child:SemanticsNode):void{if(FoundationBuildMode.debug)invariant(child.owner===this.owner,'different-semantics-owner','Parent and child owners must match');if(child.isMergedIntoParent===this.isPartOfNodeMerging)return;child.isMergedIntoParent=this.isPartOfNodeMerging;if(!child.mergeAllDescendantsIntoThisNode)child._updateChildrenMergeFlags();}
  private _updateChildrenMergeFlags():void{for(const child of this._children??[])this._updateChildMergeFlagRecursively(child);}
  private _adoptChild(child:SemanticsNode):void{if(FoundationBuildMode.debug){invariant(child.parent===null,'parented-semantics-child','Child already has a parent');let node:SemanticsNode=this;while(node.parent)node=node.parent;invariant(node!==child,'cyclic-semantics-tree','Semantics tree contains a cycle');}this.traversalOrderCache=undefined;child._parent=this;if(this.attached)child.attach(this.owner!);this._redepthChild(child);this._updateChildMergeFlagRecursively(child);}
  private _dropChild(child:SemanticsNode):void{if(FoundationBuildMode.debug)invariant(child.parent===this&&child.attached===this.attached,'invalid-semantics-detach','Child attachment does not match its parent');this.traversalOrderCache=undefined;child._parent=null;if(this.attached)child.detach();}
  attach(owner:SemanticsOwner):void{if(FoundationBuildMode.debug)invariant(this._owner===null,'attached-semantics-node','Node already has an owner');this._owner=owner;const state=ownerState(owner);while(state._nodes.has(this.id))this._id=SemanticsNode.generateId();state._nodes.set(this.id,this);state._detachedNodes.delete(this);if(this._dirty){this._dirty=false;this._markDirty();}for(const child of this._children??[])child.attach(owner);}
  detach():void{const owner=this.owner;if(FoundationBuildMode.debug)invariant(owner!==null,'detached-semantics-node','Node has no owner');invariant(owner!==null,'missing-semantics-owner','Node has no owner');const state=ownerState(owner);if(FoundationBuildMode.debug)invariant(state._nodes.has(this.id)&&!state._detachedNodes.has(this),'invalid-semantics-detach','Owner does not contain this node');state._nodes.delete(this.id);state._detachedNodes.add(this);if(this.traversalChildIdentifier!==null)state._traversalParentNodes.get(this.traversalChildIdentifier)?._markDirty();for(const [key,node]of state._traversalParentNodes)if(node===this)state._traversalParentNodes.delete(key);for(const [key,children]of state._traversalChildNodes){children.delete(this);if(!children.size)state._traversalChildNodes.delete(key);}this._owner=null;if(FoundationBuildMode.debug)invariant(this.parent===null||this.attached===this.parent.attached,'invalid-semantics-detach','Parent attachment does not match');for(const child of this._children??[])if(child.parent===this)child.detach();this._markDirty();}
  private _markDirty():void{if(this._dirty)return;this._dirty=true;if(this.owner){const state=ownerState(this.owner);if(FoundationBuildMode.debug)invariant(!state._detachedNodes.has(this),'detached-dirty-semantics','Detached node remains in owner');state._dirtyNodes.add(this);}}
  get debugIsDirty():boolean|null{return FoundationBuildMode.debug?this._dirty:null;}
  get flagsCollection():SemanticsFlags{return this.data.flagsCollection;}
  /** @deprecated Use flagsCollection. */
  hasFlag(flag:SemanticsFlag):boolean{return (semanticsFlagsBitMask(this.flagsCollection)&flag.index)!==0;}
  isTagged(tag:SemanticsTag):boolean{return this.tags!==null&&[...this.tags].some(value=>valueEquals(value,tag));}
  get hintOverrides():SemanticsHintOverrides|null{return this._hintOverrides;}
  get sortKey():SemanticsSortKey|null{return this._sortKey;}
  get isMultiline():boolean|null{return this._isMultiline;}
  get identifier():MutableSemanticsData['identifier']{return this.data.identifier;}
  get traversalParentIdentifier():MutableSemanticsData['traversalParentIdentifier']{return this.data.traversalParentIdentifier;}
  get traversalChildIdentifier():MutableSemanticsData['traversalChildIdentifier']{return this.data.traversalChildIdentifier;}
  get attributedLabel():MutableSemanticsData['attributedLabel']{return this.data.attributedLabel;}
  get attributedValue():MutableSemanticsData['attributedValue']{return this.data.attributedValue;}
  get attributedIncreasedValue():MutableSemanticsData['attributedIncreasedValue']{return this.data.attributedIncreasedValue;}
  get attributedDecreasedValue():MutableSemanticsData['attributedDecreasedValue']{return this.data.attributedDecreasedValue;}
  get attributedHint():MutableSemanticsData['attributedHint']{return this.data.attributedHint;}
  get tooltip():MutableSemanticsData['tooltip']{return this.data.tooltip;}
  get textDirection():MutableSemanticsData['textDirection']{return this.data.textDirection;}
  get textSelection():MutableSemanticsData['textSelection']{return this.data.textSelection;}
  get scrollChildCount():MutableSemanticsData['scrollChildCount']{return this.data.scrollChildCount;}
  get scrollIndex():MutableSemanticsData['scrollIndex']{return this.data.scrollIndex;}
  get scrollPosition():MutableSemanticsData['scrollPosition']{return this.data.scrollPosition;}
  get scrollExtentMax():MutableSemanticsData['scrollExtentMax']{return this.data.scrollExtentMax;}
  get scrollExtentMin():MutableSemanticsData['scrollExtentMin']{return this.data.scrollExtentMin;}
  get platformViewId():MutableSemanticsData['platformViewId']{return this.data.platformViewId;}
  get maxValueLength():MutableSemanticsData['maxValueLength']{return this.data.maxValueLength;}
  get currentValueLength():MutableSemanticsData['currentValueLength']{return this.data.currentValueLength;}
  get headingLevel():MutableSemanticsData['headingLevel']{return this.data.headingLevel;}
  get linkUrl():MutableSemanticsData['linkUrl']{return this.data.linkUrl;}
  get role():MutableSemanticsData['role']{return this.data.role;}
  get controlsNodes():MutableSemanticsData['controlsNodes']{return this.data.controlsNodes;}
  get minValue():MutableSemanticsData['minValue']{return this.data.minValue;}
  get maxValue():MutableSemanticsData['maxValue']{return this.data.maxValue;}
  get validationResult():MutableSemanticsData['validationResult']{return this.data.validationResult;}
  get hitTestBehavior():MutableSemanticsData['hitTestBehavior']{return this.data.hitTestBehavior;}
  get inputType():MutableSemanticsData['inputType']{return this.data.inputType;}
  get label():string{return this.data.attributedLabel.string;}
  get value():string{return this.data.attributedValue.string;}
  get increasedValue():string{return this.data.attributedIncreasedValue.string;}
  get decreasedValue():string{return this.data.attributedDecreasedValue.string;}
  get hint():string{return this.data.attributedHint.string;}
  private _canHandleAction(action:SemanticsAction,args:unknown):boolean{if(action===SemanticsAction.customAction){if(!Number.isSafeInteger(args))return false;const custom=CustomSemanticsAction.getAction(args as number);return custom!==null&&[...this._customSemanticsActions.keys()].some(key=>key.equals(custom));}return this._actions.has(action);}
  private get _effectiveActionsAsBits():number{return this._areUserActionsBlocked?this._actionsAsBits&unblockedActions:this._actionsAsBits;}
  updateWith({config,childrenInInversePaintOrder=[]}:{readonly config:SemanticsConfiguration|null;readonly childrenInInversePaintOrder?:SemanticsNode[]|null}):void{
    config??=emptyNodeConfiguration;const state=configurationState(config),changedFields=['attributedLabel','attributedHint','attributedValue','attributedIncreasedValue','attributedDecreasedValue','tooltip','textDirection','textSelection','scrollPosition','scrollExtentMax','scrollExtentMin','platformViewId','maxValueLength','currentValueLength','headingLevel','linkUrl','role','validationResult','hitTestBehavior','traversalChildIdentifier','traversalParentIdentifier','minValue','maxValue'] as const;
    const customChanged=this._customSemanticsActions.size!==state._customSemanticsActions.size||[...this._customSemanticsActions].some(([key,handler])=>![...state._customSemanticsActions].some(([other,callback])=>key.equals(other)&&handler===callback));
    if(changedFields.some(name=>!valueEquals(this.data[name],config![name]))||!this.flagsCollection.equals(state._flags)||!valueEquals(this._sortKey,config.sortKey)||this._actionsAsBits!==state._actionsAsBits||this.indexInParent!==config.indexInParent||this._mergeAllDescendantsIntoThisNode!==config.isMergingSemanticsOfDescendants||this._areUserActionsBlocked!==config.isBlockingUserActions||customChanged)this._markDirty();
    if(FoundationBuildMode.debug)invariant(config.platformViewId===null||childrenInInversePaintOrder===null||childrenInInversePaintOrder.length===0,'platform-view-semantics-children','SemanticsNodes with children must not specify a platformViewId');
    const mergeChanged=this._mergeAllDescendantsIntoThisNode!==config.isMergingSemanticsOfDescendants;
    this.data.identifier=config.identifier;
    this.data.traversalParentIdentifier=config.traversalParentIdentifier;
    this.data.traversalChildIdentifier=config.traversalChildIdentifier;
    this.data.attributedLabel=config.attributedLabel;
    this.data.attributedValue=config.attributedValue;
    this.data.attributedIncreasedValue=config.attributedIncreasedValue;
    this.data.attributedDecreasedValue=config.attributedDecreasedValue;
    this.data.attributedHint=config.attributedHint;
    this.data.tooltip=config.tooltip;
    this.data.textDirection=config.textDirection;
    this.data.textSelection=config.textSelection;
    this.data.scrollChildCount=config.scrollChildCount;
    this.data.scrollIndex=config.scrollIndex;
    this.data.scrollPosition=config.scrollPosition;
    this.data.scrollExtentMax=config.scrollExtentMax;
    this.data.scrollExtentMin=config.scrollExtentMin;
    this.data.platformViewId=config.platformViewId;
    this.data.maxValueLength=config.maxValueLength;
    this.data.currentValueLength=config.currentValueLength;
    this.data.headingLevel=config.headingLevel;
    this.data.linkUrl=config.linkUrl;
    this.data.role=config.role;
    this.data.controlsNodes=config.controlsNodes;
    this.data.minValue=config.minValue;
    this.data.maxValue=config.maxValue;
    this.data.validationResult=config.validationResult;
    this.data.hitTestBehavior=config.hitTestBehavior;
    this.data.inputType=config.inputType;
    this.data.flagsCollection=state._flags;this.data.locale=config.locale;this._hintOverrides=config.hintOverrides;this._sortKey=config.sortKey;this._actions=new Map(state._actions);this._customSemanticsActions=new Map(state._customSemanticsActions);this._actionsAsBits=state._actionsAsBits;this._isMultiline=config.isMultiline;this._mergeAllDescendantsIntoThisNode=config.isMergingSemanticsOfDescendants;this.indexInParent=config.indexInParent;this._areUserActionsBlocked=config.isBlockingUserActions;
    this._replaceChildren(childrenInInversePaintOrder??[]);if(mergeChanged)this._updateChildrenMergeFlags();
    if(FoundationBuildMode.debug){invariant(!this._actions.has(SemanticsAction.increase)||(this.value==='')===(this.increasedValue===''),'invalid-semantics-increase','Increase requires both value and increasedValue or neither');invariant(!this._actions.has(SemanticsAction.decrease)||(this.value==='')===(this.decreasedValue===''),'invalid-semantics-decrease','Decrease requires both value and decreasedValue or neither');}
  }
  getSemanticsData():SemanticsData{
    const result:MutableSemanticsData={...this.data,flagsCollection:this.flagsCollection,actions:this._actionsAsBits,tags:this.tags===null?null:new Set(this.tags),rect:this.rect,transform:this.transform};const customIds=new Set<number>();
    const addCustom=(node:SemanticsNode)=>{for(const action of node._customSemanticsActions.keys())customIds.add(CustomSemanticsAction.getIdentifier(action));if(node.hintOverrides?.onTapHint!==null&&node.hintOverrides?.onTapHint!==undefined)customIds.add(CustomSemanticsAction.getIdentifier(CustomSemanticsAction.overridingAction({hint:node.hintOverrides.onTapHint,action:SemanticsAction.tap})));if(node.hintOverrides?.onLongPressHint!==null&&node.hintOverrides?.onLongPressHint!==undefined)customIds.add(CustomSemanticsAction.getIdentifier(CustomSemanticsAction.overridingAction({hint:node.hintOverrides.onLongPressHint,action:SemanticsAction.longPress})));};addCustom(this);
    if(this.mergeAllDescendantsIntoThisNode)this._visitDescendants(node=>{if(FoundationBuildMode.debug)invariant(node.isMergedIntoParent,'unmerged-semantics-descendant','A merge descendant must be merged into its parent');result.flagsCollection=result.flagsCollection.merge(node.flagsCollection);result.actions|=node._effectiveActionsAsBits;
      result.textDirection??=node.data.textDirection;
      result.textSelection??=node.data.textSelection;
      result.scrollChildCount??=node.data.scrollChildCount;
      result.scrollIndex??=node.data.scrollIndex;
      result.scrollPosition??=node.data.scrollPosition;
      result.scrollExtentMax??=node.data.scrollExtentMax;
      result.scrollExtentMin??=node.data.scrollExtentMin;
      result.platformViewId??=node.data.platformViewId;
      result.maxValueLength??=node.data.maxValueLength;
      result.currentValueLength??=node.data.currentValueLength;
      result.linkUrl??=node.data.linkUrl;
      if(result.headingLevel===0)result.headingLevel=node.headingLevel;if(result.identifier==='')result.identifier=node.identifier;result.traversalParentIdentifier??=node.traversalParentIdentifier;result.traversalChildIdentifier??=node.traversalChildIdentifier;
      for(const name of ['attributedValue','attributedIncreasedValue','attributedDecreasedValue'] as const)if(result[name].string==='')result[name]=node.data[name];if(result.role===SemanticsRole.none)result.role=node.role;if(result.inputType===SemanticsInputType.none)result.inputType=node.inputType;if(result.hitTestBehavior===SemanticsHitTestBehavior.defer)result.hitTestBehavior=node.hitTestBehavior;if(result.tooltip==='')result.tooltip=node.tooltip;
      if(node.tags!==null){result.tags??=new Set();for(const tag of node.tags)if(![...result.tags].some(other=>valueEquals(other,tag)))result.tags.add(tag);}addCustom(node);
      result.attributedLabel=concat(result.attributedLabel,node.attributedLabel,result.textDirection,node.textDirection);result.attributedHint=concat(result.attributedHint,node.attributedHint,result.textDirection,node.textDirection);
      if(result.controlsNodes===null)result.controlsNodes=node.controlsNodes;else if(node.controlsNodes!==null)result.controlsNodes=new Set([...result.controlsNodes,...node.controlsNodes]);result.minValue??=node.minValue;result.maxValue??=node.maxValue;
      if(result.validationResult===SemanticsValidationResult.none)result.validationResult=node.validationResult;else if(result.validationResult===SemanticsValidationResult.valid&&node.validationResult!==SemanticsValidationResult.none&&node.validationResult!==SemanticsValidationResult.valid)result.validationResult=node.validationResult;return true;
    });
    if(this._areUserActionsBlocked)result.actions&=unblockedActions;result.customSemanticsActionIds=[...customIds].sort((a,b)=>a-b);return new SemanticsData(result);
  }
  private static computeTraversalTransform(parent:SemanticsNode,child:SemanticsNode):Matrix4{const transform=Matrix4.identity();let parentToAncestor:Matrix4|null=null,from=child,to=parent;while(from!==to){const fromDepth=from.depth,toDepth=to.depth;if(fromDepth>=toDepth){if(from.transform)transform.multiply(from.transform);invariant(from.parent!==null,'unrelated-semantics-traversal','Traversal nodes must share an ancestor');from=from.parent;}if(fromDepth<=toDepth){parentToAncestor??=Matrix4.identity();if(to.transform)parentToAncestor.multiply(to.transform);invariant(to.parent!==null,'unrelated-semantics-traversal','Traversal nodes must share an ancestor');to=to.parent;}}if(parentToAncestor){if(parentToAncestor.invert()!==0)transform.multiply(parentToAncestor);else transform.setZero();}return transform;}
  private _childrenInHitTestOrder():SemanticsNode[]{if(this._children===null)return [];if(FoundationPlatform.hostEnvironment.kind==='web'||this.traversalParentIdentifier!==null)return this._children;return this._children.filter(child=>child.traversalChildIdentifier===null||!!ownerState(this.owner!)._traversalParentNodes.get(child.getSemanticsData().traversalChildIdentifier));}
  private _updateChildrenInTraversalOrder():SemanticsNode[]|null{if(FoundationPlatform.hostEnvironment.kind==='web')return this._children;const result:SemanticsNode[]=[];invariant(this._children!==null,'missing-semantics-children','Traversal requires a child list');for(const child of this._children){if(child.traversalChildIdentifier!==null&&this.traversalParentIdentifier===null){let parent=ownerState(this.owner!)._traversalParentNodes.get(child.getSemanticsData().traversalChildIdentifier)??null;while(parent){invariant(parent!==child,'cyclic-semantics-traversal','A traversal parent cannot be below its traversal child');parent=parent.parent;}continue;}result.push(child);}if(this.traversalParentIdentifier!==null){const children=this.owner?ownerState(this.owner)._traversalChildNodes.get(this.traversalParentIdentifier):undefined;if(children){let node:SemanticsNode=this;while(node.parent){node=node.parent;invariant(!children.has(node),'cyclic-semantics-traversal','A traversal parent cannot be below its traversal child');}for(const child of children)if(child.attached)result.push(child);}}return result;}
  private _childrenInTraversalOrder():SemanticsNode[]{
    let direction=this.textDirection,ancestor=this.parent;while(direction===null&&ancestor!==null){direction=ancestor.textDirection;ancestor=ancestor.parent;}
    const children=this._children,debug=FoundationBuildMode.debug;
    // Plain local children depend only on their relative geometry and inherited
    // direction. Ancestor motion does not require another geometric sort. The
    // source algorithm remains authoritative for sort keys/virtual parents.
    const cacheable=this.constructor===SemanticsNode&&children!==null&&this.traversalParentIdentifier===null&&this.traversalChildIdentifier===null&&children.every(child=>{if(child.constructor!==SemanticsNode||child.rect.constructor!==RectValue||child.sortKey!==null||child.traversalParentIdentifier!==null||child.traversalChildIdentifier!==null)return false;const matrix=child._traversalTransform;return matrix===null||matrix.constructor===Matrix4&&matrix.transform3===semanticsTransform3;});
    if(cacheable){const cached=this.traversalOrderCache;
      if(cached&&cached.direction===direction&&cached.debug===debug&&cached.geometry.length===children.length){let same=true;
        for(let index=0;index<children.length&&same;index++){const child=children[index]!,previous=cached.geometry[index]!,transform=child._traversalTransform,matrix=transform===null?null:numericObjectStorage(transform,'Matrix4');
          if(previous.node!==child||previous.rect!==child.rect||(matrix===null)!==(previous.transform===null)){same=false;break;}
          if(matrix&&previous.transform)for(let item=0;item<16;item++)if(!Object.is(matrix[item],previous.transform[item])){same=false;break;}
        }
        if(same)return [...cached.order];
      }
    }else this.traversalOrderCache=undefined;
    const updated=this._updateChildrenInTraversalOrder();invariant(updated!==null,'missing-semantics-children','Traversal requires a child list');
    const defaults=direction===null?updated:semanticsChildrenInDefaultOrder(updated,direction);let order:SemanticsNode[];
    if(cacheable)order=[...defaults]; // Every local sort key is already null.
    else{const result:_TraversalSortNode[]=[],group:_TraversalSortNode[]=[];let last:SemanticsSortKey|null=null;for(let position=0;position<defaults.length;position++){const child=defaults[position]!,key=child.sortKey;last=position>0?defaults[position-1]!.sortKey:null;const compatible=position===0||key?.constructor===last?.constructor&&(key===null||key.name===last!.name);if(!compatible&&group.length){if(last!==null)group.sort((a,b)=>a.compareTo(b));result.push(...group);group.length=0;}group.push(new _TraversalSortNode(child,key,position));}if(last!==null)group.sort((a,b)=>a.compareTo(b));result.push(...group);order=result.map(item=>item.node);}
    if(cacheable)this.traversalOrderCache={direction,debug,geometry:children.map(node=>({node,rect:node.rect,transform:node._traversalTransform===null?null:Array.from(numericObjectStorage(node._traversalTransform,'Matrix4'))})),order:[...order]};
    return order;
  }
  private _addToUpdate(builder:SemanticsUpdateBuilder|null,custom:Set<number>):void{
    if(FoundationBuildMode.debug){invariant(this._dirty,'clean-semantics-update','Only dirty nodes produce updates');const error=_DebugSemanticsRoleChecks.check(this);if(error!==null)throw error;}
    const state=this.owner?ownerState(this.owner):null;
    if(this.traversalChildIdentifier!==null){this.traversalParent=state?._traversalParentNodes.get(this.traversalChildIdentifier)??null;if(FoundationPlatform.hostEnvironment.kind!=='web'){invariant(this.traversalParent!==null,'missing-semantics-traversal-parent','Traversal child requires a parent');this._traversalChildTransform=SemanticsNode.computeTraversalTransform(this.traversalParent,this);}}
    // A host-tree consumer reads these live nodes after the flush. Preserve
    // owner/traversal bookkeeping without serializing an unused engine packet.
    if(builder===null){this._dirty=false;return;}
    const data=this.getSemanticsData();let traversal:number[]=[],hit:number[]=[];
    if(!this.hasChildren||this.mergeAllDescendantsIntoThisNode){if(this.traversalParentIdentifier!==null&&FoundationPlatform.hostEnvironment.kind!=='web'){const children=state?._traversalChildNodes.get(this.traversalParentIdentifier);if(children){traversal=Array(children.size).fill(0);let index=0;for(const child of children)if(child.attached)traversal[index++]=child.id;}}}else{traversal=this._childrenInTraversalOrder().map(node=>node.id);hit=[...this._childrenInHitTestOrder()].reverse().map(node=>node.id);}
    for(const id of data.customSemanticsActionIds??[])custom.add(id);const traversalParentId=data.traversalChildIdentifier!==null?state?._traversalParentNodes.get(data.traversalChildIdentifier)?.id??-1:-1;
    builder.updateNode({id:this.id,flags:data.flagsCollection,actions:data.actions,rect:data.rect,identifier:data.identifier,label:data.label,labelAttributes:data.attributedLabel.attributes,value:data.value,valueAttributes:data.attributedValue.attributes,increasedValue:data.increasedValue,increasedValueAttributes:data.attributedIncreasedValue.attributes,decreasedValue:data.decreasedValue,decreasedValueAttributes:data.attributedDecreasedValue.attributes,hint:data.hint,hintAttributes:data.attributedHint.attributes,tooltip:data.tooltip,textDirection:data.textDirection,textSelectionBase:data.textSelection?.baseOffset??-1,textSelectionExtent:data.textSelection?.extentOffset??-1,platformViewId:data.platformViewId??-1,maxValueLength:data.maxValueLength??-1,currentValueLength:data.currentValueLength??-1,scrollChildren:data.scrollChildCount??0,scrollIndex:data.scrollIndex??0,scrollPosition:data.scrollPosition??NaN,scrollExtentMax:data.scrollExtentMax??NaN,scrollExtentMin:data.scrollExtentMin??NaN,transform:(this._traversalTransform??Matrix4.identity()).storage,traversalParent:traversalParentId,hitTestTransform:(data.transform??Matrix4.identity()).storage,childrenInTraversalOrder:Int32Array.from(traversal),childrenInHitTestOrder:Int32Array.from(hit),additionalActions:Int32Array.from(data.customSemanticsActionIds??[]),headingLevel:data.headingLevel,linkUrl:data.linkUrl??'',role:data.role,controlsNodes:data.controlsNodes===null?null:[...data.controlsNodes],validationResult:data.validationResult,hitTestBehavior:data.hitTestBehavior,inputType:data.inputType,locale:data.locale,minValue:data.minValue??'',maxValue:data.maxValue??''});this._dirty=false;
  }
  sendEvent(event:SemanticsEvent):void {
    if(!this.attached)return;
    void ownerState(this.owner!).accessibility.send(event.toMap({nodeId:this.id})).then(()=>{},error=>{
      FlutterError.reportError(new FlutterErrorDetails({exception:error,stack:exceptionStack(error),library:'semantics library',context:new ErrorDescription('while sending accessibility event'),informationCollector:()=>[new DiagnosticsProperty('event',event),new DiagnosticsProperty('node',this)]}));
    });
  }
  override toStringShort():string{return objectRuntimeType(this,'SemanticsNode')+'#'+this.id;}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void {
    super.debugFillProperties(properties);
    let hideOwner=true;
    if(this._dirty){const inDirtyNodes=this.owner!==null&&ownerState(this.owner)._dirtyNodes.has(this);properties.add(new FlagProperty('inDirtyNodes',inDirtyNodes,{ifTrue:'dirty',ifFalse:'STALE'}));hideOwner=inDirtyNodes;}
    properties.add(new DiagnosticsProperty('owner',this.owner,{level:hideOwner?'hidden':'info'}));
    properties.add(new FlagProperty('isMergedIntoParent',this.isMergedIntoParent,{ifTrue:'merged up ⬆️'}));
    properties.add(new FlagProperty('mergeAllDescendantsIntoThisNode',this.mergeAllDescendantsIntoThisNode,{ifTrue:'merge boundary ⛔️'}));
    if(this.data.locale!==null)properties.add(new StringProperty('locale',this.data.locale.toString()));
    const offset=this.transform===null?null:MatrixUtils.getAsTranslation(this.transform);
    if(offset!==null)properties.add(new DiagnosticsProperty('rect',this.rect.shift(offset),{showName:false}));
    else {
      const scale=this.transform===null?null:MatrixUtils.getAsScale(this.transform);let description:string|undefined;
      if(scale!==null)description=`${this.rect} scaled by ${fixed(scale)}x`;
      else if(this.transform!==null&&!MatrixUtils.isIdentity(this.transform)){const matrix=this.transform.toString().split('\n').slice(0,4).map(line=>line.slice(4)).join('; ');description=`${this.rect} with transform [${matrix}]`;}
      properties.add(new DiagnosticsProperty('rect',this.rect,{...(description===undefined?{}:{description}),showName:false}));
    }
    properties.add(new IterableProperty('tags',this.tags===null?null:[...this.tags].map(tag=>tag.name),{defaultValue:null}));
    const actions=[...this._actions.keys()].map(action=>action.name+(FoundationBuildMode.debug&&(this._effectiveActionsAsBits&action.index)===0?'🚫️':'')).sort();
    properties.add(new IterableProperty('actions',actions,{ifEmpty:null}));
    properties.add(new IterableProperty('customActions',[...this._customSemanticsActions.keys()].map(action=>action.label),{ifEmpty:null}));
    properties.add(new IterableProperty('flags',this.flagsCollection.toStrings(),{ifEmpty:null}));
    properties.add(new FlagProperty('isInvisible',this.isInvisible,{ifTrue:'invisible'}));
    properties.add(new FlagProperty('isHidden',this.flagsCollection.isHidden,{ifTrue:'HIDDEN'}));
    properties.add(new StringProperty('identifier',this.identifier,{defaultValue:''}));
    properties.add(new DiagnosticsProperty('traversalParentIdentifier',this.traversalParentIdentifier,{defaultValue:null}));
    properties.add(new DiagnosticsProperty('traversalChildIdentifier',this.traversalChildIdentifier,{defaultValue:null}));
    for(const name of ['label','value','increasedValue','decreasedValue','hint'] as const){const key=({label:'attributedLabel',value:'attributedValue',increasedValue:'attributedIncreasedValue',decreasedValue:'attributedDecreasedValue',hint:'attributedHint'} as const)[name];properties.add(new AttributedStringProperty(name,this.data[key]));}
    properties.add(new StringProperty('tooltip',this.tooltip,{defaultValue:''}));
    properties.add(new EnumProperty('textDirection',this.textDirection,{defaultValue:null}));
    if(this.role!==SemanticsRole.none)properties.add(new EnumProperty('role',this.role));
    properties.add(new DiagnosticsProperty('sortKey',this.sortKey,{defaultValue:null}));
    if(this.textSelection?.isValid)properties.add(new MessageProperty('text selection',`[${this.textSelection.start}, ${this.textSelection.end}]`));
    for(const name of ['platformViewId','maxValueLength','currentValueLength','scrollChildCount','scrollIndex'] as const)properties.add(new IntProperty(name==='scrollChildCount'?'scrollChildren':name,this[name],{defaultValue:null}));
    for(const name of ['scrollExtentMin','scrollPosition','scrollExtentMax'] as const)properties.add(new DoubleProperty(name,this[name],{defaultValue:null}));
    properties.add(new IntProperty('indexInParent',this.indexInParent,{defaultValue:null}));
    properties.add(new IntProperty('headingLevel',this.headingLevel,{defaultValue:0}));
    if(this.inputType!==SemanticsInputType.none)properties.add(new EnumProperty('inputType',this.inputType));
    if(this.validationResult!==SemanticsValidationResult.none)properties.add(new EnumProperty('validationResult',this.validationResult,{defaultValue:SemanticsValidationResult.none}));
    properties.add(new StringProperty('minValue',this.minValue,{defaultValue:null}));
    properties.add(new StringProperty('maxValue',this.maxValue,{defaultValue:null}));
  }
  override debugDescribeChildren({childOrder=DebugSemanticsDumpOrder.traversalOrder}:{readonly childOrder?:DebugSemanticsDumpOrder}={}):readonly DiagnosticsNode[]{return this.debugListChildrenInOrder(childOrder).map(node=>node.toDiagnosticsNode({childOrder}));}
  debugListChildrenInOrder(order:DebugSemanticsDumpOrder):SemanticsNode[]{if(this._children===null)return [];return order===DebugSemanticsDumpOrder.inverseHitTest?this._childrenInHitTestOrder():this._childrenInTraversalOrder();}
  override toDiagnosticsNode({childOrder=DebugSemanticsDumpOrder.traversalOrder,...options}:DiagnosticsOptions&{readonly childOrder?:DebugSemanticsDumpOrder}={}):DiagnosticsNode{return new _SemanticsDiagnosticableNode(this,childOrder,{style:'sparse',...options});}
  override toStringDeep({childOrder=DebugSemanticsDumpOrder.traversalOrder,...options}:DiagnosticsStringOptions&{readonly childOrder?:DebugSemanticsDumpOrder}={}):string{return this.toDiagnosticsNode({childOrder}).toStringDeep({minLevel:'debug',wrapWidth:65,...options});}
  toJson():Record<string,unknown>{return {id:this.id,...this.getSemanticsData().toJson(),childrenInTraversalOrder:this.debugListChildrenInOrder(DebugSemanticsDumpOrder.traversalOrder).map(child=>child.id),childrenInHitTestOrder:this.debugListChildrenInOrder(DebugSemanticsDumpOrder.inverseHitTest).map(child=>child.id)};}
}
class _SemanticsDiagnosticableNode extends DiagnosticableNode<SemanticsNode>{constructor(value:SemanticsNode,private readonly childOrder:DebugSemanticsDumpOrder,options:DiagnosticsOptions){super(value,options);}override getChildren():readonly DiagnosticsNode[]{return this.value.debugDescribeChildren({childOrder:this.childOrder});}}
function semanticsCompareNumber(a:number,b:number):number{if(a===b)return a===0&&Object.is(a,-0)!==Object.is(b,-0)?Object.is(a,-0)?-1:1:0;if(Number.isNaN(a))return Number.isNaN(b)?0:1;if(Number.isNaN(b))return -1;return a<b?-1:1;}
class _BoxEdge {constructor(readonly isLeadingEdge:boolean,readonly offset:number,readonly node:SemanticsNode){if(FoundationBuildMode.debug)invariant(Number.isFinite(offset),'nonfinite-semantics-edge','Semantics box edge must be finite');}compareTo(other:_BoxEdge):number{return semanticsCompareNumber(this.offset,other.offset);}}
const semanticsTransform3=Matrix4.prototype.transform3;
function semanticsPointInParent(node:SemanticsNode,point:Offset):Offset{
  const matrix=nodeState(node)._traversalTransform;if(matrix===null)return point;
  if(matrix.constructor===Matrix4&&matrix.transform3===semanticsTransform3){
    // Match transform3's private storage and arithmetic, including z*0. A
    // projected point needs neither a mutable vector nor its numeric sidecar.
    const m=numericObjectStorage(matrix,'Matrix4'),x=point.dx,y=point.dy;
    return new Offset(m[0]!*x+m[4]!*y+m[8]!*0+m[12]!,m[1]!*x+m[5]!*y+m[9]!*0+m[13]!);
  }
  const vector=new Vector3(point.dx,point.dy,0);matrix.transform3(vector);return new Offset(vector.x,vector.y);
}
class _SemanticsSortGroup {
  readonly nodes:SemanticsNode[]=[];
  constructor(readonly startOffset:number,readonly direction:'ltr'|'rtl'){}
  compareTo(other:_SemanticsSortGroup):number{return semanticsCompareNumber(this.startOffset,other.startOffset);}
  sortedWithinVerticalGroup():SemanticsNode[]{const edges:_BoxEdge[]=[];for(const child of this.nodes){const rect=child.rect.deflate(.1);edges.push(new _BoxEdge(true,semanticsPointInParent(child,rect.topLeft).dx,child),new _BoxEdge(false,semanticsPointInParent(child,rect.bottomRight).dx,child));}edges.sort((a,b)=>a.compareTo(b));let group:_SemanticsSortGroup|null=null,depth=0;const groups:_SemanticsSortGroup[]=[];for(const edge of edges){if(edge.isLeadingEdge){depth++;group??=new _SemanticsSortGroup(edge.offset,this.direction);group.nodes.push(edge.node);}else depth--;if(depth===0){invariant(group!==null,'missing-semantics-sort-group','Missing semantics overlap group');groups.push(group);group=null;}}groups.sort((a,b)=>a.compareTo(b));if(this.direction==='rtl')groups.reverse();return groups.flatMap(group=>group.sortedWithinKnot());}
  sortedWithinKnot():SemanticsNode[]{if(this.nodes.length<=1)return this.nodes;
    const stable=this.nodes.every(node=>{if(node.constructor!==SemanticsNode||node.rect.constructor!==RectValue)return false;const matrix=nodeState(node)._traversalTransform;return matrix===null||matrix.constructor===Matrix4&&matrix.transform3===semanticsTransform3;});
    const centers=stable?new Map(this.nodes.map(node=>[node,semanticsPointInParent(node,node.rect.center)])):null;
    const nodes=new Map<number,SemanticsNode>(),edges=new Map<number,number>();for(const node of this.nodes){nodes.set(node.id,node);const center=centers?.get(node)??semanticsPointInParent(node,node.rect.center);for(const next of this.nodes){if(node===next||edges.get(next.id)===node.id)continue;const nextCenter=centers?.get(next)??semanticsPointInParent(next,next.rect.center),direction=Math.atan2(nextCenter.dy-center.dy,nextCenter.dx-center.dx);if(this.direction==='ltr'&&-Math.PI/4<direction&&direction<3*Math.PI/4||this.direction==='rtl'&&(direction< -3*Math.PI/4||direction>3*Math.PI/4))edges.set(node.id,next.id);}}
    const corners=stable?new Map(this.nodes.map(node=>[node,semanticsPointInParent(node,node.rect.topLeft)])):null;
    const sorted:number[]=[],visited=new Set<number>(),start=[...this.nodes].sort((a,b)=>{const left=corners?.get(a)??semanticsPointInParent(a,a.rect.topLeft),right=corners?.get(b)??semanticsPointInParent(b,b.rect.topLeft),vertical=semanticsCompareNumber(left.dy,right.dy);return vertical!==0?-vertical:-semanticsCompareNumber(left.dx,right.dx);});const search=(id:number)=>{if(visited.has(id))return;visited.add(id);if(edges.has(id))search(edges.get(id)!);sorted.push(id);};for(const node of start)search(node.id);return sorted.map(id=>nodes.get(id)!).reverse();
  }
}
function semanticsChildrenInDefaultOrder(children:SemanticsNode[],direction:'ltr'|'rtl'):SemanticsNode[]{const edges:_BoxEdge[]=[];for(const child of children){if(FoundationBuildMode.debug)invariant(child.rect.isFinite,'nonfinite-semantics-rect','Semantics child rect must be finite');const rect=child.rect.deflate(.1);edges.push(new _BoxEdge(true,semanticsPointInParent(child,rect.topLeft).dy,child),new _BoxEdge(false,semanticsPointInParent(child,rect.bottomRight).dy,child));}edges.sort((a,b)=>a.compareTo(b));const groups:_SemanticsSortGroup[]=[];let group:_SemanticsSortGroup|null=null,depth=0;for(const edge of edges){if(edge.isLeadingEdge){depth++;group??=new _SemanticsSortGroup(edge.offset,direction);group.nodes.push(edge.node);}else depth--;if(depth===0){invariant(group!==null,'missing-semantics-sort-group','Missing semantics overlap group');groups.push(group);group=null;}}groups.sort((a,b)=>a.compareTo(b));return groups.flatMap(group=>group.sortedWithinVerticalGroup());}
class _TraversalSortNode {constructor(readonly node:SemanticsNode,readonly sortKey:SemanticsSortKey|null,readonly position:number){}compareTo(other:_TraversalSortNode):number{return this.sortKey===null||other.sortKey===null?this.position-other.position:this.sortKey.compareTo(other.sortKey);}}
export interface SemanticsOwnerOptions {
  readonly onSemanticsUpdate:SemanticsUpdateCallback;
  /** Return null when the embedding consumes the live host tree instead of engine packets. */
  readonly createSemanticsUpdateBuilder?:()=>SemanticsUpdateBuilder|null;
  readonly messenger?:BinaryMessenger;
}
/** Source owner with an explicit app-owned builder factory instead of a global binding. */
export class SemanticsOwner extends ChangeNotifier {
  readonly onSemanticsUpdate:SemanticsUpdateCallback;
  /** Explicit application channel; the default realm retains source API behavior. */
  private readonly accessibility:BasicMessageChannel<unknown>;
  private readonly createBuilder:()=>SemanticsUpdateBuilder|null;
  private readonly _dirtyNodes=new Set<SemanticsNode>();
  private readonly _nodes=new Map<number,SemanticsNode>();
  private readonly _detachedNodes=new Set<SemanticsNode>();
  private readonly _traversalParentNodes=new Map<unknown,SemanticsNode>();
  private readonly _traversalChildNodes=new Map<unknown,Set<SemanticsNode>>();
  constructor({onSemanticsUpdate,createSemanticsUpdateBuilder=()=>new SemanticsUpdateBuilder(),messenger}:SemanticsOwnerOptions){super();this.onSemanticsUpdate=onSemanticsUpdate;this.createBuilder=createSemanticsUpdateBuilder;this.accessibility=messenger?new SystemChannelSet(messenger).accessibility:SystemChannels.accessibility;protect(this,['onSemanticsUpdate','accessibility']);}
  get rootSemanticsNode():SemanticsNode|null{return this._nodes.get(0)??null;}
  /** @internal Direct source-node changes also invalidate host snapshots. */
  get hasPendingUpdates():boolean{return this._dirtyNodes.size>0||this._detachedNodes.size>0;}
  getSemanticsNode(id:number):SemanticsNode|null{return this._nodes.get(id)??null;}
  override dispose():void{this._dirtyNodes.clear();this._nodes.clear();this._detachedNodes.clear();this._traversalChildNodes.clear();this._traversalParentNodes.clear();super.dispose();}
  sendSemanticsUpdate():void{
    if(FoundationBuildMode.debug){const invisible:SemanticsNode[]=[];const find=(node:SemanticsNode):boolean=>{if(node.rect.isEmpty)invisible.push(node);else if(!node.mergeAllDescendantsIntoThisNode)node.visitChildren(find);return true;};const root=this.rootSemanticsNode;if(root){if(root.childrenCount>0&&root.rect.isEmpty)invisible.push(root);else if(!root.mergeAllDescendantsIntoThisNode)root.visitChildren(find);}invariant(invisible.length===0,'invisible-semantics-nodes','Invisible SemanticsNodes should not be added to the tree');}
    if(this._dirtyNodes.size===0)return;const custom=new Set<number>(),visited:SemanticsNode[]=[];
    while(this._dirtyNodes.size){const local=[...this._dirtyNodes].filter(node=>!this._detachedNodes.has(node));this._dirtyNodes.clear();this._detachedNodes.clear();local.sort((a,b)=>a.depth-b.depth);visited.push(...local);for(const node of local){const state=nodeState(node);if(FoundationBuildMode.debug){invariant(state._dirty,'clean-semantics-update','Dirty set contains a clean node');invariant(node.parent===null||!node.parent.isPartOfNodeMerging||node.isMergedIntoParent,'invalid-semantics-merge','Merge descendant has inconsistent flags');}if(node.isPartOfNodeMerging){if(FoundationBuildMode.debug)invariant(node.mergeAllDescendantsIntoThisNode||node.parent!==null,'orphaned-semantics-merge','Merged node requires a parent');if(node.parent?.isPartOfNodeMerging){nodeState(node.parent)._markDirty();state._dirty=false;}}
        for(const [key,old]of this._traversalParentNodes)if(old===node)this._traversalParentNodes.delete(key);for(const [key,children]of this._traversalChildNodes){children.delete(node);if(children.size===0)this._traversalChildNodes.delete(key);}
        if(node.traversalParentIdentifier!==null){if(FoundationBuildMode.debug)invariant(!this._traversalParentNodes.has(node.traversalParentIdentifier)||this._traversalParentNodes.get(node.traversalParentIdentifier)===node,'duplicate-semantics-traversal-parent','Traversal parent identifiers must be unique');this._traversalParentNodes.set(node.traversalParentIdentifier,node);}else if(node.traversalChildIdentifier!==null){const children=this._traversalChildNodes.get(node.traversalChildIdentifier)??new Set();children.add(node);this._traversalChildNodes.set(node.traversalChildIdentifier,children);}
        if(FoundationPlatform.hostEnvironment.kind!=='web'&&node.traversalChildIdentifier!==null){const parent=this._traversalParentNodes.get(node.traversalChildIdentifier);if(parent&&!visited.includes(parent))nodeState(parent)._markDirty();}
      }
    }
    visited.sort((a,b)=>a.depth-b.depth);const builder=this.createBuilder();for(const node of visited){if(FoundationBuildMode.debug)invariant(node.parent===null||!nodeState(node.parent)._dirty,'dirty-semantics-parent','A parent must update before its child');if(nodeState(node)._dirty&&node.attached)nodeState(node)._addToUpdate(builder,custom);}this._dirtyNodes.clear();if(builder!==null){for(const id of custom){const action=CustomSemanticsAction.getAction(id);invariant(action!==null,'unknown-custom-semantics-action','Unknown custom semantics action');builder.updateCustomAction({id,label:action.label,hint:action.hint,overrideId:action.action?.index??-1});}this.onSemanticsUpdate(builder.build());}this.notifyListeners();
  }
  private handlerForId(id:number,action:SemanticsAction,args:unknown):SemanticsActionHandler|null{let result=this._nodes.get(id)??null;if(result===null)return null;if(result.isPartOfNodeMerging&&!nodeState(result)._canHandleAction(action,args)){let found:SemanticsNode|null=null;nodeState(result)._visitDescendants(node=>{if(nodeState(node)._canHandleAction(action,args)){found=node;return false;}return true;});result=found;}return result!==null&&nodeState(result)._canHandleAction(action,args)?nodeState(result)._actions.get(action)??null:null;}
  performAction(id:number,action:SemanticsAction,args:unknown=null):void{const handler=this.handlerForId(id,action,args);if(handler!==null){handler(args);return;}if(action===SemanticsAction.showOnScreen){const node=this._nodes.get(id);if(node)nodeState(node)._showOnScreen?.();}}
  private handlerForPosition(node:SemanticsNode,position:Offset,action:SemanticsAction,args:unknown):SemanticsActionHandler|null{if(node.transform!==null){const inverse=Matrix4.identity();if(inverse.copyInverse(node.transform)===0)return null;position=MatrixUtils.transformPoint(inverse,position);}if(!node.rect.contains(position))return null;if(node.mergeAllDescendantsIntoThisNode){if(nodeState(node)._canHandleAction(action,args))return nodeState(node)._actions.get(action)??null;let result:SemanticsNode|null=null;nodeState(node)._visitDescendants(child=>{if(nodeState(child)._canHandleAction(action,args)){result=child;return false;}return true;});return result===null?null:nodeState(result)._actions.get(action)??null;}for(const child of [...nodeState(node)._children??[]].reverse()){const handler=this.handlerForPosition(child,position,action,args);if(handler!==null)return handler;}return nodeState(node)._actions.get(action)??null;}
  performActionAt(position:Offset,action:SemanticsAction,args:unknown=null):void{const root=this.rootSemanticsNode;if(root===null)return;this.handlerForPosition(root,position,action,args)?.(args);}
}
