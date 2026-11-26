// SPDX-License-Identifier: BSD-3-Clause
const pluralSuffix = /(Zero|One|Two|Few|Many|Other)$/;
const placeholder = /\$(?:\{([a-zA-Z]\w*)\}|([a-zA-Z]\w*))/g;
const identifier = /^[a-zA-Z]\w*$/;
const formatValues = {
  scriptCategory: ['English-like', 'dense', 'tall'],
  icuShortTimePattern: [
    'HH:mm',
    'HH.mm',
    "HH 'h' mm",
    'HH:mm น.',
    'H:mm',
    'h:mm a',
    'a h:mm',
    'ah:mm',
  ],
};
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const fail = (file, key, message) => {
  throw new Error(`${file} ${key}: ${message}`);
};

export function parseArb(source, file) {
  try {
    const arb = JSON.parse(source);
    if (!record(arb)) throw new Error('Expected an object');
    return arb;
  } catch (error) {
    throw new Error(`Invalid ARB ${file}`, { cause: error });
  }
}

export function englishSchema(arb, file) {
  const metadata = Object.fromEntries(
    Object.entries(arb)
      .filter(([key]) => key.startsWith('@') && !key.startsWith('@@'))
      .map(([key, value]) => [key.slice(1), value]),
  );
  for (const [key, value] of Object.entries(metadata)) {
    if (!identifier.test(key) || !record(value)) fail(file, key, 'Invalid metadata');
    if (value.optional !== undefined && typeof value.optional !== 'boolean')
      fail(file, key, 'Invalid optional flag');
    if (
      value.plural !== undefined &&
      (typeof value.plural !== 'string' ||
        !identifier.test(value.plural) ||
        !Object.hasOwn(arb, `${key}Other`))
    )
      fail(file, key, 'Invalid plural argument or missing Other branch');
    if (
      value.parameters !== undefined &&
      (typeof value.parameters !== 'string' ||
        !parameters(value).every((parameter) => identifier.test(parameter)) ||
        new Set(parameters(value)).size !== parameters(value).length)
    )
      fail(file, key, 'Invalid parameters');
    if (
      value['x-flutter-type'] !== undefined &&
      !Object.hasOwn(formatValues, value['x-flutter-type'])
    )
      fail(file, key, 'Unknown x-flutter-type');
  }
  return metadata;
}

function parameters(metadata) {
  return metadata?.parameters?.split(',').map((name) => name.trim().replace(/^\$/, '')) ?? [];
}

export function readMessages(arb, file, english, metadata, fixes = {}) {
  const messages = {},
    attributes = {};
  for (const [key, original] of Object.entries(arb)) {
    if (key.startsWith('@')) {
      if (!Object.hasOwn(english, key) || !record(original))
        fail(file, key, 'Unknown or invalid metadata');
      if (arb !== english) {
        const name = key.slice(1);
        for (const field of ['parameters', 'plural', 'optional', 'x-flutter-type']) {
          if (Object.hasOwn(original, field) && original[field] !== metadata[name]?.[field])
            fail(file, key, `Metadata ${field} differs from the English declaration`);
        }
        attributes[name] = original;
      }
      continue;
    }
    if (
      !identifier.test(key) ||
      typeof original !== 'string' ||
      (!Object.hasOwn(english, key) && !metadata[key]?.optional)
    )
      fail(file, key, 'Unknown key or non-string message');
    const fix = fixes[key];
    if (fix && original !== fix[0])
      fail(file, key, 'Pinned placeholder correction no longer matches');
    const value = fix?.[1] ?? original;
    const branch = pluralSuffix.exec(key);
    const plural = branch ? metadata[key.slice(0, -branch[0].length)]?.plural : undefined;
    const declared = plural ? [plural] : parameters(metadata[key]);
    const actual = new Set(
      Array.from(value.matchAll(placeholder), (match) => match[1] ?? match[2]),
    );
    for (const name of actual)
      if (!declared.includes(name)) fail(file, key, `Undeclared placeholder ${name}`);
    if (!plural)
      for (const name of declared)
        if (!actual.has(name)) fail(file, key, `Missing placeholder ${name}`);
    const type = metadata[key]?.['x-flutter-type'];
    if (type && !formatValues[type].includes(value))
      fail(file, key, `Invalid ${type} value ${value}`);
    messages[key] = value;
  }
  for (const key of Object.keys(fixes))
    if (!Object.hasOwn(messages, key)) fail(file, key, 'Missing pinned placeholder correction');
  return { messages, attributes };
}

export function requiredMessageKeys(english, metadata) {
  return Object.keys(english).filter((key) => !key.startsWith('@') && !metadata[key]?.optional);
}

export function requireMessages(messages, required, file, tag) {
  for (const key of required)
    if (!Object.hasOwn(messages, key)) fail(file, key, 'Required message missing for ' + tag);
}
