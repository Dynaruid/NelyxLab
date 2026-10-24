// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Deprecated KeyMessage from pinned services/hardware_keyboard.dart.
import type {KeyEvent} from './hardware-keyboard.ts';
import type {RawKeyEvent} from './raw-key-event.ts';
export class KeyMessage {
  readonly events:readonly KeyEvent[];
  constructor(events:readonly KeyEvent[],readonly rawEvent:RawKeyEvent|null){this.events=Object.freeze([...events]);Object.freeze(this);}
  toString():string{return `KeyMessage(${this.events.map(event=>event.constructor.name).join(', ')})`;}
}
export type KeyMessageHandler=(message:KeyMessage)=>boolean;
