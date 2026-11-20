// SPDX-License-Identifier: BSD-3-Clause
import { prepareWeb } from './web-runner.mjs';

export async function configureRunner({ app, target = 'web' }) {
  if (target !== 'web' && target !== 'pwa')
    throw new Error('Use nelyx prepare --platform for Tauri');
  return prepareWeb({ app });
}
