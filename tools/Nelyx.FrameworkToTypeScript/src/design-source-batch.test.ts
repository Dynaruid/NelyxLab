// SPDX-License-Identifier: BSD-3-Clause
import { expect, test } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeDesignSource } from './design-source-batch.ts';

test('regenerates owned sources and preserves an edited destination', () => {
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'nelyx-design-source-test-'));
  try {
    const target = {
      owner: 'material' as const,
      identity: 'test-origin',
      file: 'packages/material/src/generated/flutter-design/input/example.generated.ts',
    };
    const code = 'export const value = 1;\n';
    const updated = 'export const value = 2;\n';
    const file = path.join(root, target.file);
    expect(writeDesignSource(target, code, 'check', root).status).toBe('missing-source');
    expect(writeDesignSource(target, code, 'write', root).status).toBe('written-source');
    expect(writeDesignSource(target, code, 'check', root).status).toBe('unchanged-source');
    expect(writeDesignSource(target, updated, 'check', root).status).toBe('different-source');
    expect(writeDesignSource(target, updated, 'write', root).status).toBe('regenerated-source');
    fs.appendFileSync(file, '// Local edit.\n');
    const edited = fs.readFileSync(file, 'utf8');
    expect(writeDesignSource(target, code, 'write', root).status).toBe('ownership-conflict');
    expect(fs.readFileSync(file, 'utf8')).toBe(edited);
    const sibling = {
      ...target,
      file: target.file.replace('example.generated', 'sibling.generated'),
    };
    expect(writeDesignSource(sibling, code, 'write', root).status).toBe('written-source');
    expect(writeDesignSource({ ...target, file: 'elsewhere.ts' }, code, 'write', root).status).toBe(
      'source-write-error',
    );
    expect(fs.existsSync(path.join(root, 'elsewhere.ts'))).toBe(false);
  } finally {
    if (path.dirname(root) === parent && fs.realpathSync(root) === root)
      fs.rmSync(root, { recursive: true, force: true });
  }
}, 1_200_000);
