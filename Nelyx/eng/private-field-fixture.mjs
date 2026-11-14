// SPDX-License-Identifier: BSD-3-Clause
/** Shared language oracle for Node, pinned debug/optimized HBC and SH units. */
export function privateFieldFixture() {
  return `
  (function(){
    const check=(condition,message)=>{if(!condition)throw Error('Private members: '+message);};
    let errors=0;
    const denied=operation=>{let error;try{operation();}catch(value){error=value;}check(error instanceof TypeError,'expected brand/write TypeError');++errors;};
    class FieldOnly {
      #value=11;
      #missing;
      #callback=()=>this.#value;
      visible='field-only';
      read(){return this.#value;}
      update(value){this.#value=value;return this.#callback();}
      *items(){yield this.#value;yield this.#missing;}
      async later(){await 0;return this.#value;}
      static has(value){return #value in value;}
    }
    const fieldOnly=new FieldOnly();
    check(fieldOnly.read()===11&&Reflect.ownKeys(fieldOnly).join(',')==='visible','native field data/reflection');
    Object.freeze(fieldOnly);check(fieldOnly.update(13)===13&&[...fieldOnly.items()][0]===13,'native private mutation after freeze/generator');
    const fieldProxy=new Proxy(fieldOnly,{get(){throw Error('Private field used a Proxy get trap');}});
    check(!FieldOnly.has(fieldProxy)&&FieldOnly.has(fieldOnly),'native private field brand');
    denied(()=>FieldOnly.prototype.read.call(fieldProxy));
    class PrivateValue {
      #value=17;
      #missing;
      #read(value){return this.#value+value;}
      get #twice(){return this.#value*2;}
      set #twice(value){this.#value=value/2;}
      get #getterOnly(){return this.#value;}
      set #setterOnly(value){this.#value=value;}
      *#items(){yield this.#value;yield this.#missing;}
      async #later(value){await 0;return this.#read(value);}
      constructor(){this.label='visible';}
      read(){return this.#value;}
      missing(){return this.#missing;}
      method(value){return this.#read(value);}
      extracted(){return this.#read;}
      twice(){return this.#twice;}
      setTwice(value){this.#twice=value;}
      update(){const before=this.#value++;this.#value+=3;return before;}
      overwrite(){this.#read=()=>0;}
      writeGetter(){this.#getterOnly=0;}
      readSetter(){return this.#setterOnly;}
      items(){return this.#items();}
      later(value){return this.#later(value);}
      static has(value){return #value in value;}
    }
    const value=new PrivateValue();
    check(value.read()===17&&value.missing()===undefined&&value.method(2)===19,'initial data/method receiver');
    check(Reflect.ownKeys(value).join(',')==='label'&&Object.getOwnPropertyNames(value).join(',')==='label','private members leaked to reflection');
    value.setTwice(40);check(value.twice()===40&&value.update()===20&&value.read()===24,'private accessors/update expressions');
    check([...value.items()].length===2&&[...value.items()][0]===24,'private generator');
    Object.freeze(value);value.setTwice(60);check(value.read()===30&&Object.isFrozen(value),'freeze must not freeze private data');
    denied(()=>value.overwrite());denied(()=>value.writeGetter());denied(()=>value.readSetter());
    for(const receiver of [{},Object.create(value),null,7])denied(()=>PrivateValue.prototype.read.call(receiver));
    for(const receiver of [null,undefined,7,'x',false])denied(()=>PrivateValue.has(receiver));
    const traps=[];
    const proxy=new Proxy(value,{get(...args){traps.push('get');return Reflect.get(...args);},getOwnPropertyDescriptor(...args){traps.push('descriptor');return Reflect.getOwnPropertyDescriptor(...args);},defineProperty(...args){traps.push('define');return Reflect.defineProperty(...args);}});
    check(!PrivateValue.has(proxy)&&PrivateValue.has(value),'Proxy forwarded a private brand');
    denied(()=>PrivateValue.prototype.read.call(proxy));
    denied(()=>value.extracted().call(proxy,1));
    check(traps.length===0,'private lookup consulted Proxy traps');
    class ParentPrivate {#same=2;parent(){return this.#same;}}
    class ChildPrivate extends ParentPrivate {#same=3;child(){return this.#same;}}
    const child=new ChildPrivate();check(child.parent()===2&&child.child()===3,'same spelling across inheritance');
    const factory=()=>class {#value=5;read(other){return other.#value;}static has(other){return #value in other;}};
    const A=factory(),B=factory(),a=new A(),b=new B();check(a.read(a)===5&&A.has(a)&&!A.has(b)&&B.has(b),'class factory brand isolation');denied(()=>a.read(b));
    const order=[];
    class OrderedBase {#base=(order.push('base-field'),1);visible=(order.push('base-public'),2);constructor(){order.push('base-body');}}
    class OrderedChild extends OrderedBase {#early=(order.push('early'),3);middle=(order.push('middle'),this.#early);#late=(order.push('late'),4);constructor(){super();order.push('child-body');}read(){return this.#early+this.#late;}}
    const ordered=new OrderedChild();check(ordered.read()===7&&ordered.middle===3&&order.join(',')==='base-field,base-public,base-body,early,middle,late,child-body','mixed initialization/method brand order');
    class MethodOrder {#early=this.#method();#method(){return 3;}read(){return this.#early;}}
    check(new MethodOrder().read()===3,'lowered method brand installed before fields');
    class ReadTooEarly {#early=this.#late;#late=1;}
    denied(()=>new ReadTooEarly());
    const failure={},failed=[];
    class Fails {#first=failed.push(1);#second=(()=>{throw failure;})();#last=failed.push(3);}
    let caught;try{new Fails();}catch(error){caught=error;}check(caught===failure&&failed.join(',')==='1','initializer exception/order');
    class ReturnsObject {constructor(target){return target;}}
    class Stamp extends ReturnsObject {#token=37;static read(target){return target.#token;}static has(target){return #token in target;}}
    const frozen=Object.freeze({visible:1});check(new Stamp(frozen)===frozen&&Stamp.has(frozen)&&Stamp.read(frozen)===37,'stamping nonextensible return object');denied(()=>new Stamp(frozen));
    const stampTraps=[],target={},stampProxy=new Proxy(target,{defineProperty(...args){stampTraps.push('define');return Reflect.defineProperty(...args);},getOwnPropertyDescriptor(...args){stampTraps.push('descriptor');return Reflect.getOwnPropertyDescriptor(...args);}});
    check(new Stamp(stampProxy)===stampProxy&&Stamp.has(stampProxy)&&!Stamp.has(target)&&Stamp.read(stampProxy)===37&&stampTraps.length===0,'stamping Proxy identity/trap isolation');
    function Alternate(){}
    const alternate=Reflect.construct(PrivateValue,[],Alternate);check(Object.getPrototypeOf(alternate)===Alternate.prototype&&PrivateValue.has(alternate)&&PrivateValue.prototype.read.call(alternate)===17,'custom new.target private storage');
    const staticOrder=[];
    const staticKey=name=>{staticOrder.push('key:'+name);return name;};
    class StaticBase {static inherited=11;static get receiver(){return this;}}
    class StaticValues extends StaticBase {
      #value=17;
      static [staticKey('first')]=(staticOrder.push('first'),new this());
      [staticKey('instance')]=(staticOrder.push('instance'),this.#value);
      static [staticKey('second')]=(staticOrder.push('second'),super.inherited+this.first.read());
      static missing;
      static target=new.target;
      static received=super.receiver;
      static name='StaticValuesName';
      read(){return this.#value;}
    }
    check(staticOrder.join(',')==='key:first,key:instance,key:second,first,instance,second','static key/initializer/private construction order');
    check(StaticValues.first.read()===17&&StaticValues.first.instance===17&&StaticValues.second===28&&Object.hasOwn(StaticValues,'missing')&&StaticValues.missing===undefined,'static field values/undefined own property');
    check(StaticValues.target===undefined&&StaticValues.received===StaticValues&&StaticValues.name==='StaticValuesName','static new.target/super receiver/name');
    if(globalThis.nativeFields){
      function TargetFactory(){class TargetFields {static target=new.target;}return TargetFields;}
      check(new TargetFactory().target===undefined,'static initializer inherited an outer constructor new.target');
      class StaticNames {static callback=()=>1;static ['named']=function(){};}
      check(StaticNames.callback.name==='callback'&&StaticNames.named.name==='named','native static anonymous field function names');
    }
    const staticDescriptor=Object.getOwnPropertyDescriptor(StaticValues,'second');
    check(staticDescriptor.writable&&staticDescriptor.enumerable&&staticDescriptor.configurable,'static data descriptor');
    let staticSetters=0;
    class StaticSetter {static set guarded(value){staticSetters++;}}
    class DefinesStatic extends StaticSetter {static guarded=23;}
    check(DefinesStatic.guarded===23&&staticSetters===0&&Object.hasOwn(DefinesStatic,'guarded'),'static field consulted inherited setter');
    class DuplicateStatic {static same=31;static same(){return 0;}}
    check(DuplicateStatic.same===31,'static field/method declaration order');
    let partial;const staticFailure={},staticEffects=[];
    try{class FailingStatic {static first=(partial=this,staticEffects.push(1));static second=(()=>{throw staticFailure;})();static last=staticEffects.push(3);}}catch(error){caught=error;}
    check(caught===staticFailure&&staticEffects.join(',')==='1'&&Object.hasOwn(partial,'first')&&!Object.hasOwn(partial,'second')&&!Object.hasOwn(partial,'last'),'static initialization exception/order');
    class MixedStatic {static #shared=43;#own=47;static read(other){return MixedStatic.#shared+other.#own;}static has(other){return #shared in other;}value(){return this.#own;}}
    check(MixedStatic.read(new MixedStatic())===90&&MixedStatic.has(MixedStatic)&&!MixedStatic.has(new MixedStatic()),'lowered static/native instance interaction');
    globalThis.privateFieldResult={errors,ordered:order.join(','),value:value.read(),stamp:Stamp.read(frozen),staticOrder:staticOrder.join(','),staticValue:StaticValues.second};
    globalThis.privateFieldPending=Promise.all([value.later(7),fieldOnly.later()]).then(result=>{check(result[0]===37&&result[1]===13,'private async closure/receiver');return result[0];});
  })();`;
}

