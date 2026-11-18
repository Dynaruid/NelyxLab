// SPDX-License-Identifier: BSD-3-Clause
import { mkdtemp, copyFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execute } from '../sdk/tooling/cli/src/commands.mjs';

const cwd = await mkdtemp(resolve(import.meta.dirname, '../../.w7-flutter-'));
const tests = ['flutter-calendar-midpoint_test.dart', 'flutter-parent-update-order_test.dart'];
const flutter = (args) =>
  process.platform === 'win32'
    ? execute(process.env.ComSpec, ['/d', '/c', 'flutter.bat', ...args], {
        cwd,
        timeout: 1_200_000,
      })
    : execute('flutter', args, { cwd, timeout: 1_200_000 });
try {
  await writeFile(
    join(cwd, 'pubspec.yaml'),
    "name: w7_calendar_oracle\nenvironment:\n  sdk: '>=3.5.0 <4.0.0'\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n  flutter:\n    sdk: flutter\n",
  );
  await Promise.all(
    tests.map((file) => copyFile(join(import.meta.dirname, file), join(cwd, file))),
  );
  await flutter(['pub', 'get', '--offline']);
  await flutter([
    'test',
    '--no-pub',
    '--timeout',
    '20m',
    '--concurrency=1',
    '--reporter',
    'expanded',
    ...tests,
  ]);
} finally {
  await rm(cwd, { recursive: true, force: true, maxRetries: 3 });
}
