// Cave mouth: no rock lump vertex and no terrain may lie inside the tunnel volume.
(()=>{ // any lump vertex inside the tunnel volume?
 const g=window.__cave, T=window.__caveTun; g.updateMatrixWorld(true); const inv=new THREE.Matrix4().copy(g.matrixWorld).invert(); let bad=[];
 const halfAt=(z,y)=>{ // tunnel cross-section at depth -z: interpolate ring polygons -> test point inside polygon
   const d=-z; if(d<0||d>T.secs[T.secs.length-1]) return null; let k=0; while(k<T.secs.length-2&&d>T.secs[k+1])k++; const t=(d-T.secs[k])/(T.secs[k+1]-T.secs[k]); return T.R[k].map((p,i)=>[p[0]+(T.R[k+1][i][0]-p[0])*t,p[1]+(T.R[k+1][i][1]-p[1])*t]); };
 const inside=(poly,x,y)=>{let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,yi]=poly[i],[xj,yj]=poly[j]; if(((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c;} return c;};
 window.__caveLumps.forEach((o,li)=>{o.updateMatrixWorld(true);const p=o.geometry.attributes.position,v=new THREE.Vector3();let n=0;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).applyMatrix4(inv);const poly=halfAt(v.z,v.y);if(poly&&inside(poly,v.x,v.y))n++;} if(n)bad.push([li,n]);});
 // terrain inside tunnel?
 let tb=0; for(let d=0;d<=1.0;d+=0.05) for(let x=-1.2;x<=1.2;x+=0.1){const poly=halfAt(-d,0); const v=new THREE.Vector3(x,0,-d); if(!poly)continue; const w=v.clone().applyMatrix4(g.matrixWorld); const ty=__quarry.yAt(w.x,w.z)-1.6; if(ty>0.03 && inside(halfAt(-d,ty),x,ty)) tb++;}
 return {bad,terrainInTunnel:tb};})()
