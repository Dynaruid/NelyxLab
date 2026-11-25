// SPDX-License-Identifier: BSD-3-Clause
const modules = new Map();
let updates = new Map();

export function registerWidgetModule(id, shape, scope) {
  const read = (name) => {
    if (!Object.hasOwn(scope, name)) throw Error('Unknown widget module binding: ' + name);
    return scope[name];
  };
  const module = { shape, read, methods: new Map() };
  const registered = modules.get(id) ?? new Set();
  registered.add(module);
  modules.set(id, registered);
  const update = updates.get(id);
  if (update) {
    if (update.shape === shape) module.methods = instantiate(update, read);
    else
      queueMicrotask(() =>
        globalThis[Symbol.for('nelyx.frontend.reload')]?.restart?.(
          'A lazy widget module belongs to a different source generation',
        ),
      );
  }
  return (name, receiver, args) => {
    const build = module.methods.get(name);
    if (build) return { value: Reflect.apply(build, receiver, args) };
  };
}

function instantiate(update, read) {
  return new Map(update.factories.map(([name, make]) => [name, make(read)]));
}

export function applyWidgetUpdate(replacement) {
  const next = new Map();
  const prepared = new Map();
  for (const [id, shape, factories] of replacement) {
    const update = { shape, factories };
    for (const module of modules.get(id) ?? []) {
      if (module.shape !== shape) return false;
      prepared.set(module, instantiate(update, module.read));
    }
    next.set(id, update);
  }
  for (const [module, methods] of prepared) module.methods = methods;
  updates = next;
  return true;
}
