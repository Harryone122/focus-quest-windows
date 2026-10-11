import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CloudRuinsAnchors, CloudRuinsRouteMark } from './cloudRuins/cloudRuinsScene'
import { LobbyScene } from './LobbyScene'
import {
  EXIT_COPY,
  NODE_COPY,
  canStartSelectedNode,
  lobbyModel,
  routeExit,
  routeIntel,
  type LobbyRouteExit
} from './ExpeditionMap'
import type { DailyRun, ExpeditionNode, QuestTask, RunRelic } from '../../shared/types'

// Today = the lobby. The Area the traveller is resting in fills the view (the same 3D scene and glass as
// Focus Active); the next routes hang beside the exits they leave by. Clicking a marker only selects;
// the panel on the right carries the one commitment, 開始探索, which opens Focus Setup.

const AREA_NAME = '雲上遺庭'

function savedMinutes(seconds: number): number {
  return Math.floor(seconds / 60)
}

interface ExpeditionLobbyProps {
  coreTaken?: boolean
  dateLabel: string
  run: DailyRun | null
  task: QuestTask | undefined
  taskKindLabel: string | null
  /** Short status line for the Main Quest (e.g. 等待開始). */
  taskStatus: string
  nodes: ExpeditionNode[]
  relics: RunRelic[]
  onStartRun: () => void
  onSelectNode: (node: ExpeditionNode) => void
  onContinueNode: (node: ExpeditionNode) => void
  onCreateTask: () => void
  onParkMain: (() => void) | null
  onDeleteMain: (() => void) | null
  sideCount: number
  sideQuests: ReactNode
  busy?: boolean
}

interface MarkerPlacement {
  key: string
  left: number
  top: number
  /** Where the leader line runs from the marker to its anchor on the map. */
  leader: 'up' | 'down' | 'none'
  leaderLength: number
  /** Horizontal position of the leader inside the marker (px from its left edge). */
  leaderX: number
}

const MARKER_H = 62
const MARKER_GAP = 10

type Geometry = { width: number; height: number; clearTop: number; clearRight: number; markerW: number }

function placeMarkers(
  routes: Array<{ key: string; exit: LobbyRouteExit | null }>,
  anchors: CloudRuinsAnchors | null,
  geometry: Geometry
): MarkerPlacement[] {
  const MARKER_W = geometry.markerW
  const minX = 14, maxX = geometry.clearRight - MARKER_W - 12
  const minY = geometry.clearTop + 10, maxY = geometry.height - MARKER_H - 14
  const clampX = (x: number): number => Math.max(minX, Math.min(maxX, x))
  const clampY = (y: number): number => Math.max(minY, Math.min(maxY, y))
  const docked = routes.filter((route) => !route.exit || !anchors?.[route.exit])
  const placed: MarkerPlacement[] = []
  const entryRoutes = routes.filter((route) => route.exit === 'entry' && anchors?.entry)
  entryRoutes.forEach((route, index) => {
    // A fresh day: both routes start on the entry stones; the markers stack in the cloud below them.
    const anchor = anchors!.entry!
    const top = clampY(anchor.y + 30 + index * (MARKER_H + MARKER_GAP))
    const left = clampX(anchor.x - 12)
    placed.push({ key: route.key, left, top, leader: index === 0 ? 'up' : 'none', leaderLength: Math.max(0, top - anchor.y), leaderX: anchor.x - left })
  })
  routes.forEach((route) => {
    if (route.exit !== 'exit_high' && route.exit !== 'exit_pines') return
    const anchor = anchors?.[route.exit]
    if (!anchor) return
    // The high exit climbs into open sky: its marker hangs above the stairs. The pine exit steps down into
    // the cloud: its marker sits below. Both stay clear of the islands and of each other.
    const left = clampX(anchor.x - 30)
    if (route.exit === 'exit_high') {
      const top = clampY(anchor.y - 58 - MARKER_H)
      placed.push({ key: route.key, left, top, leader: 'down', leaderLength: Math.max(0, anchor.y - (top + MARKER_H)), leaderX: anchor.x - left })
    } else {
      const top = clampY(anchor.y + 44)
      placed.push({ key: route.key, left, top, leader: 'up', leaderLength: Math.max(0, top - anchor.y), leaderX: anchor.x - left })
    }
  })
  placed.forEach((placement) => { placement.leaderX = Math.max(16, Math.min(MARKER_W - 16, placement.leaderX)) })
  // Routes without a known exit (and the fallback without WebGL) sit in one row at the foot of the map.
  const rowWidth = docked.length * MARKER_W + Math.max(0, docked.length - 1) * MARKER_GAP
  const rowLeft = Math.max(minX, (geometry.clearRight - rowWidth) / 2)
  docked.forEach((route, index) => {
    placed.push({ key: route.key, left: rowLeft + index * (MARKER_W + MARKER_GAP), top: maxY - 6, leader: 'none', leaderLength: 0, leaderX: 0 })
  })
  return placed
}

