import { useEffect, useRef, useState } from 'react'
import { ArchiveGame } from './ArchiveGame'
import travelerGraphicUrl from './assets/lantern-traveler-silhouette.svg'
import { suggestStartingActions } from '../../shared/decomposition'
import type {
  AppSettings,
  AppSnapshot,
  CreateTaskInput,
  FocusOutcome,
  FocusResult,
  FocusSession,
  Obstacle,
  OverlayState,
  QuestTask,
  ReminderPolicy,
  RpgChoice,
  RunningApplication,
  TaskKind,
  TaskRole
} from '../../shared/types'

type View = 'today' | 'library' | 'journey' | 'insights' | 'settings'

function initialView(): View {
  const candidate = window.location.hash.replace(/^#\/?qa\//, '')
  return (['today', 'library', 'journey', 'insights', 'settings'] as View[]).includes(candidate as View) ? candidate as View : 'today'
}

const KIND_LABELS: Record<TaskKind, string> = {
  study: '讀書', report: '報告', admin: '行政', creative: '創作', other: '其他'
}

const OBSTACLE_LABELS: Record<Obstacle, string> = {
  unclear: '不知道怎麼開始', too_big: '規模太大', boring: '覺得無聊', perfection: '怕做得不完美', missing_info: '缺少資料'
}

const ROLE_LABELS: Record<TaskRole, string> = { main: '主線', side: '支線', backlog: '任務庫' }

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^Error invoking remote method '[^']+': Error: /, '')
}

function emitUiCue(cue: 'paper-hover' | 'ink-select' | 'paper-open' | 'paper-close' | 'reward-accent' | 'warning-brush'): void {
  window.dispatchEvent(new CustomEvent('focusquest-ui-sound', { detail: { cue, at: Date.now() } }))
}

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function sessionSeconds(session: FocusSession, now: number): number {
  const end = session.endedAt ? new Date(session.endedAt).getTime() : now
  return Math.max(0, Math.floor((end - new Date(session.startedAt).getTime()) / 1000) - session.pausedSeconds)
}

function useSnapshot(): [AppSnapshot | null, (next: AppSnapshot) => void, string | null, (message: string | null) => void] {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void window.focusQuest.getSnapshot().then(setSnapshot).catch((reason) => setError(friendlyError(reason)))
    return window.focusQuest.onSnapshotChanged(setSnapshot)
  }, [])
  return [snapshot, setSnapshot, error, setError]
}

type UiIconName = 'today' | 'library' | 'journey' | 'insights' | 'settings'

function UiIcon({ name }: { name: UiIconName }): React.JSX.Element {
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
    {name === 'today' && <path d="M12.2 3.2c.8 3.7 2.2 6.1 6.2 7.4-3.8 1-5.8 3.4-6.4 7.8-.8-4.1-2.6-6.5-6.5-7.6 3.8-1.4 5.5-3.5 6.7-7.6Z" />}
    {name === 'library' && <><path d="M5 4.3c3.2-.7 5.4-.2 7 1.3v14c-2-1.6-4.2-2.1-7-1.3Z" /><path d="M19 4.5c-3.2-.7-5.5-.3-7 1.1v14c2-1.5 4.2-2 7-1.2Z" /><path d="M7.3 8.2c1.3-.2 2.2 0 3 .4M14 8.5c1-.4 1.9-.5 3-.3" /></>}
    {name === 'journey' && <><path d="M12 3.2c4.8 2.2 7.4 5.1 8 8.7-1.4 3.9-4 6.8-8.1 8.8-4.1-2.1-6.8-5-7.9-8.8.9-3.8 3.4-6.6 8-8.7Z" /><path d="m14.8 8.4-1.4 5.1-4.2 2 1.5-5.1 4.1-2Z" /></>}
    {name === 'insights' && <><path d="M4 18.8c2.5-1 3.4-5 5.4-4.7 2.1.3 2.3 2.5 4.2 1.4 2.2-1.2 2.5-5.9 6.4-8" /><path d="M4.2 5v14.1h15.5" /></>}
    {name === 'settings' && <><path d="M9.9 3.7 11 2.8l2.7.4.7 1.4 2 .7 1.4-.6 1.8 2.2-.5 1.5.7 2-.6 1.4.5 1.9-1.9 1.8-1.5-.4-1.8 1-.6 1.5-2.7.4-1.1-1.2-2-.7-1.5.7-1.8-2 .5-1.7-.8-1.9.8-1.5-.4-2 1.8-1.7 1.7.3 1.8-1-.1-1.6Z" /><path d="M14.9 11.9c0 1.7-1.3 3-3 3s-2.9-1.3-2.9-3 1.3-2.9 2.9-2.9 3 1.3 3 2.9Z" /></>}
  </svg>
}

type SettingGlyphName = 'bell' | 'phone' | 'timer' | 'traveler' | 'backup' | 'restore' | 'record'

function SettingGlyph({ name }: { name: SettingGlyphName }): React.JSX.Element {
  return <svg className="setting-glyph" viewBox="0 0 48 48" aria-hidden="true">
    {name === 'bell' && <><path d="M15 31c2-3 2-7 2-12 0-5 3-9 8-9s8 4 8 9c0 5 0 9 3 12-7 2-14 2-21 0Z" /><path d="M21 36c2 3 6 3 8 0M11 18c1-5 4-10 8-12M38 18c-1-5-3-9-7-12" /></>}
    {name === 'phone' && <><path d="M17 7c5-1 10-1 15 0l1 33c-5 1-11 1-16 0Z" /><path d="M21 12h8M22 35c2 1 4 1 6 0M8 13c4 2 5 7 5 11M6 20l2-7 7 2" /></>}
    {name === 'timer' && <><path d="M15 12c7-4 17-1 21 6 4 8 0 17-8 21-8 3-17-1-20-9-2-7 1-14 7-18Z" /><path d="M24 17v9l7 4M18 6h12M35 11l4 4" /></>}
    {name === 'traveler' && <><path d="M17 15c0-5 3-9 8-9 4 0 7 3 7 8 0 4-3 8-7 8-5 0-8-3-8-7Z" /><path d="M13 42c1-12 5-19 12-19s11 7 12 19M15 31 7 38M34 31l8 5" /><path d="M7 35c3 0 6 3 6 6H5c0-3 1-5 2-6Z" /></>}
    {name === 'backup' && <><path d="M9 16 21 7h18v32H9Z" /><path d="M21 7v10H10M17 28h14M24 21v14" /></>}
    {name === 'restore' && <><path d="M13 14c7-8 20-7 26 2 5 9 1 21-9 25-8 3-17-1-21-7" /><path d="m6 14 8 1 1-8M25 16v11l8 5" /></>}
    {name === 'record' && <><path d="M10 8c9 2 19 2 28 0v31c-9-2-19-2-28 0Z" /><path d="M16 16h16M16 23h12M16 30h15" /></>}
  </svg>
}

