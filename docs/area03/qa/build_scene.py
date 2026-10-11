# builds docs/area03/area-03-reflection-lake.scene.json from graph_design.json + measure.json (+ lamps_measured.json when present)
import json, math, os, datetime
G = json.load(open('graph_design.json')); M = json.load(open('measure.json')); SPEC = json.load(open('graph_spec.json'))
specpos = {n['id']: (n['u'], n['v']) for n in SPEC['nodes']}
R2 = lambda x, n=2: round(x + 0.0, n)
def W(u, v, y): return [round((u - v) / math.sqrt(2), 4), round(y, 3), round(-(u + v) / math.sqrt(2), 4)]
SEAT = {'p_bench': 0.28, 'c_column': 0.35, 'c_stair': 0.0, 'c_steps': 0.0, 'n_pier': 0.22}
FACE = {'p_bench': [1.5, 10.5], 'c_stair': [-1.2, -1.6], 'p_mirror': [0.75, 10.05], 'p_table': [2.1, 11.05], 'a_stones': [-3.4, 13.8], 'p_entry': [2.1, 11.0], 'r_landing': [-15.0, -3.45]}
SPOT = [  # SPEC 8.7 (20)
 ('r_gauge','水位標尺','inspect','any','開場（擦水痕、看刻字）、信物「水位刻片」'), ('r_boat','擱淺小船','gaze','any',''), ('r_pool','潮池','crouch','low','潮池魚影'), ('r_reeds','蘆葦叢邊','gaze','any','看白鷺'),
 ('c_pillar','斷柱','inspect','any',''), ('c_stele','石碑','inspect','low','擦去石面水痕'), ('c_column','倒柱','sit','any',''), ('c_breach','南緣破口','crouch','any',''), ('c_stair','南石階','sit','low','首訪候選位置'), ('c_steps','沉階頂端','sitEdge','any','沉階下的東西（信物事件候選）'),
 ('p_bench','西北長凳','sitGaze','any','休息點、第二次造訪候選'), ('p_table','石桌','inspect','any','第二次造訪（倒影裡的杯子）'), ('p_mirror','鏡框','inspect','any','信物「背銀鏡片」'),
 ('k_roots','松根','crouch','any',''), ('k_branch','長枝下','gaze','any',''), ('s_ring','石環邊','crouch','any','核心「湖鏡」'),
 ('n_pier','北棧道石墩','sitEdge','low',''), ('a_arch','石拱門前','gaze','any',''), ('a_stones','往拱門的踏石','hopStones','low','取代原本等燈時的「跳一顆踏石」'), ('b_far','東方踏石','gaze','any','')]
LAMPS = [(0,'r_lamp1','石燈籠',0.2,[-11.6,0.5]), (1,'c_lamp2','石燈籠',0.4,[-4.6,0.9]), (2,'n_lamp3','矮石燈',0.6,[1.9,6.5]), (3,'k_lamp4','木框提燈（吊在老松長枝枝尖）',0.8,[8.7,1.3]), (4,'p_lamp5','小吊燈（掛在亭子南簷掛鉤）',1.0,[2.076,9.052])]
mn = M['nodes']
nodes = []
moved = []
for n in G['nodes']:
    r = mn[n['id']]; d = {'id': n['id'], 'label': n['label'], 'u': R2(n['u']), 'v': R2(n['v']), 'y': R2(r['y'], 3), 'world': W(n['u'], n['v'], r['y']), 'kind': n['kind']}
    f = n.get('face') or FACE.get(n['id'])
    if f: d['face'] = f
    if n['id'] in SEAT and SEAT[n['id']]: d['seat'] = SEAT[n['id']]
    d['spin'] = bool(r['spin'] >= 0)
    d['clearance'] = {'body': R2(min(r['body'], 9), 2), 'brim': R2(min(r['brim'], 9), 2), 'spin': R2(min(r['spin'], 9), 2), 'reed': R2(min(r['reed'], 9), 2)}
    nodes.append(d)
    sp = specpos[n['id']]; dd = math.hypot(n['u'] - sp[0], n['v'] - sp[1])
    if dd > 0.004: moved.append({'id': n['id'], 'spec': list(sp), 'final': [R2(n['u']), R2(n['v'])], 'distance': R2(dd, 2)})
