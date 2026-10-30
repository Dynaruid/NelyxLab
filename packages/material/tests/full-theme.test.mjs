import {Semantics} from '@nelyx/core/framework/widgets/semantics';
import {FoundationBuildMode} from '@nelyx/core/foundation/constants';
// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';import assert from 'node:assert/strict';
import {ThemeData,VisualDensity} from '@nelyx/material/theme-data';
import {Theme,AnimatedTheme,ThemeDataTween} from '@nelyx/material/theme';
import {MaterialApp} from '@nelyx/material/app';import {MaterialPageRoute,MaterialRouteTransitionMixin} from '@nelyx/material/page';
import {PageTransitionsTheme} from '@nelyx/material/page-transitions-theme';
import {SliderThemeData} from '@nelyx/material/slider-theme-data';import {SliderThemeData as SliderFromWidget} from '@nelyx/material/slider-theme';
import {ProgressIndicatorThemeData} from '@nelyx/material/progress-indicator-theme-data';import {ProgressIndicatorThemeData as ProgressFromWidget} from '@nelyx/material/progress-indicator-theme';
import {ThemeExtension} from '@nelyx/material/theme-extension';import {InputDecorationThemeData} from '@nelyx/material/input-decoration-theme-data';
import {Color} from '@nelyx/core/ui/color';import {FoundationPlatform} from '@nelyx/core/foundation/platform';
import {SystemColor} from '@nelyx/core/ui/system-color';import {bindSystemColorProvider} from '@nelyx/core/internal/ui/system-color-binding';
import {WidgetState} from '@nelyx/core/framework/widgets/widget-state';import {emptyWidgetStateSet} from '@nelyx/core/framework/widgets/widget-state';
import {TextTheme} from '@nelyx/material/text-theme';import {TextStyle} from '@nelyx/core/framework/painting/text-style';
import { RouteSettings } from '@nelyx/core/framework/widgets/pages';import {PageTransitionsBuilder} from '@nelyx/core/framework/widgets/page-transitions-builder';
import {Navigator,NavigatorController} from '@nelyx/core/framework/widgets/navigation';
import {AnimationStyle} from '@nelyx/core/framework/animation/animation-style';
import { DiagnosticPropertiesBuilder } from '@nelyx/core/foundation/diagnostics';
import {StatefulWidget,State} from '@nelyx/core/framework/widgets/framework';
import { Builder, SizedBox } from '@nelyx/core/framework/widgets/basic';import {Localizations,MediaQuery} from '@nelyx/core/framework/widgets/app-data';
import {fixture} from './root-fixture.mjs';
import {BinaryMessenger} from '@nelyx/core/services/binary-messenger';
import {ServicesBinding} from '@nelyx/core/services/binding';
import {JSONMethodCodec,StandardMethodCodec} from '@nelyx/core/services/message-codecs';
const timeout=1200000;
test('MaterialApp keeps its theme builder stable on size-only changes and responds to platform brightness',{timeout},async()=>{
    FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});
    const json=new JSONMethodCodec(),standard=new StandardMethodCodec();let platformBrightness='light',revision=0;
    class Platform extends BinaryMessenger {
        handlers=new Map();
        send(channel){const value=channel==='nelyx/environment'?new Map([['revision',revision],['locales',null],['localeSource','unavailable'],['brightness',platformBrightness],['textScale',1],['lifecycle','resumed'],['capabilities',new Map([['clipboardRead','unavailable'],['clipboardWrite','unavailable'],['navigation','available']])]]):channel==='flutter/keyboard'?new Map():null;return Promise.resolve((channel==='flutter/keyboard'?standard:json).encodeSuccessEnvelope(value));}
        setMessageHandler(channel,handler){if(handler)this.handlers.set(channel,handler);else this.handlers.delete(channel);}
    }
    const platform=new Platform(),services=new ServicesBinding(platform);await services.ready;
    const f=fixture({platformServices:services}),widths=[],brightness=[];let builds=0;
    const home=new Builder(context=>{widths.push(MediaQuery.of(context).width);brightness.push(Theme.of(context).brightness);return new SizedBox(1,1);});
    const resize=width=>{const metrics=f.root.context.readMetrics();Object.assign(metrics,{logicalWidth:width,physicalWidth:width,viewportGeneration:metrics.viewportGeneration+1});f.frame();};
    try{f.set(new MaterialApp({home,theme:ThemeData.light(),darkTheme:ThemeData.dark(),themeAnimationStyle:AnimationStyle.noAnimation,builder:(_context,child)=>{builds++;return child;}}));
        const initial=builds;resize(320);assert.equal(widths.at(-1),320);assert.equal(builds,initial,'Size alone must not recreate the application theme subtree');
        platformBrightness='dark';revision++;await services.refreshEnvironment();resize(360);assert.equal(brightness.at(-1),'dark');assert(builds>initial);
    }finally{f.close();services.dispose();assert.equal(platform.handlers.size,0);}
});
const snapshot=data=>Object.fromEntries(JSON.parse(new TextDecoder().decode(requireBytes())).eligibleFields.map(name=>[name,data[name]]));
// The explicit public raw shape is exercised without a factory or product-private field projection.
import fs from 'node:fs';
function requireBytes(){return fs.readFileSync(new URL('./fixtures/full-theme-fields.json',import.meta.url));}
class Palette extends ThemeExtension{constructor(value){super(Palette);this.value=value;}copyWith(){return new Palette(this.value);}lerp(other,t){return new Palette(other===null?this.value*(1-t):this.value+(other.value-this.value)*t);}equals(other){return other instanceof Palette&&other.value===this.value;}get hashCode(){return this.value;}}
class Second extends ThemeExtension{constructor(value){super(Second);this.value=value;}copyWith(){return new Second(this.value);}lerp(other,t){return new Second(this.value+(other.value-this.value)*t);}}
class Transition extends PageTransitionsBuilder{constructor(forward,reverse){super();this.forward=forward;this.reverse=reverse;this.calls=[];}get transitionDuration(){return this.forward;}get reverseTransitionDuration(){return this.reverse;}buildTransitions(route,context,a,s,child){this.calls.push(route);return child;}}
const pageTheme=builder=>new PageTransitionsTheme({builders:new Map([['windows',builder]])});
const settle=f=>{f.frame();f.advance(700);f.frame();};

