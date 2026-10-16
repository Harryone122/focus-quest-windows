import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, powerMonitor, screen, Tray } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type {
  AppSettings,
  BackupPayload,
  CreateTaskInput,
  EndFocusInput,
  RpgChoice,
  RunningApplication,
  StartFocusInput,
  TaskRole
} from '../shared/types'
import { FocusQuestDatabase, localDay } from './database'
import type { AddListTaskInput, DeleteYesterdayInput, SaveRoutineInput, StartListFocusInput } from '../shared/taskList'
import { WindowMonitor } from './window-monitor'
import { ReminderScheduler } from './reminders'
import { COLLECTION_CLUES } from '../shared/collectionRoom'
import { FOREST_MAP_ID, MOSS_MAP_ID } from '../shared/specialFinds'

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let database: FocusQuestDatabase
let monitor: WindowMonitor
let reminders: ReminderScheduler
let specialFindTicker: NodeJS.Timeout | null = null
let quitting = false

const lanternSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#101b2d"/>
  <path d="M24 17h16M28 11h8M21 24l6-7h10l6 7-3 24H24z" fill="none" stroke="#e8b75e" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 27l3 6 6 2-6 3-3 7-3-7-6-3 6-2z" fill="#8de5df"/>
</svg>`

function appUrl(route = ''): string {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) return `${devUrl}/#/${route}`
  return `${pathToFileURL(join(__dirname, '../renderer/index.html')).toString()}#/${route}`
}

