"""Prepare the pinned Windows vendor profile at an explicit cache path."""
import argparse,hashlib,json,pathlib,tarfile,urllib.request
parser=argparse.ArgumentParser();parser.add_argument('--cache',type=pathlib.Path,required=True);args=parser.parse_args();cache=args.cache.resolve();cache.mkdir(parents=True,exist_ok=True)
name='skia-binaries-b7f043e0b1e2a850e702-x86_64-pc-windows-msvc-ganesh-gl-jpegd-jpege-pdf-textlayout.tar.gz'
pins=[{'name':name,'url':'https://github.com/rust-skia/skia-binaries/releases/download/0.153.3/'+name,'sha256':'56bc9791500a67a3a6eb0cabe05e8086879ac25d2b2560a583bb79a4302295db','stripRoot':False,'directory':cache,'marker':cache/'skia-binaries/skia.lib'},
      {'name':'skia-source.tar.gz','url':'https://codeload.github.com/rust-skia/skia/tar.gz/61e7ca4e99062cdd0ab69445d5963fb3365778f6','sha256':'8401d0de878582a03abc1029bb62330aea58cda89904ae6ab187302e6d48ba5d','stripRoot':True,'directory':cache/'source','marker':cache/'source/include/core/SkCanvas.h'}]
for pin in pins:
    archive=cache/pin['name']
    if not archive.exists():
        with urllib.request.urlopen(pin['url'],timeout=180) as response:content=response.read()
        if hashlib.sha256(content).hexdigest()!=pin['sha256']:raise RuntimeError('Vendor download hash mismatch')
        archive.write_bytes(content)
    if hashlib.sha256(archive.read_bytes()).hexdigest()!=pin['sha256']:raise RuntimeError('Vendor cache archive hash mismatch')
    if pin['marker'].exists():continue
    pin['directory'].mkdir(parents=True,exist_ok=True)
    with tarfile.open(archive,'r:gz') as package:
        for member in package.getmembers():
            if pin['stripRoot']:
                parts=pathlib.PurePosixPath(member.name).parts
                if len(parts)<2:continue
                member.name=str(pathlib.PurePosixPath(*parts[1:]))
            if not (pin['directory']/member.name).resolve().is_relative_to(pin['directory'].resolve()):raise RuntimeError('Unsafe vendor archive path')
            package.extract(member,pin['directory'],filter='data')
report={'schema':'nelyx.skia-windows-vendor/v1','profile':'m153-ganesh','binarySourceIdentity':'not independently rebuilt','pins':[{key:value for key,value in pin.items() if key in ['name','url','sha256']} for pin in pins]}
(cache/'nelyx-skia-vendor.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps({'result':'PASS','cache':str(cache),'profile':report['profile']}))
