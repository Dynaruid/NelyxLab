// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import path from 'node:path';

const watchdog = setTimeout(() => {
  throw Error('App font family checks exceeded 20 minutes');
}, 1_200_000);
try {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import {ResourceRegistry} from '@nelyx/core/hosting/resources';
      import {AppTextLayoutService} from './Nelyx/runtime/app/text.ts';
      import {nativeAppTextBackend,appTextQuotaBytes} from './Nelyx/runtime/engine-client/app-text.ts';
      import {fontCatalogBytes,bundledFontFamilies} from './Nelyx/runtime/engine-client/font-catalog.ts';
      import {WebAppTextBackend,AppTextBudget} from './Nelyx/engine/platform/web/app-text.ts';
      const resources=new ResourceRegistry(),font=resources.allocateId('font-family-check');
      resources.register({...font,kind:'font'},()=>{});
      const unsupported=reason=>{throw Error(reason);},services=[];
      const service=backend=>{const value=new AppTextLayoutService(backend,resources,font,unsupported,undefined,false);services.push(value);return value;};
      const input={text:'15',width:100,font,fontSize:14,locale:'en',direction:'ltr',scale:1,style:{fontFamilies:['CalendarFont','NelyxDefault']}};
      try {
        for(const capability of [undefined,1]){
          let snapshots=0,optionalReads=0;
          const fallback={snapshot(revision=1){++snapshots;return {version:12,fontRevision:revision,fontFamilies:['NelyxDefault'],closed:false,...(capability?{fontFamiliesVersion:capability}:{})};}};
          Object.defineProperty(fallback,'fontFamilies',{get(){++optionalReads;if(!capability)throw Error('Unnegotiated optional getter');return undefined;}});
          const value=service(fallback as any),before=snapshots;
          assert.deepEqual([...value.fontFamilies],['NelyxDefault']);
          assert.equal((value as any).input(input).paragraph.fontFamily,undefined);
          assert.equal(snapshots,before+2,'Legacy/missing method stopped using live snapshots');
          value.observeFontRevision(1n);assert.equal(snapshots,before+3,'Legacy state polls stopped validating the backend revision');
          assert.equal(optionalReads,capability?1:0,'Legacy optional getter was observed');
        }
        let fullReads=0,thinReads=0,counterReads=0,providerClosed=0,catalogClosed=0;
        const counters=new Proxy({paragraphLayouts:0,dynamicFontLoads:0,heapBytes:0,immutableBufferCopies:0,immutableBufferCopyBytes:0,immutableBufferReads:0,immutableBufferReadBytes:0},
          {get(target,key){++counterReads;return target[key];}});
        const provider={counters,makeAppFontCatalog(catalog){return {families:Object.freeze([...bundledFontFamilies,...catalog.fonts.map(font=>font.family)]),close(){++catalogClosed;}};},close(){++providerClosed;}};
        const budget=new AppTextBudget(appTextQuotaBytes),backend=new WebAppTextBackend(provider as any,budget);
        const measured=new Proxy(backend,{get(target,key){const member=target[key];if(typeof member!=='function')return member;
          return (...args)=>{if(key==='snapshot')++fullReads;if(key==='fontFamilies')++thinReads;return member.apply(target,args);};}});
        const value=service(measured),initialFull=fullReads;
        const first=value.fontFamilies as Set<string>;
        first.clear();first.add('CallerMutation');
        const beforeCounters=counterReads;
        assert.deepEqual([...value.fontFamilies],bundledFontFamilies,'Caller mutation escaped its result');
        assert.equal((value as any).input(input).paragraph.fontFamily,undefined);
        assert.equal(counterReads,beforeCounters,'Thin reads touched provider accounting counters');
        assert.equal(fullReads,initialFull,'Paragraph inputs still fetched accounting snapshots');
        assert.equal(thinReads,3);
        for(let i=0;i<4;++i)value.observeFontRevision(1n);
        assert.equal(fullReads,initialFull,'Unchanged state polls still fetched accounting snapshots');
        assert.equal(thinReads,7,'State polls cached away the live revision fence');
        assert.equal(counterReads,beforeCounters,'State polls touched unrelated owner accounting');
        const beforeDiagnostics=fullReads;assert.equal(value.execution.paragraphs,0);
        assert.equal(fullReads,beforeDiagnostics+1,'Execution diagnostics stopped reading current counters');
        const catalog=fontCatalogBytes({fonts:[{family:'CalendarFont',bytes:new Uint8Array(12)}]});
        const rollback=backend.prepareFonts(catalog),candidate=backend.activateFonts(rollback);
        value.observeFontRevision(BigInt(candidate));
        assert(value.fontFamilies.has('CalendarFont'));
        assert.deepEqual((value as any).input(input).paragraph.runs[0].fontFamilies,['CalendarFont','NelyxDefault'],'New font revision was not used by paragraph policy');
        assert.deepEqual(backend.fontFamilies(1),bundledFontFamilies,'Staged previous cohort was retired too early');
        backend.finishFonts(rollback,false);value.observeFontRevision(1n);
        assert(!value.fontFamilies.has('CalendarFont'),'Rollback reused candidate names');
        assert.throws(()=>backend.fontFamilies(candidate),/foreign.*retired/,'Rolled-back cohort stayed queryable');
        const commit=backend.prepareFonts(catalog),committed=backend.activateFonts(commit);
        value.observeFontRevision(BigInt(committed));backend.finishFonts(commit,true);
        assert.throws(()=>backend.fontFamilies(1),/foreign.*retired/,'Committed previous cohort stayed queryable');
        assert.deepEqual(backend.fontFamilies(committed),backend.snapshot(committed).fontFamilies);
        const names=backend.fontFamilies(committed) as string[];names.length=0;
        assert(value.fontFamilies.has('CalendarFont'),'Backend query leaked a mutable family array');
        for(const invalid of [0,-1,1.5,Number.MAX_SAFE_INTEGER+1,NaN])assert.throws(()=>backend.fontFamilies(invalid),/foreign.*retired/);
        backend.close();assert.equal(providerClosed,1);assert.equal(catalogClosed,2);assert.equal(budget.bytes,0);
        assert.throws(()=>value.fontFamilies,/foreign.*retired/,'Service retained names after backend close');
        assert.throws(()=>backend.fontFamilies(committed),/foreign.*retired/);
        assert.equal(value.execution.closed,true,'Closed diagnostic snapshot was lost');
        value.close();assert.throws(()=>value.fontFamilies,/closed/);
        const calls=[];
        const native=nativeAppTextBackend({appTextVersion:12,appText(operation,owner,revision,payload){calls.push([operation,owner,revision,payload]);
          if(operation==='open')return 7;
          if(operation==='fontFamilies')return ['NelyxDefault'];
          throw Error('Unexpected native operation '+operation);
        }});
        assert.deepEqual(native.fontFamilies!(3),['NelyxDefault']);
        assert.deepEqual(calls,[['open',0,0,undefined],['fontFamilies',7,3,undefined]],'Native adapter changed owner/revision forwarding');
        for(const invalid of [0,-1,1.5,NaN])assert.throws(()=>native.fontFamilies!(invalid),/Invalid App font revision/);
        console.log('App font families: negotiated thin queries, legacy getter isolation, fresh results/counters, paragraph policy, staged rollback/commit/retirement, closed owner and native forwarding PASS.');
      } finally {
        for(const value of services)value.close();
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
