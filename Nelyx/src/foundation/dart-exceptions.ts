// SPDX-License-Identifier: BSD-3-Clause
/** Host diagnostic text, not Dart VM frame or StackTrace object equivalence. */
export type DartStackTrace=string;
export interface DartCaughtException {readonly exception:{};readonly stackTrace:DartStackTrace}
/** Preserve non-null thrown values. JS null/undefined throws become a host error.
 * Native Error data stacks are retained; other values get a catch-site JS trace.
 * Do not invoke an application-defined stack getter while handling its failure. */
export function captureDartException(value:unknown):DartCaughtException {
  const exception=value==null?new TypeError('Dart exceptions require a non-null value'):value;
  let stackTrace:string|undefined;
  if(typeof exception==='object'||typeof exception==='function'){
    try{const descriptor=Object.getOwnPropertyDescriptor(exception,'stack');if(typeof descriptor?.value==='string')stackTrace=descriptor.value;}catch{/* A hostile Proxy cannot replace the original exception. */}
  }
  return {exception,stackTrace:stackTrace??new Error('Caught host exception').stack??'Caught host exception'};
}
