import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CloudRuinsAnchors } from '../cloudRuins/cloudRuinsScene'
import { LobbyStage, type StageRouteMark, type StageView } from './LobbyStage'
import { CampfireStage } from './CampfireStage'
import type { CampfireAudioSettings } from './campfireAudio'
import type { LobbyActions, LobbyNewFind, LobbyRouteOption, LobbyTask, LobbyViewModel, Weekday } from './lobbyTypes'
import type { FocusSession } from '../../../shared/types'
import { focusElapsedMs } from '../../../shared/focusTime'

// Lobby option A (core plan §47): a close-up of the traveller on the left, a Focus-style glass panel on
// the right. Two route cards under the close-up; hovering one eases the camera toward its exit. The panel
// holds the one main button, today's list and the journey bag. Presentation only: every change goes
// through LobbyActions and comes back in the next LobbyViewModel.

const EXIT_LABEL = {exit_corridor:'玻璃連廊',exit_cellar:'地下鍋爐室', a_arch: '湖畔石拱門', b_far: '東方踏石', exit_high: '⌃ 高台出口', exit_pines: '⌄ 松林出口', exit_boat: '⌄ 霧瀑小舟', exit_tunnel: '⌃ 苔痕隧道', exit_bridge: '左 · 吊橋', exit_steps: '右 · 浮石' } as const
const FIND_KIND = { item: '信物', core: '地圖核心', clue: '故事線索' } as const
const WEEKDAYS: Array<{ day: Weekday; label: string }> = [
  { day: 1, label: '一' }, { day: 2, label: '二' }, { day: 3, label: '三' }, { day: 4, label: '四' },
  { day: 5, label: '五' }, { day: 6, label: '六' }, { day: 0, label: '日' }
]
const LOOK_RETURN_MS = 600

function minutes(seconds: number): number {
  return Math.floor(seconds / 60)
}

function daysLabel(days: Weekday[]): string {
  if (days.length === 7) return '每天'
  return WEEKDAYS.filter((entry) => days.includes(entry.day)).map((entry) => entry.label).join('')
}

function Lamps({ lit }: { lit: number }): React.JSX.Element {
  return <span className="la-lamps" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < lit ? 'on' : ''} />)}</span>
}

interface Props {
  audioSettings?: CampfireAudioSettings
  model: LobbyViewModel
  actions: LobbyActions
  onAllTasks?: () => void
  active?: boolean
  busy?: boolean
  departureSession?: FocusSession | null
  onDepartureComplete?: () => void
  /** A sheet shown over the lobby, e.g. the departure confirmation (DepartureSheet). */
  overlay?: ReactNode
}

type Sheet = { kind: 'find'; find: LobbyNewFind } | { kind: 'campfire'; stage: number; title: string; text: string } | { kind: 'bag' } | { kind: 'routines' } | null