function RouteMarker({ node, exit, placement, selected, onSelect, onHover, busy }: {
  node: ExpeditionNode
  exit: LobbyRouteExit | null
  placement: MarkerPlacement | undefined
  selected: boolean
  onSelect: () => void
  onHover: (hovering: boolean) => void
  busy: boolean
}): React.JSX.Element {
  const partial = node.state === 'partial'
  const saved = savedMinutes(node.progressSeconds)
  const progress = Math.min(1, node.progressSeconds / (node.plannedMinutes * 60))
  const place = exit ? EXIT_COPY[exit].label : null
  return <button
    type="button"
    className={`lobby-route-marker${selected ? ' is-selected' : ''}${partial ? ' is-partial' : ''}${placement ? '' : ' is-waiting'}`}
    data-glass-card
    data-leader={placement?.leader ?? 'none'}
    style={placement ? { transform: `translate3d(${Math.round(placement.left)}px, ${Math.round(placement.top)}px, 0)`, '--leader': `${Math.round(placement.leaderLength)}px`, '--leader-x': `${Math.round(placement.leaderX)}px` } as React.CSSProperties : undefined}
    disabled={busy}
    aria-pressed={selected}
    aria-label={`${node.title}，${node.plannedMinutes} 分鐘${place ? `，${place}` : ''}${partial ? `，已保存 ${saved} 分鐘` : ''}${selected ? '，已選擇' : ''}`}
    onClick={onSelect}
    onPointerEnter={() => onHover(true)}
    onPointerLeave={() => onHover(false)}
    onFocus={() => onHover(true)}
    onBlur={() => onHover(false)}
  >
    <i className="lobby-marker-lamp" aria-hidden="true" />
    <span className="lobby-marker-time"><strong>{node.plannedMinutes}</strong><small>分鐘</small></span>
    <span className="lobby-marker-text">
      <b>{node.title}</b>
      <small>{partial ? `已保存 ${saved} 分` : place ?? NODE_COPY[node.type].label}</small>
    </span>
    {partial && <span className="lobby-marker-progress" aria-hidden="true"><i style={{ width: `${progress * 100}%` }} /></span>}
  </button>
}

