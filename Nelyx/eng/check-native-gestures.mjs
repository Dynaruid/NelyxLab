// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const reference = process.argv.find((value) => value.startsWith('--reference='))?.slice(12);
const watchdog = setTimeout(() => {
  throw Error('Native gesture checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: root,
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import {installOriginalGestures} from './Nelyx/runtime/app/gesture.ts';
        ${reference ? "import {installOriginalGestures as referenceInstall} from 'gesture-reference';" : ''}
        import {Element,buildNativeWidget} from '@nelyx/core/framework/widgets/framework';
        import {GestureDetector} from '@nelyx/core/framework/widgets/gesture-detector';
        import {FlutterError} from '@nelyx/core/foundation/flutter-error';
        import {TapDownDetails} from '@nelyx/core/framework/gestures/tap';
        import {DragUpdateDetails} from '@nelyx/core/framework/gestures/drag-details';
        import {LongPressDownDetails} from '@nelyx/core/framework/gestures/long-press';
        import {protocol as p} from './Nelyx/runtime/engine-client/schema.ts';
        class Context extends Element {
          live=true;
          constructor(widget,owner){super(widget);this.owner=owner;}
          get mounted(){return this.live;}
          maybeDependOn(){return undefined;}
          build(){return [];}
        }
        const common=['onTap','onTapDown','onTapUp','onTapMove','onTapCancel','onDoubleTap',
          'onLongPress','onLongPressDown','onLongPressStart','onLongPressMoveUpdate','onLongPressEnd','onLongPressUp','onLongPressCancel'];
        const pan=['onPanDown','onPanStart','onPanUpdate','onPanEnd','onPanCancel','onDrag','onDragEnd'];
        const axes=['onHorizontalDragDown','onHorizontalDragStart','onHorizontalDragUpdate','onHorizontalDragEnd','onHorizontalDragCancel',
          'onVerticalDragDown','onVerticalDragStart','onVerticalDragUpdate','onVerticalDragEnd','onVerticalDragCancel'];
        const data={pointerKind:'mouse',stream:7,timestamp:2,localX:12,localY:14,deltaX:-6,deltaY:8,
          velocityX:-90,velocityY:120,originX:97,originY:193,localOriginX:9,localOriginY:7,buttons:1,
          flags:p.gestureDetailFlags.valid};
        const event=(kind,flags=data.flags)=>({kind,sequence:1n,x:100,y:200,value:0,details:{...data,flags,
          deltaX:flags&p.gestureDetailFlags.vertical?0:data.deltaX,deltaY:flags&p.gestureDetailFlags.horizontal?0:data.deltaY,
          velocityX:flags&p.gestureDetailFlags.vertical?0:data.velocityX,velocityY:flags&p.gestureDetailFlags.horizontal?0:data.velocityY}});
        function exercise(install){
          const rows=[],reads=[],reports=[],wire=[],carriers=[];
          const oldError=FlutterError.onError;
          const failure=Error('callback failure');
          FlutterError.onError=details=>{assert.equal(details.exception,failure);reports.push(details.library);};
          function make(names,extra={}){
            const target=Object.fromEntries(names.map(name=>[name,function(...args){assert.equal(this,undefined);rows.push({name,args});}]));
            Object.assign(target,extra);
            const options=new Proxy(target,{get(o,key,receiver){reads.push(String(key));return Reflect.get(o,key,receiver);}});
            const widget=new GestureDetector(null,options),owner={},context=new Context(widget,owner);
            function fail(reason){assert.equal(this,undefined);throw Error(reason);}
            install(owner,fail);
            const node=buildNativeWidget(context,'gesture-detector',widget),carrier=node.options;
            assert.equal(carrier.onGesture.length,1);assert.equal(carrier.onAction.length,2);
            assert.throws(()=>Reflect.construct(carrier.onGesture,[]),TypeError);
            assert.throws(()=>Reflect.construct(carrier.onAction,[]),TypeError);
            wire.push(JSON.parse(JSON.stringify(carrier)));
            carriers.push(carrier);
            return {target,context,carrier};
          }
          try{
            const first=make([...common,...pan]);
            for(const kind of ['tapDown','tapUp','tap','tapCancel','tapMove','doubleTap','longPressDown','longPress','longPressMove','longPressEnd','longPressCancel',
              'dragDown','panStart','panUpdate','panEnd','dragCancel'])first.carrier.onGesture(event(kind));
            assert.equal(rows[0].name,'onTapDown');assert(rows[0].args[0] instanceof TapDownDetails);
            assert.equal(rows[0].args[0].globalPosition.x,100);assert.equal(rows[0].args[0].localPosition.y,14);
            const update=rows.find(row=>row.name==='onPanUpdate').args[0];assert(update instanceof DragUpdateDetails);
            assert.equal(update.delta.x,-6);assert.equal(update.primaryDelta,null);
            const semantic={x:100,y:200,gesture:{...data,flags:p.gestureDetailFlags.valid|p.gestureDetailFlags.semantic}};
            const at=rows.length;first.carrier.onAction('activate',semantic);first.carrier.onAction('longPress',semantic);
            assert.deepEqual(rows.slice(at).map(row=>row.name),['onTapDown','onTapUp','onTap','onLongPressDown','onLongPressStart','onLongPress','onLongPressEnd','onLongPressUp']);
            assert(rows[at+3].args[0] instanceof LongPressDownDetails);assert.equal(rows[at+3].args[0].kind,null);
            first.target.onTap=()=>rows.push({name:'replacement',args:[]});first.carrier.onGesture(event('tap'));assert.equal(rows.at(-1).name,'replacement');
            first.target.onTap=()=>{throw failure;};first.carrier.onGesture(event('tap'));assert.deepEqual(reports,['gesture']);
            assert.throws(()=>first.carrier.onAction('activate'),/native-semantic-gesture-details/);
            assert.throws(()=>first.carrier.onGesture({kind:'tapDown',sequence:1n,x:1,y:2}),/native-gesture-details/);
            first.context.live=false;const before=rows.length,readBefore=reads.length;first.carrier.onGesture(event('tap'));
            assert.equal(rows.length,before);assert.equal(reads.length,readBefore,'Closed context still read a user callback');
            const directional=make(axes);
            for(const flags of [p.gestureDetailFlags.horizontal,p.gestureDetailFlags.vertical,0])
              for(const kind of ['dragDown','panStart','panUpdate','panEnd','dragCancel'])directional.carrier.onGesture(event(kind,flags));
            assert.deepEqual(rows.slice(-2).map(row=>row.name),['onHorizontalDragCancel','onVerticalDragCancel']);
            const disabled=make(['onTap'],{enabled:false,excludeFromSemantics:true});
            assert.equal(disabled.carrier.gestures,0);assert.equal(disabled.carrier.semantics,undefined);
            const disabledBefore=rows.length;disabled.carrier.onAction('activate',semantic);assert.equal(rows.length,disabledBefore);
            assert.notEqual(first.carrier.onGesture,directional.carrier.onGesture);
            const observed=[];const watched=new Proxy(event('tapDown'),{has(o,k){observed.push('has:'+String(k));return Reflect.has(o,k);},get(o,k,r){observed.push('get:'+String(k));return Reflect.get(o,k,r);}});
            directional.carrier.onGesture(watched);
            assert.deepEqual(observed,['get:kind','has:sequence','get:details','get:x','get:y','has:sequence','get:details']);
            return JSON.parse(JSON.stringify({wire,rows,reads,reports,observed}));
          }finally{FlutterError.onError=oldError;}
        }
        const actual=exercise(installOriginalGestures);
        ${reference ? "assert.deepEqual(actual,exercise(referenceInstall),'Shared dispatch differs from original adapter');" : ''}
        console.log('Native gestures: callback order/receiver, exact details, live replacement, errors, semantic action, directional cancellation, getters and close PASS.');
        ${reference ? "console.log('Original adapter comparison: wire, callback details, getter sequence and errors PASS.');" : ''}
      `,
    },
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    target: 'node24',
    alias: { '@nelyx/core': path.join(root, 'Nelyx/src') },
    logLevel: 'silent',
    plugins: reference
      ? [
          {
            name: 'original-gesture-reference',
            setup(plugin) {
              plugin.onResolve({ filter: /^gesture-reference$/ }, () => ({
                path: 'original',
                namespace: 'gesture-reference',
              }));
              plugin.onLoad({ filter: /.*/, namespace: 'gesture-reference' }, () => ({
                contents: fs.readFileSync(reference, 'utf8'),
                loader: 'ts',
                resolveDir: path.join(root, 'Nelyx/runtime/app'),
              }));
            },
          },
        ]
      : [],
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
