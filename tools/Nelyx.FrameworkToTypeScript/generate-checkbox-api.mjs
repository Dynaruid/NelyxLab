// SPDX-License-Identifier: BSD-3-Clause
import { relocateProductModule } from './product-module-layout.mjs';
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),ref=file=>({file,sha256:sha(file)}),read=f=>JSON.parse(fs.readFileSync(f,'utf8')),candidateFile='.tmp/work8/w11-controls-candidate/result.json',candidate=read(candidateFile),irFile=candidate.ir.file;assert.equal(sha(irFile),candidate.ir.sha256);
const record=read(irFile).records.find(r=>r.symbol==='Checkbox'),ir=record.ir,params=ir.constructor.parameters.filter(p=>p.name!=='key'),fields=ir.fields.filter(f=>!f.name.startsWith('_')&&f.name!=='width'),file='packages/material/src/checkbox.ts',ownershipFile='tools/Nelyx.FrameworkToTypeScript/data/work8/w11-checkbox-api-ownership.json',check=process.argv.includes('--check');
const sourceFile='.tmp/work6/flutter-source/'+record.source;assert.equal(createHash('sha256').update(fs.readFileSync(sourceFile,'utf8').replaceAll('\r\n','\n')).digest('hex'),record.sourceSha256,'Resolved LF source hash');
const bindings=new Set(['MouseCursor','Color','WidgetStateProperty','MaterialTapTargetSize','VisualDensity','FocusNode','OutlinedBorder','BorderSide']);
function type(t){let s;if(t.kind==='void')s='void';else if(t.kind==='function')s='(('+t.parameters.map((p,i)=>'value'+i+':'+type(p.type)).join(',')+')=>'+type(t.returnType)+')';else{assert.equal(t.kind,'interface');const n=t.reference.name;s=n==='bool'?'boolean':n==='String'?'string':n==='double'?'number':n;assert(['bool','String','double'].includes(n)||bindings.has(n),'Unbound '+n);if(t.arguments.length)s+='<'+t.arguments.map(type).join(',')+'>'; }return s+(t.nullable?'|null':'');}
const extensions=['key','enabled','skipTraversal','statesController','onFocusChange','onHover','onHighlightChanged','onShowFocusHighlight','onShowHoverHighlight','shortcuts','actions'],width=ir.fields.find(f=>f.name==='width');assert.equal(width.numeric.type,'double');assert.equal(width.initializer.kind,'literal');
const numeric=f=>f.numeric?'/** @dartType '+f.numeric.type+' */ ':'';
let text=`// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Standard and adaptive constructor APIs projected from resolved Flutter IR.
import {StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';import type {BuildContext,Widget} from '@nelyx/core/framework/widgets/framework';
import type {ControlInteractionOptions} from '@nelyx/core/framework/widgets/control-interaction';import type {MouseCursor} from '@nelyx/core/services/mouse-cursor';import type {Color} from '@nelyx/core/ui/color';import type {WidgetStateProperty} from '@nelyx/core/framework/widgets/widget-state';import type {FocusNode} from '@nelyx/core/framework/widgets/focus';import type {OutlinedBorder,BorderSide} from '@nelyx/core/framework/painting/borders';import type {MaterialTapTargetSize,VisualDensity} from './theme-data.ts';import {invariant} from '@nelyx/core/foundation/errors';import {buildMaterialCheckbox} from './checkbox-build.ts';
type InteractionOptions=Pick<ControlInteractionOptions,${extensions.map(JSON.stringify).join('|')}>;
export interface CheckboxOptions extends InteractionOptions {readonly id?:string;
${params.map(p=>'  '+numeric(p)+'readonly '+p.name+(p.required?'':'?')+':'+type(p.resolvedType)+';').join('\n')}
}
const adaptiveCheckboxes=new WeakSet<Checkbox>();
export class Checkbox extends StatefulWidget {
  readonly options:Readonly<CheckboxOptions>;
${fields.map(f=>'  '+numeric(f)+'readonly '+f.name+':'+type(f.type)+';').join('\n')}
  /** @dartType double */ static readonly width=${width.initializer.value};
  /** @dartParam splashRadius double? */
  constructor(o:CheckboxOptions){super(o.key??null);invariant(Object.keys(o).every(key=>${JSON.stringify([...extensions,'id',...params.map(p=>p.name)])}.includes(key)),'unsupported-checkbox-option','Unknown standard Checkbox option');invariant(o.onChanged===null||typeof o.onChanged==='function','invalid-checkbox-callback','Checkbox requires an explicit nullable callback');this.options=Object.freeze({...o});
${fields.map(f=>{const p=params.find(p=>p.name===f.name);assert(p);assert(p.default===null||p.default.kind==='literal');const d=p.required?'o.'+f.name:'o.'+f.name+'??'+(p.default===null?'null':JSON.stringify(p.default.value));return '    this.'+f.name+'='+d+';';}).join('\n')}
    invariant(typeof this.value==='boolean'||this.tristate&&this.value===null,'invalid-checkbox-value','Null checkbox values require tristate');
  }
  /** @dartParam splashRadius double? */
  static adaptive(o:CheckboxOptions):Checkbox{const result=new Checkbox(o);adaptiveCheckboxes.add(result);return result;}
  createState():State<Checkbox>{return new CheckboxState();}
}
class CheckboxState extends State<Checkbox>{build(context:BuildContext):Widget{return buildMaterialCheckbox(this.widget,context,adaptiveCheckboxes.has(this.widget));}}
`;
text=relocateProductModule(file,text).text;
if(check){assert.equal(fs.readFileSync(file,'utf8'),text);const owner=read(ownershipFile);assert.equal(owner.source.sha256,sha(sourceFile));assert.equal(owner.generator.sha256,sha(import.meta.filename));assert.equal(owner.output.sha256,sha(file));assert.equal(owner.resolvedSourceSha256,record.sourceSha256);}else{let previous=null;if(fs.existsSync(ownershipFile)){const old=read(ownershipFile);assert.equal(sha(file),old.output.sha256,'Edited managed Checkbox API');const seal=f=>{const target='.tmp/work8/receipt-history/'+sha(f)+'-w11-checkbox-api-'+f.split('/').at(-1);if(!fs.existsSync(target))fs.copyFileSync(f,target);return ref(target);};previous={output:seal(file),ownership:seal(ownershipFile)};}fs.writeFileSync(file,text);fs.writeFileSync(ownershipFile,JSON.stringify({schema:'nelyx.w11-checkbox-api-ownership/v1',status:'PASS-scoped',candidate:ref(candidateFile),ir:ref(irFile),source:ref(sourceFile),resolvedSourceSha256:record.sourceSha256,generator:ref(import.meta.filename),output:ref(file),previous,fields:fields.length,numericFields:2,scope:'Standard/adaptive Material Checkbox19 fields, required/default constructor API and double splashRadius/width provenance. Adaptive factory retains the owning Checkbox State; functional build selects its current platform child. Functional State/motion/theme/paint/input are separate owners.'},null,2)+'\n');}
console.log(JSON.stringify({status:'PASS-scoped',fields:fields.length,numericFields:2,check}));
