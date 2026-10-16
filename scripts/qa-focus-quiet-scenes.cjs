const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict')
const root=path.resolve(__dirname,'..'),output=path.join(root,'previews','focus-quiet-qa','scenes');fs.mkdirSync(output,{recursive:true})
app.setPath('userData',path.join(app.getPath('temp'),'focusquest-quiet-scenes-'+Date.now()))
let win,server;const report={checks:[],errors:[]},delay=ms=>new Promise(r=>setTimeout(r,ms))
const ev=s=>Promise.race([win.webContents.executeJavaScript(s,true),new Promise((_,reject)=>setTimeout(()=>reject(Error('Evaluation timed out: '+s)),10000))])
const phase=s=>{report.phase=s;fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify(report,null,2))}
async function until(s){const end=Date.now()+45000;while(Date.now()<end){if(await ev(s).catch(()=>false))return;await delay(100)}throw Error('Timeout '+s)}
;(async()=>{await app.whenReady();phase('ready')
 const d=screen.getAllDisplays().find(d=>d.id!==screen.getPrimaryDisplay().id)||screen.getPrimaryDisplay();win=new BrowserWindow({x:d.workArea.x+10,y:d.workArea.y+10,width:1280,height:800,show:false,webPreferences:{backgroundThrottling:false}});win.showInactive();report.secondary=d.id!==screen.getPrimaryDisplay().id
 win.webContents.on('console-message',(_e,l,m)=>{if(l>=3)report.errors.push(m)})
 phase('loading page');await win.loadFile(path.join(output,'dist','scripts','focus-quiet-scene-qa.html'));phase('page loaded');await until('!!window.quietQA');phase('API ready')
 const cases=[['area-01-cloud-ruins','rare_astro_core'],['area-02-moss-station','rare_drawer_compass'],['area-03-reflection-lake','rare_ring_mirror'],['area-07-glass-nursery','find_core'],['area-01-cloud-ruins','whistle'],['area-02-moss-station','carry_old_wick'],['area-03-reflection-lake','story_core_ring'],['area-07-glass-nursery','carry_silvered_shard']]
 for(const [map,event] of cases){phase(map+':'+event);await ev(`window.quietQA.start(${JSON.stringify(map)},${JSON.stringify(event)})`);await until('window.quietQA.state().ready');await ev('window.quietQA.seek(602)');await delay(2000);const s=await ev('window.quietQA.state()');assert(s.filter.includes('brightness(0.75)'));assert.equal(s.cinematic,false);if(s.debug.director)assert(s.debug.director.z<=1.01);if(s.debug.zoom!==undefined)assert(s.debug.zoom<=1.01)
 fs.writeFileSync(path.join(output,map+'-'+event+'.png'),(await win.webContents.capturePage()).toPNG());report.checks.push({map,event,state:s})
 assert.equal(report.errors.length,0,report.errors.join('\n'))
 }
 await ev('window.quietQA.dispose()');fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));app.exit(0)
})().catch(async e=>{report.errors.push(e.stack);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));try{await server?.close()}catch{};app.exit(1)})

