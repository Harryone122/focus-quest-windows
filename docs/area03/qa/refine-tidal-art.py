"""Apply the user's material, architectural and moon-reflection revision."""
import pathlib, shutil, re
root=pathlib.Path(__file__).resolve().parents[3]
p=root/'docs/prototypes/reflection-lake.html'
backup=root/'previews/area03-before-material-revision';backup.mkdir(exist_ok=True)
for source in [p,root/'docs/area03/area-03-reflection-lake.scene.json']:
    if not (backup/source.name).exists():shutil.copy2(source,backup/source.name)
h=p.read_text(encoding='utf-8')
assert 'function pocketPaving' not in h, 'Already applied'
start=h.index('prism(LEAF_POLY,-0.24,0.11,M.stone[1]);')
end=h.index('const plantGreen=',start)
floor='''// The original raised checker tiles emerged individually while the tide crossed
// y=.11..129. All flagstone tops now share y=.11; the mortar bed stays below them.
const POCKET_STONE = M.stone;
const POCKET_CRACK=mat(0x756f61), POCKET_MOSS=mat(0x6d7a57);
[POCKET_CRACK,POCKET_MOSS].forEach(m=>{m.userData.soft=true;});
const artRandom=mulberry(0x17d5a9), ar=(a,b)=>a+(b-a)*artRandom();
function clipPaving(poly,boundary){
  const area=boundary.reduce((sum,p,i)=>{const q=boundary[(i+1)%boundary.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
  for(let k=0;k<boundary.length;k++){
    const a=boundary[k],b=boundary[(k+1)%boundary.length],input=poly;poly=[];
    const side=p=>((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))*Math.sign(area);
    for(let i=0;i<input.length;i++){const s=input[i],e=input[(i+1)%input.length],ds=side(s),de=side(e);
      if(ds>=0)poly.push(s);if((ds>=0)!==(de>=0)){const t=ds/(ds-de);poly.push([s[0]+(e[0]-s[0])*t,s[1]+(e[1]-s[1])*t]);}}
    if(poly.length<3)break;
  }return poly;
}
function pocketPaving(P,basins){
  const floor=prism(P,-.24,.084,M.stone[3]);floor.receiveShadow=true;floor.castShadow=true;
  const minU=Math.min(...P.map(p=>p[0])),maxU=Math.max(...P.map(p=>p[0])),minV=Math.min(...P.map(p=>p[1])),maxV=Math.max(...P.map(p=>p[1]));
  let row=0;for(let v=minV;v<maxV;){const rh=ar(.58,.88);let u=minU-ar(.15,.75);
    while(u<maxU){const width=ar(.65,1.24),gap=.027,c=ar(.04,.09),x=u+gap,z=v+gap,w=width-gap*2,d=rh-gap*2;
      let pts=[[x+c,z],[x+w-c,z],[x+w,z+c],[x+w,z+d-c],[x+w-c,z+d],[x+c,z+d],[x,z+d-c],[x,z+c]];
      pts=clipPaving(pts,P);const cu=u+width/2,cv=v+rh/2;
      if(pts.length>=3 && !basins.some(b=>Math.hypot(cu-b[0],cv-b[1])<b[2]+.23)){
        const stone=prism(pts,.077,.11,POCKET_STONE[Math.floor(ar(0,4))]);stone.castShadow=true;stone.receiveShadow=true;
        // A few hairline cracks and muted lichen patches, kept below ankle height.
        if(sdPoly(cu,cv,P)<-.35 && artRandom()<.17){const crack=L(new T.BoxGeometry(.013,.002,ar(.18,.36)),POCKET_CRACK,GL,cu,.112,cv);crack.rotation.y=ar(-.8,.8);}
        if(sdPoly(cu,cv,P)<-.3 && artRandom()<.10){const moss=L(new T.IcosahedronGeometry(ar(.045,.095),0),POCKET_MOSS,GL,cu,.112,cv);moss.scale.set(1,.055,.6);}
      }u+=width;
    }v+=rh;row++;
  }
  // Individual, irregular edge stones give the island a built, weathered section.
  P.forEach((a,i)=>{const b=P[(i+1)%P.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/.65);
    for(let j=0;j<n;j++){const t0=(j+.035)/n,t1=(j+.965)/n;segBox([a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1],.12,-.19,.108,POCKET_STONE[(i+j)%4]);}});
}
pocketPaving(LEAF_POLY,LEAF_BASINS);pocketPaving(MOON_POLY,[]);
POCKET_PATHS.forEach(pts=>{for(let i=0;i<pts.length-1;i++){
  const a=pts[i],b=pts[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/.75);
  segBox(a,b,.95,-.18,.084,M.stone[3]);
  for(let j=0;j<n;j++){const t0=(j+.02)/n,t1=(j+.98)/n;segBox([a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1],.91,.072,.11,POCKET_STONE[j%4]);}
}});
'''
h=h[:start]+floor+h[end:]
start=h.index('// The seam is exactly the high-water plane.')
end=h.index('// A low stone edge',start)
arch='''// A surviving moon window in a ruined lakeside wall, built from cut voussoirs.
// One strong architectural silhouette replaces the three freestanding rings.
{
  const cu=-7.05,cv=7.4,R=1.08,th=.31,g=G(cu,cv,.30),count=13;
  for(let i=0;i<count;i++){
    const a=i*Math.PI/count+.009,b=(i+1)*Math.PI/count-.009;
    const sh=new T.Shape();sh.moveTo(Math.cos(a)*(R+th),Math.sin(a)*(R+th));sh.absarc(0,0,R+th,a,b,false);
    sh.lineTo(Math.cos(b)*(R-.045),Math.sin(b)*(R-.045));sh.absarc(0,0,R-.045,b,a,true);sh.closePath();
    const geo=new T.ExtrudeGeometry(sh,{depth:.50,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:1,curveSegments:3});geo.translate(0,0,-.25);
    const o=mesh(geo,POCKET_STONE[(i+1)%4],g);o.castShadow=true;o.receiveShadow=true;
    // A recessed reveal on the front face catches the grazing light.
    const lip=mesh(new T.TorusGeometry(R-.01,.022,4,3,b-a),M.stoneHi2,g,0,0,.277);lip.rotation.z=a;
  }
  // Carved keystone, stepped spring blocks and broken masonry make the gate read as a place.
  const key=mesh(new T.BoxGeometry(.24,.19,.59),M.stoneHi2,g,0,R+th-.005,0);key.rotation.z=.025;key.castShadow=true;
  for(const s of [-1,1]){
    mesh(new T.BoxGeometry(.42,.22,.63),POCKET_STONE[2],g,s*(R+.12),-.11,0).castShadow=true;
    mesh(new T.BoxGeometry(.47,.055,.67),M.stoneHi2,g,s*(R+.12),.026,0).castShadow=true;
  }
  TIDAL.arcs.push({center:[cu,cv],radius:R,seam:.3,style:'weathered-masonry-moon-window'});
}
// Broken wall remnants stay behind the clear viewing route.
segBox([-10.15,7.1],[-9.45,7.7],.38,.11,.42,M.stone[3]);
segBox([-10.05,7.15],[-9.75,7.42],.39,.42,.66,M.stone[1]);
segBox([-5.85,7.1],[-5.9,7.85],.34,.11,.40,M.stone[2]);
for(const p of [[-9.8,7.85,.15],[-6.0,8.05,.13],[-9.45,8.1,.11]]){const r=L(new T.DodecahedronGeometry(p[2],0),M.stoneHi2,GL,p[0],.11+p[2]*.45,p[1]);r.scale.set(1.5,.5,.8);r.rotation.y=.7;r.castShadow=true;}
'''
h=h[:start]+arch+h[end:]
# Full moon is part of the water's reflected sky, occluded by actual prop reflections.
anchor="'  sky = mix(sky, uHaze, hazeK * 0.9);',"
moon="""// The reflected moon has a fixed lake-space bearing; ripple shear breaks its edge
// into narrow, slowly moving horizontal bands. It is not a floating scene object.
'  vec2 moonP = uv - vec2(-8.0, -8.4);',
'  float moonWave = sin(moonP.y * 21.0 + uTime * 0.82) * 0.040 + sin(moonP.y * 37.0 - uTime * 0.53) * 0.017;',
'  moonP.x += moonWave * ringMask; moonP.y += sin(moonP.x * 4.0 + uTime * 0.44) * 0.028 * ringMask;',
'  vec2 md = moonP / vec2(1.72, 3.34); float mr = length(md);',
'  float moonDisk = 1.0 - smoothstep(0.96, 1.025, mr);',
'  float crater = 0.80 + 0.15 * fbm(md * 5.6 + vec2(8.7, 2.2));',
'  crater -= 0.12 * exp(-length(md - vec2(-0.27, 0.12)) * 7.0) + 0.07 * exp(-length(md - vec2(0.3, -0.24)) * 9.0);',
'  float bands = 0.93 + 0.07 * sin(moonP.y * 25.0 + uTime * 0.76);',
'  float moonNight = smoothstep(0.65, 0.97, uStar);',
'  float moonHalo = exp(-mr * mr * 2.6) * 0.065;',
'  sky += vec3(0.64, 0.76, 0.90) * moonHalo * moonNight;',
'  sky = mix(sky, vec3(0.87, 0.91, 0.92) * crater * bands, moonDisk * moonNight * 0.90);',"""
h=h.replace(anchor,anchor+'\n'+moon)
# Suppress flat, strongly bounded floor colour at high water, preserve low-water shallows.
h=h.replace("'  float kk = 0.28 * (1.0 - smoothstep(0.02, 0.6, dp));',", "'  float kk = 0.28 * (1.0 - smoothstep(0.02, 0.6, dp)) * mix(1.0, 0.30, uTide);',")
h=h.replace("bloom: sstep(.07,.29,WL) }),", "bloom: sstep(.07,.29,WL), moonNight: sstep(.65,.97,cur.star) }),")
p.write_text(h,encoding='utf-8')
print('Rebuilt weathered paving and masonry moon window; added rippled full-moon reflection.')
