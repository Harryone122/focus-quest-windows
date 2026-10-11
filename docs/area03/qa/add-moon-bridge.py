"""3C (2026-10-02): turn the old moon-gallery route into the 疊月橋 route (SPEC 9.2). Run once, then `node check.js graph-tidal.json measure-tidal.json` and `python bake-tidal-routes.py`."""
import json, math, pathlib, shutil
root = pathlib.Path(__file__).resolve().parents[3]
scene_path = root / 'docs/area03/area-03-reflection-lake.scene.json'
backup = root / 'previews/area03-before-3c'
backup.mkdir(parents=True, exist_ok=True)
if not (backup / scene_path.name).exists(): shutil.copy2(scene_path, backup / scene_path.name)
data = json.loads(scene_path.read_text(encoding='utf-8'))
ids = {n['id'] for n in data['nodes']}
assert 'moon_crown' not in ids, 'already applied'
graph = json.loads((root / 'docs/area03/qa/graph-tidal.json').read_text(encoding='utf-8'))
gn = {n['id']: n for n in graph['nodes']}
def world(u, v, y): return [round((u - v) / math.sqrt(2), 4), y, round(-(u + v) / math.sqrt(2), 4)]
for n in data['nodes']:
    if n['id'] == 'moon_entry': n['label'] = '疊月橋入口'
    if n['id'] == 'moon_watch':
        n.update(label='橋前看月', u=gn['moon_watch']['u'], v=gn['moon_watch']['v'], face=[-7.1, 6.85]); n['world'] = world(n['u'], n['v'], n['y'])
new = {'moon_wfoot': ('橋西端', None, None), 'moon_crown': ('橋頂', [-7.1, 5.6], None), 'moon_efoot': ('橋東端', None, None), 'moon_bank': ('榕樹下的岸邊', [-8.0, 6.3], 0.2)}
for id, (label, face, seat) in new.items():
    g = gn[id]; node = dict(id=id, label=label, u=g['u'], v=g['v'], y=.11, world=world(g['u'], g['v'], .11), kind='tidal-pocket', spin=False, clearance=dict(body=9, brim=9, spin=9, reed=9))
    if face: node['face'] = face
    if seat: node['seat'] = seat
    data['nodes'].append(node)
for e in graph['edges'][len(data['edges']):]:
    data['edges'].append(dict(a=e['a'], b=e['b'], kind=e['kind'], via=e['via'], length=1, minSurfaceY=.11, maxSlope=0, maxStoneGap=0, maxDrop=0, minBodyClearance=9, minBrimClearance=9, minReedDistance=9, samples=1, y=[.11, .11], hops=[], steps=[]))
for e, ge in zip(data['edges'], graph['edges']):
    assert (e['a'], e['b']) == (ge['a'], ge['b']), (e['a'], e['b'])
for sp in data['spots']:
    if sp['id'] == 'moon_watch': sp.update(name='橋前看月', face=[-7.1, 6.85], note='滿潮時橋拱與倒影接成一個圓，圓裡是滿月的夜')
data['spots'] += [dict(id='moon_crown', name='疊月橋橋頂', face=[-7.1, 5.6], demoAnim='gazeDown', tide='any', note='站在橋頂，低頭看橋洞裡的月亮'),
                  dict(id='moon_bank', name='榕樹下的岸邊', face=[-8.0, 6.3], demoAnim='sitEdge', tide='low', note='坐在東岸邊，從側面看拱')]
data['tidalAreas']['moonGallery'] = dict(center=[-7.1, 7.0], watch='moon_watch', crown='moon_crown', bank='moon_bank', name='疊月橋')
data['tidalAreas']['revised'] = '2026-10-02 (3C: 睡蓮池 + 疊月橋)'
scene_path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print('moon bridge nodes/edges/spots added:', len(data['nodes']), 'nodes', len(data['edges']), 'edges')
