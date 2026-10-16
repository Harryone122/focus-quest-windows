import re
src=open('/home/claude/cat/src.html').read()
data=open('/home/claude/cat/cat_data.json').read()
full=src.replace('/*CATDATA*/',data)
open('/home/claude/cat/cat-tent-v1.html','w').write(full)
art=full
art=art.replace('<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n','')
art=art.replace('</head>\n<body>\n','',1)
art=art.replace('</body>\n</html>\n','')
assert '<html' not in art[:500] and '<body>' not in art[:20000]
open('/home/claude/cat/artifact/帳篷三花貓.html','w').write(art)
