// SPDX-License-Identifier: BSD-3-Clause
// Keep template copying and SDK identity aligned with templates/.npmignore.
// IDEs may import template Gradle projects even when no app is being built.
const generated = new Set([
  '.gradle',
  '.kotlin',
  '.nelyx',
  '.cache',
  '.metro-cache',
  '.cxx',
  '.vs',
  'node_modules',
  'build',
  'dist',
  'x64',
  'obj',
  'bin',
  'DerivedData',
]);
export function isTemplateInput(relative) {
  return !relative.split(/[\\/]/).some((part) => generated.has(part) || part === '.npmignore');
}
