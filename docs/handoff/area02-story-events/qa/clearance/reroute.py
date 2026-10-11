from clear import *
import heapq, copy
A = json.load(open('../area02.json')); N = {n['id']: n for n in A['nodes']}
E = json.load(open('edges.json'))
SEAT = {'p_bench', 'p_bench2', 's_wagon'}
SPECIAL = {'boardwalk', 'stones', 'log', 'trestle', 'pier'}
MARGIN = 0.04
def key(u, v): return (round(u*10), round(v*10))
def walk_ok(u, v, allow_water=False):
    w = WK.get(key(u, v)); 
    if not w: return False
    return w[1] == 1 and (allow_water or w[2] > 0.95)
def ok(u, v, ends=()):
    for (eu, ev) in ends:
        if math.hypot(u-eu, v-ev) < 0.6: return True
    return clearance(u, v)[0] >= MARGIN
def cr(points, n_per=12):
    # centripetal Catmull-Rom through points (2D), like THREE.CatmullRomCurve3(centripetal) with duplicated ends
    P = [points[0]] + points + [points[-1]]
    if len(points) == 2:
        out = []; (a, b) = points
        L = max(2, int(math.hypot(b[0]-a[0], b[1]-a[1]) / 0.1))
        return [(a[0] + (b[0]-a[0])*i/L, a[1] + (b[1]-a[1])*i/L) for i in range(L+1)]
    # three.js: extrapolate end tangents p0 = 2*p1 - p2
    P = [(2*points[0][0]-points[1][0], 2*points[0][1]-points[1][1])] + points + [(2*points[-1][0]-points[-2][0], 2*points[-1][1]-points[-2][1])]
    out = []
    for i in range(1, len(P)-2):
        p0, p1, p2, p3 = P[i-1], P[i], P[i+1], P[i+2]
        def dt(a, b): return max(1e-4, math.hypot(b[0]-a[0], b[1]-a[1]) ** 0.5)
        t0 = 0; t1 = t0 + dt(p0, p1); t2 = t1 + dt(p1, p2); t3 = t2 + dt(p2, p3)
        L = max(2, int(math.hypot(p2[0]-p1[0], p2[1]-p1[1]) / 0.08))
        for k in range(L + (1 if i == len(P)-3 else 0)):
            t = t1 + (t2 - t1) * k / L
            def lerp(a, b, ta, tb): 
                if tb - ta < 1e-9: return a
                return ((tb-t)/(tb-ta)*a[0] + (t-ta)/(tb-ta)*b[0], (tb-t)/(tb-ta)*a[1] + (t-ta)/(tb-ta)*b[1])
            A1 = lerp(p0, p1, t0, t1); A2 = lerp(p1, p2, t1, t2); A3 = lerp(p2, p3, t2, t3)
            B1 = lerp(A1, A2, t0, t2); B2 = lerp(A2, A3, t1, t3)
            out.append(lerp(B1, B2, t1, t2))
    return out
def curve_ok(pts, ends, allow_water):
    for (u, v) in cr(pts):
        if not ok(u, v, ends): return False
        if not walk_ok(u, v, allow_water) and not any(math.hypot(u-eu, v-ev) < 0.3 for eu, ev in ends): return False
    return True
def astar(a, b, poly, ends, allow_water):
    S = key(*a); G = key(*b)
    def h(k): return math.hypot(k[0]-G[0], k[1]-G[1]) / 10
    def dpoly(u, v): return min(math.hypot(u-p[0], v-p[1]) for p in poly[::3])
    openq = [(h(S), 0, S)]; came = {S: None}; g = {S: 0}
    while openq:
        f, gc, k = heapq.heappop(openq)
        if k == G: break
        if gc > g.get(k, 1e9) + 1e-9: continue
        for du in (-1, 0, 1):
            for dv in (-1, 0, 1):
                if not du and not dv: continue
                nk = (k[0]+du, k[1]+dv); u, v = nk[0]/10, nk[1]/10
                if nk != G:
                    if not walk_ok(u, v, allow_water): continue
                    if not ok(u, v, ends): continue
                    if WK.get(k) and WK.get(nk) and abs(WK[k][0] - WK[nk][0]) > 0.2: continue
                c = clearance(u, v)[0]
                step = math.hypot(du, dv) / 10 * (1 + 2.0 * max(0, 0.3 - c) + 0.6 * dpoly(u, v))
                ng = gc + step
                if ng < g.get(nk, 1e9): g[nk] = ng; came[nk] = k; heapq.heappush(openq, (ng + h(nk), ng, nk))
    if G not in came: return None
    path = []; k = G
    while k is not None: path.append((k[0]/10, k[1]/10)); k = came[k]
    return path[::-1]
def simplify(path, ends, allow_water):
    a, b = path[0], path[-1]
    for eps_i in range(0, 12):
        eps = 0.6 - eps_i * 0.05
        # Douglas-Peucker
        def dp(pts):
            if len(pts) < 3: return pts
            (x1, y1), (x2, y2) = pts[0], pts[-1]; L = math.hypot(x2-x1, y2-y1) or 1e-9
            dmax, idx = 0, 0
            for i in range(1, len(pts)-1):
                d = abs((y2-y1)*pts[i][0] - (x2-x1)*pts[i][1] + x2*y1 - y2*x1) / L
                if d > dmax: dmax, idx = d, i
            if dmax > eps: return dp(pts[:idx+1])[:-1] + dp(pts[idx:])
            return [pts[0], pts[-1]]
        cand = dp(path)
        # drop vias closer than 0.35 to neighbours
        vias = [p for p in cand[1:-1]]
        pts = [a] + vias + [b]
        if curve_ok(pts, ends, allow_water): return vias
    return None

def los(p, q, ends, allow_water, margin=MARGIN):
    L = math.hypot(q[0]-p[0], q[1]-p[1]); n = max(2, int(L / 0.05))
    for i in range(n + 1):
        u = p[0] + (q[0]-p[0]) * i / n; v = p[1] + (q[1]-p[1]) * i / n
        if any(math.hypot(u-eu, v-ev) < 0.6 for eu, ev in ends): continue
        if clearance(u, v)[0] < margin + 0.03: return False
        if not walk_ok(u, v, allow_water): return False
    return True
def pull(path, ends, allow_water):
    out = [path[0]]; i = 0
    while i < len(path) - 1:
        j = len(path) - 1
        while j > i + 1 and not los(path[i], path[j], ends, allow_water): j -= 1
        out.append(path[j]); i = j
    return out
def taut(path, ends, allow_water):
    corners = pull(path, ends, allow_water)
    pts = corners[:]
    for _ in range(6):
        if curve_ok(pts, ends, allow_water): return pts[1:-1]
        # densify: add the A* point halfway between each pair of corners
        new = [pts[0]]
        for a, b in zip(pts, pts[1:]):
            ia = min(range(len(path)), key=lambda k: math.hypot(path[k][0]-a[0], path[k][1]-a[1]))
            ib = min(range(len(path)), key=lambda k: math.hypot(path[k][0]-b[0], path[k][1]-b[1]))
            if ib - ia > 4: new.append(path[(ia + ib) // 2])
            new.append(b)
        pts = new
    return None
