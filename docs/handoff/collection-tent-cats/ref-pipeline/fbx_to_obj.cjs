const { chromium } = require('/opt/node-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  p.on('pageerror', e => console.log('PAGEERR', e.message)); p.on('console', m => console.log('CONSOLE', m.type(), m.text().slice(0, 200)));
  await p.goto('http://127.0.0.1:8765/ref_load.html'); await p.waitForFunction(() => window.__done, null, { timeout: 120000 });
  const err = await p.evaluate(() => window.__err); if (err) console.log('ERR', err);
  const info = await p.evaluate(() => window.__info); console.log(JSON.stringify(info, null, 1).slice(0, 4000));
  require('fs').writeFileSync('ref/frip.obj', await p.evaluate(() => window.__obj || ''));
  await b.close();
})();
