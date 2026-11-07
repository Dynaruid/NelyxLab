// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyWindowsInputs } from '../../../Nelyx/sdk/tooling/cli/src/native-inputs.mjs';

const app = path.resolve(import.meta.dirname, '..');
const root = path.resolve(app, '../..');

/** Reuse the repository's current supplier without duplicating its native libraries. */
export function prepareDemoWindowsInputs(input) {
  const source = path.resolve(
    input ?? path.join(root, '.nelyx/windows-rnw-native/supplier/inputs.json'),
  );
  if (!input && !fs.existsSync(source)) {
    console.log(
      'Build the Windows native supplier, then run node eng/windows-inputs.mjs <inputs.json> from this app.',
    );
    return;
  }
  const verified = verifyWindowsInputs({ runner: path.join(app, 'windows/runner'), input: source });
  const directory = path.join(app, '.nelyx/windows');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'native-inputs.json'),
    JSON.stringify(
      {
        schema: 'nelyx.rnw-prepared/v1',
        input: verified.input,
        sha256: verified.sha256,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ nativeInputs: verified.input, files: verified.files }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  prepareDemoWindowsInputs(process.argv[2]);
