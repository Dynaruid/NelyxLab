"""Build the locked, Nelyx-owned CanvasKit binding on Linux (including WSL).

Preparation is explicit and isolated: no global emsdk activation or consumer install.
Run under a process-group timeout, e.g. timeout --kill-after=10s 1190s python3 ...
"""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tarfile

HERE = Path(__file__).resolve().parent
LOCK = json.loads((HERE / 'canvaskit.lock.json').read_text())


def sha(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def run(args, cwd, capture=False, env=None):
    result = subprocess.run(args, cwd=cwd, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None, env=env)
    return result.stdout.strip() if capture else None


def inside(root, relative):
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root) or candidate == root:
        raise ValueError('Path escapes the owned build root: ' + str(relative))
    return candidate


def fetch(root, entry):
    target = inside(root, entry['path'])
    target.mkdir(parents=True, exist_ok=True)
    if not (target / '.git').exists():
        if any(target.iterdir()):
            raise ValueError('Nonempty dependency without its own Git repository: ' + str(target))
        run(['git', 'init', '-q'], target)
        run(['git', 'remote', 'add', 'origin', entry['repository']], target)
    if Path(run(['git', 'rev-parse', '--show-toplevel'], target, True)).resolve() != target:
        raise ValueError('Dependency Git root mismatch')
    if run(['git', 'remote', 'get-url', 'origin'], target, True) != entry['repository']:
        raise ValueError('Dependency origin mismatch')
    if run(['git', 'status', '--porcelain', '--untracked-files=no'], target, True):
        raise ValueError('Dirty dependency retained: ' + str(target))
    if subprocess.run(['git', 'cat-file', '-e', entry['revision'] + '^{commit}'],
                      cwd=target, stderr=subprocess.DEVNULL).returncode:
        run(['git', 'fetch', '--depth=1', 'origin', entry['revision']], target)
    run(['git', 'checkout', '-q', '--detach', entry['revision']], target)
    print(json.dumps({'dependency': entry['path'], 'revision': entry['revision']}), flush=True)


def prepare(root, archive, dependency_inputs=None):
    if sha(archive) != LOCK['skia']['archiveSha256']:
        raise ValueError('Skia source archive hash mismatch')
    marker = root / 'nelyx-source.json'
    if marker.exists():
        if json.loads(marker.read_text()) != LOCK['skia']:
            raise ValueError('Existing source identity differs')
    else:
        if root.exists() and any(root.iterdir()):
            raise ValueError('Choose an empty source directory')
        root.mkdir(parents=True, exist_ok=True)
        prefix = LOCK['skia']['archivePrefix'] + '/'
        with tarfile.open(archive) as source:
            for member in source:
                if member.name == prefix[:-1]:
                    continue
                if not member.name.startswith(prefix):
                    raise ValueError('Unexpected source archive member: ' + member.name)
                relative = PurePosixPath(member.name[len(prefix):])
                target = inside(root, str(relative))
                if member.issym():
                    if Path(member.linkname).is_absolute():
                        raise ValueError('Absolute source archive symlink')
                    destination = (target.parent / member.linkname).resolve()
                    if not destination.is_relative_to(root):
                        raise ValueError('Source archive symlink escapes build root')
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.symlink_to(member.linkname)
                elif member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                elif member.isfile():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with source.extractfile(member) as incoming, target.open('wb') as outgoing:
                        shutil.copyfileobj(incoming, outgoing)
                    target.chmod(member.mode & 0o777)
                else:
                    raise ValueError('Unexpected source archive entry type')
        marker.write_text(json.dumps(LOCK['skia'], indent=2) + '\n')
    if sha(root / 'DEPS') != LOCK['skia']['depsSha256']:
        raise ValueError('DEPS identity differs')
    patch_file = HERE / 'canvaskit-paragraph.patch'
    if sha(patch_file) != LOCK['patch']['sha256']:
        raise ValueError('Binding patch identity differs')
    actual = {item['path']: sha(root / item['path']) for item in LOCK['patch']['files']}
    if all(actual[item['path']] == item['before'] for item in LOCK['patch']['files']):
        run(['patch', '-p1', '--batch', '--forward', '-i', str(patch_file)], root)
    if any(sha(root / item['path']) != item['after'] for item in LOCK['patch']['files']):
        raise ValueError('Unexpected binding source contents; no source was reset')
    pending = []
    for entry in LOCK['dependencies']:
        shared = (dependency_inputs / entry['path']).resolve() if dependency_inputs else None
        if shared and (shared / '.git').exists():
            # Read-only reuse of the exact Git inputs, never an old build/cache
            # copy. Each dependency still proves its remote, revision and dirt.
            if (Path(run(['git', 'rev-parse', '--show-toplevel'], shared, True)).resolve() != shared
                    or run(['git', 'remote', 'get-url', 'origin'], shared, True) != entry['repository']
                    or run(['git', 'rev-parse', 'HEAD'], shared, True) != entry['revision']
                    or run(['git', 'status', '--porcelain', '--untracked-files=no'], shared, True)):
                raise ValueError('Reusable dependency identity differs: ' + str(shared))
            target = root / entry['path']
            if target.is_symlink():
                if target.resolve() != shared:
                    raise ValueError('Reusable dependency link differs')
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                if target.exists():
                    if any(target.iterdir()):
                        raise ValueError('Nonempty dependency destination retained')
                    target.rmdir()
                target.symlink_to(shared, target_is_directory=True)
            print(json.dumps({'dependency': entry['path'], 'revision': entry['revision'], 'reused': True}), flush=True)
        else:
            pending.append(entry)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(fetch, root, entry) for entry in pending]
        for future in futures:
            future.result()
    emsdk = root / 'third_party/externals/emsdk'
    run([sys.executable, 'emsdk.py', 'install', LOCK['emsdkVersion']], emsdk)
    run([sys.executable, 'emsdk.py', 'activate', LOCK['emsdkVersion']], emsdk)
    (root / 'nelyx-prepared.json').write_text(json.dumps({
        'lockSha256': sha(HERE / 'canvaskit.lock.json'),
        'recipeSha256': sha(Path(__file__)), 'status': 'prepared',
    }, indent=2) + '\n')


