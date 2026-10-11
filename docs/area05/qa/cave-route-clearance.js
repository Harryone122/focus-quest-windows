// Cave interior route clearance: samples the three cave routes every 0.2 units, rays at 3 heights x 10 directions (r 0.3-0.36), plus a downward ray for the floor.
// Run against the prototype with qa/run.js: node run.js ../../prototypes/echo-valley.html cave-route-clearance.js  (it enters the cave first)
__quarry.cave.enter(); __quarry.cave.run(1);
(()=>{ const C=__quarry.cave.M, G=C.G; G.updateMatrixWorld(true); const tr=new Set(); __quarry.TR && 0; 
 const trav=[]; G.traverse(o=>{}); const skip=new Set(); let travRoot=null; G.children.forEach(c=>{ if(c.isGroup && c.children.length>=1 && c.children[0].isGroup && c.scale.x===1.15) travRoot=c; });
 if(travRoot) travRoot.traverse(o=>skip.add(o));
 const solids=[], floors=[]; G.traverse(o=>{ if(!o.isMesh||skip.has(o)) return; let v=true,q=o; while(q){ if(!q.visible) v=false; q=q.parent;} if(!v) return; if(o.material&&(o.material.blending===THREE.AdditiveBlending||o.material.isShaderMaterial||o.material.type==='SpriteMaterial')) return; if(o.isInstancedMesh) return; if(o.geometry.type==='PlaneGeometry'&&o.geometry.parameters.width>30) return; if(o.userData.floor) floors.push(o); else solids.push(o); });
 const RC=new THREE.Raycaster(); const N=C.NODES; const res={hits:[],float:[],samples:0};
 const routes=Object.values(C.ROUTES);
 routes.forEach(rt=>{ for(let k=0;k<rt.length-1;k++){ const A=N[rt[k]],B=N[rt[k+1]], L=Math.hypot(B[0]-A[0],B[1]-A[1]); const n=Math.max(1,Math.ceil(L/0.2)); for(let i=0;i<=n;i++){ const t=i/n, x=A[0]+(B[0]-A[0])*t, z=A[1]+(B[1]-A[1])*t, y=A[2]+(B[2]-A[2])*t; res.samples++;
   const wp=new THREE.Vector3(x,0,z).applyMatrix4(G.matrixWorld);
   for(const h of [0.3,0.85,1.4]) for(let a=0;a<10;a++){ const ang=a/10*6.283; const r= h>1.3?0.36:0.3; RC.set(new THREE.Vector3(wp.x,y+h,wp.z),new THREE.Vector3(Math.cos(ang),0,Math.sin(ang))); RC.far=r; const hit=RC.intersectObjects(solids,false); if(hit.length){ res.hits.push([rt[k]+'-'+rt[k+1],+x.toFixed(2),+z.toFixed(2),h,hit[0].object.geometry.type,+hit[0].point.y.toFixed(2)]); break; } }
   RC.set(new THREE.Vector3(wp.x,y+1.0,wp.z),new THREE.Vector3(0,1,0)); RC.far=0.6; const up=RC.intersectObjects(solids,false); if(up.length) res.hits.push(['overhead',x,z]);
   RC.set(new THREE.Vector3(wp.x,y+0.6,wp.z),new THREE.Vector3(0,-1,0)); RC.far=2; const dn=RC.intersectObjects(floors,false); const gy=dn.length?dn[0].point.y:-9; if(Math.abs(gy-y)>0.07) res.float.push([rt[k]+'-'+rt[k+1],+x.toFixed(2),+z.toFixed(2),+y.toFixed(2),+gy.toFixed(2)]); } } });
 const uniq=a=>{const m=new Map(); a.forEach(h=>{const k=h[0]; if(!m.has(k)) m.set(k,{n:0,first:h}); m.get(k).n++;}); return [...m.values()];};
 return {samples:res.samples, hits:uniq(res.hits), float:uniq(res.float)}; })()
