// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import path from 'node:path';

const watchdog = setTimeout(() => {
  throw Error('Native paragraph update checks exceeded 20 minutes');
}, 1_200_000);
try {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import {RenderParagraph,captureRichParagraphConfiguration} from '@nelyx/core/framework/rendering/paragraph';
      import {claimNativeRenderObject} from '@nelyx/core/framework/rendering/object';
      import {TextSpan} from '@nelyx/core/framework/painting/text-span';
      import {TextStyle} from '@nelyx/core/framework/painting/text-style';
      import {TextScaler} from '@nelyx/core/framework/painting/text-scaler';
      import {Paint} from '@nelyx/core/ui/paint';
      import {ResourceRegistry} from '@nelyx/core/hosting/resources';
      import {SemanticsConfiguration} from '@nelyx/core/framework/semantics/semantics';
      import {Locale} from '@nelyx/core/ui/locale';
      import {originalSpanInput} from './Nelyx/runtime/app/spans.ts';
      const resources=new ResourceRegistry(),font=resources.allocateId('native-paragraph-font'),otherFont=resources.allocateId('native-paragraph-font');
      resources.register({...font,kind:'font'},()=>{});resources.register({...otherFont,kind:'font'},()=>{});
      const text=new Proxy({}, {get(_target,key){throw Error('Unexpected TS paragraph query: '+String(key));}}),
        context={text,resources,font,scale:1},renders=[];
      const source=(extra={})=>captureRichParagraphConfiguration({span:new TextSpan({text:'15'}),style:new TextStyle({fontSize:14,color:0xff123456}),
        scaler:TextScaler.noScaling,placeholderCount:0,font,scale:1,painterOptions:{textDirection:'ltr'},paragraphOptions:{softWrap:true,overflow:'clip'},...extra});
      const make=(native=true)=>{
        const render=RenderParagraph._fromConfiguration(source(),context as any);renders.push(render);
        const changes=[];
        if(native)claimNativeRenderObject(render,{},kind=>changes.push(kind));
        else {const original=render.markNeedsLayout;render.markNeedsLayout=function(){changes.push('layout');return original.call(this);};}
        return {render,changes};
      };
      try {
        for(const overflow of ['clip','fade']){
          const input=source({paragraphOptions:{overflow}}),reads=[];
          const paragraphOptions=new Proxy(input.paragraphOptions,{get(target,key,receiver){if(key==='overflow')reads.push(key);return Reflect.get(target,key,receiver);}});
          const render={config:{...input,paragraphOptions},children:[],registrar:null};
          originalSpanInput(render as any,reason=>{throw Error(reason);});
          assert.deepEqual(reads,['overflow','overflow','overflow'],'Payload preparation changed Source overflow getter reads');
        }
        const {render,changes}=make(),before=originalSpanInput(render,reason=>{throw Error(reason);});
        assert.equal((render as any).painter._needsLayout,true,'Fixture unexpectedly has a TS layout cache');
        assert.equal((render as any).describedSemanticsConfiguration,undefined);
        const next=source();render.config=next;
        assert.equal(render.config,next,'The new Source configuration was skipped');
        assert.deepEqual(changes,[],'Absent TS cache invalidated an unchanged native paragraph');
        assert.equal((render as any).painter._needsLayout,true,'Native update pretended to create a TS layout cache');
        assert.equal((render as any).describedSemanticsConfiguration,undefined,'Native update invented a TS semantics cache');
        assert.deepEqual(originalSpanInput(render,reason=>{throw Error(reason);}),before,'Unchanged native capture changed its paragraph');
        const semantics=new SemanticsConfiguration();render.describeSemanticsConfiguration(semantics);
        assert.equal(semantics.label,'15','Explicit Source semantics no longer describes current text');
        for(const extra of [
          {span:new TextSpan({text:'16'})},
          {style:new TextStyle({fontSize:16,color:0xff123456})},
          {style:new TextStyle({fontSize:14,color:0xff654321})},
          {scaler:TextScaler.linear(1.2)}, {font:otherFont}, {scale:2},
          {painterOptions:{textDirection:'rtl'}}, {painterOptions:{textDirection:'ltr',textAlign:'end'}},
          {painterOptions:{textDirection:'ltr',locale:new Locale('ko')}},
          {painterOptions:{textDirection:'ltr',maxLines:1,ellipsis:'…'}},
          {paragraphOptions:{softWrap:false,overflow:'visible'}},
          {span:new TextSpan({text:'15',semanticsLabel:'fifteen'})},
        ]){
          const {render,changes}=make();render.config=source(extra);
          assert(changes.length,'Actual native paragraph input/metadata change lost invalidation');
        }
        const ordinary=make(false);ordinary.render.config=source();
        assert(ordinary.changes.includes('layout'),'Ordinary TS renderer lost its existing cold-cache invalidation');
        for(const accessor of [false,true]){
          const custom=make(),original=custom.render.markNeedsLayout,order=[];
          const hook=function(){order.push('call');return original.call(this);};
          Object.defineProperty(custom.render,'markNeedsLayout',accessor?{configurable:true,get(){order.push('get');return hook;}}:{configurable:true,value:hook});
          custom.render.config=source();assert.deepEqual(order,accessor?['get','call']:['call'],'Custom invalidation hook was skipped or read during eligibility');
          assert(custom.changes.includes('layout'),'Custom render hook lost its original invalidation');
        }
        const originalHook=Object.getOwnPropertyDescriptor(RenderParagraph.prototype,'markNeedsLayout'),inherited=RenderParagraph.prototype.markNeedsLayout,prototypeOrder=[];
        Object.defineProperty(RenderParagraph.prototype,'markNeedsLayout',{configurable:true,get(){prototypeOrder.push('get');return function(){prototypeOrder.push('call');return inherited.call(this);};}});
        try {const custom=make();prototypeOrder.length=0;custom.render.config=source();assert.deepEqual(prototypeOrder,['get','call'],'Prototype accessor eligibility changed Source call ordering');}
        finally {if(originalHook)Object.defineProperty(RenderParagraph.prototype,'markNeedsLayout',originalHook);else delete RenderParagraph.prototype.markNeedsLayout;}
        const proxied=make(false),wrapped=new Proxy(proxied.render,{}),proxyChanges=[];
        claimNativeRenderObject(wrapped,{},kind=>proxyChanges.push(kind));wrapped.config=source();
        assert(proxyChanges.includes('layout'),'Proxy render was admitted as canonical native configuration');
        const paint=new Paint({color:0xff123456});
        class CustomStyle extends TextStyle {}
        class CustomScaler extends TextScaler {scale(size){return size;}get textScaleFactor(){return 1;}}
        for(const extra of [{style:new TextStyle({fontSize:14,foreground:paint})},{style:new CustomStyle({fontSize:14})},
          {scaler:new CustomScaler()},{painterOptions:{textDirection:'ltr',locale:new Locale('en')}}]){
          const custom=make();custom.render.config=source(extra);custom.changes.length=0;custom.render.config=source(extra);
          assert(custom.changes.includes('layout'),'Mutable or custom paragraph input lost its original capture path');
        }
        class CustomSpan extends TextSpan {comparisons=0;override compareTo(other){++this.comparisons;return super.compareTo(other);}}
        const custom=make(),oldSpan=new CustomSpan({text:'15'});custom.render.config=source({span:oldSpan});custom.changes.length=0;
        const newSpan=new CustomSpan({text:'15'});custom.render.config=source({span:newSpan});
        assert(oldSpan.comparisons>0,'Native update skipped custom span comparison');
        assert(custom.changes.length,'Custom span metadata was treated as static plain text');
        const stale=make();resources.releaseProducer(otherFont);
        assert.throws(()=>{stale.render.config=source({font:otherFont});},/foreign or retired/,'Input comparison bypassed resource validation');
        console.log('Native paragraph: unchanged Source update without TS cache invalidation, current wire/semantics, text/style/scaler/font/options changes, ordinary renderer, custom span and stale resource PASS.');
      } finally {
        for(const render of renders)render.dispose();
        resources.dispose();
      }
    `,
    },
    bundle: true,
    alias: { '@nelyx/core': path.resolve('Nelyx/src') },
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
