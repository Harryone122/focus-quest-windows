"""Build cat-tent-v14.html (standalone page) and artifact_v14.html (same page without the document skeleton).
Usage (from this folder): python build9.py [cat_data.json]"""
import sys
data_path = sys.argv[1] if len(sys.argv) > 1 else 'cat_data.json'
full = open('src14.html').read().replace('/*CATDATA*/', open(data_path).read())
open('cat-tent-v14.html', 'w').write(full)
art = full.replace('<!doctype html>\n<html lang="zh-Hant">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n', '')
art = art.replace('</head>\n<body>\n', '', 1).replace('</body>\n</html>\n', '')
open('artifact_v14.html', 'w').write(art)
print(len(full) / 1e6, 'MB')