/** Real Core values used by the original date Source and native projection. */
export function privateCoreFixture() {
  return `
  (()=>{
    const check=(condition,message)=>{if(!condition)throw Error('Core private fields: '+message);};
    let cases=0;
    for(const left of [-0,0,1,8]){
      const rect=new PrivateCoreRect(left,1,left+4,9);
      check(Object.is(rect.left,left)&&rect.top===1&&rect.right===left+4&&rect.bottom===9&&rect.width===4&&rect.height===8,'Rect numeric fields');
      const shifted=rect.shift(new PrivateCoreOffset(3,4));
      check(shifted.left===left+3&&shifted.top===5&&shifted.width===4&&shifted.height===8,'Rect/Offset operations');
      check(Reflect.ownKeys(rect).length===0,'Rect private representation leaked');
      Object.freeze(rect);check(Object.is(rect.left,left),'frozen Rect getter');
      const insets=new PrivateCoreInsets(left,2,3,4),resolved=new PrivateCoreDirectionalInsets(1,2,7,4).resolve('rtl');
      check(Object.is(insets.left,left)&&insets.top===2&&insets.right===3&&insets.bottom===4&&resolved.left===7&&resolved.right===1,'Insets resolution');
      const alignment=new PrivateCoreAlignment(.25,-.5);check(alignment.x===.25&&alignment.y===-.5,'Alignment private fields');
      cases++;
    }
    class DerivedRect extends PrivateCoreRect {extra=19;}
    const derived=new DerivedRect(1,2,5,8);check(derived.left===1&&derived.extra===19,'Core subclass fields');
    const receiver=new Proxy(new PrivateCoreRect(1,2,3,4),{get(){throw Error('Core getter forwarded a private field to Proxy');}});
    let denied=false;try{Object.getOwnPropertyDescriptor(PrivateCoreRect.prototype,'left').get.call(receiver);}catch(error){denied=error instanceof TypeError;}
    check(denied,'Core private getter brand');
    const policy={accepts:value=>typeof value==='number',hash:value=>value,equals:(a,b)=>a===b};
    const map=new PrivateCoreDartMap(policy,value=>typeof value==='string');
    map.set(1,'a');map.set(2,'b');check(map.get(1)==='a'&&map.get(9)===null&&[...map.keys].join(',')==='1,2','lowered private methods and data');
    map.set(1,'c');check(map.get(1)==='c','Map update');map.freeze();
    denied=false;try{map.set(3,'d');}catch(error){denied=error instanceof TypeError;}check(denied,'Map const mutation');
    const set=new PrivateCoreDartSet(policy);set.add(1);set.add(1);set.add(2);check(set.length===2&&[...set].join(',')==='1,2','DartSet composition');
    globalThis.privateCoreResult={cases,derived:derived.extra,map:map.get(1),set:set.length};
  })();`;
}
