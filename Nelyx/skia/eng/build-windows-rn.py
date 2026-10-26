"""Build the current RNW/JSI binding against explicitly pinned native supplier inputs."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess

SKIA = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--runner', type=Path, required=True)
parser.add_argument('--supplier', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--resume', action='store_true')
args = parser.parse_args()
runner, supplier, output = (value.resolve() for value in (args.runner, args.supplier, args.output))
if os.name != 'nt' or (output.exists() and not args.resume):
    raise RuntimeError('Windows and a new output, or --resume for an unfinished build, are required')

def sha(file):
    return hashlib.file_digest(file.open('rb'), 'sha256').hexdigest()

lock = json.loads((SKIA / 'vendor/windows-rn-supplier.lock.json').read_text())
def supplier_file(name):
    file = supplier / name
    if not file.exists() and 'nelyx_rn_module' in name:
        file = supplier / name.replace('nelyx_rn_module', 'ozeli_rn_module')
    return file
for record in lock['files']:
    file = supplier_file(record['file'])
    if file.stat().st_size != record['bytes'] or sha(file) != record['sha256']:
        raise RuntimeError('Pinned supplier changed: ' + record['file'])

rn = SKIA / 'packages/rn'
# Use the same complete source admission as package supply, including JSI and
# binding recipes. Compiling an older mirror cannot qualify current sources.
subprocess.run(['node', str(SKIA / 'eng/native-source-inputs.mjs'), str(rn)], check=True)
vswhere = Path(os.environ['ProgramFiles(x86)']) / 'Microsoft Visual Studio/Installer/vswhere.exe'
vs = subprocess.check_output([str(vswhere), '-latest', '-products', '*', '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], text=True).strip()
devcmd = Path(vs) / 'Common7/Tools/VsDevCmd.bat'
environment = subprocess.check_output(
    f'cmd.exe /d /s /c ""{devcmd}" -arch=x64 -host_arch=x64 >nul && set"', text=True)
env = dict(os.environ)
for line in environment.splitlines():
    name, sep, value = line.partition('=')
    if sep and name:
        env[name.upper()] = value

prepared = json.loads(subprocess.check_output(['python', str(SKIA / 'eng/prepare-artifacts.py'),
    '--profile', 'windows-x64-graphite-text-probe'], text=True))
output.mkdir(parents=True, exist_ok=args.resume)
modules = output / 'modules.cmake'
modules.write_text('set(NELYX_SKIA_RN_MODULE_LIBRARIES\n' + ''.join(
    '  "' + supplier_file(file).as_posix() + '"\n' for file in lock['libraries'][:11]) + ')\n'
    'target_compile_definitions(nelyx_skia_rn_vulkan PUBLIC SK_SHAPER_PRIMITIVE_AVAILABLE '
    'SK_SHAPER_HARFBUZZ_AVAILABLE SK_SHAPER_UNICODE_AVAILABLE SK_UNICODE_ICU_IMPLEMENTATION)\n')
build = output / 'build'
subprocess.run(['cmake', '-S', str(rn / 'native/vulkan'), '-B', str(build), '-G', 'Ninja',
    '-DCMAKE_BUILD_TYPE=Release', '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreadedDLL',
    '-DNELYX_SKIA_SDK=' + prepared['sdkCmake'],
    '-DNELYX_REACT_NATIVE_ROOT=' + str(runner / 'node_modules/react-native'),
    '-DNELYX_REACT_NATIVE_WINDOWS_ROOT=' + str(runner / 'node_modules/react-native-windows'),
    '-DNELYX_SKIA_RN_MODULES_CMAKE=' + str(modules)], env=env, check=True)
subprocess.run(['cmake', '--build', str(build), '--parallel', '2'], env=env, check=True)

package = output / 'supplier'
for record in lock['files']:
    file = package / record['file']
    file.parent.mkdir(parents=True, exist_ok=True)
    if not file.exists() or file.stat().st_size != record['bytes'] or sha(file) != record['sha256']:
        shutil.copyfile(supplier_file(record['file']), file)
libraries = ['libraries/00-nelyx_skia_rn_vulkan.lib', 'libraries/01-nelyx_skia_core.lib', *lock['libraries']]
shutil.copyfile(build / 'nelyx_skia_rn_vulkan.lib', package / libraries[0])
shutil.copyfile(build / 'nelyx-core/nelyx_skia_core.lib', package / libraries[1])
shutil.copytree(SKIA / 'licenses', package / 'licenses', dirs_exist_ok=args.resume)
shutil.copyfile(SKIA / 'THIRD_PARTY_NOTICES.md', package / 'licenses/THIRD_PARTY_NOTICES.md')
sources = {}
for directory in ['generated/jsi', 'generated/native-vulkan',
                  'generated/core', 'generated/gpu', 'generated/vulkan', 'generated/host', 'native/vulkan']:
    for file in sorted((rn / directory).rglob('*')):
        if file.is_symlink():
            raise RuntimeError('Native source symlink rejected')
        if file.is_file():
            sources[file.relative_to(rn).as_posix()] = sha(file)
records = [{'file': file.relative_to(package).as_posix(), 'bytes': file.stat().st_size, 'sha256': sha(file)}
    for file in sorted(package.rglob('*')) if file.is_file() and file != package / 'inputs.json']
manifest = {key: lock[key] for key in ['rnw', 'jsi', 'architecture', 'configuration', 'crt', 'headers', 'icu']}
manifest.update(schema='nelyx.rnw-native-inputs/v1', libraries=libraries, sources=sources, files=records)
(package / 'inputs.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'input': str(package / 'inputs.json'), 'libraries': len(libraries)}))
