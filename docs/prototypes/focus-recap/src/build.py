import base64, os, json
src='src'; out='out'
p=open(f'{src}/page.html',encoding='utf-8').read()
d=open(f'{src}/recap-director.js',encoding='utf-8').read()
assert '</script' not in d
p=p.replace('/*DIRECTOR*/', d)
import re
os.makedirs('local',exist_ok=True)
open('local/index.html','w',encoding='utf-8').write(p)
a=p
a=re.sub(r'<!doctype html>\s*<html[^>]*>\s*<head>\s*','',a,flags=re.I)
a=a.replace('<meta charset="utf-8">\n','').replace('<meta name="viewport" content="width=device-width,initial-scale=1">\n','')
a=a.replace('</head>\n<body>\n','').replace('</body>\n</html>\n','')
assert '<html' not in a and '<body' not in a and '<head' not in a, 'skeleton tags left'
open(f'{out}/index.html','w',encoding='utf-8').write(a)
aud={}
for f in sorted(os.listdir('audio')):
    if f.endswith('.mp3'):
        aud[f[:-4]]='data:audio/mpeg;base64,'+base64.b64encode(open('audio/'+f,'rb').read()).decode()
open(f'{out}/audio.js','w').write('window.__AUD='+json.dumps(aud)+';\n')
import shutil
for d in (out,'local'):
    shutil.copy(f'{src}/valley.bundle.js', f'{d}/valley.bundle.js')
shutil.copy(f'{out}/audio.js','local/audio.js')
for d in (out,'local'):
    shutil.copy(f'{src}/room.js', f'{d}/room.js')
print({f:os.path.getsize(f'{out}/{f}') for f in os.listdir(out)})
