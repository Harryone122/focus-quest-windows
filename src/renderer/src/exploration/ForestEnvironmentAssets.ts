import type { DaylightSceneKey } from './DaylightCycle'

export const FOREST_ASSET_WIDTH = 1672
export const FOREST_ASSET_HEIGHT = 941

export const FOREST_CANOPY_IDS = [
  'tree_canopy_bottom_foreground',
  'tree_canopy_center',
  'tree_canopy_left_foreground',
  'tree_canopy_midleft',
  'tree_canopy_right_foreground',
  'tree_canopy_upper_right'
] as const

export const FOREST_GRASS_IDS = [
  'grass_astrolabe_west',
  'grass_astrolabe_east',
  'grass_left_ruins',
  'grass_center_path_west',
  'grass_center_path_east',
  'grass_archive_arch_base',
  'grass_right_upper_path',
  'grass_bridge_edge',
  'grass_lower_left_stairs'
] as const

export const FOREST_VINE_IDS = [
  'vines_west',
  'vines_astrolabe',
  'vines_center_bridge',
  'vines_archive_arch',
  'vines_east',
  'vines_lower_stairs'
] as const

export const FOREST_VEGETATION_IDS = [
  ...FOREST_CANOPY_IDS,
  ...FOREST_GRASS_IDS,
  ...FOREST_VINE_IDS
] as const

export type ForestVegetationId = typeof FOREST_VEGETATION_IDS[number]

export const FOREST_WIND_PROTOTYPE_IDS = [
  'grass_path_tuft',
  'vine_lower_stair_strand',
  'canopy_center_edge'
] as const

export type ForestWindPrototypeId = typeof FOREST_WIND_PROTOTYPE_IDS[number]
export type ForestWindPrototypeKind = 'grass' | 'vine' | 'canopy'

export interface ForestAssetBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface ForestPhaseAssetUrls {
  background: string
  vegetation: Record<ForestVegetationId, string>
  windPrototype: Record<ForestWindPrototypeId, string>
  fogFar: string
  fogMid: string
  fogNear: string
  leaves: string
}