function windowOptions(backgroundThrottling = true): Electron.BrowserWindowConstructorOptions {
  return {
    backgroundColor: '#0b1423',
    webPreferences: {
      backgroundThrottling,
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  }
}

function createWindows(): void {
  const qaCapturePath = !app.isPackaged ? process.env.FOCUSQUEST_QA_CAPTURE_PATH : undefined
  const qaCaptureSequenceDir = !app.isPackaged ? process.env.FOCUSQUEST_QA_CAPTURE_SEQUENCE_DIR : undefined
  const qaView = !app.isPackaged ? process.env.FOCUSQUEST_QA_VIEW : undefined
  const qaCaptureDelay = Math.max(1000, Math.min(60000, Number(process.env.FOCUSQUEST_QA_CAPTURE_DELAY_MS ?? 5200)))
  const qaCaptureFrameCount = Math.max(2, Math.min(48, Number(process.env.FOCUSQUEST_QA_CAPTURE_FRAME_COUNT ?? 48)))
  const qaWidth = Number(process.env.FOCUSQUEST_QA_WINDOW_WIDTH)
  const qaHeight = Number(process.env.FOCUSQUEST_QA_WINDOW_HEIGHT)
  const qaResizeWidth = Number(process.env.FOCUSQUEST_QA_RESIZE_WIDTH)
  const qaResizeHeight = Number(process.env.FOCUSQUEST_QA_RESIZE_HEIGHT)
  mainWindow = new BrowserWindow({
    // Focus keeps advancing while the player works in another app. Chromium's default background
    // throttling freezes RAF in an occluded/minimized window while the saved Focus clock continues.
    // Manual pause and system sleep still freeze gameplay through the existing pause state.
    ...windowOptions(false),
    width: !app.isPackaged && Number.isFinite(qaWidth) && qaWidth >= 1040 ? qaWidth : qaCapturePath || qaCaptureSequenceDir ? 1366 : 1320,
    height: !app.isPackaged && Number.isFinite(qaHeight) && qaHeight >= 700 ? qaHeight : qaCapturePath || qaCaptureSequenceDir ? 768 : 860,
    minWidth: 1040,
    minHeight: 700,
    autoHideMenuBar: true,
    show: false,
    title: 'Focus Quest'
  })
  if (!app.isPackaged) {
    mainWindow.webContents.on('console-message', (_event, level, message, lineNumber, sourceId) => {
      if (level >= 2) console.warn(`[renderer:${level}] ${message} (${sourceId}:${lineNumber})`)
    })
  }
  mainWindow.loadURL(appUrl(qaView === 'blocker' || qaView === 'mini' ? qaView : qaView ? `qa/${qaView}` : ''))
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (!app.isPackaged && Number.isFinite(qaResizeWidth) && qaResizeWidth >= 1040 && Number.isFinite(qaResizeHeight) && qaResizeHeight >= 700) {
      setTimeout(() => mainWindow?.setSize(qaResizeWidth, qaResizeHeight), 1000)
    }
    if (qaCaptureSequenceDir) {
      setTimeout(async () => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        await mkdir(qaCaptureSequenceDir, { recursive: true })
        for (let index = 0; index < qaCaptureFrameCount; index += 1) {
          if (!mainWindow || mainWindow.isDestroyed()) return
          const image = await mainWindow.webContents.capturePage()
          await writeFile(join(qaCaptureSequenceDir, `frame-${String(index).padStart(3, '0')}.png`), image.toPNG())
          await new Promise((resolve) => setTimeout(resolve, 125))
        }
        // QA capture only (dev builds): exit outright. app.quit() can stall here because the
        // non-closable blocker overlay keeps the process alive, which left QA scripts waiting.
        quitting = true
        app.exit(0)
      }, qaCaptureDelay)
    } else if (qaCapturePath) {
      setTimeout(async () => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        const image = await mainWindow.webContents.capturePage()
        await writeFile(qaCapturePath, image.toPNG())
        // QA capture only (dev builds): exit outright. app.quit() can stall here because the
        // non-closable blocker overlay keeps the process alive, which left QA scripts waiting.
        quitting = true
        app.exit(0)
      }, qaCaptureDelay)
    }
  })
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  const display = screen.getPrimaryDisplay()
  overlayWindow = new BrowserWindow({
    ...windowOptions(),
    ...display.bounds,
    frame: false,
    transparent: false,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    closable: false,
    focusable: true,
    title: 'Focus Quest · 回到任務'
  })
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.loadURL(appUrl('blocker'))

  const trayImage = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(lanternSvg).toString('base64')}`)
  tray = new Tray(trayImage.resize({ width: 20, height: 20 }))
  tray.setToolTip('Focus Quest')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '開啟 Focus Quest', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { type: 'separator' },
    { label: '離開', click: () => { quitting = true; app.quit() } }
  ]))
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus() })
}

function broadcastSnapshot(): void {
  const snapshot = database.getSnapshot()
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('snapshot:changed', snapshot)
}

async function listRunningApplications(): Promise<RunningApplication[]> {
  const { openWindows } = await import('get-windows')
  const windows = await openWindows()
  const unique = new Map<string, RunningApplication>()
  for (const window of windows) {
    const name = window.owner?.name?.trim()
    if (!name) continue
    const processName = name.toLowerCase()
    if (['explorer.exe', 'searchhost.exe', 'shellexperiencehost.exe', 'startmenuexperiencehost.exe', 'focus quest.exe', 'electron.exe'].includes(processName)) continue
    unique.set(processName, { processName, displayName: name.replace(/\.exe$/i, ''), path: window.owner?.path })
  }
  return [...unique.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'zh-Hant'))
}

function registerIpc(): void {
  ipcMain.handle('collection:pin-clue', (_event, id: string) => { const result = database.pinCollectionClue(id); broadcastSnapshot(); return result })
  ipcMain.handle('collection:pin-clues', (_event, ids: string[]) => { const result = database.pinCollectionClues(ids); broadcastSnapshot(); return result })
  ipcMain.handle('collection:set-tracking', (_event, placeId: string | null) => { const result = database.setTrackingClue(placeId); broadcastSnapshot(); return result })
  ipcMain.handle('collection:present-core', (_event, mapId: string) => { const result = database.markCollectionCorePresented(mapId); broadcastSnapshot(); return result })
  ipcMain.handle('collection:play-linkage', () => { const result = database.markCollectionLinkagePlayed(); broadcastSnapshot(); return result })
  ipcMain.handle('lobby:inspect-find', (_event, id: string) => { const result = database.inspectLobbyFind(id); broadcastSnapshot(); return result })
  ipcMain.handle('lobby:inspect-campfire', (_event, stage: number) => { const result = database.inspectCampfireTrace(stage); broadcastSnapshot(); return result })
  ipcMain.handle('task-list:add', (_event, input: AddListTaskInput) => { const result = database.addListTask(input); broadcastSnapshot(); return result })
  ipcMain.handle('task-list:rename', (_event, id: string, title: string) => { const result = database.renameListTask(id, title); broadcastSnapshot(); return result })
  ipcMain.handle('task-list:reorder', (_event, day: string, ids: string[]) => { const result = database.reorderTodayTasks(day, ids); broadcastSnapshot(); return result })
  ipcMain.handle('task-list:move-today', (_event, ids: string[]) => { const result = database.moveTasksToToday(ids); broadcastSnapshot(); return result })
  ipcMain.handle('task-list:set-done', (_event, id: string, done: boolean) => { const result = database.setListTaskDone(id, done); broadcastSnapshot(); return result })
  ipcMain.handle('task-list:delete', (_event, id: string) => { const result = database.deleteListTask(id); broadcastSnapshot(); return result })
  ipcMain.handle('task-list:delete-yesterday', (_event, input: DeleteYesterdayInput) => { const result = database.deleteYesterdayTasks(input); broadcastSnapshot(); return result })
  ipcMain.handle('task-list:save-routines', (_event, inputs: SaveRoutineInput[]) => { const result = database.saveRoutines(inputs); broadcastSnapshot(); return result })
  ipcMain.handle('task-list:start-focus', (_event, input: StartListFocusInput) => {
    const result = database.startListFocus(input)
    monitor.start()
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('task-list:finish-focus', (_event, sessionId: string, completed: boolean) => {
    const result = database.finishListFocus(sessionId, completed)
    if (!result.activeSession) monitor.stop()
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('focus:before-event', (_event,sessionId:string,id:string) => { const result=database.beginBeforeFocusEvent(sessionId,id);broadcastSnapshot();return result })
  ipcMain.handle('focus:before-finish', (_event,sessionId:string,ids:string[]) => { const result=database.finishBeforeFocus(sessionId,ids);broadcastSnapshot();return result })
  ipcMain.handle('focus:recap', (_event,id:string) => database.getFocusRecap(id))
  ipcMain.handle('focus:replays', (_event,runId?:string) => database.listReplayEvents(runId))
  ipcMain.handle('focus:replay', (_event,id:string) => database.getReplayEvent(id))
  ipcMain.handle('snapshot:get', () => database.getSnapshot())
  ipcMain.handle('nursery:scene',(_event,nodeId:string)=>database.getNurseryScene(nodeId))
  ipcMain.handle('nursery:departure',(_event,sessionId:string)=>database.getNurseryDeparture(sessionId))
  ipcMain.handle('nursery:choice',(_event,nodeId:string,choice:'take'|'leave'|'transplant'|'wait')=>{const result=database.chooseCaretaker(nodeId,choice);broadcastSnapshot();return result;})
  ipcMain.handle('lake:scene', (_event, nodeId: string) => database.getLakeScene(nodeId))
  ipcMain.handle('lake:departure', (_event, sessionId: string) => database.getLakeDeparture(sessionId))
  ipcMain.handle('moss:scene', (_event, nodeId: string) => database.getMossScene(nodeId))
  ipcMain.handle('moss:departure', (_event, sessionId: string) => database.getMossDeparture(sessionId))
  ipcMain.handle('world:record-mark', (_event, sessionId: string, mark: string) => {
    const result = database.recordWorldMark(sessionId, mark)
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('cloud:record-story-clue', (_event, sessionId: string, clueId: string) => {
    const result = database.recordCloudStoryClue(sessionId, clueId)
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('task:create', (_event, input: CreateTaskInput) => { const result = database.createTask(input); broadcastSnapshot(); return result })
  ipcMain.handle('task:set-role', (_event, taskId: string, role: TaskRole) => { const result = database.setTaskRole(taskId, role); broadcastSnapshot(); return result })
  ipcMain.handle('task:archive', (_event, taskId: string) => { const result = database.archiveTask(taskId); broadcastSnapshot(); return result })
  ipcMain.handle('task:delete', (_event, taskId: string) => { const result = database.deleteTask(taskId); broadcastSnapshot(); return result })
  ipcMain.handle('expedition:start-run', (_event, mainTaskId: string) => { const result = database.startDailyRun(mainTaskId); broadcastSnapshot(); return result })
  ipcMain.handle('expedition:select-node', (_event, runId: string, nodeId: string) => { const result = database.selectExpeditionNode(runId, nodeId); broadcastSnapshot(); return result })
  ipcMain.handle('focus:start', (_event, input: StartFocusInput) => {
    const result = database.startFocus(input)
    monitor.start()
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('focus:end', (_event, input: EndFocusInput) => {
    const result = database.endFocus(input)
    monitor.stop()
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('focus:pause', (_event, sessionId: string) => {
    const result = database.pauseFocus(sessionId)
    monitor.stop()
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('focus:resume', (_event, sessionId: string) => {
    const result = database.resumeFocus(sessionId)
    if (result.activeSession && !result.activeSession.suspendedAt) monitor.start()
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('focus:begin-debrief', (_event, sessionId: string) => {
    const result = database.beginSessionDebrief(sessionId)
    monitor.stop()
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('expedition:choose-relic', (_event, runId: string, nodeId: string, relicKey: string) => {
    const result = database.chooseRunRelic(runId, nodeId, relicKey)
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('expedition:choose-next-route', (_event, runId: string, fromNodeId: string, nextNodeId: string) => {
    const result = database.chooseNextRoute(runId, fromNodeId, nextNodeId)
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('archive:complete-restoration', (_event, projectKey: string) => {
    const result = database.completeRestoration(projectKey)
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('expedition:dismiss-debrief', (_event, sessionId: string) => {
    const result = database.dismissDebrief(sessionId)
    broadcastSnapshot()
    return result
  })
  ipcMain.handle('apps:list', () => listRunningApplications())
  ipcMain.handle('block-rules:save', (_event, apps: RunningApplication[]) => { const result = database.saveBlockRules(apps); broadcastSnapshot(); return result })
  ipcMain.handle('settings:update', (_event, settings: Partial<AppSettings>) => { const result = database.updateSettings(settings); broadcastSnapshot(); return result })
  ipcMain.handle('rpg:choice', (_event, choice: RpgChoice) => { const result = database.makeRpgChoice(choice); broadcastSnapshot(); return result })
  ipcMain.handle('overlay:return', () => monitor.returnToTask())
  ipcMain.handle('overlay:emergency', (_event, mode: 'ten_minutes' | 'end_session') => {
    if (mode === 'ten_minutes') {
      monitor.unlockTenMinutes(monitor.currentProcessName)
      return
    }
    const active = database.getSnapshot().activeSession
    if (active) database.endFocus({ sessionId: active.id, outcome: 'progress', completeTask: false })
    monitor.stop()
    mainWindow?.show()
    mainWindow?.focus()
    broadcastSnapshot()
  })
  ipcMain.handle('data:export-backup', async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '匯出 Focus Quest 備份',
      defaultPath: `focusquest-backup-${new Date().toISOString().slice(0, 10)}.focusquest.json`,
      filters: [{ name: 'Focus Quest 備份', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    await writeFile(result.filePath, JSON.stringify(database.exportBackup(), null, 2), 'utf8')
    return { canceled: false, path: result.filePath }
  })
  ipcMain.handle('data:import-backup', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '還原 Focus Quest 備份',
      properties: ['openFile'],
      filters: [{ name: 'Focus Quest 備份', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePaths[0]) return { canceled: true }
    const payload = JSON.parse(await readFile(result.filePaths[0], 'utf8')) as BackupPayload
    database.importBackup(payload)
    broadcastSnapshot()
    return { canceled: false, path: result.filePaths[0] }
  })
  ipcMain.handle('data:export-analytics', async () => {
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '匯出匿名使用紀錄',
      defaultPath: `focusquest-anonymous-events-${new Date().toISOString().slice(0, 10)}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) return { canceled: true }
    await writeFile(result.filePath, `\uFEFF${database.analyticsCsv()}`, 'utf8')
    return { canceled: false, path: result.filePath }
  })
}

