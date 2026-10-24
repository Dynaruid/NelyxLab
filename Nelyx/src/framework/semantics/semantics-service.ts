// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from pinned Flutter semantics/semantics_service.dart.
import type {BinaryMessenger} from '../../services/binary-messenger.ts';
import {SystemChannels,SystemChannelSet} from '../../services/system-channels.ts';
import {PlatformDispatcher} from '../../ui/platform-dispatcher.ts';
import type {PlatformViewIdentity} from '../../ui/platform-dispatcher.ts';
import {FlutterError} from '../../foundation/flutter-error.ts';
import {FoundationBuildMode} from '../../foundation/constants.ts';
import {AnnounceSemanticsEvent,Assertiveness,TooltipSemanticsEvent} from './semantics-event.ts';

/** Explicit application messenger replaces the source's process-wide binding. */
export interface SemanticsServiceOptions {readonly messenger?:BinaryMessenger;readonly assertiveness?:Assertiveness}
/** The source service only reads viewId. The SDK supplies an actual registered
 * identity; this port does not claim the full FlutterView rendering API. */
export interface SemanticsServiceView {readonly viewId:number;readonly platformDispatcher?:PlatformDispatcher}
export class SemanticsService {
  private constructor(){}
  private static channel(messenger?:BinaryMessenger){return messenger?new SystemChannelSet(messenger).accessibility:SystemChannels.accessibility;}
  /** @deprecated Use sendAnnouncement with the actual owning View. */
  static async announce(message:string,textDirection:'ltr'|'rtl',{assertiveness=Assertiveness.polite,messenger}:SemanticsServiceOptions={}):Promise<void>{
    const dispatcher=messenger?PlatformDispatcher.forMessenger(messenger):PlatformDispatcher.instance,view=dispatcher.implicitView;
    if(view===null&&FoundationBuildMode.debug)throw new FlutterError('SemanticsService.announce is incompatible with multiple windows. Use SemanticsService.sendAnnouncement instead.');
    if(view===null)throw new TypeError('The platform has no implicit View');
    const event=new AnnounceSemanticsEvent(message,textDirection,view.viewId,{assertiveness});
    await this.channel(messenger??dispatcher.binaryMessenger).send(event.toMap());
  }
  static async sendAnnouncement(view:SemanticsServiceView,message:string,textDirection:'ltr'|'rtl',{assertiveness=Assertiveness.polite,messenger}:SemanticsServiceOptions={}):Promise<void>{
    const event=new AnnounceSemanticsEvent(message,textDirection,view.viewId,{assertiveness});
    if(view.platformDispatcher){if(!view.platformDispatcher.isViewActive(view as PlatformViewIdentity))return;if(messenger&&messenger!==view.platformDispatcher.binaryMessenger)throw new FlutterError('Announcement messenger must belong to its View');messenger??=view.platformDispatcher.binaryMessenger;}
    await this.channel(messenger).send(event.toMap());
  }
  static async tooltip(message:string,messenger?:BinaryMessenger):Promise<void>{const event=new TooltipSemanticsEvent(message);await this.channel(messenger).send(event.toMap());}
}
