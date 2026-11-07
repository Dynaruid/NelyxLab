// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { runSampleWindows } from '../../../Nelyx/eng/run-sample-windows.mjs';

const app = path.resolve(import.meta.dirname, '..');
await runSampleWindows({
  root: path.resolve(app, '../..'),
  app,
  arguments: process.argv.slice(2),
});