function ReminderGlyph({ mode }: { mode: ReminderPolicy }): React.JSX.Element {
  return <svg className="reminder-glyph" viewBox="0 0 42 42" aria-hidden="true">
    <path d="M15 28c2-3 2-6 2-10 0-4 2-7 5-7 4 0 6 3 6 7 0 4 0 7 2 10-5 2-10 2-15 0ZM19 32c2 2 4 2 6 0" />
    {mode === 'off' && <path d="m9 9 24 24" />}
    {mode === 'gentle' && <path d="M31 15c2 3 2 6 0 9" />}
    {mode === 'structured' && <><path d="M31 13c3 4 3 10 0 14M35 9c6 7 6 17 0 24" /></>}
  </svg>
}

function QuestPath({ task, onCreate }: { task?: QuestTask; onCreate?: () => void }): React.JSX.Element {
  return <div className="quest-path" role="img" aria-label={task ? `${task.title}，今日目標：${task.progressDefinition}` : '尚未選擇今日主線'}>
    <svg viewBox="0 0 560 150" aria-hidden="true">
      <path className="route-sketch" d="M36 111C95 111 120 65 188 55s97 57 154 49 97-53 178-61" />
      <path className="route-echo" d="M38 116c62-3 85-44 151-55 70-11 91 52 153 47 67-5 102-57 176-60" />
      {task && <>
        <g className="route-node current" transform="translate(190 55)">
          <path d="M0-13 8-7 13 2 7 11-3 14-12 7-13-4-7-11Z" />
          <circle r="4" />
        </g>
        <g className="route-node destination" transform="translate(500 46)">
          <path d="M0-13 8-7 13 2 7 11-3 14-12 7-13-4-7-11Z" />
          <circle r="4" />
        </g>
      </>}
    </svg>
    {!task && <button className="map-add" aria-label="建立今日主線" title="建立今日主線" onClick={onCreate}><span>＋</span></button>}
  </div>
}

function LanternMark(): React.JSX.Element {
  return (
    <div className="lantern-mark" aria-hidden="true">
      <span className="lantern-handle" />
      <span className="lantern-star">✦</span>
    </div>
  )
}

function TaskCard({ task, onStart, onMove, onArchive, onDelete }: {
  task: QuestTask
  onStart: (task: QuestTask) => void
  onMove: (taskId: string, role: TaskRole) => void
  onArchive: (taskId: string) => void
  onDelete: (task: QuestTask) => void
}): React.JSX.Element {
  const next = task.steps.find((step) => step.status === 'pending')
  return (
    <article className={`task-card role-${task.role}`}>
      <header>
        <span className="role-chip">{ROLE_LABELS[task.role]}</span>
        <span className="kind-label">{KIND_LABELS[task.kind]}</span>
      </header>
      <h3>{task.title}</h3>
      <p className="next-step"><span>今日目標</span>{task.progressDefinition}</p>
      {task.starterAction && <p className="starter-note"><span>↳</span>{task.starterAction}</p>}
      <div className="task-meta">
        <span>{task.starterAction ? '已選擇起跑方式' : '直接開始'}</span>
        {task.startCue.type !== 'manual' && <span>{task.startCue.type === 'time' ? `今天 ${task.startCue.value}` : `當 ${task.startCue.value}`}</span>}
        {task.deadline && <span>期限 {task.deadline}</span>}
      </div>
      <div className="task-actions">
        {next && task.role !== 'backlog' && <button className="primary-button small" onClick={() => onStart(task)}>開始專注</button>}
        {task.role === 'backlog' && <>
          <button className="ghost-button small" onClick={() => onMove(task.id, 'main')}>設為主線</button>
          <button className="ghost-button small" onClick={() => onMove(task.id, 'side')}>設為支線</button>
        </>}
        {task.role !== 'backlog' && <button className="text-button" title="保留任務與紀錄，稍後再排" onClick={() => onMove(task.id, 'backlog')}>暫放</button>}
        <button className="text-button quiet" onClick={() => onArchive(task.id)}>封存</button>
        <button className="text-button danger" onClick={() => onDelete(task)}>刪除</button>
      </div>
    </article>
  )
}