export function LobbyA({ model, actions, audioSettings, active = true, busy = false, departureSession, onDepartureComplete, overlay, onAllTasks }: Props): React.JSX.Element {
  const { phase, journey, map, routes, tasks } = model
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [lookKey, setLookKey] = useState<string | null>(null)
  const [anchors, setAnchors] = useState<CloudRuinsAnchors>({})
  const [activity, setActivity] = useState('')
  const [sceneFailed, setSceneFailed] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [tab, setTab] = useState<'today' | 'yesterday'>('today')
  const [reorder, setReorder] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [draft, setDraft] = useState('')
  const syncChromeRef = useRef<(() => void) | null>(null)
  const lookTimer = useRef(0)
  const todayListRef = useRef<HTMLOListElement | null>(null)
  const previousTaskLayoutRef = useRef<{ ids: string[]; tops: Map<string, number> } | null>(null)

  const complete = map.exploredSeconds >= map.targetSeconds
  const lit = Math.min(5, Math.floor((map.exploredSeconds / Math.max(1, map.targetSeconds)) * 5 + 1e-9))
  const choosing = phase === 'journey_start' || phase === 'choose_route'
  const showCampfire = phase === 'journey_start' || phase === 'returned'
  const visibleRoutes = choosing ? routes : []
  const selected = visibleRoutes.find((route) => route.id === model.selectedRouteId) ?? null
  const hovered = visibleRoutes.find((route) => route.id === hoverKey) ?? null
  const focusRoute = hovered ?? selected
  const currentTask = tasks.today.find((task) => task.id === tasks.currentTaskId && !task.done) ?? null
  const todayDone = tasks.today.filter((task) => task.done).length
  const showYesterday = tasks.yesterday.length > 0
  useEffect(() => { if (!showYesterday) { setTab('today'); setConfirmDelete(false) } }, [showYesterday])
  const yesterdaySignature = tasks.yesterday.map((task) => task.id).join('|')
  useEffect(() => { setConfirmDelete(false) }, [yesterdaySignature])

  // Scene inputs. A fresh journey (and the return to the start) shows the traveller on the entry stones.
  const sceneProgress = phase === 'journey_start' || phase === 'returned' ? 0 : complete ? Math.max(map.exploredSeconds, map.targetSeconds) : map.exploredSeconds
  const marks = useMemo<StageRouteMark[]>(() => visibleRoutes.map((route) => ({
    key: route.id, exit: route.exit, state: route.id === model.selectedRouteId ? 'selected' : 'available'
  })), [visibleRoutes, model.selectedRouteId])
  const lookRoute = visibleRoutes.find((route) => route.id === lookKey)
  const view = useMemo<StageView>(() => lookRoute?.exit ? { kind: 'look', exit: lookRoute.exit } : { kind: 'close' }, [lookRoute?.exit])
  const findsOnGrass = phase === 'choose_route' || phase === 'final_ready' ? model.newFinds : []
  const findKeys = useMemo(() => findsOnGrass.map((find) => find.key), [findsOnGrass])

  const hoverRoute = useCallback((routeId: string | null): void => {
    window.clearTimeout(lookTimer.current)
    setHoverKey(routeId)
    if (routeId) setLookKey(routeId)
    else lookTimer.current = window.setTimeout(() => setLookKey(null), LOOK_RETURN_MS)
  }, [])
  useEffect(() => () => window.clearTimeout(lookTimer.current), [])
  useEffect(() => { if (hoverKey && !visibleRoutes.some((route) => route.id === hoverKey)) hoverRoute(null) }, [visibleRoutes, hoverKey, hoverRoute])

  // Cards, pins and sheets sit on scene glass: re-measure it whenever they move, open or change.
  useLayoutEffect(() => { syncChromeRef.current?.() }, [hoverKey, model, tab, reorder, confirmDelete, sheet, anchors])

  // The server remains the source of truth for ordering. Once its snapshot arrives, slide
  // the existing keyed rows from their old layout positions into their new positions.
  useLayoutEffect(() => {
    if (!reorder || tab !== 'today' || !todayListRef.current) {
      previousTaskLayoutRef.current = null
      return
    }
    const rows = Array.from(todayListRef.current.children) as HTMLLIElement[]
    const ids = tasks.today.map((task) => task.id)
    const tops = new Map(rows.map((row) => [row.dataset.taskId!, row.offsetTop]))
    const previous = previousTaskLayoutRef.current
    if (previous && ids.length === previous.ids.length && ids.some((id, index) => id !== previous.ids[index])
      && ids.every((id) => previous.tops.has(id)) && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      rows.forEach((row) => {
        const delta = (previous.tops.get(row.dataset.taskId!) ?? row.offsetTop) - row.offsetTop
        if (delta) row.animate([
          { transform: `translateY(${delta}px)` },
          { transform: 'translateY(0)' }
        ], { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
      })
    }
    previousTaskLayoutRef.current = { ids, tops }
  })

  const relevantItems = new Set(focusRoute?.itemHints.map((hint) => hint.itemKey) ?? [])
  const needsTask = phase === 'journey_start' || phase === 'choose_route' || phase === 'exploring'
  const primaryLabel = phase === 'exploring' ? '繼續探索' : phase === 'final_ready' ? '前往最終領域' : phase === 'returned' ? '開始新的旅程' : '準備出發'
  const primaryDisabled = busy || (choosing && !selected) || (needsTask && !currentTask)
  const nextLampMinute = Math.min(5, lit + 1) * map.targetSeconds / 5 / 60
  const primaryNote = needsTask && !currentTask
    ? '先在清單加一件這次要做的事'
    : phase === 'exploring'
      ? `還差 ${Math.max(0, minutes(map.targetSeconds - map.exploredSeconds))} 分鐘，第 ${Math.min(5, lit + 1)} 盞燈在 ${nextLampMinute} 分鐘亮起`
      : choosing ? (selected ? '下一步確認這次要做的事，才開始計時' : '先在左邊選一條路') : null

  const submitDraft = (): void => {
    if (busy) return
    const title = draft.trim()
    if (!title) return
    actions.addTask(title)
    setDraft('')
  }

  return <section className={`lobby-a${sceneFailed ? ' scene-failed' : ''}`} aria-label="旅人大廳">
    {showCampfire ? <CampfireStage
      audioSettings={audioSettings}
      active={active}
     
      stage={model.campfireStage}
      seenStage={model.seenCampfireStage}
      returned={phase === 'returned'}
      routes={routes}
      selectedRouteId={model.selectedRouteId}
      hoverRouteId={lookKey}
      onFind={(stage, title, text) => setSheet({ kind: 'campfire', stage, title, text })}
      departing={Boolean(departureSession)}
      playFromStart={Boolean(departureSession)}
      onDepartureComplete={onDepartureComplete}
      departureStartedAt={departureSession?.startedAt}
      departureElapsedMs={departureSession ? focusElapsedMs(departureSession) : undefined}
      departurePaused={Boolean(departureSession?.suspendedAt)}
      onFailed={() => setSceneFailed(true)}
    /> : <LobbyStage
      audioSettings={audioSettings}
      active={active}
      sceneKey={map.sceneKey}
      nodeId={map.nodeId ?? null}
      progressSeconds={sceneProgress}
      targetSeconds={map.targetSeconds}
      seed={model.seed}
      routes={marks}
      hoverKey={hoverKey}
      view={view}
      findKeys={findKeys}
      coreTaken={map.coreOwned}
      worldMarks={map.worldMarks}
      onAnchors={setAnchors}
      onActivityChange={setActivity}
      onFailed={() => setSceneFailed(true)}
      syncChromeRef={syncChromeRef}
    />}

    <div className="la-stage-ui">
      <header className="la-journey" data-glass-card>
        {showCampfire && <p className="la-label la-place-name">霧岸營火</p>}
        <p className="la-journey-head">
          <span className="la-label">旅程</span>
          <strong>{phase === 'returned' ? '準備下一趟' : `第 ${Math.min(journey.total, journey.segment)} 段 / ${journey.total}`}</strong>
        </p>
        <div className="la-journey-dots" aria-label={`已走完 ${journey.visited.length} 段，共 ${journey.total} 段`}>
          {Array.from({ length: journey.total }, (_, index) => {
            const state = index < journey.visited.length ? 'done' : index === journey.visited.length && phase !== 'returned' ? 'now' : 'todo'
            return <span key={index} className={`la-dot ${state}`}>{index > 0 && <i />}<b /></span>
          })}
        </div>
        {journey.visited.length > 0 && <p className="la-journey-maps">{journey.visited.map((entry) => entry.title).join(' → ')}</p>}
        {journey.trackingClue && <p className="la-journey-clue"><span className="la-label">追查中</span>{journey.trackingClue}</p>}
        {activity && <p className="la-journey-activity">{activity}</p>}
      </header>

      {findsOnGrass.map((find) => {
        const at = anchors[`item:${find.key}`]
        if (!at) return null
        return <button
          key={find.key}
          type="button"
          className="la-find-pin"
          style={{ transform: `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)` }}
          onClick={() => setSheet({ kind: 'find', find })}
>新發現 · {find.title}</button>
      })}

      {visibleRoutes.length > 0 && <div className="la-routes" onPointerLeave={() => hoverRoute(null)}>
        {hovered && <RouteDetail route={hovered} bagTitles={Object.fromEntries(model.bag.map((item) => [item.key, item.title]))} />}
        <p className="la-label la-routes-title">{phase === 'journey_start' ? '旅程的第一段往哪裡？' : '下一段往哪裡？'}<span> · 移到卡片上可以看向出口</span></p>
        <div className="la-route-row">
          {visibleRoutes.map((route) => <RouteCard
            key={route.id}
            route={route}
            selected={route.id === model.selectedRouteId}
            busy={busy}
            onSelect={() => actions.selectRoute(route.id)}
            onHover={(on) => hoverRoute(on ? route.id : null)}
          />)}
        </div>
      </div>}
    </div>

    <aside className="la-panel" data-glass-side aria-live="polite">
      <div className="la-panel-scroll">
        <section className="la-next">
          <p className="la-label">{phase === 'journey_start' ? '旅程的第一段' : phase === 'choose_route' ? '下一段' : phase === 'exploring' ? '這一段還沒走完' : phase === 'final_ready' ? '五段都走完了' : '回到起點'}</p>
          <h2>{phase === 'exploring' ? map.title : phase === 'final_ready' ? '最終領域' : phase === 'returned' ? '新的旅程' : selected?.title ?? '先選一條路'}</h2>
          {phase === 'exploring' && <p className="la-progress"><span>已探索 <strong>{minutes(map.exploredSeconds)}</strong> / {minutes(map.targetSeconds)} 分鐘</span><Lamps lit={lit} /></p>}
          {choosing && selected && <p className="la-progress"><span>{minutes(selected.targetSeconds ?? map.targetSeconds)} 分鐘 · 每 {minutes(selected.targetSeconds ?? map.targetSeconds) / 5} 分鐘點亮一盞燈</span><Lamps lit={0} /></p>}
          {choosing && !selected && <p className="la-soft">在左邊的兩條路中選一條，選了還可以改。</p>}
          {phase === 'final_ready' && <p className="la-soft">結束後會回到起點，收藏與故事紀錄都會保留。</p>}
          {phase === 'returned' && <p className="la-soft">上一趟的收藏與故事紀錄都在收藏室。</p>}

          {needsTask && <div className={`la-current${currentTask ? '' : ' empty'}`}>
            <span className="la-label">這次要做</span>
            {currentTask ? <><strong>{currentTask.title}</strong>{currentTask.note && <span>{currentTask.note}</span>}</> : <span>清單還是空的</span>}
          </div>}

          <button type="button" className="la-primary" disabled={primaryDisabled} onClick={actions.primary}>
            <i aria-hidden="true" />{primaryLabel}
          </button>
          {primaryNote && <small className="la-primary-note">{primaryNote}</small>}
        </section>

        {model.pendingEvents.map((event) => <section key={event.id} className="la-event">
          <p className="la-label">等你決定</p>
          <p>{event.prompt}</p>
          <div>{event.options.map((option) => <button key={option.id} type="button" disabled={busy} onClick={() => actions.chooseEvent(event.id, option.id)}>{option.label}</button>)}</div>
        </section>)}

        <section className="la-list" aria-label="清單">
          {onAllTasks && <button type="button" className="la-all-tasks la-link warm" onClick={onAllTasks}>全部事項 ›</button>}
          {showYesterday ? <div className="la-tabs" role="tablist" aria-label="清單">
            <button type="button" role="tab" aria-selected={tab === 'today'} onClick={() => { setTab('today'); setConfirmDelete(false) }}>今天 · {todayDone} / {tasks.today.length}</button>
            <button type="button" role="tab" aria-selected={tab === 'yesterday'} onClick={() => setTab('yesterday')}>昨天沒做完 · {tasks.yesterday.length}</button>
          </div> : <p className="la-list-head"><span className="la-label">今天的清單 · 完成 {todayDone} / {tasks.today.length}</span></p>}

          {tab === 'today' ? <>
            {tasks.today.length > 1 && <div className="la-list-tools"><button type="button" className="la-link" onClick={() => setReorder((on) => !on)}>{reorder ? '完成調整' : '調整順序'}</button></div>}
            <ol className="la-tasks" ref={todayListRef}>
              {tasks.today.map((task, index) => <TaskRow
                key={task.id}
                task={task}
                index={index}
                current={task.id === currentTask?.id}
                reorder={reorder}
                first={index === 0}
                last={index === tasks.today.length - 1}
                busy={busy}
                routineDays={task.routineId ? model.routines.find((routine) => routine.id === task.routineId)?.days ?? null : null}
                actions={actions}
              />)}
            </ol>
            <label className="la-add">
              <span aria-hidden="true">＋</span>
              <input
                type="text"
                value={draft}
                disabled={busy}
                placeholder="丟一件事進來，按 Enter"
                aria-label="新增清單事項"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) submitDraft() }}
              />
            </label>
          </> : <div className="la-yesterday">
            <p className="la-soft">之前排了、還沒完成的事。要繼續做的移到今天。</p>
            <ul className="la-tasks">
              {tasks.yesterday.map((task) => <li key={task.id} className="la-task">
                <span className="la-task-mark" aria-hidden="true">·</span>
                <span className="la-task-title">{task.title}{task.scheduledDate && <small className="la-task-date">{Number(task.scheduledDate.slice(5, 7))}/{Number(task.scheduledDate.slice(8, 10))}</small>}</span>
                <button type="button" className="la-link warm" onClick={() => actions.moveToToday([task.id])}>移到今天</button>
              </li>)}
            </ul>
            {confirmDelete
              ? <div className="la-confirm" role="alertdialog" aria-label="確認刪除">
                <p>刪除這 {tasks.yesterday.length} 件？刪除後無法復原。</p>
                <div><button type="button" className="danger" onClick={() => { actions.deleteAllYesterday(); setConfirmDelete(false) }}>永久刪除</button><button type="button" onClick={() => setConfirmDelete(false)}>取消</button></div>
              </div>
              : <div className="la-yesterday-actions">
                <button type="button" className="warm" onClick={() => actions.moveToToday(tasks.yesterday.map((task) => task.id))}>全部移到今天</button>
                <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>全部刪除…</button>
              </div>}
            <small className="la-soft">例行事項不會出現在這裡。</small>
          </div>}
        </section>

        <footer className="la-panel-foot">
          <div className="la-bag">
            <button type="button" className="la-link" onClick={() => setSheet({ kind: 'bag' })}>行囊 {model.bag.length}</button>
            <div className="la-bag-chips">
              {model.bag.length === 0 && <span className="la-soft">走完一張地圖會帶回一件信物</span>}
              {model.bag.map((item) => <button key={item.key} type="button" className={`la-chip${relevantItems.has(item.key) ? ' relevant' : ''}`} onClick={() => setSheet({ kind: 'bag' })}>
                {item.title}{item.isNew && <i>新</i>}
              </button>)}
            </div>
          </div>
          <button type="button" className="la-link" onClick={() => setSheet({ kind: 'routines' })}>↻ 例行事項 {model.routines.length}</button>
        </footer>
      </div>
    </aside>

    {sheet && <div className="la-sheet-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setSheet(null) }} onKeyDown={(event) => { if (event.key === 'Escape') setSheet(null) }}>
      {sheet.kind === 'find' && <div className="la-sheet la-find-sheet" role="dialog" aria-label={sheet.find.title}>
        <p className="la-label warm">{FIND_KIND[sheet.find.kind]}</p>
        <h3>{sheet.find.title}</h3>
        <p className="la-soft">{sheet.find.text}</p>
        <button type="button" className="la-primary compact" autoFocus onClick={() => { actions.inspectFind(sheet.find.key); setSheet(null) }}>收好</button>
      </div>}
      {sheet.kind === 'campfire' && <div className="la-sheet la-find-sheet" role="dialog" aria-label={sheet.title}>
        <p className="la-label warm">對面的位置</p>
        <h3>{sheet.title}</h3>
        <p className="la-soft">{sheet.text}</p>
        <button type="button" className="la-primary compact" autoFocus onClick={() => { actions.inspectCampfireTrace(sheet.stage); setSheet(null) }}>收好</button>
      </div>}
      {sheet.kind === 'bag' && <div className="la-sheet" role="dialog" aria-label="本趟行囊">
        <h3>本趟行囊</h3>
        {model.bag.length === 0 && <p className="la-soft">還是空的。走完一張地圖，會帶回那裡的兩種信物之一。</p>}
        <ul className="la-bag-list">{model.bag.map((item) => <li key={item.key} className={relevantItems.has(item.key) ? 'relevant' : ''}>
          <strong>{item.title}{item.isNew && <i>新</i>}</strong>
          <span>{item.use}</span>
          {relevantItems.has(item.key) && focusRoute && <em>↗ {focusRoute.title}用得上</em>}
          {item.knownCombos.map((combo) => <small key={combo}>組合：{combo}</small>)}
        </li>)}</ul>
        <button type="button" className="la-link" autoFocus onClick={() => setSheet(null)}>關閉</button>
      </div>}
      {sheet.kind === 'routines' && <RoutineSheet routines={model.routines} actions={actions} onClose={() => setSheet(null)} />}
    </div>}
    {overlay}
  </section>
}

