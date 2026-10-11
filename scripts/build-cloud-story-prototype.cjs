// Rebuild the standalone review page from the prototype scene, never from the production scene.
const fs = require('node:fs'), path = require('node:path'), esbuild = require('esbuild');
const root = path.resolve(__dirname, '..');
(async () => {
  const scene = path.join(root, 'docs/prototypes/src/cloudRuinsStory.js');
  const result = await esbuild.build({
    stdin: { contents: `import {createCloudRuinsScene} from ${JSON.stringify(scene)}; window.createCloudRuinsScene=createCloudRuinsScene;`, resolveDir: root },
    bundle: true, format: 'iife', write: false,
    plugins: [{ name: 'prototype-imports', setup(build) {
      build.onResolve({ filter: /.*/ }, args => {
        if (args.importer !== scene) return;
        const redirects = {
          './vendor/three.module.js': 'src/renderer/src/cloudRuins/vendor/three.module.js',
          '../../../../docs/area-01-cloud-ruins.scene.json': 'docs/area-01-cloud-ruins.scene.json',
          '../../../shared/timeOfDay': 'src/shared/timeOfDay.ts',
          '../../../shared/lampTiming': 'src/shared/lampTiming.ts',
          './edgeGlass.js': 'src/renderer/src/cloudRuins/edgeGlass.js'
        };
        if (redirects[args.path]) return { path: path.join(root, redirects[args.path]) };
      });
    } }]
  });
  const file = path.join(root, 'docs/prototypes/cloud-ruins.html');
  let html = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const pattern = /<script>\s*\(\(\) => \{[\s\S]*?<\/script>/;
  if (!pattern.test(html)) throw new Error('Standalone scene bundle marker missing');
  html = html.replace(pattern, () => '<script>\n' + result.outputFiles[0].text + '\n</script>');
  html = html.replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/[^\"]+"><\/script>\n?/, '');
  fs.writeFileSync(file, html.replace(/\n/g, '\r\n'));
  console.log('Standalone story prototype rebuilt (Three bundled, no CDN script required).');
})().catch(error => { console.error(error); process.exitCode = 1; });
