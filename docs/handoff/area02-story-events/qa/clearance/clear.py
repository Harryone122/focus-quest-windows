import json, math
from collections import defaultdict
OCC = json.load(open('occ.json'))
cells = []   # (u, v, radius, tag)
WK = {}
for u, v, y, rim, bd, occ, top in OCC:
    WK[(round(u*10), round(v*10))] = (y, rim, bd)
    r = 0
    if any(h <= 0.8 for h in occ): r = 0.27
    if any(h >= 1.05 for h in occ): r = max(r, 0.36)
    if top is not None and 0.25 <= top <= 1.3: r = max(r, 0.27)
    if r: cells.append((u, v, r, (tuple(occ), top)))
B = defaultdict(list)
for c in cells: B[(round(c[0]*2), round(c[1]*2))].append(c)
def clearance(u, v):
    worst = 9; what = None
    for du in (-1, 0, 1):
        for dv in (-1, 0, 1):
            for cu, cv, r, tag in B.get((round(u*2)+du, round(v*2)+dv), []):
                d = math.hypot(cu-u, cv-v) - r + 0.05
                if d < worst: worst, what = d, (cu, cv, tag)
    return worst, what
