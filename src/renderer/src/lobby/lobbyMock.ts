import { useMemo, useState } from 'react'
import type { AfterFocusActions, AfterFocusModel, DepartureModel, DepartureRunningApp, LobbyActions, LobbyRouteOption, LobbyTask, LobbyViewModel, Weekday } from './lobbyTypes'

// Example lobby states for the dev preview (#/qa/lobby-a-<scenario>). The content follows core plan §46
// (map names, items) but every sentence here is sample copy, not a saved result. The reducer below only
// imitates what the back end will do so the screens can be clicked through; it is not the rule source.

export const LOBBY_SCENARIOS = ['start', 'partial', 'choose', 'selected', 'yesterday', 'final', 'returned', 'empty'] as const
export type LobbyScenario = typeof LOBBY_SCENARIOS[number]

const ROUTE_OBSERVATORY: LobbyRouteOption = {
  id: 'route-observatory',
  exit: 'exit_high',
  mapId: 'map-10-refraction-observatory',
  title: '折光觀測台',
  tagline: '旋轉鏡架與星圖桌，有人從道路另一端看著你。',
  details: '天空平台上的鏡架還能轉動。可能會調鏡面、對座標、描下遠方的輪廓。',
  itemHints: [{ itemKey: 'weathered_lens', text: '能辨認這裡的重疊影像' }],
  clueHint: '遺庭的星盤曾指向這個方向',
  coreOwned: false,
  visits: 0
}
const ROUTE_STATION: LobbyRouteOption = {
  id: 'route-station',
  exit: 'exit_pines',
  mapId: 'map-02-moss-station',
  title: '苔痕驛站',
  tagline: '空床位與住宿簿，總有人替下一位旅人留好東西。',
  details: '樹根包圍的山間驛站。可能會查看鞋印、翻住宿簿、整理桌上的物件。',
  itemHints: [],
  clueHint: '可能和那套整理行囊的習慣有關',
  coreOwned: false,
  visits: 1
}
const START_ROUTES: LobbyRouteOption[] = [
  { ...ROUTE_STATION, id: 'route-start-station', exit: 'exit_steps', visits: 0, clueHint: null },
  {
    id: 'route-start-ruins', exit: 'exit_bridge', mapId: 'map-01-cloud-ruins', title: '雲上遺庭',
    tagline: '浮島、大樹與星盤。有人比你更早在這裡休息。',
    details: '沿著踏石走上浮島。可能會查看碑文、打水、觀測星盤。',
    itemHints: [], clueHint: '筆記的第一幅圖就是這裡', coreOwned: false, visits: 0
  }
]

const TODAY: LobbyTask[] = [
  { id: 't-mail', title: '回覆助教的信', note: null, routineId: null, done: true },
  { id: 't-report', title: '整理物理實驗報告的誤差分析', note: '寫完誤差傳遞那一節，附上圖表', routineId: null, done: false },
  { id: 't-german', title: '背 20 個德文單字', note: null, routineId: 'r-german', done: false },
  { id: 't-qm', title: '讀量子力學第 4 章', note: null, routineId: null, done: false },
  { id: 't-ledger', title: '整理這週的記帳', note: null, routineId: 'r-ledger', done: false }
]

function base(): LobbyViewModel {
  return {
    phase: 'choose_route',
    campfireStage: 0,
    seenCampfireStage: false,
    journey: { segment: 2, total: 5, visited: [{ mapId: 'map-01-cloud-ruins', title: '雲上遺庭' }], trackingClue: '樹旁有人用同樣的習慣整理過行囊' },
    map: { mapId: 'map-01-cloud-ruins', title: '雲上遺庭', sceneKey: 'area-01-cloud-ruins', exploredSeconds: 3150, targetSeconds: 3000, coreOwned: false, worldMarks: ['tree_traces_seen'] },
    routes: [ROUTE_OBSERVATORY, ROUTE_STATION],
    selectedRouteId: null,
    bag: [{ key: 'weathered_lens', title: '風化鏡片', use: '辨認重疊的影像，多一種調查方式。', isNew: true, knownCombos: [] }],
    newFinds: [{ key: 'weathered_lens', kind: 'item', title: '風化鏡片', text: '在望遠鏡旁找到的舊鏡片。透過它，重疊的影像會分開。' }],
    pendingEvents: [],
    tasks: { today: TODAY.map((task) => ({ ...task })), yesterday: [], currentTaskId: 't-report' },
    routines: [{ id: 'r-german', title: '背 20 個德文單字', days: [1, 3, 5] }, { id: 'r-ledger', title: '整理這週的記帳', days: [6] }, { id: 'r-lab', title: '實驗課預習', days: [2, 4] }],
    collectionHasNew: false,
    seed: 20260926
  }
}

