import { useRecapPrewarm } from './useRecapPrewarm'
import { BeforeFocusPlayback } from './BeforeFocusPlayback'
import { TravelLoading } from './loading/TravelLoading'
import { FOREST_MAP_ID } from '../../shared/specialFinds'
import { litLampCount } from '../../shared/lampTiming'
import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { canRetainFocus, isReviewReturn } from './focusExitTransition'
import './focusExitTransition.css'
import { ExpeditionLobby } from './ExpeditionLobby'
import { AfterPreview, LobbyPreview, afterPreviewFromHash, lobbyPreviewFromHash } from './lobby/LobbyPreview'
import { AreaFocusScene } from './AreaFocusScene'
import { CollectionRoom } from './CollectionRoom'
import { ConnectedLobby, ConnectedAfterFocus } from './lobby/ConnectedLobby'
import { AllTasksPanel, LogPanel, SettingsPanel } from './AppShellPanels'
import { lobbyFromSnapshot } from './lobby/fromSnapshot'
import travelerGraphicUrl from './assets/lantern-traveler-silhouette.svg'
import { suggestStartingActions } from '../../shared/decomposition'
import { fullThresholdSeconds } from '../../shared/expedition'
import { focusElapsedMs, focusElapsedSeconds } from '../../shared/focusTime'
import { area01Departure } from '../../shared/area01'
import { WORLD_STAGES, worldStageIndex } from '../../shared/world'
import type {
  AppSettings,
  AppSnapshot,
  CreateTaskInput,
  ExpeditionNode,
  FocusOutcome,
  FocusResult,
  FocusSession,
  Obstacle,
  OverlayState,
  QuestTask,
  ReminderPolicy,
  RunningApplication,
  TaskKind,
  TaskRole
} from '../../shared/types'

type View = 'today' | 'collection' | 'log' | 'settings'

