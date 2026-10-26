// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// M3 field composition. Core owns the editor, focus, formatting and controller.
import {StatefulWidget,State,Element} from '@nelyx/core/framework/widgets/framework';
import type {Widget,WidgetOptions,BuildContext} from '@nelyx/core/framework/widgets/framework';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import type {EditableTextOptions,EditableTextState} from '@nelyx/core/framework/widgets/editable-text';
import {materialTextSelectionHandleControls,desktopTextSelectionHandleControls} from './text-selection.ts';
import {cupertinoTextSelectionHandleControls,cupertinoDesktopTextSelectionHandleControls} from '@nelyx/cupertino/text-selection';
import {AdaptiveTextSelectionToolbar} from './adaptive-text-selection-toolbar.ts';
import {TextMagnifier} from './magnifier.ts';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {Directionality} from '@nelyx/core/framework/widgets/app-data';
import {ExcludeFocus} from '@nelyx/core/framework/widgets/focus-scope';
import {TextFieldTapRegion} from '@nelyx/core/framework/widgets/tap-region';
import {GestureDetector} from '@nelyx/core/framework/widgets/gesture-detector';
import {MouseRegion} from '@nelyx/core/framework/widgets/mouse-region';
import {HitTestBehavior} from '@nelyx/core/framework/rendering/pointer-listener';
import {validateEditableLinePolicy} from '@nelyx/core/framework/rendering/editable';
import {SystemMouseCursors} from '@nelyx/core/services/mouse-cursor';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import type {TextAlignVertical} from '@nelyx/core/framework/painting/text-align-vertical';
import type {TextAlign} from '@nelyx/core/ui/typography';
import type {TextInputAction} from '@nelyx/core/hosting/interaction';
import type {EditingKeyboardType,EditingCapitalization} from '@nelyx/core/hosting/interaction';
import {LengthLimitingTextInputFormatter} from '@nelyx/core/services/input-formatters';
import type {TextInputFormatter} from '@nelyx/core/services/input-formatters';
import {graphemeBoundaries} from '@nelyx/core/foundation/grapheme-boundaries';
import {WidgetState,WidgetStateTextStyle} from '@nelyx/core/framework/widgets/widget-state';
import {emptyWidgetStateSet} from '@nelyx/core/framework/widgets/widget-state';
import {Color} from '@nelyx/core/ui/color';
import {invariant} from '@nelyx/core/foundation/errors';
import {DiagnosticPropertiesBuilder,DiagnosticsProperty} from '@nelyx/core/foundation/diagnostics';
import {InputDecoration} from './input-decoration.ts';
import {InputDecorator} from './input-decorator.ts';
import {Theme} from './theme.ts';
import {TextSelectionTheme} from './text-selection-theme.ts';

