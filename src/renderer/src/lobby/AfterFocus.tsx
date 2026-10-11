import { useRef } from 'react'
import { LobbyStage } from './LobbyStage'
import type { AfterFocusActions, AfterFocusModel, LobbyNewFind, Weekday } from './lobbyTypes'

// After Focus (§47.4, canvas S2 + E). The world stays behind, softly out of focus: first one question
// about the real work ("完成了嗎？"), then a short look at what this session left in the world. Choices can
// be made here or left for the lobby. Nothing here decides a result: answers go through the actions and
// the saved state comes back in the next model.

const WEEKDAY_LABEL: Record<Weekday, string> = { 0: '日', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' }
const FIND_KIND = { item: '信物', core: '地圖核心', clue: '故事線索' } as const

function duration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds / 60))
  const hours = Math.floor(total / 60)
  return hours > 0 ? `${hours} 小時 ${total % 60} 分` : `${Math.max(1, total)} 分鐘`
}

function FindIcon({ find }: { find: LobbyNewFind }): React.JSX.Element {
  if (find.kind === 'core') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7" /><ellipse cx="12" cy="12" rx="7" ry="2.6" /><ellipse cx="12" cy="12" rx="2.6" ry="7" /><circle cx="12" cy="12" r="1.4" /></svg>
  if (find.kind === 'clue') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.5h9l3 3v12H6z" /><path d="M9 10h6M9 13h6M9 16h4" /></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="5.5" /><path d="M14 14l5.5 5.5" /><path d="M7.5 9.2c.4-1.1 1.3-1.8 2.4-2" /></svg>
}

interface Props {
  model: AfterFocusModel
  actions: AfterFocusActions
  /** Scene backdrop: the map as it is now. */
  seed: number
  coreOwned: boolean
  worldMarks: string[]
  busy?: boolean
  /** The integrated flow keeps its finishing Focus canvas mounted behind us. */
  retainFocusBackdrop?: boolean
}

export function AfterFocus({ model, actions, seed, coreOwned, worldMarks, busy = false, retainFocusBackdrop = false }: Props): React.JSX.Element {
  const syncChromeRef = useRef<(() => void) | null>(null)
  const { map } = model
  const litAfter = Math.min(5, Math.floor((map.exploredSeconds / Math.max(1, map.targetSeconds)) * 5 + 1e-9))
  const complete = model.resolution === 'complete'
  const rest = map.sceneKey === 'area-02-moss-station' ? '候車室' : '樹下'
  const steps = [...(model.task ? [{ key: 'task', label: '工作紀錄' }] : []), { key: 'review', label: '這一段的發現' }, { key: 'back', label: `回到${rest}` }]
  const onStep = model.step === 'task' && model.task ? 'task' : 'review'

  return <section className={`lobby-a after-focus${retainFocusBackdrop ? ' has-focus-backdrop' : ''}`} aria-label="專注結束">
    {!retainFocusBackdrop && <LobbyStage
      handoffOnUnmount
      sceneKey={map.sceneKey ?? 'area-01-cloud-ruins'}
      nodeId={map.nodeId ?? null}
      progressSeconds={complete ? Math.max(map.exploredSeconds, map.targetSeconds) : map.exploredSeconds}
      targetSeconds={map.targetSeconds}
      seed={seed}
      routes={[]}
      hoverKey={null}
      view={CLOSE_VIEW}
      findKeys={[]}
      coreTaken={coreOwned}
      worldMarks={worldMarks}
      onAnchors={noop}
      syncChromeRef={syncChromeRef}
    />}
    <div className="af-veil" aria-hidden="true" />

    <ol className="af-steps" aria-label="步驟">
      {steps.map((step) => <li key={step.key} aria-current={step.key === onStep ? 'step' : undefined} className={step.key === onStep ? 'now' : ''}>{step.label}</li>)}
    </ol>

    {onStep === 'task' && model.task ? <div className="af-column af-enter" key="task">
      <div className="af-card af-question">
        <p className="la-label">專注 {duration(model.effectiveSeconds)}</p>
        <h1>「{model.task.title}」<br />完成了嗎？</h1>
        <div className="af-answers">
          <button type="button" className="af-answer done" disabled={busy} onClick={() => actions.answerTask(true)}>
            <strong>完成了</strong><span>劃掉，換下一件</span>
          </button>
          <button type="button" className="af-answer" disabled={busy} onClick={() => actions.answerTask(false)}>
            <strong>還沒</strong><span>留在清單最上面，下次接著做</span>
          </button>
        </div>
        <p className="af-next">
          {model.nextTask
            ? <><span className="la-label">完成後的下一件</span><span>{model.nextTask.title}</span>{model.nextTask.routineDays && <em>↻ {model.nextTask.routineDays.map((day) => WEEKDAY_LABEL[day]).join('')}</em>}</>
            : <span className="la-soft">清單上沒有下一件了，可以在大廳再加。</span>}
        </p>
      </div>
    </div> : <div className="af-column af-enter" key="review">
      <header className="af-head">
        {complete ? <><h1>{map.title}走完了</h1><p className="la-soft">累積 {Math.round(map.targetSeconds / 60)} 分鐘 · 五盞燈都亮了</p></>
          : model.resolution === 'partial' ? <><h1>{map.title}</h1><p className="la-soft">已探索 {Math.floor(map.exploredSeconds / 60)} / {Math.round(map.targetSeconds / 60)} 分鐘，下次從這裡接著走</p></>
            : <><h1>這次不到 5 分鐘</h1><p className="la-soft">地圖的進度沒有增加，工作時間已經記下。</p></>}
        <span className="la-lamps af-lamps" aria-label={`已點亮 ${litAfter} 盞，共 5 盞`}>
          {Array.from({ length: 5 }, (_, index) => <i key={index} className={`${index < litAfter ? 'on' : ''}${index >= model.map.litBefore && index < litAfter ? ' fresh' : ''}`} style={{ '--i': index - model.map.litBefore } as React.CSSProperties} />)}
        </span>
      </header>

      {model.finds.map((find, index) => <div key={find.key} className={`af-card af-find kind-${find.kind}`} style={{ '--i': index } as React.CSSProperties}>
        <span className="af-find-icon"><FindIcon find={find} /></span>
        <div><p className="la-label">{FIND_KIND[find.kind]}</p><strong>{find.title}</strong><span className="la-soft">{find.text}</span></div>
      </div>)}

      {model.pendingEvents.map((event, index) => <div key={event.id} className="af-card af-event" style={{ '--i': model.finds.length + index } as React.CSSProperties}>
        <p className="la-label">等你決定</p>
        <p>{event.prompt}</p>
        <div>{event.options.map((option) => <button key={option.id} type="button" disabled={busy} onClick={() => actions.chooseEvent(event.id, option.id)}>{option.label}</button>)}</div>
      </div>)}

      <div className="af-foot">
        <button type="button" className="la-primary compact" autoFocus disabled={busy} onClick={actions.finish}><i aria-hidden="true" />回到{rest}</button>
        <small className="la-soft">{model.pendingEvents.length > 0 ? `沒決定的事會在${rest}等你。` : '這些都會留在行囊與收藏室，之後隨時能再看。'}</small>
      </div>
    </div>}
  </section>
}

const CLOSE_VIEW = { kind: 'close' } as const
function noop(): void { /* the backdrop pins nothing */ }
