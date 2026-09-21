import { contextBridge, ipcRenderer } from 'electron'
import type { AppSnapshot, FocusQuestApi, OverlayState } from '../shared/types'

const api: FocusQuestApi = {
  getSnapshot: () => ipcRenderer.invoke('snapshot:get'),
  createTask: (input) => ipcRenderer.invoke('task:create', input),
  setTaskRole: (taskId, role) => ipcRenderer.invoke('task:set-role', taskId, role),
  archiveTask: (taskId) => ipcRenderer.invoke('task:archive', taskId),
  startFocus: (input) => ipcRenderer.invoke('focus:start', input),
  endFocus: (input) => ipcRenderer.invoke('focus:end', input),
  listRunningApplications: () => ipcRenderer.invoke('apps:list'),
  saveBlockRules: (apps) => ipcRenderer.invoke('block-rules:save', apps),
  updateSettings: (settings) => ipcRenderer.invoke('settings:update', settings),
  makeRpgChoice: (choice) => ipcRenderer.invoke('rpg:choice', choice),
  exportBackup: () => ipcRenderer.invoke('data:export-backup'),
  importBackup: () => ipcRenderer.invoke('data:import-backup'),
  exportAnalytics: () => ipcRenderer.invoke('data:export-analytics'),
  overlayReturn: () => ipcRenderer.invoke('overlay:return'),
  overlayEmergency: (mode) => ipcRenderer.invoke('overlay:emergency', mode),
  onSnapshotChanged: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: AppSnapshot): void => callback(snapshot)
    ipcRenderer.on('snapshot:changed', handler)
    return () => ipcRenderer.removeListener('snapshot:changed', handler)
  },
  onOverlayState: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: OverlayState): void => callback(state)
    ipcRenderer.on('overlay:state', handler)
    return () => ipcRenderer.removeListener('overlay:state', handler)
  }
}

contextBridge.exposeInMainWorld('focusQuest', api)