/** M3 field composed with shared Core/Skia layout and editing state. */
export interface TextFieldOptions extends WidgetOptions {
  readonly id:string;readonly controller?:TextEditingController|null;readonly focusNode?:FocusNode|null;
  readonly groupId?:EditableTextOptions['groupId'];readonly onTapOutside?:EditableTextOptions['onTapOutside'];readonly onTapUpOutside?:EditableTextOptions['onTapUpOutside'];
  readonly decoration?:InputDecoration|null;readonly style?:TextStyle|null;readonly textAlign?:TextAlign;readonly textAlignVertical?:TextAlignVertical|null;readonly textDirection?:'ltr'|'rtl';
  readonly enabled?:boolean|null;readonly readOnly?:boolean;readonly autofocus?:boolean;readonly obscureText?:boolean;readonly autocorrect?:boolean;readonly enableSuggestions?:boolean;
  readonly keyboardType?:EditingKeyboardType;readonly textCapitalization?:EditingCapitalization;readonly autofillHints?:readonly string[]|null;readonly textInputAction?:TextInputAction;
  readonly inputFormatters?:readonly TextInputFormatter[];readonly maxLength?:number|null;
  readonly minLines?:number|null;readonly maxLines?:number|null;readonly expands?:boolean;
  readonly scrollController?:EditableTextOptions['scrollController'];readonly scrollPhysics?:EditableTextOptions['scrollPhysics'];
  readonly cursorColor?:Color|null;readonly cursorErrorColor?:Color|null;
  readonly cursorWidth?:number;readonly cursorHeight?:number;readonly strutStyle?:EditableTextOptions['strutStyle'];readonly textScaler?:EditableTextOptions['textScaler'];
  readonly enableInteractiveSelection?:boolean|null;readonly selectionControls?:EditableTextOptions['selectionControls'];readonly contextMenuBuilder?:EditableTextOptions['contextMenuBuilder'];readonly magnifierConfiguration?:EditableTextOptions['magnifierConfiguration'];
  readonly onChanged?:(text:string)=>void;readonly onEditingComplete?:()=>void;readonly onSubmitted?:(text:string)=>void;readonly onTap?:()=>void;
  readonly buildCounter?:((context:BuildContext,details:{readonly currentLength:number;readonly maxLength:number|null;readonly isFocused:boolean})=>Widget|null)|null;
}
export class TextField extends StatefulWidget {
  get enableInteractiveSelection():boolean{return this.options.enableInteractiveSelection??(!this.options.readOnly||!this.options.obscureText);}
  get selectionEnabled():boolean{return this.enableInteractiveSelection;}
  static defaultContextMenuBuilder(_context:BuildContext,state:EditableTextState):Widget{return AdaptiveTextSelectionToolbar.buttonItems({anchors:state.contextMenuAnchors,buttonItems:state.contextMenuButtonItems});}
  static readonly noMaxLength=-1;
  readonly options:Readonly<TextFieldOptions>;
  constructor(options:TextFieldOptions){
    super(options.key??null);invariant(options.groupId!==null,'invalid-editor-group','TextField groupId must not be null');invariant(typeof options.id==='string'&&options.id.length>0,'invalid-editor-id','TextField requires a stable editor id');
    invariant(options.maxLength==null||options.maxLength===TextField.noMaxLength||Number.isSafeInteger(options.maxLength)&&options.maxLength>0,'invalid-text-limit','TextField maxLength must be positive or noMaxLength');
    invariant(options.decoration==null||options.decoration instanceof InputDecoration,'invalid-input-decoration','TextField decoration must be canonical');
    const maxLines=options.maxLines===undefined?1:options.maxLines;
    validateEditableLinePolicy({maxLines,minLines:options.minLines??null,expands:options.expands??false});
    invariant(!options.obscureText||maxLines===1,'obscured-multiline-editor','Obscured fields must be single-line');
    this.options=Object.freeze({...options,...(options.inputFormatters?{inputFormatters:Object.freeze([...options.inputFormatters])}:{}),...(options.autofillHints?{autofillHints:Object.freeze([...options.autofillHints])}:{})});
  }
  get enabled():boolean{return this.options.enabled??this.options.decoration?.enabled??true;}
  get groupId():NonNullable<unknown>{return this.options.groupId??EditableText;}
  get id():string{return this.options.id;}
  get controller():TextEditingController|null{return this.options.controller??null;}
  get focusNode():FocusNode|null{return this.options.focusNode??null;}
  get decoration():InputDecoration|null{return this.options.decoration===undefined?new InputDecoration():this.options.decoration;}
  get minLines():number|null{return this.options.minLines??null;}
  get maxLines():number|null{return this.options.maxLines===undefined?1:this.options.maxLines;}
  get expands():boolean{return this.options.expands??false;}
  override createState():State<TextField>{return new TextFieldState();}
  override debugFillProperties(properties:DiagnosticPropertiesBuilder):void{super.debugFillProperties(properties);for(const name of ['id','controller','focusNode','decoration','style','readOnly','maxLength'] as const)properties.add(new DiagnosticsProperty(name,this.options[name]??null));for(const name of ['enabled','minLines','maxLines','expands'] as const)properties.add(new DiagnosticsProperty(name,this[name]));}
}
class TextFieldState extends State<TextField> {
  private readonly editorKey=new GlobalKey('Material TextField editor');
  private controller!:TextEditingController;private ownsController=false;private focus!:FocusNode;private ownsFocus=false;
  private hovering=false;private queued=false;
  private readonly changed=()=>{
    if(!this.mounted||!(this.context instanceof Element)||!this.context.active)return;
    if(this.context.owner.building){if(!this.queued){this.queued=true;this.context.owner.postFrame(()=>{this.queued=false;if(this.mounted&&this.context instanceof Element&&this.context.active)this.setState(()=>{});});}}else this.setState(()=>{});
  };
  private connectController(previous?:TextEditingController):void{this.ownsController=this.widget.options.controller==null;this.controller=this.widget.options.controller??new TextEditingController(previous?.text??'');if(this.ownsController&&previous){this.controller.selection=previous.selection;this.controller.clearHistory();}this.controller.addListener(this.changed);}
  private connectFocus():void{this.ownsFocus=this.widget.options.focusNode==null;this.focus=this.widget.options.focusNode??new FocusNode();this.focus.addListener(this.changed);}
  override initState():void{super.initState();this.connectController();this.connectFocus();}
  override didUpdateWidget(old:TextField):void{
    super.didUpdateWidget(old);const context=this.context;invariant(context instanceof Element,'invalid-field-context','TextField requires an Element');
    if(old.controller!==this.widget.controller){const previous=this.controller,owned=this.ownsController;previous.removeListener(this.changed);this.connectController(previous);if(owned)context.owner.postFrame(()=>previous.dispose());}
    if(old.focusNode!==this.widget.focusNode){const previous=this.focus,owned=this.ownsFocus;previous.removeListener(this.changed);this.connectFocus();if(owned)context.owner.postFrame(()=>previous.dispose());}
  }
  override dispose():void{try{this.controller.removeListener(this.changed);this.focus.removeListener(this.changed);if(this.ownsController)this.controller.dispose();if(this.ownsFocus)this.focus.dispose();}finally{super.dispose();}}
  build(context:BuildContext):Widget {
    const o=this.widget.options,theme=Theme.of(context),selection=TextSelectionTheme.of(context),enabled=this.widget.enabled,states=emptyWidgetStateSet();
    if(!enabled)states.add(WidgetState.disabled);if(this.focus.hasFocus)states.add(WidgetState.focused);if(this.hovering)states.add(WidgetState.hovered);
    let decoration=o.decoration===undefined?new InputDecoration():o.decoration;
    const hasError=decoration?.error!=null||decoration?.errorText!=null;if(hasError)states.add(WidgetState.error);
    const given=o.style instanceof WidgetStateTextStyle?o.style.resolve(states):o.style;
    const style=(theme.textTheme.bodyLarge??new TextStyle({fontSize:16})).copyWith({color:enabled?theme.colorScheme.onSurface:new Color(theme.colorScheme.onSurface).withOpacity(.38).toARGB32()}).merge(given);
    const currentLength=graphemeBoundaries(this.controller.text).length-1,maxLength=o.maxLength??null;
    if(decoration){
      decoration=decoration.copyWith({enabled});
      if(decoration.counter===null&&decoration.counterText===null){
        if(o.buildCounter){const counter=o.buildCounter(context,{currentLength,maxLength,isFocused:this.focus.hasFocus});decoration=counter?decoration.copyWith({counter}):decoration;}
        else if(maxLength!==null)decoration=decoration.copyWith({counterText:maxLength===TextField.noMaxLength?String(currentLength):`${currentLength}/${maxLength}`,semanticCounterText:maxLength===TextField.noMaxLength?String(currentLength):`${currentLength} of ${maxLength}`});
      }
    }
    const formatters=[...(o.inputFormatters??[]),...(maxLength!==null&&maxLength>0?[new LengthLimitingTextInputFormatter(maxLength)]:[])];
    const editor=new EditableText(o.id,this.controller,decoration?.labelText??decoration?.hintText??'',this.focus,0,this.editorKey,{
      selectionControls:o.selectionControls??(theme.platform==='iOS'?cupertinoTextSelectionHandleControls:theme.platform==='macOS'?cupertinoDesktopTextSelectionHandleControls:theme.platform==='android'||theme.platform==='fuchsia'?materialTextSelectionHandleControls:desktopTextSelectionHandleControls),contextMenuBuilder:o.contextMenuBuilder===undefined?TextField.defaultContextMenuBuilder:o.contextMenuBuilder,magnifierConfiguration:o.magnifierConfiguration??TextMagnifier.adaptiveMagnifierConfiguration,cursorWidth:o.cursorWidth??2,...(o.cursorHeight!==undefined?{cursorHeight:o.cursorHeight}:{}),...(o.strutStyle?{strutStyle:o.strutStyle}:{}),...(o.textScaler?{textScaler:o.textScaler}:{}),
      enableInteractiveSelection:this.widget.enableInteractiveSelection,groupId:this.widget.groupId,...(o.onTapOutside!==undefined?{onTapOutside:o.onTapOutside}:{}),...(o.onTapUpOutside!==undefined?{onTapUpOutside:o.onTapUpOutside}:{}),
      configuration:{readOnly:o.readOnly??false,obscureText:o.obscureText??false,autocorrect:o.autocorrect??true,enableSuggestions:o.enableSuggestions??true,keyboardType:o.keyboardType??'text',capitalization:o.textCapitalization??'none',autofillHints:o.autofillHints??null},
      textStyle:style,textAlign:o.textAlign??'start',...(o.textDirection?{textDirection:o.textDirection}:{}),minHeight:0,enabled,autofocus:o.autofocus??false,minLines:o.minLines??null,maxLines:o.maxLines===undefined?1:o.maxLines,expands:o.expands??false,scrollController:o.scrollController??null,scrollPhysics:o.scrollPhysics??null,
      cursorColor:(hasError?o.cursorErrorColor?.toARGB32()??theme.colorScheme.error:o.cursorColor?.toARGB32()??selection.cursorColor??theme.colorScheme.primary),selectionColor:selection.selectionColor??new Color(theme.colorScheme.primary).withOpacity(.4).toARGB32(),
      ...(o.textInputAction?{action:o.textInputAction}:{}),inputFormatters:formatters,...(o.onChanged?{onChanged:o.onChanged}:{}),...(o.onEditingComplete?{onEditingComplete:o.onEditingComplete}:{}),...(o.onSubmitted?{onSubmitted:o.onSubmitted}:{}),
    });
    const child=decoration?new InputDecorator({decoration,baseStyle:style,textAlign:o.textAlign??'start',textAlignVertical:o.textAlignVertical??null,expands:o.expands??false,isFocused:this.focus.hasFocus,isHovering:this.hovering,isEmpty:this.controller.text.length===0,child:editor}):editor;
    return new Directionality(o.textDirection??Directionality.of(context),new TextFieldTapRegion(new ExcludeFocus(new MouseRegion(new GestureDetector(child,{behavior:HitTestBehavior.translucent,excludeFromSemantics:true,onTap:enabled?()=>{this.focus.requestFocus();o.onTap?.();}:null}),{cursor:enabled?SystemMouseCursors.text:SystemMouseCursors.basic,onEnter:()=>{if(!this.hovering)this.setState(()=>{this.hovering=true;});},onExit:()=>{if(this.hovering)this.setState(()=>{this.hovering=false;});}}),{excluding:!enabled}),{groupId:this.widget.groupId}));
  }
}
