// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
export const compilerProvenancePolicy = 'nelyx.sh-class-ranges/v1';
export const compilerClassSpillPolicy = 'nelyx.hbc-class-spill/v1';
/** Preserve class source ranges and the HBC class opcode's output order.
 * The latter fixes spilling an unused home object over its constructor. */
export function patchStaticHermesCompiler(source, { upstreamClassSpill = false } = {}) {
  const files = [
    'lib/IRGen/ESTreeIRGen-legacy-class.cpp',
    'lib/IRGen/ESTreeIRGen-func.cpp',
    'lib/BCGen/SH/SH.cpp',
    'lib/BCGen/HBC/Passes.cpp',
  ];
  for (const relative of files) {
    const file = path.join(source, relative),
      original = fs.readFileSync(file, 'utf8');
    let text = original.replaceAll('\r\n', '\n');
    if (relative.endsWith('Passes.cpp')) {
      if (upstreamClassSpill) {
        const operands = text.indexOf('for (int i = 0, e = inst.getNumOperands();');
        const output = text.indexOf('if (replaceWithOutputSpill) {', operands);
        if (
          operands < 0 ||
          output < operands ||
          !text.includes('if (!replaceWithOutputSpill || store.first != &inst)') ||
          text.includes('replaceWithFirstSpill') ||
          text.includes('Nelyx HBC class spill output order')
        )
          throw Error('Pinned upstream Hermes class spill fix differs');
        // The stable release already fixes the output ordering. Do not patch it.
        continue;
      }
      const marker = '          // Nelyx HBC class spill output order v1\n';
      const loop = '          for (auto store : toSpill) {';
      const guard = '            if (!replaceWithFirstSpill)\n              continue;';
      const replacement =
        marker +
        '          // CreateClass writes its home object first and constructor last.\n' +
        '          // They may share a register when the home object is unused.\n' +
        '          // Spilling must preserve that order, including result users.\n' +
        '          const bool classResultLast =\n' +
        '              llvh::isa<CreateClassInst>(&inst) && replaceWithFirstSpill &&\n' +
        '              toSpill.size() > 1;\n' +
        '          for (size_t spill = 0; spill < toSpill.size(); ++spill) {\n' +
        '            auto store = toSpill[\n' +
        '                classResultLast ? (spill + 1) % toSpill.size() : spill];';
      const replacementGuard =
        '            if (!replaceWithFirstSpill || store.first != &inst)\n              continue;';
      if (!text.includes(marker)) {
        if (text.split(loop).length !== 2 || text.split(guard).length !== 2)
          throw Error('Pinned HBC class spill anchors changed');
        text = text.replace(loop, replacement).replace(guard, replacementGuard);
      } else if (!text.includes(replacement) || !text.includes(replacementGuard)) {
        throw Error('Pinned HBC class spill patch differs');
      }
    } else if (relative.endsWith('SH.cpp')) {
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
