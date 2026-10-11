import { useEffect, useState } from 'react'
import type { DepartureInput, DepartureModel, DepartureRunningApp } from './lobbyTypes'

// 出發前確認 (replaces FocusSetup for the §47 lobby). One quiet sheet over the lobby: where the traveller
// goes, what the player will work on, the minimum commitment, and the usual guards. Only 出發 starts
// Focus; 返回 changes nothing. Presentation only: onConfirm hands the choices to the caller.

const EXIT_TEXT = {exit_corridor:'沿玻璃連廊出發',exit_cellar:'走入地下鍋爐室', a_arch: '穿過湖畔石拱門出發', b_far: '沿著東方踏石出發', exit_high: '從高台出口出發', exit_pines: '從松林出口出發', exit_boat: '搭溪尾的小舟出發', exit_tunnel: '穿過苔痕隧道出發', exit_bridge: '向營火左邊的吊橋出發', exit_steps: '向營火右邊的浮石出發' } as const
const MINIMUMS = [5, 10, 15] as const

interface Props {
  model: DepartureModel
  loadApps: () => Promise<DepartureRunningApp[]>
  onConfirm: (input: DepartureInput) => Promise<void> | void
  onCancel: () => void
}

export function DepartureSheet({ model, loadApps, onConfirm, onCancel }: Props): React.JSX.Element {
  const [taskId, setTaskId] = useState(model.task.id)
  const [switching, setSwitching] = useState(false)
  const [minimum, setMinimum] = useState<5 | 10 | 15>(10)
  const [requestedItem, setRequestedItem] = useState<string | null>(model.itemChoice?.defaultItemKey ?? null)
  const [phoneParked, setPhoneParked] = useState(!model.phoneRitual)
  const [apps, setApps] = useState<DepartureRunningApp[] | null>(null)
  const [blocked, setBlocked] = useState(() => new Set(model.blockedProcessNames))
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    let alive = true
    loadApps().then((list) => { if (alive) setApps(list) }).catch(() => { if (alive) setApps([]) })
    return () => { alive = false }
  }, [loadApps])
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { if (event.key === 'Escape' && !starting) onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel, starting])

  const task = [model.task, ...model.otherTasks].find((entry) => entry.id === taskId) ?? model.task
  const lampMinutes = model.targetSeconds / 5 / 60
  const explored = Math.floor(model.exploredSeconds / 60)
  const lit = Math.min(5, Math.floor((model.exploredSeconds / Math.max(1, model.targetSeconds)) * 5 + 1e-9))
  const chosenCount = blocked.size

  const depart = async (): Promise<void> => {
    setStarting(true)
    setError('')
    try {
      const blockedApps = (apps ?? []).filter((app) => blocked.has(app.processName))
      await onConfirm({ taskId: task.id, minimumMinutes: minimum, blockedApps, requestedJourneyItem: requestedItem })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : String(reason))
      setStarting(false)
    }
  }

  return <div className="la-sheet-backdrop la-depart-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !starting) onCancel() }}>
    <section className="la-sheet la-depart" role="dialog" aria-modal="true" aria-labelledby="la-depart-title">
      <p className="la-label">出發前</p>

      <div className="la-depart-where">
        <h3 id="la-depart-title">{model.mapTitle}</h3>
        <p className="la-soft">
          {model.mode === 'continue'
            ? `繼續探索 · 已探索 ${explored} / ${model.targetSeconds / 60} 分鐘`
            : `${model.exit ? EXIT_TEXT[model.exit] : '從起點出發'} · ${model.targetSeconds / 60} 分鐘，每 ${lampMinutes} 分鐘點亮一盞燈`}
        </p>
        <span className="la-lamps" aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < lit ? 'on' : ''} />)}</span>
      </div>

      <div className="la-depart-task">
        <div className="la-depart-row"><span className="la-label">這次要做</span>{model.otherTasks.length > 0 && <button type="button" className="la-link" aria-expanded={switching} onClick={() => setSwitching((on) => !on)}>{switching ? '收起' : '換一件'}</button>}</div>
        <strong>{task.title}</strong>
        {task.note && <span className="la-soft">{task.note}</span>}
        {switching && <ul className="la-depart-choices" role="radiogroup" aria-label="換一件事">
          {[model.task, ...model.otherTasks].map((entry) => <li key={entry.id}>
            <button type="button" role="radio" aria-checked={entry.id === task.id} onClick={() => { setTaskId(entry.id); setSwitching(false) }}>{entry.title}</button>
          </li>)}
        </ul>}
      </div>

      <div className="la-depart-min" role="radiogroup" aria-label="最低專注時間">
        <span className="la-label">最低專注</span>
        <div>{MINIMUMS.map((value) => <button key={value} type="button" role="radio" aria-checked={minimum === value} onClick={() => setMinimum(value)}><strong>{value}</strong> 分鐘</button>)}</div>
        <small className="la-soft">至少做這麼久再結束；時間到了可以繼續。</small>
      </div>

      {model.itemChoice && <div className="la-depart-item" role="radiogroup" aria-label="用核心指定信物">
        <span className="la-label">用{model.itemChoice.coreTitle}指定信物</span>
        <button type="button" role="radio" aria-checked={requestedItem === null} onClick={() => setRequestedItem(null)}>
          <span>讓它自己出現</span><small>兩件隨機給一件</small>
        </button>
        {model.itemChoice.options.map((option) => <button key={option.itemKey} type="button" role="radio" aria-checked={requestedItem === option.itemKey} onClick={() => setRequestedItem(option.itemKey)}>
          <span>{option.title}</span><small>{option.trackedPlaceTitle ? `${option.trackedPlaceTitle}需要` : ''}</small>
        </button>)}
        <p className="la-soft">選擇會存在這次探索上；開始後不能更改，也不影響核心與路線規則。</p>
      </div>}

      {model.phoneRitual && <label className="la-depart-phone">
        <input type="checkbox" checked={phoneParked} onChange={(event) => setPhoneParked(event.target.checked)} />
        <span>手機已放到伸手拿不到的位置</span>
      </label>}

      <details className="la-depart-apps">
        <summary><span>需要擋住哪些程式？</span><small>{chosenCount ? `已選 ${chosenCount} 個` : '選填'}</small></summary>
        {apps === null ? <p className="la-soft">正在讀取目前執行的程式…</p>
          : apps.length === 0 ? <p className="la-soft">目前沒有其他可選的桌面程式。</p>
            : <div className="la-depart-applist">{apps.map((app) => <label key={app.processName}>
              <input type="checkbox" checked={blocked.has(app.processName)} onChange={() => setBlocked((current) => { const next = new Set(current); if (next.has(app.processName)) next.delete(app.processName); else next.add(app.processName); return next })} />
              <span>{app.displayName}</span>
            </label>)}</div>}
      </details>

      {error && <p className="la-error" role="alert">{error}</p>}

      <div className="la-depart-actions">
        <button type="button" className="la-link" disabled={starting} onClick={onCancel}>返回</button>
        <button type="button" className="la-primary compact" autoFocus disabled={!phoneParked || starting} onClick={() => void depart()}>
          <i aria-hidden="true" />{starting ? '正在出發…' : '出發'}
        </button>
      </div>
    </section>
  </div>
}