def build(root, jobs):
    prepared = json.loads((root / 'nelyx-prepared.json').read_text())
    if prepared['lockSha256'] != sha(HERE / 'canvaskit.lock.json'):
        raise ValueError('Prepare the current locked source before building')
    for item in LOCK['patch']['files']:
        if sha(root / item['path']) != item['after']:
            raise ValueError('Patched source changed')
    output = inside(root, 'out/nelyx-canvaskit')
    env = {**os.environ, 'BUILD_DIR': str(output), 'NELYX_NINJA_JOBS': str(jobs)}
    # compile.sh's cleanup only targets *.a in this verified owned output directory.
    run(['bash', 'modules/canvaskit/compile.sh'], root, env=env)
    files = [{'id': name, 'path': name, 'sha256': sha(output / name)}
             for name in ['canvaskit.js', 'canvaskit.wasm']]
    manifest = {'schema': 'nelyx.canvaskit/v1', 'adapterAbi': 1,
                'version': 'm153-nelyx-paragraph.1', 'paragraphApiVersion': 1,
                'source': {'revision': LOCK['skia']['revision'],
                           'lockSha256': sha(HERE / 'canvaskit.lock.json'),
                           'patchSha256': LOCK['patch']['sha256']}, 'files': files}
    (output / 'native-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    shutil.copyfile(root / 'LICENSE', output / 'LICENSE_SKIA')
    receipt = {'schema': 'nelyx.canvaskit-build/v1', 'status': 'PASS-build',
               'runtime': 'notVerified', 'source': LOCK, 'manifest': manifest,
               'recipeSha256': sha(Path(__file__)),
               'gnSha256': sha(root / 'bin/gn'),
               'ninjaSha256': sha(root / 'third_party/ninja/ninja'),
               'argsGnSha256': sha(output / 'args.gn')}
    (output / 'nelyx-build.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps({'output': str(output), 'status': 'PASS-build', 'files': files}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=['prepare', 'build'])
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--jobs', type=int, default=4)
    parser.add_argument('--dependency-inputs', type=Path)
    arguments = parser.parse_args()
    if sys.platform != 'linux' or not 1 <= arguments.jobs <= 16:
        parser.error('Use Linux/WSL with 1..16 build jobs')
    build_root = arguments.root.resolve()
    if build_root == Path('/') or len(build_root.parts) < 3:
        parser.error('Select a dedicated nested build directory')
    if arguments.phase == 'prepare':
        if not arguments.archive:
            parser.error('prepare requires --archive')
        prepare(build_root, arguments.archive.resolve(), arguments.dependency_inputs.resolve() if arguments.dependency_inputs else None)
    else:
        build(build_root, arguments.jobs)