export function lobbyScenario(name: LobbyScenario): LobbyViewModel {
  const model = base()
  switch (name) {
    case 'start':
      return { ...model, phase: 'journey_start', journey: { segment: 1, total: 5, visited: [], trackingClue: '一份未完成的旅行記錄，第一頁畫著一棵大樹' }, map: { ...model.map, exploredSeconds: 0 }, routes: START_ROUTES, bag: [], newFinds: [] }
    case 'partial':
      return { ...model, phase: 'exploring', journey: { segment: 1, total: 5, visited: [], trackingClue: '一份未完成的旅行記錄，第一頁畫著一棵大樹' }, map: { ...model.map, exploredSeconds: 23 * 60 }, routes: [], bag: [], newFinds: [] }
    case 'selected':
      return { ...model, selectedRouteId: ROUTE_OBSERVATORY.id, newFinds: [], bag: model.bag.map((item) => ({ ...item, isNew: false })), pendingEvents: [{ id: 'ev-astro', prompt: '星盤邊緣多了一道新的刻痕。', options: [{ id: 'rub', label: '拓下來' }, { id: 'note', label: '先記在筆記裡' }] }] }
    case 'yesterday':
      return { ...model, selectedRouteId: ROUTE_OBSERVATORY.id, newFinds: [], tasks: { ...model.tasks, yesterday: [{ id: 'y-qm', title: '讀量子力學第 3 章', note: null, routineId: null, done: false, scheduledDate: '2026-09-25' }, { id: 'y-room', title: '寄出社團活動的場地申請', note: null, routineId: null, done: false, scheduledDate: '2026-09-23' }] } }
    case 'final':
      return { ...model, phase: 'final_ready', journey: { segment: 5, total: 5, visited: ['雲上遺庭', '苔痕驛站', '倒影湖畔', '回聲採石場', '折光觀測台'].map((title, index) => ({ mapId: `m${index}`, title })), trackingClue: '他說樹下還有地方' }, map: { ...model.map, exploredSeconds: 3470 }, routes: [], newFinds: [] }
    case 'returned':
      return { ...model, phase: 'returned', campfireStage: 1, journey: { segment: 1, total: 5, visited: [], trackingClue: '「下一次，記得把那一頁留白。」' }, map: { ...model.map, exploredSeconds: 0 }, routes: [], bag: [], newFinds: [], collectionHasNew: true }
    case 'empty':
      return { ...model, tasks: { today: [], yesterday: [], currentTaskId: null } }
    default:
      return model
  }
}

let nextId = 1

/** Local stand-in for the back end so the preview can be clicked through. */
export function useMockLobby(name: LobbyScenario): [LobbyViewModel, LobbyActions] {
  const [model, setModel] = useState(() => lobbyScenario(name))
  const actions = useMemo<LobbyActions>(() => {
    const update = (change: (current: LobbyViewModel) => LobbyViewModel): void => setModel((current) => withCurrent(change(current)))
    return {
      selectRoute: (routeId) => update((m) => ({ ...m, selectedRouteId: routeId })),
      primary: () => update((m) => m.phase === 'returned' ? { ...m, phase: 'journey_start', routes: START_ROUTES, selectedRouteId: null } : m),
      openCollection: () => update((m) => ({ ...m, collectionHasNew: false })),
      inspectFind: (key) => update((m) => ({ ...m, newFinds: m.newFinds.filter((find) => find.key !== key) })),
      inspectCampfireTrace: (stage) => update((m) => stage === m.campfireStage ? { ...m, seenCampfireStage: true } : m),
      chooseEvent: (eventId) => update((m) => ({ ...m, pendingEvents: m.pendingEvents.filter((event) => event.id !== eventId) })),
      addTask: (title) => update((m) => ({ ...m, tasks: { ...m.tasks, today: [...m.tasks.today, { id: `new-${nextId++}`, title, note: null, routineId: null, done: false }] } })),
      setCurrentTask: (taskId) => update((m) => ({ ...m, tasks: { ...m.tasks, currentTaskId: taskId } })),
      moveTask: (taskId, delta) => update((m) => {
        const list = [...m.tasks.today]; const index = list.findIndex((task) => task.id === taskId); const to = index + delta
        if (index < 0 || to < 0 || to >= list.length) return m
        list.splice(to, 0, list.splice(index, 1)[0])
        return { ...m, tasks: { ...m.tasks, today: list } }
      }),
      removeTask: (taskId) => update((m) => ({ ...m, tasks: { ...m.tasks, today: m.tasks.today.filter((task) => task.id !== taskId) } })),
      moveToToday: (taskIds) => update((m) => ({ ...m, tasks: { ...m.tasks, today: [...m.tasks.today, ...m.tasks.yesterday.filter((task) => taskIds.includes(task.id))], yesterday: m.tasks.yesterday.filter((task) => !taskIds.includes(task.id)) } })),
      deleteAllYesterday: () => update((m) => ({ ...m, tasks: { ...m.tasks, yesterday: [] } })),
      saveRoutine: (routine) => update((m) => ({
        ...m,
        routines: routine.id
          ? m.routines.map((entry) => entry.id === routine.id ? { ...entry, title: routine.title, days: [...routine.days].sort() as Weekday[] } : entry)
          : [...m.routines, { id: `r-${nextId++}`, title: routine.title, days: routine.days }]
      })),
      deleteRoutine: (routineId) => update((m) => ({ ...m, routines: m.routines.filter((routine) => routine.id !== routineId) }))
    }
  }, [])
  return [model, actions]
}

