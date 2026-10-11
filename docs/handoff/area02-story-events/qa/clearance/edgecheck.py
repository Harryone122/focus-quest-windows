from clear import *
E = json.load(open('edges.json'))
A = json.load(open('../area02.json')); N = {n['id']: n for n in A['nodes']}
SEAT = {'p_bench','p_bench2','s_wagon'}
bad = []
for e in E:
    if e['kind'] in ('boardwalk','stones','log','trestle','pier'): pass
    segs = []; cur = None
    for i, (u, v) in enumerate(e['pts']):
        if any(math.hypot(u-N[k]['u'], v-N[k]['v']) < 0.6 for k in SEAT if k in (e['a'], e['b'])): continue
        c, w = clearance(u, v)
        if c < -0.02:
            if cur is None: cur = [i, i, c, w]
            else: cur[1] = i; 
            if c < cur[2]: cur[2], cur[3] = c, w
        elif cur: segs.append(cur); cur = None
    if cur: segs.append(cur)
    if segs:
        bad.append((e['a'], e['b'], e['kind'], len(e['pts']), [(s[0], s[1], round(s[2],2), s[3]) for s in segs]))
for b in bad: print(b)
print(len(bad))

print('--- nodes')
for n in A['nodes']:
    if n['id'] in SEAT: continue
    c, w = clearance(n['u'], n['v'])
    if c < -0.02: print(n['id'], round(c,2), w)
