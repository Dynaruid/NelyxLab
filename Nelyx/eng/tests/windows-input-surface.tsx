// SPDX-License-Identifier: BSD-3-Clause
import * as React from 'react';import * as RN from 'react-native';
import {widgetApplication,FrameworkRoot} from '@nelyx/core/framework/widgets/root';
import {EditableText,TextEditingController} from '@nelyx/core/framework/widgets/editable-text';
import {Center,SizedBox,Column} from '@nelyx/core/framework/widgets/basic';
import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {FocusNode} from '@nelyx/core/framework/widgets/focus';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {ValueNotifier} from '@nelyx/core/foundation/notifier';
import {AnimatedOpacity} from '@nelyx/core/framework/widgets/implicit-animations';
import {Curves} from '@nelyx/core/framework/animation/curves';
import {ListenableBuilder} from '@nelyx/core/framework/widgets/listenable-builder';
import {RenderEditable} from '@nelyx/core/framework/rendering/editable';
import type {RenderObject} from '@nelyx/core/framework/rendering/object';
import {bounds,multiply,translate,fullTransform,captureTransform} from '@nelyx/core/ui/geometry';
import {tryUnprojectMatrix4Point} from '@nelyx/core/ui/matrix4';
import {TextSelection as SourceSelection} from '@nelyx/core/services/text-editing';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {registerApplication} from '@nelyx/sdk/platforms/windows/application';
import {NativeLayer} from '@nelyx/sdk/platforms/windows/controls';
import {ApplicationSurface as Surface} from '@nelyx/sdk/platforms/windows/surface';
import {WindowsInteraction} from '@nelyx/sdk/platforms/windows/interaction';
import {windowsSemanticsPacket,performWindowsSemanticsAction as strictSemanticsAction} from './node_modules/@nelyx/sdk/src/platforms/windows/semantics-packet';
import type {NativeEditingSnapshot} from './node_modules/@nelyx/sdk/dist/runtime/native-interaction.js';
import type {WindowsInputModule} from './node_modules/@nelyx/sdk/dist/platforms/windows/input-service.js';
import type {ReactNativeApplication} from './node_modules/@nelyx/sdk/dist/backends/react-native/surface.js';
import type {TextInputGeometry} from '@nelyx/core/ui/types';
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
const owner={id:'actual-skia-input',generation:1},controller=new TextEditingController('Skia input'),focus=new FocusNode();controller.selection={anchor:4,focus:4};
const configuration=new ValueNotifier({readOnly:false,obscureText:false});
const opacity=new ValueNotifier(1);let opacityCompletions=0;
const interaction=new WindowsInteraction(owner),fixture=RN.NativeModules.NelyxInputSurfaceFixture;
let tag=0,finished=false,stage='registration',activations=0;
let latestGeometry:unknown,holdGeometry=false,held:Parameters<WindowsInputModule['command']>[]=[];
let traceSubscription:{remove():void}|undefined;
let nativeEditing:NativeEditingSnapshot|undefined;
let lastInsert:Parameters<WindowsInputModule['insertText']>|undefined,standaloneInsertions=0,insertions=0;
const imeProbe=Boolean(Number('__IME_PROBE__'));let observedComposition=false,releasedBarrier=0,releasedRight=0;
const keyTrace:unknown[]=[];function trace(value:unknown){if(keyTrace.length===64)keyTrace.shift();keyTrace.push(value);}
const performAction=interaction.performAction.bind(interaction);interaction.performAction=(id,action)=>{const accepted=performAction(id,action);trace({semanticsAction:{id,action,accepted,coreFocused:focus.hasFocus,nativeFocused:nativeEditing?.focused,commit:interaction.snapshot()}});return accepted;};
let commandSequence=0,maxFramePublications=0;const nativePending=new Map<number,{client:number;name:string}>(),geometryByFrame=new Map<string,number>();
// Observe the real module without replacing its TSF implementation. The public
// ApplicationSurface still creates, owns and retires the input service itself.
const module:WindowsInputModule=RN.NativeModules.NelyxWindowsInput;
const native:WindowsInputModule={getInputProtocol:module.getInputProtocol.bind(module),connect:module.connect.bind(module),openClient:module.openClient.bind(module),configureClient:module.configureClient.bind(module),command:module.command.bind(module),insertText:module.insertText.bind(module),closeClient:module.closeClient.bind(module),disconnect:module.disconnect.bind(module)};
const observed:WindowsInputModule={getInputProtocol:()=>native.getInputProtocol(),async insertText(...args){insertions++;lastInsert=args;if(args[2]==='Ω'||args[2]==='😀')standaloneInsertions++;trace({insert:args.slice(1)});const result=await native.insertText(...args);trace({insertResult:result});return result;},connect:(...args)=>{tag=args[0];return native.connect(...args);},openClient:(...args)=>native.openClient(...args),configureClient:(...args)=>native.configureClient(...args),closeClient:(...args)=>native.closeClient(...args),disconnect:(...args)=>native.disconnect(...args),command(...args){if(args[2]==='geometry'){latestGeometry=args[3][0];const value=args[3][0] as {geometry:TextInputGeometry|null;nativeRevision:number},frame=value.geometry;if(frame){const stamp=[value.nativeRevision,frame.viewportGeneration,frame.layoutEpoch].join('/'),count=(geometryByFrame.get(stamp)??0)+1;geometryByFrame.set(stamp,count);maxFramePublications=Math.max(maxFramePublications,count);if(geometryByFrame.size>128)geometryByFrame.delete(geometryByFrame.keys().next().value!);}if(holdGeometry){held.push(args);return Promise.resolve(true);}}const record=['focus','blur','replace','replaceComposing'].includes(args[2]);if(record)trace({command:args.slice(0)});const token=++commandSequence;nativePending.set(token,{client:args[1],name:args[2]});return native.command(...args).then(value=>{nativePending.delete(token);if(record)trace({commandResult:[args[2],value]});return value;},error=>{nativePending.delete(token);throw error;});}};
// RNW exposes immutable HostObject methods. Instrument the JS registry getter,
// forwarding every native operation to the original module unchanged.
declare const require:(name:string)=>typeof RN;
const packetExports=require('./node_modules/@nelyx/sdk/dist/platforms/windows/semantics-packet.js') as unknown as typeof import('./node_modules/@nelyx/sdk/dist/platforms/windows/semantics-packet.js');
const semanticsAction=packetExports.performWindowsSemanticsAction;
const tracedSemanticsAction:typeof semanticsAction=(current,node,packet,event)=>{const accepted=semanticsAction(current,node,packet,event);trace({nativeSemanticsAction:{id:event.id,kind:event.kind,commit:event.commit,expected:packet.commit,current:current.snapshot(),live:current.isLiveNodeSnapshot(node),accepted}});return accepted;};
Object.defineProperty(packetExports,'performWindowsSemanticsAction',{configurable:true,value:tracedSemanticsAction});
// Hold one actual UIA receipt until React commits a newer packet. Observe both
// package entry forms without adding a test hook to the product renderer.
const actionSource=require('./node_modules/@nelyx/sdk/src/backends/react-native/windows-semantics-actions') as unknown as typeof import('./node_modules/@nelyx/sdk/src/backends/react-native/windows-semantics-actions');
const actionBuilt=require('./node_modules/@nelyx/sdk/dist/backends/react-native/windows-semantics-actions.js') as unknown as typeof actionSource;
type FocusReceiver=InstanceType<typeof actionSource.WindowsSemanticsActions>;
type FocusPublication=Parameters<FocusReceiver['publish']>;
type FocusReceipt=Parameters<FocusReceiver['perform']>[0];
const focusPublications=new WeakMap<FocusReceiver,FocusPublication>(),restoreFocusReceivers:Array<()=>void>=[];
let holdNativeFocus=false,deferredFocus:{event:FocusReceipt;latest:()=>FocusPublication|undefined;perform:()=>boolean}|undefined;
let queuedFocusEvidence:{capturedCommit:number;publishedCommit:number;strictRejected:boolean;accepted:boolean;nativeFocusRetained:boolean}|undefined;
let passiveFocusEvidence:{queuedNativeRetained:boolean;canvasPreserved:boolean;explicitUiaRestored:boolean}|undefined;
for(const Receiver of new Set([actionSource.WindowsSemanticsActions,actionBuilt.WindowsSemanticsActions])){
 const publish=Receiver.prototype.publish,perform=Receiver.prototype.perform;
 Receiver.prototype.publish=function(...args){publish.apply(this,args);focusPublications.set(this,args);};
 Receiver.prototype.perform=function(event){
  if(holdNativeFocus&&event.kind==='focus'&&event.id==='field'){
   holdNativeFocus=false;const captured={...event};deferredFocus={event:captured,latest:()=>focusPublications.get(this),perform:()=>perform.call(this,captured)};trace({heldNativeFocus:captured});return false;
  }
  return perform.call(this,event);
 };
 restoreFocusReceivers.push(()=>{Receiver.prototype.publish=publish;Receiver.prototype.perform=perform;});
}
const nativeExports=require('react-native'),registry=nativeExports.NativeModules;
Object.defineProperty(nativeExports,'NativeModules',{configurable:true,get:()=>new Proxy(registry,{get(target,name){return name==='NelyxWindowsInput'?observed:Reflect.get(target,name);}})});
traceSubscription=RN.DeviceEventEmitter.addListener('nelyxWindowsInput',event=>{if(event.type==='editing'){nativeEditing=event.value as NativeEditingSnapshot;if(nativeEditing.source==='native'&&nativeEditing.composingStart>=0)observedComposition=true;trace({editing:event});}});
const definition=widgetApplication({id:'actual-skia-input',background:0xff101827,defaultFont:'fixture-font',semanticsUpdateInterval:50,createRoot:()=>new ListenableBuilder(opacity,()=>new AnimatedOpacity({opacity:opacity.value,duration:120,curve:Curves.easeInOut,onEnd:()=>{opacityCompletions++;},child:new ListenableBuilder(configuration,()=>new Center(new Column([new SizedBox(340,64,new EditableText('field',controller,'Actual Skia input',focus,64,null,{maxLines:configuration.value.obscureText?1:2,configuration:configuration.value,textStyle:new TextStyle({fontSize:22,height:1.3,color:0xffffffff}),cursorColor:0xff00cc44,cursorWidth:2,cursorHeight:26})),new Semantics(new SizedBox(80,30),{id:'invoke',role:'button',name:'Core invoke',enabled:true,activate(){activations++;}})],{mainAxisSize:'min'})))}))});
function check(condition:unknown,message:string):asserts condition{if(!condition)throw new Error(message);}
const delay=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const readText=()=>controller.text,readSelection=()=>controller.selection;
async function finish(ok:boolean,message:string){if(finished)return;
 if(ok&&Boolean(Number('__TYPED_PROBE__'))){const state=(globalThis as unknown as {__nelyxStaticHermes:{mode:string;initialized:boolean;unitsInitialized:number;scope:string;planVersion:number}}).__nelyxStaticHermes;
  check(state?.mode==='static-native-aot'&&state.initialized&&state.unitsInitialized===3&&state.scope==='full-runtime'&&state.planVersion===5,'Typed native root did not acknowledge both units');
  const calls:Record<string,number>={};for(const name of Object.getOwnPropertyNames(globalThis))if(/^__nelyxTyped_[a-f0-9]{16}_calls$/.test(name))calls[name.slice(0,-6)]=(globalThis as unknown as Record<string,()=>number>)[name]!();
  check(Object.values(calls).some(count=>count>0),'The input flow did not call a real typed Core body');const audit=(globalThis as any).__nelyxStaticHermesAudit?.();check(audit?.rnwPalNative&&audit.internalJavaScriptNative&&audit.nativeStarted&&!audit.sourcePreparations&&!audit.sourceExecutions&&!audit.bytecodeExecutions&&!audit.blockedFallbacks&&!audit.jitEnabled&&!audit.evalEnabled,'Input flow used a non-native execution path');message+='\nINPUT_AOT_AUDIT '+JSON.stringify(audit);message+='\nINPUT_TYPED_EXECUTION '+JSON.stringify({mode:state.mode,unitsInitialized:state.unitsInitialized,calls});
 }
 finished=true;holdNativeFocus=false;deferredFocus=undefined;for(const restore of restoreFocusReceivers.splice(0))restore();fixture.complete(ok,message);}
