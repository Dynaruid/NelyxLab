// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
export const compilerProvenancePolicy = 'nelyx.sh-class-ranges/v1';
/** Preserve source ranges already owned by the compiler's class lowering.
 * No runtime representation, optimizer pass or source semantics change. */
export function patchStaticHermesCompiler(source) {
  const files = [
    'lib/IRGen/ESTreeIRGen-legacy-class.cpp',
    'lib/IRGen/ESTreeIRGen-func.cpp',
    'lib/BCGen/SH/SH.cpp',
  ];
  for (const relative of files) {
    const file = path.join(source, relative),
      original = fs.readFileSync(file, 'utf8');
    let text = original.replaceAll('\r\n', '\n');
    if (relative.endsWith('SH.cpp')) {
      const marker = '  // Nelyx SH native source range v1\n';
      if (!text.includes(marker)) {
        const anchor = '  OS << "// ";\n  srcMgr.dumpCoords(OS, F.getSourceRange().Start);';
        if (text.split(anchor).length !== 2) throw Error('Pinned SH C source range anchor changed');
        text = text.replace(
          anchor,
          marker +
            '  OS << "// Nelyx SH range: ";\n  srcMgr.dumpCoords(OS, F.getSourceRange().Start);\n  OS << " ... ";\n  srcMgr.dumpCoords(OS, F.getSourceRange().End);\n  OS << \'\\n\';\n' +
            anchor,
        );
      }
    } else {
      const insert = (name, range) => {
        const marker = '  // Nelyx class initializer range v1: ' + name + '\n';
        if (text.includes(marker)) return;
        const start = text.indexOf(
          '  auto ' +
            (name === 'typed-instance'
              ? 'initFunc = llvh::cast<Function>'
              : '*' +
                (name === 'instance'
                  ? 'initFunc'
                  : name === 'static'
                    ? 'staticElementsFunc'
                    : 'staticBlockFunc')) +
            ' = Builder.createFunction(',
        );
        // Typed createFunction has a surrounding cast, so locate by function body instead.
        const typedStart =
          name === 'typed-instance'
            ? text.indexOf('  auto initFunc = llvh::cast<Function>(Builder.createFunction(')
            : start;
        if (typedStart < 0) throw Error('Pinned class initializer anchor changed: ' + name);
        const end = text.indexOf('true /*strictMode*/)', typedStart);
        if (end < 0 || end - typedStart > 550)
          throw Error('Pinned class initializer declaration changed: ' + name);
        text =
          text.slice(0, typedStart) +
          marker +
          text.slice(typedStart, end) +
          `true /*strictMode*/, CustomDirectives{}, ${range})` +
          text.slice(end + 'true /*strictMode*/)'.length);
      };
      if (relative.endsWith('legacy-class.cpp')) {
        insert('static', 'legacyClassNode->getSourceRange()');
        insert('instance', 'legacyClassNode->getSourceRange()');
        insert('block', 'SB->getSourceRange()');
      } else insert('typed-instance', 'classNode->getSourceRange()');
    }
    if (text !== original) fs.writeFileSync(file, text);
  }
  return files;
}
