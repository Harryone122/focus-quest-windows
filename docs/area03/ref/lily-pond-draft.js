// 浮葉小庭 睡蓮池 — Opus 草稿（2026-10-01 寫、未執行測試）。規格以 SPEC.md 第 9 節為準，這份只是起點。
// 用法：取代 reflection-lake.html 裡 Codex 的 LEAF_BASINS 水槽、葉片、花朵與舊 tidalUpdate。
// 需要先把地形定義換成下面這段（取代 LEAF_POLY / LEAF_BASINS / 兩個 addF）：
//
// const LEAF_POLY = [[9.85,-3.35],[10.5,-2.95],[11.4,-2.75],[12.5,-2.7],[13.4,-2.95],[14.15,-3.45],[14.55,-4.2],[14.6,-5.0],[14.2,-5.8],[13.7,-6.35],[12.9,-6.65],[12.0,-6.7],[11.1,-6.4],[10.4,-5.95],[9.95,-5.3],[9.75,-4.5]];
// const LEAF_POND = [[11.8,-4.0],[12.0,-3.52],[12.55,-3.28],[13.3,-3.32],[13.82,-3.75],[13.97,-4.45],[13.72,-5.08],[13.1,-5.36],[12.42,-5.3],[12.0,-5.02],[11.76,-4.55]];
// const POND_FLOOR = -0.07;
// addF((u,v)=>Math.max(sdPoly(u,v,LEAF_POLY),-sdPoly(u,v,LEAF_POND)),0.11,0.12,C_STONE,[9.6,14.8,-6.9,-2.5]);
// addF((u,v)=>sdPoly(u,v,LEAF_POND),POND_FLOOR,0.06,C_MUD,[11.6,14.1,-5.5,-3.1]);
//
// pocketPaving 要加第三個參數 hole：鋪面底板挖掉池塘（Shape.holes），任何頂點落在池塘 0.07 以內的石板跳過。
// tidalAreas 測試入口：leaves 改成回傳每片葉子的高度（不再用 l.float）。
// 已知要檢查：InstancedMesh 的 setColorAt（r128 可用）、花瓣 Euler 順序 'YXZ'、捲葉的 rotateZ 方向、繪製數。

pocketPaving(LEAF_POLY,[],LEAF_POND);pocketPaving(MOON_POLY,[]);
POCKET_PATHS.forEach(pts=>{for(let i=0;i<pts.length-1;i++){
  const a=pts[i],b=pts[i+1],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(len/.75);
  segBox(a,b,.95,-.18,.084,M.stone[3]);
  for(let j=0;j<n;j++){const t0=(j+.02)/n,t1=(j+.98)/n;segBox([a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1],.91,.072,.11,POCKET_STONE[j%4]);}
}});

