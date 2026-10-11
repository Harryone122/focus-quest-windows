import { contextBridge, ipcRenderer } from 'electron'
import type { AppSnapshot, FocusQuestApi, OverlayState } from '../shared/types'

const api: FocusQuestApi = {
  pinCollectionClue: (id) => ipcRenderer.invoke('collection:pin-clue', id),
  pinCollectionClues: (ids) => ipcRenderer.invoke('collection:pin-clues', ids),
  setTrackingClue: (placeId) => ipcRenderer.invoke('collection:set-tracking', placeId),
  markCollectionCorePresented: (mapId) => ipcRenderer.invoke('collection:present-core', mapId),
  markCollectionLinkagePlayed: () => ipcRenderer.invoke('collection:play-linkage'),
  inspectLobbyFind: (id) => ipcRenderer.invoke('lobby:inspect-find', id),
  inspectCampfireTrace: (stage) => ipcRenderer.invoke('lobby:inspect-campfire', stage),
  addListTask: (input) => ipcRenderer.invoke('task-list:add', input),
  renameListTask: (taskId, title) => ipcRenderer.invoke('task-list:rename', taskId, title),
  reorderTodayTasks: (day, taskIds) => ipcRenderer.invoke('task-list:reorder', day, taskIds),
  moveTasksToToday: (taskIds) => ipcRenderer.invoke('task-list:move-today', taskIds),
  setListTaskDone: (taskId, done) => ipcRenderer.invoke('task-list:set-done', taskId, done),
  deleteListTask: (taskId) => ipcRenderer.invoke('task-list:delete', taskId),
  deleteYesterdayTasks: (input) => ipcRenderer.invoke('task-list:delete-yesterday', input),
  saveRoutines: (inputs) => ipcRenderer.invoke('task-list:save-routines', inputs),
  startListFocus: (input) => ipcRenderer.invoke('task-list:start-focus', input),
  finishListFocus: (sessionId, completed) => ipcRenderer.invoke('task-list:finish-focus', sessionId, completed),
  recordWorldMark: (sessionId, mark) => ipcRenderer.invoke('world:record-mark', sessionId, mark),
  recordCloudStoryClue: (sessionId, clueId) => ipcRenderer.invoke('cloud:record-story-clue', sessionId, clueId),
  getNurseryScene: nodeId => ipcRenderer.invoke('nursery:scene',nodeId),
  getNurseryDeparture: sessionId => ipcRenderer.invoke('nursery:departure',sessionId),
  chooseCaretaker: (nodeId,choice) => ipcRenderer.invoke('nursery:choice',nodeId,choice),
  getLakeScene: (nodeId) => ipcRenderer.invoke('lake:scene', nodeId),
  getLakeDeparture: (sessionId) => ipcRenderer.invoke('lake:departure', sessionId),
  getMossScene: (nodeId) => ipcRenderer.invoke('moss:scene', nodeId),
  getMossDeparture: (sessionId) => ipcRenderer.invoke('moss:departure', sessionId),
  getSnapshot: () => ipcRenderer.invoke('snapshot:get'),
  createTask: (input) => ipcRenderer.invoke('task:create', input),
  setTaskRole: (taskId, role) => ipcRenderer.invoke('task:set-role', taskId, role),
  archiveTask: (taskId) => ipcRenderer.invoke('task:archive', taskId),
  deleteTask: (taskId) => ipcRenderer.invoke('task:delete', taskId),
  startDailyRun: (mainTaskId) => ipcRenderer.invoke('expedition:start-run', mainTaskId),
  selectExpeditionNode: (runId, nodeId) => ipcRenderer.invoke('expedition:select-node', runId, nodeId),
  startFocus: (input) => ipcRenderer.invoke('focus:start', input),
  pauseFocus: (sessionId) => ipcRenderer.invoke('focus:pause', sessionId),
  resumeFocus: (sessionId) => ipcRenderer.invoke('focus:resume', sessionId),
  beginSessionDebrief: (sessionId) => ipcRenderer.invoke('focus:begin-debrief', sessionId),
  endFocus: (input) => ipcRenderer.invoke('focus:end', input),
  chooseRunRelic: (runId, nodeId, relicKey) => ipcRenderer.invoke('expedition:choose-relic', runId, nodeId, relicKey),
  chooseNextRoute: (runId, fromNodeId, nextNodeId) => ipcRenderer.invoke('expedition:choose-next-route', runId, fromNodeId, nextNodeId),
  completeRestoration: (projectKey) => ipcRenderer.invoke('archive:complete-restoration', projectKey),
  dismissDebrief: (sessionId) => ipcRenderer.invoke('expedition:dismiss-debrief', sessionId),
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
