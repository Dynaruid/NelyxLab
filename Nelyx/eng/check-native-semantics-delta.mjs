import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Native semantics checks exceeded 20 minutes');
}, 1_200_000);
try {
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
import assert from 'node:assert/strict';
import {connectNativeInteraction} from './Nelyx/sdk/src/backends/native-hermes/interaction.ts';
import {NativeInteraction} from './Nelyx/sdk/src/runtime/native-interaction.ts';
let callback,commit=1,metrics={viewportGeneration:1,nativeSurfaceGeneration:1};
const node=id=>({id,sourceNodeId:1,role:'button',name:id,bounds:{x:0,y:0,width:20,height:20},enabled:true});
const interaction={owner:{id:'native-hermes:root',generation:1},semanticNodes:[node('a')],snapshot:()=>commit,subscribe(value){callback=value;return()=>{callback=undefined;};}};
const updates=[],bridge={publishSemantics(update){updates.push(update);}};
const connection=connectNativeInteraction(interaction as any,bridge as any,()=>metrics as any);
const update=async()=>{++commit;callback();await Promise.resolve();return updates.at(-1);};
try{
  assert.equal(updates[0].reset,true);assert.deepEqual(updates[0].removed,[]);assert.deepEqual(updates[0].order,['a']);
  // UI has already resized. This old-viewport packet is deliberately never
  // applied by the receiver, exactly as the native generation guard requires.
  interaction.semanticNodes=[node('b')];const dropped=await update();assert.equal(dropped.viewport,1);assert.equal(dropped.reset,false);
  metrics={viewportGeneration:2,nativeSurfaceGeneration:1};interaction.semanticNodes=[node('c')];const replacement=await update();
  assert.equal(replacement.reset,true);assert.deepEqual(replacement.removed,[]);assert.deepEqual(replacement.upserts.map(value=>value.packet.id),['c']);
  assert.deepEqual(replacement.order,['c'],'Replacement depended on the discarded b snapshot');
  interaction.semanticNodes=[node('d')];const delta=await update();assert.equal(delta.reset,false);assert.deepEqual(delta.removed,['c']);assert.deepEqual(delta.upserts.map(value=>value.packet.id),['d']);
  metrics={viewportGeneration:2,nativeSurfaceGeneration:2};const backing=await update();assert.equal(backing.reset,true);assert.deepEqual(backing.upserts.map(value=>value.packet.id),['d'],'Surface-only reset omitted unchanged node identities');
  const unchanged=await update();assert.equal(unchanged.reset,false);assert.deepEqual(unchanged.upserts,[]);assert.deepEqual(unchanged.removed,[]);
}finally{connection.dispose();}
assert.equal(updates.at(-1).reset,true);assert.deepEqual(updates.at(-1).order,[]);assert.deepEqual(updates.at(-1).removed,[]);assert.equal(callback,undefined);
// Fresh immutable objects for every row, including unmodified relatives.
const runtime = new NativeInteraction(interaction.owner, {semantics:'native-controls'});
let invoked = 0;
const button = (source, effect) => ({...node('action'), sourceNodeId:source, activate:()=>{invoked=effect;}});
const label = x => ({...node('label'),role:'text',sourceNodeId:2,bounds:{...node('').bounds,x}});
const binding = runtime.semantics.bind([button(1,1),label(0)]);
const live = connectNativeInteraction(runtime,bridge as any,()=>metrics as any);
const set = async nodes => {binding.update(nodes);await Promise.resolve();return updates.at(-1);};
const act = (commit,source=1) => live.event('semantics',{protocol:1,id:'action',source,commit,kind:'activate'});
const ids = delta => delta.upserts.map(record => record.packet.id);
try {
  const moved = await set([button(1,2), label(10)]);
  assert.deepEqual(ids(moved), ['label']);
  assert.equal(act(moved.commit),true); assert.equal(invoked,2);
  const order = await set([label(10), button(1,3)]);
  assert.deepEqual(ids(order), []); assert.deepEqual(order.order,['label','action']);
  assert.equal(act(moved.commit),true); assert.equal(invoked,3);
  const nested = await set([{...label(10),children:[button(1,4)]}]);
  assert.deepEqual(ids(nested),['action']); assert.equal(nested.upserts[0].parent,0);
  const removed = await set([label(10)]); assert.deepEqual(removed.removed,['action']);
  await set([label(10),button(1,5)]); assert.equal(act(nested.commit),false);
  const replaced = await set([label(10),button(3,6)]);
  assert.deepEqual(ids(replaced),['action']); assert.equal(act(replaced.commit,3),true);
  const field = generation => ({...node('edit'),role:'text-field',sourceNodeId:4,
    textInputRevision:1,textRevision:1,textInputGeneration:generation,value:'漢😀'});
  await set([field(1),label(10)]);
  assert.deepEqual(ids(await set([field(1),label(20)])),['label']);
  assert.deepEqual(ids(await set([field(2),label(20)])),['edit']);
  assert.deepEqual(ids(await set([{...field(2),obscured:true},label(20)])),['edit']);
  assert.equal(updates.at(-1).upserts[0].packet.text.value,'');
  const reference={...button(3,7),name:'stable'};
  await set([reference]);
  for (const change of [{name:'other'},{checked:false},{selected:false},{isLink:true},
      {semanticsIdentifier:'named'},{value:'value'},{tooltip:'hint'},{enabled:false},
      {focused:true},{focusable:true,actions:{focus(){}}},{isSlider:true},
      {numericRange:{min:0,max:2,value:1}},{activate:undefined},
      {bounds:{...reference.bounds,height:8}}]) {
    assert.deepEqual(ids(await set([{...reference,...change}])),['action'],Object.keys(change).join(','));
    await set([reference]);
  }
} finally { live.dispose(); binding.dispose(); runtime.dispose(); }
console.log('NATIVE_SEMANTICS_DELTA PASS: discarded viewport update, complete replacement, unchanged nodes, surface generation, incremental removal, close');
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
} finally {
  clearTimeout(watchdog);
}
