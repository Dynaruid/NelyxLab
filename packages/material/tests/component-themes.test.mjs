// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as material from '@nelyx/material/widgets';
import {Color} from '@nelyx/core/ui/color';
import {Locale} from '@nelyx/core/ui/locale';
import {Rect} from '@nelyx/core/ui/rect';
import {Size} from '@nelyx/core/ui/size';
import {Paint} from '@nelyx/core/ui/paint';
import {BorderSide} from '@nelyx/core/framework/painting/borders';
import {BorderRadius} from '@nelyx/core/framework/painting/border-radius';
import {CircleBorder} from '@nelyx/core/framework/painting/circle-border';
import {StadiumBorder} from '@nelyx/core/framework/painting/stadium-border';
import {RoundedRectangleBorder} from '@nelyx/core/framework/painting/rounded-rectangle-border';
import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import {EdgeInsets} from '@nelyx/core/framework/painting/edge-insets';
import {BoxConstraints} from '@nelyx/core/framework/rendering/constraints';
import {IconThemeData} from '@nelyx/core/framework/widgets/icon-theme-data';
import {NotchedShape,CircularNotchedRectangle} from '@nelyx/core/framework/painting/notched-shapes';
import {SystemUiOverlayStyle} from '@nelyx/core/services/system-ui-overlay-style';
import {systemUiOverlayStyleToPlatformMap} from '@nelyx/core/internal/services/system-ui-overlay-style-source';
import {SystemMouseCursors} from '@nelyx/core/services/mouse-cursor';
import { WidgetState, WidgetStateColor } from '@nelyx/core/framework/widgets/widget-state';
import {readDartType,describeDartType} from '@nelyx/core/foundation/dart-type-witness';
import {WidgetStatePropertyAll} from '@nelyx/core/framework/widgets/widget-state';
import {emptyWidgetStateSet} from '@nelyx/core/framework/widgets/widget-state';
import {InheritedTheme} from '@nelyx/core/framework/widgets/inherited-theme';
import {State,StatefulWidget,InheritedWidget} from '@nelyx/core/framework/widgets/framework';
import {Builder,SizedBox} from '@nelyx/core/framework/widgets/basic';
import {DismissDirection} from '@nelyx/core/framework/widgets/dismissible';
import {CustomPainter} from '@nelyx/core/framework/rendering/custom-paint';
import {CustomPaint} from '@nelyx/core/framework/widgets/custom-paint';
import {DiagnosticPropertiesBuilder,kNoDefaultValue} from '@nelyx/core/foundation/diagnostics';
import {FoundationBuildMode} from '@nelyx/core/foundation/constants';
import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {colorAll,cursorProperty,textAll,shapeAll} from '../dist/internal/button/style-properties.js';
import {fixture} from './root-fixture.mjs';
import {engineFixture,ownedCanvasKit} from './engine-fixture.mjs';
const timeout=1_200_000,source=JSON.parse(fs.readFileSync(new URL('./fixtures/component-themes-source.json',import.meta.url)));
const factoryResults=new WeakSet();
const slots=['appBarTheme','bannerTheme','bottomAppBarTheme','bottomNavigationBarTheme','bottomSheetTheme','dataTableTheme','datePickerTheme','dropdownMenuTheme','navigationRailTheme','popupMenuTheme','snackBarTheme','tabBarTheme','timePickerTheme','toggleButtonsTheme'];
FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});
function states(mask=0){const result=emptyWidgetStateSet();['disabled','selected','pressed','hovered','focused'].forEach((name,i)=>{if(mask&(1<<i))result.add(WidgetState[name]);});return result;}
function encode(v,s=states()){
 if(v===kNoDefaultValue)return '<no-default>';
 if(v==null||['number','boolean','string'].includes(typeof v))return v;
 if(v instanceof WidgetStateColor)return {base:v.toARGB32(),selected:v.resolve(states(2)).toARGB32()};
 if(v instanceof Color)return v.toARGB32();
 if(v instanceof IconThemeData){for(const key of ['size','fill','weight','grade','opticalSize','color','opacity','shadows','applyTextScaling'])assert.equal(v[key],null);return '<empty-icon>';}
 if(typeof v.resolve==='function'){const resolved=v.resolve(s);assert.notEqual(resolved,v);return encode(resolved,s);}
 if(v instanceof BorderSide)return [v.color,v.width];
 if(v instanceof material.InputDecorationThemeData)return v.hintMaxLines;
 if(v instanceof Locale)return v.languageCode;
 if(v instanceof CircularNotchedRectangle)return v.inverted;
 if(v instanceof SystemUiOverlayStyle)return systemUiOverlayStyleToPlatformMap(v);
 if(v===SystemMouseCursors.basic)return 'basic';if(v===SystemMouseCursors.click)return 'click';
 if(v instanceof TextStyle)return [v.fontSize,v.color];
 if(v instanceof CircleBorder)return 'CircleBorder';if(v instanceof StadiumBorder)return 'StadiumBorder';
 if(v instanceof RoundedRectangleBorder)return ['RoundedRectangleBorder',v.borderRadius.topLeft.x];
 if(v instanceof material.ButtonStyle){assert(factoryResults.has(v));return 'TextButton.styleFrom';}
 if(typeof v.name==='string')return v.name;
 throw Error('Unknown finite receiver '+v.constructor.name);
}
function sample(f,side,parents=false){const a=side==='a';switch(f.type){
 case 'double':return f.name==='actionOverflowThreshold'?(a?.2:.8):(a?2:10);
 case 'bool':return !a;
 case 'Color':return new Color(a?0xff123456:0xffabcdef);
 case 'BorderSide':return new BorderSide({width:a?2:10,color:a?0xff123456:0xffabcdef});
 case 'Locale':return new Locale(a?'en':'ko');
 case 'Object':assert.equal(f.name,'inputDecorationTheme');return new material.InputDecorationThemeData({hintMaxLines:a?2:10});
 case 'NotchedShape':return new CircularNotchedRectangle({inverted:!a});
 case 'SystemUiOverlayStyle':return SystemUiOverlayStyle[a?'light':'dark'];
 case 'WidgetStateProperty':switch(f.inner){case 'Color':return colorAll(new Color(a?0xff123456:0xffabcdef));case 'MouseCursor':return cursorProperty(()=>a?SystemMouseCursors.basic:SystemMouseCursors.click);case 'TextStyle':return parents?textAll(new TextStyle({fontSize:a?12:20})):null;case 'OutlinedBorder':return parents?shapeAll(new CircleBorder()):null;default:throw Error(f.inner);}
 case 'DismissDirection':return a?DismissDirection.vertical:DismissDirection.none;
 case 'Clip':return a?'none':'hardEdge';case 'MainAxisAlignment':return a?'start':'spaceEvenly';
 case 'TextStyle':return parents?new TextStyle({fontSize:a?12:20}):null;
 case 'IconThemeData':return parents?new IconThemeData({size:a?12:20}):null;
 case 'EdgeInsetsGeometry':case 'EdgeInsets':return parents?EdgeInsets.all(a?2:10):null;
 case 'Size':return parents?new Size(a?2:10,a?4:20):null;
 case 'BoxConstraints':return parents?new BoxConstraints(a?2:10):null;
 case 'BorderRadius':return parents?BorderRadius.circular(a?2:10):null;
 case 'ShapeBorder':case 'OutlinedBorder':return parents?new CircleBorder():null;
 case 'ButtonStyle':return parents?material.TextButton.styleFrom({foregroundColor:new Color(a?0xff123456:0xffabcdef)}):null;
 case 'MenuStyle':return parents?new material.MenuStyle():null;
 default:{const E=material[f.type];if(E?.values)return f.type==='SnackBarBehavior'?E.floating:a?E.values[0]:E.values.at(-1);return null;}
}}
const options=(c,side,parents=false)=>Object.fromEntries(c.fields.map(f=>[f.name,sample(f,side,parents)]));
function diagnostics(value){const b=new DiagnosticPropertiesBuilder();value.debugFillProperties(b);return b.properties.map(d=>({name:d.name,type:d.propertyType,value:encode(d.value),default:encode(d.defaultValue),description:d.description??null}));}

