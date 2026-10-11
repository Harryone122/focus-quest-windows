from reroute import *
import sys
NODES = {'p_lamp2': (-7.3, 2.55), 'p_window': (-1.63, 3.5), 'p_post': (-10.95, 2.54), 'p_sign': (-9.0, 2.12), 'p_lamp3': (2.2, 2.55), 'p_cart': (4.7, 2.25), 'p_bede': (6.35, 3.3), 'exit_tunnel': (12.39, 6.57), 's_spring': (13.64, -0.75), 'l_hut': (-9.99, 11.52), 'l_wood': (-8.6, 13.4)}
for k, (u, v) in NODES.items(): N[k]['u'], N[k]['v'] = u, v
def check(a, b, vias):
    ends = [(N[k]['u'], N[k]['v']) for k in (a, b) if k in SEAT]
    pts = [(N[a]['u'], N[a]['v'])] + [tuple(p) for p in vias] + [(N[b]['u'], N[b]['v'])]
    worst = (9, None, None)
    for (u, v) in cr(pts):
        if any(math.hypot(u-eu, v-ev) < 0.6 for eu, ev in ends): continue
        c, w = clearance(u, v)
        if not walk_ok(u, v): c = min(c, -1)
        if c < worst[0]: worst = (round(c, 2), (round(u, 2), round(v, 2)), w)
    return worst
if __name__ == '__main__':
    for line in sys.stdin:
        line = line.strip()
        if not line: continue
        a, b, vias = line.split(' ', 2); print(a, b, vias, '->', check(a, b, json.loads(vias)))
