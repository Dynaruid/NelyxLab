// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { preparationChain } from './windows-preparation-chain.mjs';
const watchdog = setTimeout(() => {
  throw Error('Source chain checks exceeded 20 minutes');
}, 1_200_000);
try {
  const target = {
    owner: '1/2/3/4',
    node: { slot: 7, generation: 8 },
    document: '10',
    metrics: '2',
    device: '3',
    font: '4',
    preparation: '9007199254740993',
    revision: '9',
    requestId: '9007199254740995',
    range: { begin: 12, end: 15, generation: '9007199254740997' },
  };
  const request = {
    id: target.requestId,
    revision: '9',
    node: target.node,
    listGeneration: target.range.generation,
    begin: 12,
    end: 15,
    observed: { from: 1, to: 2 },
  };
  const nativeRequest = {
    ...target,
    requests: [request],
    document: '10',
    preparation: target.preparation,
  };
  const viewport = {
    content: target.node,
    listGeneration: target.range.generation,
    begin: 11,
    end: 16,
    minimum: 400,
    maximum: 800,
    offset: 800,
    requested: 1000,
  };
  const nativeReady = {
    ...nativeRequest,
    document: '11',
    layoutReady: { from: 20, to: 21 },
    providerReady: { from: 22, to: 23 },
    activated: { from: 24, to: 25 },
    published: { from: 26, to: 27 },
    viewports: [viewport],
    publishedViewports: [viewport],
    terminal: 'published',
    publication: '55',
  };
  const native = { domain: 'qpc-milliseconds', through: 2, samples: [nativeRequest, nativeReady] };
  const source = {
    clockDomain: 'qpc-milliseconds',
    calls: 1,
    samples: [
      {
        sequence: 1,
        kind: 'sliver-request',
        target,
        started: 3,
        elapsedMs: 5,
        acceptedDocument: '11',
        terminal: 'published-coverage',
      },
    ],
  };
  const linked = preparationChain(native, source);
  assert.equal(linked.requestMatched, 1);
  assert.equal(linked.readyMatched, 1);
  assert.equal(linked.publishedMatched, 1);
  assert.deepEqual(linked.samples[0].requestObservedToSource, { minimumMs: 1, maximumMs: 2 });
  assert.deepEqual(linked.samples[0].sourceToReady, { minimumMs: 12, maximumMs: 13 });
  assert.deepEqual(linked.samples[0].readyToProvider, { minimumMs: 1, maximumMs: 3 });
  assert.deepEqual(linked.samples[0].providerToActivation, { minimumMs: 1, maximumMs: 3 });
  assert.deepEqual(linked.samples[0].activationToPublication, { minimumMs: 1, maximumMs: 3 });
  assert.equal(linked.samples[0].publishedViewport.offset, 800);
  assert.equal(
    linked.demandToCoverage,
    'notVerified',
    'General ready or insufficient pixels completed a demand',
  );
  for (const changed of [
    { ...native, domain: 'date-milliseconds' },
    { ...native, samples: native.samples.map((n) => ({ ...n, owner: '1/2/3/5' })) },
    { ...native, samples: native.samples.map((n) => ({ ...n, font: '5' })) },
    {
      ...native,
      samples: native.samples.map((n) => ({
        ...n,
        requests: [{ ...request, id: '9007199254740996' }],
      })),
    },
    {
      ...native,
      samples: native.samples.map((n) => ({
        ...n,
        requests: [{ ...request, node: { slot: 7, generation: 9 } }],
      })),
    },
    {
      ...native,
      samples: native.samples.map((n) => ({
        ...n,
        requests: [{ ...request, listGeneration: '9007199254740998' }],
      })),
    },
  ])
    assert.equal(preparationChain(changed, source).requestMatched, 0);
  const uncalibrated = preparationChain(native, { ...source, clockDomain: 'date-milliseconds' });
  assert.equal(uncalibrated.samples[0].sourceToReady, null);
  const lost = preparationChain(
    { ...native, overwritten: 7, overwrittenPending: 2, outOfOrder: 1 },
    source,
  );
  assert.equal(lost.nativeOverwritten, 7);
  assert.equal(lost.nativeOverwrittenPending, 2);
  assert.equal(lost.nativeOutOfOrder, 1);
  const ambiguous = preparationChain(
    {
      ...native,
      samples: [nativeRequest, nativeReady, { ...nativeReady, preparation: '9007199254740999' }],
    },
    source,
  );
  assert.equal(ambiguous.readyMatched, 0);
  assert.equal(ambiguous.missing['ambiguous-native-cohort'], 1);
  console.log(
    'Native/Source join: exact owner/cohort/request/node/list IDs, wide identities, continuation, clock and missing-chain bounds PASS.',
  );
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import {SourcePreparationJournal} from './Nelyx/runtime/app/source-preparation.ts';
      import {nativeSourceDiagnosticClock} from './Nelyx/sdk/src/runtime/source-clock.ts';
      const target={owner:'1/1/1/1',node:{slot:4,generation:2},document:'1',metrics:'3',device:'5',font:'7',revision:'11',input:'17',range:{begin:6,end:10,generation:'13'}};
      const state=(overrides={})=>({owner:{session:1,app:1,view:1,generation:1},visible:true,metrics:3n,device:5n,fontRevision:7n,publication:19n,
        observation:{cohorts:{published:{font:7n,publication:19n}}},
        publishedDocument:2n,activeDocument:2n,publishedMetrics:3n,publishedDevice:5n,consumedThrough:23n,
        nodes:[{node:{slot:4,generation:2},layoutBuilder:{revision:11n},list:{begin:6,end:10,generation:13n}}],...overrides}) as any;
      const journal=new SourcePreparationJournal();
      journal.record('observed-window','publication/range',target,10,4,'built');
      journal.record('box-request','request/2',{...target,node:{slot:9,generation:1},range:undefined},12,3,'built');
      const sequences=journal.seal(1,20);assert.deepEqual(sequences,[1,2]);
      journal.observe(state(),21);assert.equal((journal.diagnostics() as any).pending,2,'Callback built was treated as coverage ready');
      journal.accept(sequences,2n,22);
      let d:any=journal.diagnostics();assert.equal(d.pending,1);assert.equal(d.samples[0].terminal,'published-coverage');
      assert.equal(d.samples[0].capturePass,1);assert.equal(d.samples[0].consumedThrough,'23');
      assert.equal(d.samples[1].terminal,undefined,'A different node shared the coverage result');
      assert.equal(d.demandToCoverage,'notVerified');assert.equal(d.contentProviderTiming,'notVerified');
      for(const node of [
        {node:{slot:4,generation:3},layoutBuilder:{revision:11n},list:{begin:6,end:10,generation:13n}},
        {node:{slot:4,generation:2},layoutBuilder:{revision:12n},list:{begin:6,end:10,generation:13n}},
        {node:{slot:4,generation:2},layoutBuilder:{revision:11n},list:{begin:7,end:10,generation:13n}},
        {node:{slot:4,generation:2},layoutBuilder:{revision:11n},list:{begin:6,end:10,generation:14n}},
      ]){
        const j=new SourcePreparationJournal();j.record('sliver-request','request',target,0,1,'built');j.accept(j.seal(1,2),2n,3);
        j.observe(state({nodes:[node]}),4);assert.equal((j.diagnostics() as any).pending,1,'Stale or incomplete coverage completed a demand');
      }
      const failed=new SourcePreparationJournal();failed.record('box-request','request',target,1,2,'built');
      failed.reject(failed.seal(1,4),5);failed.observe(state(),6);assert.equal((failed.diagnostics() as any).samples[0].terminal,'rejected');
      const resized=new SourcePreparationJournal();resized.record('box-request','request',target,1,2,'built');
      resized.observe(state({metrics:4n}),4);assert.equal((resized.diagnostics() as any).samples[0].terminal,'cohort-changed');
      const ring=new SourcePreparationJournal();for(let i=0;i<129;++i)ring.record('observed-window','range',target,i,1,'built');
      const bounded:any=ring.diagnostics();assert.equal(bounded.samples.length,128);assert.equal(bounded.overwrittenPending,1);assert.equal(bounded.pending,128);
      ring.close(200);ring.record('box-request','closing',target,199,3,'built');
      const closed:any=ring.diagnostics();assert.equal(closed.pending,0);assert.equal(closed.terminals.closed,129);
      const foreign=new SourcePreparationJournal();foreign.record('box-request','request',target,1,2,'built');foreign.accept(foreign.seal(1,4),2n,5);
      foreign.observe(state({owner:{session:1,app:1,view:1,generation:2}}),6);
      foreign.observe(state({observation:{cohorts:{published:{font:8n,publication:19n}}}}),7);
      assert.equal((foreign.diagnostics() as any).pending,1,'Foreign owner or published font completed a chain');
      const disabled=new SourcePreparationJournal(false);disabled.record('box-request','request',target,1,2,'built');disabled.observe(state(),3);
      assert.equal(disabled.through,0);assert.deepEqual(disabled.seal(1,4),[]);assert.equal((disabled.diagnostics() as any).enabled,false);
      const retained=new SourcePreparationJournal();retained.record('retained-box','retained/1',target,1,40,'built');
      assert.deepEqual(retained.seal(4,42),[1]);retained.accept([1],2n,43);retained.observe(state(),44);
      assert.equal((retained.diagnostics() as any).byKind['retained-box'].maxMs,40);
      assert.equal((retained.diagnostics() as any).samples[0].capturePass,4);
      const clock=new SourcePreparationJournal(true,'qpc-milliseconds');
      assert.equal(clock.diagnostics().clockDomain,'qpc-milliseconds');
      assert.equal(clock.diagnostics().demandToCoverage,'notVerified','A shared clock invented a native demand/ready observation');
      let clockReads=0;const nativeNow=()=>123.5;
      assert.equal(nativeSourceDiagnosticClock({}),undefined);
      assert.equal(nativeSourceDiagnosticClock({NelyxV2Native:{get clock(){++clockReads;throw Error('Unnegotiated clock');}}}),undefined);
      assert.equal(clockReads,0);
      assert.equal(nativeSourceDiagnosticClock({NelyxV2Native:{clockDomain:'owner-performance',clock:nativeNow}}),undefined);
      assert.equal(nativeSourceDiagnosticClock({NelyxV2Native:{clockDomain:'qpc-milliseconds'}}),undefined);
      const native=nativeSourceDiagnosticClock({NelyxV2Native:{clockDomain:'qpc-milliseconds',clock:nativeNow}})!;
      assert.equal(native.domain,'qpc-milliseconds');assert.equal(native.now,nativeNow);assert.equal(native.now(),123.5);
      assert.equal(native.profileActive,undefined);
      const optional=nativeSourceDiagnosticClock({NelyxV2Native:{clockDomain:'qpc-milliseconds',clock:nativeNow,get heapProfileActive(){throw Error('Optional diagnostic is unavailable');}}})!;
      assert.equal(optional.now,nativeNow);assert.equal(optional.profileActive,undefined);
      let profiling=false;const active=()=>profiling;
      const profiled=nativeSourceDiagnosticClock({NelyxV2Native:{clockDomain:'qpc-milliseconds',clock:nativeNow,heapProfileActive:active}})!;
      assert.equal(profiled.profileActive,active);assert.equal(profiled.profileActive!(),false);
      profiling=true;assert.equal(profiled.profileActive!(),true);
      console.log('Source chains: exact pass membership, publication before ACK, node/list generation, range/revision/cohort rejection, NACK, bounded loss and close PASS.');
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
    'data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64')
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
