const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version,archive=path.join(root,`release-v${version}/win-unpacked/resources/app.asar`);
const files=asar.listPackage(archive).map(p=>p.replace(/^[\\/]/,'')).filter(p=>p.startsWith(`out${path.sep}`)&&!asar.statFile(archive,p).files);
assert(files.length>100,'Must compare the complete renderer and main bundle');
for(const file of files)assert.deepEqual(asar.extractFile(archive,file),fs.readFileSync(path.join(root,file)),file);
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).version,version);
const report={version,archive,matchedFiles:files.length};fs.mkdirSync(path.join(root,`previews/release-v${version}-qa`),{recursive:true});fs.writeFileSync(path.join(root,`previews/release-v${version}-qa/package-files.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
