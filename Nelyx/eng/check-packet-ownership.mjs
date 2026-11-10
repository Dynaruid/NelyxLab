// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Packet ownership checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import { pathToFileURL } from 'node:url';
      import path from 'node:path';
      import { EngineClient } from './Nelyx/runtime/engine-client/client.ts';
      import { createWasmTransport } from './Nelyx/runtime/engine-client/wasm.ts';
      import { createPacketTransport } from './Nelyx/runtime/engine-client/message-port.ts';
      import { packet, response, appObservationBody, protocol as p } from './Nelyx/runtime/engine-client/codec.ts';
      const factory=(await import(pathToFileURL(path.resolve('Nelyx/engine/dist/single-worker/engine.mjs')).href)).default;
      const backend=createWasmTransport(await factory());
      let receive, held=false, replies=[], stopped=false;
      const endpoint={post(value,transfer){
        const message=structuredClone(value,{transfer});
        void backend.exchange(new Uint8Array(message.bytes)).then(bytes=>{
          const reply=structuredClone({kind:'packet-result',id:message.id,bytes:bytes.buffer},{transfer:[bytes.buffer]});
          if(held)replies.push(reply);else receive(reply);
        });
      },subscribe(callback){receive=callback;return()=>{};},close(){stopped=true;backend.close();}};
      const port=createPacketTransport(endpoint,40);
      const client=await EngineClient.connect(port);
      try {
        const view=await client.openView(1);
        // Both request metadata and App-observation flags must survive a real
        // structured-clone transfer, which immediately detaches the command.
        const layout=await view.request(p.opcodes.layoutSnapshot,appObservationBody());
        assert.equal(layout.status,p.statuses.notFound);
        const borrowed=packet(p.opcodes.inspect,view.owner), original=borrowed.slice();
        const result=client.send(borrowed);borrowed.fill(0);
        assert.equal((await result).status,p.statuses.ok,'Caller mutation reached an async transport');
        assert.equal(borrowed.byteLength,original.byteLength,'Borrowed caller buffer was detached');
        const direct=packet(p.opcodes.inspect,view.owner);
        const directResult=port.exchangeOwned(direct);
        assert.equal(direct.byteLength,0,'Owned packet was copied instead of transferred');
        assert.equal(response(await directResult).status,p.statuses.ok);
        assert.equal(port.diagnostics().copiedBytes,0,'Client/port duplicated the ownership copy');
        const borrowedPort=packet(p.opcodes.inspect,view.owner);
        await port.exchange(borrowedPort);
        assert(borrowedPort.byteLength>0,'Borrowed port input was consumed');
        assert.equal(port.diagnostics().copiedBytes,borrowedPort.byteLength);
        const backing=new Uint8Array(16+original.length);backing.set(original,16);
        await port.exchangeOwned(backing.subarray(16));
        assert(backing.byteLength>0,'A subarray detached unrelated caller storage');
        held=true;
        const late=packet(p.opcodes.inspect,view.owner), length=late.length;
        await assert.rejects(port.exchangeOwned(late),/timed out/);
        assert.equal(port.diagnostics().pendingBytes,length,'Timeout returned credit before the terminal reply');
        assert.equal(port.diagnostics().retiredBytes,length);
        held=false;
        const reply=replies.shift();receive(reply);receive(reply);
        assert.equal(port.diagnostics().pendingBytes,0,'Late/double reply corrupted pending credit');
        held=true;
        const saturated=Array.from({length:4},()=>port.exchangeOwned(new Uint8Array(p.limits.packetBytes))
          .then(()=>false,()=>true));
        await assert.rejects(port.exchangeOwned(new Uint8Array(1)),/budget/);
        assert((await Promise.all(saturated)).every(Boolean));
        assert.equal(port.diagnostics().retiredBytes,4*p.limits.packetBytes,'Timed-out work escaped the byte ceiling');
        held=false;for(const reply of replies.splice(0))receive(reply);
        assert.equal(port.diagnostics().pendingBytes,0);
        await view.close();await client.close();
        assert(backend.diagnostics().inputCopyBytes>0);assert(backend.diagnostics().outputCopyBytes>0,'Wasm lifetime copies were not accounted');
        assert(stopped);
        await assert.rejects(port.exchange(new Uint8Array()),/closed/);
        console.log('Packet ownership: detach, borrowed mutation, request metadata, subarray, timeout, late/double reply and close PASS.');
      } finally { await client.abort(); }
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
} finally {
  clearTimeout(watchdog);
}
