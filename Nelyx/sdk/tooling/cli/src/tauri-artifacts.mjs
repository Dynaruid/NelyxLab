// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { capture } from './commands.mjs';
import { sha256 } from '@nelyx/tooling-contracts/node-files';

function windowsSignature(file) {
  const env = { ...process.env, NELYX_SIGNATURE_FILE: file };
  for (const key of Object.keys(env)) {
    if (key.toLowerCase() === 'psmodulepath') delete env[key];
  }
  const state = capture(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '(Get-AuthenticodeSignature -LiteralPath $env:NELYX_SIGNATURE_FILE).Status.ToString()',
    ],
    {
      env,
      timeout: 20_000,
    },
  ).trim();
  return { NotSigned: 'unsigned', Valid: 'signed' }[state] ?? state;
}

export function androidBuildTool(tools, name) {
  const buildTools = path.join(tools.sdk, 'build-tools');
  const windows = process.platform === 'win32';
  const choices = fs
    .readdirSync(buildTools)
    .sort((a, b) => b.localeCompare(a, 'en', { numeric: true }));
  for (const version of choices) {
    const dir = path.join(buildTools, version);
    const file = path.join(dir, windows && name !== 'apksigner' ? name + '.exe' : name);
    if (windows && name === 'apksigner') {
      const jar = path.join(dir, 'lib', 'apksigner.jar');
      if (fs.existsSync(jar)) return [path.join(tools.java, 'bin', 'java.exe'), '-jar', jar];
    } else if (fs.existsSync(file)) return [file];
  }
  throw new Error('Android SDK build-tools is missing ' + name);
}

function signing(kind, file, tools) {
  try {
    if (kind === 'exe' || kind === 'nsis') return windowsSignature(file);
    if (kind === 'apk') {
      const [cmd, ...args] = androidBuildTool(tools, 'apksigner');
      capture(cmd, [...args, 'verify', file], { timeout: 20_000 });
      return 'signed';
    }
    if (kind === 'aab') {
      const cmd = path.join(
        tools.java,
        'bin',
        'jarsigner' + (process.platform === 'win32' ? '.exe' : ''),
      );
      const signature = capture(cmd, ['-J-Duser.language=en', '-verify', file], {
        timeout: 30_000,
      });
      if (signature.includes('jar verified.')) return 'signed';
      if (signature.includes('jar is unsigned.')) return 'unsigned';
    }
    if (kind === 'app' || kind === 'dmg') return appleSignature(file);
  } catch (error) {
    if (/code object is not signed|no signatures/i.test(error.message)) return 'unsigned';
  }
  return 'unverified';
}

export function appleSignature(file) {
  try {
    capture('codesign', ['--verify', '--strict', file], { timeout: 30_000 });
    return 'signed';
  } catch (error) {
    return /code object is not signed|no signatures/i.test(error.message)
      ? 'unsigned'
      : 'unverified';
  }
}

export function validateExecutable(file, platform) {
  const fd = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(64);
    if (fs.readSync(fd, header, 0, 64, 0) !== 64)
      throw new Error('Incomplete Tauri executable: ' + file);
    if (platform === 'linux' && header.subarray(0, 4).toString('hex') === '7f454c46') return;
    if (platform === 'windows' && header.toString('ascii', 0, 2) === 'MZ') {
      const pe = Buffer.alloc(26);
      if (
        fs.readSync(fd, pe, 0, pe.length, header.readUInt32LE(60)) === pe.length &&
        pe.readUInt32LE(0) === 0x4550 &&
        pe.readUInt16LE(4) === 0x8664 &&
        (pe.readUInt16LE(22) & 0x2002) === 0x0002 &&
        pe.readUInt16LE(24) === 0x20b
      )
        return;
    }
    throw new Error('Unexpected Tauri executable format: ' + file);
  } finally {
    fs.closeSync(fd);
  }
}

export function reportedArtifacts(lines, root, extension, required = true) {
  const found = new Set();
  for (const line of lines) {
    const value = line
      .replace(/^.*?(?:Bundling .*? \(|Built application at:\s+)/, '')
      .replace(/\s+\([\d.]+ (?:B|KiB|MiB|GiB)\)$/, '')
      .replace(/\)$/, '')
      .trim();
    if (!path.isAbsolute(value) || !value.toLowerCase().endsWith(extension)) continue;
    const file = path.resolve(value);
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.existsSync(file)) continue;
    const stat = fs.lstatSync(file);
    if (stat.isSymbolicLink() || (extension === '.app' ? !stat.isDirectory() : !stat.isFile()))
      continue;
    found.add(file);
  }
  if (found.size > 1 || (required && !found.size))
    throw new Error(
      `Expected one ${extension} from Tauri in ${root}. Found: ${[...found].join(', ') || 'none'}`,
    );
  return [...found][0];
}

export function stageArtifact(stage, source, format, tools) {
  const leaf =
    format === 'exe'
      ? 'nelyx-tauri.exe'
      : format === 'binary'
        ? 'nelyx-tauri'
        : path.basename(source);
  const file = path.join(stage, leaf);
  const stat = fs.lstatSync(source);
  if (stat.isDirectory()) {
    fs.cpSync(source, file, { recursive: true, verbatimSymlinks: true, errorOnExist: true });
  } else {
    fs.copyFileSync(source, file, fs.constants.COPYFILE_EXCL);
    if (process.platform !== 'win32') fs.chmodSync(file, stat.mode);
  }
  return {
    format,
    file: leaf,
    signature: signing(format, file, tools),
    ...(stat.isFile() ? { bytes: stat.size, sha256: sha256(file) } : {}),
  };
}
