// SPDX-License-Identifier: BSD-3-Clause
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
/** Keep the existing apply protocol, but construct through the independent
 * public constructor instead of the fixed-schema Source implementation. */
export function textStyleApplyReference() {
  const file = path.resolve(import.meta.dirname, '../src/framework/painting/text-style.ts');
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements.find(
    (node) => ts.isClassDeclaration(node) && node.name?.text === 'TextStyle',
  );
  const apply = declaration.members.find(
    (node) => ts.isMethodDeclaration(node) && node.name.getText(source) === 'apply',
  );
  const body = apply.body.getText(source);
  assert.equal(body.split('TextStyle.fromAppliedOptions(').length, 2);
  return `function referenceApply(o = {}) ${body.replace('TextStyle.fromAppliedOptions(', 'new TextStyle(')}`;
}