function TaskWizard({ snapshot, onClose, onSaved }: {
  snapshot: AppSnapshot
  onClose: () => void
  onSaved: (snapshot: AppSnapshot) => void
}): React.JSX.Element {
  const preferredRole: TaskRole = !snapshot.tasks.some((task) => task.role === 'main' && task.status === 'active')
    ? 'main'
    : snapshot.tasks.filter((task) => task.role === 'side' && task.status === 'active').length < 2 ? 'side' : 'backlog'
  const [stage, setStage] = useState(1)
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<TaskKind>('study')
  const [role, setRole] = useState<TaskRole>(preferredRole)
  const [progressDefinition, setProgressDefinition] = useState('')
  const [obstacle, setObstacle] = useState<Obstacle>('too_big')
  const [deadline, setDeadline] = useState('')
  const [cueType, setCueType] = useState<'time' | 'event' | 'manual'>('manual')
  const [cueValue, setCueValue] = useState('')
  const [starterOptions, setStarterOptions] = useState<string[]>([])
  const [starterAction, setStarterAction] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const next = (): void => {
    setError('')
    if (stage === 1 && !title.trim()) return setError('先替這次冒險取一個清楚的任務名稱。')
    if (stage === 2 && !progressDefinition.trim()) return setError('請寫下今天看到什麼就算有進展。')
    if (stage === 3) {
      setStarterOptions(suggestStartingActions(kind, obstacle, title, progressDefinition))
      setStarterAction(null)
    }
    setStage((value) => Math.min(4, value + 1))
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setError('')
    const input: CreateTaskInput = {
      title, role, kind, progressDefinition, obstacle,
      starterAction: starterAction?.trim() || null,
      deadline: deadline || null,
      startCue: { type: cueType, value: cueType === 'manual' ? '' : cueValue }
    }
    try {
      onSaved(await window.focusQuest.createTask(input))
      onClose()
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal wizard-modal" role="dialog" aria-modal="true" aria-label="建立任務" data-stage={stage}>
        <span className="journal-page-mark" aria-hidden="true">FIELD NOTE / 0{stage}</span>
        <div className="modal-header">
          <div><p className="eyebrow">編入今日檔案</p><h2>把任務縮小到能開始</h2></div>
          <button className="icon-button" onClick={onClose} aria-label="關閉">×</button>
        </div>
        <div className="wizard-progress">{[1, 2, 3, 4].map((value) => <span key={value} className={value <= stage ? 'active' : ''} />)}</div>

        {stage === 1 && <div className="wizard-page">
          <label className="field"><span>你想推進什麼？</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：準備下週的英文報告" /></label>
          <div className="field"><span>任務類型</span><div className="option-grid five">{Object.entries(KIND_LABELS).map(([value, label]) => <button key={value} className={kind === value ? 'option active' : 'option'} onClick={() => setKind(value as TaskKind)}>{label}</button>)}</div></div>
          <div className="field"><span>放在哪裡？</span><div className="option-grid three">{(['main', 'side', 'backlog'] as TaskRole[]).map((value) => <button key={value} className={role === value ? 'option active' : 'option'} onClick={() => setRole(value)}><strong>{ROLE_LABELS[value]}</strong><small>{value === 'main' ? '今天最重要' : value === 'side' ? '最多兩件' : '稍後再安排'}</small></button>)}</div></div>
        </div>}

        {stage === 2 && <div className="wizard-page">
          <label className="field"><span>今天做到什麼，就算真的有進展？</span><textarea autoFocus value={progressDefinition} onChange={(event) => setProgressDefinition(event.target.value)} placeholder="例如：完成開場與三個段落標題" /></label>
          <div className="two-columns">
            <label className="field"><span>真正存在的期限（選填）</span><input type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
            <label className="field"><span>開始提示</span><select value={cueType} onChange={(event) => { setCueType(event.target.value as typeof cueType); setCueValue('') }}><option value="manual">手動開始</option><option value="time">指定時間</option><option value="event">接續事件</option></select></label>
          </div>
          {cueType === 'time' && <label className="field"><span>提醒時間</span><input type="time" value={cueValue} onChange={(event) => setCueValue(event.target.value)} /></label>}
          {cueType === 'event' && <label className="field"><span>當什麼事情發生之後？</span><input value={cueValue} onChange={(event) => setCueValue(event.target.value)} placeholder="例如：吃完晚餐" /></label>}
        </div>}

        {stage === 3 && <div className="wizard-page">
          <p className="question">現在最容易讓你停在原地的是什麼？</p>
          <div className="obstacle-list">{Object.entries(OBSTACLE_LABELS).map(([value, label]) => <button key={value} className={obstacle === value ? 'obstacle active' : 'obstacle'} onClick={() => setObstacle(value as Obstacle)}><span>{obstacle === value ? '✦' : '○'}</span>{label}</button>)}</div>
        </div>}

        {stage === 4 && <div className="wizard-page">
          <p className="question">如果需要，選一個起跑方式。</p>
          <p className="starter-explainer">這不是待辦清單，也不需要全部完成；它只負責幫你跨出第一步。</p>
          <div className="starter-choice-list">{starterOptions.map((action, index) => <button key={action} className={starterAction === action ? 'starter-choice active' : 'starter-choice'} onClick={() => setStarterAction(action)}><span>0{index + 1}</span><strong>{action}</strong></button>)}</div>
          <button className={starterAction === null ? 'skip-choice active' : 'skip-choice'} onClick={() => setStarterAction(null)}><strong>SKIP</strong><span>我知道怎麼開始，直接加入冒險</span></button>
          {starterAction && <label className="field starter-edit"><span>想換成自己的說法，也可以直接修改</span><input value={starterAction} onChange={(event) => setStarterAction(event.target.value)} /></label>}
        </div>}

        {error && <p className="form-error">{error}</p>}
        <footer className="modal-footer">
          {stage > 1 ? <button className="ghost-button" onClick={() => setStage((value) => value - 1)}>上一步</button> : <span />}
          {stage < 4 ? <button className="primary-button" onClick={next}>繼續</button> : <button className="primary-button" disabled={saving} onClick={() => void save()}>{saving ? '正在編目…' : '加入今日冒險'}</button>}
        </footer>
      </section>
    </div>
  )
}

function FocusSetup({ task, snapshot, onClose, onStarted }: {
  task: QuestTask
  snapshot: AppSnapshot
  onClose: () => void
  onStarted: (snapshot: AppSnapshot) => void
}): React.JSX.Element {
  const step = task.steps.find((entry) => entry.status === 'pending')!
  const [minimum, setMinimum] = useState<5 | 10 | 15>(10)
  const [phoneParked, setPhoneParked] = useState(!snapshot.settings.phoneRitual)
  const [apps, setApps] = useState<RunningApplication[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set(snapshot.blockRules.filter((rule) => rule.enabled).map((rule) => rule.processName)))
  const [loadingApps, setLoadingApps] = useState(true)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    void window.focusQuest.listRunningApplications()
      .then(setApps)
      .catch((reason) => setError(friendlyError(reason)))
      .finally(() => setLoadingApps(false))
  }, [])

  const toggleApp = (name: string): void => setSelected((current) => {
    const next = new Set(current)
    if (next.has(name)) next.delete(name); else next.add(name)
    return next
  })

  const start = async (): Promise<void> => {
    setStarting(true)
    setError('')
    try {
      const chosen = apps.filter((app) => selected.has(app.processName))
      await window.focusQuest.saveBlockRules(chosen)
      const next = await window.focusQuest.startFocus({ taskId: task.id, stepId: step.id, minimumMinutes: minimum, blockedProcessNames: [...selected] })
      onStarted(next)
      onClose()
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setStarting(false)
    }
  }

  return <div className="modal-backdrop"><section className="modal focus-setup departure-sheet">
    <div className="departure-stamp" aria-hidden="true">READY<br />TO BEGIN</div>
    <div className="modal-header"><div><p className="eyebrow">準備啟程</p><h2>{task.title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
    <div className="focus-intention"><span>這次想留下的進展</span><strong>{task.progressDefinition}</strong></div>
    {task.starterAction && <div className="starter-prompt"><span>如果一時卡住，可以先從這裡開始</span><strong>↳ {task.starterAction}</strong><small>這只是起跑提示，不是必須完成的關卡。</small></div>}
    <div className="field"><span>最低承諾</span><div className="option-grid three">{([5, 10, 15] as const).map((value) => <button key={value} className={minimum === value ? 'option active' : 'option'} onClick={() => setMinimum(value)}><strong>{value} 分鐘</strong><small>{value === 5 ? '先跨出去' : value === 10 ? '建議' : '已經熱身'}</small></button>)}</div></div>
    {snapshot.settings.phoneRitual && <label className="phone-ritual"><input type="checkbox" checked={phoneParked} onChange={(event) => setPhoneParked(event.target.checked)} /><span><strong>手機已經離開伸手範圍</strong><small>Windows 版無法替你封鎖 iPhone，先用環境替自己減少一次選擇。</small></span></label>}
    <div className="field"><span>這次要攔下的桌面程式</span>{loadingApps ? <p className="muted">正在讀取目前執行的程式…</p> : apps.length ? <div className="app-picker">{apps.map((app) => <label key={app.processName}><input type="checkbox" checked={selected.has(app.processName)} onChange={() => toggleApp(app.processName)} /><span>{app.displayName}</span></label>)}</div> : <p className="muted">目前沒有其他可選的桌面程式，仍可直接開始。</p>}</div>
    {error && <p className="form-error">{error}</p>}
    <div className="modal-footer"><button className="ghost-button" onClick={onClose}>取消</button><button className="primary-button" disabled={!phoneParked || starting} onClick={() => void start()}>{starting ? '點亮星燈…' : '開始專注'}</button></div>
  </section></div>
}

