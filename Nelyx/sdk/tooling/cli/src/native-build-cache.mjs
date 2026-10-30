// SPDX-License-Identifier: BSD-3-Clause
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
export const nativeBuildHash = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value))
    .digest('hex');
/** One mutable compiler cache, outside the delivered package. No input copies,
 * source/C/PDB files, old generations or validation histories are retained. */
export function openNativeBuildCache(directory) {
  directory = path.resolve(directory);
  fs.mkdirSync(directory, { recursive: true });
  if (fs.realpathSync(directory) !== directory || fs.lstatSync(directory).isSymbolicLink())
    throw Error('Native build cache must have a plain owned directory');
  const lock = directory + '.lock';
  if (fs.existsSync(lock)) {
    if (fs.lstatSync(lock).isSymbolicLink())
      throw Error('Native build cache lock symlink rejected');
    const owner = Number(fs.readFileSync(lock, 'utf8'));
    let alive = true;
    if (!Number.isSafeInteger(owner) || owner <= 0)
      throw Error('Native build cache lock is incomplete');
    try {
      process.kill(owner, 0);
    } catch (error) {
      if (error.code === 'ESRCH') alive = false;
      else throw error;
    }
    if (alive) throw Error('Native build cache is already in use by process ' + owner);
    fs.unlinkSync(lock);
  }
  const fd = fs.openSync(lock, 'wx');
  fs.writeFileSync(fd, String(process.pid));
  const file = (name) => {
    if (!/^(?:index\.json|nelyx_[a-z_]+\.obj)$/.test(name))
      throw Error('Invalid native build cache file');
    const target = path.join(directory, name),
      stat = fs.lstatSync(target, { throwIfNoEntry: false });
    if (stat && (!stat.isFile() || stat.isSymbolicLink()))
      throw Error('Native build cache requires regular files');
    return target;
  };
  return {
    directory,
    file,
    read() {
      const target = file('index.json');
      if (!fs.existsSync(target)) return null;
      try {
        const value = JSON.parse(fs.readFileSync(target, 'utf8')),
          record = value?.record;
        if (
          value?.schema !== 'nelyx.native-build-cache/v1' ||
          !record ||
          !Array.isArray(record.units) ||
          record.units.length > 32 ||
          record.units.some(
            (unit) =>
              !unit ||
              !/^nelyx_[a-z_]+$/.test(unit.name) ||
              !/^[a-f0-9]{64}$/.test(unit.key) ||
              !/^[a-f0-9]{64}$/.test(unit.objectSha256) ||
              unit.measurement?.unit !== unit.name,
          )
        )
          return null;
        return nativeBuildHash(record) === value.sha256 ? record : null;
      } catch (error) {
        if (error instanceof SyntaxError) return null;
        throw error;
      }
    },
    write(record, temporary) {
      const target = path.join(temporary, 'cache-index.json');
      fs.writeFileSync(
        target,
        JSON.stringify({
          schema: 'nelyx.native-build-cache/v1',
          sha256: nativeBuildHash(record),
          record,
        }),
      );
      fs.renameSync(target, file('index.json'));
      const keep = new Set(['index.json', ...record.units.map((unit) => unit.name + '.obj')]);
      for (const name of fs.readdirSync(directory)) {
        if (!keep.has(name)) fs.unlinkSync(file(name));
      }
    },
    close() {
      fs.closeSync(fd);
      fs.unlinkSync(lock);
    },
  };
}
