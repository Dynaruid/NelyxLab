// SPDX-License-Identifier: BSD-3-Clause
// Finite, audited GLSL -> SkSL spelling conversion of the pinned Flutter asset.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const source='.tmp/work6/flutter-source/packages/flutter/lib/src/material/shaders/ink_sparkle.frag';
const destination='packages/material/assets/shaders/ink_sparkle.sksl';
const ownership='tools/Nelyx.FrameworkToTypeScript/data/work8/w11-sparkle-shader-ownership.json';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const input=fs.readFileSync(source,'utf8').replaceAll('\r\n','\n');
let sksl=input.replace(/^#version .*\n/m,'').replace(/^precision highp float;\n/m,'').replace(/^#include <flutter\/runtime_effect.glsl>\n/m,'')
 .replace(/layout\(location = \d+\) /g,'').replace(/^out vec4 fragColor;\n/m,'').replace(/\bhighp /g,'')
 .replace(/\bvec([234])\b/g,'float$1').replace(/\bmat2\b/g,'float2x2')
 .replace(/^float (u_alpha|u_sparkle_alpha|u_blur|u_radius_scale) = (u_composite_1\.[xyzw]);$/gm,'')
 .replace('void main() {\n  float2 p = FlutterFragCoord();','half4 main(float2 p) {')
 .replace('fragColor = mix(wave_color, float4(1.0), sparkle);','return half4(mix(wave_color, float4(1.0), sparkle));');
assert(!sksl.includes('FlutterFragCoord')&&!sksl.includes('fragColor'));
// Inline these four uniform aliases; SkSL has neither GLSL macros nor dynamic globals.
for(const [name,component] of Object.entries({u_alpha:'x',u_sparkle_alpha:'y',u_blur:'z',u_radius_scale:'w'}))sksl=sksl.replace(new RegExp('\\b'+name+'\\b','g'),'(u_composite_1.'+component+')');
// The package build embeds this file directly; never generate a second TS shader body.
const text=sksl;
const record={schema:'nelyx.w11-sparkle-shader-ownership/v1',revision:'71e4717a61786faab4c7aa39825989305ed29e8a',source:{file:source,sha256:hash(fs.readFileSync(source))},tool:{file:'tools/Nelyx.FrameworkToTypeScript/generate-ink-sparkle-shader.mjs',sha256:hash(fs.readFileSync(import.meta.filename))},output:{file:destination,sha256:hash(text)},license:'BSD-3-Clause',notice:'packages/material/licenses/Flutter-LICENSE.md',scope:'Finite GLSL spelling/entrypoint and four scalar uniform-alias substitutions; all functions/expressions and 28 scalar uniform ordering retained. Explicit generated owner; refuse edited output. Canonical package SkSL asset embedded by the product build; no runtime converter or scratch dependency.'};
if(process.argv.includes('--check')){assert.equal(fs.readFileSync(destination,'utf8'),text);assert.deepEqual(JSON.parse(fs.readFileSync(ownership,'utf8')),record);}
else {
 if(fs.existsSync(destination)&&fs.readFileSync(destination,'utf8')!==text){assert(fs.existsSync(ownership),'Cannot replace an unowned shader');const previous=JSON.parse(fs.readFileSync(ownership,'utf8'));assert.equal(hash(fs.readFileSync(destination)),previous.output.sha256,'Manual shader edit conflicts with regeneration');}
 fs.mkdirSync('packages/material/assets/shaders',{recursive:true});
 fs.writeFileSync(destination,text);fs.writeFileSync(ownership,JSON.stringify(record,null,2)+'\n');
}
console.log(JSON.stringify({source,destination,inputSha256:hash(input),outputSha256:hash(text)}));
