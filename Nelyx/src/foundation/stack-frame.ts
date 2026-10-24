// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Adapted from Flutter foundation/stack_frame.dart at the recorded pin.
import {invariant} from './errors.ts';
export interface StackFrameOptions {readonly number:number;readonly column:number;readonly line:number;readonly packageScheme:string;readonly package:string;readonly packagePath:string;readonly className?:string;readonly method:string;readonly isConstructor?:boolean;readonly source:string}
function uriParts(uri:string){const match=/^([a-zA-Z][a-zA-Z\d+.-]*):/.exec(uri),scheme=match?.[1]??'',body=match?uri.slice(match[0].length):uri;let pathname=body.split(/[?#]/,1)[0]!;if(pathname.startsWith('//')){const slash=pathname.indexOf('/',2);pathname=slash<0?'':pathname.slice(slash);}const segment=pathname.split('/').filter(Boolean)[0]??'';return {scheme,pathname,segment};}
export class StackFrame {
  /** Explicit source web-parser mode; core does not inspect process/build globals. */
  static webDebug=false;
  readonly number:number;readonly column:number;readonly line:number;readonly packageScheme:string;readonly package:string;readonly packagePath:string;readonly className:string;readonly method:string;readonly isConstructor:boolean;readonly source:string;
  constructor(o:StackFrameOptions){this.number=o.number;this.column=o.column;this.line=o.line;this.packageScheme=o.packageScheme;this.package=o.package;this.packagePath=o.packagePath;this.className=o.className??'';this.method=o.method;this.isConstructor=o.isConstructor??false;this.source=o.source;Object.freeze(this);}
  static readonly asynchronousSuspension=new StackFrame({number:-1,column:-1,line:-1,method:'asynchronous suspension',packageScheme:'',package:'',packagePath:'',source:'<asynchronous suspension>'});
  static readonly stackOverFlowElision=new StackFrame({number:-1,column:-1,line:-1,method:'...',packageScheme:'',package:'',packagePath:'',source:'...'});
  static fromStackTrace(stack:{toString():string}|string):StackFrame[]{return this.fromStackString(String(stack));}
  static fromStackString(stack:string):StackFrame[]{return stack.trim().split('\n').filter(Boolean).flatMap(line=>{const frame=this.fromStackTraceLine(line);return frame?[frame]:[];});}
  private static _tryParseWebDebugFrame(line:string):StackFrame|null{const hasPackage=line.startsWith('package'),match=(hasPackage?/^(package.+) (\d+):(\d+)\s+(.+)$/:/^(.+) (\d+):(\d+)\s+(.+)$/).exec(line);if(!match)return null;const uri=uriParts(match[1]!);return new StackFrame({number:-1,packageScheme:hasPackage?'package':'<unknown>',package:hasPackage?uri.segment:'<unknown>',packagePath:hasPackage?uri.pathname.replace(uri.segment+'/',''):'<unknown>',line:Number(match[2]),column:Number(match[3]),className:'<unknown>',method:match[4]!,source:line});}
  private static _tryParseWebNonDebugFrame(line:string):StackFrame|null{const match=/^\s*at ([^\s]+).*$/.exec(line);if(!match)return null;const parts=match[1]!.split('.');return new StackFrame({number:-1,packageScheme:'<unknown>',package:'<unknown>',packagePath:'<unknown>',line:-1,column:-1,className:parts.length>1?parts[0]!:'<unknown>',method:parts.length>1?parts.slice(1).join('.'):parts[0]!,source:line});}
  private static _tryParseWebFrame(line:string):StackFrame|null{return this.webDebug?this._tryParseWebDebugFrame(line):this._tryParseWebNonDebugFrame(line);}
  static fromStackTraceLine(line:string):StackFrame|null{
    if(line==='<asynchronous suspension>'||line==='===== asynchronous gap ===========================')return this.asynchronousSuspension;if(line==='...')return this.stackOverFlowElision;if(!line.startsWith('#'))return this._tryParseWebFrame(line);
    const match=/^#(\d+) +(.+) \((.+?):?(\d+){0,1}:?(\d+){0,1}\)$/.exec(line);invariant(match,'invalid-stack-frame',`Expected a Dart VM stack frame: ${line}`);let method=match[2]!.replaceAll('.<anonymous closure>',''),className='',isConstructor=false;
    if(method.startsWith('new')){className=method.split(' ')[1]??'<unknown>';method='';if(className.includes('.')){const parts=className.split('.');className=parts[0]!;method=parts[1]!;}isConstructor=true;}else if(method.includes('.')){const parts=method.split('.');className=parts[0]!;method=parts[1]!;}
    const uri=uriParts(match[3]!),packaged=uri.scheme==='dart'||uri.scheme==='package';return new StackFrame({number:Number(match[1]),className,method,packageScheme:uri.scheme,package:packaged?uri.segment:'<unknown>',packagePath:packaged?uri.pathname.replace(uri.segment+'/',''):uri.pathname,line:match[4]===undefined?-1:Number(match[4]),column:match[5]===undefined?-1:Number(match[5]),isConstructor,source:line});
  }
  equals(other:unknown):boolean{return other instanceof StackFrame&&other.constructor===this.constructor&&other.number===this.number&&other.package===this.package&&other.line===this.line&&other.column===this.column&&other.className===this.className&&other.method===this.method&&other.source===this.source;}
  /** Local value hash, not Dart Object.hash or VM ABI. */
  get hashCode():number{let hash=0;for(const c of JSON.stringify([this.number,this.package,this.line,this.column,this.className,this.method,this.source]))hash=(hash*31+c.charCodeAt(0))|0;return hash;}
  toString():string{return `StackFrame(#${this.number}, ${this.packageScheme}:${this.package}/${this.packagePath}:${this.line}:${this.column}, className: ${this.className}, method: ${this.method})`;}
}
