// SPDX-License-Identifier: BSD-3-Clause
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyWindowsInputs } from '../../sdk/tooling/cli/src/native-inputs.mjs';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';
import { execute } from '../../sdk/tooling/cli/src/commands.mjs';
const timeout = 1_200_000,
  root = path.resolve(import.meta.dirname, '../../..');
test(
  'actual pinned Skia Path/paint generation preserves builder semantics and fractional draw/clip/shadow pixels',
  { timeout, skip: process.platform !== 'win32' },
  async () => {
    const app = path.join(root, 'sample/nelyx-testbed-app-2'),
      runner = path.join(app, 'windows/runner');
    const input = verifyWindowsInputs({
      runner,
      input: JSON.parse(
        fs.readFileSync(path.join(app, '.nelyx/windows/native-inputs.json'), 'utf8'),
      ).input,
    });
    const parent = fs.realpathSync(os.tmpdir()),
      directory = fs.mkdtempSync(path.join(parent, 'nelyx-scene-batch-'));
    try {
      const env = windowsCompilerEnvironment(),
        executable = path.join(directory, 'scene.exe');
      const system = [
        'd3d11',
        'dxgi',
        'dcomp',
        'dwmapi',
        'user32',
        'gdi32',
        'dwrite',
        'ole32',
        'oleaut32',
        'uuid',
        'usp10',
        'shlwapi',
        'shell32',
        'imm32',
        'comctl32',
        'runtimeobject',
        'advapi32',
        'bcrypt',
      ];
      await execute(
        'cl.exe',
        [
          '/nologo',
          '/std:c++20',
          '/O2',
          '/MD',
          '/EHsc',
          '/fp:strict',
          '/bigobj',
          '/utf-8',
          '/DSK_GRAPHITE',
          '/DNOMINMAX',
          '/DWIN32_LEAN_AND_MEAN',
          '/I' + path.join(root, 'Nelyx/skia/native/core'),
          '/I' + path.join(root, 'Nelyx/skia/native/rendering'),
          '/I' + path.join(input.root, input.manifest.headers),
          path.join(import.meta.dirname, 'scene-batch-native.cpp'),
          path.join(root, 'Nelyx/skia/native/core/scene_packet.cpp'),
          '/Fe' + executable,
          '/link',
          ...input.manifest.libraries.map((name) => path.join(input.root, name)),
          ...system.map((name) => name + '.lib'),
        ],
        { cwd: directory, env, timeout },
      );
      await execute(executable, [], { cwd: directory, env, timeout });
    } finally {
      assert.equal(path.dirname(fs.realpathSync(directory)), parent);
      assert(path.basename(directory).startsWith('nelyx-scene-batch-'));
      assert(!fs.lstatSync(directory).isSymbolicLink());
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  },
);
