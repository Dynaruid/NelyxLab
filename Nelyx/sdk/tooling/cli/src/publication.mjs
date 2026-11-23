// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export function ownedDirectory(directory) {
  const stat = fs.lstatSync(directory, { throwIfNoEntry: false });
  if (!stat || !stat.isDirectory() || path.relative(directory, fs.realpathSync(directory)) !== '')
    throw new Error('Expected an ordinary directory: ' + directory);
}

export function ensureDirectory(directory) {
  let parent = directory;
  while (!fs.lstatSync(parent, { throwIfNoEntry: false })) parent = path.dirname(parent);
  ownedDirectory(parent);
  fs.mkdirSync(directory, { recursive: true });
  ownedDirectory(directory);
  return directory;
}

export function removeDirectory(directory, parent) {
  if (path.dirname(directory) !== parent) throw new Error('Unexpected staging path: ' + directory);
  if (fs.lstatSync(directory, { throwIfNoEntry: false })) {
    ownedDirectory(directory);
    fs.rmSync(directory, { recursive: true, maxRetries: 5, retryDelay: 100 });
  }
}

export async function withPublicationLock(app, run) {
  const key = createHash('sha256')
    .update(process.platform === 'win32' ? app.toLowerCase() : app)
    .digest('hex')
    .slice(0, 32);
  const socketName = 'nelyx-publish-' + key;
  const handle =
    process.platform === 'win32'
      ? '\\\\.\\pipe\\' + socketName
      : process.platform === 'linux'
        ? '\0' + socketName
        : path.join('/tmp', socketName + '-' + (process.getuid?.() ?? os.userInfo().username));
  const server = net.createServer((connection) => connection.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(handle, resolve);
  }).catch((error) => {
    if (error.code === 'EADDRINUSE')
      throw new Error('Another Nelyx build or supply operation owns ' + app);
    throw error;
  });
  try {
    return await run();
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

export function publishDirectory(stage, destination) {
  const parent = path.dirname(destination);
  if (path.dirname(stage) !== parent)
    throw new Error('Publication staging must be beside its destination');
  ownedDirectory(stage);
  const previous = path.join(parent, '.previous-' + randomUUID());
  const exists = fs.lstatSync(destination, { throwIfNoEntry: false });
  try {
    if (exists) {
      ownedDirectory(destination);
      fs.renameSync(destination, previous);
    }
    try {
      if (exists && process.platform === 'win32') {
        // Windows can move a directory containing a running EXE, but cannot delete that EXE.
        // Check the original files after the move, before publishing or deleting any of them.
        for (const entry of fs.readdirSync(previous, { withFileTypes: true })) {
          if (entry.isFile() && /\.exe$/i.test(entry.name)) {
            fs.closeSync(fs.openSync(path.join(previous, entry.name), 'r+'));
          }
        }
      }
      fs.renameSync(stage, destination);
    } catch (error) {
      if (exists) fs.renameSync(previous, destination);
      throw error;
    }
  } catch (error) {
    throw new Error(
      'Could not publish ' + destination + '. Close any running copy and retry. ' + error.message,
      { cause: error },
    );
  }
  if (exists) removeDirectory(previous, parent);
}

export async function withSignals(run) {
  const controller = new AbortController();
  const signals = ['SIGINT', 'SIGTERM', ...(process.platform === 'win32' ? ['SIGBREAK'] : [])];
  const cancel = () =>
    controller.abort(Object.assign(new Error('Command interrupted'), { exitCode: 130 }));
  for (const signal of signals) process.on(signal, cancel);
  try {
    return await run(controller.signal);
  } finally {
    for (const signal of signals) process.off(signal, cancel);
  }
}