test('14 source data classes match 103 unchanged Dart lerp cases and source default diagnostics',{timeout},()=>{
 const old=FoundationBuildMode.mode;FoundationBuildMode.mode='debug';try{
 for(const c of source.contracts){const D=material[c.symbol],a=new D(options(c,'a')),b=new D(options(c,'b'));
  for(const row of source.data.filter(r=>r.symbol===c.symbol)){const x=row.mode==='nullA'||row.mode==='bothNull'?null:a,y=row.mode==='nullB'||row.mode==='bothNull'?null:row.mode==='identity'?a:b;
   if(row.error){assert.throws(()=>D.lerp(x,y,row.t),c.symbol+row.mode+row.t);continue;}
   const result=D.lerp(x,y,row.t);assert.equal(result===null,row.isNull);assert.equal(result===a,row.identicalA);
   assert.deepEqual(result===null?null:Object.fromEntries(c.fields.map(f=>[f.name,encode(result[f.name])])),row.fields,c.symbol+':'+row.mode+':'+row.t);
  }
  const v=source.values.find(v=>v.symbol===c.symbol);assert.equal(a.equals(a.copyWith()),v.copyEqual);assert.equal(a.hashCode===a.copyWith().hashCode,v.copyHashEqual);
  assert.deepEqual(diagnostics(new D()),v.defaultDiagnostics,c.symbol+'.diagnostics');
 }
 }finally{FoundationBuildMode.mode=old;}
});

