import type { AppSnapshot, ExpeditionNode, SpecialFindAcquisition } from '../../../shared/types'
import type { ListTask } from '../../../shared/taskList'
import { FOREST_MAP_ID, MOSS_MAP_ID, LAKE_MAP_ID, NURSERY_MAP_ID, dueLampCount } from '../../../shared/specialFinds'
import { RUN_RELICS } from '../../../shared/expedition'
import { HIDDEN_PLACES, JOURNEY_ITEM_LABELS, MAP_JOURNEY_ITEMS } from '../../../shared/collectionRoom'
import type { AfterFocusModel, DepartureModel, LobbyNewFind, LobbyPendingEvent, LobbyTask, LobbyViewModel, Weekday } from './lobbyTypes'

// Projection only: no random draws, awards, progress writes or fabricated future maps.
const completed = (node: ExpeditionNode): boolean => ['awaiting_reward', 'awaiting_route', 'cleared'].includes(node.state)
const taskModel = (task: ListTask): LobbyTask => ({
  id: task.id, title: task.title, note: null, routineId: task.routineId,
  done: task.completed, scheduledDate: task.scheduledDate
})
// Permanent map cores (雲上遺庭's astrolabe core, 苔痕驛站's cracked compass); everything else is a journey keepsake.
const CORE_ITEMS = new Set(['astrolabe_core', 'cracked_compass', 'lake_mirror', 'sealed_seed_pod'])
const isCore = (itemKey: string): boolean => CORE_ITEMS.has(itemKey)
const findModel = (find: SpecialFindAcquisition): LobbyNewFind => ({
  key: find.id, kind: isCore(find.itemKey) ? 'core' : 'item', title: find.title,
  text: isCore(find.itemKey) ? '已放進永久收藏，之後回到這裡也會保留。' : '已收進這趟旅程的行囊。'
})
// Which Area a node draws, its map identity (cores, marks, visits) and its default title.
const areaOf = (node: ExpeditionNode | undefined) => node?.areaId === NURSERY_MAP_ID ? {sceneKey:NURSERY_MAP_ID,mapId:NURSERY_MAP_ID,title:'玻璃苗圃'} : node?.areaId === LAKE_MAP_ID
  ? { sceneKey: LAKE_MAP_ID, mapId: LAKE_MAP_ID, title: '倒影湖畔' } : node?.areaId === 'area-02-moss-station'
  ? { sceneKey: 'area-02-moss-station' as const, mapId: MOSS_MAP_ID, title: '苔痕驛站' }
  : { sceneKey: 'area-01-cloud-ruins' as const, mapId: FOREST_MAP_ID, title: '雲上遺庭' }
const routeExit = (node: ExpeditionNode) => node.nurseryExitId ?? (node as ExpeditionNode & { lakeExitId?: import('../../../shared/area03').LakeExit | null }).lakeExitId ?? node.mossExitId ?? node.departureExitId ?? (node.parentNodeId === null
  ? areaOf(node).mapId === FOREST_MAP_ID ? 'exit_bridge' : 'exit_steps' : null)

export function selectedNode(snapshot: AppSnapshot): ExpeditionNode | undefined {
  return snapshot.expeditionNodes.find((node) => node.id === snapshot.todayRun?.selectedNodeId)
}

// Older 25/90-minute maps can still have an unchosen legacy reward. Use the
// supplied event-choice presentation rather than silently pick a reward or strand the save.
export function pendingLobbyEvents(snapshot: AppSnapshot): LobbyPendingEvent[] {
  return snapshot.expeditionNodes.filter((node) => node.state === 'awaiting_reward').map((node) => ({
    id: node.id, prompt: '這段舊旅程還有一件物品可以帶走。',
    options: node.rewardOptions.map((key) => ({ id: key, label: RUN_RELICS[key as keyof typeof RUN_RELICS]?.title ?? key }))
  }))
}

