import { useEffect, useRef, useState } from 'react'
import type { AppSnapshot, FocusSession } from '../../../shared/types'
import { DELETE_YESTERDAY_CONFIRMATION } from '../../../shared/taskList'
import { LobbyA } from './LobbyA'
import { DepartureSheet } from './DepartureSheet'
import { FocusRecap } from './FocusRecap'
import { afterFocusFromSnapshot, departureFromSnapshot, lobbyFromSnapshot, selectedNode } from './fromSnapshot'
import type { DepartureInput, LobbyActions } from './lobbyTypes'

interface Props {
  snapshot: AppSnapshot
  onChanged: (snapshot: AppSnapshot) => void
  onError: (message: string) => void
}
const message = (error: unknown): string => (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': Error: /, '')

function useMutation({ onChanged, onError }: Props) {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const run = async (operation: () => Promise<AppSnapshot>): Promise<void> => {
    if (lock.current) { onError('上一個操作正在保存，請稍後再試。'); return }
    lock.current = true
    setBusy(true)
    try { onChanged(await operation()) } catch (error) { onError(message(error)) }
    finally { lock.current = false; setBusy(false) }
  }
  return { run, busy }
}

export function ConnectedLobby(props: Props & { onAllTasks: () => void; active?: boolean; departureSession?: FocusSession | null; onDepartureComplete?: () => void }): React.JSX.Element {
  const { snapshot, onChanged, onError, onAllTasks, active = true, departureSession, onDepartureComplete } = props
  const [currentTask, setCurrentTask] = useState<string | null>(null)
  const [departure, setDeparture] = useState(false)
  const [caretakerPlaying,setCaretakerPlaying]=useState(false)
  useEffect(()=>{if(!caretakerPlaying)return;const t=window.setTimeout(()=>setCaretakerPlaying(false),65000);const done=()=>setCaretakerPlaying(false);window.addEventListener('focusquest:nursery-transplant-done',done);return()=>{clearTimeout(t);window.removeEventListener('focusquest:nursery-transplant-done',done)}},[caretakerPlaying])
  const { run, busy } = useMutation(props)
  const preparing = useRef<string | null>(null)
  const nextTaskId = snapshot.taskList.nextTaskId
  // The legacy schema requires a task FK when creating a journey. Prepare its
  // persisted route pair once a real task exists, never a mock/placeholder task.
  useEffect(() => {
    if (snapshot.todayRun || !nextTaskId || preparing.current === nextTaskId) return
    preparing.current = nextTaskId
    void run(() => window.focusQuest.startDailyRun(nextTaskId))
  }, [snapshot.todayRun?.id, nextTaskId])
  const model = lobbyFromSnapshot(snapshot, currentTask)
  const departureModel = departureFromSnapshot(snapshot, currentTask)
  const actions: LobbyActions = {
    selectRoute: (id) => void run(async () => {
      const node = selectedNode(snapshot)
      if (!snapshot.todayRun) throw new Error('請先加入今天要做的事。')
      return node?.state === 'awaiting_route'
        ? window.focusQuest.chooseNextRoute(snapshot.todayRun.id, node.id, id)
        : window.focusQuest.selectExpeditionNode(snapshot.todayRun.id, id)
    }),
    primary: () => { if (departureModel) setDeparture(true) },
    openCollection: () => undefined,
    inspectFind: (id) => void run(() => window.focusQuest.inspectLobbyFind(id)),
    inspectCampfireTrace: (stage) => void run(() => window.focusQuest.inspectCampfireTrace(stage)),
    chooseEvent: (nodeId, key) => void run(() => window.focusQuest.chooseRunRelic(snapshot.todayRun!.id, nodeId, key)),
    addTask: (title) => void run(async () => {
      const next = await window.focusQuest.addListTask({ title })
      return next.todayRun ? next : window.focusQuest.startDailyRun(next.taskList.nextTaskId!)
    }),
    setCurrentTask,
    moveTask: (id, delta) => void run(async () => {
      const ids = snapshot.taskList.today.filter((task) => !task.completed).map((task) => task.id)
      const index = ids.indexOf(id), to = index + delta
      if (index < 0 || to < 0 || to >= ids.length) return snapshot
      ;[ids[index], ids[to]] = [ids[to], ids[index]]
      return window.focusQuest.reorderTodayTasks(snapshot.taskList.localDay, ids)
    }),
    removeTask: (id) => void run(() => window.focusQuest.deleteListTask(id)),
    moveToToday: (ids) => void run(() => window.focusQuest.moveTasksToToday(ids)),
    deleteAllYesterday: () => void run(() => window.focusQuest.deleteYesterdayTasks({
      localDay: snapshot.taskList.localDay, taskIds: snapshot.taskList.yesterday.map((task) => task.id), confirmation: DELETE_YESTERDAY_CONFIRMATION
    })),
    saveRoutine: (input) => void run(() => {
      const list = snapshot.taskList.routines.map((routine) => routine.id === input.id
        ? { ...routine, title: input.title, weekdays: input.days, enabled: true } : routine)
      return window.focusQuest.saveRoutines(input.id ? list : [...list, { title: input.title, weekdays: input.days, enabled: true }])
    }),
    deleteRoutine: (id) => void run(() => window.focusQuest.saveRoutines(snapshot.taskList.routines.filter((routine) => routine.id !== id)))
  }
  const depart = async (input: DepartureInput): Promise<void> => {
    const node = selectedNode(snapshot)
    if (!snapshot.todayRun || !node) throw new Error('路線已更新，請重新選擇。')
    await window.focusQuest.saveBlockRules(input.blockedApps)
    const next = await window.focusQuest.startListFocus({ taskId: input.taskId, minimumMinutes: input.minimumMinutes,
      blockedProcessNames: input.blockedApps.map((app) => app.processName), runId: snapshot.todayRun.id, nodeId: node.id, plannedMinutes: node.plannedMinutes,
      requestedJourneyItem: input.requestedJourneyItem })
    setDeparture(false)
    onChanged(next)
  }
  const take=snapshot.caretaker?.takeNodeId,transplant=snapshot.caretaker?.transplantNodeId
  const caretakerChoice=(nodeId:string,choice:'take'|'leave'|'transplant'|'wait')=>void run(async()=>{const next=await window.focusQuest.chooseCaretaker(nodeId,choice);if(choice==='transplant'){const state=await window.focusQuest.getNurseryScene(nodeId);setCaretakerPlaying(true);window.setTimeout(()=>window.dispatchEvent(new CustomEvent('focusquest:nursery-transplant',{detail:{nodeId,state}})),100)}return next})
  const caretakerOverlay=(take||transplant||caretakerPlaying)&&!snapshot.pendingDebrief ? <div className="departure-sheet-backdrop" style={{position:'absolute',inset:0,zIndex:20,pointerEvents:caretakerPlaying?'none':'auto'}}>{!caretakerPlaying&&<section className="departure-sheet" style={{position:'absolute',right:'8%',top:'30%',padding:28,background:'rgba(29,35,27,.94)',borderRadius:18,color:'#f4ecd8'}} role="dialog" aria-modal="true" aria-label="照料者的選擇"><p>{take?'要不要帶走幼苗？':'要把它移出苗盤嗎？'}</p><button disabled={busy} onClick={()=>caretakerChoice((take??transplant)!,take?'take':'transplant')}>{take?'帶走':'移出來'}</button><button disabled={busy} onClick={()=>caretakerChoice((take??transplant)!,take?'leave':'wait')}>{take?'留在這裡':'再讓它長一陣子'}</button></section>}</div> : null
  return <div className={`view-content lobby-a-view${caretakerPlaying?' is-caretaker-playing':''}`}><LobbyA model={model} actions={actions} audioSettings={snapshot.settings} active={active} busy={busy||caretakerPlaying} departureSession={departureSession} onDepartureComplete={onDepartureComplete} onAllTasks={onAllTasks} overlay={caretakerOverlay ?? (departure && departureModel
    ? <DepartureSheet model={departureModel} loadApps={window.focusQuest.listRunningApplications} onConfirm={depart} onCancel={() => setDeparture(false)} /> : null)} /></div>
}

export function ConnectedAfterFocus(props: Props & { onReturned: () => void; retainFocusBackdrop?: boolean }): React.JSX.Element | null {
  const { snapshot, onReturned } = props
  const { run, busy } = useMutation(props)
  const model = afterFocusFromSnapshot(snapshot)
  if (!model || !snapshot.pendingDebrief || !snapshot.todayRun) return null
  const pending = snapshot.pendingDebrief
  return <FocusRecap snapshot={snapshot} model={model} busy={busy} actions={{
    answerTask: (done) => void run(async () => {
      const next=await window.focusQuest.finishListFocus(pending.sessionId, done)
      if(afterFocusFromSnapshot(next)?.pendingEvents.length)return next
      const returned=await window.focusQuest.dismissDebrief(pending.sessionId);onReturned();return returned
    }),
    chooseEvent: (nodeId, key) => void run(() => window.focusQuest.chooseRunRelic(pending.runId, nodeId, key)),
    finish: () => void run(async () => {
      const next = await window.focusQuest.dismissDebrief(pending.sessionId)
      onReturned()
      return next
    })
  }} />
}