test('216 fields use canonical parents and null-retaining copy; source asymmetric decisions and obsolete aliases remain explicit',{timeout},()=>{
 for(const c of source.contracts){const D=material[c.symbol],o=options(c,'a',true),a=new D(o),empty=Object.fromEntries(c.fields.map(f=>[f.name,null])),copy=a.copyWith(empty);assert(copy.equals(a));assert.equal(copy.hashCode,a.hashCode);assert(Object.isFrozen(a));class Derived extends D{}assert.equal(a.equals(new Derived(o)),c.symbol==='DatePickerThemeData',c.symbol);for(const f of c.fields)if(f.name!=='dayPeriodColor')assert.equal(a[f.name],o[f.name],c.symbol+'.'+f.name);}
 const a=new material.TimePickerThemeData({dayPeriodColor:new Color(0xff123456)}),b=new material.TimePickerThemeData({dayPeriodColor:new Color(0xffabcdef)});assert.deepEqual(encode(a.dayPeriodColor),source.dayPeriod.a);assert.deepEqual(encode(b.dayPeriodColor),source.dayPeriod.b);assert.equal(a.equals(b),source.dayPeriod.equalDifferentSelectedValues);assert.equal(a.hashCode===b.hashCode,source.dayPeriod.hashEqual);assert.notEqual(a.dayPeriodColor,a.dayPeriodColor);const stateColor=WidgetStateColor.resolveWith(s=>s.contains(WidgetState.selected)?new Color(0xff123456):new Color(0xffabcdef));assert.equal(new material.TimePickerThemeData({dayPeriodColor:stateColor}).dayPeriodColor,stateColor);
 const radius=BorderRadius.circular(2),otherRadius=BorderRadius.circular(10),tab=material.TabBarThemeData.lerp(new material.TabBarThemeData({dividerHeight:2,splashBorderRadius:radius}),new material.TabBarThemeData({dividerHeight:10,splashBorderRadius:otherRadius}),.5);assert.equal(tab.dividerHeight,10);assert(tab.splashBorderRadius.equals(radius));
 const side=material.DatePickerThemeData.lerp(new material.DatePickerThemeData({todayBorder:new BorderSide({width:2,color:0xff123456})}),new material.DatePickerThemeData({todayBorder:new BorderSide({width:10,color:0xffabcdef})}),.5).todayBorder;assert.equal(side.width,1);assert.equal(side.color,0x80123456);
 assert.throws(()=>new material.AppBarThemeData({color:new Color(0xff123456)}),/removed/);assert.throws(()=>new material.DataTableThemeData({dataRowHeight:20}),/removed/);assert.throws(()=>new material.DataTableThemeData({dataRowMinHeight:20,dataRowMaxHeight:10}));assert.throws(()=>new material.SnackBarThemeData({width:10}));assert.throws(()=>new material.SnackBarThemeData({elevation:-1}));assert.throws(()=>new material.SnackBarThemeData({actionOverflowThreshold:2}));
 for(const D of [material.DatePickerThemeData,material.TimePickerThemeData,material.DropdownMenuThemeData])assert.throws(()=>new D({inputDecorationTheme:new material.InputDecorationTheme()}),/modern/);
 assert.equal(new material.DataTableThemeData().dataRowHeight,undefined);assert.equal(new material.AppBarThemeData().color,undefined);
});

