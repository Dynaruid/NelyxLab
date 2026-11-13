// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import { textStyleApplyReference } from './text-style-apply-reference.mjs';
const watchdog = setTimeout(() => {
  throw Error('TextStyle construction checks exceeded 20 minutes');
}, 1_200_000);
try {
  // Run the same public apply protocol against the independent public
  // constructor. The fixed-schema implementation is never used by this side.
  const reference = textStyleApplyReference();
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import {TextStyle,isCapturedTextStyle} from './Nelyx/src/framework/painting/text-style.ts';
        import {TextScaler} from './Nelyx/src/framework/painting/text-scaler.ts';
        import {FontWeight,FontFeature,FontVariation,TextDecoration,kTextHeightNone} from './Nelyx/src/ui/typography.ts';
        import {invariant} from './Nelyx/src/foundation/errors.ts';
        import {Shadow} from './Nelyx/src/ui/shadow.ts';
        import {Paint} from './Nelyx/src/ui/paint.ts';
        import {FoundationBuildMode} from './Nelyx/src/foundation/constants.ts';
        ${reference}
        const originalMode=FoundationBuildMode.mode;
        function compare(base,options={}) {
          const expected=referenceApply.call(base,options),actual=base.apply(options);
          assert.deepEqual(Object.getOwnPropertyDescriptors(actual),Object.getOwnPropertyDescriptors(expected));
          assert.equal(Object.getPrototypeOf(actual),TextStyle.prototype);
          assert.equal(actual instanceof TextStyle,true);assert(Object.isFrozen(actual));
          assert.notEqual(actual,expected);assert.notEqual(actual,base.apply(options),'apply shared a Source value');
          assert.deepEqual(actual.toRunStyle(TextScaler.noScaling),expected.toRunStyle(TextScaler.noScaling));
          assert.equal(isCapturedTextStyle(actual),isCapturedTextStyle(expected));
          for(const key of ['shadows','fontFeatures','fontVariations','rawFontFamilyFallback'])
            if(actual[key]){assert.notEqual(actual[key],base[key]);assert(Object.isFrozen(actual[key]));}
          if(actual.shadows?.length){assert.notEqual(actual.shadows[0],base.shadows?.[0]);assert(Object.isFrozen(actual.shadows[0]));}
          return actual;
        }
        try {
          for(const mode of ['release','debug']) {
            FoundationBuildMode.mode=mode;
            const basic=new TextStyle(),rich=new TextStyle({inherit:false,color:0xff123456,backgroundColor:0xff112233,
              fontFamily:'body',fontFamilyFallback:['a','b'],package:'ui',fontSize:17,fontWeight:FontWeight.w500,
              fontStyle:'italic',letterSpacing:1,wordSpacing:2,textBaseline:'alphabetic',height:1.2,
              leadingDistribution:'even',locale:'en',shadows:[new Shadow({color:0xff223344,offset:{x:2,y:3},blurRadius:4})],
              decoration:TextDecoration.underline,decorationColor:0xff345678,decorationThickness:2,decorationStyle:'solid',
              fontFeatures:[new FontFeature('smcp')],fontVariations:[new FontVariation('wght',500)],debugLabel:'source',overflow:'ellipsis'});
            compare(basic);compare(basic,{color:0xff123456});compare(rich);
            compare(rich,{color:0xff654321,backgroundColor:0xff332211,fontFamily:'other',package:'pkg',fontFamilyFallback:['fallback'],
              fontSizeFactor:1.5,fontSizeDelta:1,fontWeightDelta:2,letterSpacingFactor:2,letterSpacingDelta:3,
              wordSpacingFactor:3,wordSpacingDelta:4,heightFactor:2,heightDelta:1,
              decorationThicknessFactor:2,decorationThicknessDelta:1,fontStyle:'normal',locale:'ko',overflow:'clip'});
            const paint=new Paint({color:0xff123456}),painted=new TextStyle({foreground:paint});
            const next=compare(painted,{color:0xff654321});assert.equal(next.foreground,paint);assert.equal(next.color,null);
            paint.color=0xffabcdef;assert.deepEqual(next.toRunStyle(),referenceApply.call(painted).toRunStyle());
            class Derived extends TextStyle {extra=17;}
            const derived=new Derived({fontSize:13});assert.equal(derived.extra,17);assert(Object.isExtensible(derived));
            compare(derived,{color:0xffaabbcc});
            const reads=[[],[]],options=index=>new Proxy({color:0xff112233,locale:'ko'}, {get(target,key){reads[index].push(key);return Reflect.get(target,key);}});
            referenceApply.call(rich,options(0));rich.apply(options(1));assert.deepEqual(reads[1],reads[0],'Option getter order changed');
            const receiverReads=[[],[]],receiver=index=>new Proxy(rich,{get(target,key,proxy){receiverReads[index].push(key);return Reflect.get(target,key,proxy);}});
            referenceApply.call(receiver(0),{});TextStyle.prototype.apply.call(receiver(1),{});assert.deepEqual(receiverReads[1],receiverReads[0],'Receiver getter order changed');
            const nestedReads=[[],[]],nested=index=>({shadows:[{
              get color(){nestedReads[index].push('color');return 0xff123456;},
              get offset(){nestedReads[index].push('offset');return {get x(){nestedReads[index].push('x');return 2;},get y(){nestedReads[index].push('y');return 3;}};},
              get blurRadius(){nestedReads[index].push('blur');return 4;}
            }],fontFeatures:new Proxy([new FontFeature('smcp')],{get(target,key,receiver){nestedReads[index].push(String(key));return Reflect.get(target,key,receiver);}})});
            referenceApply.call(rich,nested(0));rich.apply(nested(1));assert.deepEqual(nestedReads[1],nestedReads[0],'Nested array/Shadow reads changed');
            const sentinel={},effects=[[],[]];
            for(const [index,apply] of [referenceApply,TextStyle.prototype.apply].entries())
              assert.throws(()=>apply.call(rich,new Proxy({}, {get(_target,key){effects[index].push(key);if(key==='fontStyle')throw sentinel;}})),error=>error===sentinel);
            assert.deepEqual(effects[1],effects[0],'Throw boundary changed');
            for(const options of [{fontWeightDelta:1.5},{fontSizeFactor:NaN},{package:'bad\\0package'},{overflow:'unknown'}]) {
              const failures=[referenceApply,TextStyle.prototype.apply].map(apply=>{try{apply.call(rich,options);}catch(error){return [error.constructor,error.message];}assert.fail('Invalid text style accepted');});
              assert.deepEqual(failures[1],failures[0]);
            }
          }
          let setters=0;Object.defineProperty(TextStyle.prototype,'color',{configurable:true,set(){++setters;}});
          try{compare(new TextStyle({color:0xff123456}),{color:0xff654321});assert.equal(setters,0);}
          finally{delete TextStyle.prototype.color;}
          const fallback=Object.getOwnPropertyDescriptor(TextStyle.prototype,'fontFamilyFallback'),observed=[];
          Object.defineProperty(TextStyle.prototype,'fontFamilyFallback',{configurable:true,get(){observed.push(Object.getOwnPropertyDescriptors(this));return fallback.get.call(this);}});
          try{const base=new TextStyle({fontFamilyFallback:['a']});observed.length=0;compare(base,{color:0xff123456});assert.deepEqual(observed[1],observed[0],'Construction getter observed different fields');}
          finally{Object.defineProperty(TextStyle.prototype,'fontFamilyFallback',fallback);}
          const parent=Object.getPrototypeOf(TextStyle);let parentCalls=0;
          class Replacement {constructor(){++parentCalls;this.extra=23;}}
          const base=new TextStyle({fontSize:12});
          Object.setPrototypeOf(TextStyle,Replacement);
          try{const actual=compare(base);assert.equal(actual.extra,23);assert.equal(parentCalls,3);}
          finally{Object.setPrototypeOf(TextStyle,parent);}
          console.log('TextStyle apply: public constructor differential fields/descriptors/prototype, fresh values/lists/Shadows, package/deltas, Paint, Proxy/getter/throw ordering, inheritance and superclass fallback PASS');
        } finally {FoundationBuildMode.mode=originalMode;}
      `,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    logLevel: 'silent',
  });
  await import(
    'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