function RouteCard({ route, selected, busy, onSelect, onHover }: {
  route: LobbyRouteOption
  selected: boolean
  busy: boolean
  onSelect: () => void
  onHover: (on: boolean) => void
}): React.JSX.Element {
  const hint = route.itemHints[0]
  const where = route.exit ? EXIT_LABEL[route.exit] : '起點'
  return <button
    type="button"
    className={`la-route${selected ? ' is-selected' : ''}`}
    data-glass-card
    disabled={busy}
    aria-pressed={selected}
    aria-label={`${route.title}，${where.replace(/^[⌃⌄] /, '')}${selected ? '，已選擇' : ''}`}
    onClick={onSelect}
    onPointerEnter={() => onHover(true)}
    onFocus={() => onHover(true)}
    onBlur={() => onHover(false)}
  >
    <span className="la-route-top"><span className="la-label">{where}</span>{selected && <span className="la-label warm">已選</span>}</span>
    <strong>{route.title}</strong>
    <span className="la-route-tag">{route.tagline}</span>
    {hint ? <span className="la-hint warm">◆ {hint.text}</span> : route.clueHint ? <span className="la-hint teal">↳ {route.clueHint}</span> : null}
    <span className="la-route-meta">{route.coreOwned ? '核心已取得' : '核心未取得'} · {route.visits > 0 ? `來過 ${route.visits} 次` : '初次造訪'}</span>
  </button>
}