export function lobbyFromSnapshot(snapshot: AppSnapshot, preferredTaskId: string | null = null): LobbyViewModel {
  const node = selectedNode(snapshot)
  // A selected next route still shows the previous map's rest spot until departure.
  const parent = snapshot.expeditionNodes.find((entry) => entry.id === node?.parentNodeId)
  const continuing = Boolean(node && (node.state === 'partial' || node.state === 'active'))
  const current = continuing || (node && completed(node)) ? node : parent
  const pendingReward = node?.state === 'awaiting_reward'
  const routes = continuing || pendingReward ? [] : node && completed(node)
    ? snapshot.expeditionNodes.filter((entry) => entry.parentNodeId === node.id && entry.state === 'available')
    : snapshot.expeditionNodes.filter((entry) => entry.depth === (node?.depth ?? 0) && entry.parentNodeId === (node?.parentNodeId ?? null) && ['selected', 'available'].includes(entry.state))
  const here = areaOf(current ?? node)
  const owned = snapshot.mapCores.some((core) => core.mapId === here.mapId)
  const unread = snapshot.specialFinds.filter((find) => !snapshot.seenFindIds.includes(find.id))
  const today = snapshot.taskList.today.map(taskModel)
  const currentTaskId = today.some((task) => task.id === preferredTaskId && !task.done) ? preferredTaskId : snapshot.taskList.nextTaskId
  const visited = snapshot.expeditionNodes.filter(completed).sort((a, b) => a.depth - b.depth)
  const hasMet = snapshot.worldMarks.some((mark) => mark.mapId === 'campfire-start' && mark.mark === 'future_self_met')
  const coreCount = snapshot.mapCores.length
  const campfireStage = !hasMet ? 0 : coreCount === 0 ? 1 : coreCount < 4 ? 2 : coreCount < 7 ? 3 : coreCount < 10 ? 4 : 4
  const trackedPlace = HIDDEN_PLACES.find((place) => place.id === snapshot.collection.trackingPlaceId)
  return {
    phase: continuing ? 'exploring' : current && completed(current) ? 'choose_route' : 'journey_start',
    campfireStage,
    seenCampfireStage: snapshot.seenFindIds.includes(`campfire-stage-${campfireStage}`),
    journey: { segment: (node?.depth ?? 0) + (node && completed(node) ? 2 : 1), total: 5,
      visited: visited.map((entry) => ({ mapId: areaOf(entry).mapId, title: entry.title })), trackingClue: trackedPlace ? `追查中 · ${trackedPlace.title}` : null },
    map: { mapId: here.mapId, title: current?.title ?? node?.title ?? here.title, sceneKey: here.sceneKey, nodeId: (current ?? node)?.id ?? null,
      exploredSeconds: current?.progressSeconds ?? 0, targetSeconds: (current?.plannedMinutes ?? node?.plannedMinutes ?? 50) * 60,
      coreOwned: owned, worldMarks: snapshot.worldMarks.filter((mark) => mark.mapId === here.mapId).map((mark) => mark.mark) },
    routes: routes.map((entry) => {
      const to = areaOf(entry)
      return {
        id: entry.id, targetSeconds: entry.plannedMinutes * 60, exit: routeExit(entry), mapId: to.mapId, title: entry.title,
        tagline: entry.description, details: `${entry.environmentHint}（${entry.plannedMinutes} 分鐘）`,
        itemHints: [], clueHint: null, coreOwned: snapshot.mapCores.some((core) => core.mapId === to.mapId),
        visits: snapshot.mapVisits.find((map) => map.mapId === to.mapId)?.completed ?? 0
      }
    }),
    selectedRouteId: node && !completed(node) ? node.id : null,
    bag: Array.from(new Set(snapshot.specialFinds.filter((find) => !isCore(find.itemKey)).map((find) => find.itemKey))).map((key) => {
      const found = snapshot.specialFinds.find((find) => find.itemKey === key)!
      return { key, title: found.title, use: '這趟旅程帶著的信物。', isNew: unread.some((find) => find.itemKey === key), knownCombos: [] }
    }),
    newFinds: [...unread.map(findModel), ...[...snapshot.mossDiscoveries, ...(snapshot.cloudDiscoveries ?? []), ...(snapshot.lakeDiscoveries ?? [])].filter(discovery => !snapshot.seenFindIds.includes(discovery.id))
      .map((discovery): LobbyNewFind => ({ key: discovery.id, kind: 'clue', title: discovery.title, text: discovery.text }))],
    pendingEvents: pendingLobbyEvents(snapshot),
    tasks: { today, yesterday: snapshot.taskList.yesterday.map(taskModel), currentTaskId },
    routines: snapshot.taskList.routines.filter((routine) => routine.enabled).map((routine) => ({ id: routine.id, title: routine.title, days: routine.weekdays as Weekday[] })),
    collectionHasNew: snapshot.mapCores.some((core) => !snapshot.collection.presentedCoreMapIds.includes(core.mapId)) ||
      snapshot.collection.clues.some((clue) => !clue.pinnedAt), seed: snapshot.todayRun?.seed ?? 1
  }
}

