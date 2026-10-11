// usage: node run.js <steps.json> [query]
const { chromium } = require('../node_modules/playwright-core');
const path = require('path'); const fs = require('fs');
(async () => {
  const steps = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const q = process.argv[3] || '';
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('file://' + path.resolve(__dirname, 'page.html') + (q ? '?' + q : ''));
  try { await page.waitForFunction('window.__ready === true', null, { timeout: 120000 }); } catch (e) { console.log('not ready', errors.join('\n')); await browser.close(); return; }
  for (const s of steps) {
    if (s.eval) { const r = await page.evaluate(s.eval); if (r !== undefined) console.log(s.label || 'eval', JSON.stringify(r)); }
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.shot) { await page.evaluate(() => { window.__qa.scene.renderNow(); }); await page.screenshot({ path: path.resolve(__dirname, 'out', s.shot) }); console.log('shot', s.shot); }
  }
  console.log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
  await browser.close();
})();
