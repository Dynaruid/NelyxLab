"""Acquire locked SDK inputs. Never compile vendors or download from a runtime import."""
import argparse
import contextlib
import hashlib
import json
import os
import pathlib
import shutil
import tarfile
import tempfile
import time
import urllib.request
import uuid

SKIA = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_LOCK = SKIA / 'vendor/artifacts.lock.json'
DEFAULT_CACHE = SKIA.parents[0] / '.cache/skia-artifacts'


def digest(file):
    value = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            value.update(block)
    return value.hexdigest()


def safe_relative(value):
    path = pathlib.PurePosixPath(value)
    if not value or not path.parts or '\\' in value or ':' in value or path.is_absolute() or '..' in path.parts:
        raise ValueError(f'Unsafe artifact path: {value}')
    return path


def tree_identity(directory):
    entries = {}
    for file in sorted(directory.rglob('*')):
        if file.is_symlink():
            raise ValueError('SDK symlink rejected')
        if file.is_file():
            entries[file.relative_to(directory).as_posix()] = digest(file)
    content = ''.join(f'{name}\0{value}\n' for name, value in sorted(entries.items()))
    return hashlib.sha256(content.encode()).hexdigest(), entries


def selected_name(member, artifact):
    path = safe_relative(member.name)
    prefix = pathlib.PurePosixPath(artifact['stripPrefix'])
    if not path.is_relative_to(prefix) or path == prefix:
        return None
    relative = path.relative_to(prefix).as_posix()
    if not any(relative == item or relative.startswith(item + '/') for item in artifact['include']):
        return None
    suffixes = artifact.get('suffixes')
    if suffixes and not relative.endswith(tuple(suffixes)) and relative not in artifact.get('literalFiles', []):
        return None
    return relative


def extract(archive, output, artifact):
    # Read only selected regular SDK files; never extract links or archive paths verbatim.
    seen = set()
    total = 0
    with tarfile.open(archive, 'r:gz') as package:
        for member in package:
            safe_relative(member.name)
            name = selected_name(member, artifact)
            if name is None or member.isdir():
                continue
            if not member.isfile():
                raise ValueError(f'Non-regular artifact member: {member.name}')
            if name.casefold() in seen:
                raise ValueError(f'Duplicate artifact member: {name}')
            seen.add(name.casefold())
            total += member.size
            if member.size < 0 or total > artifact['maxExtractedBytes']:
                raise ValueError('Artifact extraction byte budget exceeded')
            destination = output / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            with package.extractfile(member) as source, destination.open('xb') as target:
                shutil.copyfileobj(source, target)
    identity, entries = tree_identity(output)
    if identity != artifact['treeSha256']:
        raise ValueError('Extracted SDK inventory hash mismatch')
    for name, expected in artifact['requiredFiles'].items():
        if entries.get(name) != expected:
            raise ValueError(f'Extracted SDK file hash mismatch: {name}')