function FocusActive({ snapshot, onEnded }: { snapshot: AppSnapshot; onEnded: (result: FocusResult) => void }): React.JSX.Element {
  const session = snapshot.activeSession!
  const activeTask = snapshot.tasks.find((task) => task.id === session.taskId)
  const [now, setNow] = useState(Date.now())
  const [choosing, setChoosing] = useState(false)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  const elapsed = sessionSeconds(session, now)
  const minimum = session.minimumMinutes * 60
  const reached = elapsed >= minimum
  const end = async (outcome: FocusOutcome): Promise<void> => {
    setEnding(true)
    try { onEnded(await window.focusQuest.endFocus({ sessionId: session.id, outcome })) }
    catch (reason) { setError(friendlyError(reason)); setEnding(false) }
  }
  return <main className="focus-active">
    <div className="focus-stars" aria-hidden="true"><i /><i /><i /><i /><i /></div>
    <div className="focus-margin-note" aria-hidden="true"><span>FIELD SESSION</span><b>{session.minimumMinutes}</b><small>MINIMUM</small></div>
    <div className="focus-core">
      <div className="focus-lantern" aria-hidden="true"><span /><i /></div>
      <p className="eyebrow">星燈已點亮</p>
      <h1>{session.taskTitle}</h1>
      <p className="focus-step">{activeTask?.progressDefinition ?? session.stepText}</p>
      {activeTask?.starterAction && <p className="focus-starter">起跑提示　↳ {activeTask.starterAction}</p>}
      <div className={reached ? 'focus-timer reached' : 'focus-timer'}>{formatClock(reached ? elapsed : minimum - elapsed)}</div>
      <p className="timer-caption">{reached ? `已越過 ${session.minimumMinutes} 分鐘最低承諾，現在可以自由繼續。` : `再 ${formatClock(minimum - elapsed)} 就完成最低承諾。`}</p>
      <div className="minimum-track"><span style={{ width: `${Math.min(100, (elapsed / minimum) * 100)}%` }} /></div>
      {!choosing ? <button className="ghost-button end-button" onClick={() => setChoosing(true)}>結束這次專注</button> : <div className="outcome-panel">
        <p>這次留下了什麼？</p>
        <button disabled={ending} onClick={() => void end('completed')}><strong>完成今天的目標</strong><span>記錄星頁並完成這次任務</span></button>
        <button disabled={ending} onClick={() => void end('progress')}><strong>有推進，還沒完成</strong><span>保留時間與真實進度</span></button>
        <button disabled={ending} onClick={() => void end('blocked')}><strong>仍然卡住</strong><span>不處罰，下次可以換一個起跑方式</span></button>
        <button className="text-button" onClick={() => setChoosing(false)}>繼續專注</button>
      </div>}
      {error && <p className="form-error">{error}</p>}
    </div>
  </main>
}

function RewardModal({ result, onClose }: { result: FocusResult; onClose: () => void }): React.JSX.Element {
  return <div className="modal-backdrop"><section className="modal reward-modal">
    <div className="reward-artifact" aria-hidden="true"><span className="reward-glyph">✦</span><i /><b>ARCHIVE<br />RECORD</b></div>
    <div className="reward-copy">
      <p className="eyebrow">進展已被檔案館記住</p>
      <h2>{result.storyAdvanced ? '一張星頁重新發光' : '星燈記下了這段旅程'}</h2>
      <div className="reward-row"><div><strong>+{result.earnedLight}</strong><span>燈火</span></div>{result.earnedStarPage && <div><strong>+1</strong><span>星頁</span></div>}{result.earnedMaterial && <div><strong>+1</strong><span>修復素材</span></div>}</div>
      {result.loot && <p className="loot-line"><span>FOUND</span>{result.loot}</p>}
      <button className="primary-button" onClick={onClose}>回到今日冒險</button>
    </div>
  </section></div>
}

