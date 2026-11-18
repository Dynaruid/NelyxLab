// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../..');
function git(...args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    timeout: 1200000,
  });
}
function transpile(path, source) {
  return ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      verbatimModuleSyntax: true,
      rewriteRelativeImportExtensions: true,
    },
  }).outputText;
}
const normalize = (s) =>
  s
    .replace(/\r\n/g, '\n')
    .replace(/\/\/# sourceMappingURL=[^\n]+\s*$/, '')
    .trimEnd();
// A controlled ablation, not a shipped alternative scheduler. Keep the candidate
// update methods but restore baseline mount, matching and reservation bodies.
function updatesOnly(original, current) {
  const parse = (text) => ts.createSourceFile('framework.ts', text, ts.ScriptTarget.ES2022, true);
  const old = parse(original),
    now = parse(current),
    edits = [];
  const member = (file, c, m) =>
    file.statements
      .find((s) => ts.isClassDeclaration(s) && s.name?.text === c)
      ?.members.find((n) => ts.isMethodDeclaration(n) && n.name.getText(file) === m);
  for (const [c, methods] of Object.entries({
    BuildOwner: ['reserve'],
    Element: ['mount', 'reconcileOneChild', 'reconcile'],
    StatelessElement: ['mount'],
    StatefulElement: ['mount'],
    ProxyElement: ['mount'],
    RenderObjectElement: ['mount'],
  }))
    for (const m of methods) {
      const previous = member(old, c, m),
        candidate = member(now, c, m);
      assert(candidate, `${c}.${m}`);
      assert(previous || c === 'StatelessElement' || c === 'ProxyElement');
      edits.push([candidate.getStart(), candidate.end, previous?.getText(old) ?? '']);
    }
  for (const [start, end, body] of edits.sort((a, b) => b[0] - a[0]))
    current = current.slice(0, start) + body + current.slice(end);
  return current;
}
const coldFiles = ['basic', 'listener', 'mouse-region', 'raw-gesture-detector', 'semantics']
  .map((n) => `Nelyx/src/framework/widgets/${n}.ts`)
  .concat('packages/material/src/ink-well.ts');
async function loadGraph(replacements, flag) {
  const h = registerHooks({
    resolve(s, c, next) {
      const r = next(s, c);
      return c.parentURL?.endsWith(flag) && r.url.startsWith('file:') && !r.url.endsWith(flag)
        ? { ...r, url: r.url + flag }
        : r;
    },
    load(url, c, next) {
      if (!url.endsWith(flag)) return next(url, c);
      const path = url.slice(0, -flag.length);
      return replacements.has(path)
        ? { format: 'module', shortCircuit: true, source: replacements.get(path) }
        : next(path, c);
    },
  });
  try {
    return (await import('./calendar-midpoint-fixture.mjs' + flag)).exercise;
  } finally {
    h.deregister();
  }
}
export async function variant(mode, ref, exercise, paired) {
  const replacements = new Map(),
    isolated = new Map(),
    flag = '?w7-calendar-variant';
  if (mode === '--trial-single-child') {
    const file = resolve(root, 'Nelyx/dist/framework/widgets/framework.js'),
      source = readFileSync(file, 'utf8');
    const original = 'const child = this.reconcileOneChild(previous[0], widgets[0]);';
    assert.equal(source.split(original).length, 2);
    replacements.set(
      pathToFileURL(file).href,
      source.replace(
        original,
        original +
          '\n            if (child && previous === this.children && child === previous[0]) return previous;',
      ),
    );
  } else {
    assert.match(ref ?? '', /^[0-9a-f]{7,40}$/i, 'supply the checked baseline commit SHA');
    const paths =
      mode === '--cold-before'
        ? coldFiles
        : git(
            'diff',
            '--name-only',
            '--diff-filter=M',
            ref,
            '--',
            'Nelyx/src',
            'packages/material/src',
          )
            .trim()
            .split(/\r?\n/)
            .filter(Boolean);
    assert(paths.length > 0);
    for (const file of paths) {
      assert(file.endsWith('.ts'));
      const out = resolve(root, file.replace('/src/', '/dist/').replace(/\.ts$/, '.js'));
      const js = readFileSync(out, 'utf8'),
        candidate = transpile(file, readFileSync(resolve(root, file), 'utf8'));
      assert(normalize(candidate) === normalize(js), `stale dist or compiler mismatch: ${file}`);
      const old = git('show', `${ref}:${file}`),
        url = pathToFileURL(out).href,
        baseline = transpile(file, old);
      replacements.set(url, baseline);
      if (mode === '--parent-only')
        isolated.set(
          url,
          file === 'Nelyx/src/framework/widgets/framework.ts'
            ? transpile(file, updatesOnly(old, readFileSync(resolve(root, file), 'utf8')))
            : baseline,
        );
      if (mode === '--cold-only' && !coldFiles.includes(file)) isolated.set(url, baseline);
    }
  }
  if (mode === '--diagnose-before') {
    const { profile } = await import('./calendar-midpoint-diagnostics.mjs');
    return profile(replacements);
  }
  const alternative = await loadGraph(replacements, flag);
  console.log('W7_VARIANT', mode, ref ?? '', replacements.size, 'modules');
  if (mode === '--trial-single-child') paired(exercise, alternative, ['forward', 'reverse']);
  else if (mode === '--parent-only' || mode === '--cold-only')
    paired(
      alternative,
      await loadGraph(isolated, flag + '-isolated'),
      mode === '--cold-only' ? ['cold'] : ['forward', 'reverse'],
    );
  else paired(alternative, exercise, mode === '--cold-before' ? ['cold'] : undefined);
}
