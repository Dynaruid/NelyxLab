// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {ProxyWidget,ProxyElement,NotifiableElementMixin} from './framework.ts';
import type {BuildContext,Element,Widget} from './framework.ts';
import type {Key} from '../../foundation/key.ts';
import {invariant} from '../../foundation/errors.ts';
import {objectRuntimeType} from '../../foundation/object.ts';
import {protect} from '../../ui/value-math.ts';
export type NotificationListenerCallback<T extends Notification>=(notification:T)=>boolean;
export abstract class Notification {
  dispatch(target:BuildContext|null):void{target?.dispatchNotification(this);}
  protected debugFillDescription(_description:string[]):void{}
  toString():string{const description:string[]=[];this.debugFillDescription(description);return `${objectRuntimeType(this,'Notification')}(${description.join(', ')})`;}
}
export type NotificationType<T extends Notification>=abstract new (...args:any[])=>T;
/** A constructor token preserves Dart's generic runtime filter after TS erasure. */
export interface NotificationListenerOptions<T extends Notification> {readonly child:Widget;readonly key?:Key|null;readonly notificationType:NotificationType<T>;readonly onNotification?:NotificationListenerCallback<T>|null}
export class NotificationListener<T extends Notification=Notification> extends ProxyWidget {
  readonly notificationType:NotificationType<T>;readonly onNotification:NotificationListenerCallback<T>|null;
  constructor({child,key=null,notificationType,onNotification=null}:NotificationListenerOptions<T>){super(child,{key});this.notificationType=notificationType;this.onNotification=onNotification;protect(this,['notificationType','onNotification']);}
  createElement():Element{return new _NotificationElement(this);}
}
class _NotificationElement<T extends Notification> extends NotifiableElementMixin(ProxyElement) {
  onNotification(notification:Notification):boolean{const listener=this.widget as NotificationListener<T>;if(listener.onNotification!==null&&notification instanceof listener.notificationType){const result=listener.onNotification(notification);invariant(typeof result==='boolean','invalid-notification-listener-result','NotificationListener must return a boolean');return result;}return false;}
  protected notifyClients(_oldWidget:ProxyWidget):void{}
}
export class LayoutChangedNotification extends Notification {}
