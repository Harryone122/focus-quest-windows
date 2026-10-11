"""Refresh only the approved new route surfaces from an independent measurement."""
import json, math, pathlib, re
root = pathlib.Path(__file__).resolve().parents[3]
scene = root / 'docs/area03/area-03-reflection-lake.scene.json'
data = json.loads(scene.read_text(encoding='utf-8'))
measure = json.loads((root/'docs/area03/qa/measure-tidal.json').read_text(encoding='utf-8'))
for node in data['nodes']:
    if node['kind'] != 'tidal-pocket': continue
    m=measure['nodes'][node['id']]
    node['y']=round(m['y'],3); node['world'][1]=node['y']
    if node['id'] == 'leaf_seat': node['seat'] = .21
    node['clearance']={k:round(min(m[k],9),3) for k in ['body','brim','spin','reed']}
for e,m in zip(data['edges'],measure['edges']):
    assert (e['a'],e['b']) == (m['a'],m['b'])
    if not any(n in e['a']+' '+e['b'] for n in ['leaf_','moon_']): continue
    e.update(length=round(m['L'],3),samples=m['n'],y=[q[2] for q in m['S']],minSurfaceY=min(q[2] for q in m['S']),
             maxSlope=round(m['maxSlope'],3),maxStoneGap=max([g[2] for g in m['gaps']]+[0]),maxDrop=max([abs(d[1]) for d in m['drops']]+[0]),
             hops=[g for g in m['gaps'] if g[2]>.3],steps=[[round(d[0]/m['H']),d[1]] for d in m['drops']],
             minBodyClearance=round(min(m['minBody'],9),3),minBrimClearance=round(min(m['minBrim'],9),3),minReedDistance=round(min(m['minReed'],9),3))
ids=[n['id'] for n in data['nodes']];ix={id:i for i,id in enumerate(ids)};N=len(ids);D=[[math.inf]*N for _ in ids]
for i in range(N):D[i][i]=0
for e in data['edges']:
    i,j=ix[e['a']],ix[e['b']];D[i][j]=D[j][i]=e['length']
for k in range(N):
    for i in range(N):
        for j in range(N):D[i][j]=min(D[i][j],D[i][k]+D[k][j])
dm=max((D[i][j],ids[i],ids[j]) for i in range(N) for j in range(N))
data['graphDiameter']={'from':dm[1],'to':dm[2],'distance':round(dm[0],2),'walkSecondsAtAppPace':round(dm[0]/.35)}
s=json.dumps(data,ensure_ascii=False,indent=1)+'\n';scene.write_text(s,encoding='utf-8')
hp=root/'docs/prototypes/reflection-lake.html';html=hp.read_text(encoding='utf-8')
html=re.sub(r'(<script type="application/json" id="area-data">)[\s\S]*?(</script>)',lambda m:m[1]+'\n'+s+m[2],html,count=1)
hp.write_text(html,encoding='utf-8')
print('New route surfaces refreshed; JSON synchronized.')
