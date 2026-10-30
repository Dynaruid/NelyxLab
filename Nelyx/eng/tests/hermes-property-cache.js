// SPDX-License-Identifier: BSD-3-Clause
'use strict';
function cacheRequire(value, message) {
  if (!value) throw Error(message);
}
function cacheRead(object) {
  return object.value;
}
function cacheWarm(object, expected) {
  for (let index = 0; index < 20; index++)
    cacheRequire(cacheRead(object) === expected, 'warm read');
}
function cacheTransientRead(object) {
  return object.transient;
}
globalThis.cacheChecks = function () {
  let calls = 0,
    receiver;
  const base = {
      get value() {
        calls++;
        receiver = this;
        return this.seed;
      },
    },
    middle = Object.create(base),
    near = Object.create(middle),
    object = Object.create(near);
  object.seed = 7;
  cacheWarm(object, 7);
  cacheRequire(calls === 20 && receiver === object, 'getter count/receiver');
  Object.defineProperty(base, 'value', {
    get() {
      calls++;
      receiver = this;
      return this.seed + 1;
    },
    configurable: true,
  });
  cacheWarm(object, 8);
  cacheRequire(calls === 40 && receiver === object, 'replaced accessor');
  Object.defineProperty(middle, 'value', { value: 19, writable: true, configurable: true });
  cacheWarm(object, 19);
  middle.value = 23;
  cacheRequire(cacheRead(object) === 23, 'holder value replacement');
  delete middle.value;
  cacheRequire(cacheRead(object) === 8, 'deleted shadow');
  let rejected = false;
  try {
    object.value = 3;
  } catch (error) {
    rejected = error instanceof TypeError;
  }
  cacheRequire(rejected && cacheRead(object) === 8, 'getter-only write');
  Object.defineProperty(object, 'value', { value: 31, configurable: true });
  cacheWarm(object, 31);
  delete object.value;
  cacheRequire(cacheRead(object) === 8, 'own shadow/delete');
  Object.defineProperty(base, 'value', { value: 37, writable: true, configurable: true });
  cacheWarm(object, 37);
  Object.defineProperty(base, 'value', {
    set(value) {
      this.seed = value;
    },
    configurable: true,
  });
  cacheWarm(object, undefined);
  Object.defineProperty(base, 'value', {
    get() {
      return this.seed;
    },
    configurable: true,
  });
  cacheWarm(object, 7);
  const alternate = { value: 41 };
  Object.setPrototypeOf(middle, alternate);
  cacheWarm(object, 41);
  Object.setPrototypeOf(middle, base);
  cacheWarm(object, 7);
  Object.setPrototypeOf(object, alternate);
  cacheWarm(object, 41);
  Object.setPrototypeOf(object, near);
  cacheWarm(object, 7);
  const different = Object.create(Object.create({ value: 43 }));
  different.seed = 7;
  cacheWarm(different, 43);
  cacheWarm(object, 7);
  for (const failure of [0, undefined, null, new Error('getter sentinel')]) {
    Object.defineProperty(base, 'value', {
      get() {
        throw failure;
      },
      configurable: true,
    });
    let caught = false;
    try {
      cacheRead(object);
    } catch (error) {
      caught = true;
      cacheRequire(error === failure, 'thrown identity');
    }
    cacheRequire(caught, 'falsey getter failure');
  }
  Object.defineProperty(base, 'value', {
    get() {
      return this.seed;
    },
    configurable: true,
  });
  cacheWarm(object, 7);
  const foreign = { seed: 47 };
  cacheRequire(Reflect.get(object, 'value', foreign) === 47, 'foreign receiver');
  let proxyGets = 0;
  const proxy = new Proxy(
      { value: 53 },
      {
        get(target, key, targetReceiver) {
          proxyGets++;
          return Reflect.get(target, key, targetReceiver);
        },
      },
    ),
    throughProxy = Object.create(proxy);
  cacheWarm(throughProxy, 53);
  cacheRequire(proxyGets === 20, 'proxy prototype trap count');
  cacheWarm(proxy, 53);
  cacheRequire(proxyGets === 40, 'proxy receiver trap count');
  const wide = {};
  for (let index = 0; index < 90; index++) wide['field' + index] = index;
  wide.value = 59;
  const wideMiddle = Object.create(wide),
    wideObject = Object.create(wideMiddle);
  cacheWarm(wideObject, 59);
  wideMiddle.value = 61;
  cacheWarm(wideObject, 61);
  delete wideMiddle.value;
  delete wide.value;
  wide.value = 67;
  cacheWarm(wideObject, 67);
  for (let index = 0; index < 90; index++) wideObject['own' + index] = index;
  cacheWarm(wideObject, 67);
  wideObject.value = 71;
  cacheWarm(wideObject, 71);
  delete wideObject.value;
  cacheWarm(wideObject, 67);
  let mutationCalls = 0;
  const mutating = {
      get value() {
        mutationCalls++;
        Object.defineProperty(this, 'value', { value: 73, configurable: true });
        return 79;
      },
    },
    mutationObject = Object.create(Object.create(mutating));
  cacheRequire(
    cacheRead(mutationObject) === 79 && cacheRead(mutationObject) === 73 && mutationCalls === 1,
    'getter mutation order',
  );
  globalThis.cacheRetained = object;
  globalThis.cacheRetainedRead = cacheRead;
  (function () {
    const transient = { transient: 83 },
      instance = Object.create(Object.create(transient));
    for (let index = 0; index < 20; index++)
      cacheRequire(cacheTransientRead(instance) === 83, 'transient lookup');
    trackPrototype(transient);
  })();
  return true;
};
class CacheBase {
  get cachedValue() {
    return this.seed;
  }
  cachedMethod() {
    return this.seed;
  }
}
CacheBase.prototype.inheritedValue = 7;
class CacheLevel1 extends CacheBase {}
class CacheLevel2 extends CacheLevel1 {}
class CacheLevel3 extends CacheLevel2 {}
class CacheLeaf extends CacheLevel3 {
  constructor() {
    super();
    this.seed = 7;
  }
}
const cacheBenchObject = new CacheLeaf();
globalThis.cacheBench = function (kind, count) {
  let result = 0;
  const object = cacheBenchObject;
  if (kind === 'own') for (let index = 0; index < count; index++) result += object.seed;
  else if (kind === 'inherited')
    for (let index = 0; index < count; index++) result += object.inheritedValue;
  else if (kind === 'getter')
    for (let index = 0; index < count; index++) result += object.cachedValue;
  else if (kind === 'method')
    for (let index = 0; index < count; index++) result += object.cachedMethod();
  else throw Error('unknown cache benchmark');
  return result;
};