// =====================================================================
// 浮葉小庭 (Opus 2026-10-01): a sunken lily pond. Low tide: a shallow pond, young leaves still rolled, buds shut.
// As the water climbs over the terrace the pads unroll and lie flat, and the water lilies open, staggered.
// Pads, petals and flower hearts are three InstancedMeshes (3 draws); everything else merges with the stone.
// =====================================================================
{
  // pond bed (it sits under the water at every tide; the baked bottom colour shows through)
  prism(LEAF_POND,-.3,POND_FLOOR,M.mud[1]).receiveShadow=true;
  // rim stones: flush, flat stones on the walking (west) side, rounder ones elsewhere; all drown at high tide
  const pr=mulberry(0x51ee7a), pq=(a,b)=>a+(b-a)*pr();
  const RIMM=[POCKET_STONE[0],POCKET_STONE[2],POCKET_STONE[3],M.stoneDark];
  for(let i=0;i<LEAF_POND.length;i++){
    const a=LEAF_POND[i],b=LEAF_POND[(i+1)%LEAF_POND.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(2,Math.round(len/.24));
    const nx=(b[1]-a[1])/len,ny=-(b[0]-a[0])/len; // outward normal (polygon is clockwise in u,v)
    for(let j=0;j<n;j++){const t=(j+pq(.25,.75))/n,u=a[0]+(b[0]-a[0])*t+nx*.04,v=a[1]+(b[1]-a[1])*t+ny*.04;
      const west=u<12.15, r=west?pq(.11,.15):pq(.09,.16), top=west?pq(.118,.132):pq(.13,.2);
      const st=L(bumpGeo(new T.DodecahedronGeometry(1,0),.12,i*7+j+3),RIMM[(i+j)%RIMM.length],GL,u,(top+POND_FLOOR)/2,v);
      st.scale.set(r*pq(1,1.35),(top-POND_FLOOR)/2,r);st.rotation.y=pq(0,3.1);st.castShadow=true;st.receiveShadow=true;
      if(!west&&pr()<.3){const mo=L(new T.IcosahedronGeometry(r*.55,0),M_MOSS2,GL,u,top+.004,v);mo.scale.set(1,.25,.8);}
    }
  }
  // one upright garden rock at the pond's east shoulder: the vertical the pond reflects
  {const g=G(14.12,-4.12,.11,.4);
    [[0,0,0,.30,.26,.24],[.03,.30,.02,.22,.2,.19],[-.04,.52,.04,.17,.16,.14],[.02,.68,-.01,.11,.09,.1]].forEach((q,i)=>{const o=mesh(bumpGeo(new T.DodecahedronGeometry(1,1),.16,40+i),[M.rock[1],M.rock[3],M.rock[0],M.rock[2]][i],g,q[0],q[1],q[2]);o.scale.set(q[3],q[4],q[5]);o.rotation.set(.15*i,.9*i,-.1*i);o.castShadow=true;o.receiveShadow=true;});
    const mo=mesh(new T.IcosahedronGeometry(.12,0),M_MOSS2,g,-.1,.42,.12);mo.scale.set(1,.3,.7);}
  // three clumps of iris (sword leaves + a few violet flowers); they sway with the reeds
  const irisM=[mat(0x5f8257,{side:T.DoubleSide}),mat(0x4f7350,{side:T.DoubleSide}),mat(0x6e8f5c,{side:T.DoubleSide})], irisF=mat(0x7d70b4,{side:T.DoubleSide}), irisY=mat(0xe2c35c);
  [[12.35,-3.02,1],[13.55,-3.12,.85],[13.98,-5.42,.8],[10.25,-5.45,.7]].forEach((c,ci)=>{
    const g=dyn(G(c[0],c[1],.11));
    const nL=8+ci%3;
    for(let k=0;k<nL;k++){const h=pq(.42,.72)*c[2],w=pq(.035,.05),ang=pq(0,6.28),lean=pq(.08,.32);
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute([-w,0,0, w,0,0, w*.25,h*.62,0, -w*.25,h*.62,0, 0,h,0],3));geo.setIndex([0,1,2, 0,2,3, 3,2,4]);geo.computeVertexNormals();
      const lf=mesh(geo,irisM[k%3],g,pq(-.12,.12),0,pq(-.12,.12));lf.rotation.set(lean,ang,pq(-.1,.1));}
    for(let k=0;k<(ci===1?1:2);k++){const h=pq(.5,.68)*c[2],x=pq(-.08,.08),z=pq(-.08,.08);
      mesh(new T.CylinderGeometry(.007,.009,h,4),irisM[0],g,x,h/2,z);
      for(let p=0;p<3;p++){const a=p*2.094+k;const fall=mesh(new T.ConeGeometry(.035,.09,4),irisF,g,x+Math.cos(a)*.035,h-.01,z+Math.sin(a)*.035);fall.rotation.set(Math.cos(a)*1.9,0,-Math.sin(a)*1.9);
        const std=mesh(new T.ConeGeometry(.022,.08,4),irisF,g,x+Math.cos(a+1.05)*.012,h+.045,z+Math.sin(a+1.05)*.012);std.rotation.set(Math.cos(a+1.05)*.3,0,-Math.sin(a+1.05)*.3);}
      mesh(new T.SphereGeometry(.012,4,3),irisY,g,x,h+.01,z);}
    mergeUnder(g,{skipDyn:false,always:true});R.reeds.push({o:g,ph:pq(0,6),amp:.035});
  });
  // the dry-tide seat: a long weathered slab on two low stones (same footprint as before, so leaf_seat still fits)
  {const a=[11.8,-6.35],b=[13.05,-6.35];segBox(a,b,.32,.11,.27,POCKET_STONE[3]);
    const top=weatherPocket(segBox([11.76,-6.36],[13.09,-6.33],.38,.27,.33,POCKET_STONE[0]));top.castShadow=true;}

  // --- lily pads (instanced) ---
  const padGeo=(()=>{const n=16,notch=.42,pos=[0,0,0];for(let i=0;i<=n;i++){const t=notch/2+i/n*(Math.PI*2-notch);const r=1+.035*Math.sin(t*5+1);pos.push(Math.cos(t)*r,.055,Math.sin(t)*r);}
    const idx=[];for(let i=1;i<=n;i++)idx.push(0,i+1,i);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
    const col=[];for(let i=0;i<pos.length/3;i++)col.push(...(i===0?[.86,.9,.8]:[1,1,1]));g.setAttribute('color',new T.Float32BufferAttribute(col,3));return g;})();
  const padM=mat(0xffffff,{side:T.DoubleSide,vertexColors:true});padM.userData.soft=true;
  const PADS=[];const clear=[13.15,-4.55,.42];
  for(let tries=0;PADS.length<36&&tries<4000;tries++){
    const u=pq(11.7,14.0),v=pq(-5.4,-3.2);const r=pq(.11,.27)*(pr()<.25?1.25:1);
    if(sdPoly(u,v,LEAF_POND)>-(r*.55+.08))continue;if(Math.hypot(u-clear[0],v-clear[1])<clear[2]+r*.5)continue;
    if(PADS.some(p=>Math.hypot(p.u-u,p.v-v)<(p.r+r)*.82))continue;
    PADS.push({u,v,r,a:pq(0,6.28),ph:pq(0,6.28),k:PADS.length});
  }
  const padIM=new T.InstancedMesh(padGeo,padM,PADS.length);padIM.castShadow=false;padIM.receiveShadow=true;padIM.userData.noSolid=true;padIM.frustumCulled=false;scene.add(padIM);
  const PADC=[new T.Color(0x5e8a5c),new T.Color(0x6c9963),new T.Color(0x4f7b57),new T.Color(0x77a068),new T.Color(0x5a8065)];
  PADS.forEach((p,i)=>{p.col=PADC[i%PADC.length].clone().multiplyScalar(pq(.92,1.05));if(pr()<.2)p.col.lerp(new T.Color(0x8a6a52),.35);});
  // --- water lilies: petals and green sepals share one instanced mesh; hearts are another ---
  const petalGeo=(()=>{const w=.42,cr=-.07;const P=[0,0,0, -w,0,.42, 0,cr,.5, w,0,.42, 0,0,1];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(P,3));g.setIndex([0,2,1, 0,3,2, 1,2,4, 2,3,4]);g.computeVertexNormals();
    g.setAttribute('color',new T.Float32BufferAttribute([.82,.8,.72, .95,.94,.9, .92,.9,.86, .95,.94,.9, 1,1,1],3));return g;})();
  const petalM=mat(0xffffff,{side:T.DoubleSide,vertexColors:true,roughness:.8});petalM.userData.soft=true;
  const FL=[];const FLC=[0xf6f1e8,0xf3b9c6,0xf6f1e8,0xeea9b8,0xf7e7b4,0xf3c3cd,0xf6f1e8];
  const hosts=PADS.slice().sort((a,b)=>b.r-a.r);
  for(const h of hosts){if(FL.length>=7)break;if(FL.some(f=>Math.hypot(f.u-h.u,f.v-h.v)<.55))continue;
    FL.push({u:h.u+Math.cos(h.a+3.14)*h.r*.35,v:h.v+Math.sin(h.a+3.14)*h.r*.35,pad:h,c:new T.Color(FLC[FL.length]),d:pq(0,.42),yaw:pq(0,6.28),s:pq(.9,1.12)});}
  const NPF=20;const petIM=new T.InstancedMesh(petalGeo,petalM,FL.length*NPF);petIM.castShadow=true;petIM.receiveShadow=true;petIM.userData.noSolid=true;petIM.frustumCulled=false;scene.add(petIM);
  const SEPAL=new T.Color(0x5d8456);
  FL.forEach((f,fi)=>{for(let k=0;k<NPF;k++){const c=k<4?SEPAL:(k<12?f.c:f.c.clone().lerp(new T.Color(0xffffff),.12).multiplyScalar(k<12?1:.97));petIM.setColorAt(fi*NPF+k,c);}});
  const heartM=mat(0xe7c25b,{roughness:.7});heartM.userData.soft=true;
  const heartIM=new T.InstancedMesh(new T.CylinderGeometry(.034,.03,.03,7),heartM,FL.length);heartIM.userData.noSolid=true;heartIM.frustumCulled=false;scene.add(heartIM);
  const D=new T.Object3D();
  TIDAL.pond={padIM,petIM,heartIM,PADS,FL,D};
  TIDAL.leaves=PADS;TIDAL.flowers=FL;
}