test('complete M3 raw shape retains all77 exact supplied field values and bypasses factory typography/defaults',{timeout},()=>{
    const base=new ThemeData({platform:'windows'}),values=snapshot(base),text=new TextTheme({bodyMedium:new TextStyle({fontSize:11})});values.textTheme=text;
    const reads=new Map(),getters=Object.create(null);for(const [key,value]of Object.entries(values))Object.defineProperty(getters,key,{get(){reads.set(key,(reads.get(key)??0)+1);return value;}});ThemeData.raw(getters);assert([...reads.values()].every(n=>n===1));const borrowed=ThemeData.raw(base);assert.equal(borrowed.extensions,base.extensions);assert.equal(borrowed.textTheme,base.textTheme);const data=ThemeData.raw(values);for(const [name,value]of Object.entries(values))assert.equal(data[name],value,name);
    assert.equal(data.textTheme.labelLarge,null);assert(Object.isFrozen(data));assert(data instanceof ThemeData);
    assert.throws(()=>ThemeData.raw({...values,sliderTheme:undefined}),/requires sliderTheme/);assert.throws(()=>ThemeData.raw({...values,platform:null}),/requires platform/);
    assert.equal(data.copyWith().textTheme,text);assert.equal(SliderThemeData,SliderFromWidget);assert.equal(ProgressIndicatorThemeData,ProgressFromWidget);
    assert(base.sliderTheme instanceof SliderThemeData);assert(base.progressIndicatorTheme instanceof ProgressIndicatorThemeData);assert(base.pageTransitionsTheme instanceof PageTransitionsTheme);
    for(const legacy of ['useMaterial3','applyElevationOverlayColor','buttonTheme','buttonBarTheme','dialogBackgroundColor','indicatorColor']){assert.throws(()=>new ThemeData({[legacy]:false}),/removed/i);assert.throws(()=>data.copyWith({[legacy]:false}),/removed/i);}
});
test('copyWith keeps text, maps, splash and unmodified values through platform/brightness changes',{timeout},()=>{
    FoundationPlatform.configure({kind:'web',operatingSystem:'android'});const original=new ThemeData({platform:'android',extensions:[new Palette(2)]}),factory=original.splashFactory;
    FoundationPlatform.configure({kind:'native',operatingSystem:'windows'});assert.equal(original.splashFactory,factory);
    const next=original.copyWith({platform:'windows',brightness:'dark',primaryColor:null});assert.equal(next.splashFactory,factory);assert.equal(next.primaryColor,original.primaryColor);assert.equal(next.textTheme,original.textTheme);assert.equal(next.primaryTextTheme,original.primaryTextTheme);assert.equal(next.adaptationMap,original.adaptationMap);assert.equal(next.extensions,original.extensions);assert.equal(next.brightness,'dark');assert.equal(next.copyWith({extensions:[]}).extensions.size,0);
});
test('ThemeData lerp follows continuous values, halfway switches and asymmetric extension membership',{timeout},()=>{
    const inputA=new InputDecorationThemeData(),inputB=new InputDecorationThemeData(),bOnly=new Second(99),a=new ThemeData({canvasColor:new Color(0xff000000),platform:'windows',inputDecorationTheme:inputA,visualDensity:new VisualDensity({horizontal:-2}),extensions:[new Palette(2)]}),b=new ThemeData({canvasColor:new Color(0xffffffff),platform:'android',inputDecorationTheme:inputB,visualDensity:new VisualDensity({horizontal:2}),extensions:[new Palette(6),bOnly]});
    for(const t of [-.5,0,.25,.5,.75,1,1.5]){const value=ThemeData.lerp(a,b,t);assert(value.canvasColor.equals(Color.lerp(a.canvasColor,b.canvasColor,t)));assert.equal(value.visualDensity.horizontal,-2+4*t);assert.equal(value.platform,t<.5?'windows':'android');assert.equal(value.inputDecorationTheme,t<.5?inputA:inputB);assert.equal(value.extension(Palette).value,2+4*t);assert.equal(value.extension(Second),bOnly);}
    assert.equal(ThemeData.lerp(a,a,NaN),a);const empty=new ThemeData(),only=ThemeData.lerp(a,empty,.25);assert.equal(only.extension(Palette).value,1.5);
    const tween=new ThemeDataTween({begin:a,end:b});assert(tween.lerp(.5).equals(ThemeData.lerp(a,b,.5)));assert.throws(()=>new ThemeDataTween().lerp(.5),/non-null/);
});
test('ThemeData equality compares map values independent of insertion order and diagnostics retain source field order',{timeout},()=>{
    const a=new ThemeData({extensions:[new Palette(4)]}),b=a.copyWith({extensions:[new Palette(4)]});assert(a.equals(b));assert.equal(a.hashCode,b.hashCode);assert(!a.equals(b.copyWith({platform:a.platform==='android'?'windows':'android'})));
    class Derived extends ThemeData{}assert(!a.equals(new Derived()));FoundationBuildMode.mode='debug';const builder=new DiagnosticPropertiesBuilder();a.debugFillProperties(builder);assert.equal(builder.properties.length,77);assert.equal(builder.properties[0].name,'adaptations');assert.equal(builder.properties[2].name,'extensions');assert.equal(builder.properties.at(-1).name,'tooltipTheme');assert(builder.properties.every(p=>!['useMaterial3','buttonTheme'].includes(p.name)));FoundationBuildMode.mode='release';
});
test('SystemColor keeps unavailable native palettes, stable supported values and borrowed provider stacking',{timeout},()=>{
    assert.equal(SystemColor.platformProvidesSystemColors,false);assert.throws(()=>SystemColor.light.canvas,/not supported/);assert.equal(new SystemColor({name:'Canvas'}).isSupported,false);
    const first=bindSystemColorProvider({color:(brightness,name)=>name==='Canvas'?new Color(brightness==='light'?0xff123456:0xffabcdef):null}),saved=SystemColor.light.canvas;assert.equal(SystemColor.light.canvas,saved);assert.equal(saved.isSupported,true);assert.equal(SystemColor.dark.canvas.value.toARGB32(),0xffabcdef);
    const top=bindSystemColorProvider({color:()=>null});first.dispose();assert.equal(SystemColor.light.canvas.value,null);top.dispose();assert.equal(SystemColor.platformProvidesSystemColors,false);first.dispose();assert.throws(()=>SystemColor.dark.canvas,/not supported/);
});
test('useSystemColors replaces only source-selected scheme, typography, buttons and input fields',{timeout},()=>{
    const colors={AccentColor:0xff112233,AccentColorText:0xff334455,Canvas:0xff556677,CanvasText:0xff778899,ButtonFace:0xff99aabb,ButtonText:0xffaabbcc,ButtonBorder:0xffbbccdd,Field:0xffccddee,FieldText:0xffddeeff},owner=bindSystemColorProvider({color:(_b,name)=>name in colors?new Color(colors[name]):null});
    try{const base=new ThemeData(),data=new ThemeData({useSystemColors:true}),enabled=(()=>{const states=emptyWidgetStateSet();states.add(WidgetState.pressed);return states;})();assert.equal(data.colorScheme.primary,base.colorScheme.primary);assert.equal(data.colorScheme.secondary,colors.AccentColor);assert.equal(data.colorScheme.onSecondary,colors.AccentColorText);assert.equal(data.colorScheme.surface,colors.Canvas);assert.equal(data.colorScheme.onSurface,colors.CanvasText);assert.equal(data.canvasColor.toARGB32(),base.canvasColor.toARGB32());assert.equal(data.textTheme.bodyMedium.color,colors.CanvasText);assert.equal(data.inputDecorationTheme.fillColor.toARGB32(),colors.Field);assert.equal(data.inputDecorationTheme.labelStyle.color,colors.FieldText);for(const name of ['textButtonTheme','outlinedButtonTheme','elevatedButtonTheme','filledButtonTheme']){assert.equal(data[name].style.foregroundColor.resolve(enabled).toARGB32(),colors.ButtonText);assert.equal(data[name].style.backgroundColor.resolve(enabled).toARGB32(),colors.ButtonFace);assert.equal(data[name].style.side.resolve(enabled).color,colors.ButtonBorder);}assert.equal(data.floatingActionButtonTheme.backgroundColor.toARGB32(),colors.ButtonFace);}finally{owner.dispose();}
});
test('AnimatedTheme uses canonical implicit ticks, preserves child State and retires the ticker on unmount',{timeout},()=>{
    const f=fixture(),read=[],counts={created:0,closed:0};let ends=0;class Probe extends StatefulWidget{createState(){counts.created++;return new(class extends State{build(context){read.push(Theme.of(context).colorScheme.primary);return new SizedBox(1,1);}dispose(){counts.closed++;super.dispose();}})();}}
    const child=new Probe(),a=new ThemeData(),b=a.copyWith({colorScheme:a.colorScheme.copyWith({primary:0xffabcdef})}),wrap=data=>new AnimatedTheme({data,child,duration:100,onEnd:()=>ends++});
    try{f.set(wrap(a));assert.equal(read.at(-1),a.colorScheme.primary);f.set(wrap(b));f.frame();f.advance(50);assert.equal(read.at(-1),ThemeData.lerp(a,b,.5).colorScheme.primary);f.advance(50);assert.equal(read.at(-1),b.colorScheme.primary);f.advance(1);assert.equal(ends,1);assert.equal(counts.created,1);f.set(new SizedBox());assert.equal(counts.closed,1);assert.equal(f.root.scheduler.transientCallbackCount,0);}finally{f.close();}
});
test('MaterialPageRoute policy uses current Theme builder durations, Semantics and typed completion on actual Navigator',{timeout},async()=>{
    FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=fixture(),controller=new NavigatorController(),first=new Transition(100,120),next=new Transition(230,410),base=new ThemeData({platform:'windows',pageTransitionsTheme:pageTheme(first)}),root=new MaterialPageRoute({builder:()=>new SizedBox(1,1),settings:new RouteSettings({name:'/'})}),route=new MaterialPageRoute({builder:()=>new SizedBox(1,1),settings:new RouteSettings({name:'/next'})});const wrap=data=>new Theme(data,new Navigator(controller,root));
    try{f.set(wrap(base));const completion=controller.push(route);f.frame();assert.equal(route.animation.duration,100);settle(f);assert(route instanceof MaterialRouteTransitionMixin);assert.equal(route.barrierColor,null);assert.equal(route.barrierLabel,null);assert.equal(route.maintainState,true);assert(first.calls.includes(route));const scopes=[];const visit=e=>{if(e.widget instanceof Semantics&&e.widget.properties.scopesRoute)scopes.push(e.widget);e.visitChildren(visit);};visit(f.root.root);assert.equal(scopes.length,2);assert(scopes.every(w=>w.explicitChildNodes));const latest=base.copyWith({pageTransitionsTheme:pageTheme(next)});f.set(wrap(latest));assert.equal(route.reverseTransitionDuration,410);assert.equal(controller.pop('done'),true);f.frame();assert.equal(route.animation.reverseDuration,410);assert.equal(await completion,'done');settle(f);await route.completed;assert.equal(route.animation,null);assert.equal(controller.routes.length,1);assert.equal(f.root.scheduler.transientCallbackCount,0);}finally{f.close();controller.dispose();}
});
test('MaterialApp home and named/default routes use MaterialPageRoute, Korean locale and AnimatedTheme',{timeout},async()=>{
    FoundationPlatform.configure({kind:'web',operatingSystem:'windows'});const f=fixture(),controller=new NavigatorController(),routes={'/named':()=>new SizedBox(1,1)},locales=[],home=new Builder(context=>{locales.push(Localizations.of(context).locale);return new SizedBox(1,1);});
    try{f.set(new MaterialApp({home,routes,navigatorController:controller}));assert(controller.routes[0].route instanceof MaterialPageRoute);assert.equal(locales.at(-1),'ko-KR');const names=[];const visit=e=>{names.push(e.widget.constructor.name);e.visitChildren(visit);};visit(f.root.root);assert(names.includes('AnimatedTheme'));f.set(new MaterialApp({home,routes,navigatorController:controller,themeAnimationStyle:AnimationStyle.noAnimation}));names.length=0;visit(f.root.root);assert(!names.includes('AnimatedTheme'));const result=controller.pushNamed('/named',{item:3});f.frame();settle(f);const named=controller.routes.at(-1).route;assert(named instanceof MaterialPageRoute);assert.equal(named.settings.name,'/named');assert.equal(Object.getPrototypeOf(named.settings.arguments),null);assert.deepEqual({...named.settings.arguments},{item:3});assert.equal(controller.pop(42),true);f.frame();assert.equal(await result,42);settle(f);assert.equal(controller.routes.length,1);}finally{f.close();controller.dispose();}
});



