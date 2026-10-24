// SPDX-License-Identifier: BSD-3-Clause
// Reviewed Doroti/Flutter adaptation, updated against locked listen 1.0.1; pins/notices in upstream and licenses.
import {invariant,exceptionStack} from './errors.ts';
export type NotificationErrorContext='listener'|'assertion';
export abstract class Listenable {
  static onError:(error:unknown,stack:string|undefined,context:NotificationErrorContext)=>void=error=>{throw error;};
  /** Instrumentation is opt-in because core has no implicit debug/release process global. */
  static debugInstrumentationEnabled=false;
  static debugMaybeDispatchCreated:((className:string,object:object)=>void)|undefined;
  static debugMaybeDispatchDisposed:((object:object)=>void)|undefined;
  static merge(listenables:Iterable<Listenable|null|undefined>):Listenable{return new MergingListenable(listenables);}
  abstract addListener(listener:()=>void):void;
  abstract removeListener(listener:()=>void):void;
}
export abstract class ValueListenable<T> extends Listenable {abstract get value():T;}
class MergingListenable extends Listenable {
  private readonly children:readonly Listenable[];
  constructor(children:Iterable<Listenable|null|undefined>){super();this.children=Object.freeze([...children].filter((child):child is Listenable=>child!=null));}
  addListener(listener:()=>void):void{
    const registered:Listenable[]=[];
    try{for(const child of this.children){child.addListener(listener);registered.push(child);}}
    catch(error){const errors:unknown[]=[error];for(const child of registered.reverse())try{child.removeListener(listener);}catch(failure){errors.push(failure);}if(errors.length>1)throw new AggregateError(errors,'Merged listener registration failed');throw error;}
  }
  removeListener(listener:()=>void):void{
    const errors:unknown[]=[];for(const child of this.children)try{child.removeListener(listener);}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'Merged listener removal failed');
  }
}
export class ChangeNotifier extends Listenable {
  private listeners: (((() => void)) | null)[] = [];
  private depth = 0;
  private closed = false;
  private count=0;
  private creationDispatched=false;
  constructor(private readonly reportError?: (error: unknown) => void) {super();}
  static debugAssertNotDisposed(notifier:ChangeNotifier):boolean{
    try{notifier.ensureAlive();return true;}catch(error){Listenable.onError(error,exceptionStack(error)??undefined,'assertion');return false;}
  }
  static maybeDispatchObjectCreation(notifier:ChangeNotifier):void{
    if(Listenable.debugInstrumentationEnabled&&!notifier.creationDispatched){notifier.creationDispatched=true;Listenable.debugMaybeDispatchCreated?.('ChangeNotifier',notifier);}
  }
  protected ensureAlive():void {invariant(!this.closed,'disposed-notifier','Notifier used after dispose');}
  get hasListeners(): boolean { return this.count>0; }
  addListener(listener: () => void): void {this.ensureAlive();ChangeNotifier.maybeDispatchObjectCreation(this);this.listeners.push(listener);this.count++;}
  removeListener(listener: () => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {this.count--;if (this.depth) this.listeners[index] = null; else this.listeners.splice(index,1);}
  }
  notifyListeners(): void {
    invariant(!this.closed,'disposed-notifier','notifyListeners after dispose');
    this.depth++; const end = this.listeners.length; const errors: unknown[] = [];
    try { for(let index=0;index<end;index++) try { this.listeners[index]?.(); } catch(error) { errors.push(error); } }
    finally { if (--this.depth === 0) this.listeners = this.listeners.filter(listener => listener !== null); }
    // Continue notifying before reporting errors, even when the application's reporter throws.
    const reporting: unknown[] = []; for (const error of errors) try {if(this.reportError)this.reportError(error);else Listenable.onError(error,exceptionStack(error)??undefined,'listener');} catch(error) { reporting.push(error); }
    if (reporting.length) throw new AggregateError(reporting,'notifier listeners failed');
  }
  dispose(): void {
    invariant(this.depth === 0,'notifier-dispose-during-notification','dispose during notification');
    if (this.closed) return; this.closed = true; this.listeners = [];this.count=0;
    if(Listenable.debugInstrumentationEnabled&&this.creationDispatched)Listenable.debugMaybeDispatchDisposed?.(this);
  }
}
export class ValueNotifier<T> extends ChangeNotifier implements ValueListenable<T> {
  constructor(private current: T, private readonly equal: (a:T,b:T)=>boolean = (a,b)=>a===b, reportError?: (error:unknown)=>void) {super(reportError);ChangeNotifier.maybeDispatchObjectCreation(this);}
  get value(): T { return this.current; }
  set value(next: T) {this.ensureAlive();if (this.equal(this.current,next)) return; this.current=next; this.notifyListeners(); }
}