function initialView(): View {
  const candidate = new URLSearchParams(window.location.search).get('view') ?? window.location.hash.replace(/^#\/?/, '').replace(/^qa\//, '')
  if (candidate.startsWith('collection-') || candidate === 'journey') return 'collection'
  if (candidate === 'insights') return 'log'
  if (candidate === 'library') return 'today'
  return (['today', 'collection', 'log', 'settings'] as View[]).includes(candidate as View) ? candidate as View : 'today'
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

function formatFocusDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return hours > 0 ? `${hours} 小時 ${minutes} 分鐘` : `${Math.max(1, minutes)} 分鐘`
}

const QA_DEPARTURE_STARTED_AT = new Date().toISOString()

function qaDepartureFromHash(): 'exit_high' | 'exit_pines' | null {
  const match = window.location.hash.match(/^#\/?qa\/cloud-departure-(high|pines)$/)
  return match ? (match[1] === 'high' ? 'exit_high' : 'exit_pines') : null
}

function qaDepartureSnapshot(snapshot: AppSnapshot, exit: 'exit_high' | 'exit_pines'): AppSnapshot {
  return {
    ...snapshot,
    activeSession: {
      id: `qa-departure-${exit}`, taskId: snapshot.tasks[0]?.id ?? 'qa-task', stepId: 'qa-step',
      taskTitle: '雲上遺庭 · 離開演出', stepText: 'QA：新路線的第一次專注',
      startedAt: QA_DEPARTURE_STARTED_AT, endedAt: null, minimumMinutes: 10, pausedSeconds: 0, suspendedAt: null, manuallyPaused: false, outcome: null,
      blockedAttempts: 0, earnedLight: 0, runId: null, nodeId: null, plannedMinutes: null,
      departure: area01Departure('qa-previous-route', exit)
    }
  }
}

function stableSeed(text: string): number {
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  return hash >>> 0
}

function sessionSeconds(session: FocusSession, now: number): number {
  // A resume snapshot can arrive between timer ticks (or immediately after system wake).
  // Do not subtract the newly settled pause from a stale pre-resume timestamp: that would
  // briefly rewind progress and make the scene's setProgress() reset the traveller.
  return focusElapsedSeconds(session, Math.max(now, Date.now()))
}

function useSnapshot(animateExit = false): [AppSnapshot | null, (next: AppSnapshot) => void, string | null, (message: string | null) => void] {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const latest = useRef<AppSnapshot | null>(null)
  const delivering = useRef(false)
  const receive = useCallback((next: AppSnapshot): void => {
    const previous = latest.current
    latest.current = next
    // IPC broadcasts and the action response deliver the same save. Coalesce
    // them while Chromium captures the old screen, otherwise it captures too late.
    if (delivering.current) return
    if (!animateExit || !isReviewReturn(previous, next) || !document.startViewTransition || document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSnapshot(next)
      return
    }
    delivering.current = true
    document.documentElement.classList.add('focus-exit-transition')
    const release = (): void => { delivering.current = false; setSnapshot(latest.current) }
    try {
      const transition = document.startViewTransition(() => {
        flushSync(() => setSnapshot(latest.current))
      })
      // Failure/skipping must never strand the UI on an already-dismissed review.
      void transition.updateCallbackDone.then(release, release)
      void transition.ready.catch(() => undefined)
      void transition.finished.catch(() => undefined).finally(() => document.documentElement.classList.remove('focus-exit-transition'))
    } catch {
      release()
      document.documentElement.classList.remove('focus-exit-transition')
    }
  }, [animateExit])
  useEffect(() => {
    void window.focusQuest.getSnapshot().then(receive).catch((reason) => setError(friendlyError(reason)))
    return window.focusQuest.onSnapshotChanged(receive)
  }, [receive])
  return [snapshot, receive, error, setError]
}

type UiIconName = 'today' | 'collection' | 'log' | 'settings'

function UiIcon({ name }: { name: UiIconName }): React.JSX.Element {
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
    {name === 'today' && <path d="M12.2 3.2c.8 3.7 2.2 6.1 6.2 7.4-3.8 1-5.8 3.4-6.4 7.8-.8-4.1-2.6-6.5-6.5-7.6 3.8-1.4 5.5-3.5 6.7-7.6Z" />}
    {name === 'collection' && <><path d="M12 3.2c4.8 2.2 7.4 5.1 8 8.7-1.4 3.9-4 6.8-8.1 8.8-4.1-2.1-6.8-5-7.9-8.8.9-3.8 3.4-6.6 8-8.7Z" /><path d="m14.8 8.4-1.4 5.1-4.2 2 1.5-5.1 4.1-2Z" /></>}
    {name === 'log' && <><path d="M4 18.8c2.5-1 3.4-5 5.4-4.7 2.1.3 2.3 2.5 4.2 1.4 2.2-1.2 2.5-5.9 6.4-8" /><path d="M4.2 5v14.1h15.5" /></>}
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

function FocusSetup({ task, node, snapshot, onClose, onStarted }: {
  task: QuestTask
  node?: ExpeditionNode
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
      const next = await window.focusQuest.startFocus({
        taskId: task.id,
        stepId: step.id,
        minimumMinutes: minimum,
        blockedProcessNames: [...selected],
        ...(node && snapshot.todayRun
          ? { runId: snapshot.todayRun.id, nodeId: node.id, plannedMinutes: node.plannedMinutes }
          : {})
      })
      onStarted(next)
      onClose()
    } catch (reason) {
      setError(friendlyError(reason))
    } finally {
      setStarting(false)
    }
  }

  return <div className="modal-backdrop"><section className="modal focus-setup calm-departure">
    <div className="modal-header"><div><p className="eyebrow">準備探索</p><h2>{task.title}</h2></div><button className="icon-button" onClick={onClose}>×</button></div>
    <div className="calm-focus-intention"><span aria-hidden="true">↳</span><p>{task.progressDefinition}</p></div>
    {task.starterAction && <div className="starter-prompt compact-starter"><span>不知道怎麼開頭時</span><strong>{task.starterAction}</strong></div>}
    {node && <p className="world-follows-note"><i aria-hidden="true">⌁</i> 本次路線：{node.title} · {node.plannedMinutes} 分鐘</p>}
    <div className="field commitment-field"><span>最低專注時間</span><div className="option-grid three">{([5, 10, 15] as const).map((value) => <button key={value} className={minimum === value ? 'option active' : 'option'} onClick={() => setMinimum(value)}><strong>{value}</strong><small>分鐘</small></button>)}</div></div>
    {snapshot.settings.phoneRitual && <label className="phone-ritual calm-phone"><input type="checkbox" checked={phoneParked} onChange={(event) => setPhoneParked(event.target.checked)} /><span><strong>手機已放到伸手拿不到的位置</strong></span></label>}
    <details className="blocker-details">
      <summary><span aria-hidden="true">⌁</span>需要擋住哪些程式？<small>{selected.size ? `已選 ${selected.size} 個` : '選填'}</small></summary>
      <div>{loadingApps ? <p className="muted">正在讀取目前執行的程式…</p> : apps.length ? <div className="app-picker">{apps.map((app) => <label key={app.processName}><input type="checkbox" checked={selected.has(app.processName)} onChange={() => toggleApp(app.processName)} /><span>{app.displayName}</span></label>)}</div> : <p className="muted">目前沒有其他可選的桌面程式。</p>}</div>
    </details>
    {error && <p className="form-error">{error}</p>}
    <div className="modal-footer"><button className="text-button quiet" onClick={onClose}>返回</button><button className="primary-button begin-focus-button" disabled={!phoneParked || starting} onClick={() => void start()}>{starting ? '正在進入路線…' : '▶ 開始探索'}</button></div>
  </section></div>
}

const IMMERSIVE_IDLE_MS = 20000

function FocusActive({ snapshot, onEnded, onDebriefStarted, onSnapshot, onSceneReady, skipCampfire = false, reviewing = false, audioActive = true }: {
  snapshot: AppSnapshot
  reviewing?: boolean
  audioActive?: boolean
  onEnded: (result: FocusResult) => void
  onDebriefStarted: (snapshot: AppSnapshot) => void
  onSnapshot: (snapshot: AppSnapshot) => void
  onSceneReady?: () => void
  skipCampfire?: boolean
}): React.JSX.Element {
  const session = snapshot.activeSession!
  const activeTask = snapshot.tasks.find((task) => task.id === session.taskId)
  const expeditionNode = session.nodeId ? snapshot.expeditionNodes.find((node) => node.id === session.nodeId) : undefined
  const [now, setNow] = useState(Date.now())
  const [choosing, setChoosing] = useState(false)
  const [selectedOutcome, setSelectedOutcome] = useState<FocusOutcome | null>(null)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState('')
  const [activity, setActivity] = useState('旅人在雲上遺庭')
  const [cinematic, setCinematic] = useState(false)
  const [cinematicControls, setCinematicControls] = useState(false)
  const [preSceneReady,setPreSceneReady] = useState(false)
  const [focusSettingsOpen, setFocusSettingsOpen] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState('')
  const focusSettingsPanel = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!focusSettingsOpen) return
    const previous = document.activeElement as HTMLElement | null
    focusSettingsPanel.current?.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [focusSettingsOpen])
  // Pause is saved by the back end (activeSession.suspendedAt). While the request is in flight the screen
  // shows the requested state at once; the saved snapshot replaces it, and a failure reverts to the save.
  const [pauseRequest, setPauseRequest] = useState<'pause' | 'resume' | null>(null)
  const [optimisticPaused, setOptimisticPaused] = useState<boolean | null>(null)
  const heldElapsed = useRef<number | null>(null)
  const [immersed, setImmersed] = useState(false)
  useEffect(() => {
    if (reviewing) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [reviewing])
  const savedPaused = !session.beforeFocus && session.suspendedAt !== null
  const paused = optimisticPaused ?? savedPaused
  const liveElapsed = sessionSeconds(session, now)
  // Hold the clock at the pressed second until the saved pause (which fixes the time) arrives.
  const lastElapsed = useRef(liveElapsed)
  if (!reviewing) lastElapsed.current = optimisticPaused === true && !savedPaused && heldElapsed.current !== null ? heldElapsed.current : liveElapsed
  const elapsed = lastElapsed.current
  const busy = ending || pauseRequest !== null
  const hideCinematicControls = cinematic && !cinematicControls && !paused && !busy && !error && !focusSettingsOpen
  useEffect(() => {
    setCinematicControls(false)
    if (!cinematic) return
    const wake = (): void => setCinematicControls(true)
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'focusin'] as const
    events.forEach(name => window.addEventListener(name, wake, { passive: true }))
    // A quiet opening must not leave the player without any indication of progress indefinitely.
    const timer = window.setTimeout(wake, IMMERSIVE_IDLE_MS)
    return () => { window.clearTimeout(timer); events.forEach(name => window.removeEventListener(name, wake)) }
  }, [cinematic])
  // The departure (from the previous route's exit) plays at the start of this Focus. The scene reads how far
  // into the Focus we are when it mounts, so a reopen after the 5 seconds goes straight to the new route.
  const departureElapsedMs = session.beforeFocusCompleted ? 30000 : session.beforeFocus ? Math.max(0,now-Date.parse(session.beforeFocus.startedAt)) : focusElapsedMs(session)
  const minimum = session.minimumMinutes * 60
  const reached = elapsed >= minimum
  const commitmentProgress = Math.min(1, elapsed / Math.max(1, minimum))
  const worldProgressSeconds = (expeditionNode?.progressSeconds ?? 0) + elapsed
  const worldTargetSeconds = expeditionNode ? fullThresholdSeconds(expeditionNode.plannedMinutes) : minimum
  const worldComplete = worldProgressSeconds >= worldTargetSeconds
  // Five lamps at equal fifths of the planned time; the fifth is due at 100%.
  const litLamps = litLampCount(worldProgressSeconds, worldTargetSeconds)
  const end = async (outcome: FocusOutcome, completeTask: boolean): Promise<void> => {
    setEnding(true)
    try { onEnded(await window.focusQuest.endFocus({ sessionId: session.id, outcome, completeTask })) }
    catch (reason) { setError(friendlyError(reason)); setEnding(false) }
  }
  // Ending a Focus goes straight to Debrief. The traveller's walk out of the Area now plays at the
  // start of the next Focus, driven by FocusSession.departure, so nothing here waits for an animation.
  const togglePause = async (): Promise<void> => {
    if (busy) return
    const wantPaused = !paused
    heldElapsed.current = wantPaused ? elapsed : null
    setError('')
    setOptimisticPaused(wantPaused)
    setPauseRequest(wantPaused ? 'pause' : 'resume')
    try {
      onSnapshot(await (wantPaused ? window.focusQuest.pauseFocus(session.id) : window.focusQuest.resumeFocus(session.id)))
    } catch (reason) {
      setError(`${wantPaused ? '暫停' : '繼續'}沒有成功：${friendlyError(reason)}`)
      // Re-read the save so the screen matches what the back end actually holds.
      try { onSnapshot(await window.focusQuest.getSnapshot()) } catch { /* keep the last saved snapshot */ }
    } finally {
      setOptimisticPaused(null)
      setPauseRequest(null)
      heldElapsed.current = null
    }
  }
  // Immersive mode: after 20 s without mouse or keyboard input the text and its glass fade to about 40%.
  // It only changes opacity. It never pauses the Focus, and it stays off while paused or while a panel,
  // error or save is showing.
  useEffect(() => {
    if (reviewing || paused || choosing || busy || error || focusSettingsOpen) { setImmersed(false); return }
    let timer = 0
    const wake = (): void => {
      setImmersed(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setImmersed(true), IMMERSIVE_IDLE_MS)
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'focusin'] as const
    wake()
    events.forEach((name) => window.addEventListener(name, wake, { passive: true }))
    return () => {
      window.clearTimeout(timer)
      events.forEach((name) => window.removeEventListener(name, wake))
    }
  }, [reviewing, paused, choosing, busy, error, focusSettingsOpen])
  const openDebrief = async (): Promise<void> => {
    if (busy) return
    setEnding(true)
    try { onDebriefStarted(await window.focusQuest.beginSessionDebrief(session.id)) }
    catch (reason) { setError(friendlyError(reason)); setEnding(false) }
  }
  return <main inert={reviewing} aria-hidden={reviewing || undefined} className={`focus-active focus-adventure${paused ? ' is-paused' : ''}${immersed ? ' is-immersed' : ''}${hideCinematicControls ? ' is-cinematic' : ''}${reviewing ? ' is-review-backdrop' : ''}${focusSettingsOpen ? ' focus-settings-open' : ''}`}>
    <header inert={focusSettingsOpen} className="focus-adventure-header" data-glass="top">
      <div className="focus-adventure-task" data-glass-zone>
        <p><i className={reached ? 'reached' : ''} />現在專注</p>
        <h1>{session.taskTitle}</h1>
        <span>{activeTask?.progressDefinition ?? session.stepText}</span>
      </div>
      <div className="focus-adventure-clock" data-glass-zone>
        <time className={`${reached ? 'reached' : ''}${paused ? ' paused' : ''}`}>{formatClock(elapsed)}</time>
        {paused
          ? <span className="focus-paused-note"><i aria-hidden="true" />已暫停 · 計時與世界停在這一刻</span>
          : <span>{reached ? '最低承諾已完成 · 可以自由繼續' : `還有 ${formatClock(minimum - elapsed)} 完成最低承諾`}</span>}
        <div className="focus-commitment-track" aria-label={`最低承諾進度 ${Math.round(commitmentProgress * 100)}%`}>
          <i style={{ width: `${commitmentProgress * 100}%` }} />
        </div>
      </div>
      <div className="focus-adventure-actions" data-glass-zone>
        <small>{expeditionNode ? `${expeditionNode.title} · ${expeditionNode.plannedMinutes} 分鐘路線` : `${session.minimumMinutes} 分鐘最低承諾`}</small>
        <div className="focus-action-row">
          <button
            type="button"
            className={`focus-pause-button${paused ? ' is-paused' : ''}`}
            data-glass-card
            disabled={busy}
            aria-label={paused ? '繼續專注' : '暫停專注'}
            onClick={() => void togglePause()}
          >
            <i className="focus-pause-glyph" aria-hidden="true" />
            <span>{pauseRequest ? '保存中…' : paused ? '繼續' : '暫停'}</span>
          </button>
          <button type="button" className="focus-end-button" data-glass-card disabled={busy} onClick={() => expeditionNode ? void openDebrief() : setChoosing(true)}>
            {ending ? '正在保存…' : '結束這次專注'}
          </button>
          <button type="button" className="focus-settings-button" data-glass-card aria-label="專注設定" title="設定" disabled={busy} onClick={() => { setSettingsNotice(''); setFocusSettingsOpen(true) }}><UiIcon name="settings" /></button>
        </div>
        <p className="sr-only" role="status">{paused ? '專注已暫停，計時與探索都停止了。' : ''}</p>
      </div>
    </header>

    <section inert={focusSettingsOpen} className="focus-world-shell">
      <AreaFocusScene
        audioActive={audioActive && !(session.beforeFocus&&preSceneReady&&departureElapsedMs>=15000)}
        onReady={()=>{setPreSceneReady(true);onSceneReady?.()}}
        skipCampfire={skipCampfire}
        snapshot={snapshot}
        session={session}
        node={expeditionNode}
        progressSeconds={worldProgressSeconds}
        targetSeconds={worldTargetSeconds}
        seed={(snapshot.todayRun?.seed ?? 0) + stableSeed(session.nodeId ?? session.id)}
        departureElapsedMs={departureElapsedMs}
        specialFinds={snapshot.specialFinds.filter((find) => find.sessionId === session.id)}
        onWorldMark={(mark) => { if (!reviewing) void window.focusQuest.recordWorldMark(session.id, mark).then(onSnapshot).catch((reason) => setError(friendlyError(reason))) }}
        onStoryRecord={(clueId) => { if (!reviewing) void window.focusQuest.recordCloudStoryClue(session.id, clueId).then(onSnapshot).catch((reason) => setError(friendlyError(reason))) }}
        onCinematicChange={setCinematic}
        paused={paused || reviewing}
        retainForLobby={reviewing}
        uiFade={reviewing || hideCinematicControls ? 0 : immersed ? 0.5 : 1}
        onActivityChange={setActivity}
      />
      <div className="focus-world-vignette" aria-hidden="true" />
      <footer className="focus-world-status" data-glass="bottom" data-glass-card>
        <div className="traveler-activity"><i aria-hidden="true">⌁</i><span><small>{paused ? '暫停中' : '旅人動向'}</small><strong>{paused ? '旅人停在原地，等你回來' : activity}</strong></span></div>
        <i className="focus-status-divider" aria-hidden="true" />
        <div className="lamp-progress" aria-label={`已點亮 ${litLamps} 盞，共 5 盞`}>
          <span>{litLamps} / 5 路燈</span>
          <div>{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < litLamps ? 'lit' : ''} />)}</div>
          <small>{worldComplete ? '這一段路已走完' : '旅人正沿著這段路前進'}</small>
        </div>
      </footer>

      {choosing && <div className="focus-outcome-backdrop">
        {!selectedOutcome
          ? <div className="outcome-panel quiet-outcome-panel focus-outcome-panel">
            <p>這段工作進行得怎麼樣？</p>
            <button disabled={ending} onClick={() => setSelectedOutcome('completed')}><strong>完成了這段目標</strong><span>不代表整件任務一定完成</span></button>
            <button disabled={ending} onClick={() => setSelectedOutcome('progress')}><strong>有推進，還沒完成</strong><span>保留時間與真實進度</span></button>
            <button disabled={ending} onClick={() => setSelectedOutcome('blocked')}><strong>仍然卡住</strong><span>不處罰，紀錄這段投入</span></button>
            <button className="text-button" onClick={() => setChoosing(false)}>回到探索</button>
          </div>
          : <div className="outcome-panel quiet-outcome-panel focus-outcome-panel">
            <p>整件任務已經全部完成了嗎？</p>
            <button disabled={ending} onClick={() => void end(selectedOutcome, true)}><strong>完成整個任務</strong><span>將任務與步驟標記完成</span></button>
            <button disabled={ending} onClick={() => void end(selectedOutcome, false)}><strong>還沒完成</strong><span>保留任務，之後繼續</span></button>
            <button className="text-button" onClick={() => setSelectedOutcome(null)}>返回上一題</button>
          </div>}
      </div>}
      {error && <p className="focus-adventure-error form-error">{error}</p>}
    </section>
    {session.beforeFocus&&<BeforeFocusPlayback snapshot={snapshot} onChanged={onSnapshot} ready={preSceneReady&&departureElapsedMs>=15000}/>}
    {focusSettingsOpen && <div className="shell-sheet-layer focus-settings-layer" onPointerDown={event => { if (event.target === event.currentTarget) setFocusSettingsOpen(false) }} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); setFocusSettingsOpen(false) }
      if (event.key === 'Tab') {
        const controls = focusSettingsPanel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')
        if (!controls?.length) return
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }}><section ref={focusSettingsPanel} className="shell-sheet focus-settings-sheet" role="dialog" aria-modal="true" aria-label="設定"><header className="shell-sheet-head"><div><small>旅途工具</small><h2>設定</h2></div><button aria-label="關閉設定" onClick={() => setFocusSettingsOpen(false)}>×</button></header><div className="shell-sheet-scroll"><SettingsPanel snapshot={snapshot} onChanged={onSnapshot} onError={setError} onNotice={setSettingsNotice} />{settingsNotice && <p role="status">{settingsNotice}</p>}</div></section></div>}
  </main>
}