@contextlib.contextmanager
def exclusive(file):
    deadline = time.monotonic() + 120
    while True:
        try:
            descriptor = os.open(file, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            break
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise TimeoutError(f'Artifact acquisition lock busy: {file}. Check its owner before removing a stale lock.')
            time.sleep(0.1)
    try:
        os.write(descriptor, str(os.getpid()).encode())
        yield
    finally:
        os.close(descriptor)
        file.unlink()


def acquire(artifact, cache, offline=False):
    target = cache / safe_relative(artifact['id'])
    target.mkdir(parents=True, exist_ok=True)
    archive = target / 'archive.tar.gz'
    output = target / 'sdk'
    with exclusive(target / 'acquire.lock'):
        if archive.exists():
            if archive.is_symlink() or digest(archive) != artifact['archiveSha256']:
                raise ValueError(f'Cached archive hash mismatch: {artifact["id"]}')
        elif offline:
            raise FileNotFoundError(f'Offline artifact missing: {artifact["id"]}')
        else:
            temporary = target / ('download-' + uuid.uuid4().hex + '.tmp')
            try:
                with urllib.request.urlopen(artifact['url'], timeout=120) as source, temporary.open('xb') as stream:
                    total = 0
                    for block in iter(lambda: source.read(1024 * 1024), b''):
                        total += len(block)
                        if total > artifact['maxArchiveBytes']:
                            raise ValueError('Artifact download byte budget exceeded')
                        stream.write(block)
                if digest(temporary) != artifact['archiveSha256']:
                    raise ValueError(f'Downloaded archive hash mismatch: {artifact["id"]}')
                temporary.replace(archive)
            finally:
                temporary.unlink(missing_ok=True)
        if output.exists():
            if output.is_symlink() or tree_identity(output)[0] != artifact['treeSha256']:
                raise ValueError(f'Cached extracted SDK hash mismatch: {artifact["id"]}')
        else:
            staging = pathlib.Path(tempfile.mkdtemp(prefix='extract-', dir=target))
            try:
                extract(archive, staging, artifact)
                staging.replace(output)
            finally:
                if staging.exists():
                    if not staging.resolve().is_relative_to(target.resolve()):
                        raise ValueError('SDK staging cleanup outside acquisition directory')
                    shutil.rmtree(staging)
    return output


def load_lock(file):
    lock = json.loads(file.read_text(encoding='utf-8'))
    if lock.get('schema') != 'nelyx.skia-artifacts/v1':
        raise ValueError('Unsupported artifact lock schema')
    ids = set()
    for artifact in lock['artifacts']:
        safe_relative(artifact['id'])
        safe_relative(artifact['stripPrefix'])
        if artifact['id'] in ids:
            raise ValueError('Duplicate artifact identity')
        ids.add(artifact['id'])
        for field in ['archiveSha256', 'treeSha256']:
            value = artifact[field]
            if len(value) != 64 or any(c not in '0123456789abcdef' for c in value):
                raise ValueError('Invalid artifact SHA256')
        if not artifact['url'].startswith('https://'):
            raise ValueError('Artifact URL must use HTTPS')
        for name in [*artifact['include'], *artifact['requiredFiles']]:
            safe_relative(name)
    return lock


def prepare(lock_file, cache, profile=None, artifact_id=None, offline=False):
    lock = load_lock(lock_file)
    artifacts = {entry['id']: entry for entry in lock['artifacts']}
    if artifact_id:
        if artifact_id not in artifacts:
            raise ValueError(f'Unsupported SDK artifact: {artifact_id}')
        return {'artifact': artifact_id, 'sdk': str(acquire(artifacts[artifact_id], cache, offline))}
    if profile not in lock['profiles']:
        raise ValueError(f'Unsupported SDK profile: {profile}')
    selected = lock['profiles'][profile]
    inputs = {name: acquire(artifacts[identity], cache, offline) for name, identity in selected['inputs'].items()}
    recipe = cache / 'profiles' / profile
    recipe.mkdir(parents=True, exist_ok=True)
    header = inputs['headers']
    binary = inputs['binaries']
    rows = ['# Generated from hash-verified SDK inputs; no vendor source build.',
            f'set(NELYX_SKIA_HEADERS "{header.as_posix()}")',
            f'set(NELYX_SKIA_SDK_PROFILE "{profile}")',
            f'set(NELYX_SKIA_SDK_RENDERER "{selected["renderer"]}")',
            f'set(NELYX_SKIA_SDK_GPU "{selected["gpuBackend"]}")']
    for name, directory in inputs.items():
        rows.append(f'set(NELYX_SKIA_INPUT_{name.upper()} "{directory.as_posix()}")')
    for name in selected['libraries']:
        entry = selected['libraries'][name]
        relative = entry if isinstance(entry, str) else entry['path']
        input_id = 'binaries' if isinstance(entry, str) else entry['input']
        expected = artifacts[selected['inputs'][input_id]]['requiredFiles'][relative]
        file = inputs[input_id] / relative
        rows.extend([f'file(SHA256 "{file.as_posix()}" NELYX_CHECK_HASH)',
                     f'if(NOT NELYX_CHECK_HASH STREQUAL "{expected}")',
                     f'  message(FATAL_ERROR "Locked Skia library hash mismatch: {name}")', 'endif()',
                     f'add_library(nelyx_vendor_{name} STATIC IMPORTED GLOBAL)',
                     f'set_target_properties(nelyx_vendor_{name} PROPERTIES IMPORTED_LOCATION "{file.as_posix()}" INTERFACE_INCLUDE_DIRECTORIES "{header.as_posix()}")'])
    rows.append('set(NELYX_SKIA_VENDOR_LIBRARIES ' + ' '.join('nelyx_vendor_' + name for name in selected['libraries']) + ')')
    content = '\n'.join(rows) + '\n'
    with exclusive(recipe / 'generate.lock'):
        temporary = recipe / 'sdk.cmake.tmp'
        temporary.write_text(content, encoding='utf-8')
        temporary.replace(recipe / 'sdk.cmake')
    return {'profile': profile, 'sdkCmake': str(recipe / 'sdk.cmake'), 'inputs': {name: str(file) for name, file in inputs.items()},
            'lockSha256': digest(lock_file), 'qualification': 'verified SDK input bytes; runtime and binding qualification separate'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lock', type=pathlib.Path, default=DEFAULT_LOCK)
    parser.add_argument('--cache', type=pathlib.Path, default=DEFAULT_CACHE)
    parser.add_argument('--profile')
    parser.add_argument('--artifact')
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    if bool(args.profile) == bool(args.artifact):
        parser.error('Select exactly one --profile or --artifact')
    print(json.dumps(prepare(args.lock.resolve(), args.cache.resolve(), args.profile, args.artifact, args.offline)))


if __name__ == '__main__':
    main()
