const {app,BrowserWindow,screen}=require('electron'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const root=path.resolve(__dirname,'..'),page=path.join(root,'previews/nursery-audio-tester/dist/index.html');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'focusquest-nursery-audio-tester-')));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
let win;
app.whenReady().then(async()=>{
 const primary=screen.getPrimaryDisplay(),display=screen.getAllDisplays().find(d=>d.id!==primary.id)||primary;
 win=new BrowserWindow({title:'玻璃苗圃 · 動畫音效測試',x:display.workArea.x+10,y:display.workArea.y+10,width:Math.min(1440,display.workArea.width-20),height:Math.min(900,display.workArea.height-20),minWidth:850,minHeight:600,show:false,backgroundColor:'#202a23',icon:path.join(root,'build/icon.ico'),autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
 if(!fs.existsSync(page))throw Error('找不到玻璃苗圃測試畫面。');
 win.show();win.focus();await win.loadFile(page);
}).catch(e=>{console.error(e);app.exit(1)});
app.on('window-all-closed',()=>app.quit());
