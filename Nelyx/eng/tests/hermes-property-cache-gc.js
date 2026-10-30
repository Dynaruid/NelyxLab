// SPDX-License-Identifier: BSD-3-Clause
'use strict';
function cacheGcRequire(value, message) {
  if (!value) throw Error(message);
}
function cacheGcRead(object) {
  return object.value;
}
function cacheGcWarm(object, value) {
  for (let index = 0; index < 20; index++)
    cacheGcRequire(cacheGcRead(object) === value, 'old prototype read');
}
function cacheGcTransientRead(object) {
  return object.transient;
}
globalThis.cacheGcChecks = function () {
  let calls = 0,
    receiver,
    collect = false;
  const base = {
      get value() {
        calls++;
        receiver = this;
        if (collect) {
          collect = false;
          Object.setPrototypeOf(this, null);
          cacheCollect();
        }
        return this.seed;
      },
    },
    middle = Object.create(base),
    object = Object.create(Object.create(middle));
  object.seed = 7;
  cacheCollect();
  cacheGcWarm(object, 7);
  cacheGcRequire(calls === 20 && receiver === object, 'old getter receiver/count');
  Object.defineProperty(base, 'value', {
    get() {
      calls++;
      receiver = this;
      return this.seed + 1;
    },
    configurable: true,
  });
  cacheGcWarm(object, 8);
  cacheGcRequire(calls === 40 && receiver === object, 'old replaced getter');
  Object.defineProperty(middle, 'value', { value: 11, writable: true, configurable: true });
  cacheGcWarm(object, 11);
  middle.value = 13;
  cacheGcWarm(object, 13);
  delete middle.value;
  cacheGcWarm(object, 8);
  Object.defineProperty(base, 'value', { value: 17, writable: true, configurable: true });
  cacheGcWarm(object, 17);
  Object.defineProperty(base, 'value', {
    get() {
      return this.seed;
    },
    configurable: true,
  });
  cacheGcWarm(object, 7);
  Object.defineProperty(object, 'value', { value: 19, configurable: true });
  cacheGcWarm(object, 19);
  delete object.value;
  cacheGcWarm(object, 7);
  const alternate = { value: 23 };
  cacheCollect();
  Object.setPrototypeOf(middle, alternate);
  cacheGcWarm(object, 23);
  Object.setPrototypeOf(middle, base);
  cacheGcWarm(object, 7);
  for (const failure of [0, undefined, null, new Error('old getter sentinel')]) {
    Object.defineProperty(base, 'value', {
      get() {
        throw failure;
      },
      configurable: true,
    });
    let caught = false;
    try {
      cacheGcRead(object);
    } catch (error) {
      caught = true;
      cacheGcRequire(error === failure, 'old thrown identity');
    }
    cacheGcRequire(caught, 'old falsey failure');
  }
  Object.defineProperty(base, 'value', {
    get() {
      calls++;
      receiver = this;
      if (collect) {
        collect = false;
        Object.setPrototypeOf(this, null);
        cacheCollect();
      }
      return this.seed;
    },
    configurable: true,
  });
  cacheGcWarm(object, 7);
  collect = true;
  cacheGcRequire(
    cacheGcRead(object) === 7 && receiver === object && cacheGcRead(object) === undefined,
    'getter mutation/GC',
  );
  const wide = {};
  for (let index = 0; index < 90; index++) wide['field' + index] = index;
  wide.value = 29;
  const wideMiddle = Object.create(wide),
    wideObject = Object.create(wideMiddle);
  cacheCollect();
  cacheGcWarm(wideObject, 29);
  wideMiddle.value = 31;
  cacheGcWarm(wideObject, 31);
  delete wideMiddle.value;
  delete wide.value;
  wide.value = 37;
  cacheGcWarm(wideObject, 37);
  let proxyGets = 0;
  const proxy = new Proxy(
      { value: 41 },
      {
        get(target, key, targetReceiver) {
          proxyGets++;
          return Reflect.get(target, key, targetReceiver);
        },
      },
    ),
    proxyObject = Object.create(Object.create(proxy));
  cacheCollect();
  cacheGcWarm(proxyObject, 41);
  cacheGcRequire(proxyGets === 20, 'old proxy trap count');
  const hostChild = Object.create(Object.create(hostCacheObject));
  for (let index = 0; index < 20; index++)
    cacheGcRequire(cacheGcRead(hostChild) === 101 + index, 'host getter sequence');
  (function () {
    const prototype = { transient: 43 },
      instance = Object.create(Object.create(prototype));
    cacheCollect();
    for (let index = 0; index < 20; index++)
      cacheGcRequire(cacheGcTransientRead(instance) === 43, 'old weak cache');
    trackPrototype(prototype);
  })();
  return true;
};
globalThis.cacheYoungChecks = function () {
  const before = cacheYoungCollections();
  let sum = 0,
    rounds = 0;
  while (rounds < 8 && cacheYoungCollections() === before) {
    const parent = { value: 47 + rounds },
      object = Object.create(Object.create(parent));
    cacheGcWarm(object, parent.value);
    const pressure = [];
    for (let index = 0; index < 35000; index++) pressure.push({ value: index, other: index + 1 });
    cacheGcWarm(object, parent.value);
    sum += pressure[pressure.length - 1].other;
    rounds++;
  }
  cacheGcRequire(
    rounds > 0 && cacheYoungCollections() > before && sum === 35000 * rounds,
    'young collection did not preserve lookup',
  );
  return rounds;
};
