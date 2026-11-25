// SPDX-License-Identifier: BSD-3-Clause
import path from 'node:path';
import { withPublicationLock } from '../sdk/tooling/cli/src/publication.mjs';

export const workspaceRoot = path.resolve(import.meta.dirname, '../..');
export const withSdkLock = (action) =>
  withPublicationLock(path.join(workspaceRoot, 'Nelyx', '.cache', 'sdk-publication'), action);