async function boot(): Promise<void> {
  // Keep automated visual QA isolated from the user's running focus session
  // before Electron acquires its single-instance lock.
  if (!app.isPackaged && process.env.FOCUSQUEST_QA_USER_DATA) app.setPath('userData', process.env.FOCUSQUEST_QA_USER_DATA)
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }
  await app.whenReady()
  app.setAppUserModelId('com.focusquest.desktop')
  database = new FocusQuestDatabase(join(app.getPath('userData'), 'focusquest.db'))
  if (!app.isPackaged && process.env.FOCUSQUEST_QA_SEED === '1' && database.getSnapshot().tasks.length === 0) {
    database.createTask({ title: '完成 Focus Quest 的手繪介面', role: 'main', kind: 'creative', progressDefinition: '完成第一輪動態 UI 系統', starterAction: '先打開主要介面，圈出最需要調整的一個區塊', obstacle: 'perfection', deadline: null, startCue: { type: 'manual', value: '' } })
    database.createTask({ title: '整理明天的會議筆記', role: 'side', kind: 'admin', progressDefinition: '列出三個需要確認的問題', starterAction: null, obstacle: 'too_big', deadline: null, startCue: { type: 'manual', value: '' } })
  }
  if (!app.isPackaged && process.env.FOCUSQUEST_QA_COLLECTION && database.getSnapshot().mapCores.length === 0) {
    const mode = process.env.FOCUSQUEST_QA_COLLECTION
    const backup = database.exportBackup()
    const coreRows = mode === 'all'
      ? Array.from({ length: 10 }, (_, index) => ({ map_id: index === 0 ? FOREST_MAP_ID : index === 1 ? MOSS_MAP_ID : `area-${String(index + 1).padStart(2, '0')}`, item_key: `qa_core_${index + 1}`, acquired_at: new Date(Date.now() + index).toISOString() }))
      : [{ map_id: FOREST_MAP_ID, item_key: 'astrolabe_core', acquired_at: new Date().toISOString() }, { map_id: MOSS_MAP_ID, item_key: 'cracked_compass', acquired_at: new Date(Date.now() + 1).toISOString() }]
    backup.data.map_cores = coreRows
    backup.data.collection_clues = COLLECTION_CLUES.filter((clue) => ['n_first', 'h1a', 'h1b', 'h1c', 'n_tag'].includes(clue.id)).map((clue, index) => ({
      id: clue.id, kind: clue.kind, source_id: clue.sourceId, place_id: clue.placeId, source_label: clue.sourceLabel,
      text: clue.text, acquired_at: new Date(Date.now() + index).toISOString(), pinned_at: clue.id === 'h1c' ? null : new Date(Date.now() + index + 20).toISOString()
    }))
    if (mode !== 'placement') backup.data.collection_core_presentations = coreRows.map((row) => ({ map_id: row.map_id, presented_at: new Date().toISOString() }))
    if (mode === 'all') (backup.data.collection_state as Array<Record<string, unknown>>)[0].linkage_played_at = new Date().toISOString()
    database.importBackup(backup)
  }
  const qaExpedition = !app.isPackaged ? process.env.FOCUSQUEST_QA_EXPEDITION : undefined
  if (qaExpedition && !database.getSnapshot().todayRun) {
    const task = database.getSnapshot().tasks.find((item) => item.role === 'main' && item.status === 'active')
    if (task) {
      const run = database.startDailyRun(task.id)
      const route = run.expeditionNodes.find((node) => node.plannedMinutes === 50) ?? run.expeditionNodes[0]
      if (run.todayRun && route && qaExpedition !== 'map') {
        const selected = database.selectExpeditionNode(run.todayRun.id, route.id)
        if (qaExpedition === 'full' || qaExpedition === 'reward' || qaExpedition === 'archive') {
          const selectedTask = selected.tasks.find((item) => item.id === task.id)!
          const active = database.startFocus({
            taskId: task.id,
            stepId: selectedTask.steps[0].id,
            minimumMinutes: 10,
            blockedProcessNames: [],
            runId: run.todayRun.id,
            nodeId: route.id,
            plannedMinutes: route.plannedMinutes
          })
          const backup = database.exportBackup()
          const sessions = backup.data.sessions as Array<Record<string, unknown>>
          const session = sessions.find((item) => item.id === active.activeSession?.id)
          if (session && active.activeSession) {
            session.started_at = new Date(Date.now() - 51 * 60 * 1000).toISOString()
            database.importBackup(backup)
            database.beginSessionDebrief(active.activeSession.id)
            if (qaExpedition === 'reward' || qaExpedition === 'archive') {
              database.endFocus({ sessionId: active.activeSession.id, outcome: 'progress', completeTask: false })
            }
            if (qaExpedition === 'archive') {
              const discovered = database.getSnapshot()
              const completedNode = discovered.expeditionNodes.find((node) => node.id === route.id)
              const relicKey = completedNode?.rewardOptions[0]
              if (relicKey) {
                const withRelic = database.chooseRunRelic(run.todayRun.id, route.id, relicKey)
                const nextRoute = withRelic.expeditionNodes.find((node) => node.parentNodeId === route.id && node.state === 'available')
                if (nextRoute) database.chooseNextRoute(run.todayRun.id, route.id, nextRoute.id)
              }
            }
          }
        }
      }
    }
  }
  if (!app.isPackaged && process.env.FOCUSQUEST_QA_VIEW === 'focus' && !database.getSnapshot().activeSession) {
    const task = database.getSnapshot().tasks.find((item) => item.role === 'main')
    const step = task?.steps.find((item) => item.status === 'pending')
    if (task && step) {
      const qaSnapshot = database.getSnapshot()
      const selectedNode = qaSnapshot.todayRun?.selectedNodeId
        ? qaSnapshot.expeditionNodes.find((node) => node.id === qaSnapshot.todayRun?.selectedNodeId)
        : undefined
      const started = database.startFocus({
        taskId: task.id,
        stepId: step.id,
        minimumMinutes: 10,
        blockedProcessNames: [],
        ...(qaSnapshot.todayRun && selectedNode
          ? { runId: qaSnapshot.todayRun.id, nodeId: selectedNode.id, plannedMinutes: selectedNode.plannedMinutes }
          : {})
      })
      const elapsedSeconds = Number(process.env.FOCUSQUEST_QA_FOCUS_ELAPSED_SECONDS ?? 0)
      if (started.activeSession && Number.isFinite(elapsedSeconds) && elapsedSeconds > 0) {
        const backup = database.exportBackup()
        const sessions = backup.data.sessions as Array<Record<string, unknown>>
        const session = sessions.find((item) => item.id === started.activeSession?.id)
        if (session) {
          session.started_at = new Date(Date.now() - elapsedSeconds * 1000).toISOString()
          database.importBackup(backup)
        }
      }
    }
  }
  createWindows()
  monitor = new WindowMonitor(database, () => overlayWindow, () => mainWindow)
  reminders = new ReminderScheduler(database)
  registerIpc()
  reminders.start()
  // A previous process may have exited during system sleep. Keep manual pause.
  database.resumeActiveSession()
  const activeSession = database.getSnapshot().activeSession
  if (activeSession && !activeSession.suspendedAt) monitor.start()

  if (database.processActiveSpecialFinds()) broadcastSnapshot()
  let snapshotDay = localDay()
  specialFindTicker = setInterval(() => {
    const day = localDay()
    const rewardChanged = database.processActiveSpecialFinds()
    if (rewardChanged || day !== snapshotDay) {
      snapshotDay = day
      broadcastSnapshot()
    }
  }, 1000)

  powerMonitor.on('suspend', () => {
    database.suspendActiveSession()
    monitor.stop()
    broadcastSnapshot()
  })
  powerMonitor.on('resume', () => {
    database.resumeActiveSession()
    const session = database.getSnapshot().activeSession
    if (session && !session.suspendedAt) monitor.start()
    database.processActiveSpecialFinds()
    broadcastSnapshot()
  })
  app.on('second-instance', () => { mainWindow?.show(); mainWindow?.focus() })
}

app.on('before-quit', () => { quitting = true })
app.on('will-quit', () => {
  if (specialFindTicker) clearInterval(specialFindTicker)
  reminders?.stop()
  monitor?.stop()
  database?.close()
})
app.on('window-all-closed', () => {
  // Keep the Windows tray process alive while the focus session or reminders are active.
})

void boot()
