// Independent stage-3 runtime audit; never loads the player's save.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { open } = require('./h.js');
const dir = path.resolve(__dirname, '../../../previews/area03-codex-acceptance');
fs.mkdirSync(dir, { recursive: true });
(async () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../prototypes/reflection-lake.html'), 'utf8');
  const embedded = html.match(/<script[^>]*id="area-data"[^>]*>([\s\S]*?)<\/script>/)[1];
  const external = fs.readFileSync(path.resolve(__dirname, '../area-03-reflection-lake.scene.json'), 'utf8');
  assert.equal(embedded.trim(), external.trim());
  const { page, browser, errs } = await open();
  try {
    const report = await page.evaluate(() => {
      const A = __lake, I = A.internals(), checks = [], runs = [];
      const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
      const count = () => A.lamps().filter(l => l.level > 0.5).length;
      const graph = A.graph();
      check('graph size', graph.nodes.length === 48 && graph.edges.length === 51);
      check('all nodes reachable', graph.nodes.every(n => A.route('entry0', n.id)));
      check('23 spots reachable', I.AREA.spots.length === 23 && I.AREA.spots.every(s => A.route('entry0', s.id)));
      A.setTide(0); const low = A.tidalAreas(); A.setTide(1); const high = A.tidalAreas();
      check('leaves rise and flowers open with tide', low.bloom === 0 && high.bloom === 1 && low.leaves.every((l,i)=>high.leaves[i].y > l.y));
      check('masonry moon window meets high-water plane', high.arcs.length === 1 && high.arcs.every(a=>a.seam === .3 && a.style === 'weathered-masonry-moon-window'));
      A.setTime('day'); const dayMoon=A.tidalAreas().moonNight; A.setTime('night');
      check('full moon only appears at night', dayMoon===0 && A.tidalAreas().moonNight===1);
      for (const [from,to] of [['c_east','leaf_watch'],['leaf_watch','c_east'],['r_lamp1','moon_watch'],['moon_watch','r_lamp1']]) {
        A.reset(); A.walk(from,to); A.advance(25,.05);
        check('walk '+from+' to '+to, A.tr().node === to && A.tr().state === 'idle', A.tr());
      }
      A.setTide(0); const dryGraph = JSON.stringify(A.graph()); A.setTide(1);
      check('same graph at both tides', dryGraph === JSON.stringify(A.graph()));
      A.reset(); A.hold(true);
      for (let k = 1; k <= 5; k++) {
        A.setSim(k * 600 - 0.01); check('lamp ' + k + ' before deadline', count() === k - 1, count());
        A.setSim(k * 600); check('lamp ' + k + ' at deadline without traveller', count() === k, count());
      }
      A.reset(); check('reset clears time and lamps', A.state().sim === 0 && count() === 0);
      for (const speed of [6, 20, 60]) {
        A.reset(); A.speed(speed); A.play(true);
        // Advance at production-sized frame intervals rather than jumping the clock.
        const end = 3000 / speed + 60;
        A.advance(end, 0.05);
        const result = { speed, state: A.state(), traveller: A.tr(), lamps: count() }; runs.push(result);
        check('complete run x' + speed, count() === 5 && A.tr().state === 'rest' && A.tr().node === 'p_bench', result);
      }
      document.getElementById('skip').click();
      check('skip reaches completed rest', count() === 5 && A.tr().state === 'rest' && A.tr().node === 'p_bench');
      return { checks, runs };
    });
    report.jsonEquivalent = true;
    report.views = [];
    for (const mode of ['day', 'night']) {
      await page.evaluate(mode => { __lake.play(false); __lake.setTime(mode); __lake.setTide(1); __lake.setSim(3000); __lake.render(); }, mode);
      report.views.push(await page.evaluate(() => __lake.state()));
      await page.screenshot({ path: path.join(dir, mode + '-high.png') });
    }
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => { __lake.reset(); __lake.setTime('day'); __lake.render(); });
    await page.screenshot({ path: path.join(dir, 'day-low-1280.png') });
    await page.setViewportSize({ width: 1600, height: 900 });
    for (const tide of [.28,.38,.5]) {
      await page.evaluate(tide=>{__lake.play(false);__lake.setTime('day');__lake.setTide(tide);__lake.focus(12,-4.7,.25,11);__lake.render();},tide);
      await page.screenshot({path:path.join(dir,'leaf-rising-'+tide+'.png')});
    }
    for (const area of ['leaf','moon']) for (const tide of [0,1]) {
      await page.evaluate(({area,tide})=>{ __lake.play(false);__lake.setTime('day');__lake.setTide(tide);area==='leaf'?__lake.focus(12,-4.7,.25,11):__lake.focus(-8,6.6,.5,11);__lake.goto(area==='leaf'?'leaf_watch':'moon_watch');__lake.pose(area==='leaf'?'leafTouch':'gazeDown',.5);__lake.advance(1,.05);__lake.render(); },{area,tide});
      await page.screenshot({path:path.join(dir,area+'-'+(tide?'high':'low')+'.png')});
    }
    // advance() deliberately forces ambient motion for screenshot QA; pause must
    // be tested in the real requestAnimationFrame loop instead.
    await page.goto(page.url().replace('?qa=1', ''));
    await page.waitForFunction('window.__ready === true');
    await page.evaluate(() => { __lake.play(true); });
    await page.waitForTimeout(600);
    await page.evaluate(() => { __lake.play(false); });
    // Let the next frame apply the paused flag to the diagnostic `moving` field.
    await page.waitForFunction('__lake.tr().moving === false');
    const readPaused = () => page.evaluate(() => ({ sim: __lake.state().sim, tide: __lake.state().tide, traveller: __lake.tr(), lamps: __lake.lamps(), egret: __lake.egretPos(), tidalAreas: __lake.tidalAreas(), waterTime: __lake.water.material.uniforms.uTime.value }));
    const pauseBefore = await readPaused();
    await page.waitForTimeout(700);
    const pauseAfter = await readPaused();
    report.checks.push({ name: 'real-frame pause freezes clocks, traveller, lamps and egret', ok: JSON.stringify(pauseBefore) === JSON.stringify(pauseAfter), detail: { before: pauseBefore, after: pauseAfter } });
    report.errors = errs;
    fs.writeFileSync(path.join(dir, 'runtime.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ checks: report.checks, views: report.views, errors: errs }));
    assert.ok(report.checks.every(c => c.ok), 'runtime checks failed');
    assert.ok(report.views.every(v => v.draws <= 250), 'draw call budget exceeded');
    assert.ok(!errs.some(e => !/ERR_FAILED/.test(e)), 'unexpected console errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
