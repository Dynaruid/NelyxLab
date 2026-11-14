// SPDX-License-Identifier: BSD-3-Clause
/** Shared by Node/Source and the actual pinned Windows VM/package checks. */
export function elementConstructionFixture() {
  return `
  (()=>{
    const expect=(condition,message)=>{if(!condition)throw Error(message);};
    class Leaf extends StatelessWidget {build(){return SizedBox.shrink();}}
    class Stateful extends StatefulWidget {createState(){return new StateProbe();}}
    class StateProbe extends State {marker=17;build(){return SizedBox.shrink();}}
    class Inherited extends InheritedWidget {updateShouldNotify(){return false;}}
    const leaf=new Leaf(),stateful=new Stateful(),inherited=new Inherited(leaf);
    const statelessElement=leaf.createElement(),statefulElement=stateful.createElement(),inheritedElement=inherited.createElement();
    for(const [element,widget] of [[statelessElement,leaf],[statefulElement,stateful],[inheritedElement,inherited]]){
      expect(element.widget===widget&&!element.active&&!element.mounted&&element.dirty,'Element constructor state');
      expect(element._buildQueueIndex===-1&&Array.isArray(element.children)&&element.children.length===0,'Element own defaults');
      const descriptor=Object.getOwnPropertyDescriptor(element,'widget');
      expect(descriptor.writable&&descriptor.enumerable&&descriptor.configurable,'Element Widget descriptor');
    }
    expect(stateful.createElement()!==statefulElement&&stateful.createElement().children!==statefulElement.children,'Element construction shared mutable state');
    const state=new StateProbe();expect(state.marker===17&&!state.mounted,'Derived State initialization');
    const constructors=[ComponentElement,statelessElement.constructor,StatefulElement,ProxyElement,InheritedElement,State];
    const opaque=new Proxy({}, {get(){throw Error('Constructor read a forwarded argument');},has(){throw Error('Constructor inspected a forwarded argument');},getPrototypeOf(){throw Error('Constructor inspected an argument prototype');}});
    const arities=[[],[leaf],[leaf,opaque],[undefined],[opaque,7,undefined]];
    const symbol=Symbol.iterator,iterator=Object.getOwnPropertyDescriptor(Array.prototype,symbol);
    let cases=0;
    for(const type of constructors){
      expect(type.length===0,'Implicit constructor length changed: '+type.name);
      const original=Object.getPrototypeOf(type),failure=Error('super failure');
      let received,receivedTarget,throws=false,calls=0;
      const replacement=new Proxy(original,{construct(target,args,newTarget){
        calls++;received=args;receivedTarget=newTarget;if(throws)throw failure;
        return Reflect.construct(target,args,newTarget);
      }});
      // The same VM's implicit forwarding is the oracle. It includes any
      // existing observable prototype reads in that VM's super machinery.
      class DefaultForward extends original {}
      Object.setPrototypeOf(DefaultForward,replacement);
      Object.setPrototypeOf(type,replacement);
      try{
        function Derived(){}
        Object.setPrototypeOf(Derived.prototype,type.prototype);
        let setterCalls=0;
        Object.defineProperty(Derived.prototype,'widget',{set(){setterCalls++;},configurable:true});
        Object.defineProperty(Derived.prototype,'diagnosticLifecycle',{set(){setterCalls++;},configurable:true});
        let prototypeReads=0;
        const target=new Proxy(Derived,{get(owner,key,receiver){if(key==='prototype')prototypeReads++;return Reflect.get(owner,key,receiver);}});
        for(let index=0;index<arities.length;index++){
          const args=arities[index];prototypeReads=0;
          const reference=Reflect.construct(DefaultForward,args,target),expectedReads=prototypeReads;
          calls=0;prototypeReads=0;received=undefined;
          let instance;
          Object.defineProperty(Array.prototype,symbol,{...iterator,value(){throw Error('Constructor consulted Array iterator');}});
          try{instance=Reflect.construct(type,args,target);}
          finally{Object.defineProperty(Array.prototype,symbol,iterator);}
          expect(calls===1&&receivedTarget===target&&received.length===args.length,'Super argument count/new.target');
          for(let at=0;at<args.length;at++)expect(received[at]===args[at],'Super argument identity/order');
          expect(prototypeReads===expectedReads&&Object.getPrototypeOf(instance)===Object.getPrototypeOf(reference),
            'Constructor prototype/new.target: '+type.name+'/'+index+' actual='+prototypeReads+' reference='+expectedReads);
          expect(setterCalls===0,'Field initialization called an inherited setter: '+type.name);
          if(type!==State)expect(instance.widget===args[0],'Widget argument changed');
          else expect(!instance.mounted,'State base initialization changed');
          cases++;
        }
        throws=true;let caught;
        try{Reflect.construct(type,type===State?[]:[leaf],target);}catch(error){caught=error;}
        expect(caught===failure,'Super exception identity changed');
        throws=false;const prototypeFailure=Error('prototype failure');
        const badTarget=new Proxy(Derived,{get(owner,key,receiver){if(key==='prototype')throw prototypeFailure;return Reflect.get(owner,key,receiver);}});
        caught=undefined;try{Reflect.construct(type,type===State?[]:[leaf],badTarget);}catch(error){caught=error;}
        expect(caught===prototypeFailure,'new.target prototype exception identity changed');
        const returned={};
        Object.setPrototypeOf(type,new Proxy(original,{construct(){return returned;}}));
        expect(Reflect.construct(type,type===State?[]:[leaf])===returned,'Superclass replacement result changed');
        const fields=type===State?['diagnosticLifecycle','element','configuration']:
          type===StatefulElement?['state','dependenciesPending']:type===InheritedElement?['dependents']:[];
        expect(Object.keys(returned).join(',')===fields.join(','),'Derived initialization after replacement super');
      }finally{Object.setPrototypeOf(type,original);}
    }
    if(cases!==30)throw Error('Constructor case coverage');
    const lifecycle=[];
    class Lifecycle extends StatefulWidget {createState(){lifecycle.push('create');return new LifecycleState();}}
    class LifecycleState extends State {
      initState(){lifecycle.push('init');}
      didChangeDependencies(){lifecycle.push('dependencies');}
      build(){lifecycle.push('build');return SizedBox.shrink();}
      deactivate(){lifecycle.push('deactivate');}
      dispose(){lifecycle.push('dispose');}
    }
    const owner=new BuildOwner({},()=>{}),element=new Lifecycle().createElement();
    try{
      element.mount(undefined,owner);owner.flushBuild();const mounted=element.stateObject;
      expect(mounted.mounted&&element.stateObject===mounted,'Source State identity');
      element.unmount();expect(!mounted.mounted,'State did not detach');
      expect(lifecycle.join(',')==='create,init,dependencies,build,deactivate,dispose','Source State lifecycle/order');
    }finally{element.unmount();owner.dispose();}
  })();
  `;
}
