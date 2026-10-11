// Isolated production-game trial: accelerated focus, real-time animation, no player save access.
const {app,BrowserWindow,screen}=require('electron'),path=require('node:path'),fs=require('node:fs'),os=require('node:os'),Database=require('better-sqlite3');
const root=path.resolve(__dirname,'..'),profile=fs.mkdtempSync(path.join(os.tmpdir(),'focusquest-nursery-trial-'));
Object.assign(process.env,{FOCUSQUEST_QA_USER_DATA:profile,FOCUSQUEST_QA_SEED:'1',FOCUSQUEST_QA_EXPEDITION:'selected'});
BrowserWindow.prototype.show=function(){this.showInactive()};require(path.join(root,'out/main/index.js'));
(async()=>{await app.whenReady();let win;for(let i=0;i<100;i++){win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest');if(win)break;await new Promise(r=>setTimeout(r,100))}if(!win)throw Error('找不到試玩視窗。');
 const primary=screen.getPrimaryDisplay(),d=screen.getAllDisplays().find(x=>x.id!==primary.id)||primary;win.setBounds({x:d.workArea.x+10,y:d.workArea.y+10,width:1280,height:800});
 const call=(m,...a)=>win.webContents.executeJavaScript(`window.focusQuest[${JSON.stringify(m)}](...${JSON.stringify(a)})`,true);
 let s;for(let i=0;i<100;i++){try{s=await call('getSnapshot');if(s.todayRun)break}catch{}await new Promise(r=>setTimeout(r,100))}
 const sql=new Database(path.join(profile,'focusquest.db')),node=s.expeditionNodes[0];sql.prepare('UPDATE expedition_nodes SET area_id=?,title=? WHERE id=?').run('area-07-glass-nursery','玻璃苗圃',node.id);
 sql.prepare('INSERT INTO map_world_state (map_id,state_json) VALUES (?,?)').run('area-07-glass-nursery',JSON.stringify({potUpright:false,glassWiped:false,shardPile:false,saplingInLuggage:false,saplingPlanted:true,saplingStage:1,saplingTransplanted:false}));
 await call('selectExpeditionNode',s.todayRun.id,node.id);s=await call('startListFocus',{minimumMinutes:5,blockedProcessNames:[],runId:s.todayRun.id,nodeId:node.id,plannedMinutes:50});const id=s.activeSession.id;
 let previous=Date.now(),elapsed=0,done=false;const timer=setInterval(async()=>{if(done)return;const now=Date.now(),dt=now-previous;previous=now;const row=sql.prepare('SELECT ended_at,suspended_at,paused_seconds FROM sessions WHERE id=?').get(id);if(!row||row.ended_at){done=true;clearInterval(timer);return;}if(row.suspended_at)return;elapsed+=dt*30;
 sql.prepare('UPDATE sessions SET started_at=? WHERE id=?').run(new Date(now-elapsed-Number(row.paused_seconds)*1000).toISOString(),id);
 if(elapsed>=3010000){done=true;clearInterval(timer);await call('finishListFocus',id,false);await call('dismissDebrief',id)}},500);
 win.on('closed',()=>{clearInterval(timer);sql.close()});win.setTitle('Focus Quest · 苗圃試玩（獨立存檔，30 倍速）');win.showInactive();win.focus();
})().catch(e=>{console.error(e);app.exit(1)});
