# grid planner: finds via points for each edge on the measured occupancy grid (step 0.1). QA/design tool only.
import json, heapq, math, sys
import numpy as np
import os
occ = json.load(open(os.environ.get('OCC', 'occ_fine.json'))); world = json.load(open('world.json')); design = json.load(open('graph_spec.json'))
S = occ['step']; U0, V0 = occ['u0'], occ['v0']
nu = int(round((occ['u1'] - U0) / S)) + 1; nv = int(round((occ['v1'] - V0) / S)) + 1
Y = np.full((nu, nv), np.nan); CB = np.full((nu, nv), -9.0); CR = np.full((nu, nv), -9.0)
for c in occ['cells']:
    i = int(round((c[0] - U0) / S)); j = int(round((c[1] - V0) / S))
    if 0 <= i < nu and 0 <= j < nv and c[2] is not None: Y[i, j] = c[2]; CB[i, j] = c[3]; CR[i, j] = c[4]
reeds = [(r[0], r[1]) for r in world['reeds'] if not r[2]]
RD = np.full((nu, nv), 9.0)
for (ru, rv) in reeds:
    for i in range(max(0, int((ru - 0.9 - U0) / S)), min(nu, int((ru + 0.9 - U0) / S) + 1)):
        for j in range(max(0, int((rv - 0.9 - V0) / S)), min(nv, int((rv + 0.9 - V0) / S) + 1)):
            d = math.hypot(U0 + i * S - ru, V0 + j * S - rv); RD[i, j] = min(RD[i, j], d)
def idx(u, v): return int(round((u - U0) / S)), int(round((v - V0) / S))
def pos(i, j): return U0 + i * S, V0 + j * S
MARGIN = float(sys.argv[1]) if len(sys.argv) > 1 else 0.08
def ok(i, j, m=MARGIN): return 0 <= i < nu and 0 <= j < nv and not np.isnan(Y[i, j]) and CB[i, j] >= m and CR[i, j] >= m and RD[i, j] >= 0.5
OVR = {'c_west|c_stair': 0.07, 'c_stair|c_stele': 0.07, 'c_breach|c_steps': 0.25, 'c_steps|c_east': 0.25, 'k_top|k_roots': 0.13, 'k_roots|k_east': 0.13}
CURK = [None]
def dymax(kind): return OVR.get(CURK[0], {'stair': 0.095, 'rock': 0.085}.get(kind, 0.05))
def steplim(kind, d):
    if CURK[0] in OVR: return OVR[CURK[0]]
    if kind == 'stair': return 0.095
    if kind in ('causeway', 'pavilion'): return 0.09
    return max(0.045, dymax(kind) * d / 0.1)
NB = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]
def astar(a, b, kind, m=MARGIN):
    si, sj = idx(*a); gi, gj = idx(*b); dm = dymax(kind)
    if not ok(si, sj, m) or not ok(gi, gj, m): return None
    pq = [(0, si, sj)]; g = {(si, sj): 0.0}; prev = {}
    while pq:
        f, i, j = heapq.heappop(pq)
        if (i, j) == (gi, gj): break
        if f - math.hypot(i - gi, j - gj) * S > g[(i, j)] + 1e-9: continue
        for di, dj in NB:
            ni, nj = i + di, j + dj
            if not ok(ni, nj, m): continue
            d = math.hypot(di, dj) * S
            if abs(Y[ni, nj] - Y[i, j]) > steplim(kind, d): continue
            wc = 1.0 + 1.2 * max(0.0, 0.4 - min(CB[ni, nj], CR[ni, nj] + 0.1)) / 0.4
            ng = g[(i, j)] + d * wc
            if ng < g.get((ni, nj), 1e18):
                g[(ni, nj)] = ng; prev[(ni, nj)] = (i, j); heapq.heappush(pq, (ng + math.hypot(ni - gi, nj - gj) * S, ni, nj))
    if (gi, gj) not in prev and (si, sj) != (gi, gj): return None
    path = [(gi, gj)]
    while path[-1] != (si, sj): path.append(prev[path[-1]])
    return [pos(*p) for p in reversed(path)]
