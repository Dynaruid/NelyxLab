// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from the pinned Flutter services/system_channels.dart.
import type {BinaryMessenger} from './binary-messenger.ts';
import {BasicMessageChannel,MethodChannel,OptionalMethodChannel} from './platform-channel.ts';
import {JSONMessageCodec,JSONMethodCodec,StandardMessageCodec,StringCodec} from './message-codecs.ts';

/** Channel declarations only. Availability belongs to the embedding plugin. */
export class SystemChannelSet {
  readonly navigation;readonly backGesture;readonly platform;readonly statusBar;
  readonly processText;readonly textInput;readonly scribe;readonly spellCheck;readonly undoManager;
  readonly keyEvent;readonly lifecycle;readonly system;readonly accessibility;
  readonly platform_views;readonly platform_views_2;readonly skia;readonly mouseCursor;
  readonly restoration;readonly deferredComponent;readonly localization;readonly menu;
  readonly contextMenu;readonly keyboard;readonly sensitiveContent;
  constructor(messenger:BinaryMessenger|null=null) {
    const optional=(name:string,json=false)=>new OptionalMethodChannel(name,json?new JSONMethodCodec():undefined,messenger);
    this.navigation=optional('flutter/navigation',true);this.backGesture=optional('flutter/backgesture');
    this.platform=optional('flutter/platform',true);this.statusBar=optional('flutter/status_bar',true);
    this.processText=optional('flutter/processtext');this.textInput=optional('flutter/textinput',true);
    this.scribe=optional('flutter/scribe',true);this.spellCheck=optional('flutter/spellcheck');this.undoManager=optional('flutter/undomanager',true);
    this.keyEvent=new BasicMessageChannel('flutter/keyevent',new JSONMessageCodec(),messenger);
    this.lifecycle=new BasicMessageChannel('flutter/lifecycle',new StringCodec(),messenger);
    this.system=new BasicMessageChannel('flutter/system',new JSONMessageCodec(),messenger);
    this.accessibility=new BasicMessageChannel('flutter/accessibility',new StandardMessageCodec(),messenger);
    this.platform_views=new MethodChannel('flutter/platform_views',undefined,messenger);
    this.platform_views_2=new MethodChannel('flutter/platform_views_2',undefined,messenger);
    this.skia=new MethodChannel('flutter/skia',new JSONMethodCodec(),messenger);
    this.mouseCursor=optional('flutter/mousecursor');this.restoration=optional('flutter/restoration');
    this.deferredComponent=optional('flutter/deferredcomponent');this.localization=optional('flutter/localization',true);
    this.menu=optional('flutter/menu');this.contextMenu=optional('flutter/contextmenu',true);
    this.keyboard=optional('flutter/keyboard');this.sensitiveContent=optional('flutter/sensitivecontent');
  }
}
/** Default-realm channels; concurrent applications use SystemChannelSet. */
export class SystemChannels {
  private static readonly channels=new SystemChannelSet();
  static readonly navigation=this.channels.navigation;static readonly backGesture=this.channels.backGesture;
  static readonly platform=this.channels.platform;static readonly statusBar=this.channels.statusBar;
  static readonly processText=this.channels.processText;static readonly textInput=this.channels.textInput;
  static readonly scribe=this.channels.scribe;static readonly spellCheck=this.channels.spellCheck;
  static readonly undoManager=this.channels.undoManager;static readonly keyEvent=this.channels.keyEvent;
  static readonly lifecycle=this.channels.lifecycle;static readonly system=this.channels.system;
  static readonly accessibility=this.channels.accessibility;static readonly platform_views=this.channels.platform_views;
  static readonly platform_views_2=this.channels.platform_views_2;static readonly skia=this.channels.skia;
  static readonly mouseCursor=this.channels.mouseCursor;static readonly restoration=this.channels.restoration;
  static readonly deferredComponent=this.channels.deferredComponent;static readonly localization=this.channels.localization;
  static readonly menu=this.channels.menu;static readonly contextMenu=this.channels.contextMenu;
  static readonly keyboard=this.channels.keyboard;static readonly sensitiveContent=this.channels.sensitiveContent;
}
