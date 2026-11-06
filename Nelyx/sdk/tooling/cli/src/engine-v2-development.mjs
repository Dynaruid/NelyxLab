// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  buildEngineV2Application,
  verifyEngineV2Application,
  createEngineV2Server,
  engineV2WindowsHost,
} from './engine-v2-runner.mjs';

const within = (root, file) =>
  file === root ||
  (!path.relative(root, file).startsWith('..' + path.sep) &&
    path.relative(root, file) !== '..' &&
    !path.isAbsolute(path.relative(root, file)));

/** A reload replaces the complete host/session. It does not preserve application State. */
export async function createEngineV2Development(options) {
  const app = fs.realpathSync(options.app);
  const directory = path.resolve(app, options.output ?? `dist/v2-${options.target}`),
    parent = path.dirname(directory);
  let requested = 0,
    completed = 0,
    startupFailure,
    bundle,
    temporary;
  let receiveChange = () => ++requested,
    receiveError = (error) => {
      startupFailure = error;
    };
  const watcher = fs.watch(app, { recursive: true }, (_event, filename) => {
    if (!filename) {
      receiveChange();
      return;
    }
    const name = String(filename),
      file = path.resolve(app, name);
    if (
      !within(app, file) ||
      name.split(/[\\/]/).some((part) => ['.git', 'node_modules'].includes(part)) ||
      within(directory, file) ||
      within(file, directory) ||
      (within(parent, file) &&
        path.relative(parent, file).split(path.sep)[0].startsWith('.engine-v2-')) ||
      (bundle && within(bundle.supply.root, file))
    )
      return;
    receiveChange();
  });
  watcher.on('error', (error) => receiveError(error));
  try {
    for (;;) {
      if (startupFailure) throw startupFailure;
      const revision = requested;
      const initial = await buildEngineV2Application({
        ...options,
        canPublish: () => !startupFailure && requested === revision,
      });
      if (initial.obsolete) continue;
      completed = revision;
      break;
    }
    bundle = verifyEngineV2Application(
      directory,
      options.target,
      options.engineInputs && path.resolve(app, options.engineInputs),
    );
    temporary = fs.mkdtempSync(path.join(parent, '.engine-v2-development-'));
  } catch (error) {
    watcher.close();
    throw error;
  }
  const candidate = path.join(temporary, 'candidate'),
    previous = path.join(temporary, 'previous');
  let server,
    native,
    timer,
    building,
    closing,
    cancelDrain,
    previousBundle,
    phase = 'starting',
    generation = 1,
    lastError = null;
  let resolveClosed;
  const closed = new Promise((resolve) => (resolveClosed = resolve));
  const clients = new Map();
  const emit = (kind, value = {}) => {
    const event = { kind, generation, ...value };
    if (!options.quiet) {
      if (kind.endsWith('failed')) console.error('Engine v2 development: ' + value.message);
      else if (kind === 'published') console.log('Engine v2 development generation ' + generation);
    }
    options.onEvent?.(event);
    for (const { response, retired } of clients.values())
      if (
        !(retired && (kind === 'stopping' || kind === 'replacing')) &&
        !response.write('data: ' + JSON.stringify(event) + '\n\n')
      )
        response.destroy();
  };
  const removeOwned = (file) => {
    if (!fs.existsSync(file)) return;
    if (
      !within(temporary, path.resolve(file)) ||
      fs.lstatSync(file).isSymbolicLink() ||
      !within(fs.realpathSync(temporary), fs.realpathSync(file))
    )
      throw Error('Invalid development cleanup path');
    fs.rmSync(file, { recursive: true, force: true, maxRetries: 3 });
  };
  const drainWeb = async (kind = 'replacing') => {
    const active = [...clients.values()].filter((client) => !client.retired);
    if (!active.length) return;
    const ticket = randomUUID();
    const waits = active.map(
      (client) => new Promise((resolve, reject) => (client.pending = { ticket, resolve, reject })),
    );
    let deadline;
    try {
      const interrupted = new Promise((_resolve, reject) => {
        cancelDrain = reject;
        deadline = setTimeout(
          () => reject(Error('Web development generation drain timeout')),
          15000,
        );
      });
      emit(kind, { ticket });
      await Promise.race([Promise.all(waits), interrupted]);
    } finally {
      clearTimeout(deadline);
      cancelDrain = undefined;
      for (const client of clients.values())
        if (client.pending?.ticket === ticket) {
          client.pending.reject(Error('Generation drain ended'));
          client.pending = undefined;
        }
    }
  };
  const startNative = async () => {
    const child = spawn(
      path.join(bundle.supply.root, engineV2WindowsHost(bundle.manifest.windowsHost).executable),
      [bundle.supply.root, '--app', bundle.root, ...(options.arguments ?? [])],
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: false },
    );
    let resolveReady,
      rejectReady,
      partial = '',
      exited = false,
      spawnError;
    const ready = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const record = { child, stopping: false, exited: undefined };
    native = record;
    child.stdin.on('error', () => {});
    child.stdout.on('data', (bytes) => {
      if (!options.quiet) process.stdout.write(bytes);
      partial = (partial + bytes).slice(-65536);
      let end;
      while ((end = partial.indexOf('\n')) >= 0) {
        const line = partial.slice(0, end).trim();
        partial = partial.slice(end + 1);
        options.onHostLine?.(line);
        if (line.startsWith('V2_CLOSED ')) record.closed = JSON.parse(line.slice(10));
        if (line === 'V2_WINDOWS_DISPATCHER_CLOSED') record.dispatcherClosed = true;
        if (line.startsWith('V2_APP ')) {
          try {
            const value = JSON.parse(line.slice(7));
            if (value.kind === 'app-ready') {
              emit('native-ready', { pid: child.pid, receipt: value });
              resolveReady();
            }
            if (value.kind === 'app-error') rejectReady(Error(value.message));
          } catch (error) {
            rejectReady(error);
          }
        }
      }
    });
    child.stderr.on('data', (bytes) => {
      if (!options.quiet) process.stderr.write(bytes);
      options.onHostLine?.(String(bytes));
    });
    record.exited = new Promise((resolve) => {
      const done = (code, error) => {
        if (exited) return;
        exited = true;
        rejectReady(error ?? Error('Native development host exited before readiness'));
        resolve({ code: code ?? 1, error });
        if (!record.stopping && !closing)
          queueMicrotask(
            () =>
              void close(
                code === 0 ? undefined : (error ?? Error('Native development host exited ' + code)),
              ),
          );
      };
      child.once('error', (error) => {
        spawnError = error;
      });
      child.once('close', (code) => done(code, spawnError));
    });
    const deadline = setTimeout(
      () => rejectReady(Error('Native development startup timeout')),
      15000,
    );
    try {
      await ready;
    } finally {
      clearTimeout(deadline);
    }
  };
  const stopNative = async () => {
    if (!native) return;
    const record = native;
    native = undefined;
    record.stopping = true;
    if (record.child.exitCode === null) record.child.stdin.write('close\n');
    let forced = false;
    const deadline = setTimeout(() => {
      forced = true;
      record.child.kill();
    }, 10000);
    try {
      const result = await record.exited;
      if (
        forced ||
        result.code !== 0 ||
        record.closed?.status !== 0 ||
        record.closed?.memoryTotal !== 0 ||
        record.closed?.reservedBytes !== 0 ||
        !record.closed?.workersJoined ||
        (bundle.manifest.windowsHost === 'windows-app-sdk' && !record.dispatcherClosed)
      )
        throw (
          result.error ??
          Error(
            'Native development drain failed' +
              (forced
                ? ': deadline exceeded'
                : ': missing successful owner drain or exit ' + result.code),
          )
        );
      emit('native-drained', { pid: record.child.pid, closed: record.closed });
    } finally {
      clearTimeout(deadline);
    }
  };
  function close(error) {
    if (closing) return closing;
    phase = 'closing';
    if (error) lastError = String(error);
    watcher?.close();
    clearTimeout(timer);
    cancelDrain?.(Error('Development session is closing'));
    closing = (async () => {
      const errors = error ? [error] : [];
      if (building)
        try {
          await building;
        } catch (failure) {
          errors.push(failure);
        }
      try {
        await stopNative();
      } catch (failure) {
        errors.push(failure);
      }
      if (server)
        try {
          await drainWeb('stopping');
        } catch (failure) {
          errors.push(failure);
        }
      for (const { response } of clients.values()) response.end();
      clients.clear();
      if (server?.listening)
        await new Promise((resolve) => {
          server.close(resolve);
          server.closeAllConnections();
        });
      try {
        removeOwned(temporary);
      } catch (failure) {
        errors.push(failure);
      }
      phase = errors.length ? 'failed' : 'closed';
      if (errors.length) lastError = errors.map(String).join('\n');
      const result = {
        engine: 'v2',
        target: options.target,
        exitCode: errors.length ? 1 : 0,
        generation,
        errors: errors.map(String),
      };
      resolveClosed(result);
      return result;
    })();
    return closing;
  }
  const rebuild = async () => {
    while (!closing && completed < requested) {
      const revision = requested;
      phase = 'preparing';
      emit('build-started', { revision });
      try {
        const next = await buildEngineV2Application({
          ...options,
          output: candidate,
          canPublish: () => !closing && revision === requested,
        });
        completed = revision;
        if (next.obsolete || closing || revision !== requested) continue;
        verifyEngineV2Application(
          candidate,
          options.target,
          options.engineInputs && path.resolve(app, options.engineInputs),
        );
        phase = 'replacing';
        if (options.target === 'windows') await stopNative();
        else await drainWeb();
        if (closing) break;
        removeOwned(previous);
        previousBundle = { ...bundle, root: previous, generation };
        fs.renameSync(directory, previous);
        try {
          fs.renameSync(candidate, directory);
        } catch (error) {
          fs.renameSync(previous, directory);
          throw error;
        }
        if (options.target === 'windows') {
          removeOwned(previous);
          previousBundle = undefined;
        }
        bundle = verifyEngineV2Application(
          directory,
          options.target,
          options.engineInputs && path.resolve(app, options.engineInputs),
        );
        ++generation;
        lastError = null;
        if (options.target === 'windows') await startNative();
        phase = 'open';
        emit('published', { revision });
      } catch (error) {
        if (closing) break;
        completed = revision;
        lastError = String(error);
        if (phase === 'replacing') {
          emit('replacement-failed', { message: lastError });
          queueMicrotask(() => void close(error));
          break;
        }
        phase = 'open';
        emit('build-failed', { revision, message: lastError });
      }
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (building) return;
      building = Promise.resolve()
        .then(rebuild)
        .finally(() => {
          building = undefined;
          if (!closing && completed < requested) schedule();
        });
    }, 30);
  };
  const changed = () => {
    if (!closing) {
      ++requested;
      if (phase !== 'starting') schedule();
    }
  };
  receiveChange = changed;
  receiveError = (error) => void close(error);
  try {
    if (options.target === 'web') {
      if (!['127.0.0.1', 'localhost'].includes(options.host ?? '127.0.0.1'))
        throw Error('Engine v2 development server requires loopback');
      server = createEngineV2Server(() => bundle, {
        development: {
          get generation() {
            return generation;
          },
          bundleFor(value) {
            return value === generation
              ? bundle
              : value === previousBundle?.generation
                ? previousBundle
                : undefined;
          },
          connect(request, response) {
            if (clients.size >= 8 || closing) {
              response.writeHead(503);
              response.end();
              return;
            }
            response.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-store',
              Connection: 'keep-alive',
              'Cross-Origin-Resource-Policy': 'same-origin',
            });
            const id = randomUUID(),
              client = { response, pending: undefined };
            clients.set(id, client);
            response.on('close', () => {
              clients.delete(id);
              client.pending?.reject(
                Error('Web development client disconnected before drain acknowledgement'),
              );
            });
            request.on('error', () => response.destroy());
            response.write(
              'data: ' + JSON.stringify({ kind: 'connected', generation, client: id }) + '\n\n',
            );
          },
          acknowledge(request, response) {
            if (
              request.method !== 'POST' ||
              request.headers.origin !== 'http://' + request.headers.host
            ) {
              response.writeHead(403);
              response.end();
              return;
            }
            let text = '';
            request.on('data', (bytes) => {
              text += bytes;
              if (text.length > 512) request.destroy();
            });
            request.on('error', () => response.destroy());
            request.on('end', () => {
              try {
                const value = JSON.parse(text),
                  client = clients.get(value.client);
                if (!client?.pending || client.pending.ticket !== value.ticket)
                  throw Error('Expired development drain');
                const pending = client.pending;
                client.pending = undefined;
                client.retired = true;
                if (value.error) pending.reject(Error(String(value.error)));
                else pending.resolve();
                response.writeHead(204);
                response.end();
              } catch {
                response.writeHead(409);
                response.end();
              }
            });
          },
        },
      });
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(options.port ?? 8192, options.host ?? '127.0.0.1', resolve);
      });
      server.on('error', (error) => void close(error));
    } else await startNative();
    if (closing) {
      await closing;
      throw Error('Development session failed during startup: ' + lastError);
    }
    phase = 'open';
    emit('ready');
    if (completed < requested) schedule();
    return {
      close,
      closed,
      changed,
      get bundle() {
        return bundle;
      },
      get status() {
        return { phase, generation, requested, completed, lastError };
      },
      address: server?.address(),
    };
  } catch (error) {
    await close(error);
    throw error;
  }
}

export async function runEngineV2Development(options) {
  let session,
    interruptedBeforeReady = false;
  const interrupted = () => {
    interruptedBeforeReady = true;
    void session?.close();
  };
  process.on('SIGINT', interrupted);
  process.on('SIGTERM', interrupted);
  try {
    session = await createEngineV2Development(options);
    if (interruptedBeforeReady) void session.close();
    if (options.target === 'web')
      console.log(
        `Engine v2 development: http://${options.host ?? '127.0.0.1'}:${session.address.port}/isolated/ · /plain/`,
      );
    return await session.closed;
  } finally {
    process.removeListener('SIGINT', interrupted);
    process.removeListener('SIGTERM', interrupted);
    await session?.close();
  }
}