def los(p, q, kind, m):
    n = max(2, int(math.hypot(q[0] - p[0], q[1] - p[1]) / 0.05)); dm = dymax(kind); py = None
    for k in range(n + 1):
        t = k / n; u = p[0] + (q[0] - p[0]) * t; v = p[1] + (q[1] - p[1]) * t; i, j = idx(u, v)
        if not ok(i, j, m): return False
        if py is not None and abs(Y[i, j] - py) > steplim(kind, 0.05): return False
        py = Y[i, j]
    return True
def pull(path, kind, m):
    out = [path[0]]; i = 0
    while i < len(path) - 1:
        j = len(path) - 1
        while j > i + 1 and not los(path[i], path[j], kind, m): j -= 1
        out.append(path[j]); i = j
    return out
FIXED = {
    'entry0|r_landing': [[-18.97, -3.84], [-17.6, -3.4]],
    'c_south|s_isle': [[-0.9, -4.5], [-1.1, -5.45], [-1.3, -6.4]],
    'e_cw|k_lamp4': [[7.85, 1.6]],
    'p_west|a_stones': [[-0.4, 12.2], [-1.15, 12.6]],
    'a_stones|a_arch': [[-2.65, 13.4]],
    'k_east|b_far': [],
}
NOMOVE = {'entry0', 'b_far', 'a_stones', 'a_arch', 'r_landing', 'k_shelf'}
EXPY = {k: v['y'] for k, v in json.load(open('measure_spec.json'))['nodes'].items()}
def yok(nid, i, j): return abs(Y[i, j] - EXPY[nid]) <= 0.1
def relocate(nd, m=0.04, rad=0.4):
    i0, j0 = idx(nd['u'], nd['v'])
    if ok(i0, j0, 0.09) and yok(nd['id'], i0, j0): return (nd['u'], nd['v'])
    best = None; R = int(rad / S) + 1
    for di in range(-R, R + 1):
        for dj in range(-R, R + 1):
            i, j = i0 + di, j0 + dj; d = math.hypot(di, dj) * S
            if d > rad or not ok(i, j, m) or not yok(nd['id'], i, j): continue
            sc = d - 0.3 * min(CB[i, j], 0.3)
            if best is None or sc < best[0]: best = (sc, i, j)
    return pos(best[1], best[2]) if best else None
if __name__ == '__main__':
    nodes = {n['id']: n for n in design['nodes']}
    try:
        for k, q in json.load(open('node_over.json')).items(): nodes[k]['u'], nodes[k]['v'] = q
    except Exception: pass
    res = {'nodes': {}, 'vias': {}}
    for nid, nd in nodes.items():
        if nid in NOMOVE: continue
        r = relocate(nd)
        if r is None: print('!! node cannot be relocated', nid); continue
        if abs(r[0] - nd['u']) > 1e-9 or abs(r[1] - nd['v']) > 1e-9:
            res['nodes'][nid] = [round(r[0], 2), round(r[1], 2)]; print('move', nid, (nd['u'], nd['v']), '->', res['nodes'][nid], 'd=%.2f' % math.hypot(r[0] - nd['u'], r[1] - nd['v']))
            nd['u'], nd['v'] = res['nodes'][nid]
    for e in design['edges']:
        k = e['a'] + '|' + e['b']
        if k in FIXED: res['vias'][k] = FIXED[k]; continue
        a = (nodes[e['a']]['u'], nodes[e['a']]['v']); b = (nodes[e['b']]['u'], nodes[e['b']]['v'])
        CURK[0] = k
        path = None
        for m in (MARGIN, 0.06, 0.045, 0.03):
            path = astar(a, b, e['kind'], m)
            if path is not None: break
        if path is None: print('NO PATH', k, e['kind']); continue
        if m != MARGIN: print('  margin', m, 'for', k)
        via = pull(path, e["kind"], m + float(os.environ.get("PULLM", "0.03")))[1:-1]
        res['vias'][k] = [[round(u, 2), round(v, 2)] for u, v in via]
    json.dump(res, open('vias.json', 'w'), indent=0)
    print('planned', len(res['vias']), 'edges')
