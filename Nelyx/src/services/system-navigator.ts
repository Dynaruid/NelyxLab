// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter services/system_navigator.dart.
import type {BinaryMessenger} from './binary-messenger.ts';
import {SystemChannels,SystemChannelSet} from './system-channels.ts';
import {FoundationPlatform} from '../foundation/platform.ts';
export class SystemNavigator {
  private static channels(messenger?:BinaryMessenger){return messenger?new SystemChannelSet(messenger):SystemChannels;}
  static async setFrameworkHandlesBack(frameworkHandlesBack:boolean,messenger?:BinaryMessenger):Promise<void>{if(FoundationPlatform.hostEnvironment.kind==='web'||FoundationPlatform.defaultTargetPlatform!=='android')return;await this.channels(messenger).platform.invokeMethod('SystemNavigator.setFrameworkHandlesBack',frameworkHandlesBack);}
  static async pop(animated:boolean|null=null,messenger?:BinaryMessenger):Promise<void>{await this.channels(messenger).platform.invokeMethod('SystemNavigator.pop',animated);}
  static async selectSingleEntryHistory(messenger?:BinaryMessenger):Promise<void>{await this.channels(messenger).navigation.invokeMethod('selectSingleEntryHistory');}
  static async selectMultiEntryHistory(messenger?:BinaryMessenger):Promise<void>{await this.channels(messenger).navigation.invokeMethod('selectMultiEntryHistory');}
  static async routeInformationUpdated(options:{readonly uri?:string;readonly location?:string;readonly state?:unknown;readonly replace?:boolean},messenger?:BinaryMessenger):Promise<void>{
    if((options.uri===undefined)===(options.location===undefined))throw new TypeError('Provide exactly one uri or location');
    await this.channels(messenger).navigation.invokeMethod('routeInformationUpdated',new Map<string,unknown>([['uri',options.uri??options.location!],['state',options.state??null],['replace',options.replace??false]]));
  }
}
