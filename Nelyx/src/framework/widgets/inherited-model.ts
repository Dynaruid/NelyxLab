// SPDX-License-Identifier: BSD-3-Clause
import {InheritedWidget,InheritedElement} from './framework.ts';
import type {Element,BuildContext} from './framework.ts';

export abstract class InheritedModel<A=unknown> extends InheritedWidget {
  abstract updateShouldNotifyDependent(old:this,aspects:ReadonlySet<A>):boolean;
  isSupportedAspect(_aspect:A):boolean{return true;}
  static inheritFrom<T extends InheritedModel>(context:BuildContext,type:abstract new (...args:never[])=>T,aspect?:unknown):T|undefined {
    if(aspect===undefined)return context.maybeDependOn(type);
    const models:InheritedElement[]=[];
    context.visitAncestorElements(element=>{
      if(!(element instanceof InheritedElement)||element.widget.typeToken!==type)return true;
      models.push(element);return !(element.widget as T).isSupportedAspect(aspect);
    });
    let value:T|undefined;for(const model of models)value=context.dependOnInheritedElement<T>(model,aspect);return value;
  }
  override createElement():Element{return new ModelElement(this);}
}
class ModelElement extends InheritedElement {
  override notifyDependent(old:InheritedWidget,dependent:Element):void {
    const aspects=this.dependents.get(dependent);
    if(aspects===null||(this.widget as InheritedModel).updateShouldNotifyDependent(old as InheritedModel,aspects??new Set()))dependent.dependenciesChanged();
  }
}
