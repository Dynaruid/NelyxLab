// SPDX-License-Identifier: BSD-3-Clause
import type {ComponentRef,Ref,ReactNode} from 'react';
import type {HostComponent,ViewProps,NativeSyntheticEvent} from 'react-native';
import type {ViewRuntime} from '@nelyx/core/hosting/runtime';
import type {KeyEvent} from '@nelyx/core/ui/input';
import type {ReactNativeBackend} from './registration.ts';
export interface AndroidKeySnapshot extends KeyEvent {
  readonly character:string|null;
  readonly sequence:number;readonly keyCode:number;readonly scanCode:number;readonly deviceId:number;readonly source:number;readonly metaState:number;readonly repeatCount:number;readonly flags:number;
  readonly codePoint:number;readonly plainCodePoint:number;readonly complexCharacter:string;readonly keyCharacter:string|null;readonly vendorId:number;readonly productId:number;readonly deviceAvailable:boolean;
  readonly timestamp:number;readonly downTime:number;readonly canceled:boolean;
}
interface NativeProps extends ViewProps {readonly keyboardProtocol:3;readonly onNelyxKey:(event:NativeSyntheticEvent<AndroidKeySnapshot>)=>void;readonly onNelyxKeyboardFocus:(event:NativeSyntheticEvent<{readonly focused:boolean;readonly sequence:number}>)=>void}
export interface AndroidKeyboardHandle {focus():void;getNativeTag():number|null}
export interface AndroidKeyboardProps extends ViewProps {readonly ref?:Ref<AndroidKeyboardHandle>;readonly children?:ReactNode;readonly readView:()=>ViewRuntime|undefined;readonly reportError:(error:unknown)=>void}
/** One acknowledgement for each admitted native key; late owners cannot dispatch to a replacement view. */
export class AndroidKeyConnection {
  private closed=false;private lastSequence=0;
  constructor(private readonly readView:()=>Pick<ViewRuntime,'controller'|'dispatchKey'|'dispatchRawKey'|'dispatchKeyboardFocusLost'|'dispatchKeyboardFocusGained'>|undefined,private readonly acknowledge:(sequence:number,handled:boolean)=>void,private readonly reportError:(error:unknown)=>void){}
  focusLost(sequence:number):void{if(this.closed)return;if(!Number.isSafeInteger(sequence)||sequence<=0){this.reportError(new Error('Invalid Android focus sequence'));return;}if(sequence<=this.lastSequence)return;this.lastSequence=sequence;this.readView()?.dispatchKeyboardFocusLost();}
  focusGained(sequence:number):void{if(this.closed)return;if(!Number.isSafeInteger(sequence)||sequence<=0){this.reportError(new Error('Invalid Android focus sequence'));return;}if(sequence<=this.lastSequence)return;this.lastSequence=sequence;this.readView()?.dispatchKeyboardFocusGained();}
  accept(snapshot:AndroidKeySnapshot):void {
    const sequence=snapshot?.sequence;if(!Number.isSafeInteger(sequence)||sequence<=0){this.reportError(new Error('Invalid Android key sequence'));return;}
    if(this.closed){this.acknowledge(sequence,false);return;}
    let handled=false;
    try {
      if(sequence<=this.lastSequence)throw new Error('Duplicate or reordered Android key event');this.lastSequence=sequence;
      if(!['down','up'].includes(snapshot.kind)||typeof snapshot.key!=='string'||snapshot.key.length===0||snapshot.key.length>64||['shift','control','alt','meta','repeat','canceled'].some(k=>typeof snapshot[k as keyof AndroidKeySnapshot]!=='boolean')||['keyCode','scanCode','deviceId','source','metaState','repeatCount'].some(k=>!Number.isSafeInteger(snapshot[k as keyof AndroidKeySnapshot]))||!Number.isFinite(snapshot.timestamp)||!Number.isFinite(snapshot.downTime)||snapshot.timestamp<snapshot.downTime||snapshot.repeatCount<0)throw new Error('Invalid Android key snapshot');
      if(!(snapshot.character===null||typeof snapshot.character==='string'&&snapshot.character.length>0&&snapshot.character.length<=64)||snapshot.kind==='up'&&snapshot.character!==null)throw new Error('Invalid Android key character');
      if(['flags','codePoint','plainCodePoint','vendorId','productId'].some(k=>!Number.isSafeInteger(snapshot[k as keyof AndroidKeySnapshot]))||typeof snapshot.deviceAvailable!=='boolean'||!snapshot.deviceAvailable&&(snapshot.vendorId!==0||snapshot.productId!==0)||snapshot.vendorId<0||snapshot.productId<0||typeof snapshot.complexCharacter!=='string'||snapshot.complexCharacter.length!==1)throw new Error('Matching Android raw keyboard protocol3 fields are required');
      if(!(snapshot.keyCharacter===null||typeof snapshot.keyCharacter==='string'&&snapshot.keyCharacter.length===1&&snapshot.keyCharacter!=='\0')||snapshot.kind==='up'&&snapshot.keyCharacter!==null)throw new Error('Invalid Android modern key character');
      const event:KeyEvent=Object.freeze({kind:snapshot.kind,key:snapshot.key,character:snapshot.character,shift:snapshot.shift,control:snapshot.control,alt:snapshot.alt,meta:snapshot.meta,repeat:snapshot.repeat,timestamp:snapshot.timestamp,platform:'android',android:Object.freeze({keyCode:snapshot.keyCode,scanCode:snapshot.scanCode,deviceId:snapshot.deviceId,source:snapshot.source,metaState:snapshot.metaState,...(snapshot.flags!==undefined?{flags:snapshot.flags}:{})}),locks:Object.freeze({capsLock:(snapshot.metaState&0x100000)!==0,numLock:(snapshot.metaState&0x200000)!==0,scrollLock:(snapshot.metaState&0x400000)!==0})});
      const view=this.readView();handled=view?.controller?.rawKey?view.dispatchRawKey(Object.freeze({type:snapshot.kind==='down'?'keydown':'keyup',keymap:'android',flags:snapshot.flags,codePoint:snapshot.codePoint,plainCodePoint:snapshot.plainCodePoint,keyCode:snapshot.keyCode,scanCode:snapshot.scanCode,metaState:snapshot.metaState,character:snapshot.complexCharacter,source:snapshot.source,deviceId:snapshot.deviceId,vendorId:snapshot.vendorId,productId:snapshot.productId,repeatCount:snapshot.repeatCount}),Object.freeze({...event,character:snapshot.keyCharacter}))===true:view?.dispatchKey(event)===true;
    } catch(error){this.reportError(error);}finally{this.acknowledge(sequence,handled);}
  }
  dispose():void {this.closed=true;}
}
export function createAndroidKeyboardHost(getBackend:()=>Pick<ReactNativeBackend,'react'|'native'>) {
  let NativeHost:HostComponent<NativeProps>|undefined;
  return function AndroidKeyboardHost({readView,reportError,ref:forwarded,...props}:AndroidKeyboardProps) {
    const {react,native}=getBackend();
    if(!NativeHost){const config=native.UIManager.getViewManagerConfig('NelyxKeyboardHost'),constants=config&&'Constants'in config?config.Constants:undefined;if(!constants||typeof constants!=='object'||!('keyboardProtocol'in constants)||constants.keyboardProtocol!==3)throw new Error('Matching Android keyboard host protocol3 is required');NativeHost=native.requireNativeComponent<NativeProps>('NelyxKeyboardHost');}
    const ref=react.useRef<ComponentRef<HostComponent<NativeProps>>>(null),latest=react.useRef({readView,reportError});latest.current={readView,reportError};
    const connection=react.useRef<AndroidKeyConnection|undefined>(undefined);
    const acknowledge=(sequence:number,handled:boolean)=>{const tag=native.findNodeHandle(ref.current);if(tag!==null)native.UIManager.dispatchViewManagerCommand(tag,'acknowledgeKey',[sequence,handled]);};
    react.useLayoutEffect(()=>{const value=new AndroidKeyConnection(()=>latest.current.readView(),acknowledge,error=>latest.current.reportError(error));connection.current=value;return ()=>{value.dispose();if(connection.current===value)connection.current=undefined;};},[native]);
    react.useImperativeHandle(forwarded,()=>({getNativeTag(){return native.findNodeHandle(ref.current);},focus(){const tag=native.findNodeHandle(ref.current);if(tag!==null)native.UIManager.dispatchViewManagerCommand(tag,'focusCanvas',[]);}}),[native]);
    return react.createElement(NativeHost,{...props,ref,focusable:true,keyboardProtocol:3,onNelyxKey:event=>{if(connection.current)connection.current.accept(event.nativeEvent);else acknowledge(event.nativeEvent.sequence,false);},onNelyxKeyboardFocus:event=>{if(event.nativeEvent.focused)connection.current?.focusGained(event.nativeEvent.sequence);else connection.current?.focusLost(event.nativeEvent.sequence);}});
  };
}
