const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('echoTrial',{request:(action,payload)=>ipcRenderer.sendSync('echo-trial',action,payload)});