function RouteDetail({ route, bagTitles }: { route: LobbyRouteOption; bagTitles: Record<string, string> }): React.JSX.Element {
  return <div className="la-route-detail" data-glass-card role="note" aria-label={`${route.title}的詳細資訊`}>
    <strong>{route.title}</strong>
    {route.details && <p>{route.details}</p>}
    <dl>
      {route.itemHints.map((hint) => <div key={hint.itemKey}><dt>你的物件</dt><dd className="warm">{bagTitles[hint.itemKey] ?? hint.itemKey}：{hint.text}</dd></div>)}
      {route.clueHint && <div><dt>追查線索</dt><dd>{route.clueHint}</dd></div>}
      <div><dt>地圖核心</dt><dd>{route.coreOwned ? '已取得' : '尚未取得'}</dd></div>
      <div><dt>造訪</dt><dd>{route.visits > 0 ? `來過 ${route.visits} 次` : '初次造訪'}</dd></div>
    </dl>
  </div>
}

function TaskRow({ task, index, current, reorder, first, last, busy, routineDays, actions }: {
  task: LobbyTask
  index: number
  current: boolean
  reorder: boolean
  first: boolean
  last: boolean
  busy: boolean
  routineDays: Weekday[] | null
  actions: LobbyActions
}): React.JSX.Element {
  return <li data-task-id={task.id} className={`la-task${task.done ? ' done' : ''}${current ? ' current' : ''}`}>
    <span className="la-task-mark" aria-hidden="true">{task.done ? '✓' : current ? <i /> : index + 1}</span>
    {task.done || current || reorder
      ? <span className="la-task-title">{task.title}</span>
      : <button type="button" className="la-task-title as-button" title="這次做這件" onClick={() => actions.setCurrentTask(task.id)}>{task.title}</button>}
    {reorder
      ? <span className="la-task-tools">
        <button type="button" aria-label={`把「${task.title}」往上移`} disabled={first || busy} onClick={() => actions.moveTask(task.id, -1)}>↑</button>
        <button type="button" aria-label={`把「${task.title}」往下移`} disabled={last || busy} onClick={() => actions.moveTask(task.id, 1)}>↓</button>
        <button type="button" aria-label={`從清單移除「${task.title}」`} disabled={busy} onClick={() => actions.removeTask(task.id)}>✕</button>
      </span>
      : current ? <span className="la-label warm">這次</span>
        : routineDays ? <span className="la-routine-mark">↻ {daysLabel(routineDays)}</span> : <span />}
  </li>
}

