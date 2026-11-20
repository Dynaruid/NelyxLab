// SPDX-License-Identifier: BSD-3-Clause
import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

function killWindowsTree(child) {
  const result = spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
    windowsHide: true,
    stdio: 'ignore',
    timeout: 10_000,
  });
  if (result.status !== 0) child.kill();
}

/** Own the complete child lifetime. Never settle an observation timeout as completion. */
export function execute(
  command,
  args,
  { cwd, timeout = 1800000, env, signal: abortSignal, isolateWindows = false } = {},
) {
  abortSignal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      detached: process.platform !== 'win32' || isolateWindows,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child.stdout.pipe(process.stderr, { end: false });
    child.stderr.pipe(process.stderr, { end: false });
    let expired = false,
      interrupted = false,
      force,
      output = '';
    const observe = (chunk) => {
      output = (output + chunk.toString()).slice(-65536);
    };
    child.stdout.on('data', observe);
    child.stderr.on('data', observe);
    const signal = (name) => {
      try {
        process.kill(-child.pid, name);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    };
    const kill = () => {
      if (!child.pid) return;
      if (process.platform === 'win32') killWindowsTree(child);
      else signal('SIGKILL');
    };
    const stop = () => {
      if (interrupted) return;
      interrupted = true;
      if (process.platform === 'win32') kill();
      else {
        signal('SIGTERM');
        force = setTimeout(kill, 10000);
      }
    };
    const timer = setTimeout(() => {
      expired = true;
      kill();
    }, timeout);
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    abortSignal?.addEventListener('abort', stop, { once: true });
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(force);
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
      abortSignal?.removeEventListener('abort', stop);
    };
    child.once('error', (error) => {
      cleanup();
      reject(error);
    });
    child.once('close', (code, signal) => {
      cleanup();
      if (code === 0 && !expired && !interrupted) resolve({ exitCode: 0 });
      else {
        const error = new Error(
          expired
            ? 'Runner command timed out'
            : interrupted
              ? 'Runner command interrupted'
              : `Runner command exited ${code ?? signal}`,
        );
        error.output = output;
        reject(error);
      }
    });
  });
}
/** Long lived runner process with an explicit awaited stop. */
export function startOwnedCommand(
  command,
  args,
  { cwd, env, onStderrLine, signal: abortSignal, isolateWindows = false, windowsHide = true } = {},
) {
  abortSignal?.throwIfAborted();
  const child = spawn(command, args, {
    cwd,
    env,
    detached: process.platform !== 'win32' || isolateWindows,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide,
  });
  child.stdout.pipe(process.stderr, { end: false });
  child.stderr.pipe(process.stderr, { end: false });
  if (onStderrLine)
    createInterface({ input: child.stderr, crlfDelay: Infinity }).on('line', onStderrLine);
  let ended = false,
    stopping,
    spawnError;
  const completed = new Promise((resolve) => {
    child.once('error', (error) => {
      spawnError = error;
    });
    child.once('close', (exitCode, signal) => {
      ended = true;
      abortSignal?.removeEventListener('abort', abort);
      resolve({ exitCode, signal, error: spawnError ? String(spawnError) : null });
    });
  });
  function kill(signal) {
    if (ended || !child.pid) return;
    if (process.platform === 'win32') killWindowsTree(child);
    else
      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
  }
  function stop() {
    return (stopping ??= (async () => {
      kill('SIGTERM');
      const timer = setTimeout(() => kill('SIGKILL'), 10000);
      try {
        return await completed;
      } finally {
        clearTimeout(timer);
      }
    })());
  }
  const abort = () => void stop();
  abortSignal?.addEventListener('abort', abort, { once: true });
  return { pid: child.pid, completed, stop };
}
export function capture(command, args, { cwd, env, timeout = 60000 } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    timeout,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error(`${command} failed: ${result.error ?? result.stderr ?? result.status}`);
  return result.stdout;
}
