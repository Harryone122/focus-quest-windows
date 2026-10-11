"""Apply the approved two-area prototype extension once, preserving its handoff."""
import json, math, pathlib, re, shutil
root = pathlib.Path(__file__).resolve().parents[3]
html_path = root / 'docs/prototypes/reflection-lake.html'
scene_path = root / 'docs/area03/area-03-reflection-lake.scene.json'
backup = root / 'previews/area03-before-tidal-areas'
backup.mkdir(exist_ok=True)
for p in [html_path, scene_path]:
    if not (backup / p.name).exists():
        shutil.copy2(p, backup / p.name)
html = html_path.read_text(encoding='utf-8')
assert '// approved tidal pocket areas' not in html, 'Already applied'
data = json.loads(scene_path.read_text(encoding='utf-8'))
new_nodes = [
    ('leaf_entry', '浮葉小庭入口', 6.7, -3.2, None),
    ('leaf_watch', '浮葉小庭水槽邊', 7.2, -4.3, [8.6, -4.3]),
    ('leaf_seat', '浮葉小庭石邊', 8.3, -5.8, [8.7, -4.5]),
    ('moon_entry', '缺月石廊入口', -9.3, 5.1, None),
    ('moon_watch', '缺月石廊圓窗前', -8.1, 6.0, [-7.1, 7.4]),
]
for id, label, u, v, face in new_nodes:
    node = dict(id=id, label=label, u=u, v=v, y=.11,
                world=[round((u-v)/math.sqrt(2),4), .11, round(-(u+v)/math.sqrt(2),4)],
                kind='tidal-pocket', spin=False, clearance=dict(body=9,brim=9,spin=9,reed=9))
    if face: node['face'] = face
    data['nodes'].append(node)
new_edges = [
    ('c_east','leaf_entry', [[6.2,-1.3],[6.5,-2.5]]),
    ('leaf_entry','leaf_watch', []),
    ('leaf_watch','leaf_seat', [[7.2,-5.2]]),
    ('r_lamp1','moon_entry', [[-10.95,1.6],[-10.6,2.8],[-9.8,4.0]]),
    ('moon_entry','moon_watch', []),
]
nodes = {n['id']:n for n in data['nodes']}
for a,b,via in new_edges:
    pts = [[nodes[a]['u'],nodes[a]['v']]]+via+[[nodes[b]['u'],nodes[b]['v']]]
    length=sum(math.dist(p,q) for p,q in zip(pts,pts[1:]))
    samples=math.ceil(length/.1)
    data['edges'].append(dict(a=a,b=b,kind='court',via=via,length=length,minSurfaceY=.11,maxSlope=0,maxStoneGap=0,maxDrop=0,
                             minBodyClearance=9,minBrimClearance=9,minReedDistance=9,samples=samples,y=[.11]*(samples+1),hops=[],steps=[]))
data['spots'] += [dict(id='leaf_watch',name='浮葉小庭',face=[8.6,-4.3],demoAnim='leafTouch',tide='high',note='看浮葉舒展，輕輕撥開腳旁葉片'),
                  dict(id='leaf_seat',name='浮葉小庭石邊',face=[8.7,-4.5],demoAnim='sitGaze',tide='low',note='坐在乾石邊看水槽'),
                  dict(id='moon_watch',name='缺月石廊',face=[-7.1,7.4],demoAnim='gazeDown',tide='any',note='滿潮時半圓石雕與倒影接成完整圓窗')]
data['tidalAreas'] = dict(approved='2026-10-01', leafGarden=dict(center=[8,-4.7],watch='leaf_watch',seat='leaf_seat'), moonGallery=dict(center=[-8,6.5],watch='moon_watch'), affectsRewards=False)

