// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
export function prepareDevelopmentKey() {
  const key = path.resolve(import.meta.dirname, '../app/debug.keystore');
  if (fs.existsSync(key)) {
    const state = fs.lstatSync(key);
    if (!state.isFile() || state.isSymbolicLink())
      throw new Error('Development keystore must be an owned regular file');
    return;
  }
  const executable = process.env.JAVA_HOME
    ? path.join(
        process.env.JAVA_HOME,
        'bin',
        process.platform === 'win32' ? 'keytool.exe' : 'keytool',
      )
    : 'keytool';
  const child = spawnSync(
    executable,
    [
      '-genkeypair',
      '-keystore',
      key,
      '-storepass',
      'android',
      '-keypass',
      'android',
      '-alias',
      'androiddebugkey',
      '-keyalg',
      'RSA',
      '-keysize',
      '2048',
      '-validity',
      '3650',
      '-dname',
      'CN=Android Debug,O=Android,C=US',
    ],
    { stdio: 'inherit', windowsHide: true, timeout: 30000 },
  );
  if (child.error || child.status)
    throw new Error(
      'Development key generation requires the selected JDK: ' +
        String(child.error ?? child.status),
    );
}
