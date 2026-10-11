// Prototype camera design table. Offsets are world coordinates; angles are relative to 45°/31°.
const shot = (p, focus, width, options = {}) => ({ p, focus, width, yaw: 0, pitch: 0, cx: .5, cy: .5, ...options });
const full = p => shot(p, 'overview', 38, { overview: 1 });
export const CAMERA_SHOTS = {
  opening_a: [full(0), full(1.5 / 26), shot(6.5 / 26, 'trav', 12, { offset: [1, .5, -1], cx: .43, cy: .63 }), shot(.36, 'bridgeTree', 22, { offset: [0, 1.5, 0], cy: .52 }), shot(.56, 'bridgeTree', 22, { offset: [0, 1.5, 0], cy: .52 }), shot(.66, 'bridgeTree', 17, { offset: [0, 1.5, 0], cy: .52 }), shot(.8, 'bridgeTree', 17, { offset: [0, 1.5, 0], cy: .52 }), shot(1, 'trav', 18, { offset: [1, 1, -1], cx: .4 })],
  opening_walk: [shot(0, 'trav', 18, { offset: [1, 1, -1], cx: .4, follow: true }), shot(1, 'trav', 18, { offset: [1, 1, -1], yaw: .12, cx: .4, follow: true })],
  opening_b: [shot(0, 'trav', 18, { offset: [1, 1, -1], yaw: .12, cx: .4, follow: true }), shot(3 / 14, 'tree', 13, { offset: [0, 1.6, 0], pitch: -.12, cy: .43 }), shot(.3, 'tree', 13, { offset: [0, 1.6, 0], pitch: -.12, cy: .43 }), shot(.72, 'tree', 13, { offset: [0, 2.5, 0], pitch: -.12, cy: .43 }), shot(.75, 'tree', 13, { offset: [0, 2.5, 0], pitch: -.12, cy: .43 }), full(1)],
  notebook_a: [full(0), shot(3 / 26, 'bridgeTree', 20, { offset: [0, 1.5, 0] }), shot(.8, 'bridgeTree', 20, { offset: [0, 1.5, 0] }), shot(1 - 3.5 / 26, 'bridgeTree', 20, { offset: [0, 1.5, 0] }), full(1)],
  notebook_b: [full(0), shot(3 / 14, 'tree', 15, { offset: [0, 1.7, 0], pitch: -.1 }), shot(.75, 'tree', 15, { offset: [0, 1.7, 0], pitch: -.1 }), full(1)],
  traces: [full(0), shot(3 / 46, 'grass', 14, { pitch: .1, offset: [0, .6, 0] }), shot(.24, 'grass', 14, { pitch: .1, offset: [0, .6, 0] }), shot(.32, 'roll', 14, { offset: [0, .6, 0] }), shot(.48, 'roll', 14, { offset: [0, .6, 0] }), shot(.55, 'date', 8, { yaw: -.25, cy: .43 }), shot(.72, 'date', 8, { yaw: -.25, cy: .43 }), shot(.79, 'tree', 16, { offset: [0, 1, 0] }), shot(1 - 4 / 46, 'tree', 16, { offset: [0, 1, 0] }), full(1)],
  stele: [full(0), shot(3 / 40, 'stele', 10, { yaw: -.25 }), shot(.2, 'glint', 8, { yaw: -.25, follow: true }), shot(.7, 'glint', 8, { yaw: -.25, follow: true }), shot(.775, 'stele', 13), shot(1 - 3.5 / 40, 'stele', 13), full(1)],
  well: [full(0), shot(.12, 'well', 10, { pitch: .25, offset: [0, .4, 0] }), shot(.42, 'well', 10, { pitch: .25, offset: [0, .4, 0] }), shot(.52, 'well', 20, { pitch: -.08, offset: [0, 1, 0] }), shot(.6, 'wellDownstream', 26, { pitch: -.08, offset: [0, 2, 0], follow: true }), shot(.86, 'wellDownstream', 26, { pitch: -.08, offset: [0, 2, 0], follow: true }), shot(1 - 3.5 / 48, 'wellDownstream', 26, { pitch: -.08, offset: [0, 2, 0], golden: 1 }), full(1)],
  rubbing: [full(0), shot(.12, 'stele', 11, { yaw: -.25 }), shot(.65, 'paper', 8, { yaw: -.25 }), shot(.72, 'paper', 8, { yaw: -.25, pitch: -.1, follow: true }), shot(.88, 'paper', 8, { yaw: -.25, pitch: -.1, follow: true }), shot(1 - 3.5 / 44, 'paper', 8, { yaw: -.25, pitch: -.1 }), full(1)],
  leafTag: [full(0), shot(3 / 42, 'trav', 8, { pitch: -.12, offset: [0, 1.2, 0] }), shot(.36, 'trav', 8, { pitch: -.12, offset: [0, 1.2, 0] }), shot(.5, 'trav', 8, { yaw: .1, pitch: -.12, offset: [0, 1.2, 0] }), shot(.62, 'tag', 8), shot(.75, 'tag', 7), shot(1 - 3.5 / 42, 'tag', 7), full(1)],
  whistle: [full(0), shot(.1, 'trav', 14, { pitch: -.15, offset: [-2, 2, 2] }), shot(.16, 'trav', 14, { pitch: -.15, offset: [-2, 2, 2] }), shot(.36, 'trav', 14, { pitch: -.15, offset: [-3, 2, 3] }), shot(.45, 'trav', 14, { pitch: -.15, offset: [-3, 2, 3] }), shot(1, 'trav', 30, { pitch: -.2, offset: [0, 4, 0] })]
};
export const easeInOutCubic = t => t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
export function mixCamera(a, b, t) {
  const c = {};
  for (const key of ['x', 'y', 'z', 'width', 'yaw', 'pitch', 'cx', 'cy', 'overview', 'golden']) c[key] = (a[key] || 0) + ((b[key] || 0) - (a[key] || 0)) * t;
  c.follow = !!(a.follow || b.follow); const fa = a.followWeight ?? (a.follow ? 1 : 0), fb = b.followWeight ?? (b.follow ? 1 : 0); c.followWeight = fa + (fb - fa) * t; return c;
}
export function sampleCamera(key, p, resolve, overview) {
  const frames = CAMERA_SHOTS[key]; if (!frames) return { ...overview };
  const resolved = s => { if (s.focus === 'overview') return { ...overview, follow: false };
    const f = resolve(s.focus, p), o = s.offset || [0, 0, 0];
    return { ...s, x: f.x + o[0], y: f.y + o[1], z: f.z + o[2], overview: s.overview || 0, golden: s.golden || 0 };
  };
  p = Math.max(0, Math.min(1, p));
  if (p <= frames[0].p) return resolved(frames[0]);
  for (let i = 1; i < frames.length; i++) if (p <= frames[i].p) {
    const a = frames[i - 1], b = frames[i]; return mixCamera(resolved(a), resolved(b), easeInOutCubic((p - a.p) / (b.p - a.p)));
  }
  return resolved(frames[frames.length - 1]);
}
// Exact critically damped step, omega=2.5. Seeking skips history by snapping in the caller.
export function springCamera(position, velocity, target, dt, omega = 2.5) {
  const decay = Math.exp(-omega * dt);
  for (const key of ['x', 'y', 'z']) { const error = position[key] - target[key], j = velocity[key] + omega * error;
    position[key] = target[key] + (error + j * dt) * decay; velocity[key] = (velocity[key] - omega * j * dt) * decay;
  }
}
