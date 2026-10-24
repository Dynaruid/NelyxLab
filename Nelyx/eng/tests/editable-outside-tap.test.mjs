// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {TextFieldTapRegion,TapRegionSurface,RenderTapRegion} from '@nelyx/core/framework/widgets/tap-region';
import {Action,Actions} from '@nelyx/core/framework/widgets/actions';
import {EditableTextTapOutsideIntent,EditableTextTapUpOutsideIntent} from '@nelyx/core/framework/widgets/text-editing-intents';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {AppFocus} from '@nelyx/core/framework/widgets/app-focus';
import {Directionality,MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {SizedBox,Column,Text} from '@nelyx/core/framework/widgets/basic';
import {GestureDetector} from '@nelyx/core/framework/widgets/gesture-detector';
import {HitTestBehavior} from '@nelyx/core/framework/rendering/pointer-listener';
import {GlobalKey} from '@nelyx/core/framework/widgets/global-key';
import {Navigator,NavigatorController,Route} from '@nelyx/core/framework/widgets/navigation';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {EditingSession} from '@nelyx/core/ui/editing';
import {PointerDownEvent,PointerUpEvent} from '@nelyx/core/framework/gestures/events';
import {PointerDeviceKind} from '@nelyx/core/ui/pointer';
import {TextField} from '@nelyx/material/text-field';
import {InputDecoration} from '@nelyx/material/input-decoration';
import {Theme} from '@nelyx/material/theme';
import {ThemeData} from '@nelyx/material/theme-data';
import {CupertinoTextField} from '@nelyx/cupertino/text-field';
import {CupertinoTheme,CupertinoThemeData} from '@nelyx/cupertino/theme';
import {engineFixture} from '../../../packages/material/tests/engine-fixture.mjs';

const timeout=1_200_000;
function host(f){const records=[];f.root.context.editing={capabilities:{indexUnit:'utf16',composing:'observed',selectionDirection:'observed'},bind(owner,initial,changed,options){const session=new EditingSession(owner,initial);const replace=value=>{session.update({...value,source:'programmatic',revision:session.value.revision+1});changed(session.value);};records.push({options,native(composing){session.update({...session.value,composing,revision:session.value.revision+1,source:'native'});changed(session.value);}});return {read:()=>session.value,get isComposing(){return session.value.composing.status==='active';},replace,replaceComposing:replace,focus(){options.focusChanged?.(true);},blur(){options.focusChanged?.(false);},dispose(){session.dispose();}};}};return records;}
const button=(height,callback=()=>{})=>new GestureDetector(new SizedBox(240,height),{behavior:HitTestBehavior.opaque,excludeFromSemantics:true,onTap:callback});
const surface=child=>new MediaQuery({width:240,height:160,scale:1,textScale:1,safeArea:{left:0,top:0,right:0,bottom:0},keyboardInset:0},new Directionality('ltr',new AppFocus(new TapRegionSurface(child))));
function scene(controller,focus,options={},outside=()=>{}){return surface(new Column([new SizedBox(240,48,new EditableText('tap-editor',controller,'Tap editor',focus,48,null,{maxLines:1,...options})),new TextFieldTapRegion(button(32),{groupId:options.groupId}),button(32,outside)]));}
function pointer(f,kind,y,device='mouse'){f.root.pointer({kind,pointer:11,device,buttons:kind==='up'||kind==='cancel'?0:1,x:100,y,timestamp:f.root.context.clock.now(),viewportGeneration:1});f.root.buildOwner.focus.applyFocusChangesIfNeeded();f.frame();}
function tap(f,y,device='mouse'){pointer(f,'down',y,device);pointer(f,'up',y,device);}
const focusField=(f,focus)=>{focus.requestFocus();f.root.buildOwner.focus.applyFocusChangesIfNeeded();f.frame();assert.equal(f.root.buildOwner.focus.primaryFocus,focus);};

test('outside pointer defaults preserve native mobile touch focus and release desktop, browser-touch and stylus focus',{timeout},async()=>{
  for(const [kind,operatingSystem,device,retained] of [['native','android','touch',true],['native','ios','touch',true],['native','fuchsia','touch',true],['native','android','mouse',false],['native','android','pen',false],['web','android','touch',false],['native','windows','touch',false]]){
    FoundationPlatform.configure({kind,operatingSystem});const f=await engineFixture({fonts:true}),controller=new TextEditingController('composition'),focus=new FocusNode(),records=host(f);let taps=0;
    try{f.set(scene(controller,focus,{},()=>taps++));focusField(f,focus);records[0].native({status:'active',start:0,end:4});f.frame();tap(f,96,device);assert.equal(focus.hasPrimaryFocus,retained,JSON.stringify({kind,operatingSystem,device}));assert.equal(taps,1,'Outside notification does not consume the target gesture');assert.equal(controller.text,'composition');}
    finally{await f.close();controller.dispose();focus.dispose();FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});}
  }
});

