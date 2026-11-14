// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
const watchdog = setTimeout(() => {
  throw Error('Source Element profile check exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
      import assert from 'node:assert/strict';
      import {BuildOwner,Element,Widget,StatefulWidget,State} from './Nelyx/src/framework/widgets/framework.ts';
      import {SizedBox} from './Nelyx/src/framework/widgets/basic.ts';
      import {FlutterError} from './Nelyx/src/foundation/flutter-error.ts';
      import {SourceElementProfile} from './Nelyx/runtime/app/source-element-profile.ts';
      let events:string[]=[];
      class Many extends Widget {constructor(readonly items:Widget[]){super();}createElement(){return new ManyElement(this);}}
      class ManyElement extends Element {protected build(){return (this.widget as Many).items;}}
      class Leaf extends StatefulWidget {constructor(readonly value:number){super();}createState(){events.push('create');return new LeafState();}}
      class LeafState extends State<Leaf> {
        override initState(){events.push('init');}
        override didChangeDependencies(){events.push('dependencies');}
        override didUpdateWidget(old:Leaf){events.push('update:'+old.value+'>'+this.widget.value);}
        override build(){events.push('build:'+this.widget.value);return SizedBox.shrink();}
        override deactivate(){events.push('deactivate');}
        override dispose(){events.push('dispose');}
      }
      const sourceFailure=Error('original Source failure');
      class Broken extends Widget {createElement(){return new BrokenElement(this);}}
      class BrokenElement extends Element {protected build():Widget[]{throw sourceFailure;}}
      const originalError=FlutterError.onError;
      const run=kind=>{
        events=[];let reads=0;
        const owner=new BuildOwner({} as any,()=>{}),
          profile=new SourceElementProfile({domain:'qpc-milliseconds',now:()=>100+(++reads)/4,profileActive:()=>kind==='profile'});
        if(kind==='profile'||kind==='inactive')owner._setElementBuildObserver(profile);
        if(kind==='active-fails')owner._setElementBuildObserver({active(){throw Error('observer active');},begin(){throw Error('unexpected');},end(){throw Error('unexpected');}});
        if(kind==='begin-fails')owner._setElementBuildObserver({active:()=>true,begin(){throw Error('observer begin');},end(){throw Error('unexpected');}});
        if(kind==='end-fails')owner._setElementBuildObserver({active:()=>true,begin:()=>0,end(){throw Error('observer end');}});
        const tree=value=>new Many([...Array.from({length:12},()=>new Leaf(value)),new Broken()]);
        const root=tree(0).createElement();let keys;
        FlutterError.onError=details=>{assert.equal(details.exception,sourceFailure,'Diagnostic replaced the Source exception');events.push('handled');};
        try {
          root.mount(undefined,owner);owner.flushBuild();keys=Object.keys(root);
          const retained=root.children[0],state=retained.stateObject;
          for(const value of [1,2,3]){root.update(tree(value));owner.flushBuild();assert.equal(root.children[0],retained);assert.equal(retained.stateObject,state);}
          root.unmount();owner.dispose();
          const d=profile.diagnostics();
          if(kind==='profile'){
            assert(d.calls>100&&d.samples.length>0&&d.limited>0);
            assert(d.samples.every(s=>s.complete&&s.elapsedMs===.25));
            assert(d.types.every(t=>t.empty<=2&&t.populated<=2));
            assert.equal(reads,d.samples.length*2);
            assert(d.types.some(t=>t.name==='Leaf'&&t.empty===2&&t.populated===2));
          }else assert.equal(reads,0,'Inactive/absent diagnostics read the clock');
          return {events:events.slice(),keys};
        } finally {root.unmount();owner.dispose();FlutterError.onError=originalError;}
      };
      try{
        const reference=run('none');
        for(const kind of ['inactive','profile','active-fails','begin-fails','end-fails'])assert.deepEqual(run(kind),reference,'Source lifetime/order/state/own fields differed: '+kind);
      }finally{FlutterError.onError=originalError;}
      let reads=0;
      const profile=new SourceElementProfile({domain:'qpc-milliseconds',profileActive:()=>true,now:()=>100+(++reads)});
      for(let i=0;i<130;i++){
        const constructor=function SameName(){};
        for(const children of [[],[],[null],[null],[]]){
          const token=profile.begin({widget:{constructor},children} as any);
          if(token!==undefined)profile.end(token);
        }
      }
      const bounded=profile.diagnostics();
      assert.equal(bounded.types.length,128);assert.equal(bounded.samples.length,512);
      assert.equal(bounded.unclassified,10);assert.equal(reads,1024);
      const before=JSON.stringify(bounded);bounded.samples[0].started=0;bounded.types[0].name='changed';
      assert.notEqual(JSON.stringify(profile.diagnostics()),JSON.stringify(bounded),'Diagnostics exposed mutable records');
      assert(before.length<200000);
      const failing=new SourceElementProfile({domain:'qpc-milliseconds',profileActive:()=>true,now(){throw Error('clock failure');}});
      assert.equal(failing.begin({widget:{constructor:Leaf},children:[]} as any),undefined);
      assert.equal(failing.diagnostics().failures,1);assert.equal(failing.diagnostics().samples[0].complete,false);
      const activeFailure=new SourceElementProfile({domain:'qpc-milliseconds',now(){throw Error('Unexpected clock');},profileActive(){throw Error('Active query failure');}});
      assert.equal(activeFailure.active(),false);assert.equal(activeFailure.diagnostics().failures,1);
      console.log('Source Element profile: absent/inactive/active and failing observers preserve exact lifetime/order/State/Source errors/own fields; first-two strata, same-name constructors, 128/512 bounds, snapshots and clock failure PASS.');
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
