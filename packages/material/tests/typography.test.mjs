import {assertParagraphOwnership} from './engine-fixture.mjs';
// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
import {Typography,ScriptCategory} from '@nelyx/material/typography';import {ScriptCategory as CanonicalCategory} from '@nelyx/material/script-category';
import {Typography as AggregateTypography,ScriptCategory as AggregateCategory} from '@nelyx/material/widgets';
import {ThemeData} from '@nelyx/material/theme-data';import {Theme} from '@nelyx/material/theme';import {ColorScheme} from '@nelyx/material/color-scheme';import {TextTheme} from '@nelyx/material/text-theme';import {Colors} from '@nelyx/material/colors';
import {MaterialLocalizations,MaterialLocalizationsScope} from '@nelyx/material/material-localizations';import {MaterialApp} from '@nelyx/material/app';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';import {FoundationBuildMode} from '@nelyx/core/foundation/constants';import {TextStyle} from '@nelyx/core/framework/painting/text-style';import {FontWeight,TextDecoration} from '@nelyx/core/ui/typography';
import {Builder,SizedBox,Align,Text} from '@nelyx/core/framework/widgets/basic';import {State,StatefulWidget} from '@nelyx/core/framework/widgets/framework';import {DefaultTextStyle} from '@nelyx/core/framework/widgets/default-text-style';import { Localizations } from '@nelyx/core/framework/widgets/app-data';
import {DiagnosticPropertiesBuilder} from '@nelyx/core/foundation/diagnostics';import {WebSkiaLibrary} from '@nelyx/skia-web/library';import {fixture} from './root-fixture.mjs';
const timeout=1_200_000;FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
const source=JSON.parse(fs.readFileSync(new URL('./fixtures/typography-source-values.json',import.meta.url)));
const fields=['displayLarge','displayMedium','displaySmall','headlineLarge','headlineMedium','headlineSmall','titleLarge','titleMedium','titleSmall','bodyLarge','bodyMedium','bodySmall','labelLarge','labelMedium','labelSmall'];

