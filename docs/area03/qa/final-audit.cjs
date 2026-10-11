// Opus final audit (2026-10-03): plays every event, rest, rare find and departure to the end, plus full demo runs, and looks for
// errors, NaN placements and the traveller ending up where he should. usage: LAKE_FILE=../../prototypes/reflection-lake.html node final-audit.cjs
const { open } = require('./h.js');
(async () => {
  const { page, browser, errs } = await open();
  const r = await page.evaluate(() => {
    const L = __lake, I = L.internals(), out = { bad: [], counts: {} };
    const ok = () => { const p = I.trav.position; return isFinite(p.x) && isFinite(p.y) && isFinite(p.z); };
    const S = (tag) => { if (!ok()) out.bad.push('NaN ' + tag); };
    L.play(true);
    // every event / rest / rare, at both tides
    for (const tide of [0, 1]) {
      L.setTide(tide);
      for (const id of L.eventsAll()) { L.reset(); L.setTide(tide); L.event(id); L.play(true); I.TR.hold = false; L.advance(40, 0.1); S('event ' + id + ' t' + tide); out.counts.events = (out.counts.events || 0) + 1; }
      for (const id of L.restAll()) { L.reset(); L.setTide(tide); L.rest(id); I.TR.hold = false; L.advance(30, 0.1); S('rest ' + id); }
      for (const id of ['rare_gauge_plate', 'rare_boat_plate', 'rare_mirror_shard', 'rare_ring_mirror']) { L.reset(); L.setTide(tide); L.rare(id); I.TR.hold = false; L.play(true); L.advance(40, 0.1); S('rare ' + id); if (L.s4().act === id) out.bad.push('rare ' + id + ' still running'); }
      for (const w of ['a', 'b']) { L.reset(); L.setTide(tide); L.depart(w); I.TR.hold = false; L.play(true); L.advance(6, 0.05); S('depart ' + w); if (L.tr().state !== 'gone') out.bad.push('depart ' + w + ' ended ' + L.tr().state); }
    }
    // stage 5: every story and keepsake event plays to the end, leaves the camera where it was and grants its clue
    for (const id of L.storiesAll()) { L.reset(); L.focus(); const z0 = I.camera ? I.camera.zoom : 1; L.story(id); I.TR.hold = false; L.play(true); L.advance(130, 0.05); S('story ' + id); if (L.s4().state === 'story') out.bad.push('story ' + id + ' still running'); if (Math.abs(L.camera.zoom - 1) > 1e-3) out.bad.push('story ' + id + ' left the camera zoomed ' + L.camera.zoom); out.counts.stories = (out.counts.stories || 0) + 1; }
    out.counts.clues = L.clues().length; out.counts.gaugeCarving = L.worldMarks().gaugeCarving;
    // full demo runs at x60
    for (let k = 0; k < 3; k++) { L.reset(); L.speed(60); L.play(true); I.TR.hold = false; L.advance(90, 0.1); S('run ' + k); out.counts['run' + k] = { lit: L.tr().lit, state: L.tr().state, journal: L.journal().length }; }
    const s = L.state(); out.draws = s.draws; return out;
  });
  console.log(JSON.stringify(r, null, 1));
  console.log('errors', JSON.stringify(errs.filter((e) => !/ERR_FAILED|ERR_TUNNEL/.test(e)).slice(0, 10)));
  await browser.close();
})();