export function departureFromSnapshot(snapshot: AppSnapshot, preferredTaskId: string | null): DepartureModel | null {
  const node = selectedNode(snapshot)
  const lobby = lobbyFromSnapshot(snapshot, preferredTaskId)
  const task = lobby.tasks.today.find((entry) => entry.id === lobby.tasks.currentTaskId && !entry.done)
  if (!node || !task || !['selected', 'partial'].includes(node.state)) return null
  const map = areaOf(node)
  const itemKeys = MAP_JOURNEY_ITEMS[map.mapId]
  const coreOwned = snapshot.mapCores.some((core) => core.mapId === map.mapId)
  const tracked = HIDDEN_PLACES.find((place) => place.id === snapshot.collection.trackingPlaceId)
  const trackedItem = itemKeys?.find((itemKey) => tracked?.requiredItems.includes(itemKey)) ?? null
  const coreTitles: Record<string, string> = { [FOREST_MAP_ID]: '星盤核心', [MOSS_MAP_ID]: '裂痕羅盤', [LAKE_MAP_ID]: '湖鏡', [NURSERY_MAP_ID]:'封存種莢' }
  return {
    mode: node.state === 'partial' ? 'continue' : 'new', mapTitle: node.title, exit: routeExit(node),
    exploredSeconds: node.progressSeconds, targetSeconds: node.plannedMinutes * 60, task,
    otherTasks: lobby.tasks.today.filter((entry) => !entry.done && entry.id !== task.id),
    phoneRitual: snapshot.settings.phoneRitual,
    blockedProcessNames: snapshot.blockRules.filter((rule) => rule.enabled).map((rule) => rule.processName),
    itemChoice: node.state === 'selected' && coreOwned && itemKeys ? {
      coreTitle: coreTitles[map.mapId] ?? '地圖核心', defaultItemKey: trackedItem,
      options: itemKeys.map((itemKey) => ({ itemKey, title: JOURNEY_ITEM_LABELS[itemKey] ?? itemKey,
        trackedPlaceTitle: tracked?.requiredItems.includes(itemKey) ? tracked.title : null }))
    } : null
  }
}

export function afterFocusFromSnapshot(snapshot: AppSnapshot): AfterFocusModel | null {
  const pending = snapshot.pendingDebrief
  if (!pending) return null
  const session = snapshot.recentSessions.find((entry) => entry.id === pending.sessionId)
  const node = snapshot.expeditionNodes.find((entry) => entry.id === pending.nodeId)
  const task = snapshot.tasks.find((entry) => entry.id === session?.taskId)
  const next = snapshot.taskList.today.find((entry) => !entry.completed && entry.id !== session?.taskId)
  const routine = snapshot.taskList.routines.find((entry) => entry.id === next?.routineId)
  const before = Math.max(0, pending.progressSeconds - (pending.resolution === 'too_short' ? 0 : pending.effectiveSeconds))
  return {
    step: pending.outcome === null ? 'task' : 'review', effectiveSeconds: pending.effectiveSeconds,
    task: session ? { id: session.taskId, title: task?.title ?? session.taskTitle ?? '這次的事項' } : null,
    nextTask: next ? { id: next.id, title: next.title, routineDays: routine ? routine.weekdays as Weekday[] : null } : null,
    map: { title: node?.title ?? areaOf(node).title, sceneKey: areaOf(node).sceneKey, nodeId: node?.id ?? null,
      exploredSeconds: pending.progressSeconds, targetSeconds: pending.thresholdSeconds,
      litBefore: dueLampCount(before, node?.plannedMinutes ?? 50) },
    resolution: pending.resolution === 'full' ? 'complete' : pending.resolution,
    finds: snapshot.specialFinds.filter((find) => find.sessionId === pending.sessionId).map(findModel),
    pendingEvents: pendingLobbyEvents(snapshot)
  }
}
