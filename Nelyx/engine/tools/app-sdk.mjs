// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { windowsCompilerEnvironment } from '../../sdk/tooling/cli/src/windows-static-hermes.mjs';

export const windowsAppSdkVersion = '1.8.260508005';
export function buildAppSdkHost({ engineRoot, library, intermediate, output }) {
  const env = windowsCompilerEnvironment();
  const msbuild = path.join(env.VSINSTALLDIR, 'MSBuild/Current/Bin/MSBuild.exe');
  fs.mkdirSync(intermediate, { recursive: true });
  const args = [
    path.join(engineRoot, 'platform/windows/app-sdk/NelyxEngineAppSdkHost.vcxproj'),
    '/restore',
    '/m:2',
    '/nologo',
    '/verbosity:minimal',
    '/p:Configuration=Release',
    '/p:Platform=x64',
    '/p:BaseIntermediateOutputPath=' + intermediate + path.sep,
    '/p:MSBuildProjectExtensionsPath=' + intermediate + path.sep,
    '/p:NelyxAppSdkIntermediate=' + intermediate,
    '/p:NelyxAppSdkOutput=' + output,
    '/p:NelyxEngineLibrary=' + library,
    '/p:NelyxSkiaSupplier=' + path.resolve(engineRoot, '../skia/vendor/inputs/windows-x64'),
    '/p:NelyxHermesRoot=' + path.resolve(engineRoot, '../../.nelyx/windows-hermes'),
  ];
  const result = spawnSync(msbuild, args, {
    env,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 1_200_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    throw Error(
      'Windows App SDK executable build failed: ' +
        (result.error ?? result.status) +
        '\n' +
        result.stdout +
        result.stderr,
    );
  const assets = JSON.parse(
    fs.readFileSync(path.join(intermediate, 'project.assets.json'), 'utf8'),
  );
  const packages = Object.entries(assets.libraries)
    .filter(([, value]) => value.type === 'package')
    .map(([id, value]) => {
      const packageRoot = Object.keys(assets.packageFolders)
        .map((folder) => path.join(folder, value.path))
        .find((folder) => fs.existsSync(folder));
      if (!packageRoot) throw Error('Restored App SDK package is unavailable: ' + id);
      const nupkg = fs.readdirSync(packageRoot).find((file) => file.endsWith('.nupkg'));
      const metadata = JSON.parse(
        fs.readFileSync(path.join(packageRoot, '.nupkg.metadata'), 'utf8'),
      );
      const archiveSha512 =
        nupkg &&
        createHash('sha512')
          .update(fs.readFileSync(path.join(packageRoot, nupkg)))
          .digest('base64');
      if (
        !nupkg ||
        fs.readFileSync(path.join(packageRoot, nupkg + '.sha512'), 'utf8').trim() !==
          archiveSha512 ||
        metadata.contentHash !== value.sha512.replace(/^sha512-/, '')
      )
        throw Error('App SDK NuGet package integrity differs: ' + id);
      const destination = path.join(output, 'licenses', id.replaceAll('/', '-'));
      fs.mkdirSync(destination, { recursive: true });
      for (const file of fs
        .readdirSync(packageRoot)
        .filter((name) => /^(license|notice)(\.|$)/i.test(name)))
        fs.copyFileSync(path.join(packageRoot, file), path.join(destination, file));
      return { package: id, sha512: value.sha512, archiveSha512 };
    });
  const pin = JSON.parse(
    fs.readFileSync(path.join(engineRoot, 'platform/windows/app-sdk/supply.json'), 'utf8'),
  );
  if (
    pin.version !== windowsAppSdkVersion ||
    JSON.stringify(packages) !== JSON.stringify(pin.packages)
  )
    throw Error('App SDK dependency graph differs from the pinned package supply');
  if (
    !fs.existsSync(path.join(output, 'NelyxEngineAppSdkHost.exe')) ||
    !fs.existsSync(path.join(output, 'Microsoft.UI.Windowing.dll'))
  )
    throw Error('App SDK self-contained output lacks executable/windowing runtime');
  fs.copyFileSync(
    path.resolve(engineRoot, '../../.nelyx/windows-hermes/build/lib/hermesvm.dll'),
    path.join(output, 'hermesvm.dll'),
  );
  fs.copyFileSync(
    path.resolve(engineRoot, '../licenses/FlutterEngine-LICENSE.md'),
    path.join(output, 'licenses/FlutterEngine-LICENSE.md'),
  );
  const crtParent = path.join(env.VCTOOLSREDISTDIR, 'x64');
  const crt = fs.readdirSync(crtParent).find((file) => /^Microsoft\.VC\d+\.CRT$/.test(file));
  if (!crt) throw Error('App-local MSVC CRT supply is unavailable');
  for (const file of fs
    .readdirSync(path.join(crtParent, crt))
    .filter((name) => name.endsWith('.dll')))
    fs.copyFileSync(path.join(crtParent, crt, file), path.join(output, file));
  for (const file of fs
    .readdirSync(output)
    .filter((name) => /\.(?:pdb|ilk|exp|lib|pri)$/i.test(name)))
    if (!file.endsWith('.pri')) fs.unlinkSync(path.join(output, file));
  return {
    host: 'windows-app-sdk',
    version: windowsAppSdkVersion,
    deployment: 'unpackaged-self-contained',
    os: 'windows',
    architecture: 'x64',
    crt: 'MD',
    compiler: env.VCTOOLSVERSION,
    windowsSdk: env.WINDOWSSDKVERSION,
    packages,
  };
}
