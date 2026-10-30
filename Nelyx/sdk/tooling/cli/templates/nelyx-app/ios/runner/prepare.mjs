// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { patchAppleRuntime } from '@nelyx/cli/apple-runtime';
const target = path.basename(path.dirname(import.meta.dirname));
const result = patchAppleRuntime({ target, runner: import.meta.dirname });
fs.mkdirSync(new URL('.nelyx/', import.meta.url), { recursive: true });
fs.writeFileSync(
  new URL('.nelyx/runtime-patch.json', import.meta.url),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(JSON.stringify(result));