function TodayView({ snapshot, onCreate, onStart, onMove, onParkMain, onArchive, onDelete }: {
  snapshot: AppSnapshot
  onCreate: () => void
  onStart: (task: QuestTask) => void
  onMove: (id: string, role: TaskRole) => void
  onParkMain: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (task: QuestTask) => void
}): React.JSX.Element {
  const today = snapshot.tasks.filter((task) => task.role !== 'backlog' && task.status === 'active')
  const main = today.find((task) => task.role === 'main')
  const sides = today.filter((task) => task.role === 'side')
  const next = main?.steps.find((step) => step.status === 'pending')
  const dateLabel = new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())

  return <div className="view-content today-view">
    <section className="today-hero">
      <div className="hero-painting" aria-hidden="true" />
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-orbit orbit-one" aria-hidden="true" /><div className="hero-orbit orbit-two" aria-hidden="true" />
      <div className="hero-copy visual-quest-map">
        <div className="hero-kicker"><span className="signal-dot" />{dateLabel}</div>
        <div className="map-heading"><span aria-hidden="true">✦</span><h1>{main ? '走下一步' : '選一條路'}</h1></div>
        <QuestPath task={main} onCreate={onCreate} />
        <div className="hero-actions">
          {main && next
            ? <button className="primary-button hero-start" onClick={() => onStart(main)}><span>啟程</span><b>→</b></button>
            : <button className="primary-button hero-start" onClick={onCreate}><span>選擇</span><b>＋</b></button>}
          {main && <button className="park-task-button" title="保留這項任務與所有紀錄，暫時換一件事" onClick={() => onParkMain(main.id)}><span>↙</span><b>暫放，換一件</b></button>}
          {main && <button className="delete-task-button" title="永久刪除輸入錯誤的任務" onClick={() => onDelete(main)}>刪除</button>}
          <button className="map-tool-button" aria-label="新增其他任務" title="新增其他任務" onClick={onCreate}>＋</button>
        </div>
      </div>

      <aside className="hero-focus-card">
        <span className="paper-pin" aria-hidden="true" />
        <div className="focus-card-top"><span className="quest-seal" aria-label="主線任務">✦</span><small>{main ? KIND_LABELS[main.kind] : '未選擇'}</small></div>
        <h2>{main?.title ?? '今天的主線'}</h2>
        <small className="goal-label">今日想看見的進展</small>
        <div className="next-mark"><span aria-hidden="true">↳</span><strong>{main?.progressDefinition ?? '選一件值得前進的事'}</strong></div>
        {main?.starterAction && <p className="hero-starter"><span>起跑提示</span>{main.starterAction}</p>}
      </aside>

      <div className="hero-resources" aria-label="檔案館資源">
        <div aria-label={`${snapshot.rpg.light} 點燈火`} title="燈火"><span className="resource-glyph amber">✦</span><strong>{snapshot.rpg.light.toString().padStart(2, '0')}</strong></div>
        <div aria-label={`${snapshot.rpg.starPages} 張星頁`} title="星頁"><span className="resource-glyph cyan">◇</span><strong>{snapshot.rpg.starPages.toString().padStart(2, '0')}</strong></div>
        <div aria-label={`第一章，第 ${snapshot.rpg.node} 個節點`} title="旅程進度"><span className="resource-glyph paper">Ⅰ</span><strong>{snapshot.rpg.node.toString().padStart(2, '0')}</strong></div>
      </div>
    </section>

    <section className="quest-section side-quest-section">
      <div className="section-title rich-title"><div><span aria-hidden="true">⋯</span><h2>支線</h2></div><p>{sides.length} / 2</p></div>
      <div className="task-grid">{sides.map((task) => <TaskCard key={task.id} task={task} onStart={onStart} onMove={onMove} onArchive={onArchive} onDelete={onDelete} />)}{sides.length < 2 && <button className="empty-slot compact" onClick={onCreate}><span>＋</span><strong>加支線</strong></button>}</div>
    </section>
    <section className="daily-note"><span>↶</span><div><strong>明天再排也可以</strong></div></section>
  </div>
}

function LibraryView({ snapshot, onCreate, onMove, onArchive, onDelete }: {
  snapshot: AppSnapshot; onCreate: () => void; onMove: (id: string, role: TaskRole) => void; onArchive: (id: string) => void; onDelete: (task: QuestTask) => void
}): React.JSX.Element {
  const tasks = snapshot.tasks.filter((task) => task.role === 'backlog' && task.status === 'active')
  const completed = snapshot.tasks.filter((task) => task.status === 'done')
  return <div className="view-content"><header className="page-heading compact-heading"><div><p className="eyebrow">任務庫</p><h1>未出發的路</h1></div><button className="primary-button" onClick={onCreate}>＋ 新增</button></header>
    <section className="quest-section"><div className="section-title"><h2>暫放與待選</h2><span>{tasks.length}</span></div>{tasks.length ? <div className="task-grid">{tasks.map((task) => <TaskCard key={task.id} task={task} onStart={() => undefined} onMove={onMove} onArchive={onArchive} onDelete={onDelete} />)}</div> : <div className="panel quiet-empty">沒有暫放或待選任務</div>}</section>
    {!!completed.length && <section className="completed-list"><h2>完成</h2>{completed.map((task) => <div key={task.id}><span>✓</span><strong>{task.title}</strong><small>{task.updatedAt.slice(0, 10)}</small></div>)}</section>}
  </div>
}

const STORY_NODES = ['第一盞桌燈', '漂浮索引', '缺頁走廊', '失序閱覽廳', '溫室入口', '黃銅藤蔓', '星種甦醒', '星盤溫室', '觀測階梯', '碎裂透鏡', '無聲觀測塔', '遺忘風暴']

function JourneyView({ snapshot, onChanged, onError }: { snapshot: AppSnapshot; onChanged: (value: AppSnapshot) => void; onError: (value: string) => void }): React.JSX.Element {
  const choose = async (choice: RpgChoice): Promise<void> => {
    try { onChanged(await window.focusQuest.makeRpgChoice(choice)) } catch (reason) { onError(friendlyError(reason)) }
  }
  return <div className="journey-view">
    <ArchiveGame rpg={snapshot.rpg} />
    <img className="journey-traveler" src={travelerGraphicUrl} alt="提燈旅人" />
    <div className="journey-overlay">
      <div className="journey-title"><p className="eyebrow">第一章</p><h1>星光檔案館</h1><p>{snapshot.rpg.node < 4 ? '失序閱覽廳' : snapshot.rpg.node < 8 ? '星盤溫室' : '無聲觀測塔'}</p></div>
      <div className="resource-strip"><span><i>✦</i><b>{snapshot.rpg.light}</b> 燈火</span><span><i>◇</i><b>{snapshot.rpg.starPages}</b> 星頁</span><span><i>∴</i><b>{snapshot.rpg.materials}</b> 素材</span></div>
      <section className="repair-panel"><header><span>ROUTE NOTE / 01</span><p>用一點燈火決定接下來的修復方式</p></header><div>{[
        ['restore', '修復', '讓褪色的文字重新出現'], ['illuminate', '照明', '揭露下一段隱藏路線'], ['catalogue', '編目', '整理散落的記憶索引']
      ].map(([value, title, description], index) => <button key={value} disabled={snapshot.rpg.light < 1} className={snapshot.rpg.ability === value ? 'active' : ''} onClick={() => void choose(value as RpgChoice)}><i>0{index + 1}</i><strong>{title}</strong><span>{description}</span></button>)}</div></section>
    </div>
    <div className="story-map">{STORY_NODES.map((label, index) => <div key={label} className={index < snapshot.rpg.node ? 'complete' : index === snapshot.rpg.node ? 'current' : ''}><span>{index < snapshot.rpg.node ? '✦' : index + 1}</span><small>{label}</small></div>)}</div>
  </div>
}

