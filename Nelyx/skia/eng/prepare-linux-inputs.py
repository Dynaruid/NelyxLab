"""Export a relocatable Linux SDK and matching module source inputs for the CLI."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

SKIA = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--cache', type=Path, required=True)
parser.add_argument('--modules', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--offline', action='store_true')
args = parser.parse_args()
cache, modules, output = (p.resolve() for p in (args.cache, args.modules, args.output))
if output.exists():
    raise RuntimeError('Select a new supplier output directory')
prepared = json.loads(subprocess.check_output(['python', str(SKIA / 'eng/prepare-artifacts.py'),
    '--lock', str(SKIA / 'vendor/linux-graphite-probe.lock.json'), '--cache', str(cache),
    '--profile', 'linux-x64-graphite-text-probe', *(['--offline'] if args.offline else [])], text=True))
lock = json.loads((SKIA / 'vendor/linux-graphite-probe.lock.json').read_text())
profile = lock['profiles'][prepared['profile']]
libraries = []
for value in profile['libraries'].values():
    name = value if isinstance(value, str) else value['path']
    owner = 'binaries' if isinstance(value, str) else value['input']
    source = Path(prepared['inputs'][owner]) / name
    destination = output / 'vendor' / profile['inputs'][owner] / 'sdk' / name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, destination)
    libraries.append(destination.relative_to(output).as_posix())
headers = 'vendor/skia-m153-headers/sdk'
shutil.copytree(prepared['inputs']['headers'], output / headers)
for directory in ['source', 'libwebp']:
    shutil.copytree(modules / directory, output / 'modules' / directory)
shutil.copytree(SKIA / 'licenses', output / 'licenses')
sdk = Path(prepared['sdkCmake']).read_text()
for owner, directory in prepared['inputs'].items():
    sdk = sdk.replace(Path(directory).as_posix(), '${CMAKE_CURRENT_LIST_DIR}/vendor/' + profile['inputs'][owner] + '/sdk')
module = (modules / 'modules.cmake').read_text().replace(modules.as_posix(), '${CMAKE_CURRENT_LIST_DIR}/modules')
recipe = (SKIA / 'eng/source-build/rn-modules.cmake').as_posix()
module = module.replace(recipe, '${NELYX_RN_PACKAGE}/native/vulkan/sdk/eng/source-build/rn-modules.cmake')
(output / 'sdk.cmake').write_text(sdk, encoding='utf-8', newline='\n')
(output / 'modules.cmake').write_text(module, encoding='utf-8', newline='\n')
files = []
for file in sorted(output.rglob('*')):
    if file.is_symlink():
        raise RuntimeError('Supplier links are not supported')
    if file.is_file():
        files.append({'file': file.relative_to(output).as_posix(), 'bytes': file.stat().st_size,
            'sha256': hashlib.file_digest(file.open('rb'), 'sha256').hexdigest()})
manifest = {'schema': 'nelyx.linux-native-inputs/v1', 'architecture': 'x86_64',
    'profile': prepared['profile'], 'reactNative': '0.81.6',
    'rnlRevision': '9412cf605c7cc77f920916401926ff9a9873ecd3',
    'hermesRevision': 'e0fc67142ec0763c6b6153ca2bf96df815539782',
    'sdk': 'sdk.cmake', 'modules': 'modules.cmake', 'headers': headers,
    'libraries': libraries, 'files': files, 'qualification': 'notVerified'}
(output / 'inputs.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'input': str(output / 'inputs.json'), 'files': len(files)}))