test('Theme locale lookup preserves private scope getters, fallback messages and an overridden localization provider',{timeout},()=>{
 const f=fixture(),base=new ThemeData({platform:'windows'}),seen=[];let reads=0;
 class Provided extends MaterialLocalizations{#category=ScriptCategory.dense;get scriptCategory(){reads++;return this.#category;}}
 const provided=new Provided('en'),probe=new Builder(context=>{seen.push({theme:Theme.of(context),localization:MaterialLocalizations.of(context)});return new SizedBox(1,1);});
 const original=MaterialLocalizations.of;
 try{
  f.set(new Localizations('ar',{},'en',new MaterialLocalizationsScope(provided,new Theme(base,probe))));
  assert.equal(seen.at(-1).localization,provided);assert.equal(seen.at(-1).theme.textTheme.bodyMedium.textBaseline,'ideographic');assert(reads>0);
  for(const locale of ['zh-Hant-TW','en_US','ar','ja','en_US']){
   f.set(new Localizations(locale,{},'en',new Theme(base,probe)));
   const current=seen.at(-1),expected=new MaterialLocalizations(locale);
   assert.equal(current.localization.scriptCategory,expected.scriptCategory);assert.equal(current.localization.copyButtonLabel,expected.copyButtonLabel);
   assert.equal(current.theme.textTheme.bodyMedium.textBaseline,expected.scriptCategory===ScriptCategory.dense?'ideographic':'alphabetic');
  }
  MaterialLocalizations.of=()=>provided;
  f.set(new Localizations('en',{},'en',new Theme(base,probe)));assert.equal(seen.at(-1).theme.textTheme.bodyMedium.textBaseline,'ideographic');
 }finally{MaterialLocalizations.of=original;f.close();}
});
function expected(node){
 if(['int','double','bool','string'].includes(node.kind))return node.value;if(node.kind==='null')return null;if(node.kind==='negate')return -expected(node.value);if(node.kind==='list')return node.values.map(expected);
 if(node.kind==='ref'){
  if(node.name==='_helsinkiFontFallbacks')return expected(source.platform.find(f=>f.name===node.name).value);
  const [owner,name]=node.name.split('.');if(owner==='Colors')return Colors[name].toARGB32();if(owner==='FontWeight')return FontWeight[name].value;if(owner==='TextDecoration')return TextDecoration[name].mask;if(['TextBaseline','TextLeadingDistribution'].includes(owner))return name;
 }
 throw new Error('Unknown closed source fixture '+JSON.stringify(node));
}
function compareTheme(theme,value){
 assert.equal(value.type,'TextTheme');assert.equal(value.args.length,15);
 for(const role of value.args){const style=theme[role.name];assert(style);assert.equal(role.value.type,'TextStyle');for(const argument of role.value.args){let actual=style[argument.name];if(argument.name==='fontWeight')actual=actual.value;if(argument.name==='decoration')actual=actual.mask;assert.deepEqual(actual,expected(argument.value),role.name+'.'+argument.name);}}
}
test('M3 Typography exposes every source platform color/font and geometry value with one canonical enum',{timeout},()=>{
 assert.equal(Typography,AggregateTypography);assert.equal(ScriptCategory,AggregateCategory);assert.equal(ScriptCategory,CanonicalCategory);assert.deepEqual(ScriptCategory.values.map(v=>[v.name,v.index,String(v)]),[['englishLike',0,'ScriptCategory.englishLike'],['dense',1,'ScriptCategory.dense'],['tall',2,'ScriptCategory.tall']]);
 assert(Object.isFrozen(ScriptCategory.values));for(const field of source.platform.filter(f=>f.name!=='_helsinkiFontFallbacks'))compareTheme(Typography[field.name],field.value);
 for(const field of source.geometry)compareTheme(Typography[field.name+'2021'],field.value);
 assert.equal(Typography.material2014,undefined);assert.equal(Typography.material2018,undefined);assert.equal(Typography.englishLike2018,undefined);
});
test('M3 factory resolves six platform families, uniform brightness colors and custom theme contracts',{timeout},()=>{
 const families={android:'blackMountainView',fuchsia:'blackMountainView',windows:'blackRedmond',linux:'blackHelsinki',iOS:'blackCupertino',macOS:'blackRedwoodCity'};
 for(const brightness of ['light','dark'])for(const [platform,sourceName]of Object.entries(families)){
  const colorScheme=new ColorScheme({brightness,onSurface:0xff123456,surface:0xffabcdef}),t=Typography.material2021({platform,colorScheme});
  for(const role of fields){const family=expected(source.platform.find(f=>f.name===sourceName).value.args.find(a=>a.name===role).value.args.find(a=>a.name==='fontFamily').value);assert.equal(t.black[role].fontFamily,family);assert.equal(t.white[role].fontFamily,family);assert.equal(t.black[role].color,brightness==='light'?0xff123456:0xffabcdef);assert.equal(t.white[role].color,brightness==='light'?0xffabcdef:0xff123456);assert.equal(t.black[role].decorationColor,t.black[role].color);assert.equal(t.black[role].fontSize,null);}
  assert.equal(t.geometryThemeFor(ScriptCategory.dense),Typography.dense2021);assert.equal(t.geometryThemeFor(ScriptCategory.tall),Typography.tall2021);assert.equal(t.geometryThemeFor(ScriptCategory.englishLike),Typography.englishLike2021);
 }
 assert.throws(()=>Typography.material2021({platform:null}),/null platform/);const custom=new TextTheme({bodyMedium:new TextStyle({fontFamily:'Custom',color:0xff010203})});const t=Typography.material2021({platform:null,black:custom,white:custom});assert.equal(t.black.bodyMedium.fontFamily,'Custom');assert.equal(t.black.bodyMedium.color,new ColorScheme().onSurface);assert.throws(()=>t.geometryThemeFor({name:'dense'}),/canonical ScriptCategory/);
});
test('Typography copy, interpolation, equality/hash and diagnostics retain complete five-theme values',{timeout},()=>{
 const a=Typography.material2021(),custom=new TextTheme({bodyMedium:new TextStyle({inherit:false,fontSize:20,color:0xff123456})}),b=a.copyWith({black:custom,white:custom,englishLike:custom,dense:custom,tall:custom});
 assert.equal(b.black,custom);assert.equal(b.copyWith({black:null}).black,custom);assert(a.equals(a.copyWith()));assert.equal(a.hashCode,a.copyWith().hashCode);assert.equal(Typography.lerp(a,a,3),a);
 const large=new TextTheme({bodyMedium:new TextStyle({inherit:false,fontSize:40,color:0xffabcdef})}),c=b.copyWith({black:large,white:large,englishLike:large,dense:large,tall:large});
 for(const [t,size]of[[-.25,15],[0,20],[.25,25],[1,40],[1.25,45]])for(const name of ['black','white','englishLike','dense','tall'])assert.equal(Typography.lerp(b,c,t)[name].bodyMedium.fontSize,size);
 const mode=FoundationBuildMode.mode;FoundationBuildMode.mode='debug';try{const builder=new DiagnosticPropertiesBuilder();b.debugFillProperties(builder);assert.deepEqual(builder.properties.slice(-5).map(p=>p.name),['black','white','englishLike','dense','tall']);}finally{FoundationBuildMode.mode=mode;}assert.equal(a.equals({black:a.black}),false);
});
test('ThemeData text defaults, font package/fallback and identity FIFO localization preserve source merge/copy rules',{timeout},()=>{
 const fallback=['One','Two'],base=new ThemeData({platform:'linux',fontFamily:'Fixture',fontFamilyFallback:fallback,package:'sample'});fallback.push('Changed');assert.equal(base.textTheme.bodyMedium.fontSize,null);assert.equal(base.textTheme.bodyMedium.fontFamily,'packages/sample/Fixture');assert.deepEqual(base.textTheme.bodyMedium.fontFamilyFallback,['packages/sample/One','packages/sample/Two']);
 const custom=new TextTheme({bodyMedium:new TextStyle({inherit:false,fontSize:23,color:0xff123456})}),same=base.copyWith({textTheme:custom});assert.equal(same.textTheme,custom);assert.equal(same.copyWith().textTheme,custom);assert.equal(same.copyWith({typography:Typography.material2021({platform:'iOS'})}).textTheme,custom);
 const localized=ThemeData.localize(base,base.typography.dense);assert.equal(localized.textTheme.bodyMedium.textBaseline,'ideographic');assert.equal(localized.textTheme.bodyMedium.fontSize,14);assert.equal(localized.textTheme.bodyMedium.inherit,false);assert.equal(localized.adaptationMap,base.adaptationMap);assert.equal(localized.extensions,base.extensions);assert.equal(ThemeData.localize(base,base.typography.dense),localized);assert.equal(ThemeData.localize(same,same.typography.dense).textTheme.bodyMedium,custom.bodyMedium);
 const geometries=Array.from({length:6},()=>new TextTheme({bodyMedium:new TextStyle({inherit:false,fontSize:17})})),first=ThemeData.localize(base,geometries[0]);for(const geometry of geometries.slice(1,5))ThemeData.localize(base,geometry);assert.equal(ThemeData.localize(base,geometries[0]),first,'A hit preserves insertion order');ThemeData.localize(base,geometries[5]);assert.notEqual(ThemeData.localize(base,geometries[0]),first,'FIFO evicts the earliest inserted identity, even after a hit');
});
test('every source locale resolves its script category and live Theme lookup rebuilds the same State',{timeout},()=>{
 const f=fixture(),values=[],created=[],disposed=[];class Probe extends StatefulWidget{createState(){const state=new(class extends State{initState(){created.push(this);}build(context){values.push({state:this,theme:Theme.of(context),text:TextTheme.of(context),style:DefaultTextStyle.of(context)?.style});return new SizedBox(1,1);}dispose(){disposed.push(this);super.dispose();}})();return state;}}
 const base=new ThemeData({platform:'windows'}),probe=new Probe();
 try{for(const locale of Object.keys(source.locales)){
  const language=locale.split('_')[0],category=source.locales[locale]??source.locales[language]??'English-like',name=category==='English-like'?'englishLike':category;
  assert.equal(new MaterialLocalizations(locale).scriptCategory,ScriptCategory[name],locale);
  f.set(new Localizations(locale,{},'en',new Theme(base,probe)));const current=values.at(-1);assert.equal(current.text,current.theme.textTheme);assert.equal(current.text.bodyMedium.textBaseline,name==='dense'?'ideographic':'alphabetic',locale);assert.equal(current.style,undefined,'A standalone source Theme preserves the ambient DefaultTextStyle');assert.equal(current.state,created[0]);
 }assert.equal(created.length,1);assert.equal(disposed.length,0);f.set(new SizedBox(1,1));assert.equal(disposed.length,1);assert.equal(f.root.scheduler.transientCallbackCount,0);
 }finally{f.close();}
});
test('MaterialApp locale changes use actual owned paragraphs, platform fonts and live M3 geometry without retiring State',{timeout},async()=>{
 const require=createRequire(import.meta.url),runtime=new URL('../generated/runtime/',import.meta.resolve('@nelyx/skia-web/library')),ck=await require(fileURLToPath(new URL('canvaskit.js',runtime)))({wasmBinary:fs.readFileSync(new URL('canvaskit.wasm',runtime))});assert.equal(ck.nelyxParagraphApiVersion(),1);
 const f=fixture(),context=f.root.context,library=new WebSkiaLibrary(ck,null,context.owner),surface=ck.MakeSurface(240,160);library.bind(context.resources);context.text=library;
 const bytes=fs.readFileSync(new URL('../../../Nelyx/sdk/tooling/cli/templates/nelyx-app/assets/RobotoSlab-VariableFont_wght.ttf',import.meta.url)),font=library.decode({id:'typography-fixture',kind:'font',fontFamily:'RobotoSlab',sha256:crypto.createHash('sha256').update(bytes).digest('hex')},bytes);context.resources.register(font.descriptor,font.retire);context.defaultFont=font.descriptor;context.assets.set('typography-fixture',font.descriptor);
 const seen=[],states=[],disposed=[],theme=new ThemeData({platform:'windows',fontFamily:'RobotoSlab'});
 class TextProbe extends StatefulWidget{createState(){return new(class extends State{initState(){states.push(this);}build(context){const data=Theme.of(context);seen.push(data);return new Align(new Text('Typography',{style:data.textTheme.bodyMedium}));}dispose(){disposed.push(this);super.dispose();}})();}}
 const child=new TextProbe();
 try{for(const [locale,baseline]of[['en','alphabetic'],['ko','ideographic'],['ar','alphabetic'],['en','alphabetic']]){const commands=f.set(new MaterialApp({locale,supportedLocales:['en','ko','ar'],theme,home:child}));assert.equal(seen.at(-1).textTheme.bodyMedium.textBaseline,baseline);assert.equal(seen.at(-1).textTheme.bodyMedium.fontFamily,'RobotoSlab');library.replay(surface.getCanvas(),{commands});surface.flush();assert(library.paragraphs.size>0);assert.equal([...library.paragraphs.values()].some(e=>e.layout.unresolvedGlyphs>0),false);assert(surface.getCanvas().readPixels(0,0,{width:240,height:160,colorType:ck.ColorType.RGBA_8888,alphaType:ck.AlphaType.Unpremul,colorSpace:ck.ColorSpace.SRGB}).some(v=>v!==0));}
  assert.equal(states.length,1);assert.equal(disposed.length,0);f.set(new SizedBox(1,1));assert.equal(disposed.length,1);assertParagraphOwnership({library});assert.equal(f.root.scheduler.transientCallbackCount,0);
 }finally{surface.delete();f.close();await library.dispose();assert.equal(library.fonts.size,0);}
});
