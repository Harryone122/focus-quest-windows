import type { CloudRuinsSceneHandle, CloudRuinsSceneOptions } from '../cloudRuins/cloudRuinsScene'
import type { LakeSnapshot, LakeExit } from '../../../shared/area03'
export type LakeSceneHandle = CloudRuinsSceneHandle & {
  areaId: 'area-03-reflection-lake'
  setLakeState(state: LakeSnapshot): void
  qa: Record<string, (...args: any[]) => any>
}
export type LakeSceneOptions = Omit<CloudRuinsSceneOptions, 'departure'> & {
  lake?: LakeSnapshot | null
  departure?: {exit: LakeExit;durationMs: number} | null
  departureElapsedMs?: number
  departureState?:LakeSnapshot|null
}
export function createReflectionLakeScene(host: HTMLElement, options: LakeSceneOptions): LakeSceneHandle
