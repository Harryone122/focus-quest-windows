import json, math
v=json.load(open('vias.json'))
d=json.load(open('graph_spec.json')); nodes={n['id']:n for n in d['nodes']}
try:
    for k,q in json.load(open('node_over.json')).items(): nodes[k]['u'],nodes[k]['v']=q
except Exception: pass
for k,q in v['nodes'].items(): nodes[k]['u'],nodes[k]['v']=q
try: manual=json.load(open('vias_manual.json'))
except Exception: manual={}
out={}
for k,vs in v['vias'].items():
    a,b=k.split('|'); kept=[]
    for p in vs:
        ref = kept[-1] if kept else (nodes[a]['u'],nodes[a]['v'])
        if math.hypot(p[0]-ref[0],p[1]-ref[1])<0.15: continue
        kept.append(p)
    if kept and math.hypot(kept[-1][0]-nodes[b]['u'],kept[-1][1]-nodes[b]['v'])<0.12 and k not in ('entry0|r_landing',): kept.pop()
    out[k]=kept
out.update(manual)
v['vias']=out
json.dump(v,open('vias.json','w'),indent=0)
