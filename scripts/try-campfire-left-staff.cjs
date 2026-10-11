const {app,BrowserWindow,screen}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const root=path.resolve(__dirname,'..')
process.env.FOCUSQUEST_QA_USER_DATA=fs.mkdtempSync(path.join(os.tmpdir(),'fq-left-staff-preview-'))
require(path.join(root,'out/main/index.js'))
const delay=ms=>new Promise(r=>setTimeout(r,ms))
;(async()=>{
 await app.whenReady()
 let win
 for(let i=0;i<200;i++){
  win=BrowserWindow.getAllWindows().find(w=>w.getTitle()==='Focus Quest')
  if(win&&await win.webContents.executeJavaScript('!!document.querySelector(".campfire-stage iframe")?.contentWindow?.__campfire'))break
  await delay(100)
 }
 if(!win)throw Error('Preview window unavailable')
 const primary=screen.getPrimaryDisplay(),display=screen.getAllDisplays().find(d=>d.id!==primary.id)||primary
 win.setBounds({x:display.workArea.x+10,y:display.workArea.y+10,width:1280,height:800})
 win.setTitle('Focus Quest · 左手拿杖動作試看（獨立存檔）')
 await win.webContents.executeJavaScript(`(()=>{
  const button=document.createElement('button');button.textContent='重播起身與拿杖';
  Object.assign(button.style,{position:'fixed',bottom:'24px',left:'180px',zIndex:10000,padding:'12px 20px',background:'#252c29',color:'#e3d7ae',border:'1px solid #a69569',borderRadius:'12px',cursor:'pointer'});
  button.onclick=()=>{const w=document.querySelector('.campfire-stage iframe').contentWindow;w.__hold=true;w.__campfire.playReturn();w.__campfire.advance(7);w.__campfire.setSelected('bridge');w.__campfire.depart();w.__hold=false};
  document.body.append(button);button.click();
 })()`)
 win.showInactive()
})().catch(e=>{console.error(e);app.exit(1)})
