"""Fetch exact Skia/DEPS inputs into a disposable workspace cache; do not activate global tools."""
import ast, concurrent.futures, hashlib, json, pathlib, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parents[4]
SKIA=ROOT/'Nelyx/.cache/vendor/skia'
REVISION='2466dcf3937437e217e7f284afe0e1aae15891ce'
def run(arguments,cwd=ROOT):
    result=subprocess.run(arguments,cwd=cwd,text=True,capture_output=True,timeout=240)
    if result.returncode: raise RuntimeError(f'{arguments}: {result.stderr[-2000:]}')
    return result.stdout.strip()
if run(['git','rev-parse','HEAD'],SKIA)!=REVISION: raise RuntimeError('Skia checkout does not match the selected revision')
data=(SKIA/'DEPS').read_bytes()
tree=ast.parse(data.decode())
deps=next(node.value for node in tree.body if isinstance(node,ast.Assign) and any(isinstance(target,ast.Name) and target.id=='deps' for target in node.targets))
names={'buildtools','abseil-cpp','brotli','d3d12allocator','dawn','egl-registry','emsdk','expat','freetype','glslang','harfbuzz','highway','icu','jinja2','libjpeg-turbo','libpng','libwebp','markupsafe','opengl-registry','spirv-headers','spirv-tools','swiftshader','vulkan-headers','vulkan-utility-libraries','webgpu-headers','wuffs','zlib'}
entries=[]
for key,value in zip(deps.keys,deps.values):
    if isinstance(key,ast.Constant) and isinstance(value,ast.Constant) and isinstance(value.value,str) and pathlib.PurePosixPath(key.value).name in names:
        repository,revision=value.value.rsplit('@',1);entries.append({'path':key.value,'repository':repository,'revision':revision})
if len(entries)!=len(names):raise RuntimeError('Selected DEPS dependencies missing')
lock={'schema':'nelyx.skia-build-inputs/v1','skia':{'repository':'https://skia.googlesource.com/skia.git','revision':REVISION,'depsSha256':hashlib.sha256(data).hexdigest()},'dawnRevision':next(item['revision'] for item in entries if item['path'].endswith('/dawn')),'emsdk':{'revision':next(item['revision'] for item in entries if item['path'].endswith('/emsdk')),'version':'4.0.7'},'gnRevision':'b2afae122eeb6ce09c52d63f67dc53fc517dbdc8','dependencies':entries,'qualification':'source inputs selected; builds and old binary correspondence notVerified'}
(ROOT/'Nelyx/skia/eng/source-build/source-lock.json').write_text(json.dumps(lock,indent=2)+'\n',encoding='utf-8')
def fetch(entry):
    target=(SKIA/entry['path']).resolve()
    if not target.is_relative_to(SKIA.resolve()):raise RuntimeError('Vendor path outside cache')
    target.mkdir(parents=True,exist_ok=True)
    if not (target/'.git').exists():
        if list(target.iterdir()):raise RuntimeError('Nonempty vendor directory without its own git repository')
        run(['git','init'],target);run(['git','remote','add','origin',entry['repository']],target)
    if pathlib.Path(run(['git','rev-parse','--show-toplevel'],target)).resolve()!=target:raise RuntimeError('Vendor git root mismatch')
    run(['git','config','core.longpaths','true'],target)
    if run(['git','status','--porcelain','--untracked-files=no'],target):raise RuntimeError('Dirty vendor checkout retained')
    present=subprocess.run(['git','cat-file','-e',entry['revision']+'^{commit}'],cwd=target,capture_output=True).returncode==0
    if not present:run(['git','fetch','--depth=1','origin',entry['revision']],target)
    run(['git','checkout','--detach',entry['revision']],target)
    print(json.dumps({'path':entry['path'],'revision':run(['git','rev-parse','HEAD'],target)}),flush=True)
failures=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    futures={pool.submit(fetch,entry):entry for entry in entries}
    for future in concurrent.futures.as_completed(futures):
        try:future.result()
        except Exception as error:failures.append(str(error))
if failures:raise RuntimeError('\n'.join(failures))
run([sys.executable,'bin/fetch-gn'],SKIA)
print(json.dumps({'revision':REVISION,'dependencies':len(entries),'gnSha256':hashlib.sha256((SKIA/'bin/gn.exe').read_bytes()).hexdigest(),'nativeBuild':'notVerified','wasmBuild':'notVerified'}))
