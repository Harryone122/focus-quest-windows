import type { BrowserWindow } from 'electron'
import type { FocusQuestDatabase } from './database'

const NEVER_BLOCK = new Set(['explorer.exe', 'searchhost.exe', 'shellexperiencehost.exe', 'startmenuexperiencehost.exe', 'focus quest.exe', 'electron.exe'])

export class WindowMonitor {
  private timer: NodeJS.Timeout | null = null
  private readonly temporaryUnlocks = new Map<string, number>()
  private lastTriggered = ''

  get currentProcessName(): string {
    return this.lastTriggered
  }

  constructor(
    private readonly database: FocusQuestDatabase,
    private readonly overlayWindow: () => BrowserWindow | null,
    private readonly mainWindow: () => BrowserWindow | null
  ) {}

  start(): void {
    if (this.timer) return
    this.timer = setInterval(() => void this.check(), 800)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.lastTriggered = ''
    this.overlayWindow()?.hide()
  }

  unlockTenMinutes(processName: string): void {
    this.temporaryUnlocks.set(processName.toLowerCase(), Date.now() + 10 * 60 * 1000)
    this.overlayWindow()?.hide()
  }

  returnToTask(): void {
    this.overlayWindow()?.hide()
    const win = this.mainWindow()
    win?.show()
    win?.focus()
  }

  private async check(): Promise<void> {
    const snapshot = this.database.getSnapshot()
    if (!snapshot.activeSession) {
      this.stop()
      return
    }
    if (snapshot.activeSession.suspendedAt) {
      this.overlayWindow()?.hide()
      return
    }
    try {
      const { activeWindow } = await import('get-windows')
      const active = await activeWindow()
      const current = this.database.getSnapshot().activeSession
      if (!current || current.id !== snapshot.activeSession.id || current.suspendedAt) return
      const processName = active?.owner?.name?.toLowerCase() ?? ''
      if (!processName || NEVER_BLOCK.has(processName)) return
      const rule = snapshot.blockRules.find((entry) => entry.enabled && entry.processName.toLowerCase() === processName)
      if (!rule) {
        this.lastTriggered = ''
        return
      }
      const unlockedUntil = this.temporaryUnlocks.get(processName) ?? 0
      if (unlockedUntil > Date.now()) return
      if (this.lastTriggered !== processName || !this.overlayWindow()?.isVisible()) {
        this.lastTriggered = processName
        this.database.incrementBlockedAttempt()
        const overlay = this.overlayWindow()
        overlay?.webContents.send('overlay:state', {
          processName,
          displayName: rule.displayName,
          taskTitle: snapshot.activeSession.taskTitle ?? '',
          stepText: snapshot.activeSession.stepText ?? ''
        })
        overlay?.show()
        overlay?.focus()
      }
    } catch (error) {
      console.error('Unable to inspect active window', error)
    }
  }
}
