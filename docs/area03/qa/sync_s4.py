# HISTORICAL (Opus 2026-10-03): one-shot generator used for stage 4. Do NOT rerun - the scene JSON has been edited by hand since
# (p_seat bench, leaf_seat, seat fixes, texts) and is now the source of truth.
import json, math
from s4data import *
S2=math.sqrt(.5)
scene=json.load(open('scene.new.json')); m=json.load(open('m_s4.json')); g=json.load(open('graph-s4.json'))
def near(S,u,v): return min(S,key=lambda q:(q[0]-u)**2+(q[1]-v)**2)
gn={n['id']:n for n in g['nodes']}
def mknode(id,old=None):
    n=dict(old or {}); G=gn[id]; M=m['nodes'][id]
    n.update(id=id,label=G['label'],u=G['u'],v=G['v'],kind=G['kind'])
    if 'face' in G: n['face']=G['face']
    n['y']=round(M['y'],3); n['world']=[round((n['u']-n['v'])*S2,4),n['y'],round(-(n['u']+n['v'])*S2,4)]
    n['spin']=M['spin']>=0
    n['clearance']={k:round(min(M[k],9),3) for k in ['body','brim','spin','reed']}
    return n
byid={n['id']:n for n in scene['nodes']}
for id in ['p_mirror','p_bench','p_table']:
    old=byid[id]; byid[id].clear(); byid[id].update(mknode(id,old))
    if id!='p_mirror': byid[id].pop('seat',None) if id=='p_table' else None
scene['nodes'].insert([n['id'] for n in scene['nodes']].index('p_west')+1, mknode('p_seat'))
# p_bench keeps its seat height (it is only a path node now): fine
# edges
drop={('p_entry','p_mirror'),('p_mirror','p_bench')}
scene['edges']=[e for e in scene['edges'] if (e['a'],e['b']) not in drop]
ge={(e['a'],e['b']):e for e in g['edges']}; me={(e['a'],e['b']):e for e in m['edges']}
for key in [('p_entry','p_bench'),('p_seat','p_lamp5'),('p_seat','p_mirror')]:
    E=ge[key]; M=me[key]
    e=dict(a=key[0],b=key[1],kind=E['kind'],via=[[p[0],p[1],near(M['S'],p[0],p[1])[2]] for p in E['via']],length=round(M['L'],3),minSurfaceY=min(q[2] for q in M['S']),maxSlope=round(M['maxSlope'],3),
      maxStoneGap=max([x[2] for x in M['gaps']]+[0]),maxDrop=max([abs(d[1]) for d in M['drops']]+[0]),minBodyClearance=round(min(M['minBody'],9),3),minBrimClearance=round(min(M['minBrim'],9),3),minReedDistance=round(min(M['minReed'],9),3),
      samples=M['n'],y=[q[2] for q in M['S']],hops=[x for x in M['gaps'] if x[2]>.3],steps=[[round(d[0]/M['H']),d[1]] for d in M['drops']])
    scene['edges'].append(e)
# refresh all other edges from the new measurement too (reed cut changes nothing for them, but keep numbers honest)
bad=[(e['a'],e['b']) for e in scene['edges'] if (e['a'],e['b']) not in me]
assert not bad,bad
ids=[n['id'] for n in scene['nodes']];ix={i:k for k,i in enumerate(ids)};N=len(ids);D=[[math.inf]*N for _ in ids]
for i in range(N):D[i][i]=0
for e in scene['edges']:
    i,j=ix[e['a']],ix[e['b']];D[i][j]=D[j][i]=e['length']
for k in range(N):
    for i in range(N):
        for j in range(N):D[i][j]=min(D[i][j],D[i][k]+D[k][j])
dm=max((D[i][j],ids[i],ids[j]) for i in range(N) for j in range(N))
scene['graphDiameter']={'from':dm[1],'to':dm[2],'distance':round(dm[0],2),'walkSecondsAtAppPace':round(dm[0]/.35)}
# spots
scene['spots']=[s for s in scene['spots'] if s['id'] not in ('p_bench','p_table')]
for s in scene['spots']:
    if s['id']=='p_mirror': s.update(face=gn['p_mirror']['face'],name='鏡框（西南緣欄杆外）',note='信物「背銀鏡片」（站在亭台西南緣、欄杆外）')
scene['spots'].append({'id':'p_seat','name':'亭台南緣（休息點）','face':gn['p_seat']['face'],'demoAnim':'sitGaze','tide':'any','note':'休息點；第一次休息的杯子倒扣在這裡的地面（SPEC 11.7，石凳拿掉）'})
# stage 4 sections
scene['events']=EVENTS+RARE
scene['restActivities']=REST
scene['departures']=DEPART
scene['departureDurationMs']=5000
scene['specialFinds']=SPECIAL
scene['worldMarks']=MARKS
nodeids=set(ids)
for e in scene['events']: assert e['spot'] in nodeids,e['id']
for r in REST: assert r['node'] in nodeids
for d in DEPART: assert d['exitNode'] in nodeids
json.dump(scene,open('scene.s4.json','w',encoding='utf-8'),ensure_ascii=False,indent=1); open('scene.s4.json','a').write('\n')
print('events',len(EVENTS),'+rare',len(RARE),'nodes',len(ids),'edges',len(scene['edges']),scene['graphDiameter'])