test('actual grouped hits keep focus, callbacks override defaults and an outside up follows the down that had focus',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('value'),focus=new FocusNode(),group={},events=[];host(f);
  try{
    const options={groupId:group,onTapOutside:event=>{events.push(['down',event]);focus.unfocus();},onTapUpOutside:event=>events.push(['up',event])};
    f.set(scene(controller,focus,options));focusField(f,focus);tap(f,64);assert(focus.hasPrimaryFocus);assert.deepEqual(events,[],'An external control in the same group is inside');
    pointer(f,'down',96);assert.equal(focus.hasPrimaryFocus,false);pointer(f,'up',96);assert.deepEqual(events.map(x=>x[0]),['down','up']);assert(events[0][1] instanceof PointerDownEvent);assert(events[1][1] instanceof PointerUpEvent);
    focusField(f,focus);pointer(f,'down',16);pointer(f,'up',96);assert.equal(events.length,2,'An inside down does not start an outside-up notification');
    f.set(scene(controller,focus,{groupId:group,onTapOutside:()=>events.push(['kept'])}));focusField(f,focus);tap(f,96);assert(focus.hasPrimaryFocus,'A callback replaces the default unfocus action');assert.equal(events.at(-1)[0],'kept');
  }finally{await f.close();controller.dispose();focus.dispose();}
});

test('outside intents use overridable Actions and preserve callingAction for the default pointer policy',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('value'),focus=new FocusNode(),events=[];host(f);
  class Outside extends Action{constructor(){super(EditableTextTapOutsideIntent);}invoke(intent){events.push('down');assert(this.callingAction);this.callingAction.invoke(intent);}}
  class UpOutside extends Action{constructor(){super(EditableTextTapUpOutsideIntent);}invoke(intent){events.push('up');assert(this.callingAction);this.callingAction.invoke(intent);}}
  try{f.set(new Actions({actions:new Map([[EditableTextTapOutsideIntent,new Outside()],[EditableTextTapUpOutsideIntent,new UpOutside()]]),child:scene(controller,focus)}));focusField(f,focus);tap(f,96);assert.deepEqual(events,['down','up']);assert.equal(focus.hasPrimaryFocus,false);
    assert.throws(()=>new PointerDownEvent({kind:PointerDeviceKind.trackpad}),/Trackpad uses pan-zoom events/,'Unsupported down events are rejected at Core admission');
  }finally{await f.close();controller.dispose();focus.dispose();FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});}
});

test('outside notifications cannot follow a replaced logical editor or a disabled and retired region',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),a=new TextEditingController('a'),b=new TextEditingController('b'),focus=new FocusNode(),events=[];host(f);const key=new GlobalKey('logical editor');
  const render=(controller,enabled=true)=>surface(new Column([new SizedBox(240,48,new EditableText('logical',controller,'Logical editor',focus,48,key,{maxLines:1,enabled,onTapOutside:()=>events.push('down'),onTapUpOutside:()=>events.push('up')})),button(64)]));
  const region=()=>{let found;const visit=e=>{if(e.renderObject instanceof RenderTapRegion&&e.renderObject.onTapOutside)found=e.renderObject;e.visitChildren(visit);};visit(f.root.root);assert(found);return found;};
  try{
    f.set(render(a));focusField(f,focus);const old=region(),down=old.onTapOutside,up=old.onTapUpOutside;pointer(f,'down',80);assert.deepEqual(events,['down']);f.set(render(b));pointer(f,'up',80);assert.deepEqual(events,['down'],'Controller handoff cancels the prior logical field notification');
    focusField(f,focus);down(new PointerDownEvent());up(new PointerUpEvent());assert.deepEqual(events,['down'],'Saved callbacks cannot reach a replacement logical field');
    pointer(f,'down',80);f.set(render(b,false));pointer(f,'up',80);assert.deepEqual(events,['down','down'],'Disabling cancels the in-flight up callback');f.set(new SizedBox());down(new PointerDownEvent());up(new PointerUpEvent());assert.deepEqual(events,['down','down']);
  }finally{await f.close();a.dispose();b.dispose();focus.dispose();}
});