function InsightsView({ snapshot }: { snapshot: AppSnapshot }): React.JSX.Element {
  const now = new Date()
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (13 - index))
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const sessions = snapshot.recentSessions.filter((session) => session.endedAt && new Date(session.endedAt).toLocaleDateString('en-CA') === key)
    return { key, label: `${date.getMonth() + 1}/${date.getDate()}`, minutes: Math.round(sessions.reduce((sum, session) => sum + sessionSeconds(session, new Date(session.endedAt!).getTime()), 0) / 60), starts: sessions.length }
  })
  const totalMinutes = days.reduce((sum, day) => sum + day.minutes, 0)
  const completed = snapshot.recentSessions.filter((session) => session.outcome === 'completed').length
  const maxMinutes = Math.max(1, ...days.map((day) => day.minutes))
  return <div className="view-content insights-view"><header className="page-heading"><div><p className="eyebrow">進展觀測</p><h1>只看行動，不評價你這個人。</h1><p>這些數字用來幫你調整下一步，不用來製造罪惡感。</p></div><span className="ledger-seal">14<br /><small>DAYS</small></span></header>
    <section className="progress-ledger"><div className="ledger-index"><span>OBSERVATION LOG</span><b>01—04</b></div><div className="stat-grid"><div className="stat-card"><span>近 14 天專注</span><strong>{totalMinutes}</strong><small>分鐘</small></div><div className="stat-card"><span>啟程次數</span><strong>{snapshot.recentSessions.length}</strong><small>次</small></div><div className="stat-card"><span>完成今日目標</span><strong>{completed}</strong><small>次</small></div><div className="stat-card"><span>被攔下的分心</span><strong>{snapshot.recentSessions.reduce((sum, session) => sum + session.blockedAttempts, 0)}</strong><small>次</small></div></div></section>
    <section className="panel chart-panel"><div className="chart-annotation">FOCUS TRACE / LOCAL ONLY</div><div className="section-title"><h2>十四天專注時間</h2><span>本機紀錄</span></div><div className="bar-chart">{days.map((day) => <div key={day.key} title={`${day.label} · ${day.minutes} 分鐘`}><span style={{ height: `${Math.max(3, (day.minutes / maxMinutes) * 100)}%` }} /><small>{day.label}</small></div>)}</div></section>
  </div>
}

function SettingsView({ snapshot, onChanged, onError, onNotice }: {
  snapshot: AppSnapshot; onChanged: (value: AppSnapshot) => void; onError: (value: string) => void; onNotice: (value: string) => void
}): React.JSX.Element {
  const update = async (patch: Partial<AppSettings>): Promise<void> => {
    try { onChanged(await window.focusQuest.updateSettings(patch)) } catch (reason) { onError(friendlyError(reason)) }
  }
  const action = async (type: 'backup' | 'restore' | 'analytics'): Promise<void> => {
    try {
      if (type === 'restore' && !window.confirm('還原備份會取代目前的所有任務與進度。確定繼續嗎？')) return
      const result = type === 'backup' ? await window.focusQuest.exportBackup() : type === 'restore' ? await window.focusQuest.importBackup() : await window.focusQuest.exportAnalytics()
      if (!result.canceled) {
        onNotice(type === 'backup' ? '備份已安全匯出。' : type === 'restore' ? '備份已還原。' : '匿名使用紀錄已匯出。')
        if (type === 'restore') onChanged(await window.focusQuest.getSnapshot())
      }
    } catch (reason) { onError(friendlyError(reason)) }
  }
  const reminderLabels: Record<ReminderPolicy, string> = { off: '安靜', gentle: '溫和', structured: '有節奏' }
  const coatLabels: Record<AppSettings['coatColor'], string> = { navy: '午夜藍', ink: '墨綠', violet: '暗紫' }
  const lanternLabels: Record<AppSettings['lanternColor'], string> = { amber: '琥珀', cyan: '星青', cream: '紙白' }
  return <div className="view-content settings-view visual-settings"><header className="page-heading compact-heading"><div><p className="eyebrow">設定</p><h1>工具</h1></div><div className="settings-compass" aria-hidden="true"><i /><span>✦</span></div></header>
    <div className="settings-atlas">
      <section className="setting-entry reminder-entry">
        <div className="setting-symbol"><SettingGlyph name="bell" /></div>
        <div className="setting-name"><h2>提醒</h2></div>
        <div className="reminder-picks">{(['off', 'gentle', 'structured'] as ReminderPolicy[]).map((mode) => <button key={mode} aria-pressed={snapshot.settings.reminderPolicy === mode} aria-label={`提醒：${reminderLabels[mode]}`} title={reminderLabels[mode]} className={snapshot.settings.reminderPolicy === mode ? 'active' : ''} onClick={() => void update({ reminderPolicy: mode })}><ReminderGlyph mode={mode} /><span>{reminderLabels[mode]}</span></button>)}</div>
        {snapshot.settings.reminderPolicy === 'structured' && <label className="evening-mark" title="晚間整理時間"><span aria-hidden="true">◷</span><input aria-label="晚間整理時間" type="time" value={snapshot.settings.eveningReminder} onChange={(event) => void update({ eveningReminder: event.target.value })} /></label>}
      </section>

      <section className="setting-entry binary-entry">
        <div className="setting-symbol"><SettingGlyph name="phone" /></div>
        <div className="setting-name"><h2>手機離手</h2><small>開始前</small></div>
        <label className="ink-check" title="開始專注前確認手機已放遠"><input aria-label="手機放遠儀式" type="checkbox" checked={snapshot.settings.phoneRitual} onChange={(event) => void update({ phoneRitual: event.target.checked })} /><span><i>✓</i></span></label>
      </section>

      <section className="setting-entry binary-entry">
        <div className="setting-symbol"><SettingGlyph name="timer" /></div>
        <div className="setting-name"><h2>角落計時</h2><small>收起視窗後</small></div>
        <label className="ink-check" title="在桌面角落顯示迷你計時器"><input aria-label="桌面迷你計時器" type="checkbox" checked={snapshot.settings.miniTimer} onChange={(event) => void update({ miniTimer: event.target.checked })} /><span><i>✓</i></span></label>
      </section>

      <section className="setting-entry appearance-entry">
        <div className="setting-symbol"><SettingGlyph name="traveler" /></div>
        <div className="setting-name"><h2>旅人</h2></div>
        <div className={`traveler-swatch-preview coat-${snapshot.settings.coatColor} light-${snapshot.settings.lanternColor}`} aria-hidden="true"><img src={travelerGraphicUrl} alt="" /><i /></div>
        <div className="swatch-groups">
          <div role="group" aria-label="外套色"><span className="swatch-kind" aria-hidden="true">⌁</span>{(['navy', 'ink', 'violet'] as AppSettings['coatColor'][]).map((color) => <button key={color} aria-pressed={snapshot.settings.coatColor === color} aria-label={`外套：${coatLabels[color]}`} title={coatLabels[color]} className={`color-swatch coat-${color}${snapshot.settings.coatColor === color ? ' active' : ''}`} onClick={() => void update({ coatColor: color })} />)}</div>
          <div role="group" aria-label="星燈色"><span className="swatch-kind" aria-hidden="true">✦</span>{(['amber', 'cyan', 'cream'] as AppSettings['lanternColor'][]).map((color) => <button key={color} aria-pressed={snapshot.settings.lanternColor === color} aria-label={`星燈：${lanternLabels[color]}`} title={lanternLabels[color]} className={`color-swatch light-${color}${snapshot.settings.lanternColor === color ? ' active' : ''}`} onClick={() => void update({ lanternColor: color })} />)}</div>
        </div>
      </section>

      <section className="setting-entry data-entry">
        <div className="setting-name"><h2>只在這台電腦</h2><span aria-hidden="true">⌁</span></div>
        <div className="data-seals"><button aria-label="匯出完整備份" title="匯出完整備份" onClick={() => void action('backup')}><SettingGlyph name="backup" /><span>備份</span></button><button aria-label="還原備份" title="還原備份" onClick={() => void action('restore')}><SettingGlyph name="restore" /><span>還原</span></button><button aria-label="匯出匿名紀錄" title="匯出匿名紀錄" onClick={() => void action('analytics')}><SettingGlyph name="record" /><span>紀錄</span></button></div>
      </section>
    </div>
  </div>
}

