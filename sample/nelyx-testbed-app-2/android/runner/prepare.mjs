// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';import {configureRunner} from '@nelyx/cli/runner-configuration';
console.log(JSON.stringify(await configureRunner({app:path.resolve(import.meta.dirname,'../..'),target:'android'})));