nd = {n['id']: n for n in nodes}
edges = []; clear_edges = []
for E, gE in zip(M['edges'], G['edges']):
    assert E['a'] == gE['a'] and E['b'] == gE['b']
    S = E['S']; n = E['n']; y = [q[2] for q in S]
    # y must be complete: gaps are already interpolated in measure (yy)
    assert all(v is not None for v in y), (E['a'], E['b'])
    def ny(u, v):
        b = min(range(len(S)), key=lambda i: (S[i][0] - u) ** 2 + (S[i][1] - v) ** 2); return y[b]
    via = [[q[0], q[1], R2(ny(q[0], q[1]), 3)] for q in gE.get('via', [])]
    hops = [[g[0], g[1], g[2]] for g in E['gaps'] if g[2] > 0.3]
    maxgap = max([g[2] for g in E['gaps']] + [0])
    steps = []
    for k in range(n):
        if E['on'][k] and E['on'][k + 1] and abs(y[k + 1] - y[k]) > 0.07: steps.append([k, R2(y[k + 1] - y[k], 3)])
    maxdrop = max([abs(s[1]) for s in steps] + [0])
    e = {'a': E['a'], 'b': E['b'], 'kind': E['kind'], 'via': via, 'length': R2(E['L'], 3), 'minSurfaceY': R2(min(y), 3), 'maxSlope': R2(E['maxSlope'], 3), 'maxStoneGap': R2(maxgap, 2), 'maxDrop': R2(maxdrop, 3),
         'minBodyClearance': R2(min(E['minBody'], 9), 3), 'minBrimClearance': R2(min(E['minBrim'], 9), 3), 'minReedDistance': R2(min(E['minReed'], 9), 2), 'samples': n, 'y': [R2(v, 3) for v in y], 'hops': hops, 'steps': steps}
    edges.append(e)
# graph distances (Floyd-Warshall on edge lengths)
ids = [n['id'] for n in nodes]; ix = {k: i for i, k in enumerate(ids)}; N = len(ids); D = [[math.inf] * N for _ in range(N)]
for i in range(N): D[i][i] = 0
for e in edges: i, j = ix[e['a']], ix[e['b']]; D[i][j] = D[j][i] = e['length']
for k in range(N):
    for i in range(N):
        for j in range(N):
            if D[i][k] + D[k][j] < D[i][j]: D[i][j] = D[i][k] + D[k][j]
dm = max((D[i][j], ids[i], ids[j]) for i in range(N) for j in range(N))
seq = ['entry0'] + [l[1] for l in LAMPS] + ['p_bench']
PACE = 0.35
legs = [{'from': seq[i], 'to': seq[i + 1], 'distance': R2(D[ix[seq[i]]][ix[seq[i + 1]]], 2), 'walkSecondsAtAppPace': round(D[ix[seq[i]]][ix[seq[i + 1]]] / PACE)} for i in range(len(seq) - 1)]
lm = json.load(open('lamps_measured.json')) if os.path.exists('lamps_measured.json') else {}
lamps = []
for k, node, style, due, prop in LAMPS:
    L = {'index': k + 1, 'node': node, 'prop': prop, 'style': style, 'dueAt': due}
    if k == 3: L['mount'] = {'u': 8.70, 'v': 1.30, 'y': 2.00, 'note': '老松長枝枝尖；燈隨松枝一起擺，再加慢慢的鐘擺'}
    if k == 4: L['mount'] = {'u': 2.076, 'v': 9.052, 'y': 1.594, 'note': '亭子南簷掛鉤的鐵環中心'}
    if str(k) in lm: L.update(lm[str(k)])
    lamps.append(L)
