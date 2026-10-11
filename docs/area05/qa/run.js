// usage: node shot.js file.html out.png "js to eval before shot" [w h] [hash]
const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const [file, outp, js = '', w = '1280', h = '720', hash = ''] = process.argv.slice(2);
  let html = fs.readFileSync(file, 'utf8').replace('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', 'three.min.js');
  fs.writeFileSync('_t.html', html);
  if (!fs.existsSync('three.min.js')) fs.copyFileSync('node_modules/three/build/three.min.js', 'three.min.js');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' || m.text().startsWith('LOG')) errs.push(m.text()); });
  await p.goto('file://' + process.cwd() + '/_t.html?qa&nohud' + (process.env.EXTRA || '') + hash, { waitUntil: 'load' });
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 120000 });
  if (js) { const r = await p.evaluate(js); if (r !== undefined) console.log(JSON.stringify(r)); }
  await p.screenshot({ path: outp });
  if (errs.length) console.log('ERR', errs.slice(0, 5).join('\n'));
  await b.close();
})();
