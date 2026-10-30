// SPDX-License-Identifier: BSD-3-Clause
// Reproduces the pinned characters package's literal automaton data; never runs during a product build.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import ts from 'typescript';
const root = path.resolve(import.meta.dirname, '../..'),
  pinFile = path.join(root, 'Nelyx/upstream/characters.json'),
  pin = JSON.parse(fs.readFileSync(pinFile, 'utf8')),
  sha = (value) => createHash('sha256').update(value).digest('hex');
assert.equal(pin.version, '1.4.1');
assert.equal(pin.archiveSha256, 'faf38497bda5ead2a8c7615f4f7939df04333478bf32e4173fcb06d428b5716b');
const args = process.argv.slice(2),
  sourceArg = args.indexOf('--source'),
  config = JSON.parse(
    fs.readFileSync(
      path.join(root, 'tools/Nelyx.FrameworkToTypeScript/dart/.dart_tool/package_config.json'),
      'utf8',
    ),
  );
const sourceRoot =
  sourceArg < 0
    ? fileURLToPath(config.packages.find((p) => p.name === 'characters').rootUri)
    : path.resolve(args[sourceArg + 1]);
for (const input of pin.inputs)
  assert.equal(
    sha(fs.readFileSync(path.join(sourceRoot, input.file))),
    input.sha256,
    'Pinned characters input drift: ' + input.file,
  );
const table = fs.readFileSync(
  path.join(sourceRoot, 'lib/src/grapheme_clusters/table.dart'),
  'utf8',
);
function literal(name) {
  const raw = table.match(new RegExp('const(?: String)? ' + name + ' = ([\\s\\S]*?);'))?.[1];
  assert(raw, name);
  const tokens = [...raw.matchAll(/'(?:\\.|[^'\\])*'/g)].map((m) => m[0]);
  assert(tokens.length);
  assert.equal(raw.replace(/'(?:\\.|[^'\\])*'/g, '').trim(), '');
  return tokens
    .map((token) => {
      assert(!token.includes('$') && !token.includes('\\u{'), 'Unsupported Dart literal escape');
      const tree = ts.createSourceFile(
        'literal.ts',
        'const value = ' + token + ';',
        ts.ScriptTarget.ESNext,
        true,
      );
      assert.equal(tree.parseDiagnostics.length, 0);
      const value = tree.statements[0].declarationList.declarations[0].initializer;
      assert(ts.isStringLiteral(value));
      return value.text;
    })
    .join('');
}
function constant(name, value) {
  const chunks = [];
  for (let at = 0; at < value.length; at += 256)
    chunks.push(JSON.stringify(value.slice(at, at + 256)));
  return `const ${name}=[\n  ${chunks.join(',\n  ')}\n].join('');\n`;
}
const data = literal('_data'),
  start = literal('_start'),
  machine = literal('_stateMachine');
const output =
  `// SPDX-License-Identifier: BSD-3-Clause AND Unicode-3.0
// Copyright (c) 2023, the Dart project authors. All rights reserved.
// Generated from characters 1.4.1 / Unicode 16.0.0. Do not edit.
// Reproduce with tools/Nelyx.FrameworkToTypeScript/generate-grapheme-data.mjs.
// Complete notices: licenses/characters-LICENSE and licenses/characters-UNICODE_LICENSE.txt.
// Exact inputs and archive hash: upstream/characters.json.
` +
  constant('data', data) +
  constant('start', start) +
  constant('stateMachine', machine) +
  `
export function graphemeLow(codeUnit:number):number{return data.charCodeAt(start.charCodeAt(codeUnit>>5)+(codeUnit&31));}
export function graphemeHigh(lead:number,tail:number):number{return data.charCodeAt(start.charCodeAt(2048+(tail>>8)+(lead<<2))+(tail&255));}
export function graphemeMove(state:number,category:number):number{return stateMachine.charCodeAt((state&-4)+category);}
`;
const target = path.join(root, pin.generatedFile);
assert.equal(target, path.join(root, 'Nelyx/src/foundation/grapheme-break-data.ts'));
if (args.includes('--check'))
  assert.equal(fs.readFileSync(target, 'utf8'), output, 'Generated grapheme table differs');
else fs.writeFileSync(target, output);
console.log(
  JSON.stringify({
    status: 'PASS',
    mode: args.includes('--check') ? 'check' : 'generate',
    output: pin.generatedFile,
    sha256: sha(output),
    codeUnits: { data: data.length, start: start.length, stateMachine: machine.length },
  }),
);
