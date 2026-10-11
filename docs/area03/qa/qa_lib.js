// shared in-page QA helpers (BVH raycasts against the visible solid meshes). Injected with page.evaluate; QA only.
module.exports = `
(() => {
  const Q = window.__lake.internals(); const { T, scene, W, toUV, trav } = Q;
  const B = window.MeshBVHLib; T.Mesh.prototype.raycast = B.acceleratedRaycast;
  scene.updateMatrixWorld(true);
  const targets = [];
  const isNoSolid = (o) => { for (let q = o; q; q = q.parent) { if (q.userData && q.userData.noSolid) return true; if (q.visible === false) return true; } return false; };
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || isNoSolid(o)) return; const m = o.material; if (!m || m.isShaderMaterial) return;
    if (m.userData && m.userData.soft) return; if (m.transparent && m.opacity < 0.35) return; if (m.blending === T.AdditiveBlending) return;
    if (m === Q.water || o.layers.mask === 4 && false) return;
    if (!o.geometry.boundsTree) o.geometry.boundsTree = new B.MeshBVH(o.geometry);
    m.side = T.DoubleSide; targets.push(o);
  });
  const rc = new T.Raycaster(); rc.firstHitOnly = true;
  const down = new T.Vector3(0, -1, 0), up = new T.Vector3(0, 1, 0);
  const nrm = new T.Vector3();
  function hits(orig, dir, far) { rc.set(orig, dir); rc.far = far; return rc.intersectObjects(targets, false); }
  // visible surface: first solid hit going down from yFrom; returns y or null
  function surfY(u, v, yFrom) { const p = W(u, v, 0); const h = hits(new T.Vector3(p.x, yFrom, p.z), down, yFrom + 3); return h.length ? yFrom - h[0].distance : null; }
  function allHits(u, v, yFrom) { const p = W(u, v, 0); rc.set(new T.Vector3(p.x, yFrom, p.z), down); rc.far = yFrom + 3; rc.firstHitOnly = false; const r = rc.intersectObjects(targets, false); rc.firstHitOnly = true; return r.map((x) => +(yFrom - x.distance).toFixed(3)); }
  // horizontal clearance at one foot position: min over heights (relative to the foot) and 16 directions; floor-like faces (ny > 0.5) and things lower than foot+0.05 do not count
  const DIRS = []; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; DIRS.push(new T.Vector3(Math.cos(a), 0, Math.sin(a))); }
  const BODY_H = [0.08, 0.25, 0.45, 0.65, 0.8], BRIM_H = [1.05, 1.12, 1.2];
  function closedAt(o) { for (const d of [up, down]) { rc.set(o, d); rc.far = 4; rc.firstHitOnly = true; const r = rc.intersectObjects(targets, false); if (!r.length || !r[0].face) return false; nrm.copy(r[0].face.normal).transformDirection(r[0].object.matrixWorld); if (nrm.dot(d) <= 0) return false; } return true; }
  function clearAt(p, foot, hs, rad, ref) {
    if (ref === undefined) ref = foot;
    let best = 9, who = null; const o = new T.Vector3();
    for (const h of hs) { o.set(p.x, foot + h, p.z);
      for (const d of DIRS) { rc.set(o, d); rc.far = rad + 1.2; rc.firstHitOnly = false; const r = rc.intersectObjects(targets, false); rc.firstHitOnly = true;
        for (let ix = 0; ix < r.length; ix++) { const x = r[ix]; if (!x.face) continue; nrm.copy(x.face.normal).transformDirection(x.object.matrixWorld); const dn = nrm.dot(d);
          if (dn > 0) { if (ix === 0 && closedAt(o)) { if (-x.distance < best) { best = -x.distance; who = x.object; } } continue; }   // first hit is a back face: the axis is inside a solid (confirmed by the vertical rays too, so a lone plane does not count)
          if (nrm.y > 0.5) continue;                                   // floor-like (walkable) face: the ground itself
          if (x.point.y < ref + 0.05) continue;                         // lower than 5 cm above the foot (or above the ledge the path steps from/to)
          if (x.distance - rad < best) { best = x.distance - rad; who = x.object; } break; } } }
    return { c: best, obj: who };
  }
  function headroom(p, foot) { const o = new T.Vector3(); let best = 9; const offs = [[0, 0], [0.36, 0], [-0.36, 0], [0, 0.36], [0, -0.36]]; for (const q of offs) { o.set(p.x + q[0], foot + 0.9, p.z + q[1]); const r = hits(o, up, 1.2); if (r.length) best = Math.min(best, r[0].distance + 0.9 - 1.4); } return best; }
  window.__qa = { targets, surfY, allHits, clearAt, headroom, BODY_H, BRIM_H, hits };
  return targets.length;
})()
`;
