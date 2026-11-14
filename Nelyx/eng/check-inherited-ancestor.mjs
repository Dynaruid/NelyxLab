// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';
import { inheritedAncestorFixture } from './inherited-ancestor-fixture.mjs';

const root = path.resolve(import.meta.dirname, '../..'),
  coreDist = path.join(root, 'Nelyx/dist'),
  require = createRequire(import.meta.url),
  watchdog = setTimeout(() => {
    throw Error('Inherited ancestor checks exceeded 20 minutes');
  }, 1_200_000);
try {
  const result = await build({
    stdin: {
      resolveDir: root,
      loader: 'ts',
      contents: `
        import assert from 'node:assert/strict';
        import {Widget,Element,BuildOwner,InheritedElement,InheritedWidget,findAncestorInheritedElement} from './Nelyx/src/framework/widgets/framework.ts';
        import {GlobalKey} from './Nelyx/src/framework/widgets/global-key.ts';
        import {MaterialThemeScope,maybeMaterialThemeScopeOf,maybeMaterialThemeDataOf} from './packages/material/src/internal/theme/theme-scope.ts';
        ${inheritedAncestorFixture()}
        class Host extends Widget {
          constructor(readonly items:Widget[]=[]){super();}
          createElement(){return new HostElement(this);}
        }
        class HostElement extends Element {
          protected build(){return (this.widget as Host).items;}
          replace(items){this.children=this.reconcile(this.children,items);this.owner.parentRebuilt(this);}
        }
        const resolved=[];
        class TestTheme extends MaterialThemeScope {
          constructor(name,child){super({name} as any,child);}
          resolveData(context){resolved.push(context);return this.data;}
          updateShouldNotify(old){return old.data!==this.data;}
          wrap(context,child){return new TestTheme(this.data.name,child);}
        }
        class DerivedTheme extends TestTheme {}
        class DynamicTheme extends TestTheme {override get typeToken(){return InheritedWidget;}}
        const reads=[],deactivations=[];
        class Reader extends Widget {
          constructor(key){super(key);}
          createElement(){return new ReaderElement(this);}
        }
        class ReaderElement extends Element {
          protected build(){reads.push(maybeMaterialThemeScopeOf(this)?.data.name);return [];}
          override deactivate(){
            if(this.active){
              const outcome=lookup=>{try{return lookup(this)?.data.name??null;}catch(error){return error.name+'/'+error.message;}};
              deactivations.push([outcome(reference),outcome(maybeMaterialThemeScopeOf)]);
            }
            super.deactivate();
          }
        }
        const key=new GlobalKey('base-theme-reader'),owner=new BuildOwner({} as any,()=>{}),left=new Host([new Reader(key)]),right=new Host(),dynamic=new Host();
        let deep:Widget=left;for(let index=0;index<32;index++)deep=new Host([deep]);
        const root=new TestTheme('outer',new Host([new DerivedTheme('near',deep),right,new DynamicTheme('dynamic',dynamic)])).createElement();
        root.mount(undefined,owner);const flush=()=>{owner.flushBuild();owner.finalizeTree();};
        const reference=context=>{let value=null;context.visitAncestorElements(e=>{if(e instanceof InheritedElement&&e.widget instanceof MaterialThemeScope){value=context.dependOnInheritedElement(e);return false;}return true;});return value;};
        try {
          flush();const leaf=key.currentElement;assert.equal(reads.at(-1),'near');
          assert.equal(maybeMaterialThemeScopeOf(leaf),reference(leaf));
          assert.equal(maybeMaterialThemeDataOf(leaf).name,'near');assert.equal(resolved.at(-1),leaf);
          const near=root.children[0].children[0],rightElement=root.children[0].children[1] as HostElement,dynamicElement=root.children[0].children[2].children[0] as HostElement;
          let leftElement=near.children[0];while(leftElement.widget!==left)leftElement=leftElement.children[0];
          near.update(new DerivedTheme('changed',(near.widget as DerivedTheme).child));flush();assert.equal(reads.at(-1),'changed');
          rightElement.replace([new Reader(key)]);leftElement.replace([]);flush();assert.equal(key.currentElement,leaf);assert.equal(reads.at(-1),'outer');
          dynamicElement.replace([new Reader(key)]);rightElement.replace([]);flush();assert.equal(key.currentElement,leaf);assert.equal(reads.at(-1),'dynamic');
          assert.equal(maybeMaterialThemeScopeOf(leaf),reference(leaf));
          const visit=Element.prototype.visitAncestorElements;let calls=0;
          Element.prototype.visitAncestorElements=function(visitor){calls++;return visit.call(this,visitor);};
          try{const before=calls;assert.equal(maybeMaterialThemeScopeOf(leaf).data.name,'dynamic');assert.equal(calls,before+1);}finally{Element.prototype.visitAncestorElements=visit;}
          const provided=near.widget,custom={visitAncestorElements(visitor){assert.equal(this,custom);visitor(near);},dependOnInheritedElement(element){assert.equal(this,custom);assert.equal(element,near);return provided;}};
          custom.visitAncestorElements.call=()=>{throw Error('Custom own call used');};assert.equal(maybeMaterialThemeScopeOf(custom),provided);
          dynamicElement.replace([]);flush();assert.equal(key.currentElement,undefined);
          dynamicElement.replace([new Reader(key)]);flush();
        } finally {root.unmount();owner.dispose();}
        assert.equal(key.currentElement,undefined);
        assert(deactivations.some(pair=>typeof pair[0]==='string'&&pair[0].includes('active ancestor')),'Inactive ancestor contract was not exercised');
        for(const pair of deactivations)assert.deepEqual(pair[0],pair[1],'Inherited lookup changed a deactivation error');
        assert.throws(()=>findAncestorInheritedElement(root,MaterialThemeScope),/active Element/);
        console.log('Inherited ancestor: current bodies, subclass/live matching, custom context/prototype traversal, dependency notification, GlobalKey activation, dynamic tokens, errors and close PASS.');
      `,
    },
    plugins: [
      {
        name: 'current-core-source',
        setup(builder) {
          builder.onResolve({ filter: /^@nelyx\/core\// }, (args) => {
            const resolved = require.resolve(args.path),
              relative = path.relative(coreDist, resolved);
            assert(!relative.startsWith('..'), 'Core fixture import escaped current dist mapping');
            return { path: path.join(root, 'Nelyx/src', relative.replace(/\.js$/, '.ts')) };
          });
        },
      },
    ],
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
  console.error(
    error.message,
    error.errors?.map((item) => item.text),
  );
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
}
