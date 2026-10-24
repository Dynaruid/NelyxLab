// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
import {invariant} from '../../foundation/errors.ts';
/** Uri is represented by the resolved host URL string. */
export class NetworkImageLoadException extends Error {
  readonly statusCode:number;readonly uri:string;
  constructor({statusCode,uri}:{readonly statusCode:number;readonly uri:string}){invariant(Number.isSafeInteger(statusCode),'invalid-image-http-status','HTTP image status must be an integer');super(`HTTP request failed, statusCode: ${statusCode}, ${uri}`);this.statusCode=statusCode;this.uri=uri;this.name='NetworkImageLoadException';}
  override toString():string{return this.message;}
}