test('13 inherited themes and all 14 ThemeData slots preserve one State and capture only source InheritedTheme owners',{timeout},()=>{
 const families=source.contracts.map((c,i)=>[material[c.symbol],material[c.symbol.replace('Data','')],slots[i]]),f=fixture();let created=0,disposed=0,read,captured;
 class Probe extends StatefulWidget{createState(){created++;return new ProbeState();}}
 class ProbeState extends State{build(context){read=families.map(([,T,slot])=>T?T.of(context):material.Theme.of(context)[slot]);captured=InheritedTheme.capture(context);assert.equal(material.DatePickerTheme.maybeOf(context),read[6]);assert.equal(material.DropdownMenuTheme.maybeOf(context),read[7]);return new SizedBox(1,1);}dispose(){disposed++;super.dispose();}}
 const globals=families.map(([D])=>new D()),theme=new material.ThemeData(Object.fromEntries(families.map(([,_T,slot],i)=>[slot,globals[i]]))),local=families.map(([D])=>new D()),wrap=(v,child)=>new material.Theme(theme,families.reduceRight((child,[,T],i)=>T?new T(v[i],child):child,child));
 try{const probe=new Probe();f.set(wrap(local,probe));assert.equal(created,1);for(const [i,[D,T,slot]]of families.entries()){assert(new material.ThemeData()[slot] instanceof D);assert.equal(theme.copyWith({[slot]:null})[slot],globals[i]);if(T){assert.equal(read[i],local[i]);assert.equal(new T(local[i],new SizedBox()).updateShouldNotify(new T(local[i].copyWith(),new SizedBox())),false);}}
 const changed=local.slice();changed[6]=new material.DatePickerThemeData({elevation:12});f.set(wrap(changed,probe));assert.equal(created,1);assert.equal(read[6].elevation,12);
 f.set(new material.Theme(theme,captured.wrap(new Builder(context=>{read=families.map(([,T,slot])=>T?T.of(context):material.Theme.of(context)[slot]);return new SizedBox(1,1);})))) ;
 for(const [i,[,T]]of families.entries())assert.equal(read[i],T?.prototype instanceof InheritedTheme?changed[i]:globals[i],slots[i]);
 for(const T of [material.BottomNavigationBarTheme,material.DataTableTheme]){assert(T.prototype instanceof InheritedWidget);assert.equal(T.prototype instanceof InheritedTheme,false);assert.throws(()=>new T(null,new SizedBox()),/canonical/);}
 assert(new material.MaterialBannerTheme(null,new SizedBox()).data instanceof material.MaterialBannerThemeData);for(const T of [material.AppBarTheme,material.BottomAppBarTheme,material.TabBarTheme]){assert(new T().child instanceof SizedBox);assert.equal(new T().copyWith,undefined);assert.equal(new T().lerp,undefined);}
 }finally{f.close();}assert.equal(created,1);assert.equal(disposed,1);
});