export function App(): React.JSX.Element {
  const [snapshot, setSnapshot, loadError, setError] = useSnapshot()
  const [view, setView] = useState<View>(initialView)
  const [viewTransition, setViewTransition] = useState<'idle' | 'cover' | 'reveal'>('idle')
  const transitionTimers = useRef<number[]>([])
  const [wizard, setWizard] = useState(() => window.location.hash === '#/qa/wizard')
  const [focusTask, setFocusTask] = useState<QuestTask | null>(null)
  const [reward, setReward] = useState<FocusResult | null>(() => window.location.hash === '#/qa/reward' ? {
    session: { id: 'qa', taskId: 'qa-task', stepId: 'qa-step', taskTitle: '完成手繪介面', stepText: '建立第一套動態 UI 語言', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), minimumMinutes: 10, pausedSeconds: 0, outcome: 'completed', blockedAttempts: 1, earnedLight: 2 },
    earnedLight: 2,
    earnedStarPage: true,
    earnedMaterial: false,
    loot: '沾著石墨的黃銅書籤',
    storyAdvanced: true
  } : null)
  const [notice, setNotice] = useState('')
  const previousLayerCount = useRef(0)
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 3200); return () => window.clearTimeout(timer) }, [notice])
  useEffect(() => () => transitionTimers.current.forEach((timer) => window.clearTimeout(timer)), [])
  useEffect(() => {
    const onPointerOver = (event: PointerEvent): void => {
      const target = (event.target as HTMLElement).closest('button, [role="button"]')
      if (!target || (event.relatedTarget instanceof Node && target.contains(event.relatedTarget))) return
      emitUiCue('paper-hover')
    }
    const onPointerDown = (event: PointerEvent): void => {
      if ((event.target as HTMLElement).closest('button, [role="button"]')) emitUiCue('ink-select')
    }
    document.addEventListener('pointerover', onPointerOver)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('pointerover', onPointerOver)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])
  useEffect(() => {
    const count = Number(wizard) + Number(Boolean(focusTask)) + Number(Boolean(reward))
    if (reward) emitUiCue('reward-accent')
    else if (count > previousLayerCount.current) emitUiCue('paper-open')
    else if (count < previousLayerCount.current) emitUiCue('paper-close')
    previousLayerCount.current = count
  }, [wizard, focusTask, reward])

  if (!snapshot) return <div className="loading-screen"><div className="loading-sketch"><LanternMark /><svg viewBox="0 0 180 36" aria-hidden="true"><path d="M4 25c21-9 37 5 58-3 21-8 35-2 54-8 20-7 37-5 60 2" /></svg></div><p>{loadError ?? '正在描出星光檔案館…'}</p></div>
  if (snapshot.activeSession) return <FocusActive snapshot={snapshot} onEnded={(result) => { setReward(result); void window.focusQuest.getSnapshot().then(setSnapshot) }} />

  const move = async (id: string, role: TaskRole): Promise<void> => {
    try { setSnapshot(await window.focusQuest.setTaskRole(id, role)) } catch (reason) { setError(friendlyError(reason)) }
  }
  const archive = async (id: string): Promise<void> => {
    if (!window.confirm('要把這個任務封存嗎？它不會被刪除。')) return
    try { setSnapshot(await window.focusQuest.archiveTask(id)) } catch (reason) { setError(friendlyError(reason)) }
  }
  const remove = async (task: QuestTask): Promise<void> => {
    const confirmed = window.confirm(`確定要永久刪除「${task.title}」嗎？\n\n任務與相關專注紀錄會一併移除，而且無法復原。`)
    if (!confirmed) return
    try {
      setSnapshot(await window.focusQuest.deleteTask(task.id))
      setNotice('任務已永久刪除。')
    } catch (reason) {
      setError(friendlyError(reason))
    }
  }

  const navigate = (next: View): void => {
    if (next === view && viewTransition === 'idle') return
    transitionTimers.current.forEach((timer) => window.clearTimeout(timer))
    transitionTimers.current = []
    setViewTransition('cover')
    transitionTimers.current.push(window.setTimeout(() => {
      setView(next)
      setViewTransition('reveal')
    }, 220))
    transitionTimers.current.push(window.setTimeout(() => setViewTransition('idle'), 500))
  }

  const parkMain = async (id: string): Promise<void> => {
    try {
      setSnapshot(await window.focusQuest.setTaskRole(id, 'backlog'))
      setNotice('任務已暫放；內容與紀錄都保留在任務庫。')
      navigate('library')
    } catch (reason) {
      setError(friendlyError(reason))
    }
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><LanternMark /><div><strong>Focus Quest</strong><small>星光檔案館</small></div></div>
      <nav>{[
        ['today', '今日冒險'], ['library', '任務庫'], ['journey', '檔案館'], ['insights', '進展觀測'], ['settings', '設定']
      ].map(([value, label], index) => <button key={value} aria-label={label} title={label} style={{ '--nav-order': index } as React.CSSProperties} className={view === value ? 'active' : ''} onClick={() => navigate(value as View)}><span><UiIcon name={value as UiIconName} /></span><b>{label}</b></button>)}</nav>
      <div className="sidebar-progress" aria-label={`第一章，已前進 ${snapshot.rpg.node} 個節點`}><span>章一</span><div className="chapter-marks">{Array.from({ length: 12 }, (_, index) => <i key={index} className={index < snapshot.rpg.node ? 'done' : index === snapshot.rpg.node ? 'current' : ''} />)}</div><small>{snapshot.rpg.node < 4 ? '失序閱覽廳' : snapshot.rpg.node < 8 ? '星盤溫室' : '無聲觀測塔'}</small></div>
    </aside>
    <main className="main-stage">
      <div className="view-transition" key={view}>
        {view === 'today' && <TodayView snapshot={snapshot} onCreate={() => setWizard(true)} onStart={setFocusTask} onMove={(id, role) => void move(id, role)} onParkMain={(id) => void parkMain(id)} onArchive={(id) => void archive(id)} onDelete={(task) => void remove(task)} />}
        {view === 'library' && <LibraryView snapshot={snapshot} onCreate={() => setWizard(true)} onMove={(id, role) => void move(id, role)} onArchive={(id) => void archive(id)} onDelete={(task) => void remove(task)} />}
        {view === 'journey' && <JourneyView snapshot={snapshot} onChanged={setSnapshot} onError={setError} />}
        {view === 'insights' && <InsightsView snapshot={snapshot} />}
        {view === 'settings' && <SettingsView snapshot={snapshot} onChanged={setSnapshot} onError={setError} onNotice={setNotice} />}
      </div>
      <div className={`ink-wipe ${viewTransition}`} aria-hidden="true"><span /><span /><span /></div>
    </main>
    {wizard && <TaskWizard snapshot={snapshot} onClose={() => setWizard(false)} onSaved={setSnapshot} />}
    {focusTask && <FocusSetup task={focusTask} snapshot={snapshot} onClose={() => setFocusTask(null)} onStarted={setSnapshot} />}
    {reward && <RewardModal result={reward} onClose={() => setReward(null)} />}
    {(loadError || notice) && <div className={loadError ? 'toast error' : 'toast'}>{loadError ?? notice}<button onClick={() => { setError(null); setNotice('') }}>×</button></div>}
  </div>
}

