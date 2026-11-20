// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { capture } from './commands.mjs';

function registryString(key, name) {
  try {
    const output = capture('reg.exe', ['query', key, '/v', name, '/reg:32']);
    return output.match(/\s+REG_(?:EXPAND_)?SZ[ \t]+([^\r\n]+)/)?.[1].trim();
  } catch {
    return undefined;
  }
}

export function inspectMsvc() {
  const programFiles = process.env['ProgramFiles(x86)'];
  const vswhere = path.join(programFiles, 'Microsoft Visual Studio/Installer/vswhere.exe');
  const installation = capture(vswhere, [
    '-utf8',
    '-latest',
    '-products',
    '*',
    '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property',
    'installationPath',
  ]).trim();
  const versionFile = path.join(
    installation,
    'VC/Auxiliary/Build/Microsoft.VCToolsVersion.default.txt',
  );
  if (!installation || !fs.existsSync(versionFile))
    throw new Error(
      `Install Visual Studio C++ x64 build tools and a Windows SDK (checked ${vswhere})`,
    );
  const toolset = fs.readFileSync(versionFile, 'utf8').trim();
  const compiler = path.join(installation, 'VC/Tools/MSVC', toolset, 'bin/Hostx64/x64/cl.exe');
  if (!fs.existsSync(compiler) || !fs.existsSync(path.join(path.dirname(compiler), 'link.exe')))
    throw new Error(`Visual Studio x64 compiler or linker missing: ${path.dirname(compiler)}`);

  const sdk =
    registryString('HKLM\\SOFTWARE\\Microsoft\\Windows Kits\\Installed Roots', 'KitsRoot10') ??
    path.join(programFiles, 'Windows Kits/10');
  const lib = path.join(sdk, 'Lib');
  const sdkVersion =
    fs.existsSync(lib) &&
    fs
      .readdirSync(lib)
      .filter((name) => /^10\.\d+\.\d+\.\d+$/.test(name))
      .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
      .find(
        (version) =>
          fs.existsSync(path.join(lib, version, 'um/x64/kernel32.lib')) &&
          fs.existsSync(path.join(lib, version, 'ucrt/x64/ucrt.lib')) &&
          fs.existsSync(path.join(sdk, 'Include', version, 'um/Windows.h')),
      );
  if (!sdkVersion)
    throw new Error(`Install the Windows SDK with x64 libraries and headers (checked ${sdk})`);
  return { installation, compiler, sdk, sdkVersion };
}

export function inspectWebView2() {
  const client = 'Software\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';
  const keys = [`HKLM\\${client}`, `HKCU\\${client}`];
  for (const registry of keys) {
    const version = registryString(registry, 'pv');
    if (/^\d+\.\d+\.\d+\.\d+$/.test(version) && /[1-9]/.test(version))
      return { version, registry, view: 32 };
  }
  throw new Error(
    `Install the WebView2 Evergreen Runtime (pv absent or zero in the 32-bit registry view of ${keys.join(' and ')}): https://developer.microsoft.com/microsoft-edge/webview2/`,
  );
}