test('DatePicker M3 getters and generic non-null shape identity match 16 original token/state cases',{timeout},()=>{
 const originalFactory=material.TextButton.styleFrom;let factoryCalls=0;material.TextButton.styleFrom=(...args)=>{factoryCalls++;const value=originalFactory(...args);factoryResults.add(value);return value;};const f=fixture(),palettes=JSON.parse(fs.readFileSync(new URL('./fixtures/icon-button-defaults.json',import.meta.url))).palettes;
 try{for(const row of source.defaults){const palette=palettes.find(p=>p.brightness===row.brightness),text=new material.TextTheme(Object.fromEntries([['titleSmall',14],['headlineLarge',32],['labelLarge',14],['bodyLarge',16],['titleLarge',22]].map(([name,size])=>[name,new TextStyle({fontSize:size,inherit:false})]))),theme=new material.ThemeData({colorScheme:new material.ColorScheme({...Object.fromEntries(Object.entries(palette.roles).filter(([k])=>!['background','onBackground','surfaceVariant'].includes(k))),brightness:palette.brightness}),textTheme:text});let value;f.set(new material.Theme(theme,new Builder(context=>{value=material.DatePickerTheme.defaults(context);return new SizedBox(1,1);})));assert.deepEqual(Object.fromEntries(Object.keys(row.fields).map(k=>[k,encode(value[k],states(row.mask))])),row.fields,row.brightness+row.mask);assert.equal(describeDartType(readDartType(value.dayShape,WidgetStatePropertyAll,0)),'OutlinedBorder'); assert.equal(describeDartType(readDartType(value.yearShape,WidgetStatePropertyAll,0)),'OutlinedBorder');assert.equal(value.dayShape.resolve(states()) instanceof CircleBorder,true);assert.equal(value.yearShape.resolve(states()) instanceof StadiumBorder,true);}
 }finally{f.close();material.TextButton.styleFrom=originalFactory;}assert.equal(factoryCalls,32);
});

test('Core SystemUi style maps/diagnostics and DismissDirection enum preserve source order and values',{timeout},()=>{
 const old=FoundationBuildMode.mode;FoundationBuildMode.mode='debug';try{for(const name of ['light','dark'])assert.deepEqual(systemUiOverlayStyleToPlatformMap(SystemUiOverlayStyle[name]),source.systemUi[name]);assert.deepEqual(diagnostics(new SystemUiOverlayStyle()),source.systemUi.diagnostics);const value=new SystemUiOverlayStyle({statusBarColor:new Color(0xff123456),systemNavigationBarContrastEnforced:false}),copy=value.copyWith({statusBarColor:null});assert(value.equals(copy));assert.equal(value.hashCode,copy.hashCode);assert(Object.isFrozen(systemUiOverlayStyleToPlatformMap(value)));class Derived extends SystemUiOverlayStyle{}assert.equal(value.equals(new Derived({statusBarColor:value.statusBarColor,systemNavigationBarContrastEnforced:false})),false);assert.throws(()=>new SystemUiOverlayStyle({statusBarBrightness:'invalid'}));}finally{FoundationBuildMode.mode=old;}
 for(const [name,values]of Object.entries(source.enums)){const E=name==='DismissDirection'?DismissDirection:material[name];assert.deepEqual(E.values.map(v=>[v.name,v.index]),values,name);assert(Object.isFrozen(E));assert(Object.isFrozen(E.values));assert.throws(()=>new E(0,values[0][0]),/canonical/);}
});

