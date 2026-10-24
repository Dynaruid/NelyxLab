"""SPDX-License-Identifier: BSD-3-Clause. Explicit m153 RN module source-build input preparation.

Uses the already pinned source archive. Does not build/download Skia core or
replace the native Vulkan prebuilt; selects original module GN source lists.
"""
import argparse
import hashlib
import json
import pathlib
import re
import tarfile

parser=argparse.ArgumentParser()
parser.add_argument('--archive',required=True,type=pathlib.Path)
parser.add_argument('--webp-archive',required=True,type=pathlib.Path)
parser.add_argument('--lock',required=True,type=pathlib.Path)
parser.add_argument('--output',required=True,type=pathlib.Path)
args=parser.parse_args()
sha=lambda data:hashlib.sha256(data).hexdigest()
lock=json.loads(args.lock.read_text())
pin=next(item for item in lock['artifacts'] if item['id']=='skia-m153-headers')
if sha(args.archive.read_bytes())!=pin['archiveSha256']:raise RuntimeError('Matching m153 source archive differs')
output=args.output.resolve()
if output.exists():raise RuntimeError('Use a fresh source-build input directory')
source=output/'source';source.mkdir(parents=True)
entries=[]
with tarfile.open(args.archive) as archive:
    prefix=pin['stripPrefix']+'/'
    for item in archive:
        if not item.name.startswith(prefix):continue
        relative=pathlib.PurePosixPath(item.name[len(prefix):])
        if '..' in relative.parts or relative.is_absolute():raise RuntimeError('Unsafe source archive path')
        wanted=(str(relative) in ('LICENSE','DEPS') or (relative.parts and relative.parts[0] in ('include','modules','src','gn','experimental')
                and relative.suffix in ('.h','.cpp','.inc','.gn','.gni')))
        if not wanted or item.isdir():continue
        if not item.isfile() or item.size>16*1024*1024:raise RuntimeError('Unexpected source archive entry')
        data=archive.extractfile(item).read();file=source/relative
        file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(data)
        entries.append({'file':str(relative),'sha256':sha(data)})
modules={'svg':'skia_svg_renderer_sources','skottie':'skia_skottie_sources','sksg':'skia_sksg_sources',
         'skresources':'skia_skresources_sources','jsonreader':'skia_jsonreader_sources'}
lists={}
for module,variable in modules.items():
    text=(source/f'modules/{module}/{module}.gni').read_text()
    match=re.search(r'\b'+variable+r'\s*=\s*\[(.*?)\]',text,re.S)
    if not match:raise RuntimeError('Original GN source list is absent: '+variable)
    files=[name.replace('$_modules/','modules/') for name in re.findall(r'"([^"\n]+)"',match[1]) if name.endswith('.cpp')]
    if not files or any(not (source/name).is_file() for name in files):raise RuntimeError('Incomplete GN source list')
    lists[module]=files
lists['webp']=['src/codec/SkWebpCodec.cpp','src/encode/SkWebpEncoderImpl.cpp']
# Retain the exact dependency revision from this Skia source, with its own
# archive identity and original CMake build/license files. Preparation is offline.
webp_pin=json.loads(pathlib.Path(__file__).with_name('libwebp.lock.json').read_text())
if webp_pin['skiaDeps'] not in (source/'DEPS').read_text():
    raise RuntimeError('libwebp revision differs from original Skia DEPS')
webp_bytes=args.webp_archive.read_bytes()
if len(webp_bytes)!=webp_pin['archiveBytes'] or sha(webp_bytes)!=webp_pin['archiveSha256']:
    raise RuntimeError('Pinned libwebp source archive differs')
webp_source=output/'libwebp';webp_source.mkdir()
webp_entries=[]
with tarfile.open(args.webp_archive) as archive:
    prefix=webp_pin['stripPrefix']+'/'
    for item in archive:
        if item.name==webp_pin['stripPrefix'] and item.isdir():continue
        if not item.name.startswith(prefix):raise RuntimeError('Unexpected libwebp prefix')
        relative=pathlib.PurePosixPath(item.name[len(prefix):])
        if '..' in relative.parts or relative.is_absolute():raise RuntimeError('Unsafe libwebp source path')
        if item.isdir():continue
        if not item.isfile() or item.size>16*1024*1024:raise RuntimeError('Unexpected libwebp source entry')
        data=archive.extractfile(item).read();file=webp_source/relative
        file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(data)
        webp_entries.append({'file':str(relative),'sha256':sha(data)})
for license_file in webp_pin['licenseFiles']:
    if not (webp_source/license_file).is_file():raise RuntimeError('Missing libwebp license: '+license_file)
# The pinned jsonreader GN target includes its parser implementation itself.
recipe=pathlib.Path(__file__).with_name('rn-modules.cmake').resolve()
cmake=['# Generated from pinned original GN lists; explicit source-build exception.',
       'set(NELYX_RN_MODULE_SOURCE_ROOT "'+source.as_posix()+'")',
       'set(NELYX_RN_WEBP_SOURCE_ROOT "'+webp_source.as_posix()+'")']
for module,files in lists.items():
    cmake+=['set(NELYX_RN_'+module.upper()+'_SOURCES']+['  "'+(source/name).as_posix()+'"' for name in files]+[')']
cmake+=['include("'+recipe.as_posix()+'")']
(output/'modules.cmake').write_text('\n'.join(cmake)+'\n')
report={'schema':'nelyx.rn-m153-module-inputs/v1','archiveSha256':pin['archiveSha256'],'origin':pin['url'],
        'sourceFiles':entries,'modules':lists,'recipeSha256':sha(recipe.read_bytes()),
        'webp':{**webp_pin,'sourceFiles':webp_entries},
        'scope':'explicit SVG/Skottie/resources/SG/JSON/WebP supplement; native Vulkan Skia core remains pinned prebuilt',
        'binaryLinkRuntime':'notVerified'}
(output/'inputs.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'modules':{name:len(files) for name,files in lists.items()},'sourceFiles':len(entries),'cmake':str(output/'modules.cmake')}))