const v2Files = import.meta.glob([
  '../assets/forest-dynamic-v2/**/*.png',
  '!../assets/forest-dynamic-v2/*/vegetation/*.png'
], {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

const v3Files = import.meta.glob('../assets/forest-life-v3/*/atmosphere/fog_mid.png', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

const windPrototypeFiles = import.meta.glob('../assets/forest-wind-prototype-v1/**/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

const files = { ...v2Files, ...v3Files, ...windPrototypeFiles }

function assetUrl(suffix: string): string {
  const normalized = suffix.replaceAll('\\', '/')
  const match = Object.entries(files).find(([path]) => path.replaceAll('\\', '/').endsWith(normalized))
  if (!match) throw new Error(`Missing forest environment asset: ${suffix}`)
  return match[1]
}

function vegetationUrls(phase: DaylightSceneKey): Record<ForestVegetationId, string> {
  return Object.fromEntries(FOREST_VEGETATION_IDS.map((id) => [
    id,
    assetUrl(`/forest-wind-prototype-v1/${phase}/vegetation/${id}.png`)
  ])) as Record<ForestVegetationId, string>
}

function windPrototypeUrls(phase: DaylightSceneKey): Record<ForestWindPrototypeId, string> {
  return Object.fromEntries(FOREST_WIND_PROTOTYPE_IDS.map((id) => [
    id,
    assetUrl(`/forest-wind-prototype-v1/${phase}/prototype/${id}.png`)
  ])) as Record<ForestWindPrototypeId, string>
}

function phaseAssets(phase: DaylightSceneKey): ForestPhaseAssetUrls {
  return {
    background: assetUrl(`/forest-dynamic-v2/static/${phase}.png`),
    vegetation: vegetationUrls(phase),
    windPrototype: windPrototypeUrls(phase),
    fogFar: assetUrl(`/forest-dynamic-v2/${phase}/atmosphere/fog_far.png`),
    fogMid: assetUrl(`/forest-life-v3/${phase}/atmosphere/fog_mid.png`),
    fogNear: assetUrl(`/forest-dynamic-v2/${phase}/atmosphere/fog_near.png`),
    leaves: assetUrl(`/forest-dynamic-v2/${phase}/atmosphere/leaf_atlas.png`)
  }
}

export const FOREST_PHASE_ASSETS: Record<DaylightSceneKey, ForestPhaseAssetUrls> = {
  morning: phaseAssets('morning'),
  noon: phaseAssets('noon'),
  afternoon: phaseAssets('afternoon'),
  night: phaseAssets('night')
}

export const FOREST_SHADOW_ASSETS = {
  architecture: assetUrl('/forest-dynamic-v2/shadow/shadow_architecture.png'),
  foliage: assetUrl('/forest-dynamic-v2/shadow/shadow_foliage.png')
} as const

export const FOREST_ASSET_BOUNDS: Record<ForestVegetationId | 'fog_far' | 'fog_mid' | 'fog_near' | 'shadow_architecture' | 'shadow_foliage', ForestAssetBounds> = {
  tree_canopy_bottom_foreground: { x: 700, y: 600, width: 972, height: 341 },
  tree_canopy_center: { x: 560, y: 70, width: 420, height: 410 },
  tree_canopy_left_foreground: { x: 0, y: 0, width: 500, height: 560 },
  tree_canopy_midleft: { x: 300, y: 44, width: 420, height: 396 },
  tree_canopy_right_foreground: { x: 1430, y: 420, width: 242, height: 440 },
  tree_canopy_upper_right: { x: 1260, y: 0, width: 325, height: 250 },
  grass_astrolabe_west: { x: 307, y: 261, width: 164, height: 245 },
  grass_astrolabe_east: { x: 471, y: 262, width: 265, height: 289 },
  grass_left_ruins: { x: 15, y: 539, width: 316, height: 107 },
  grass_center_path_west: { x: 599, y: 402, width: 247, height: 200 },
  grass_center_path_east: { x: 846, y: 294, width: 270, height: 318 },
  grass_archive_arch_base: { x: 974, y: 110, width: 317, height: 400 },
  grass_right_upper_path: { x: 1291, y: 0, width: 379, height: 466 },
  grass_bridge_edge: { x: 1116, y: 466, width: 556, height: 385 },
  grass_lower_left_stairs: { x: 0, y: 575, width: 723, height: 366 },
  vines_west: { x: 67, y: 344, width: 294, height: 317 },
  vines_astrolabe: { x: 361, y: 153, width: 348, height: 473 },
  vines_center_bridge: { x: 667, y: 250, width: 344, height: 661 },
  vines_archive_arch: { x: 982, y: 108, width: 319, height: 593 },
  vines_east: { x: 1260, y: 29, width: 389, height: 762 },
  vines_lower_stairs: { x: 74, y: 626, width: 566, height: 315 },
  fog_far: { x: 0, y: 0, width: 1672, height: 941 },
  fog_mid: { x: 0, y: 0, width: 1672, height: 941 },
  fog_near: { x: 0, y: 303, width: 1672, height: 638 },
  shadow_architecture: { x: 0, y: 41, width: 1672, height: 900 },
  shadow_foliage: { x: 0, y: 21, width: 1672, height: 920 }
}

export interface ForestWindPrototypeDefinition extends ForestAssetBounds {
  id: ForestWindPrototypeId
  kind: ForestWindPrototypeKind
  columns: number
  rows: number
  phaseOffset: number
  tipDisplacement: number
  depth: number
  anchorX: number
  anchorY: number
}

export const FOREST_WIND_PROTOTYPES: readonly ForestWindPrototypeDefinition[] = [
  { id: 'grass_path_tuft', kind: 'grass', x: 1015, y: 466, width: 72, height: 51, columns: 6, rows: 4, phaseOffset: 0.15, tipDisplacement: 3.2, depth: 70.52, anchorX: 0.5, anchorY: 1 },
  { id: 'vine_lower_stair_strand', kind: 'vine', x: 344, y: 792, width: 42, height: 136, columns: 3, rows: 8, phaseOffset: 0.72, tipDisplacement: 5.2, depth: 71.64, anchorX: 0.5, anchorY: 0 },
  { id: 'canopy_center_edge', kind: 'canopy', x: 832, y: 160, width: 150, height: 88, columns: 7, rows: 5, phaseOffset: 1.24, tipDisplacement: 3.6, depth: 68.2, anchorX: 0.88, anchorY: 0.92 }
]

export const FOREST_VEGETATION_PIVOTS: Record<ForestVegetationId, { x: number; y: number }> = {
  tree_canopy_left_foreground: { x: 86, y: 430 },
  tree_canopy_midleft: { x: 552, y: 340 },
  tree_canopy_center: { x: 742, y: 392 },
  tree_canopy_right_foreground: { x: 1604, y: 650 },
  tree_canopy_bottom_foreground: { x: 1180, y: 925 },
  tree_canopy_upper_right: { x: 1415, y: 155 },
  grass_astrolabe_west: { x: 389, y: 505 },
  grass_astrolabe_east: { x: 603.5, y: 550 },
  grass_left_ruins: { x: 173, y: 645 },
  grass_center_path_west: { x: 722.5, y: 601 },
  grass_center_path_east: { x: 981, y: 611 },
  grass_archive_arch_base: { x: 1132.5, y: 509 },
  grass_right_upper_path: { x: 1480.5, y: 465 },
  grass_bridge_edge: { x: 1394, y: 850 },
  grass_lower_left_stairs: { x: 361.5, y: 940 },
  vines_west: { x: 214, y: 345 },
  vines_astrolabe: { x: 535, y: 154 },
  vines_center_bridge: { x: 839, y: 251 },
  vines_archive_arch: { x: 1141.5, y: 109 },
  vines_east: { x: 1454.5, y: 30 },
  vines_lower_stairs: { x: 357, y: 627 }
}

export function forestBackgroundTextureKey(phase: DaylightSceneKey): string {
  return `forest-dynamic-background-${phase}`
}

export function forestVegetationTextureKey(phase: DaylightSceneKey, id: ForestVegetationId): string {
  return `forest-dynamic-${phase}-${id}`
}

export function forestWindPrototypeTextureKey(phase: DaylightSceneKey, id: ForestWindPrototypeId): string {
  return `forest-wind-prototype-${phase}-${id}`
}

export function forestAtmosphereTextureKey(phase: DaylightSceneKey, id: 'fogFar' | 'fogMid' | 'fogNear' | 'leaves'): string {
  return `forest-dynamic-${phase}-${id}`
}

export function forestShadowTextureKey(id: 'architecture' | 'foliage'): string {
  return `forest-dynamic-shadow-${id}`
}