function fail(error:unknown){void finish(false,stage+': '+(error instanceof Error?error.stack??error.message:typeof error==='object'?JSON.stringify(error):String(error))+(stage.startsWith('rapid')||stage==='actual Fabric UIA'||stage==='actual queued UIA focus'?'\n'+keyTrace.map(value=>JSON.stringify(value)).join('\n')+'\nnativePending='+JSON.stringify([...nativePending]):''));}
(globalThis as unknown as {ErrorUtils:{setGlobalHandler(handler:(error:Error)=>void):void}}).ErrorUtils.setGlobalHandler(fail);
async function pixels(message:string){let last:unknown;const end=Date.now()+8000;do{const value=await fixture.probe(tag,readSelection().focus);last=value;if(value.mapping&&value.layout&&value.green){const r=value.rect,p=value.green;check(value.bound,'TSF layout without bound Skia backing');
 // Core commits geometry before asynchronous GPU/DWM presentation. An old
 // front buffer is not the new frame's pixel evidence; wait for its actual
 // caret to appear inside the current TSF rectangle, within this deadline.
 if(p.left>=r.left&&p.top>=r.top&&p.right<=r.right&&p.bottom<=r.bottom){check(!r.clipped,message+': visible caret unexpectedly clipped');check(p.pixels>=20&&value.glyphPixels>=100,message+': no Core green caret/white glyph pixels');return value;}}
 await delay(100);}while(Date.now()<end);throw new Error(message+': '+JSON.stringify({last,latestGeometry,clients:interaction.editorClients,coreFocus:focus.hasFocus,nativeEditing,coreValue:controller.value}));}