const original=JSON.parse(fs.readFileSync(new URL('./fixtures/full-theme-source.json',import.meta.url)));
test('ten unchanged original ThemeData spans agree with actual raw/copy and selected continuous/discrete recipes',{timeout},()=>{
    const a=new ThemeData({platform:'windows',canvasColor:Color.from({alpha:1,red:.2,green:.2,blue:.4}),visualDensity:new VisualDensity({horizontal:0}),extensions:[new Palette(2)]}),extra=new Second(99),b=new ThemeData({platform:'android',canvasColor:Color.from({alpha:1,red:.6,green:.2,blue:.4}),visualDensity:new VisualDensity({horizontal:2}),extensions:[new Palette(6),extra]});
    for(const row of original.results){const value=ThemeData.lerp(a,b,row.t);assert(Math.abs(value.canvasColor.r*10-row.values.canvasColor)<1e-12);assert.equal(value.visualDensity.horizontal,(row.values.visualDensity-2)/2);assert.equal(value.platform,row.values.platform);assert.equal(value.extension(Palette).value,row.palette);assert.equal(value.extension(Second)===extra,row.bOnlySame);assert.equal(value.adaptationMap===(row.t<.5?a.adaptationMap:b.adaptationMap),row.adaptationsSame);}
    const text=new TextTheme({bodyMedium:new TextStyle({fontSize:99})}),copied=a.copyWith({platform:'android',brightness:'dark',textTheme:text});assert.equal(copied.textTheme.bodyMedium.fontSize,original.copy.text);assert.equal(copied.primaryTextTheme===a.primaryTextTheme,original.copy.primaryTextSame);assert.equal(copied.brightness,original.copy.brightness);assert.equal(copied.primaryColor===a.primaryColor,original.copy.primarySame);assert.equal(copied.extensions===a.extensions&&copied.adaptationMap===a.adaptationMap,original.copy.mapsSame);assert.equal(a.equals(a.copyWith()),original.equalCopy);assert.equal(a.hashCode===a.copyWith().hashCode,original.equalHash);assert.equal(ThemeData.lerp(a,a,NaN)===a,original.identicalLerp);
});