function tidalUpdate(wl,time){
  const P=TIDAL.pond; if(!P) return;
  const bloom=sstep(.06,.28,wl), surf=Math.max(wl,POND_FLOOR+.03)+.004, D=P.D, col=new T.Color(), dull=new T.Color(0x6b7150);
  P.PADS.forEach((p,i)=>{
    const open=sstep(-.15,.75,bloom*1.3-(i%7)*.04);           // pads unroll a little ahead of the flowers
    const dr=.018*open*Math.sin(time*.23+p.ph);
    D.position.copy(W(p.u+dr,p.v+.018*open*Math.cos(time*.19+p.ph),surf+i*.0004));
    D.rotation.set(0,rotY(p.a+.06*Math.sin(time*.17+p.ph)*open),0);
    const curl=1-open;                                            // rolled young leaf: narrow, cupped, tilted up
    D.scale.set(p.r*(.5+.5*open),p.r*(1+3.2*curl),p.r*(.28+.72*open));
    D.updateMatrix();
    if(curl>.01){D.rotateZ(curl*.55);D.updateMatrix();}
    P.padIM.setMatrixAt(i,D.matrix);
    col.copy(p.col).lerp(dull,.35*curl);P.padIM.setColorAt(i,col);
  });
  P.padIM.instanceMatrix.needsUpdate=true;if(P.padIM.instanceColor)P.padIM.instanceColor.needsUpdate=true;
  const deg=Math.PI/180;
  P.FL.forEach((f,fi)=>{
    const b=sstep(f.d,f.d+.55,bloom), s=f.s*(.78+.22*b);
    const cy=surf+.012+.03*(1-b), bob=.006*Math.sin(time*.6+fi);
    const cu=f.u+.016*b*Math.sin(time*.23+f.pad.ph), cv=f.v+.016*b*Math.cos(time*.19+f.pad.ph);
    for(let k=0;k<20;k++){
      let n,j,L0,a,off;
      if(k<4){n=4;j=k;L0=.17;a=(72-62*b)*deg;off=Math.PI/4;}
      else if(k<12){n=8;j=k-4;L0=.165;a=(80-56*b)*deg;off=Math.PI/8;}
      else{n=8;j=k-12;L0=.125;a=(86-38*b)*deg;off=0;}
      D.position.copy(W(cu,cv,cy+bob+(k<4?-.004:k<12?0:.006)));
      D.rotation.set(0,0,0);D.updateMatrix();
      D.rotation.order='YXZ';D.rotation.set(-a,rotY(f.yaw)+off+j*2*Math.PI/n,0);
      D.scale.set(L0*s*.36,L0*s,L0*s);D.updateMatrix();P.petIM.setMatrixAt(fi*20+k,D.matrix);
    }
    D.rotation.order='XYZ';D.rotation.set(0,0,0);D.position.copy(W(cu,cv,cy+bob+.012));D.scale.setScalar(s*(.4+.6*b));D.updateMatrix();P.heartIM.setMatrixAt(fi,D.matrix);
  });
  P.petIM.instanceMatrix.needsUpdate=true;P.heartIM.instanceMatrix.needsUpdate=true;
}