function RoutineSheet({ routines, actions, onClose }: { routines: LobbyViewModel['routines']; actions: LobbyActions; onClose: () => void }): React.JSX.Element {
  const [title, setTitle] = useState('')
  const [days, setDays] = useState<Weekday[]>([])
  const toggle = (list: Weekday[], day: Weekday): Weekday[] => list.includes(day) ? list.filter((entry) => entry !== day) : [...list, day]
  return <div className="la-sheet la-routines" role="dialog" aria-label="例行事項">
    <h3>例行事項</h3>
    <p className="la-soft">每天第一次打開時，排進今天的清單。沒做完的不會累積到隔天。</p>
    <ul>{routines.map((routine) => <li key={routine.id}>
      <div className="la-routine-top"><strong>{routine.title}</strong><button type="button" className="la-link" onClick={() => actions.deleteRoutine(routine.id)}>刪除</button></div>
      <div className="la-days" role="group" aria-label={`${routine.title}出現的日子`}>
        {WEEKDAYS.map((entry) => <button key={entry.day} type="button" aria-pressed={routine.days.includes(entry.day)} onClick={() => actions.saveRoutine({ id: routine.id, title: routine.title, days: toggle(routine.days, entry.day) })}>{entry.label}</button>)}
      </div>
    </li>)}</ul>
    <div className="la-routine-new">
      <input type="text" value={title} placeholder="新的例行事項" aria-label="新的例行事項名稱" onChange={(event) => setTitle(event.target.value)} />
      <div className="la-days" role="group" aria-label="出現的日子">
        {WEEKDAYS.map((entry) => <button key={entry.day} type="button" aria-pressed={days.includes(entry.day)} onClick={() => setDays((list) => toggle(list, entry.day))}>{entry.label}</button>)}
      </div>
      <button type="button" className="la-primary compact" disabled={!title.trim() || days.length === 0} onClick={() => { actions.saveRoutine({ id: null, title: title.trim(), days }); setTitle(''); setDays([]) }}>加入</button>
    </div>
    <button type="button" className="la-link" onClick={onClose}>完成</button>
  </div>
}
