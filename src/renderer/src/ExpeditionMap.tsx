import { fullThresholdSeconds } from '../../shared/expedition'
import type { DailyRun, ExpeditionNode, QuestTask, RunRelic } from '../../shared/types'

// Route model for Today's lobby (ExpeditionLobby). Pure functions: which fork is open, which route is
// selected, where the traveller is standing, and whether the selected route can start.

export const NODE_COPY: Record<ExpeditionNode['type'], { icon: string; label: string }> = {
  passage: { icon: '↗', label: '通路' },
  archive: { icon: '▤', label: '檔案室' },
  cache: { icon: '◇', label: '藏物處' },
  detour: { icon: '⌁', label: '岔路' }
}

/** Which way a route leaves the place the traveller is resting in. */
export type LobbyRouteExit = 'exit_high' | 'exit_pines' | 'entry'

export const EXIT_COPY: Record<LobbyRouteExit, { label: string; hint: string }> = {
  exit_high: { label: '高台出口', hint: '從望亭後的石門，走浮空石階上雲' },
  exit_pines: { label: '松林出口', hint: '從松林小島的木柱，沿踏石往下走進雲霧' },
  entry: { label: '霧中踏石', hint: '從入口的踏石走上島' }
}

export function selectedNodeForRun(run: DailyRun | null, nodes: ExpeditionNode[]): ExpeditionNode | undefined {
  if (!run?.selectedNodeId) return undefined
  return nodes.find((node) => node.id === run.selectedNodeId)
}

export function canStartSelectedNode(run: DailyRun | null, node: ExpeditionNode | undefined, task: QuestTask | undefined): boolean {
  return Boolean(
    run
    && node
    && node.id === run.selectedNodeId
    && (node.state === 'selected' || node.state === 'partial')
    && task?.status === 'active'
    && task.steps.some((step) => step.status === 'pending')
  )
}

/** A line of route intel, only when a carried relic actually reveals something. */
export function routeIntel(node: ExpeditionNode, relics: RunRelic[]): string | null {
  const keys = new Set(relics.map((relic) => relic.relicKey))
  if (keys.has('old_oil_lamp') || keys.has('copper_signpost')) return node.environmentHint
  if (keys.has('faded_map')) return `褪色地圖將這裡辨認為「${NODE_COPY[node.type].label}」。`
  if (keys.has('broken_compass')) return `指南針已校正這段 ${node.plannedMinutes} 分鐘的路線。`
  return null
}

export interface LobbyModel {
  selected: ExpeditionNode | undefined
  /** The routes of the current fork, shortest first. */
  candidates: ExpeditionNode[]
  /** The cleared route the traveller rests in; undefined on a fresh day (the traveller is at the entry). */
  anchor: ExpeditionNode | undefined
  clearedCount: number
  /** Saved progress / planned time of the place shown behind the fork. The lobby never advances it. */
  worldProgressSeconds: number
  worldTargetSeconds: number
}

export function lobbyModel(run: DailyRun | null, nodes: ExpeditionNode[]): LobbyModel {
  const selected = selectedNodeForRun(run, nodes)
  const lastCleared = nodes.filter((node) => node.state === 'cleared').sort((a, b) => b.depth - a.depth)[0]
  const parentId = selected?.parentNodeId ?? lastCleared?.id ?? null
  const candidates = run
    ? nodes
      .filter((node) => node.depth === run.depth && node.parentNodeId === parentId && ['available', 'selected', 'partial'].includes(node.state))
      .sort((a, b) => a.plannedMinutes - b.plannedMinutes)
    : []
  const anchor = parentId ? nodes.find((node) => node.id === parentId) : undefined
  const anchorTarget = anchor ? fullThresholdSeconds(anchor.plannedMinutes) : 0
  return {
    selected,
    candidates,
    anchor,
    clearedCount: nodes.filter((node) => node.state === 'cleared').length,
    // A cleared Area is shown after its fifth lamp, at the light it ended in; a fresh day starts at dawn.
    worldProgressSeconds: anchor ? Math.max(anchor.progressSeconds, anchorTarget) : 0,
    worldTargetSeconds: anchor ? anchorTarget : fullThresholdSeconds(selected?.plannedMinutes ?? candidates[0]?.plannedMinutes ?? 25)
  }
}

/** Where a candidate leaves: its saved exit, the entry stones on a fresh day, or unknown (docked marker). */
export function routeExit(node: ExpeditionNode, anchor: ExpeditionNode | undefined): LobbyRouteExit | null {
  if (!anchor) return 'entry'
  return node.departureExitId === 'exit_high' || node.departureExitId === 'exit_pines' ? node.departureExitId : null
}