/** The current task falls back to the first unfinished item when it is removed or done. */
function withCurrent(model: LobbyViewModel): LobbyViewModel {
  const open = model.tasks.today.filter((task) => !task.done)
  if (open.some((task) => task.id === model.tasks.currentTaskId)) return model
  return { ...model, tasks: { ...model.tasks, currentTaskId: open[0]?.id ?? null } }
}

// ── Departure and After Focus samples ─────────────────────────────────────────────────────────


export function departureFromLobby(model: LobbyViewModel): DepartureModel | null {
  const task = model.tasks.today.find((entry) => entry.id === model.tasks.currentTaskId && !entry.done)
  if (!task) return null
  const route = model.routes.find((entry) => entry.id === model.selectedRouteId)
  const continuing = model.phase === 'exploring'
  if (!continuing && !route) return null
  return {
    mode: continuing ? 'continue' : 'new',
    mapTitle: continuing ? model.map.title : route!.title,
    exit: continuing ? null : route!.exit,
    exploredSeconds: continuing ? model.map.exploredSeconds : 0,
    targetSeconds: model.map.targetSeconds,
    task,
    otherTasks: model.tasks.today.filter((entry) => !entry.done && entry.id !== task.id),
    phoneRitual: true,
    blockedProcessNames: ['Discord.exe'],
    itemChoice: null
  }
}

export async function sampleRunningApps(): Promise<DepartureRunningApp[]> {
  await new Promise((resolve) => setTimeout(resolve, 300))
  return [
    { processName: 'Discord.exe', displayName: 'Discord' },
    { processName: 'chrome.exe', displayName: 'Google Chrome' },
    { processName: 'LINE.exe', displayName: 'LINE' },
    { processName: 'Steam.exe', displayName: 'Steam' }
  ]
}

export const AFTER_SCENARIOS = ['task', 'complete', 'partial', 'short'] as const
export type AfterScenario = typeof AFTER_SCENARIOS[number]

export function afterScenario(name: AfterScenario): AfterFocusModel {
  const base: AfterFocusModel = {
    step: 'review',
    effectiveSeconds: 52 * 60,
    task: { id: 't-report', title: '整理物理實驗報告的誤差分析' },
    nextTask: { id: 't-german', title: '背 20 個德文單字', routineDays: [1, 3, 5] },
    map: { title: '雲上遺庭', exploredSeconds: 3000 + 120, targetSeconds: 3000, litBefore: 2 },
    resolution: 'complete',
    finds: [
      { key: 'weathered_lens', kind: 'item', title: '風化鏡片', text: '在望遠鏡旁找到的舊鏡片。透過它，重疊的影像會分開。' },
      { key: 'clue-tree', kind: 'clue', title: '樹下的使用痕跡', text: '大樹旁的草被壓出和旅人一樣的形狀，有人用同樣的習慣整理過行囊。' }
    ],
    pendingEvents: [{ id: 'ev-astro', prompt: '星盤邊緣多了一道新的刻痕。', options: [{ id: 'rub', label: '拓下來' }, { id: 'note', label: '先記在筆記裡' }] }]
  }
  switch (name) {
    case 'task': return { ...base, step: 'task' }
    case 'partial': return { ...base, effectiveSeconds: 23 * 60, map: { ...base.map, exploredSeconds: 23 * 60, litBefore: 0 }, resolution: 'partial', finds: [], pendingEvents: [] }
    case 'short': return { ...base, effectiveSeconds: 3 * 60, map: { ...base.map, exploredSeconds: 23 * 60, litBefore: 2 }, resolution: 'too_short', finds: [], pendingEvents: [] }
    default: return base
  }
}

export function useMockAfter(name: AfterScenario, onFinish: () => void): [AfterFocusModel, AfterFocusActions] {
  const [model, setModel] = useState(() => afterScenario(name))
  const actions = useMemo<AfterFocusActions>(() => ({
    answerTask: () => setModel((m) => ({ ...m, step: 'review' })),
    chooseEvent: (eventId) => setModel((m) => ({ ...m, pendingEvents: m.pendingEvents.filter((event) => event.id !== eventId) })),
    finish: onFinish
  }), [onFinish])
  return [model, actions]
}
