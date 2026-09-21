import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, Notification, powerMonitor, screen, Tray } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile, writeFile } from 'node:fs/promises'
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
import { FocusQuestDatabase } from './database'
import { WindowMonitor } from './window-monitor'
import { ReminderScheduler } from './reminders'

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let miniWindow: BrowserWindow | null = null
let tray: Tray | null = null
let database: FocusQuestDatabase
let monitor: WindowMonitor
let reminders: ReminderScheduler
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

function windowOptions(): Electron.BrowserWindowConstructorOptions {
  return {
    backgroundColor: '#0b1423',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  }
}

function createWindows(): void {
  const qaCapturePath = !app.isPackaged ? process.env.FOCUSQUEST_QA_CAPTURE_PATH : undefined
  const qaView = !app.isPackaged ? process.env.FOCUSQUEST_QA_VIEW : undefined
  mainWindow = new BrowserWindow({
    ...windowOptions(),
    width: qaCapturePath ? 1366 : 1320,
    height: qaCapturePath ? 768 : 860,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    title: 'Focus Quest'
  })
  mainWindow.loadURL(appUrl(qaView === 'blocker' || qaView === 'mini' ? qaView : qaView ? `qa/${qaView}` : ''))
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (qaCapturePath) {
      setTimeout(async () => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        const image = await mainWindow.webContents.capturePage()
        await writeFile(qaCapturePath, image.toPNG())
        quitting = true
        app.quit()
      }, 1600)
    }
  })
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
      new Notification({ title: 'Focus Quest 仍在守望', body: '專注計時與提醒會繼續運作，可從系統列重新開啟。' }).show()
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

  miniWindow = new BrowserWindow({
    ...windowOptions(),
    width: 300,
    height: 108,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    title: 'Focus Quest · 專注中'
  })
  const work = display.workArea
  miniWindow.setPosition(work.x + work.width - 324, work.y + work.height - 132)
  miniWindow.loadURL(appUrl('mini'))

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
  for (const win of [mainWindow, miniWindow]) {
    if (win && !win.isDestroyed()) win.webContents.send('snapshot:changed', snapshot)
  }
  if (snapshot.activeSession && snapshot.settings.miniTimer) miniWindow?.showInactive()
  else miniWindow?.hide()
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
  ipcMain.handle('snapshot:get', () => database.getSnapshot())
  ipcMain.handle('task:create', (_event, input: CreateTaskInput) => { const result = database.createTask(input); broadcastSnapshot(); return result })
  ipcMain.handle('task:set-role', (_event, taskId: string, role: TaskRole) => { const result = database.setTaskRole(taskId, role); broadcastSnapshot(); return result })
  ipcMain.handle('task:archive', (_event, taskId: string) => { const result = database.archiveTask(taskId); broadcastSnapshot(); return result })
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
    if (active) database.endFocus({ sessionId: active.id, outcome: 'progress' })
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
  if (!app.isPackaged && process.env.FOCUSQUEST_QA_VIEW === 'focus' && !database.getSnapshot().activeSession) {
    const task = database.getSnapshot().tasks.find((item) => item.role === 'main')
    const step = task?.steps.find((item) => item.status === 'pending')
    if (task && step) database.startFocus({ taskId: task.id, stepId: step.id, minimumMinutes: 10, blockedProcessNames: [] })
  }
  createWindows()
  monitor = new WindowMonitor(database, () => overlayWindow, () => mainWindow)
  reminders = new ReminderScheduler(database)
  registerIpc()
  reminders.start()
  if (database.getSnapshot().activeSession) monitor.start()

  powerMonitor.on('suspend', () => database.suspendActiveSession())
  powerMonitor.on('resume', () => { database.resumeActiveSession(); broadcastSnapshot() })
  app.on('second-instance', () => { mainWindow?.show(); mainWindow?.focus() })
}

app.on('before-quit', () => { quitting = true })
app.on('will-quit', () => {
  reminders?.stop()
  monitor?.stop()
  database?.close()
})
app.on('window-all-closed', () => {
  // Keep the Windows tray process alive while the focus session or reminders are active.
})

void boot()
