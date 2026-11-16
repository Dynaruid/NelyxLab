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
