import { Notification } from 'electron'
import type { FocusQuestDatabase } from './database'

export class ReminderScheduler {
  private timer: NodeJS.Timeout | null = null
  private readonly sent = new Set<string>()

  constructor(private readonly database: FocusQuestDatabase) {}

  start(): void {
    this.check()
    this.timer = setInterval(() => this.check(), 30_000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }

  private check(): void {
    const snapshot = this.database.getSnapshot()
    if (snapshot.settings.reminderPolicy === 'off' || snapshot.activeSession) return
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
    for (const task of snapshot.tasks.filter((entry) => entry.scheduledDate && entry.status === 'active')) {
      if (task.startCue.type !== 'time' || !task.startCue.value) continue
      const cueKey = `${day}:${task.id}:cue`
      if (hhmm === task.startCue.value && !this.sent.has(cueKey)) {
        this.sent.add(cueKey)
        new Notification({ title: '準備啟程', body: `${task.title}：只要先完成第一個小步驟。` }).show()
      }
      if (snapshot.settings.reminderPolicy === 'structured') {
        const [hour, minute] = task.startCue.value.split(':').map(Number)
        const cue = new Date(now)
        cue.setHours(hour, minute, 0, 0)
        const followKey = `${day}:${task.id}:follow`
        const difference = Math.floor((now.getTime() - cue.getTime()) / 60_000)
        if (difference === 15 && !this.sent.has(followKey)) {
          this.sent.add(followKey)
          new Notification({ title: '把任務再縮小一點', body: `不用做完「${task.title}」，先開始五分鐘也可以。` }).show()
        }
      }
    }
    if (snapshot.settings.reminderPolicy === 'structured' && hhmm === snapshot.settings.eveningReminder) {
      const key = `${day}:evening`
      if (!this.sent.has(key)) {
        this.sent.add(key)
        new Notification({ title: '今晚的檔案整理', body: '看看今天留下了哪些真實進展，未完成的可以安心放回任務庫。' }).show()
      }
    }
  }
}
