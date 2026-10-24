import type { Disposable } from '../foundation/disposable.ts';
import type { SemanticsNode, TextEditingValue, ViewOwner,EditingGeometry,TextInputGeometry,TextInputCharacterBounds,TextInputGeometryStamp,TextInputRangeBounds,TextInputHitOptions,TextInputHitTest } from '../ui/types.ts';
import type {Offset} from '../ui/geometry.ts';
import type {SemanticsAction,SemanticsTextAction} from '../ui/types.ts';
import type {PointerEvent,InputFocusRequest} from '../ui/input.ts';

export interface EditingCapabilities {
  readonly indexUnit: 'utf16';
  readonly composing: 'observed' | 'unavailable';
  readonly selectionDirection: 'observed' | 'unavailable';
  readonly geometry?:'observed'|'unavailable';
}
export type TextInputAction='enter'|'done'|'go'|'next'|'previous'|'search'|'send';
export type EditingSynchronizationRejection='stale'|'composing'|'retry-limit';
/** Core input availability is independent of visibility in the semantics tree. */
export interface EditingInputState {readonly enabled:boolean;readonly focusable:boolean;readonly label:string}
export type {EditingConfiguration,EditingConfigurationOptions,EditingKeyboardType,EditingCapitalization} from './editing-configuration.ts';
export {freezeEditingConfiguration,editingConfigurationKey} from './editing-configuration.ts';
export interface EditingOptions {
  readonly readInputState?:()=>EditingInputState;
  /** The owning Core document; this is distinct from the OS input buffer. */
  readonly readValue?:()=>Pick<TextEditingValue,'text'|'selection'|'composing'>;
  /** Null defers an IME bounds request until the next current Core layout. */
  readonly readCharacterBounds?:(start:number,end:number,expected?:TextInputGeometryStamp)=>TextInputCharacterBounds|null;
  readonly readRangeBounds?:(start:number,end:number,expected?:TextInputGeometryStamp)=>TextInputRangeBounds|null;
  readonly readTextPosition?:(point:Offset,options:TextInputHitOptions,expected?:TextInputGeometryStamp)=>TextInputHitTest|null;
  /** An observed negative acknowledgement for one connection-local request.
   * This is transport completion, not a new Core editing value. */
  readonly synchronizationRejected?:(request:number,reason:EditingSynchronizationRejection)=>void;
  readonly configuration?:import('./editing-configuration.ts').EditingConfigurationOptions;readonly id:string;readonly focusChanged?:(focused:boolean)=>void;readonly action?:TextInputAction;readonly onAction?:(value:TextEditingValue)=>void;readonly onUndo?:()=>boolean;readonly onRedo?:()=>boolean}
export interface EditingBinding extends Disposable {
  /** Composition activity may be observable even when its exact range is unavailable. */
  readonly isComposing?:boolean;
  read(): TextEditingValue;
  replace(value: TextEditingValue,request?:number): void;
  /** Cancel native composition and replace its value atomically. The host must
   * acknowledge the actual value before Core changes its controller. */
  replaceComposing?(value: TextEditingValue,request?:number): void;
  focus(request?:InputFocusRequest): void;
  blur():void;
  readGeometry?():EditingGeometry;
  revealCaret?():void;
  /** Core -> OS; null withdraws unavailable coordinates without acknowledging editing content. */
  updateGeometry?(geometry:TextInputGeometry|null):void;
}
export interface EditingHost extends Disposable {
  readonly capabilities: EditingCapabilities;
  bind(owner: ViewOwner, initial: TextEditingValue, changed: (value: TextEditingValue) => void, options?:EditingOptions): EditingBinding;
}
export interface SemanticsBinding extends Disposable {update?(nodes:readonly SemanticsNode[]):void}
/** Host actions and real control pointer observations reach the owning View's
 * global routes without re-running canvas hit testing. */
export interface SemanticsInputObserver {
  dispatchAction(id:string,action:SemanticsAction,perform:()=>void):void;
  dispatchTextAction?(id:string,action:SemanticsTextAction,perform:()=>void):void;
  observePointer?(event:Omit<PointerEvent,'viewportGeneration'>):void;
}
export interface SemanticsHost extends Disposable {
  readonly capability: 'native-controls' | 'dom' | 'unavailable';
  bind(nodes: readonly SemanticsNode[],observer?:SemanticsInputObserver): SemanticsBinding;
}

/** Synchronous DOM-owner capability. A worker cannot substitute an async reply. */
export interface NativeSelectionContextMenuGeometry {
  readonly width:number;readonly height:number;readonly transform:readonly number[];
  readonly paintOrder:readonly number[];
}
export interface NativeSelectionContextMenuBinding extends Disposable {update():void}
/** DOM objects stay opaque to the platform-independent Core. */
export type RegisterSelectionViewFactory=(viewType:string,factory:(viewId:number)=>object,options?:{readonly isVisible?:boolean})=>void;
export interface NativeSelectionContextMenuRegistration {
  readonly generation:number;
  readonly registerOverride:RegisterSelectionViewFactory|null;
  readonly selectWord:(localOffset:{readonly x:number;readonly y:number})=>string|null;
}
export interface NativeSelectionContextMenuHost extends Disposable {
  /** Synchronously reject new bindings and callbacks before asynchronous View drain. */
  stop():void;
  /** Register once per DOM document/generation, when the widget first builds. */
  registerViewFactory?(registration:NativeSelectionContextMenuRegistration):void;
  bind(owner:ViewOwner,callbacks:{
    readonly readGeometry:()=>NativeSelectionContextMenuGeometry|null;
    /** Null means no active/visible client; empty text is a valid selection result. */
    readonly selectWord:(localOffset:{readonly x:number;readonly y:number})=>string|null;
  }):NativeSelectionContextMenuBinding;
}
