// SPDX-License-Identifier: BSD-3-Clause
import { build } from 'esbuild';
import { dependencyScopeFixture } from './dependency-scope-fixture.mjs';

const watchdog = setTimeout(() => {
  throw Error('Dependency scope checks exceeded 20 minutes');
}, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import {Widget,Element,BuildOwner,InheritedWidget} from './Nelyx/src/framework/widgets/framework.ts';
        import {GlobalKey} from './Nelyx/src/framework/widgets/global-key.ts';
        ${dependencyScopeFixture()}
        class Host extends Widget {
          constructor(readonly items:Widget[]=[]){super();}
          createElement(){return new HostElement(this);}
        }
        class HostElement extends Element {
          protected build(){return (this.widget as Host).items;}
          replace(items){this.children=this.reconcile(this.children,items);this.owner.parentRebuilt(this);}
        }
        class Data extends InheritedWidget {
          constructor(readonly tag:number,child:Widget){super(child);}
          updateShouldNotify(old){return old.tag!==this.tag;}
        }
        class Optional extends Data {}
        let liveType=Data,liveReads=0;
        class Dynamic extends Data {override get typeToken(){liveReads++;return liveType;}}
        const reads=[];
        class Reader extends Widget {
          constructor(key){super(key);}
          createElement(){return new ReaderElement(this);}
        }
        class ReaderElement extends Element {
          protected build(){reads.push([this.maybeDependOn(Data)?.tag??null,this.maybeDependOn(Optional)?.tag??null]);return [];}
        }
        const key=new GlobalKey('indexed-reader'),reader=new Reader(key),owner=new BuildOwner({} as any,()=>{});
        const left=new Host([reader]),right=new Host(),dynamic=new Host();
        const root=new Host([new Data(1,left),new Data(2,new Optional(3,right)),new Dynamic(4,dynamic)]).createElement();
        root.mount(undefined,owner);
        const flush=()=>{owner.flushBuild();owner.finalizeTree();};
        try {
          flush();assert.deepEqual(reads.at(-1),[1,null]);const original=key.currentElement;
          const leftElement=root.children[0].children[0] as HostElement,rightElement=root.children[1].children[0].children[0] as HostElement,dynamicElement=root.children[2].children[0] as HostElement;
          rightElement.replace([new Reader(key)]);leftElement.replace([]);flush();
          assert.equal(key.currentElement,original);assert.deepEqual(reads.at(-1),[2,3]);
          root.children[1].update(new Data(5,(root.children[1].widget as Data).child));flush();
          assert.deepEqual(reads.at(-1),[5,3],'provider value update was hidden by a hit');
          dynamicElement.replace([new Reader(key)]);rightElement.replace([]);flush();
          assert.equal(key.currentElement,original);assert.deepEqual(reads.at(-1),[4,null]);
          const before=liveReads;liveType=Optional;original.markNeedsBuild();flush();
          assert(liveReads>before);assert.deepEqual(reads.at(-1),[null,4],'live type token entered the stable index');
          dynamicElement.replace([]);flush();assert.equal(key.currentElement,undefined);
        } finally {root.unmount();owner.dispose();}
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
  console.log(
    'Dependency scope: nearest provider, independent bounds, shadowing, live values/tokens, GlobalKey reparent, dependency notification and close PASS.',
  );
} finally {
  clearTimeout(watchdog);
}
