// SPDX-License-Identifier: BSD-3-Clause
import { prepareFrontend } from './web-runner.mjs';

export async function configureRunner({ app, target = 'web' }) {
  if (!['web', 'tauri'].includes(target)) throw new Error('Select web or tauri');
  return prepareFrontend(app, target);
}
