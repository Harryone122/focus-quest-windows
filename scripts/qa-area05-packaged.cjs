const {app,BrowserWindow}=require('electron'),path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict'),asar=require('@electron/asar');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version,archive=path.join(root,`release-area05-v${version}/win-unpacked/resources/app.asar`),out=path.join(root,`previews/release-v${version}-qa/area05`);
fs.mkdirSync(out,{recursive:true});
const files=asar.listPackage(archive).map(p=>p.replace(/^[\\/]/,'')).filter(p=>!asar.statFile(archive,p).files&&!p.startsWith('node_modules'));
assert(files.some(p=>p.replaceAll('\\','/')==='trial-renderer/index.html'),'Standalone renderer must be present');
const input=JSON.parse(fs.readFileSync(path.join(root,`previews/release-v${version}-qa/area05-package-input.json`),'utf8'));
for(const file of Object.keys(input.sha256))assert(files.includes(file),'Snapshot file missing from archive: '+file);
for(const file of files){if(file==='package.json')continue;assert.deepEqual(asar.extractFile(archive,file),fs.readFileSync(path.join(input.input,file)),file)}
assert.equal(JSON.parse(asar.extractFile(archive,'package.json')).main,'scripts/try-echo-quarry.cjs');
BrowserWindow.prototype.showInactive=function(){};app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
delete process.env.FOCUSQUEST_AREA05_QA;delete process.env.FOCUSQUEST_AREA05_AUDIO_QA;
require(path.join(archive,'scripts/try-echo-quarry.cjs'));
(async()=>{
 await app.whenReady();let win;
 for(let i=0;i<500;i++){win=BrowserWindow.getAllWindows()[0];if(win&&!win.webContents.isLoading()&&await win.webContents.executeJavaScript('typeof echoTrialScene!=="undefined"').catch(()=>false))break;await new Promise(r=>setTimeout(r,100))}
 assert(win);win.webContents.setAudioMuted(true);
 // Existing QA exits on completion; capture its reports beside the release evidence.
 const exit=app.exit.bind(app);app.exit=code=>{for(const name of ['scene-report.json','core-collected.png','paused-cave.png']){const p=path.join(root,'previews/area05-audio-integration-qa',name);if(fs.existsSync(p))fs.copyFileSync(p,path.join(out,name))}fs.writeFileSync(path.join(out,'package-files.json'),JSON.stringify({version,archive,matchedFiles:files.length-1},null,2));exit(code)};
 await require('./qa-area05-audio-scene.cjs')({app,win,profile:app.getPath('userData'),root});
})().catch(e=>{fs.writeFileSync(path.join(out,'failure.txt'),e.stack);console.error(e);app.exit(1)});