export function ExpeditionLobby({
  coreTaken = false,
  dateLabel,
  run,
  task,
  taskKindLabel,
  taskStatus,
  nodes,
  relics,
  onStartRun,
  onSelectNode,
  onContinueNode,
  onCreateTask,
  onParkMain,
  onDeleteMain,
  sideCount,
  sideQuests,
  busy = false
}: ExpeditionLobbyProps): React.JSX.Element {
  const model = useMemo(() => lobbyModel(run, nodes), [run, nodes])
  const { selected, candidates, anchor } = model
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [activity, setActivity] = useState('')
  const [anchors, setAnchors] = useState<CloudRuinsAnchors | null>(null)
  const [sceneFailed, setSceneFailed] = useState(false)
  const [sidesOpen, setSidesOpen] = useState(false)
  const [geometry, setGeometry] = useState<Geometry>({ width: 0, height: 0, clearTop: 0, clearRight: 0, markerW: 196 })
  const root = useRef<HTMLElement>(null)
  const header = useRef<HTMLElement>(null)
  const panel = useRef<HTMLElement>(null)
  const syncChromeRef = useRef<(() => void) | null>(null)

  const routes = useMemo(() => candidates.map((node) => ({ node, key: node.id, exit: routeExit(node, anchor) })), [candidates, anchor])
  const marks = useMemo<CloudRuinsRouteMark[]>(() => routes.map(({ node, key, exit }) => ({
    key,
    exit,
    state: node.id === selected?.id ? 'selected' : node.state === 'partial' ? 'partial' : 'available'
  })), [routes, selected])

  // The clear band the markers may use: below the header, left of the panel.
  const measure = useCallback((): void => {
    const rootRect = root.current?.getBoundingClientRect()
    if (!rootRect) return
    const headerRect = header.current?.getBoundingClientRect()
    const panelRect = panel.current?.getBoundingClientRect()
    const next = {
      width: rootRect.width,
      height: rootRect.height,
      clearTop: headerRect ? headerRect.bottom - rootRect.top : 0,
      clearRight: panelRect && panelRect.width > 0 ? panelRect.left - rootRect.left : rootRect.width,
      markerW: root.current?.querySelector<HTMLElement>('.lobby-route-marker')?.offsetWidth || 196
    }
    setGeometry((current) => (
      Math.abs(current.width - next.width) < 0.5 && Math.abs(current.height - next.height) < 0.5
      && Math.abs(current.clearTop - next.clearTop) < 0.5 && Math.abs(current.clearRight - next.clearRight) < 0.5
      && current.markerW === next.markerW
    ) ? current : next)
  }, [])
  useLayoutEffect(() => {
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    if (root.current) observer?.observe(root.current)
    if (panel.current) observer?.observe(panel.current)
    if (header.current) observer?.observe(header.current)
    return () => observer?.disconnect()
  }, [measure])
  useLayoutEffect(() => { measure() }, [measure, candidates.length])

  const placements = useMemo(
    () => geometry.width > 0 && (anchors || sceneFailed) ? placeMarkers(routes, sceneFailed ? null : anchors, geometry) : [],
    [routes, anchors, sceneFailed, geometry]
  )
  // Markers and the side panel sit on scene glass: re-measure it whenever they move or open.
  useLayoutEffect(() => { syncChromeRef.current?.() }, [placements, sidesOpen, selected?.id, run?.id, task?.id])
  useEffect(() => { if (!routes.some((route) => route.key === hoverKey)) setHoverKey(null) }, [routes, hoverKey])

  const canStart = canStartSelectedNode(run, selected, task)
  const selectedExit = selected ? routeExit(selected, anchor) : null
  const intel = selected ? routeIntel(selected, relics) : null
  const selectedProgress = selected ? Math.min(1, selected.progressSeconds / (selected.plannedMinutes * 60)) : 0
  const lampMinutes = selected ? selected.plannedMinutes / 5 : 0

  return <section ref={root} className={`today-lobby${run ? ' has-run' : ''}${sceneFailed ? ' scene-failed' : ''}`} aria-label="今日遠征">
    <LobbyScene
      coreTaken={coreTaken}
      progressSeconds={model.worldProgressSeconds}
      targetSeconds={model.worldTargetSeconds}
      seed={run?.seed ?? 1}
      routes={marks}
      hoverKey={hoverKey}
      onAnchors={setAnchors}
      onActivityChange={setActivity}
      onFailed={() => setSceneFailed(true)}
      syncChromeRef={syncChromeRef}
    />
    <div className="lobby-vignette" aria-hidden="true" />

    <header ref={header} className="lobby-header" data-glass="top">
      <div className="lobby-title" data-glass-zone>
        <small>今日遠征 · {dateLabel}</small>
        <h1>今天往哪走？</h1>
      </div>
      {activity && <p className="lobby-activity" data-glass-zone>
        <i aria-hidden="true">⌁</i>
        <span><small>{anchor ? `${AREA_NAME} · 已走過 ${model.clearedCount} 段` : AREA_NAME}</small>{activity}</span>
      </p>}
    </header>

    <div className="lobby-markers" role="group" aria-label="目前的岔路">
      {candidates.map((node) => {
        const route = routes.find((entry) => entry.key === node.id)!
        const isSelected = node.id === selected?.id
        return <RouteMarker
          key={node.id}
          node={node}
          exit={route.exit}
          placement={placements.find((placement) => placement.key === node.id)}
          selected={isSelected}
          busy={busy}
          onHover={(hovering) => setHoverKey((current) => hovering ? node.id : current === node.id ? null : current)}
          onSelect={() => {
            if (node.state === 'available' || node.state === 'partial') onSelectNode(node)
          }}
        />
      })}
    </div>

    <aside ref={panel} className="lobby-panel" data-glass-side aria-live="polite">
      <div className="lobby-panel-scroll">
        <section className="lobby-route" aria-label="路線">
          {!run ? <>
            <p className="lobby-overline"><span>{AREA_NAME}</span><i />入口</p>
            <h2>還沒打開今天的路</h2>
            <p className="lobby-route-copy">{task ? '打開後會出現兩條路，選好再開始。' : '先留下今天最想推進的一件事。'}</p>
            <button type="button" className="lobby-primary" disabled={!task || busy} onClick={onStartRun}>
              <i aria-hidden="true" className="lobby-primary-lamp" />打開遠征地圖
            </button>
          </> : selected ? <>
            <p className="lobby-overline">
              <span>{AREA_NAME}</span><i />{selectedExit ? EXIT_COPY[selectedExit].label : NODE_COPY[selected.type].label}
            </p>
            <h2>{selected.title}</h2>
            <div className="lobby-route-facts">
              <strong>{selected.plannedMinutes}<small>分鐘</small></strong>
              <span>
                <span className="lobby-lamp-row" aria-label={`五盞燈，每 ${lampMinutes} 分鐘一盞`}>
                  {Array.from({ length: 5 }, (_, index) => <i key={index} className={index < Math.floor(selectedProgress * 5 + 1e-9) ? 'lit' : ''} />)}
                </span>
                <small>{selected.state === 'partial' ? `已保存 ${savedMinutes(selected.progressSeconds)} 分鐘` : `每 ${lampMinutes} 分鐘點亮一盞燈`}</small>
              </span>
            </div>
            <p className="lobby-route-copy">{selected.description}</p>
            {selectedExit && selectedExit !== 'entry' && selected.state !== 'partial' && <p className="lobby-exit-hint"><i aria-hidden="true">{selectedExit === 'exit_high' ? '⌃' : '⌄'}</i>{EXIT_COPY[selectedExit].hint}</p>}
            {intel && <p className="lobby-intel"><i aria-hidden="true">◇</i>{intel}</p>}
            <button type="button" className="lobby-primary" disabled={!canStart || busy} onClick={() => onContinueNode(selected)}>
              <i aria-hidden="true" className="lobby-primary-lamp" />{selected.state === 'partial' ? '繼續探索' : '開始探索'}
            </button>
            <small className="lobby-route-note">{canStart ? '開始之前，都可以改選另一條路。' : '請先建立或指定一個可繼續的主線任務。'}</small>
          </> : <>
            <p className="lobby-overline"><span>{AREA_NAME}</span><i />岔路</p>
            <h2>先選一條路</h2>
            <p className="lobby-route-copy">點地圖上的路線只會選擇，不會開始計時。</p>
          </>}
        </section>

        <section className="lobby-quest" aria-label="主線">
          <header><span>主線</span>{taskKindLabel && <i>{taskKindLabel}</i>}</header>
          {task ? <>
            <h3>{task.title}</h3>
            <p className="lobby-quest-goal">{task.progressDefinition}</p>
            {task.starterAction && <p className="lobby-quest-starter"><small>需要開頭時</small>{task.starterAction}</p>}
            <p className="lobby-quest-status"><i aria-hidden="true" />{taskStatus}</p>
          </> : <div className="lobby-quest-empty">
            <p>{run ? '上一件主線已完成。建立新的主線，就能保留進度繼續遠征。' : '先建立今天最想推進的一件事。'}</p>
            <button type="button" onClick={onCreateTask}>{run ? '建立新主線' : '建立主線'}</button>
          </div>}
          <footer>
            {onParkMain && <button type="button" onClick={onParkMain}>暫放</button>}
            {onDeleteMain && <button type="button" className="danger" onClick={onDeleteMain}>刪除</button>}
            {task && <button type="button" onClick={onCreateTask}>加入其他事情</button>}
          </footer>
        </section>

        <section className={`lobby-sides${sidesOpen ? ' is-open' : ''}`}>
          <button type="button" className="lobby-sides-toggle" aria-expanded={sidesOpen} onClick={() => setSidesOpen((open) => !open)}>
            <span>如果還有餘裕</span><small>{sideCount} / 2</small><i aria-hidden="true" />
          </button>
          <div className="lobby-sides-body" hidden={!sidesOpen}>{sideQuests}</div>
        </section>
      </div>
    </aside>
  </section>
}
