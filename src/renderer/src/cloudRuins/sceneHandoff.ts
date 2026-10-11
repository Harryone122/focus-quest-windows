import type { NurserySceneHandle } from '../glassNursery/glassNurseryScene'
import type { LakeSceneHandle } from '../reflectionLake/reflectionLakeScene'
import type { CloudRuinsSceneHandle } from './cloudRuinsScene'
import type { MossStationSceneHandle } from '../mossStation/mossStationScene'

/** Any Area's scene. 雲上遺庭 handles carry no areaId; newer Areas name themselves. */
export type AreaSceneHandle = CloudRuinsSceneHandle | MossStationSceneHandle | LakeSceneHandle | NurserySceneHandle
export type SceneAreaId = 'area-01-cloud-ruins' | 'area-02-moss-station' | 'area-03-reflection-lake' | 'area-07-glass-nursery'
export const sceneAreaOf = (scene: AreaSceneHandle): SceneAreaId => ('areaId' in scene ? scene.areaId : 'area-01-cloud-ruins')

// One-use ownership transfer during React's cleanup -> setup commit. The old
// owner must not destroy a transferred renderer; the new owner assumes cleanup.
// If no lobby mounts (navigation, an error, closing), release it automatically.
let pending: { scene: AreaSceneHandle; timeout: number } | null = null

export function leaveSceneForLobby(scene: AreaSceneHandle): void {
  if (pending) { window.clearTimeout(pending.timeout); pending.scene.destroy() }
  scene.setPaused(true)
  const entry = { scene, timeout: 0 }
  pending = entry
  entry.timeout = window.setTimeout(() => {
    if (pending !== entry) return
    pending = null
    scene.destroy()
  }, 1000)
}

/** The retained scene, only if it shows the Area the lobby needs; another Area's scene is released. */
export function takeSceneForLobby(area: SceneAreaId = 'area-01-cloud-ruins'): AreaSceneHandle | null {
  if (!pending) return null
  const entry = pending
  pending = null
  window.clearTimeout(entry.timeout)
  if (sceneAreaOf(entry.scene) !== area) { entry.scene.destroy(); return null }
  return entry.scene
}
