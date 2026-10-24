// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// DOM policy from the pinned _platform_selectable_region_context_menu_web.dart.
import type {NativeSelectionContextMenuHost,NativeSelectionContextMenuGeometry,NativeSelectionContextMenuRegistration} from '@nelyx/core/hosting/interaction';
import type {ViewOwner} from '@nelyx/core/ui/types';
import {sameOwner} from '@nelyx/core/ui/frame';
import type {BrowserMouseCursor} from './mouse-cursor.ts';

const viewType='Browser__WebContextMenuViewType__',className='web-selectable-region-context-menu';
interface FactoryElement {handler:(event:MouseEvent)=>void;readonly down:(event:MouseEvent)=>void}
interface ViewFactory {readonly generation:number;readonly create:(viewId:number)=>HTMLDivElement}
const viewFactories=new WeakMap<Document,ViewFactory>();
const factoryElements=new WeakMap<HTMLDivElement,FactoryElement>();
const registeringDocuments=new WeakSet<Document>();
let nextViewId=0;
function createFactory(doc:Document,registration:NativeSelectionContextMenuRegistration):ViewFactory{
  return {generation:registration.generation,create:(_viewId:number)=>{
    const element=doc.createElement('div');element.classList.add(className);element.dataset.nelyxViewType=viewType;element.style.width=element.style.height='100%';
    const state:FactoryElement={handler:event=>{
      event.preventDefault();if(event.button!==2)return;
      const text=registration.selectWord({x:event.offsetX,y:event.offsetY});if(text===null)return;
      element.innerText=text;const range=doc.createRange();range.selectNode(element);const selection=doc.defaultView?.getSelection();if(selection){selection.removeAllRanges();selection.addRange(range);}
    },down:event=>state.handler(event)};
    factoryElements.set(element,state);element.addEventListener('mousedown',state.down);return element;
  }};
}
const styleOwners=new WeakMap<Document,{element:HTMLStyleElement;owners:number}>();
function acquireStyle(doc:Document):()=>void{
  let style=styleOwners.get(doc);
  if(!style){const element=doc.createElement('style');doc.head.appendChild(element);try{const sheet=element.sheet;if(!sheet)throw new Error('Native selection stylesheet is unavailable');sheet.insertRule(`.${className} {color:transparent;user-select:text;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;}`,0);sheet.insertRule(`.${className}::selection {background:transparent;}`,1);}catch(error){element.remove();throw error;}style={element,owners:0};styleOwners.set(doc,style);}
  style.owners++;const owned=style;let live=true;return ()=>{if(!live)return;live=false;if(--owned.owners===0){styleOwners.delete(doc);owned.element.remove();}};
}
interface Entry {readonly element:HTMLDivElement;readonly update:()=>void;readonly dispose:()=>void;geometry:NativeSelectionContextMenuGeometry|null}
/** One synchronous UI/DOM realm and one View. No async worker approximation. */
export class BrowserSelectionContextMenu implements NativeSelectionContextMenuHost {
  private closed=false;private stopped=false;private enabled=true;private root:HTMLDivElement|null=null;private releaseStyle:(()=>void)|null=null;
  private readonly entries=new Set<Entry>();private readonly doc:Document;private readonly parent:HTMLElement;
  constructor(readonly canvas:HTMLCanvasElement,readonly owner:ViewOwner,private readonly cursor?:BrowserMouseCursor){
    this.doc=canvas.ownerDocument;const parent=canvas.parentElement;if(!parent)throw new Error('Native selection requires an attached canvas');this.parent=parent;parent.addEventListener('contextmenu',this.contextMenu,true);
  }
  registerViewFactory(registration:NativeSelectionContextMenuRegistration):void{
    if(this.stopped)throw new Error('Native selection context-menu host is stopped');
    if(viewFactories.get(this.doc)?.generation===registration.generation)return;
    if(registeringDocuments.has(this.doc))throw new Error('Native selection view factory registration is reentrant');
    this.ensureRoot();const factory=createFactory(this.doc,registration);registeringDocuments.add(this.doc);
    try{registration.registerOverride?.(viewType,factory.create,{isVisible:false});if(this.stopped)throw new Error('Native selection host stopped during registration');viewFactories.set(this.doc,factory);}
    finally{registeringDocuments.delete(this.doc);}
  }
  private readonly contextMenu=(event:Event):void=>{if(!this.stopped&&!this.enabled&&(event.target===this.canvas||this.ownsTarget(event.target)))event.preventDefault();};
  setEnabled(enabled:boolean):void{if(this.stopped)throw new Error('Native selection context-menu host is stopped');this.enabled=enabled;}
  ownsTarget(target:EventTarget|null):boolean{if(this.stopped||target===null||!('nodeType'in target))return false;return [...this.entries].some(entry=>entry.element===target||entry.element.contains(target as Node));}
  private ensureRoot():HTMLDivElement{
    if(this.root)return this.root;
    const release=acquireStyle(this.doc),root=this.doc.createElement('div');root.setAttribute('aria-hidden','true');root.dataset.nelyxNativeSelection='';root.style.cssText='position:absolute;pointer-events:none;overflow:hidden;';
    try{this.parent.insertBefore(root,this.canvas.nextSibling);}catch(error){release();throw error;}this.releaseStyle=release;this.root=root;return root;
  }
  bind(owner:ViewOwner,callbacks:Parameters<NativeSelectionContextMenuHost['bind']>[1]):ReturnType<NativeSelectionContextMenuHost['bind']>{
    if(this.stopped||!sameOwner(owner,this.owner))throw new Error('Native selection binding has a stopped or foreign View owner');
    const root=this.ensureRoot(),factory=viewFactories.get(this.doc)??createFactory(this.doc,{generation:-1,registerOverride:null,selectWord:()=>null}),element=factory.create(nextViewId++),factoryState=factoryElements.get(element)!;
    element.style.cssText='position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:auto;display:none;';let alive=true,ownedRange:Range|null=null;
    const current=()=>alive&&!this.stopped&&this.entries.has(entry);
    const clearRange=()=>{const selection=this.doc.defaultView?.getSelection();if(ownedRange&&selection)for(let i=selection.rangeCount-1;i>=0;i--)if(selection.getRangeAt(i)===ownedRange)selection.removeRange(ownedRange);ownedRange=null;};
    const update=()=>{
      if(!current())return;
      const geometry=callbacks.readGeometry();if(!current())return;
      // Never leave the previous interactive rectangle alive after an invalid update.
      entry.geometry=null;element.style.display='none';
      if(geometry===null){clearRange();return;}
      if(!Number.isFinite(geometry.width)||!Number.isFinite(geometry.height)||geometry.width<0||geometry.height<0||geometry.transform.length!==16||!geometry.transform.every(Number.isFinite)||!geometry.paintOrder.every(Number.isFinite))throw new Error('Invalid native selection geometry');
      entry.geometry=geometry;element.style.width=geometry.width+'px';element.style.height=geometry.height+'px';element.style.transform='matrix3d('+geometry.transform.join(',')+')';element.style.display=geometry.width&&geometry.height?'block':'none';
    };
    const down=(event:MouseEvent)=>{
      if(!current())return;event.preventDefault();if(event.button!==2||!this.enabled||entry.geometry===null)return;
      const text=callbacks.selectWord({x:event.offsetX,y:event.offsetY});if(!current())return;if(!this.enabled||text===null){clearRange();element.innerText='';return;}
      element.innerText=text;const range=this.doc.createRange();range.selectNode(element);const selection=this.doc.defaultView?.getSelection();if(selection){selection.removeAllRanges();selection.addRange(range);ownedRange=range;}
    };
    const dispose=()=>{
      if(!alive)return;alive=false;this.entries.delete(entry);const errors:unknown[]=[];
      factoryState.handler=()=>{};factoryElements.delete(element);
      for(const close of [()=>element.removeEventListener('mousedown',factoryState.down),clearRange,()=>this.cursor?.remove(element),()=>element.remove()])try{close();}catch(error){errors.push(error);}
      if(errors.length)throw new AggregateError(errors,'Native selection binding cleanup failed');
    };
    const entry:Entry={element,geometry:null,update,dispose};this.entries.add(entry);
    factoryState.handler=down;
    try{root.appendChild(element);this.cursor?.add(element);if(!current())throw new Error('Native selection binding stopped during initialization');}
    catch(error){const errors=[error];try{dispose();}catch(failure){errors.push(failure);}if(errors.length>1)throw new AggregateError(errors,'Native selection binding initialization failed');throw error;}
    return {update,dispose};
  }
  /** Run after every framework frame, including reused retained paint subtrees. */
  refresh():void{
    if(this.stopped||!this.root)return;
    const root=this.root,view=this.doc.defaultView,style=view?.getComputedStyle(this.canvas);
    root.style.left=this.canvas.offsetLeft+'px';root.style.top=this.canvas.offsetTop+'px';root.style.width=this.canvas.clientWidth+'px';root.style.height=this.canvas.clientHeight+'px';root.style.transform=style?.transform??'none';root.style.transformOrigin=style?.transformOrigin??'0 0';
    for(const entry of [...this.entries]){entry.update();if(this.stopped)return;}
    const order=[...this.entries].sort((a,b)=>{const first=a.geometry?.paintOrder??[],second=b.geometry?.paintOrder??[];for(let i=0;i<Math.min(first.length,second.length);i++){const difference=first[i]!-second[i]!;if(difference)return difference;}return first.length-second.length;});
    let anchor:Node|null=null;for(const entry of order.reverse()){if(entry.element.nextSibling!==anchor)root.insertBefore(entry.element,anchor);anchor=entry.element;}
  }
  stop():void{
    if(this.stopped)return;this.stopped=true;
    // Retain DOM/ranges until drain finishes, but make them inert immediately.
    this.parent.removeEventListener('contextmenu',this.contextMenu,true);
    if(this.root)this.root.style.display='none';
  }
  dispose():void{
    if(this.closed)return;this.closed=true;const errors:unknown[]=[];
    for(const close of [()=>this.stop(),...[...this.entries].map(entry=>entry.dispose),()=>this.root?.remove(),()=>this.releaseStyle?.()])try{close();}catch(error){errors.push(error);}
    this.entries.clear();this.root=null;this.releaseStyle=null;if(errors.length)throw new AggregateError(errors,'Native selection DOM cleanup failed');
  }
}
