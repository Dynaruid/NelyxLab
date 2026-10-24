// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {EditableText} from '@nelyx/core/framework/widgets/editable-text';
import {TextField} from '@nelyx/material/text-field';
import {CupertinoTextField} from '@nelyx/cupertino/text-field';
import {Theme} from '@nelyx/material/theme';
import {ThemeData} from '@nelyx/material/theme-data';
import {CupertinoTheme,CupertinoThemeData} from '@nelyx/cupertino/theme';
import {TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {Overlay,OverlayEntry} from '@nelyx/core/framework/widgets/overlay';
import {MediaQuery,Directionality} from '@nelyx/core/framework/widgets/app-data';
import {Center,SizedBox} from '@nelyx/core/framework/widgets/basic';
import {EditingSession} from '@nelyx/core/ui/editing';
import {BinaryMessenger} from '@nelyx/core/services/binary-messenger';
import {JSONMethodCodec} from '@nelyx/core/services/message-codecs';
import {ContextMenuButtonType} from '@nelyx/core/framework/widgets/context-menu-button-item';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {TextSelection} from '@nelyx/core/services/text-editing';
import {TextSelectionHandleType} from '@nelyx/core/framework/rendering/selection';
import {TextPosition} from '@nelyx/core/ui/text-position';
import {SelectionChangedCause} from '@nelyx/core/services/text-input';
import {engineFixture,assertParagraphOwnership} from '../../../packages/material/tests/engine-fixture.mjs';

const timeout=1_200_000;
FoundationPlatform.configure({kind:'web',operatingSystem:'android'});
function find(element,predicate){if(predicate(element))return element;let result;element.visitChildren(child=>{result??=find(child,predicate);});return result;}
class ClipboardHost extends BinaryMessenger {
  codec=new JSONMethodCodec();text='paste';writes=[];pendingRead;deferRead=false;
  send(channel,message){
    if(channel!=='flutter/platform')return Promise.resolve(null);
    const call=this.codec.decodeMethodCall(message);
    if(call.method==='Clipboard.setData'){this.text=call.arguments.get('text');this.writes.push(this.text);return Promise.resolve(this.codec.encodeSuccessEnvelope(null));}
    if(call.method==='Clipboard.hasStrings')return Promise.resolve(this.codec.encodeSuccessEnvelope(new Map([['value',this.text!==null&&this.text.length>0]])));
    if(call.method==='Clipboard.getData'){
      const reply=()=>this.codec.encodeSuccessEnvelope(this.text===null?null:new Map([['text',this.text]]));
      return this.deferRead?new Promise(resolve=>{this.pendingRead=()=>resolve(reply());}):Promise.resolve(reply());
    }
    return Promise.resolve(this.codec.encodeSuccessEnvelope(null));
  }
  setMessageHandler(){}
  async handlePlatformMessage(_channel,_message,callback){callback?.(null);}
}
function bindInput(f){f.root.context.editing={capabilities:{indexUnit:'utf16',composing:'observed',selectionDirection:'observed'},bind(owner,initial,changed,options){const session=new EditingSession(owner,initial);const replace=value=>{assert(session.update({...value,revision:session.value.revision+1}));changed(session.value);};return {read:()=>session.value,replace,get isComposing(){return session.value.composing.status==='active';},focus(){options.focusChanged?.(true);},blur(){options.focusChanged?.(false);},dispose(){session.dispose();}};}};}
const drain=async f=>{await Promise.resolve();f.frame();await Promise.resolve();f.advance(200);};

for(const design of ['material','cupertino'])test(`${design} uses the Core selection toolbar, clipboard actions and live paragraph leaders`,{timeout},async()=>{
  const host=new ClipboardHost(),f=await engineFixture({fonts:true,binaryMessenger:host}),controller=new TextEditingController('Hello world'),focus=new FocusNode(),edits=[];
  bindInput(f);let options={id:'field',controller,focusNode:focus,onChanged:text=>edits.push(text)};
  const entry=new OverlayEntry({builder:()=>new Center(new SizedBox(220,undefined,design==='material'?new TextField(options):new CupertinoTextField(options)))});
  const overlay=new Overlay({initialEntries:[entry]}),wrapped=new Directionality('ltr',design==='material'?new Theme(new ThemeData({platform:'android'}),overlay):new CupertinoTheme({data:new CupertinoThemeData(),child:overlay}));
  try{
    f.set(new MediaQuery({width:240,height:160,scale:1,textScale:1,safeArea:{top:0,left:0,right:0,bottom:0},keyboardInset:0},wrapped));focus.requestFocus();await drain(f);
    const state=find(f.root.root,e=>e.widget instanceof EditableText).stateObject;
    controller.selection={anchor:0,focus:5};f.frame();const before=f.frame().filter(command=>command.op==='drawPath').length;
    assert(state.showToolbar());await drain(f);await drain(f);
    const labels=f.root.nodes.filter(node=>node.role==='button').map(node=>node.name);
    assert(labels.some(label=>label==='Copy'),'Toolbar exposes the current copy action');assert(labels.some(label=>label==='Cut'));
    if(!labels.includes('Paste')){const next=f.root.nodes.find(node=>node.role==='button'&&node.name==='');assert(next,'A narrow toolbar provides its next page');f.tap(next.id);f.advance(130);await drain(f);assert(f.root.nodes.some(node=>node.role==='button'&&node.name==='Paste'),'Paste remains reachable through Core toolbar paging');}
    assert(f.frame().filter(command=>command.op==='drawPath').length>before,'Mobile handles paint through Core layer leaders');
    assert(state.renderEditable.coreEditingGeometry);
    state.hideToolbar(false);await drain(f);
    const render=state.renderEditable,end=render.getEndpointsForSelection(new TextSelection({baseOffset:0,extentOffset:5})).at(-1).point,caret=render.getLocalRectForCaret(new TextPosition({offset:5})),controls=state.widget.inputOptions.selectionControls,size=controls.getHandleSize(caret.height),anchor=controls.getHandleAnchor(TextSelectionHandleType.right,caret.height),handle=render.localToGlobal({x:end.dx-anchor.dx+size.width/2,y:end.dy-anchor.dy+size.height/2}),targetCaret=render.getLocalRectForCaret(new TextPosition({offset:10})),target=render.localToGlobal({x:targetCaret.x+.1,y:targetCaret.y+targetCaret.height/2});
    const pointer=(kind,point,timestamp)=>f.root.pointer({kind,pointer:7,device:'touch',buttons:kind==='up'?0:1,x:point.x,y:point.y,timestamp,viewportGeneration:1});
    pointer('down',handle,0);f.frame();pointer('move',target,30);f.frame();await drain(f);
    assert.equal(controller.selection.focus,10,'Dragging the painted handle updates Core UTF-16 selection');
    assert(f.frame().some(command=>command.op==='saveBackdropFilter'),'The magnifier samples the Core scene');
    const surface=f.ck.MakeSurface(240,160);assert(surface);try{f.library.replay(surface.getCanvas(),{commands:f.frame()});surface.flush();}finally{surface.delete();}
    pointer('up',target,60);await drain(f);await drain(f);
    controller.selection={anchor:0,focus:5};f.frame();
    const copy=state.contextMenuButtonItems.find(item=>item.type===ContextMenuButtonType.copy);assert(copy);
    await state.copySelection(SelectionChangedCause.keyboard);assert.equal(host.text,'Hello');assert(focus.attached);
    controller.text='different';copy.onPressed();await drain(f);assert.deepEqual(host.writes,['Hello'],'Retired menu items cannot act on a later controller revision');
    controller.text='Hello world';controller.selection={anchor:0,focus:6};await state.cutSelection(SelectionChangedCause.keyboard);assert.equal(controller.text,'world');assert.equal(edits.at(-1),'world');assert.equal(host.text,'Hello ');
    options={...options,maxLength:2};entry.markNeedsBuild();f.frame();controller.text='A';controller.selection={anchor:1,focus:1};host.text='e\u0301Z';await state.pasteText(SelectionChangedCause.keyboard);assert.equal(controller.text,'Ae\u0301');assert.equal(edits.at(-1),'Ae\u0301');
    assert(controller.undo());assert.equal(controller.text,'A');assert(controller.redo());assert.equal(controller.text,'Ae\u0301');
    controller.text='A';controller.selection={anchor:1,focus:1};host.deferRead=true;host.text='Z';const paste=state.pasteText(SelectionChangedCause.keyboard);await Promise.resolve();assert(host.pendingRead);controller.text='changed';controller.text='A';host.pendingRead();await paste;assert.equal(controller.text,'AZ','Paste uses the live same-editor value and selection after the clipboard read');
    controller.text='A';
    host.deferRead=false;host.text=null;controller.selection={anchor:0,focus:1};await state.pasteText(SelectionChangedCause.keyboard);assert.equal(controller.text,'A','No clipboard text does not delete the selection');
    host.text='available';options={...options,readOnly:true};entry.markNeedsBuild();f.frame();
    const readonly=state.contextMenuButtonItems.map(item=>item.type);assert(!readonly.includes(ContextMenuButtonType.cut)&&!readonly.includes(ContextMenuButtonType.paste));assert(readonly.includes(ContextMenuButtonType.copy));
    options={...options,readOnly:false,obscureText:true};entry.markNeedsBuild();f.frame();controller.selection={anchor:0,focus:1};
    const password=state.contextMenuButtonItems.map(item=>item.type);assert(!password.includes(ContextMenuButtonType.copy)&&!password.includes(ContextMenuButtonType.cut));
    options={...options,contextMenuBuilder:null};entry.markNeedsBuild();f.frame();assert.equal(state.showToolbar(),false);await drain(f);
    f.set(new SizedBox());await state.pasteText(SelectionChangedCause.keyboard);await state.cutSelection(SelectionChangedCause.keyboard);await state.copySelection(SelectionChangedCause.keyboard);assertParagraphOwnership(f);assert.equal(f.root.scheduler.transientCallbackCount,0);
  }finally{await f.close();controller.dispose();focus.dispose();entry.dispose();}
});

test('Core hardware clipboard shortcuts share the live clipboard/formatter path and protect obscured/readOnly fields',{timeout},async()=>{
  const host=new ClipboardHost(),f=await engineFixture({fonts:true,binaryMessenger:host}),controller=new TextEditingController('A👩‍🚀B'),focus=new FocusNode(),changes=[];bindInput(f);
  const mount=configuration=>f.set(new EditableText('field',controller,'Hardware clipboard',focus,48,null,{configuration,onChanged:text=>changes.push(text)}));
  const key=async name=>{for(const kind of ['down','up'])f.root.key({kind,key:name,control:true,meta:false,alt:false,shift:false,repeat:false});await drain(f);await new Promise(setImmediate);f.frame();};
  try{
    mount({});focus.requestFocus();await drain(f);controller.selection={anchor:1,focus:6};f.frame();await key('c');assert.equal(host.text,'👩‍🚀');assert.deepEqual(changes,[]);
    await key('x');assert.equal(controller.text,'AB');assert.deepEqual(changes,['AB']);await key('v');assert.equal(controller.text,'A👩‍🚀B');
    assert.deepEqual(changes,['AB','A👩‍🚀B']);controller.selection={anchor:0,focus:controller.text.length};f.frame();mount({readOnly:true});await drain(f);await key('x');await key('v');assert.equal(controller.text,'A👩‍🚀B');
    mount({obscureText:true});await drain(f);host.text='retained';await key('c');await key('x');assert.equal(host.text,'retained');assert.equal(controller.text,'A👩‍🚀B');
  }finally{await f.close();controller.dispose();focus.dispose();}
});

for(const design of ['material','cupertino'])test(`${design} painted handles scroll multiline selection and move a collapsed caret without creating a range`,{timeout},async()=>{
  const host=new ClipboardHost(),f=await engineFixture({fonts:true,binaryMessenger:host}),controller=new TextEditingController(Array.from({length:24},(_,index)=>'Line '+index).join('\n')),focus=new FocusNode();bindInput(f);controller.selection={anchor:0,focus:5};
  const options={id:'handle-field',controller,focusNode:focus,minLines:3,maxLines:3},entry=new OverlayEntry({builder:()=>new Center(new SizedBox(220,undefined,design==='material'?new TextField(options):new CupertinoTextField(options)))}),overlay=new Overlay({initialEntries:[entry]});
  const wrapped=new Directionality('ltr',design==='material'?new Theme(new ThemeData({platform:'android'}),overlay):new CupertinoTheme({data:new CupertinoThemeData(),child:overlay}));
  const pointer=(kind,point,time)=>f.root.pointer({kind,pointer:23,device:'touch',buttons:kind==='up'?0:1,x:point.x,y:point.y,timestamp:time,viewportGeneration:1});
  try{
    f.set(new MediaQuery({width:240,height:160,scale:1,textScale:1,safeArea:{top:0,left:0,right:0,bottom:0},keyboardInset:0},wrapped));focus.requestFocus();await drain(f);
    const state=find(f.root.root,e=>e.widget instanceof EditableText).stateObject,render=state.renderEditable;
    state.showToolbar();await drain(f);state.hideToolbar(false);await drain(f);
    const grip=(end,collapsed=false)=>{
      const selection=new TextSelection({baseOffset:controller.selection.anchor,extentOffset:controller.selection.focus}),endpoint=end?render.getEndpointsForSelection(selection).at(-1).point:render.getEndpointsForSelection(selection)[0].point,position=new TextPosition({offset:end?selection.end:selection.start}),height=render.getLocalRectForCaret(position).height,type=collapsed?TextSelectionHandleType.collapsed:end?TextSelectionHandleType.right:TextSelectionHandleType.left,controls=state.widget.inputOptions.selectionControls,size=controls.getHandleSize(height),anchor=controls.getHandleAnchor(type,height);
      return render.localToGlobal({x:endpoint.dx-anchor.dx+size.width/2,y:endpoint.dy-anchor.dy+size.height/2});
    };
    const handle=grip(true),activation={x:handle.x+48,y:handle.y},edge=render.localToGlobal({x:70,y:render.size.height+15});pointer('down',handle,0);f.frame();pointer('move',activation,24);f.frame();pointer('move',edge,48);f.frame();const before=controller.selection.focus;
    for(let frame=0;frame<16;frame++)f.advance(16);
    assert(render.scrollOffset.y>0,JSON.stringify({design,size:render.size,handle,activation,edge,selection:controller.selection,before,drag:state.selectionDrag,ticker:state.selectionScrollTicker?.isActive,handles:state.selectionOverlay?.isDraggingEndHandle}));assert(controller.selection.focus>before,'A held painted handle extends across newly exposed Core lines');assert.equal(controller.selection.anchor,0);
    pointer('up',edge,400);await drain(f);const stopped=render.scrollOffset.y;f.advance(250);assert.equal(render.scrollOffset.y,stopped);
    const start=controller.text.indexOf('Line 21')+2;controller.selection={anchor:start,focus:controller.text.length};await drain(f);state.showToolbar();await drain(f);state.hideToolbar(false);await drain(f);
    const startGrip=grip(false),above=render.localToGlobal({x:30,y:-15}),bottom=render.scrollOffset.y;
    pointer('down',startGrip,500);f.frame();pointer('move',{x:startGrip.x+48,y:startGrip.y},524);f.frame();pointer('move',above,548);f.frame();
    for(let frame=0;frame<16;frame++)f.advance(16);
    assert(render.scrollOffset.y<bottom,JSON.stringify({reason:'A dragged start handle reveals its moving edge instead of returning to the fixed end',design,startGrip,above,bottom,now:render.scrollOffset.y,selection:controller.selection,drag:state.selectionDrag,draggingStart:state.selectionOverlay?.isDraggingStartHandle}));assert(controller.selection.anchor<start);assert.equal(controller.selection.focus,controller.text.length);
    pointer('up',above,900);await drain(f);
    controller.selection={anchor:0,focus:0};await drain(f);state.showToolbar();await drain(f);state.hideToolbar(false);await drain(f);
    const collapsed=grip(false,true),caret=render.getLocalRectForCaret(new TextPosition({offset:3})),localGrip=render.globalToLocal(collapsed),target=render.localToGlobal({x:caret.x+.1,y:localGrip.y});pointer('down',collapsed,1000);f.frame();pointer('move',{x:collapsed.x+48,y:collapsed.y},1030);f.frame();pointer('move',target,1060);f.frame();pointer('up',target,1080);await drain(f);
    assert.deepEqual(controller.selection,{anchor:3,focus:3},'Dragging a collapsed handle moves the insertion point');
    f.set(new SizedBox());assert.equal(f.root.scheduler.transientCallbackCount,0);
  }finally{await f.close();controller.dispose();focus.dispose();entry.dispose();}
});
