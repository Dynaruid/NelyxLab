// SPDX-License-Identifier: BSD-3-Clause
// Finite projection of analyzer-resolved radio constants; functional widgets/paint are separate owners.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const irFile='.tmp/work8/w11-controls-candidate/ir.json',candidateFile='.tmp/work8/w11-controls-candidate/result.json';
const ownerFile='tools/Nelyx.FrameworkToTypeScript/data/work8/w12-cupertino-radio-data-ownership.json';
const output='packages/cupertino/src/generated/radio/radio-defaults.generated.ts';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8')),sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),ref=file=>({file,sha256:sha(file)});
const candidate=read(candidateFile);assert.equal(path.resolve(candidate.ir.file),path.resolve(irFile));assert.equal(sha(irFile),candidate.ir.sha256);
const records=read(irFile).records.filter(r=>r.source==='packages/flutter/lib/src/cupertino/radio.dart'&&r.ir.kind==='constant');
assert.deepEqual(records.map(r=>r.symbol),['_size','_kOuterRadius','_kInnerRadius','_kDisabledOuterColor','_kDisabledInnerColor','_kDisabledBorderColor','_kDefaultBorderColor','_kDefaultInnerColor','_kDefaultOuterColor','_kPressedOverlayOpacity','_kCheckmarkStrokeWidth','_kFocusOutlineStrokeWidth','_kBorderOutlineStrokeWidth','_kDarkGradientOpacities','_kDisabledDarkGradientOpacities']);
const sourceFile='.tmp/work6/flutter-source/'+records[0].source;
assert.equal(createHash('sha256').update(fs.readFileSync(sourceFile,'utf8').replaceAll('\r\n','\n')).digest('hex'),records[0].sourceSha256);
function value(v){
  if(v.kind==='literal'){assert(['double','int'].includes(v.numeric?.type));return JSON.stringify(v.value);}
  if(v.kind==='list'){
    assert.equal(v.elementType.reference.id,'dart:core::double:CLASS');assert(v.values.every(x=>x.kind==='literal'&&x.numeric?.type==='double'));
    return 'canonicalDartList(dartDoubleType, ['+v.values.map(x=>'DartDouble.fromSource('+value(x)+')').join(', ')+'])';
  }
  if(v.kind==='property'){assert.equal(v.reference.owner,'CupertinoColors');assert(['white','activeBlue'].includes(v.name));return 'CupertinoColors.'+v.name;}
  if(v.kind==='call'){
    assert.equal(v.reference.id,'dart:ui::Color.withOpacity:METHOD');assert.equal(v.args.length,1);assert.equal(v.args[0].value.numeric?.type,'double');
    return value(v.target)+'.withOpacity('+value(v.args[0].value)+')';
  }
  if(v.kind==='construct'){
    if(v.reference.id==='dart:ui::Size.Size.new:CONSTRUCTOR'){assert(v.args.every(a=>a.value.kind==='literal'&&a.value.numeric?.type==='double'));return 'Object.freeze(new Size('+v.args.map(a=>value(a.value)).join(', ')+'))';}
    if(v.reference.id==='dart:ui::Color.Color.fromARGB:CONSTRUCTOR'){
      assert(v.args.every(a=>a.value.kind==='literal'&&a.value.numeric?.type==='int'));const [a,r,g,b]=v.args.map(a=>BigInt(a.value.value)&255n);
      return 'constSourceColor(Color, '+Number(a<<24n|r<<16n|g<<8n|b)+')';
    }
    assert.equal(v.reference.id,'package:flutter/src/cupertino/colors.dart::CupertinoDynamicColor.CupertinoDynamicColor.withBrightness:CONSTRUCTOR');
    return 'constCupertinoDynamicColorWithBrightness({'+v.args.map(a=>a.name+': '+value(a.value)).join(', ')+'})';
  }
  throw Error('Unbound radio constant '+v.kind);
}
const text=`// SPDX-License-Identifier: BSD-3-Clause
// Copyright 2014 The Flutter Authors. All rights reserved.
// Generated from verified analyzer-resolved cupertino/radio.dart constants.
import {canonicalDartList} from '@nelyx/core/internal/foundation/dart-const';
import {dartDoubleType} from '@nelyx/core/foundation/dart-type-witness';
import {DartDouble} from '@nelyx/core/foundation/dart-numeric';
import {Color} from '@nelyx/core/ui/color';
import {Size} from '@nelyx/core/ui/size';
import {constSourceColor} from '@nelyx/core/ui/color-source';
import {CupertinoColors, constCupertinoDynamicColorWithBrightness} from '../../colors.ts';
`+records.map(r=>(r.ir.numeric?'/** @dartType '+r.ir.numeric.type+' */\n':'')+'export const '+r.symbol+' = '+value(r.ir.value)+';').join('\n')+'\n';
const localizationSource='.tmp/work6/flutter-source/packages/flutter_localizations/lib/src/l10n/generated_widgets_localizations.dart';
const localizationText=fs.readFileSync(localizationSource,'utf8');
const localizationNormalizedSha256=createHash('sha256').update(localizationText.replaceAll('\r\n','\n')).digest('hex');
assert.equal(localizationNormalizedSha256,'6adaf35bba31656f4f5f5405d9076b8a8e4f6898699c573bd36c14a2ceb9bae4','Pinned Widgets localization source changed');
const headers=[...localizationText.matchAll(/\/\/\/ The translations[^\r\n]*\(`([^`]+)`\)\.\s*class (\w+) extends (\w+) \{/g)];
assert.equal(headers.length,[...localizationText.matchAll(/^class WidgetsLocalization\w+ extends /gm)].length,'Every localization class needs its explicit source locale');
const translationStart=localizationText.indexOf('GlobalWidgetsLocalizations? getWidgetsTranslation');assert(translationStart>headers.at(-1).index);
const classes=new Map(headers.map((m,i)=>[m[2],{locale:m[1],parent:m[3],body:localizationText.slice(m.index+m[0].length,headers[i+1]?.index??translationStart)}]));
function stringLiteral(literal){
  const body=literal.slice(1,-1);let result='';
  for(let i=0;i<body.length;i++){
    const c=body[i];if(c!=='\\'){result+=c;continue;}
    const escaped=body[++i],simple={"'":"'",'"':'"','\\':'\\','$':'$',n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v'};
    if(Object.hasOwn(simple,escaped)){result+=simple[escaped];continue;}
    if(escaped==='u'){const braces=body[i+1]==='{',match=braces?/^\{([0-9a-fA-F]+)\}/.exec(body.slice(i+1)):/^([0-9a-fA-F]{4})/.exec(body.slice(i+1));assert(match,'Invalid Unicode escape');result+=String.fromCodePoint(parseInt(match[1],16));i+=match[0].length;continue;}
    throw Error('Unsupported radio label escape '+escaped);
  }
  return result;
}
const resolving=new Set(),resolved=new Map();
function label(name){
  if(resolved.has(name))return resolved.get(name);const entry=classes.get(name);assert(entry,'Unbound localization parent '+name);assert(!resolving.has(name));resolving.add(name);
  const match=/String get radioButtonUnselectedLabel => ('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*");/.exec(entry.body);
  const result=match?stringLiteral(match[1]):label(entry.parent);resolving.delete(name);resolved.set(name,result);return result;
}
const labels=Object.fromEntries([...classes].map(([name,entry])=>[entry.locale,label(name)]));
const chinese=localizationText.slice(localizationText.lastIndexOf("case 'zh':"),localizationText.lastIndexOf("case 'zu':"));
const regionalSwitch=chinese.slice(chinese.lastIndexOf('switch (locale.countryCode)'));
for(const match of regionalSwitch.matchAll(/case '(\w+)':\s*return const (\w+)\(\);/g)){const entry=classes.get(match[2]);assert(entry);labels['zh_'+match[1]]=label(match[2]);}
assert.equal(labels.en,'Not selected');assert.equal(labels.ko,'선택되지 않음');
const localizationOutput='Nelyx/src/framework/widgets/radio-localizations.generated.ts';
const localizationData='// SPDX-License-Identifier: BSD-3-Clause\n// Copyright 2014 The Flutter Authors. All rights reserved.\n// Source locale labels and inherited variants; radio hints only, not the complete WidgetsLocalizations API.\nexport const radioUnselectedLabels: Readonly<Record<string, string>> = Object.freeze('+JSON.stringify(Object.fromEntries(Object.entries(labels).sort(([a],[b])=>a.localeCompare(b))),null,2)+');\n';
const notice='Nelyx/licenses/radio-localizations-sources.json';
const noticeText=JSON.stringify({schema:'nelyx.radio-localization-sources/v1',revision:'71e4717a61786faab4c7aa39825989305ed29e8a',source:'packages/flutter_localizations/lib/src/l10n/generated_widgets_localizations.dart',sha256:sha(localizationSource),normalizedSha256:localizationNormalizedSha256,license:'BSD-3-Clause',notice:'Flutter-LICENSE.md',scope:'Complete radioButtonUnselectedLabel locale/class inheritance and Chinese regional source routing only; other WidgetsLocalizations members and native readers qualify separately'},null,2)+'\n';
const products=[{file:output,text},{file:localizationOutput,text:localizationData},{file:notice,text:noticeText}];
const previous=fs.existsSync(ownerFile)?read(ownerFile):null,check=process.argv.includes('--check');
if(check){assert(previous);assert.equal(sha(import.meta.filename),previous.generator.sha256);for(const product of products){assert.equal(fs.readFileSync(product.file,'utf8'),product.text);assert.equal(sha(product.file),previous.outputs.find(row=>row.file===product.file)?.sha256);}}
else{
  for(const product of products){const old=previous?.outputs.find(row=>row.file===product.file);if(old)assert.equal(sha(product.file),old.sha256,'Edited managed radio owner');else assert(!fs.existsSync(product.file),'Unowned radio output exists; preserve/adopt it explicitly');}
  for(const product of products){fs.mkdirSync(path.dirname(product.file),{recursive:true});fs.writeFileSync(product.file,product.text);}
  let history=null;if(previous){const file='.tmp/work12/receipts/'+sha(ownerFile)+'-w12-cupertino-radio-data-ownership.json';fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file))fs.copyFileSync(ownerFile,file);history=ref(file);}
  fs.writeFileSync(ownerFile,JSON.stringify({schema:'nelyx.w12-cupertino-radio-data-ownership/v1',status:'PASS-scoped',source:ref(sourceFile),normalizedSourceSha256:records[0].sourceSha256,candidate:ref(candidateFile),controls:ref(irFile),localizationSource:ref(localizationSource),generator:ref(import.meta.filename),outputs:products.map(p=>ref(p.file)),constants:records.length,localeClasses:classes.size,localeKeys:Object.keys(labels).length,numeric:records.filter(r=>r.ir.numeric).map(r=>({symbol:r.symbol,type:r.ir.numeric.type})),previous:history,scope:'All 15 radio constants with resolved numeric/const Color/Size/list identities and complete source radio hint locale tables; functional behavior and native delivery qualify separately'},null,2)+'\n');
}
console.log(JSON.stringify({status:'PASS-scoped',constants:records.length,localeClasses:classes.size,localeKeys:Object.keys(labels).length,check}));