test('a callback can replace its editor during actual pointer dispatch without notifying or blurring the new owner',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),a=new TextEditingController('a'),b=new TextEditingController('b'),fa=new FocusNode(),fb=new FocusNode(),events=[];host(f);
  try{
    f.set(scene(a,fa,{onTapOutside:()=>{events.push('down');f.set(scene(b,fb));fb.requestFocus();},onTapUpOutside:()=>events.push('up')}));focusField(f,fa);pointer(f,'down',96);assert.equal(f.root.buildOwner.focus.primaryFocus,fb);pointer(f,'up',96);assert.deepEqual(events,['down']);assert.equal(f.root.buildOwner.focus.primaryFocus,fb);assert.equal(b.text,'b');
  }finally{await f.close();a.dispose();b.dispose();fa.dispose();fb.dispose();}
});

test('retained noncurrent routes suppress pending outside-up callbacks and restore their editing region on return',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('value'),focus=new FocusNode(),navigation=new NavigatorController(),events=[];host(f);let pushed;
  const initial=new Route(()=>new Column([new SizedBox(240,48,new EditableText('route-field',controller,'Route field',focus,48,null,{maxLines:1,onTapOutside:()=>events.push('down'),onTapUpOutside:()=>events.push('up')})),button(64)]));
  try{
    f.set(surface(new Navigator(navigation,initial)));focusField(f,focus);pointer(f,'down',96);assert.deepEqual(events,['down']);pushed=navigation.push(new Route(()=>button(160),'/cover',null,false));f.frame();pointer(f,'up',96);assert.deepEqual(events,['down'],'A retained covered route cannot finish the old outside callback');assert(navigation.pop());f.frame();await pushed;focusField(f,focus);tap(f,96);assert.deepEqual(events,['down','down','up']);
  }finally{await f.close();navigation.dispose();controller.dispose();focus.dispose();}
});

for(const design of ['material','cupertino'])test(design+' exposes outside callbacks and includes the complete decorated field in its custom group',{timeout},async()=>{
  FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=await engineFixture({fonts:true}),controller=new TextEditingController('value'),focus=new FocusNode(),group={},events=[];host(f);
  try{
    const options={id:'design-tap',controller,focusNode:focus,groupId:group,onTapOutside:()=>events.push('down'),onTapUpOutside:()=>events.push('up')};
    assert.throws(()=>new EditableText('invalid',controller,'Invalid',focus,48,null,{groupId:null}),/groupId must not be null/);
    assert.throws(()=>design==='material'?new TextField({...options,groupId:null}):new CupertinoTextField({...options,groupId:null}),/groupId must not be null/);
    const field=design==='material'?new Theme(new ThemeData(),new TextField({...options,decoration:new InputDecoration({labelText:'Decorated',prefix:new Text('Prefix')})})):new CupertinoTheme(new CupertinoThemeData(),new CupertinoTextField({...options,prefix:new Text('Prefix')}));
    f.set(surface(new Column([field,button(32)])));focusField(f,focus);
    const regions=[];let editor;const visit=e=>{if(e.renderObject instanceof RenderTapRegion)regions.push(e.renderObject);if(e.widget instanceof EditableText)editor=e.widget;e.visitChildren(visit);};visit(f.root.root);assert(editor);assert.equal(editor.groupId,group);assert.equal(editor.inputOptions.onTapOutside,options.onTapOutside);assert(regions.filter(x=>x.groupId===group).length>=2,'Decoration and Core editor use the same group');
    const outer=regions.find(x=>x.groupId===group),point=outer.localToGlobal({x:1,y:1});f.root.pointer({kind:'down',pointer:11,device:'mouse',buttons:1,x:point.x,y:point.y,timestamp:0,viewportGeneration:1});f.frame();f.root.pointer({kind:'up',pointer:11,device:'mouse',buttons:0,x:point.x,y:point.y,timestamp:1,viewportGeneration:1});f.frame();assert.deepEqual(events,[],'A prefix or decoration-edge hit is inside the field group');
    const height=outer.size.height;tap(f,height+16);assert.deepEqual(events,['down','up']);assert(focus.hasPrimaryFocus,'The supplied callback retains focus in both designs');
  }finally{await f.close();controller.dispose();focus.dispose();}
});
