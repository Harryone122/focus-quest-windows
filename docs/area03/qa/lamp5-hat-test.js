const { open } = require('./h.js');
(async () => {
  const { page, browser } = await open();
  const r = await page.evaluate(() => {
    __lake.setTime('day'); __lake.setTide(0); __lake.setWet(0); const I=__lake.internals(); const T=I.T; const lamp=I.LAMPS[4].obj; 
    const out=[]; let worst=9; let lb=null;
    for (let ph=0; ph<6.3; ph+=1.57) for (let d=0; d<=1.3; d+=0.05) {
      __lake.place('p_lamp5','p_entry',d,ph); for(let k=0;k<30;k++) __lake.advance(0.05,0.05);
      __lake.place('p_lamp5','p_entry',d,ph); __lake.hold(true);
      I.trav.updateWorldMatrix(true,true); lamp.updateWorldMatrix(true,true);
      lb=new T.Box3().setFromObject(lamp);
      const hits=[]; let tmax=-9;
      I.trav.traverse((o)=>{ if(o.isMesh){ const b=new T.Box3().setFromObject(o); tmax=Math.max(tmax,b.max.y); const gap=Math.max(lb.min.x-b.max.x,b.min.x-lb.max.x,lb.min.z-b.max.z,b.min.z-lb.max.z,lb.min.y-b.max.y,b.min.y-lb.max.y); if(gap<0.0) hits.push([o.geometry.type, +b.max.y.toFixed(2)]); } });
      if (hits.length) out.push([ph,d,hits]);
    }
    const tb=new T.Box3().setFromObject(I.trav); return {hits:out.slice(0,8), n:out.length, travTop: tb.max.y, footY: I.trav.position.y, lb:[lb.min.toArray().map(x=>+x.toFixed(2)), lb.max.toArray().map(x=>+x.toFixed(2))] };
  });
  console.log(JSON.stringify(r)); await browser.close();
})();
