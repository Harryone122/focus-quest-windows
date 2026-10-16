// Independent scene trial: local rules authority, no import of the production main or database.
const {app,BrowserWindow,screen,ipcMain}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const rules=require('../src/shared/area05TrialRules.cjs'),root=path.resolve(__dirname,'..');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'focusquest-area05-trial-'));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
app.setPath('userData',profile);
let state=rules.newExploration(),win;
function save(){fs.writeFileSync(path.join(profile,'exploration.json'),JSON.stringify(state));}
ipcMain.on('echo-trial',(e,action,p={})=>{try{if(!win||win.isDestroyed()||e.sender!==win.webContents){e.returnValue=null;return;}let result=null;const before=JSON.stringify(state);
 switch(action){case 'new':state=rules.newExploration(11,p.reserved||null);break;case 'sound':rules.signal(state,p.kind);break;case 'mouth':result=rules.mouth(state);break;case 'fits':result=rules.fits(state,p);break;case 'choose':result=rules.choose(state,p);break;case 'arrive':result=rules.choose(state,p,true);break;case 'random':result=rules.random(state);break;case 'wind':result=rules.wind(state,p.now);break;case 'finished':break;case 'state':result=state;break;default:throw Error('Unknown action');}if(before!==JSON.stringify(state))save();e.returnValue=result;
 }catch(error){console.error(error);e.returnValue=null;}});
app.whenReady().then(async()=>{const primary=screen.getPrimaryDisplay(),d=screen.getAllDisplays().find(x=>x.id!==primary.id)||primary;
 win=new BrowserWindow({title:'Area 05 · 藏聲秋谷試玩（獨立存檔）',x:d.workArea.x+10,y:d.workArea.y+10,width:Math.min(1440,d.workArea.width-20),height:Math.min(900,d.workArea.height-20),minWidth:850,minHeight:600,show:false,backgroundColor:'#8fb2d8',icon:path.join(root,'build/icon.ico'),autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'echo-quarry-trial-preload.cjs'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:!!process.env.FOCUSQUEST_AREA05_QA||!!process.env.FOCUSQUEST_AREA05_AUDIO_QA}});
 if(process.env.FOCUSQUEST_AREA05_AUDIO_QA||process.env.FOCUSQUEST_AREA05_QA)win.webContents.setAudioMuted(true);
 const trialPage=path.join(root,'trial-renderer/index.html');
 await win.loadFile(fs.existsSync(trialPage)?trialPage:path.join(root,'previews/area05-trial/dist/index.html'));
 if(process.env.FOCUSQUEST_STYLE_QA)await require('./qa-style-refine.cjs')({app,win,profile,root});else if(process.env.FOCUSQUEST_AREA05_AUDIO_QA)await require(process.env.FOCUSQUEST_AREA05_AUDIO_QA==='motion'?'./qa-area05-motion.cjs':process.env.FOCUSQUEST_AREA05_AUDIO_QA==='smoke'?'./qa-area05-audio-smoke.cjs':process.env.FOCUSQUEST_AREA05_AUDIO_QA==='murmur'?'./qa-area05-murmur.cjs':'./qa-area05-audio-scene.cjs')({app,win,profile,root});else if(process.env.FOCUSQUEST_AREA05_QA)await require('./qa-echo-quarry.cjs')({app,win,profile,root});else win.showInactive();
}).catch(e=>{console.error(e);app.exit(1)});
app.on('window-all-closed',()=>app.quit());
