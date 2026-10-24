// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import {auditPackageBoundaries} from './package-boundaries.mjs';
const result = auditPackageBoundaries(path.resolve(import.meta.dirname, '../..'));
const output = process.argv.indexOf('--output');
if (output >= 0) fs.writeFileSync(process.argv[output + 1], JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({...result, dependencyGraph: {...result.dependencyGraph, cycles: result.dependencyGraph.cycles.length, designCycles: result.dependencyGraph.designCycles.length}}));
if (result.errors.length) process.exitCode = 1;
