// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openFlutterSource } from './flutter-source.mjs';

const [repository, mode, ...unexpected] = process.argv.slice(2);
assert(
  repository && !unexpected.length && (mode === undefined || mode === '--check'),
  'Usage: generate-material-animated-icons.mjs <flutter-repo> [--check]',
);
const source = openFlutterSource(repository);
const material = 'packages/flutter/lib/src/material';
const library = source.text(`${material}/animated_icons.dart`);
const platform = source.text(`${material}/animated_icons/animated_icons_data.dart`);
const partPattern = /^part 'animated_icons\/data\/([a-z_]+)\.g\.dart';$/gm;
const memberPattern = /^  static const AnimatedIconData ([a-z_]+) = _\$\1;$/gm;
const names = [...platform.matchAll(memberPattern)].map((match) => match[1]);
assert(names.length > 0 && new Set(names).size === names.length, 'Invalid animated icon members');
assert.deepEqual(
  [...library.matchAll(partPattern)].map((match) => match[1]).sort(),
  [...names].sort(),
  'Flutter animated icon parts differ from their public members',
);

function parseFrames(file, name) {
  const input = source.text(file);
  const lexer =
    /\s+|\/\/[^\n]*|[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][-+]?\d+)?|[A-Za-z_$][\w$]*|[<>()\[\]:,;=]/y;
  const tokens = [];
  while (lexer.lastIndex < input.length) {
    const offset = lexer.lastIndex;
    const token = lexer.exec(input)?.[0];
    assert(token, `Unexpected animated icon syntax in ${file} at offset ${offset}`);
    if (!/^\s|^\/\//.test(token)) tokens.push(token);
  }
  let index = 0;
  function take(value) {
    if (tokens[index] !== value) return false;
    index++;
    return true;
  }
  function expect(...values) {
    for (const value of values) {
      assert(take(value), `Expected ${value} in ${file}, found ${tokens[index] ?? 'end of file'}`);
    }
  }
  function number() {
    const value = Number(tokens[index++]);
    assert(Number.isFinite(value), `Expected a finite number in ${file}`);
    return value;
  }
  function list(type, element) {
    expect('<', type, '>', '[');
    const elements = [];
    while (!take(']')) {
      elements.push(element());
      if (!take(',')) {
        expect(']');
        break;
      }
    }
    assert(elements.length, `Empty ${type} track in ${file}`);
    return elements;
  }
  function point() {
    expect('Offset', '(');
    const x = number();
    expect(',');
    const y = number();
    expect(')');
    return [x, y];
  }
  function command() {
    const command = tokens[index++];
    expect('(');
    const tracks = command === '_PathCubicTo' ? 3 : command === '_PathClose' ? 0 : 1;
    const kind = {
      _PathMoveTo: 'moveTo',
      _PathLineTo: 'lineTo',
      _PathCubicTo: 'cubicTo',
      _PathClose: 'close',
    }[command];
    assert(kind, `Unsupported path command ${command} in ${file}`);
    const points = [];
    for (let track = 0; track < tracks; track++) {
      if (track > 0) expect(',');
      points.push(list('Offset', point));
    }
    take(',');
    expect(')');
    return [kind, ...points];
  }
  function path() {
    expect('_PathFrames', '(', 'opacities', ':');
    const opacities = list('double', number);
    assert(
      opacities.every((value) => value >= 0 && value <= 1),
      `Invalid opacity in ${file}`,
    );
    expect(',', 'commands', ':');
    const commands = list('_PathCommand', command);
    take(',');
    expect(')');
    return { opacities, commands };
  }

  expect(
    'part',
    'of',
    'material_animated_icons',
    ';',
    'const',
    '_AnimatedIconData',
    `_$${name}`,
    '=',
    '_AnimatedIconData',
    '(',
    'Size',
    '(',
  );
  const width = number();
  expect(',');
  const height = number();
  expect(')', ',');
  assert(width > 0 && width === height, `Expected square animated icon dimensions in ${file}`);
  const paths = list('_PathFrames', path);
  let matchTextDirection = false;
  if (take(',') && take('matchTextDirection')) {
    expect(':');
    matchTextDirection = take('true');
    if (!matchTextDirection) expect('false');
    take(',');
  }
  expect(')', ';');
  assert.equal(index, tokens.length, `Unexpected trailing syntax in ${file}`);
  return { width, matchTextDirection, paths };
}

function arrayLiteral(values) {
  return `[${values
    .map((value) => {
      if (Array.isArray(value)) return arrayLiteral(value);
      return Object.is(value, -0) ? '-0' : JSON.stringify(value);
    })
    .join(', ')}]`;
}

const files = names.map((name) => `${material}/animated_icons/data/${name}.g.dart`);
source.preload(files);
const entries = files.map((file, index) => {
  const name = names[index];
  const { width, matchTextDirection, paths } = parseFrames(file, name);
  const lines = [
    `  // ${file.slice(material.length + 1)} (Git blob ${source.blob(file)})`,
    `  ${name}: {`,
    `    width: ${width},`,
    `    matchTextDirection: ${matchTextDirection},`,
    '    paths: [',
  ];
  for (const { opacities, commands } of paths) {
    lines.push('      {', `        opacities: ${arrayLiteral(opacities)},`, '        commands: [');
    for (const [kind, ...tracks] of commands) {
      if (tracks.length === 0) {
        lines.push(`          ['${kind}'],`);
        continue;
      }
      lines.push(`          ['${kind}',`);
      for (const track of tracks) {
        lines.push('            [');
        for (let frame = 0; frame < track.length; frame += 3) {
          lines.push(
            `              ${track
              .slice(frame, frame + 3)
              .map(arrayLiteral)
              .join(', ')},`,
          );
        }
        lines.push('            ],');
      }
      lines.push('          ],');
    }
    lines.push('        ],', '      },');
  }
  lines.push('    ],', '  },');
  return lines.join('\n');
});
const generated = [
  '// SPDX-License-Identifier: BSD-3-Clause',
  '// Copyright 2014 The Flutter Authors. All rights reserved.',
  `// Generated from Flutter ${source.revision}.`,
  "import type { AnimatedIconFrames } from '../../internal/animated-icon-frames.ts';",
  '',
  'type AnimatedIconName =',
  names.map((name, index) => `  | '${name}'${index + 1 === names.length ? ';' : ''}`).join('\n'),
  '',
  'export const animatedIconFrames: Readonly<Record<AnimatedIconName, AnimatedIconFrames>> = {',
  ...entries,
  '};',
  '',
].join('\n');
const output = new URL(
  '../../packages/material/src/generated/animated-icons/animated-icon-frames.generated.ts',
  import.meta.url,
);
if (mode === '--check') {
  assert.equal(fs.readFileSync(output, 'utf8').replaceAll('\r\n', '\n'), generated);
} else {
  fs.mkdirSync(new URL('.', output), { recursive: true });
  fs.writeFileSync(output, generated);
}
console.log(
  `Flutter animated icon data ${mode === '--check' ? 'matched' : 'generated'} for ${names.length} icons.`,
);
