// test harness: headless chromium (SwiftShader), three.js served from node_modules instead of the CDN
const { chromium } = require('playwright-core'); const path = require('path'); const fs = require('fs');
const THREE_SRC = fs.readFileSync(path.join(__dirname, 'node_modules/three/build/three.min.js'), 'utf8');
async function open(opts) {
  opts = opts || {};
  const executablePath = process.env.LAKE_BROWSER || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/opt/pw-browsers/chromium');
  const browser = await chromium.launch({ executablePath, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: opts.w || 1600, height: opts.h || 900 } });
  const errs = []; page.on('pageerror', (e) => errs.push('pageerror ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push('console ' + m.text()); });
  await page.route('**/*', (r) => { const u = r.request().url(); if (u.includes('cdnjs.cloudflare.com/ajax/libs/three.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: THREE_SRC }); if (u.startsWith('file://')) return r.continue(); return r.abort(); });
  const file = opts.file || process.env.LAKE_FILE || '../../prototypes/reflection-lake.html';
  await page.goto('file://' + path.resolve(__dirname, file) + '?qa=1' + (opts.q || ''));
  await page.waitForFunction('window.__ready === true', null, { timeout: 240000 });
  return { page, browser, errs };
}
module.exports = { open };