export function BlockerView(): React.JSX.Element {
  const [state, setState] = useState<OverlayState>({ processName: '', displayName: '這個程式', taskTitle: '', stepText: '' })
  const [progress, setProgress] = useState(0)
  const [unlocked, setUnlocked] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(() => {
    emitUiCue('warning-brush')
    return window.focusQuest.onOverlayState((next) => { setState(next); setProgress(0); setUnlocked(false) })
  }, [])
  const startHold = (): void => {
    if (unlocked) return
    const started = Date.now()
    timer.current = window.setInterval(() => {
      const next = Math.min(100, ((Date.now() - started) / 5000) * 100)
      setProgress(next)
      if (next >= 100) { if (timer.current) window.clearInterval(timer.current); setUnlocked(true) }
    }, 50)
  }
  const cancelHold = (): void => { if (timer.current) window.clearInterval(timer.current); timer.current = null; if (!unlocked) setProgress(0) }
  return <main className="blocker-screen">
    <div className="blocker-orbit" aria-hidden="true" />
    <div className="blocker-mark" aria-hidden="true"><span>INTERRUPTION</span><b>!</b><i>RETURN TO THE LINE</i></div>
    <section className="blocker-card">
      <div className="blocker-star">✦</div><p className="eyebrow">你原本正在前往</p><h1>{state.stepText || state.taskTitle || '今天的下一步'}</h1><p><strong>{state.displayName}</strong> 被你放進了這次的干擾清單。現在不用責怪自己，只要做一次新的選擇。</p>
      <button className="primary-button wide" onClick={() => void window.focusQuest.overlayReturn()}>回到任務</button>
      {!unlocked ? <button className="hold-button" onPointerDown={startHold} onPointerUp={cancelHold} onPointerLeave={cancelHold}><span style={{ width: `${progress}%` }} /><b>按住 5 秒緊急使用</b></button> : <div className="emergency-options"><p>你可以暫時開放，不會受到遊戲處罰。</p><button onClick={() => void window.focusQuest.overlayEmergency('ten_minutes')}>開放 {state.displayName} 10 分鐘</button><button onClick={() => void window.focusQuest.overlayEmergency('end_session')}>結束本次專注</button></div>}
    </section>
  </main>
}

export function MiniTimerView(): React.JSX.Element {
  const [snapshot] = useSnapshot()
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [])
  if (!snapshot?.activeSession) return <div className="mini-timer"><span className="mini-lantern">✦</span><p>等待下一次啟程</p></div>
  const seconds = sessionSeconds(snapshot.activeSession, now)
  const remaining = snapshot.activeSession.minimumMinutes * 60 - seconds
  return <button className="mini-timer active" onClick={() => void window.focusQuest.overlayReturn()}><span className="mini-lantern">✦</span><div><strong>{formatClock(remaining > 0 ? remaining : seconds)}</strong><small>{remaining > 0 ? '距離最低承諾' : '正在自由專注'}</small></div><i aria-hidden="true" /></button>
}
