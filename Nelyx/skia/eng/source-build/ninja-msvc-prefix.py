"""Keep Ninja's /showIncludes dependency parser aligned with the installed MSVC language."""
import locale, pathlib, subprocess, sys
build=pathlib.Path(sys.argv[1]).resolve()
header=build/'nelyx-includes-probe.h';source=build/'nelyx-includes-probe.c'
header.write_text('/* local compiler include prefix probe */\n',encoding='utf-8')
source.write_text('#include "nelyx-includes-probe.h"\n',encoding='utf-8')
probe=subprocess.run(['cl.exe','/nologo','/showIncludes','/c',str(source),'/Fo'+str(build/'nelyx-includes-probe.obj')],capture_output=True,timeout=30)
if probe.returncode:raise RuntimeError('MSVC dependency prefix probe failed')
try:text=probe.stdout.decode('utf-8')
except UnicodeDecodeError:text=probe.stdout.decode(locale.getpreferredencoding(False))
line=next(line for line in text.splitlines() if str(header).lower() in line.lower())
prefix=line[:line.lower().index(str(header).lower())].rstrip()
if not prefix or '\n' in prefix or '$' in prefix:raise RuntimeError('Invalid compiler include prefix')
ninja=build/'build.ninja';ninja.write_text('msvc_deps_prefix = '+prefix+'\n'+ninja.read_text(encoding='utf-8'),encoding='utf-8')
print('MSVC include dependency prefix: '+prefix)