function RewardModal({ result, snapshot, onClose }: { result: FocusResult; snapshot: AppSnapshot; onClose: () => void }): React.JSX.Element {
  const stage = WORLD_STAGES[worldStageIndex(result.totalFocusSeconds)]
  return <main className="session-debrief reward-sequence simple-reward">
    <div className="reward-room-wash" aria-hidden="true" />
    <div className="reward-ink-river" aria-hidden="true"><i /><i /><i /></div>
    <section className="world-reveal">
      <p className="reward-overline">FOCUS SAVED</p>
      <strong className="reward-duration">{formatFocusDuration(result.effectiveSeconds)}</strong>
      <div className="reward-world-line"><i /><span>✦</span><i /></div>
      <h1>{result.worldStageAdvanced ? stage.title : '專注已保存'}</h1>
      <p>{result.worldStageAdvanced ? stage.change : '這段時間已經留在旅程紀錄裡。'}</p>
      {result.loot && <div className="single-discovery"><span aria-hidden="true">◇</span><div><small>新發現</small><strong>{result.loot}</strong></div></div>}
      <p className="total-focus-record"><span>累積專注</span>{formatFocusDuration(result.totalFocusSeconds)}</p>
      <button className="primary-button" onClick={onClose}>回到旅程</button>
    </section>
  </main>
}

