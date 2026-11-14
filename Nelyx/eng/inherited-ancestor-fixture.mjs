// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/** Current lookup bodies in a small ancestry harness, also run by pinned HBC/native. */
export function inheritedAncestorFixture() {
  const file = path.resolve(import.meta.dirname, '../src/framework/widgets/framework.ts'),
    source = fs.readFileSync(file, 'utf8'),
    tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
    element = tree.statements.find(
      (node) => ts.isClassDeclaration(node) && node.name?.text === 'Element',
    ),
    methods = ['visitAncestorElements', '_findAncestorInheritedElement'].map((name) => {
      const member = element?.members.find(
        (node) => ts.isMethodDeclaration(node) && node.name?.getText(tree) === name,
      );
      if (!member) throw Error('Inherited lookup method missing: ' + name);
      return member.getText(tree);
    }),
    names = new Set([
      'elementAncestorVisit',
      'elementInheritedLookup',
      'findAncestorInheritedElement',
    ]),
    declarations = tree.statements.filter((node) => {
      if (ts.isFunctionDeclaration(node)) return node.name && names.delete(node.name.text);
      return (
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (entry) => ts.isIdentifier(entry.name) && names.delete(entry.name.text),
        )
      );
    });
  if (names.size) throw Error('Inherited lookup declarations missing: ' + [...names].join(','));
  return `
    const inheritedAncestorResult=(()=>{
      let checks=0;const check=(condition,label)=>{checks++;if(!condition)throw Error('Inherited ancestor: '+label);};
      const invariant=(condition,code,message)=>{if(!condition){const error=new Error(message);error.code=code;throw error;}};
      class Element {
        active=true;lifecycle='active';dynamicInheritedTypes=false;inheritedIndex;parent;widget;
        constructor(parent,widget={}){this.parent=parent;this.widget=widget;this.inheritedIndex=parent?.inheritedIndex;this.dynamicInheritedTypes=parent?.dynamicInheritedTypes??false;}
        ${methods.join('\n')}
      }
      class InheritedElement extends Element {
        constructor(parent,widget,dynamic=false){super(parent,widget);this.dynamicInheritedTypes=dynamic||this.dynamicInheritedTypes;this.inheritedIndex=this.dynamicInheritedTypes?undefined:{value:this};}
      }
      ${declarations.map((node) => node.getText(tree).replace(/^export\s+/, '')).join('\n')}
      const reference=(context,type)=>{let found;context.visitAncestorElements(element=>{if(element instanceof InheritedElement&&element.widget instanceof type){found=element;return false;}return true;});return found;};
      class Base {} class Derived extends Base {} class Other {}
      const root=new InheritedElement(undefined,new Base()),middle=new InheritedElement(root,new Other()),inner=new InheritedElement(middle,new Derived());
      let leaf=inner;for(let index=0;index<64;index++)leaf=new Element(leaf);
      const same=(context,type)=>{check(findAncestorInheritedElement(context,type)===reference(context,type),'nearest/missing provider');};
      same(leaf,Base);same(leaf,Derived);same(leaf,Other);same(root,Base);
      const originalPrototype=Object.getPrototypeOf(Derived.prototype);
      Object.setPrototypeOf(Derived.prototype,Other.prototype);
      try{same(leaf,Base);check(findAncestorInheritedElement(leaf,Base)===root,'cached subtype result');}finally{Object.setPrototypeOf(Derived.prototype,originalPrototype);}
      const dynamic=new InheritedElement(leaf,new Other(),true),dynamicLeaf=new Element(dynamic);
      same(dynamicLeaf,Base);same(dynamicLeaf,Other);
      const retiring=new InheritedElement(undefined,new Base()),retiringChild=new Element(retiring);
      retiring.lifecycle='inactive';retiring.inheritedIndex=undefined;same(retiringChild,Base);
      const events=[];let current=inner.widget;
      Object.defineProperty(inner,'widget',{configurable:true,get(){events.push('widget');return current;}});
      findAncestorInheritedElement(leaf,Base);const before=events.splice(0);reference(leaf,Base);
      check(JSON.stringify(events)===JSON.stringify(before),'live widget reads changed');events.length=0;
      current=new Other();same(leaf,Base);current=new Derived();
      let receiver=false,visits=0;const custom={visitAncestorElements(visitor){receiver=this===custom;visits++;visitor(inner);}};
      custom.visitAncestorElements.call=()=>{throw Error('Own call must not be used');};
      check(findAncestorInheritedElement(custom,Base)===inner&&receiver&&visits===1,'custom context traversal/receiver');
      const originalVisit=Element.prototype.visitAncestorElements;
      Element.prototype.visitAncestorElements=function(visitor){visits++;return originalVisit.call(this,visitor);};
      try{const count=visits;check(findAncestorInheritedElement(leaf,Base)===inner&&visits===count+1,'prototype traversal override skipped');}finally{Element.prototype.visitAncestorElements=originalVisit;}
      const sentinel={getterFailure:true};Object.defineProperty(inner,'widget',{configurable:true,get(){throw sentinel;}});
      for(const lookup of [reference,findAncestorInheritedElement]){let caught;try{lookup(leaf,Base);}catch(error){caught=error;}check(caught===sentinel,'getter exception identity');}
      Object.defineProperty(inner,'widget',{configurable:true,value:new Other(),writable:true});
      const alternate=new InheritedElement(undefined,new Derived());
      const move=()=>Object.defineProperty(inner,'widget',{configurable:true,get(){inner.parent=alternate;return new Other();}});
      inner.parent=middle;move();check(reference(leaf,Base)===alternate,'reference reparent fixture');
      inner.parent=middle;move();check(findAncestorInheritedElement(leaf,Base)===alternate,'retained an old parent cursor after matching');
      leaf.active=false;
      const outcome=lookup=>{try{lookup(leaf,Base);}catch(error){return error.code+'/'+error.message;}return 'no-error';};
      check(outcome(reference)===outcome(findAncestorInheritedElement),'inactive context contract');
      return {wrappers:64,checks,subtypeResultsCached:false};
    })();
  `;
}