function nativeSourcePath(ck,row){const builder=new ck.PathBuilder();try{for(const [op,v]of row.path)switch(op){case 'rect':builder.addRect(v);break;case 'move':builder.moveTo(...v);break;case 'line':builder.lineTo(...v);break;case 'quad':builder.quadTo(...v);break;case 'arc':builder.arcToRotated(v[2],v[3],0,true,!v[4],v[0],v[1]);break;case 'close':builder.close();break;default:throw Error(op);}return builder.detach();}finally{builder.delete();}}
test('12 source notch contours match actual owned Skia endpoint arcs by dense containment and CPU pixels',{timeout},async()=>{
 const ck=await ownedCanvasKit(),{createEnginePath}=await import(new URL('path.js',import.meta.resolve('@nelyx/skia-web/library')).href),surface=ck.MakeSurface(120,60),paint=new ck.Paint();paint.setColor(ck.Color(0,255,0,1));paint.setAntiAlias(false);let queries=0,pixels=0;
 try{for(const row of source.notches){const shape=new CircularNotchedRectangle({inverted:row.inverted});assert(shape instanceof NotchedShape);const product=createEnginePath(ck,shape.getOuterPath(Rect.fromLTWH(...row.host),Rect.fromLTWH(...row.guest)).snapshot()),original=nativeSourcePath(ck,row);try{for(let y=-1.25;y<62;y+=2)for(let x=-1.25;x<122;x+=2){assert.equal(product.contains(x,y),original.contains(x,y),JSON.stringify({row,x,y}));queries++;}
 const render=path=>{surface.getCanvas().clear(ck.Color(255,0,0,1));surface.getCanvas().drawPath(path,paint);surface.flush();const image=surface.makeImageSnapshot();try{return image.readPixels(0,0,{width:120,height:60,colorType:ck.ColorType.RGBA_8888,alphaType:ck.AlphaType.Unpremul,colorSpace:ck.ColorSpace.SRGB});}finally{image.delete();}};assert.deepEqual(render(product),render(original),JSON.stringify(row));pixels+=120*60;
 }finally{original.delete();product.delete();}}
 assert.equal(queries,23808);assert.equal(pixels,86400);
 }finally{paint.delete();surface.delete();}
});

test('global BottomAppBar notch and DatePicker palette feed actual Root CPU paint and drain resources',{timeout},async()=>{
 const f=await engineFixture(),surface=f.ck.MakeSurface(240,160);class Painter extends CustomPainter{constructor(shape,color){super();this.shape=shape;this.color=color;}paint(canvas){canvas.save();canvas.translate(20,20);canvas.drawRect(Rect.fromLTWH(0,0,120,60),new Paint({color:0xffff0000}));canvas.drawPath(this.shape.getOuterPath(Rect.fromLTWH(0,0,120,60),Rect.fromLTWH(40,-20,40,40)),new Paint({color:this.color}));canvas.restore();}shouldRepaint(){return true;}}
 try{const data=new material.ThemeData({bottomAppBarTheme:new material.BottomAppBarThemeData({shape:new CircularNotchedRectangle()}),datePickerTheme:new material.DatePickerThemeData({backgroundColor:new Color(0xff00ff00)})});f.set(new material.Theme(data,new Builder(context=>new CustomPaint(undefined,{painter:new Painter(material.BottomAppBarTheme.of(context).shape,material.DatePickerTheme.of(context).backgroundColor.toARGB32()),size:new Size(180,100)}))));f.library.replay(surface.getCanvas(),{commands:f.frame()});surface.flush();const image=surface.makeImageSnapshot();try{const pixel=(x,y)=>Array.from(image.readPixels(x,y,{width:1,height:1,colorType:f.ck.ColorType.RGBA_8888,alphaType:f.ck.AlphaType.Unpremul,colorSpace:f.ck.ColorSpace.SRGB}));assert.deepEqual(pixel(80,21),[255,0,0,255]);assert.deepEqual(pixel(80,60),[0,255,0,255]);}finally{image.delete();}f.set(new SizedBox(1,1));assert.equal(f.root.scheduler.transientCallbackCount,0);
 }finally{surface.delete();await f.close();}
});