spots = [{'id': i, 'name': nm, 'face': nd[i].get('face'), 'demoAnim': an, 'tide': tide, 'note': note} for i, nm, an, tide, note in SPOT]
anywhere = [
 {'id':'amb_stretch','name':'伸個懶腰','anim':'stretch','durationAppSeconds':[8,15],'condition':'any'},
 {'id':'amb_pack','name':'蹲下來整理背包','anim':'crouch','durationAppSeconds':[15,25],'condition':'low tide (feet dry)'},
 {'id':'amb_watch_water','name':'蹲在水邊看水','anim':'crouch','durationAppSeconds':[15,25],'condition':'low tide; faces the nearest water or puddle'},
 {'id':'amb_clouds','name':'低頭看水裡的雲慢慢飄過','anim':'gazeDown','durationAppSeconds':[10,25],'condition':'dawn, day, dusk'},
 {'id':'amb_reflection','name':'低頭看自己的倒影，輕輕晃一下身體','anim':'lookDown','durationAppSeconds':[12,20],'condition':'high tide'},
 {'id':'amb_spin','name':'張開手慢慢轉一圈','anim':'spin','durationAppSeconds':[10,14],'condition':'high tide; 0.45 free around the body (node.spin)'},
 {'id':'amb_fireflies','name':'停下來看螢火蟲','anim':'gaze','durationAppSeconds':[20,40],'condition':'night; lamp 1 or lamp 4'}]
out = {
 'areaId': 'area-03-reflection-lake', 'title': '倒影湖畔', 'theme': '倒影似乎比本人多知道一點',
 'coordinates': 'Ground plane (u, v); world x = (u - v) / sqrt(2), z = -(u + v) / sqrt(2); y up; water datum y = 0. The camera looks from the -v side. Node y and via y are the visible walking surface measured by down-rays (docs/area03/qa).',
 'plannedMinutes': 50,
 'ports': {'entry': 'entry0', 'spawn': 'r_landing', 'exits': ['a_arch', 'b_far']},
 'nodes': nodes, 'edges': edges, 'lamps': lamps, 'lampLegs': legs, 'graphDiameter': {'from': dm[1], 'to': dm[2], 'distance': R2(dm[0], 2), 'walkSecondsAtAppPace': round(dm[0] / PACE)},
 'spots': spots, 'anywhereEvents': anywhere,
 'tide': {'riseSeconds': 90, 'highSeconds': 360, 'fallSeconds': 90, 'first': {'startMin': 660, 'startMax': 1860, 'chance': 1}, 'second': {'startMin': 2400, 'startMax': 2700, 'chance': 0.5}, 'after': {'from': 3000, 'every': 1200, 'chance': 0.5, 'jitter': 300},
          'dryAfterSeconds': 240, 'levelLow': 0.0, 'levelHigh': 0.30, 'seedUnit': 'journey', 'affectsRewards': False, 'affectsRoutes': False},
 'appPacing': {'walkUnitsPerSecond': PACE},
 'clearance': {'date': '2026-09-30', 'method': 'BVH ray casts against the visible solid meshes of the prototype (docs/area03/qa/check.js): every 0.1 along each edge and at every station, 16 directions x 5 body heights (radius 0.27, foot+0.08..0.8) and 3 brim heights (radius 0.36, foot+1.05..1.2). Floor-like faces (normal y > 0.5), water, reeds, grass, moss and the flames do not count; things lower than 5 cm above the foot (or above the ledge the path steps from / to) do not count. On rock edges lumps and root humps up to 15 cm above the foot count as steps.',
   'result': 'all 46 edges and 43 stations: body >= 0, brim >= 0, reeds >= 0.45', 'movedNodes': moved, 'changedSceneObjects': {'lamp3Pier': 'moved to (1.90, 6.50), top 0.40, 1.0 x 0.8; overlapping small piers removed', 'eastStair': 'moved from (1.5, 1.6) to (1.45, 0.60)', 'reedClumpsRemoved': []}}
}
s = json.dumps(out, ensure_ascii=False, indent=1)
open('area-03-reflection-lake.scene.json', 'w', encoding='utf-8').write(s + '\n')
print('written', len(s), 'bytes;', len(nodes), 'nodes', len(edges), 'edges; diameter', out['graphDiameter'])