terrain = '''// approved tidal pocket areas (2026-10-01): the same stone routes at both tides.
const LEAF_POLY = [[5.9,-3.4],[6.8,-2.9],[8.5,-2.8],[10.1,-3.5],[10.6,-4.9],[9.8,-6.3],[8.2,-6.7],[6.4,-6.0],[5.8,-4.8]];
const MOON_POLY = [[-10.6,5.4],[-9.9,4.6],[-8.0,4.8],[-6.4,5.3],[-5.3,6.5],[-5.9,7.9],[-7.7,8.5],[-9.9,8.0],[-10.6,6.7]];
const LEAF_BASINS = [[8.7,-3.65,0.65],[9.3,-4.8,0.67],[7.5,-5.6,0.5]];
addF((u,v)=>sdPoly(u,v,LEAF_POLY),0.11,0.12,C_STONE,[5.6,10.8,-6.9,-2.6]);
addF((u,v)=>sdPoly(u,v,MOON_POLY),0.11,0.12,C_STONE,[-10.8,-5.1,4.4,8.7]);
const POCKET_PATHS = [[[5.3,0.5],[6.2,-1.3],[6.5,-2.5],[6.7,-3.2]], [[-10.95,0.35],[-10.95,1.6],[-10.6,2.8],[-9.8,4.0],[-9.3,5.1]]];
POCKET_PATHS.forEach(pts=>{for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1]; addF((u,v)=>sdCap(u,v,a,b,0.95),0.11,0.08,C_STONE,[Math.min(a[0],b[0])-.6,Math.max(a[0],b[0])+.6,Math.min(a[1],b[1])-.6,Math.max(a[1],b[1])+.6]);}});
'''
html = html.replace('function groundH(u, v)', terrain+'\nfunction groundH(u, v)')
assert terrain in html
geometry = '''// ---------- two tide-revealed pockets: stone routes, floating leaves, reflected moon windows ----------
const TIDAL = { leaves: [], flowers: [], arcs: [] };
prism(LEAF_POLY,-0.24,0.11,M.stone[1]);
prism(MOON_POLY,-0.24,0.11,M.stone[0]);
POCKET_PATHS.forEach(pts=>{ for(let i=0;i<pts.length-1;i++) segBox(pts[i],pts[i+1],0.95,-0.18,0.11,M.stone[2]); });
// Stone seams stop at the basins; plants grow beside the traveller's clear path.
for(let u=6.2;u<10.1;u+=0.72)for(let v=-6.3;v<-3.1;v+=0.7){
  if(sdPoly(u,v,LEAF_POLY)>-0.25 || LEAF_BASINS.some(b=>Math.hypot(u-b[0],v-b[1])<b[2]+.1))continue;
  L(new T.BoxGeometry(.61,.018,.58),M.stoneHi,GL,u,.12,v).receiveShadow=true;
}
const plantGreen=mat(0x587a60,{side:T.DoubleSide}), plantVein=mat(0x90a078), flowerPink=mat(0xd9b5b1,{side:T.DoubleSide}), flowerCream=mat(0xeee1c5,{side:T.DoubleSide});
[plantGreen,plantVein,flowerPink,flowerCream].forEach(m=>{m.userData.soft=true;});
LEAF_BASINS.forEach((b,bi)=>{
  const basin=G(b[0],b[1],0); basin.userData.noSolid=true;
  const rim=mesh(new T.TorusGeometry(b[2]+.08,.085,4,12),M.stoneDark,basin,0,.12,0); rim.rotation.x=-Math.PI/2;
  const soil=mesh(new T.CylinderGeometry(b[2],b[2],.016,12),M.mud[1],basin,0,.122,0);
  // Leaf positions rise with water; grouped static leaf meshes keep the draw budget small.
  const float=G(b[0],b[1],.145); float.userData.dyn=true; float.userData.noSolid=true;
  for(let j=0;j<4;j++){
    const a=j*1.65+bi*.7, x=Math.cos(a)*.4,z=Math.sin(a)*.36;
    const leaf=new T.Group(); leaf.position.set(x,0,z); leaf.rotation.y=-a; float.add(leaf);
    const shape=new T.Shape(); shape.moveTo(0,0); for(let k=0;k<=10;k++){const t=.24+k/10*(Math.PI*2-.48);shape.lineTo(Math.cos(t)*.42,Math.sin(t)*.32);} shape.lineTo(0,0);
    const blade=mesh(new T.ShapeGeometry(shape),plantGreen,leaf,0,.016,0); blade.rotation.x=-Math.PI/2;
    mesh(new T.BoxGeometry(.35,.009,.012),plantVein,leaf,-.16,.022,0);
    mergeUnder(leaf,{skipDyn:false,always:true}); TIDAL.leaves.push({o:leaf,bi,a,x,z});
  }
  const flower=new T.Group(); float.add(flower); flower.position.set(.06,.075,0);
  for(let j=0;j<8;j++){
    const petal=new T.Group();petal.rotation.y=j*Math.PI/4;flower.add(petal);
    const p=mesh(new T.IcosahedronGeometry(1,0),bi===1?flowerCream:flowerPink,petal,0,.08,.15);p.scale.set(.095,.15,.25);
    TIDAL.flowers.push({o:petal,bi});
  }
  mesh(new T.IcosahedronGeometry(.11,0),flowerCream,flower,0,.13,0);
  basin.userData.dyn=true; mergeUnder(basin,{skipDyn:false,always:true});
  TIDAL.leaves.push({float,bi});
});
// The seam is exactly the high-water plane. Low water exposes the short supports;
// high water hides them and mirrors each semicircle into a complete circle.
[[-9.35,7.2,.83],[-7.05,7.4,1.03],[-5.85,6.45,.64]].forEach((p,i)=>{
  const g=G(p[0],p[1],.30); const arc=mesh(new T.TorusGeometry(p[2],.145,5,14,Math.PI),i===1?M.stoneHi:M.stoneHi2,g,0,0,0);arc.castShadow=true;arc.receiveShadow=true;
  for(const s of [-1,1]){const leg=mesh(new T.BoxGeometry(.29,.21,.31),M.stoneDark,g,s*p[2],-.105,0);leg.castShadow=true;}
  TIDAL.arcs.push({center:[p[0],p[1]],radius:p[2],seam:.3});
});
// A low stone edge outside the circulation path doubles as the dry-tide seat.
segBox([7.8,-6.35],[9.05,-6.35],.32,.11,.32,M.stoneHi2);
function tidalUpdate(wl,time){
  const bloom=sstep(.07,.29,wl);
  TIDAL.leaves.forEach(l=>{if(l.float){l.float.position.y=Math.max(.145,wl+.023);return;}
    l.o.position.x=l.x*(.75+.45*bloom)+Math.sin(time*.38+l.a)*.025*bloom;
    l.o.position.z=l.z*(.75+.45*bloom)+Math.cos(time*.31+l.a)*.025*bloom;
    l.o.scale.setScalar(.55+.45*bloom);l.o.rotation.z=(1-bloom)*.24+Math.sin(time*.45+l.a)*.025*bloom;});
  TIDAL.flowers.forEach(p=>{p.o.rotation.x=-.1-.92*bloom;});
}
'''
html = html.replace('// ---- merge everything static into a few draw calls ----', geometry+'\n// ---- merge everything static into a few draw calls ----')
html = html.replace('water.position.y = WL; WU.uWL.value = WL;', 'water.position.y = WL; WU.uWL.value = WL; tidalUpdate(WL, tAcc);')
html = html.replace("if (key === 'inspect') tgt.headY", "if (key === 'leafTouch') { const e=Math.sin(Math.PI*prog); Object.assign(tgt,{hip:-.17,legX:-.6,lean:.3,headX:.55,armL:-.6-.45*e,armLz:-.18*e}); }\n  if (key === 'inspect') tgt.headY")
html = html.replace("<button id=\"tideBtn\" type=\"button\" class=\"quiet\">試看漲潮</button>", "<button id=\"tideBtn\" type=\"button\" class=\"quiet\">試看漲潮</button>\n    <button id=\"leafView\" type=\"button\" class=\"quiet\">浮葉小庭</button>\n    <button id=\"moonView\" type=\"button\" class=\"quiet\">缺月石廊</button>\n    <button id=\"wideView\" type=\"button\" class=\"quiet\">回到全景</button>")
html = html.replace('if (!Q.get(\'qa\')) { requestAnimationFrame(frame);', '''document.getElementById('leafView').addEventListener('click',()=>{__lake.focus(8,-4.7,.25,11);setStatus('浮葉小庭：試看漲潮，看看浮葉與花朵如何舒展。');});
document.getElementById('moonView').addEventListener('click',()=>{__lake.focus(-8,6.6,.5,11);setStatus('缺月石廊：滿潮時，半圓石雕與倒影接成圓窗。');});
document.getElementById('wideView').addEventListener('click',()=>{__lake.focus();});
if (!Q.get('qa')) { requestAnimationFrame(frame);''')
html = html.replace('  W, camera, scene, renderer, water\n', '  tidalAreas: () => ({ arcs: TIDAL.arcs, leaves: TIDAL.leaves.filter(l=>l.float).map(l=>({y:l.float.position.y})), bloom: sstep(.07,.29,WL) }),\n  W, camera, scene, renderer, water\n')
scene_path.write_text(json.dumps(data,ensure_ascii=False,indent=1)+'\n',encoding='utf-8')
html = re.sub(r'(<script type="application/json" id="area-data">)[\s\S]*?(</script>)',lambda m:m[1]+'\n'+scene_path.read_text(encoding='utf-8')+m[2],html,count=1)
html_path.write_text(html,encoding='utf-8')
design=json.loads((root/'docs/area03/qa/graph_design.json').read_text(encoding='utf-8'))
design['nodes'] += [dict(id=id,label=label,u=u,v=v,kind='tidal-pocket') for id,label,u,v,face in new_nodes]
design['edges'] += [dict(a=a,b=b,kind='court',via=via) for a,b,via in new_edges]
(root/'docs/area03/qa/graph-tidal.json').write_text(json.dumps(design,ensure_ascii=False,indent=2),encoding='utf-8')
print('Added two areas, five nodes and five edges; original handoff backed up.')
