import sys
src = open('src8.html').read()
data = open('cat_data.json').read()
full = src.replace('/*CATDATA*/', data)
open('cat-tent-v8.html', 'w').write(full)
loc = full.replace('https://cdn.jsdelivr.net/npm/three@0.160.0/', './node_modules/three/')
open('/home/claude/cat/web/v8_test.html', 'w').write(loc)
art = full
art = art.replace('<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n', '')
art = art.replace('</head>\n<body>\n', '', 1)
art = art.replace('</body>\n</html>\n', '')
open('artifact_v8.html', 'w').write(art)
print(len(full) / 1e6, 'MB')