function TodayView({ snapshot, onCreate, onStartRun, onSelectNode, onContinueNode, onStartTask, onMove, onParkMain, onArchive, onDelete }: {
  snapshot: AppSnapshot
  onCreate: () => void
  onStartRun: (task: QuestTask) => void
  onSelectNode: (node: ExpeditionNode) => void
  onContinueNode: (task: QuestTask, node: ExpeditionNode) => void
  onStartTask: (task: QuestTask) => void
  onMove: (id: string, role: TaskRole) => void
  onParkMain: (id: string) => void
  onArchive: (id: string) => void
  onDelete: (task: QuestTask) => void
}): React.JSX.Element {
  const today = snapshot.tasks.filter((task) => task.role !== 'backlog' && task.status === 'active')
  const activeMain = today.find((task) => task.role === 'main')
  const runMain = snapshot.todayRun ? snapshot.tasks.find((task) => task.id === snapshot.todayRun?.mainTaskId && task.status === 'active') : undefined
  const main = runMain ?? activeMain
  const sides = today.filter((task) => task.role === 'side')
  const dateLabel = new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())

  const mainStatus = snapshot.activeSession ? '進行中' : snapshot.todayRun?.mainTaskId !== main?.id ? '可接續現有遠征' : snapshot.todayRun ? '等待開始' : '尚未開啟遠征'

  // The lobby: the Area and today's fork fill the view; the Main Quest and side quests live in its panel.
  return <div className="view-content today-view today-lobby-view">
    <ExpeditionLobby coreTaken={snapshot.mapCores.some((core) => core.mapId === FOREST_MAP_ID)}
      dateLabel={dateLabel}
      run={snapshot.todayRun}
      task={main}
      taskKindLabel={main ? KIND_LABELS[main.kind] : null}
      taskStatus={mainStatus}
      nodes={snapshot.expeditionNodes}
      relics={snapshot.runRelics}
      onStartRun={() => main && onStartRun(main)}
      onSelectNode={onSelectNode}
      onContinueNode={(node) => main && onContinueNode(main, node)}
      onCreateTask={onCreate}
      onParkMain={!snapshot.todayRun && main ? () => onParkMain(main.id) : null}
      onDeleteMain={!snapshot.todayRun && main ? () => onDelete(main) : null}
      sideCount={sides.length}
      sideQuests={<div className="task-grid lobby-side-grid">
        {sides.map((task) => <TaskCard key={task.id} task={task} onStart={onStartTask} onMove={onMove} onArchive={onArchive} onDelete={onDelete} />)}
        {sides.length < 2 && <button className="empty-slot compact" onClick={onCreate}><span>＋</span><strong>加支線</strong></button>}
      </div>}
    />
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
  const [snapshot, setSnapshot, loadError, setError] = useSnapshot(true)
  useEffect(() => { document.documentElement.dataset.coatColor = snapshot?.settings.coatColor ?? 'navy'; window.dispatchEvent(new Event('focusquest:coat-color')) }, [snapshot?.settings.coatColor])
  useRecapPrewarm(snapshot)
  // Keep only the current session's last presentation. This is never a saved
  // session or timer authority, and is released as soon as review is dismissed.
  const lastFocus = useRef<AppSnapshot | null>(null)
  if (snapshot?.activeSession) lastFocus.current = snapshot
  else if (!snapshot?.pendingDebrief) lastFocus.current = null
  const [view, setView] = useState<View>(initialView)
  const [scene, setScene] = useState<'today' | 'collection'>(() => initialView() === 'collection' ? 'collection' : 'today')
  const todayMounted = useRef(scene === 'today')
  if (scene === 'today') todayMounted.current = true
  const [collectionMounted, setCollectionMounted] = useState(scene === 'collection')
  const [collectionReady, setCollectionReady] = useState(false)
  const markCollectionReady = useCallback(() => setCollectionReady(true), [])
  useEffect(() => {
    if (!snapshot || snapshot.activeSession || collectionMounted) return
    const timer = window.setTimeout(() => setCollectionMounted(true), 1200)
    return () => window.clearTimeout(timer)
  }, [Boolean(snapshot), snapshot?.activeSession?.id, collectionMounted])
  const lastIdleSnapshot = useRef<AppSnapshot | null>(null)
  if (snapshot && !snapshot.activeSession && !snapshot.pendingDebrief) lastIdleSnapshot.current = snapshot
  const [readyFocusSession, setReadyFocusSession] = useState<string | null>(null)
  const [completedCampfireSession, setCompletedCampfireSession] = useState<string | null>(null)
  const [, tickDeparture] = useState(0)
  const activeNode = snapshot?.activeSession?.nodeId ? snapshot.expeditionNodes.find((entry) => entry.id === snapshot.activeSession?.nodeId) : null
  const rootCampfireFocus = Boolean(snapshot?.activeSession && lastIdleSnapshot.current && activeNode?.depth === 0 && !activeNode.parentNodeId && activeNode.progressSeconds === 0)
  const departureMs = snapshot?.activeSession ? snapshot.activeSession.beforeFocusCompleted ? 30000 : snapshot.activeSession.beforeFocus ? Math.max(0,Date.now()-Date.parse(snapshot.activeSession.beforeFocus.startedAt)) : focusElapsedMs(snapshot.activeSession) : 0
  const keepCampfire = rootCampfireFocus && departureMs < 30000 && (completedCampfireSession !== snapshot?.activeSession?.id || readyFocusSession !== snapshot?.activeSession?.id)
  useEffect(() => {
    if (!rootCampfireFocus || !keepCampfire) return
    const timer = window.setInterval(() => tickDeparture((value) => value + 1), 100)
    return () => window.clearInterval(timer)
  }, [rootCampfireFocus, keepCampfire])
  const [sheet, setSheet] = useState<null | 'all'>(() => ['library', 'all'].includes(new URLSearchParams(window.location.search).get('view') ?? window.location.hash.replace(/^#\/?/, '').replace(/^qa\//, '')) ? 'all' : null)
  const [seenCollectionSignature, setSeenCollectionSignature] = useState(() => window.localStorage.getItem('focusquest-collection-seen') ?? '')
  useEffect(() => {
    if (!snapshot || snapshot.activeSession || snapshot.pendingDebrief || !(sheet || view === 'log' || view === 'settings')) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setSheet(null); setView('today'); setScene('today')
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [snapshot?.activeSession, snapshot?.pendingDebrief, view, sheet])
  // Dev-only: the §47 lobby with sample data (#/qa/lobby-a-<scenario>) until the back end supplies it.
  const [lobbyPreview] = useState(() => import.meta.env.DEV ? lobbyPreviewFromHash(window.location.hash) : null)
  const [afterPreview] = useState(() => import.meta.env.DEV ? afterPreviewFromHash(window.location.hash) : null)
  const [viewTransition, setViewTransition] = useState<'idle' | 'cover' | 'reveal'>('idle')
  const transitionTimers = useRef<number[]>([])
  const [wizard, setWizard] = useState(() => window.location.hash === '#/qa/wizard')
  const [focusTarget, setFocusTarget] = useState<{ task: QuestTask; node?: ExpeditionNode } | null>(null)
  const [reward, setReward] = useState<FocusResult | null>(() => window.location.hash === '#/qa/reward' ? {
    session: { id: 'qa', taskId: 'qa-task', stepId: 'qa-step', taskTitle: '完成手繪介面', stepText: '建立第一套動態 UI 語言', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), minimumMinutes: 10, pausedSeconds: 0, suspendedAt: null, manuallyPaused: false, outcome: 'completed', blockedAttempts: 1, earnedLight: 2, runId: null, nodeId: null, plannedMinutes: null, departure: null },
    effectiveSeconds: 5022,
    totalFocusSeconds: 5400,
    worldStageAdvanced: true,
    earnedLight: 2,
    earnedStarPage: true,
    earnedMaterial: false,
    loot: '沾著石墨的黃銅書籤',
    storyAdvanced: true,
    expeditionResolution: null
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
    const count = Number(wizard) + Number(Boolean(focusTarget)) + Number(Boolean(reward))
    if (reward) emitUiCue('reward-accent')
    else if (count > previousLayerCount.current) emitUiCue('paper-open')
    else if (count < previousLayerCount.current) emitUiCue('paper-close')
    previousLayerCount.current = count
  }, [wizard, focusTarget, reward])

  if (!snapshot) return <div className="loading-screen">{!loadError && <TravelLoading />}<div className="loading-sketch"><LanternMark /><svg viewBox="0 0 180 36" aria-hidden="true"><path d="M4 25c21-9 37 5 58-3 21-8 35-2 54-8 20-7 37-5 60 2" /></svg></div><p>{loadError ?? '正在整理旅人的行李…'}</p></div>
  // Dev-only visual QA: the real Focus screen with a fresh departure cue, so a capture can start at 0 s.
  const qaDepartureExit = import.meta.env.DEV ? qaDepartureFromHash() : null
  if (qaDepartureExit) return <FocusActive snapshot={qaDepartureSnapshot(snapshot, qaDepartureExit)} onEnded={() => undefined} onDebriefStarted={() => undefined} onSnapshot={() => undefined} />
  // Dev-only: the §47 after-Focus screens with sample data (#/qa/after-<scenario>).
  if (afterPreview) return <AfterPreview scenario={afterPreview} />
  const reviewBackdrop = canRetainFocus(lastFocus.current, snapshot)
  if ((snapshot.activeSession && !rootCampfireFocus) || reviewBackdrop) return <><FocusActive
    snapshot={snapshot.activeSession ? snapshot : lastFocus.current!}
    reviewing={reviewBackdrop}
    onEnded={(result) => { setReward(result); void window.focusQuest.getSnapshot().then(setSnapshot) }}
    onDebriefStarted={setSnapshot}
    onSnapshot={setSnapshot}
  />{reviewBackdrop && <ConnectedAfterFocus snapshot={snapshot} onChanged={setSnapshot} onError={setError} onReturned={() => setView('today')} retainFocusBackdrop />}
    {loadError && <div className="toast error">{loadError}<button onClick={() => setError(null)}>×</button></div>}</>
  if (snapshot.pendingDebrief) return <><ConnectedAfterFocus snapshot={snapshot} onChanged={setSnapshot} onError={setError} onReturned={() => setView('today')} />{loadError && <div className="toast error">{loadError}<button onClick={() => setError(null)}>×</button></div>}</>

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

  const startRun = async (task: QuestTask): Promise<void> => {
    try {
      setSnapshot(await window.focusQuest.startDailyRun(task.id))
    }
    catch (reason) { setError(friendlyError(reason)) }
  }

  const selectNode = async (node: ExpeditionNode): Promise<void> => {
    if (!snapshot.todayRun) return
    try {
      const next = await window.focusQuest.selectExpeditionNode(snapshot.todayRun.id, node.id)
      setSnapshot(next)
    } catch (reason) {
      setError(friendlyError(reason))
    }
  }

  const navigate = (next: View): void => {
    if (next === view && (next === 'log' || next === 'settings')) { setView('today'); setScene('today'); setSheet(null); return }
    setSheet(null)
    setView(next)
    if (next === 'today' || next === 'collection') setScene(next)
    if (next === 'collection') {
      const signature = JSON.stringify({ cores: snapshot.mapCores.map((core) => core.itemKey), tray: snapshot.collection.clues.filter((clue) => !clue.pinnedAt).map((clue) => clue.id) })
      window.localStorage.setItem('focusquest-collection-seen', signature)
      setSeenCollectionSignature(signature)
    }
  }

  const parkMain = async (id: string): Promise<void> => {
    try {
      setSnapshot(await window.focusQuest.setTaskRole(id, 'backlog'))
      setNotice('任務已暫放；內容與紀錄都保留在任務庫。')
      setView('today'); setScene('today'); setSheet('all')
    } catch (reason) {
      setError(friendlyError(reason))
    }
  }

  const collectionSignature = JSON.stringify({ cores: snapshot.mapCores.map((core) => core.itemKey), tray: snapshot.collection.clues.filter((clue) => !clue.pinnedAt).map((clue) => clue.id) })
  const collectionHasNew = lobbyFromSnapshot(snapshot).collectionHasNew && collectionSignature !== seenCollectionSignature
  const activeSheet = sheet === 'all' ? 'all' : view === 'log' || view === 'settings' ? view : null
  const todayMinutes = Math.floor((snapshot.activityLog.days.at(-1)?.seconds ?? 0) / 60)
  const closeSheet = (): void => { setSheet(null); setView('today'); setScene('today') }

  return <>
    {rootCampfireFocus && <FocusActive
      snapshot={snapshot}
      onEnded={(result) => { setReward(result); void window.focusQuest.getSnapshot().then(setSnapshot) }}
      onDebriefStarted={setSnapshot}
      onSnapshot={setSnapshot}
      onSceneReady={() => setReadyFocusSession(snapshot.activeSession!.id)}
      skipCampfire
      audioActive={!keepCampfire}
    />}
    {(!rootCampfireFocus || keepCampfire) && <div className={`app-shell shell-v51${activeSheet ? ' sheet-open' : ''}${rootCampfireFocus ? ' is-departing' : ''}`} onKeyDown={(event) => { if (event.key === 'Escape' && activeSheet) closeSheet() }}>
    <aside className="sidebar">
      <div className="shell-logo"><LanternMark /></div>
      <nav>{([
        ['today', '今天'], ['collection', '收藏室'], ['log', '紀錄'], ['settings', '設定']
      ] as const).map(([value, label]) => <button key={value} aria-label={label} title={label} className={(sheet === 'all' ? value === 'today' : view === value) ? 'active' : ''} aria-current={(sheet === 'all' ? value === 'today' : view === value) ? 'page' : undefined} onClick={() => navigate(value)}><span><UiIcon name={value} />{value === 'collection' && collectionHasNew && <i className="shell-new-dot" />}</span><b>{label}</b></button>)}</nav>
      <div className="shell-today-minutes">今天 <strong>{todayMinutes}</strong> 分鐘</div>
    </aside>
    <main className="main-stage">
      <div className="shell-scene">
        {todayMounted.current && <div className={`shell-today-layer${scene === 'today' || !collectionReady ? '' : ' is-hidden'}`} aria-hidden={scene !== 'today' && collectionReady}>
          {lobbyPreview ? <LobbyPreview scenario={lobbyPreview} /> : <ConnectedLobby snapshot={rootCampfireFocus ? lastIdleSnapshot.current! : snapshot} active={scene === 'today'} departureSession={rootCampfireFocus ? snapshot.activeSession : null} onDepartureComplete={() => setCompletedCampfireSession(snapshot.activeSession!.id)} onChanged={setSnapshot} onError={setError} onAllTasks={() => { setView('today'); setSheet('all') }} />}
        </div>}
        {(collectionMounted || scene === 'collection') && <CollectionRoom snapshot={snapshot} active={scene === 'collection' && collectionReady} onReady={markCollectionReady} onChanged={setSnapshot} onError={setError} onBack={() => navigate('today')} />}
      </div>
      {activeSheet && <div className="shell-sheet-layer" onPointerDown={(event) => { if (event.target === event.currentTarget) closeSheet() }}><section className="shell-sheet" role="dialog" aria-modal="true" aria-label={activeSheet === 'all' ? '全部事項' : activeSheet === 'log' ? '紀錄' : '設定'}><header className="shell-sheet-head"><div><small>{activeSheet === 'all' ? '清單' : activeSheet === 'log' ? '留下的足跡' : '旅途工具'}</small><h2>{activeSheet === 'all' ? '全部事項' : activeSheet === 'log' ? '紀錄' : '設定'}</h2></div><button aria-label="關閉面板" onClick={closeSheet}>×</button></header><div className="shell-sheet-scroll">{activeSheet === 'all' ? <AllTasksPanel snapshot={snapshot} onChanged={setSnapshot} onError={setError} onNotice={setNotice} /> : activeSheet === 'log' ? <LogPanel snapshot={snapshot} /> : <SettingsPanel snapshot={snapshot} onChanged={setSnapshot} onError={setError} onNotice={setNotice} />}</div></section></div>}
    </main>
    {wizard && <TaskWizard snapshot={snapshot} onClose={() => setWizard(false)} onSaved={setSnapshot} />}
    {focusTarget && <FocusSetup task={focusTarget.task} node={focusTarget.node} snapshot={snapshot} onClose={() => setFocusTarget(null)} onStarted={setSnapshot} />}
    {reward && <RewardModal result={reward} snapshot={snapshot} onClose={() => { setReward(null); navigate('collection') }} />}
    {(loadError || notice) && <div className={loadError ? 'toast error' : 'toast'}>{loadError ?? notice}<button onClick={() => { setError(null); setNotice('') }}>×</button></div>}
  </div>}
  </>
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
  const paused = snapshot.activeSession.suspendedAt !== null
  return <button className={`mini-timer active${paused ? ' paused' : ''}`} onClick={() => void window.focusQuest.overlayReturn()}><span className="mini-lantern">{paused ? '❙❙' : '✦'}</span><div><strong>{formatClock(remaining > 0 ? remaining : seconds)}</strong><small>{paused ? '已暫停 · 點一下回到專注' : remaining > 0 ? '距離最低承諾' : '正在自由專注'}</small></div><i aria-hidden="true" /></button>
}