async function document(text:string,composing:boolean,completed:()=>boolean=()=>true){const end=Date.now()+7000;while(readText()!==text||controller.isComposing!==composing||nativeEditing?.text!==text||(nativeEditing.composingStart>=0)!==composing||!completed()){check(Date.now()<end,'Core/TSF document did not converge: '+JSON.stringify({expected:{text,composing},text:controller.text,composing:controller.isComposing,nativeEditing}));await delay(20);}}
async function resetDocument(){controller.reset('Skia input');controller.selection={anchor:4,focus:4};await document('Skia input',false);await pixels('Core document restored before actual IME input');}
async function commit(text:string){const before=releasedRight;await fixture.ime('commit');await document(text,false,()=>releasedRight>before&&nativeEditing?.anchor===readSelection().anchor&&nativeEditing?.focus===readSelection().focus);}
async function compose(shift=false){const before=insertions;observedComposition=false;await fixture.ime(shift?'compose-shift':'compose');await document(shift?'Skia까 input':'Skia가 input',true,()=>observedComposition);check(insertions===before,'Actual IME composition used the standalone printable writer');}
async function run(application:ReactNativeApplication){
 stage='native connect';
 check(tag>0,'Actual native Fabric tag missing');check(!RN.NativeModules.NelyxWindowsEditing,'Fixture unexpectedly registered the legacy visible editor');
 const precisionOwner=await fixture.precisionOwner(tag,owner);check(precisionOwner.resolves===12&&precisionOwner.stable===true,'Semantics coordinate leases replaced the actual canvas precision owner');
 const initialRoot=application.view.controller;check(initialRoot instanceof FrameworkRoot&&initialRoot.scheduler.visible,'Preparing must schedule the initial Core frame while native first-content visibility is gated');
 const contentDeadline=Date.now()+5000;while(!firstContentReady){check(Date.now()<contentDeadline,'Matching first content was not acknowledged');await delay(20);}
 const activation=await fixture.activate();check(activation.foreground,'Native fixture could not activate its own AppWindow: '+JSON.stringify(activation));
 if(Number('__CLOSE_ONLY__')){await fixture.beginCloseProducerProbe();controller.text+=' close';application.view.requestFrame();await finish(true,'forced admitted producer close only; full input acceptance not exercised');return;}
 const raw=application.view.dispatchRawKey.bind(application.view);application.view.dispatchRawKey=(message,transport)=>{const handled=raw(message,transport);if('keymap'in message&&message.keymap==='windows'&&message.type==='keyup'){if(message.keyCode===0x87)releasedBarrier++;if(message.keyCode===0x27)releasedRight++;}trace({key:message,handled});return handled;};
 const end=Date.now()+5000;while(!interaction.editorClients.length){check(Date.now()<end,'Core binding was not painted');await delay(20);}focus.requestFocus();
 stage='initial pixels';const first=await pixels('Initial actual Core/Skia caret');check(first.textWindowFocused,'TSF did not use the actual focused InputSite HWND');
 stage='actual Core native paragraph ticket';
 const root=application.view.controller;check(root instanceof FrameworkRoot,'Canonical Core Root missing');let render:RenderEditable|undefined;
 check(interaction.node('field','text-field')?.textRevision===controller.textRevision,'Actual Core semantics did not publish its content-only revision');
 const find=(object:RenderObject)=>{if(object instanceof RenderEditable)render=object;object.visitChildren(find);};find(root.pipeline.rootNode!);check(render,'Actual Core editable render object missing');
 const queryEnd=Date.now()+5000;let nativeParagraph:{observed:false}|{observed:true;boxes:{x:number;y:number;width:number;height:number}[];position:number;foreignResourceRejected:boolean;foreignContextRejected:boolean;screen:{x:number;y:number;width:number;height:number}[];expectedScreen:{x:number;y:number;width:number;height:number}[];visible:number;hitPosition:number;hitViewX:number;hitViewY:number;reentrantRejected:boolean};
 do{const node=interaction.node('field','text-field');check(node?.textParagraph&&node.textInputGeometry,'Actual Core paragraph read ticket was not published');const expected=render.getBoxesForSelection(new SourceSelection({baseOffset:0,extentOffset:controller.text.length})).map(rect=>bounds(multiply(fullTransform(captureTransform(node.textInputGeometry!.transform)),translate(rect.x,rect.y)),rect));nativeParagraph=await fixture.paragraph({owner,tag,paragraph:node.textParagraph,geometry:node.textInputGeometry,characters:node.textNavigation!.characters,text:controller.text,units:controller.text.length,expected});if(!nativeParagraph.observed)await delay(20);}while(!nativeParagraph.observed&&Date.now()<queryEnd);
 check(nativeParagraph.observed&&nativeParagraph.foreignResourceRejected&&nativeParagraph.foreignContextRejected,'Native paragraph source did not enforce its actual native context/resource');
 const node=interaction.node('field','text-field')!,origin=node.textParagraph!.paintOffset,expected=render.getBoxesForSelection(new SourceSelection({baseOffset:0,extentOffset:controller.text.length}));check(nativeParagraph.boxes.length===expected.length,'Native/Core range fragment count differs');
 for(let i=0;i<expected.length;i++){const actual=nativeParagraph.boxes[i],box=expected[i]!;check(Math.abs(actual.x+origin.x-box.x)<.001&&Math.abs(actual.y+origin.y-box.y)<.001&&Math.abs(actual.width-box.width)<.001&&Math.abs(actual.height-box.height)<.001,'Native ticket does not query the exact painted Core paragraph');}
 check(nativeParagraph.position===render.getPositionForOffset({x:10+origin.x,y:10+origin.y}).offset,'Native/Core hit position differs');
 check(nativeParagraph.screen.length===nativeParagraph.expectedScreen.length&&nativeParagraph.visible>0&&nativeParagraph.reentrantRejected,'Native Core screen ranges/visibility/mapping revision were not observed');
 for(let i=0;i<nativeParagraph.screen.length;i++)for(const key of ['x','y','width','height'] as const)check(Math.abs(nativeParagraph.screen[i]![key]-nativeParagraph.expectedScreen[i]![key])<=1,'Original paragraph screen fragments differ from Core projected boxes');
 const hitLocal=tryUnprojectMatrix4Point(fullTransform(captureTransform(node.textInputGeometry!.transform)),{x:nativeParagraph.hitViewX,y:nativeParagraph.hitViewY});check(hitLocal&&nativeParagraph.hitPosition===render.getPositionForOffset(hitLocal).offset,'Native UIA geometry does not preserve the Core screen hit policy');
 stage='actual Fabric UIA';
 const corePacket=windowsSemanticsPacket(node,owner,{surfaceId:tag,nativeSurfaceGeneration:application.view.currentMetrics.nativeSurfaceGeneration!,viewportGeneration:application.view.currentMetrics.viewportGeneration},interaction.snapshot()),parsed=await fixture.validateSemantics(corePacket);check(parsed.accepted&&parsed.textRevision===controller.textRevision,'Native snapshot parser did not retain Core content revision');
 const dirty={...corePacket,text:{...corePacket.text!,geometry:null,paragraph:null,navigation:null}};check((await fixture.validateSemantics(dirty)).accepted,'A temporarily unavailable Core paragraph must not be replaced with native segmentation or fail the component');
 for(const invalid of [{...corePacket,text:{...corePacket.text!,textRevision:-1}},{...corePacket,text:{...corePacket.text!,obscured:true,value:'secret',navigation:null,paragraph:null,anchor:0,focus:0}},{...dirty,text:{...dirty.text,value:'A😀',anchor:0,focus:0,navigation:{characters:[0,2,3],words:[],lines:[]}}}])check(!(await fixture.validateSemantics(invalid)).accepted,'Native parser accepted invalid revision/password plaintext/split-scalar Core units');
 const automation=async(mode:string)=>{let reply:{observed:boolean;text?:string;reason?:string;caretActive?:boolean;visible?:number;textEvents?:number}|undefined;for(let attempt=0;attempt<25;attempt++){const source=(mode==='invoke'?interaction.node('invoke','button'):interaction.node('field','text-field'))?.sourceNodeId,proxy=source===undefined?null:interaction.nativeSemanticsTag(source);if(proxy)reply=await fixture.semantics(proxy,mode);if(reply?.observed)return reply;await delay(100);}throw new Error('Actual Fabric UIA '+mode+' failed: '+JSON.stringify(reply));};
 await automation('invoke');const invoked=Date.now()+5000;while(activations!==1){check(Date.now()<invoked&&activations<=1,'Actual UIA Invoke must dispatch exactly one Core action: '+activations);await delay(20);}
 for(let cycle=0;cycle<8;cycle++){
  trace({focusCycle:cycle});focus.unfocus();const blurred=Date.now()+5000;while(nativeEditing?.focused!==false){check(Date.now()<blurred,'Core blur did not retire native text focus');await delay(20);}
  const focusReply=await automation('focus') as {focusMatches?:boolean;fieldHasFocus?:boolean;focusEvents?:number;focusedId?:string};check(focusReply.focusMatches&&focusReply.fieldHasFocus&&(focusReply.focusEvents??0)>0,'Actual UIA root focus must resolve the Core field: '+JSON.stringify(focusReply));const focused=Date.now()+5000;while(!focus.hasFocus||!nativeEditing?.focused){check(Date.now()<focused,'Actual UIA SetFocus did not restore Core/TSF/canvas focus: '+JSON.stringify({cycle,coreFocused:focus.hasFocus,nativeFocused:nativeEditing?.focused,focusReply,commit:interaction.snapshot()}));await delay(20);}
 }
 stage='actual queued UIA focus';focus.unfocus();
 const blurDeadline=Date.now()+5000;while(nativeEditing?.focused!==false){check(Date.now()<blurDeadline,'Queued-focus fixture did not blur its real TSF editor');await delay(20);}await delay(100);
 holdNativeFocus=true;const queuedRequest=automation('focus').then(value=>({value,error:undefined}),error=>({value:undefined,error}));
 const captureDeadline=Date.now()+2000;while(!deferredFocus){check(Date.now()<captureDeadline,'Actual UIA focus did not reach its JS receiver');await delay(10);}
 const pendingFocus=deferredFocus;controller.selection={anchor:2,focus:2};
 const publicationDeadline=Date.now()+2000;let published=pendingFocus.latest();
 while(!published||published[2].commit<=pendingFocus.event.commit){check(Date.now()<publicationDeadline,'React did not commit a newer real field packet while the UIA request waited');await delay(10);published=pendingFocus.latest();}
 check(!focus.hasFocus,'The held native action focused Core before it was released');
 const peerTag=interaction.nativeSemanticsTag(interaction.node('field','text-field')!.sourceNodeId!);check(peerTag!=null,'The queued focus lost its mounted native peer');
 const pendingNativeFocus=await fixture.semanticsNativeFocus(peerTag,tag,false);check(pendingNativeFocus.focused===pendingNativeFocus.peer,'A newer false-focus snapshot blurred the actual UIA peer before Core acknowledged it');
 const strictRejected=!strictSemanticsAction(published[0],published[1],published[2],pendingFocus.event);check(strictRejected,'The old latest-packet matcher did not reproduce the queued native stamp rejection');
 const accepted=pendingFocus.perform();check(accepted,'Published native focus was lost after the newer React commit');queuedFocusEvidence={capturedCommit:pendingFocus.event.commit,publishedCommit:published[2].commit,strictRejected,accepted,nativeFocusRetained:true};trace({queuedFocusEvidence});deferredFocus=undefined;
 const queuedReply=await queuedRequest;check(!queuedReply.error,'Queued actual UIA focus failed: '+String(queuedReply.error));
 const focusDeadline=Date.now()+5000;while(!focus.hasFocus||!nativeEditing?.focused){check(Date.now()<focusDeadline,'Queued actual UIA focus did not restore Core and TSF');await delay(20);}
 const queuedState=queuedReply.value as {focusMatches?:boolean;fieldHasFocus?:boolean};check(queuedState.focusMatches&&queuedState.fieldHasFocus,'Queued focus did not reach the real UIA field: '+JSON.stringify(queuedState));
 controller.selection={anchor:4,focus:4};await pixels('Core caret restored after queued actual UIA focus');
 stage='passive native focus';const canvasFocus=await fixture.semanticsNativeFocus(peerTag,tag,true);check(canvasFocus.focused===canvasFocus.canvas,'Explicit fixture focus did not move to the real canvas');
 const passiveCommit=interaction.snapshot();controller.selection={anchor:3,focus:3};const passiveDeadline=Date.now()+2000;while(interaction.snapshot()<=passiveCommit){check(Date.now()<passiveDeadline,'The focused field did not publish its changed selection');await delay(10);}await pixels('Focused field selection after explicit canvas transfer');
 const preservedCanvas=await fixture.semanticsNativeFocus(peerTag,tag,false);check(focus.hasFocus&&preservedCanvas.focused===preservedCanvas.canvas,'A metadata-only publication reclaimed native peer focus from the canvas');
 await automation('focus');const restoredPeer=await fixture.semanticsNativeFocus(peerTag,tag,false);check(restoredPeer.focused===restoredPeer.peer,'An explicit UIA focus request stopped working after passive synchronization');
 passiveFocusEvidence={queuedNativeRetained:true,canvasPreserved:true,explicitUiaRestored:true};trace({passiveFocus:passiveFocusEvidence});stage='actual Fabric UIA';
 const accessible=await automation('query');check(accessible.text===controller.text&&accessible.caretActive&&accessible.visible!>0,'Actual UIA Text/Text2 did not expose current Core text/caret/visible geometry');
 await automation('select');const selected=Date.now()+5000;while(readSelection().anchor!==1||readSelection().focus!==4){check(Date.now()<selected,'Actual UIA selection did not reach the same Core delegate');await delay(20);}
 const replaced=await automation('replace');check(replaced.text==='Core UIA 😀'&&replaced.textEvents!>0,'Actual UIA replacement did not raise Core publication events');await document('Core UIA 😀',false);await resetDocument();await pixels('Core pixels after actual Fabric UIA edits');
 stage='actual UIA metadata and retained range';const metadata=automation('metadata');void metadata.catch(()=>{});const metadataEnd=Date.now()+12000;let lastPhase=0;while(lastPhase<3){check(Date.now()<metadataEnd,'Actual UIA metadata subscription did not advance: '+lastPhase);const phase=fixture.semanticsPhase();if(phase>lastPhase){lastPhase=phase;configuration.value=phase===1?{readOnly:true,obscureText:false}:phase===2?{readOnly:true,obscureText:true}:{readOnly:false,obscureText:false};}await delay(20);}const metadataReply=await metadata;check(metadataReply.observed,'Core metadata or retained range privacy failed');await pixels('Restored Core caret after metadata and privacy changes');
 stage='actual UIA range reveal';controller.text=Array.from({length:12},(_,index)=>'Range '+index).join('\n');controller.selection={anchor:0,focus:0};await document(controller.text,false);await delay(100);
 const originalRangeValue=controller.value,rangeRevision=controller.revision;for(const mode of ['scroll-top','scroll-bottom']){const reply=await automation(mode);check(reply.observed,'Actual UIA range scrolling failed');check(controller.revision===rangeRevision&&JSON.stringify(controller.value)===JSON.stringify(originalRangeValue)&&focus.hasFocus,'Range reveal changed Core document, selection, composition or focus');}await resetDocument();await pixels('Core caret after actual range reveal');
 stage='rapid actual OS keyboard';await fixture.keys();const typed=Date.now()+7000;while(readText()!=='ac'){check(Date.now()<typed,'Rapid Ctrl+A/a/b/Backspace/c did not preserve observed native/Core order: '+JSON.stringify({text:controller.text,selection:controller.selection,keyTrace}));await delay(20);}check(readSelection().anchor===2&&readSelection().focus===2,'Native printable insertion lost its collapsed Core selection');
 // Public setters are separate Core commands issued before either native
 // receipt. Their final value and directed selection must both synchronize.
 stage='rapid controller commands';controller.text='Skia input';controller.selection={anchor:4,focus:4};const restored=Date.now()+7000;
 while(nativeEditing?.text!==controller.text||nativeEditing.anchor!==4||nativeEditing.focus!==4){check(Date.now()<restored,'Rapid controller text/selection left the TSF shadow behind Core: '+JSON.stringify({text:controller.text,selection:controller.selection,nativeEditing}));await delay(20);}
 await pixels('Restored Core text/selection after rapid controller setters');
 check(controller.textRevision>0&&interaction.node('field','text-field')?.textRevision===controller.textRevision,'Actual OS/Core text changes lost their content revision before semantics publication');
 stage='rapid standalone characters';check(lastInsert&&nativeEditing,'Actual character insertion context missing');const [serviceId,clientId,,,oldFocus]=lastInsert;
 await native.command(serviceId,clientId,'focus',[]);const rejected=await native.insertText(serviceId,clientId,'!',nativeEditing.revision,oldFocus);check(rejected.status==='unavailable','An old TSF focus epoch wrote into the newly focused document');
 await fixture.characters('posted');const posted=Date.now()+5000;while(readText()!=='SkiaΩ input'){check(Date.now()<posted,'Standalone WM_CHAR was not observed: '+JSON.stringify({text:controller.text,nativeEditing}));await delay(20);}
 await fixture.characters('packet');const unicode=Date.now()+5000;while(readText()!=='SkiaΩ😀 input'){check(Date.now()<unicode,'Unicode VK_PACKET was not observed: '+JSON.stringify({text:controller.text,nativeEditing}));await delay(20);}check(standaloneInsertions===2,'Standalone characters bypassed or duplicated their observed text route: '+standaloneInsertions);
 controller.text='Skia input';controller.selection={anchor:4,focus:4};await pixels('Restored Core text after standalone characters');

 if(imeProbe){
  stage='rapid actual TSF IME';const before=insertions,mode=await fixture.ime('open');check(mode.open!==0&&(mode.conversion&1)!==0,'Actual thread IME did not enter native mode: '+JSON.stringify(mode));
  await compose();await commit('Skia가 input');check(insertions===before,'IME commit used the printable writer');
  stage='rapid actual IME consumed modifiers';await resetDocument();const barrier=releasedBarrier;await compose(true);await fixture.ime('barrier');const released=Date.now()+7000;while(releasedBarrier===barrier){check(Date.now()<released,'Actual F24 keyup did not drain the owned native/Core keyboard sequence');await delay(20);}const root=application.view.controller;check(root instanceof FrameworkRoot,'Actual fixture lost its canonical Core Root');const snapshot=await RN.NativeModules.RNSkiaModule.getKeyboardState();check(snapshot.protocol===1&&snapshot.target==='windows'&&snapshot.keys.length===0&&root.buildOwner.keyboard.physicalKeysPressed.size===0&&root.buildOwner.rawKeyboard.physicalKeysPressed.size===0,'TSF-consumed keys left native/modern/raw pressed state: '+JSON.stringify({snapshot,modern:[...root.buildOwner.keyboard.physicalKeysPressed].map(key=>key.usbHidUsage),raw:[...root.buildOwner.rawKeyboard.physicalKeysPressed].map(key=>key.usbHidUsage)}));await commit('Skia까 input');
  stage='rapid actual IME clear and history';await resetDocument();await compose();let cleared=0;const clearCompletions=()=>cleared;controller.clear(()=>cleared++);check(cleared===0,'Active IME clear completed before actual cancellation');await document('',false,()=>cleared===1);check(controller.undo(),'IME clear did not retain its committed Core undo value');await document('Skia input',false);check(controller.redo(),'IME clear undo did not retain redo');await document('',false);check(clearCompletions()===1,'IME clear completion was duplicated');
  stage='rapid actual IME reset';await resetDocument();await compose();let reset=0;controller.reset('Skia input',()=>reset++);check(reset===0,'Active IME reset completed before actual cancellation');await document('Skia input',false,()=>reset===1);check(!controller.canUndo&&!controller.canRedo,'Active IME reset retained old Core history');
  stage='rapid actual IME focus';await resetDocument();await compose();focus.unfocus();await document('Skia가 input',false,()=>nativeEditing?.focused===false);focus.requestFocus();const refocused=Date.now()+7000;while(!nativeEditing?.focused){check(Date.now()<refocused,'Actual IME focus did not return to its TSF client');await delay(20);}await pixels('Core caret after actual IME focus transfer');
  stage='rapid actual IME resize';await resetDocument();await compose();
 }

 stage=imeProbe?'rapid actual IME resize':'resize';
 const resizeText=controller.text,resizeSelection={...controller.selection},resizeComposing=controller.isComposing;
 holdGeometry=true;await fixture.resize();let stale:unknown;const expiry=Date.now()+5000;do{stale=await fixture.probe(tag,readSelection().focus);if((stale as {generation:number}).generation>first.generation)break;await delay(30);}while(Date.now()<expiry);
 check((stale as {generation:number}).generation>first.generation,'Actual native resize did not replace the backing');check((stale as {noLayout:boolean}).noLayout,'Old Core geometry survived a native backing change: '+JSON.stringify(stale));
 holdGeometry=false;for(const args of held.splice(0))await native.command(...args);const resized=await pixels('Resized actual Core/Skia caret');check(resized.textWindowFocused,'Resize changed the actual TSF input HWND association');check(resized.generation>first.generation,'Resized caret used the old surface');if(imeProbe)check(resized.composingPaint?.pixels>=20,'Actual Core composing underline pixels missing after backing resize');check(resized.green.left!==first.green.left||resized.green.top!==first.green.top,'Actual caret did not move after resize');
 check(controller.text===resizeText&&readSelection().anchor===resizeSelection.anchor&&readSelection().focus===resizeSelection.focus&&controller.isComposing===resizeComposing,'Resize replaced the Core document/selection/composition');
 if(imeProbe){stage='rapid actual IME resize commit';await commit('Skia가 input');await fixture.ime('restore');await resetDocument();}
 check(maxFramePublications<=32,'TSF same-frame geometry query feedback did not converge: '+maxFramePublications);
 stage='actual editor opacity animation';const beforeAnimation=controller.text,selectionBeforeAnimation=JSON.stringify(controller.selection);
 for(const target of [.9,1]){const completed=opacityCompletions,deadline=Date.now()+5000;opacity.value=target;while(opacityCompletions===completed){check(Date.now()<deadline,'Actual Core opacity animation did not complete');await delay(20);}}
 check(controller.text===beforeAnimation&&JSON.stringify(controller.selection)===selectionBeforeAnimation,'The real animated editor replaced its document or selection');await pixels('Actual Core/Skia caret after opacity animation');
 await fixture.beginCloseProducerProbe();controller.text+=' close';application.view.requestFrame();
 await finish(true,'actual GPU-bound Core paragraph/caret pixels inside TSF screen bounds and original native paragraph ticket/range/hit with actual context/resource rejection and Core-to-screen range/visible/hit/reentrant mapping fences, actual registered nonvisual Fabric UIA Text/Text2/Value reads, Core selection and replacement, TextChanged and live range update, actual UIA range top/bottom alignment without editing or focus changes, readonly/password/pattern metadata notifications and permanently retired privacy ranges, rapid OS-injected Ctrl+A/a/b/Backspace/c, public controller text/selection setters, queued WM_CHAR/Unicode VK_PACKET and stale-focus rejection observed through Core and TSF, '+(imeProbe?'configured Korean TSF composition/commit, Shift/consumed-key release in native/modern/raw state, active clear/Undo/Redo/reset, focus and composing backing resize, ':'')+'same-frame geometry publications max='+maxFramePublications+', Fabric tag, native static envelopes, backing-resize NOLAYOUT fence and live document preservation; normal close must drain both GPU and input. Public default surface/provider with one typed Core Invoke, eight UIA blur/focus cycles and a held native receipt across a newer React commit exercised; physical hardware/IME and reader remain notVerified.\nINPUT_QUEUED_FOCUS '+JSON.stringify(queuedFocusEvidence)+'\nINPUT_PASSIVE_FOCUS '+JSON.stringify(passiveFocusEvidence));
}
let firstContentReady=false;
function App(){return React.createElement(NativeLayer,{style:{flex:1,padding:17,backgroundColor:'#101827'}},React.createElement(Surface,{definition,generation:owner.generation,viewId:owner.id,interaction,initializePlatformServices:false,onFirstContentReady:()=>{firstContentReady=true;},onReady:application=>{void run(application).catch(fail);},onError:fail,onClose:()=>{traceSubscription?.remove();controller.dispose();focus.dispose();configuration.dispose();opacity.dispose();interaction.dispose();}}));}
registerApplication('NelyxInputSurfaceFixture',App,{profile:'rn-graphite-vulkan',cohort:'rn-0.83.10',assets:{manifest:[{id:'fixture-font',kind:'font',path:'./fixture.ttf',fontFamily:'FixtureFont',sha256:'__FONT_SHA__'}],sources:{'fixture-font':{uri:'nelyx-asset:/fixture.ttf'}}}});
