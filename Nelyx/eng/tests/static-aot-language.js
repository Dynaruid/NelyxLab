// SPDX-License-Identifier: BSD-3-Clause
(function () {
  const events = [],
    sentinel = Error('sentinel');
  class Base {
    constructor(...args) {
      this.args = args;
      this.target = new.target;
    }
    set value(_) {
      throw Error('field used inherited setter');
    }
  }
  class Derived extends Base {
    value = 7;
    #secret = 3;
    callback = () => this.value + this.#secret;
    static ready;
    static {
      this.ready = 11;
    }
    static branded(value) {
      return #secret in value;
    }
  }
  const value = new Derived(2, 3),
    callback = value.callback;
  const Empty = class {};
  function Target() {}
  const reflected = Reflect.construct(Empty, [1, 2], Target);
  const getters = {
    get value() {
      events.push('get');
      return 4;
    },
    set value(n) {
      events.push(n);
    },
  };
  const proxy = new Proxy(getters, {
    get(target, key, receiver) {
      events.push('proxy');
      return Reflect.get(target, key, receiver);
    },
  });
  const property = proxy.value;
  proxy.value = 5;
  let caught = false;
  try {
    throw sentinel;
  } catch (error) {
    caught = error === sentinel;
  } finally {
    events.push('finally');
  }
  function* sequence() {
    try {
      yield 6;
      yield 7;
    } finally {
      events.push('iterator-close');
    }
  }
  const [first] = sequence();
  let tdz = false;
  {
    try {
      void later;
    } catch (error) {
      tdz = error instanceof ReferenceError;
    }
    let later = 1;
  }
  /* oxlint-disable no-unused-vars, no-const-assign -- Exercise const assignment, temporal dead zones and class initialization failures. */
  const binding = 1;
  let readonly = false;
  try {
    binding = 2;
  } catch (error) {
    readonly = error instanceof TypeError;
  }
  /* oxlint-enable no-unused-vars, no-const-assign */
  const closures = [];
  for (let i = 0; i < 3; i++) closures.push(() => i);
  const mutations = [];
  for (let index = 0; index < 4; index++) {
    const start = index;
    while (index < 1) index++;
    mutations.push([start, index]);
  }
  const parentChain = { value: 1, parent: { value: 2, parent: null } },
    parents = [];
  for (let node = parentChain; node; node = node.parent) {
    if (node.value) parents.push(node.value);
  }
  const nested = [];
  for (let outer = 0; outer < 2; outer++) {
    for (let inner = 0; inner < 3; inner++) {
      if (inner === 0) inner++;
      nested.push([outer, inner]);
    }
  }
  let headTdz = false;
  try {
    for (let a = b, b = 1; a < 2; a++) {}
  } catch (error) {
    headTdz = error instanceof ReferenceError;
  }
  const bodyTdz = [];
  for (let index = 0; index < 2; index++) {
    let read = () => later;
    try {
      read();
    } catch (error) {
      bodyTdz.push(error instanceof ReferenceError);
    }
    let later = index;
    bodyTdz.push(read());
  }
  const initialCaptures = [];
  initial: for (let index = 0, read = () => index; index < 3; index++) {
    initialCaptures.push([index, read()]);
    if (index < 2) continue initial;
    break initial;
  }
  let observation = 'outer';
  const shadows = [];
  {
    let observation = 'inner';
    if (observation) shadows.push(observation);
    observation += '!';
    shadows.push(observation);
  }
  shadows.push(observation);
  class DeferredField {
    value = owners.get(this) ?? 'absent';
    callback = () => owners.get(this);
  }
  let fieldTdz = false;
  try {
    new DeferredField();
  } catch (error) {
    fieldTdz = error instanceof ReferenceError;
  }
  const owners = new WeakMap(),
    deferred = new DeferredField();
  owners.set(deferred, 'present');
  class FieldWrite {
    value = fieldCounter++;
  }
  let writeTdz = false;
  try {
    new FieldWrite();
  } catch (error) {
    writeTdz = error instanceof ReferenceError;
  }
  let fieldCounter = 2;
  const written = new FieldWrite();
  /* oxlint-disable no-unused-vars -- Exercise const assignment, temporal dead zones and class initialization failures. */
  let staticTdz = false;
  try {
    class StaticField {
      static value = staticLater;
    }
  } catch (error) {
    staticTdz = error instanceof ReferenceError;
  }
  const staticLater = 1;
  /* oxlint-enable no-unused-vars */
  const keys = [];
  for (let key in { a: 1, b: 2 }) keys.push(() => key);
  const values = [];
  for (let item of [4, 5]) values.push(() => item);
  const plainValues = [];
  for (const key of [1, 2]) {
    if (key === 1) plainValues.push(key);
    plainValues.push(key);
  }
  const plainKeys = [];
  for (const key in { a: 1, b: 2 }) {
    if (key) plainKeys.push(key);
  }
  const settingsResult = {};
  for (const [target, settings] of Object.entries({
    windows: { profile: 'native' },
    web: { profile: 'web' },
  })) {
    if (Object.keys(settings).some((key) => key !== 'profile')) throw Error('unexpected setting');
    settingsResult[target] = { ...settings };
  }
  const patternClosures = [];
  for (const [first, { value = first }, ...rest] of [
    [1, {}, 3],
    [2, { value: 7 }, 4],
  ])
    patternClosures.push(() => [first, value, rest]);
  let patternTdz = false;
  try {
    for (const [item] of item) {
    }
  } catch (error) {
    patternTdz = error instanceof ReferenceError;
  }
  let inTdz = false,
    ofTdz = false;
  try {
    for (let key in key) {
    }
  } catch (error) {
    inTdz = error instanceof ReferenceError;
  }
  try {
    for (let item of item) {
    }
  } catch (error) {
    ofTdz = error instanceof ReferenceError;
  }
  let rhsRead;
  for (let item of ((rhsRead = () => item), [1])) {
  }
  let rhsTdz = false;
  try {
    rhsRead();
  } catch (error) {
    rhsTdz = error instanceof ReferenceError;
  }
  /* oxlint-disable no-unused-vars -- Exercise const assignment, temporal dead zones and class initialization failures. */
  const assignmentOrder = [];
  try {
    for (let item of (item = (assignmentOrder.push('rhs'), [1]))) {
    }
  } catch (error) {
    assignmentOrder.push(error.name);
  }
  try {
    for (let item of (item += (assignmentOrder.push('unreachable'), 1))) {
    }
  } catch (error) {
    assignmentOrder.push(error.name);
  }
  try {
    for (let item of ([item] = (assignmentOrder.push('destructure'), [1]))) {
    }
  } catch (error) {
    assignmentOrder.push(error.name);
  }
  /* oxlint-enable no-unused-vars */
  /* oxlint-disable no-sparse-arrays -- Exercise sparse-array iteration and spread behavior in the language conformance fixture. */
  const array = [, 1],
    alias = array;
  alias.push(2);
  /* oxlint-enable no-sparse-arrays */
  const buffer = new ArrayBuffer(8),
    bytes = new Uint8Array(buffer),
    view = new DataView(buffer);
  bytes[2] = 13;
  const map = new Map([[value, 17]]),
    weak = new WeakMap([[value, sentinel]]),
    set = new Set([value, value]);
  const result = {
    callback: callback(),
    static: Derived.ready,
    brand: Derived.branded(value) && !Derived.branded({}),
    target: value.target === Derived,
    ownField: Object.hasOwn(value, 'value'),
    args: value.args.join(','),
    tdz,
    readonly,
    inTdz,
    ofTdz,
    rhsTdz,
    patternTdz,
    plainValues,
    plainKeys,
    settingsResult,
    patternClosures: patternClosures.map((fn) => fn()),
    assignmentOrder,
    mutations,
    parents,
    nested,
    headTdz,
    bodyTdz,
    initialCaptures,
    shadows,
    fields: [
      fieldTdz,
      deferred.value,
      deferred.callback(),
      writeTdz,
      written.value,
      fieldCounter,
      staticTdz,
    ],
    keys: keys.map((fn) => fn()),
    values: values.map((fn) => fn()),
    reflected: Object.getPrototypeOf(reflected) === Target.prototype,
    property,
    caught,
    first,
    closures: closures.map((fn) => fn()),
    hole: !(0 in array),
    alias: alias === array && array.length === 3,
    buffer: view.getUint8(2),
    map: map.get(value),
    weak: weak.get(value) === sentinel,
    set: set.size,
    events,
  };
  async function later() {
    return (await Promise.resolve(8)) + 1;
  }
  globalThis.languageResult = 'pending';
  return later().then((n) => {
    result.async = n;
    globalThis.languageResult = JSON.stringify(result);
    return globalThis.languageResult;
  });
})();
