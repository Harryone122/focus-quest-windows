export type WaypointTag = 'spawn' | 'path' | 'bridge' | 'ruin' | 'clearing' | 'landmark' | 'quiet'
export type InteractionType = 'lamp' | 'treasure' | 'inspect' | 'rest' | 'landmark'
export type ExplorerAnimationKey = 'idle' | 'walk' | 'inspect' | 'pickup' | 'lightLamp' | 'lookAround' | 'rest'
export type AnchorType = 'transit' | 'interaction' | 'scenic' | 'milestone'

export interface SceneAnchorDefinition {
  id: string
  waypointId: string
  purpose: 'entry' | 'exit' | 'rest' | 'landmark'
  label: string
}

export interface OcclusionZoneDefinition {
  id: string
  x: number
  y: number
  width: number
  height: number
  depth: number
  opacity: number
}

export interface DepthZoneDefinition {
  id: string
  minY: number
  maxY: number
  minScale: number
  maxScale: number
}

export interface ShadowCasterDefinition {
  id: string
  kind: 'tree' | 'pillar' | 'arch' | 'astrolabe'
  x: number
  y: number
  width: number
}

export interface WaypointDefinition {
  id: string
  x: number
  y: number
  neighbors: string[]
  tags: WaypointTag[]
  anchorType: AnchorType
  depth: number
  sceneRegion: string
  facingHint?: -1 | 1
}

export interface InteractiveObjectDefinition {
  id: string
  type: InteractionType
  waypointId: string
  state: 'available'
  progressCritical: boolean
  milestoneIndex?: number
  priorityTags: string[]
  animationKey: ExplorerAnimationKey
  activity: string
  facingHint?: -1 | 1
}

export interface ExplorationMapDefinition {
  id: string
  title: string
  backgroundKey: string
  spawnWaypointId: string
  entryAnchor: SceneAnchorDefinition
  exitAAnchor: SceneAnchorDefinition
  exitBAnchor: SceneAnchorDefinition
  restAnchor: SceneAnchorDefinition
  landmarkAnchors: SceneAnchorDefinition[]
  occlusionZones: OcclusionZoneDefinition[]
  depthZones: DepthZoneDefinition[]
  shadowCasters: ShadowCasterDefinition[]
  waypoints: WaypointDefinition[]
  objects: InteractiveObjectDefinition[]
}

// This data mirrors the shape of invisible Tiled object layers. Coordinates are
// normalized so the authored graph survives window sizes and display scaling.
export const FOREST_MAP: ExplorationMapDefinition = {
  id: 'forest-floating-ruins-v1',
  title: '森林浮空遺跡',
  backgroundKey: 'forest-floating-ruins',
  spawnWaypointId: 'forest_entrance',
  entryAnchor: { id: 'entry_southwest', waypointId: 'forest_entrance', purpose: 'entry', label: '西南入口' },
  exitAAnchor: { id: 'exit_northeast', waypointId: 'upper_east_exit', purpose: 'exit', label: '高台出口' },
  exitBAnchor: { id: 'exit_southeast', waypointId: 'lower_east_exit', purpose: 'exit', label: '東側石橋' },
  restAnchor: { id: 'rest_east_overlook', waypointId: 'ruin_overlook', purpose: 'rest', label: '東側望台' },
  landmarkAnchors: [
    { id: 'landmark_astrolabe', waypointId: 'astrolabe_observe', purpose: 'landmark', label: '黃銅星盤' },
    { id: 'landmark_index_tablet', waypointId: 'tablet_read', purpose: 'landmark', label: '索引石碑' },
    { id: 'landmark_archive_arch', waypointId: 'archive_arch', purpose: 'landmark', label: '藤蔓拱門' },
    { id: 'landmark_high_chest', waypointId: 'chest_inspect', purpose: 'landmark', label: '高台箱匣' }
  ],
  // These zones sit over foreground bridge walls and vegetation. They do not
  // invent new geometry; they make the traveller read as being inside the art.
  occlusionZones: [
    { id: 'lower_bridge_wall', x: 0.39, y: 0.585, width: 0.30, height: 0.105, depth: 72, opacity: 0.1 },
    { id: 'archive_arch_vines', x: 0.695, y: 0.34, width: 0.17, height: 0.17, depth: 73, opacity: 0.09 },
    { id: 'high_platform_wall', x: 0.87, y: 0.245, width: 0.24, height: 0.115, depth: 74, opacity: 0.08 },
    { id: 'east_bridge_wall', x: 0.83, y: 0.65, width: 0.25, height: 0.11, depth: 72, opacity: 0.09 }
  ],
  depthZones: [
    { id: 'far_highlands', minY: 0, maxY: 0.34, minScale: 0.86, maxScale: 0.93 },
    { id: 'middle_ruins', minY: 0.34, maxY: 0.62, minScale: 0.93, maxScale: 1 },
    { id: 'near_entry', minY: 0.62, maxY: 1, minScale: 1, maxScale: 1.07 }
  ],
  shadowCasters: [
    { id: 'tree_west', kind: 'tree', x: 0.12, y: 0.45, width: 170 },
    { id: 'tree_center', kind: 'tree', x: 0.5, y: 0.43, width: 150 },
    { id: 'astrolabe', kind: 'astrolabe', x: 0.32, y: 0.39, width: 86 },
    { id: 'archive_arch', kind: 'arch', x: 0.7, y: 0.36, width: 118 },
    { id: 'pillar_west', kind: 'pillar', x: 0.25, y: 0.38, width: 58 },
    { id: 'pillar_east', kind: 'pillar', x: 0.8, y: 0.26, width: 54 }
  ],
  waypoints: [
    { id: 'forest_entrance', x: 0.018, y: 0.87, neighbors: ['departure_desk'], tags: ['spawn', 'path'], anchorType: 'transit', depth: 1.05, sceneRegion: 'lower_entry' },
    { id: 'departure_desk', x: 0.145, y: 0.725, neighbors: ['forest_entrance', 'lower_path'], tags: ['clearing', 'ruin'], anchorType: 'milestone', depth: 1.01, sceneRegion: 'departure_desk', facingHint: -1 },
    { id: 'lower_path', x: 0.215, y: 0.665, neighbors: ['departure_desk', 'lower_fork'], tags: ['path'], anchorType: 'transit', depth: 1, sceneRegion: 'lower_stone_path' },
    { id: 'lower_fork', x: 0.292, y: 0.595, neighbors: ['lower_path', 'west_bridge_entry', 'root_alcove'], tags: ['path', 'clearing'], anchorType: 'milestone', depth: 0.99, sceneRegion: 'lower_fork', facingHint: 1 },
    { id: 'west_bridge_entry', x: 0.345, y: 0.565, neighbors: ['lower_fork', 'west_bridge_mid'], tags: ['bridge', 'path'], anchorType: 'transit', depth: 0.985, sceneRegion: 'lower_bridge' },
    { id: 'west_bridge_mid', x: 0.405, y: 0.525, neighbors: ['west_bridge_entry', 'center_crossing'], tags: ['bridge', 'path'], anchorType: 'scenic', depth: 0.975, sceneRegion: 'lower_bridge', facingHint: 1 },
    { id: 'center_crossing', x: 0.482, y: 0.498, neighbors: ['west_bridge_mid', 'tablet_read', 'broken_rail', 'astrolabe_east_arc'], tags: ['path', 'clearing'], anchorType: 'transit', depth: 0.97, sceneRegion: 'center_crossing' },
    { id: 'tablet_read', x: 0.505, y: 0.45, neighbors: ['center_crossing', 'central_turn'], tags: ['ruin', 'landmark'], anchorType: 'milestone', depth: 0.962, sceneRegion: 'index_tablet', facingHint: -1 },
    { id: 'central_turn', x: 0.566, y: 0.42, neighbors: ['tablet_read', 'arch_path'], tags: ['path', 'clearing'], anchorType: 'transit', depth: 0.95, sceneRegion: 'central_path' },
    { id: 'arch_path', x: 0.625, y: 0.365, neighbors: ['central_turn', 'archive_arch'], tags: ['path', 'ruin'], anchorType: 'transit', depth: 0.94, sceneRegion: 'arch_approach' },
    { id: 'archive_arch', x: 0.696, y: 0.322, neighbors: ['arch_path', 'upper_path'], tags: ['ruin', 'landmark'], anchorType: 'milestone', depth: 0.93, sceneRegion: 'archive_arch', facingHint: 1 },
    { id: 'upper_path', x: 0.773, y: 0.272, neighbors: ['archive_arch', 'high_platform_lamp'], tags: ['path'], anchorType: 'transit', depth: 0.92, sceneRegion: 'upper_stone_path' },
    { id: 'high_platform_lamp', x: 0.835, y: 0.238, neighbors: ['upper_path', 'chest_inspect'], tags: ['ruin', 'landmark'], anchorType: 'milestone', depth: 0.92, sceneRegion: 'high_platform', facingHint: 1 },
    { id: 'chest_inspect', x: 0.885, y: 0.213, neighbors: ['high_platform_lamp', 'upper_east_exit'], tags: ['ruin', 'landmark'], anchorType: 'interaction', depth: 0.91, sceneRegion: 'high_chest', facingHint: 1 },
    { id: 'upper_east_exit', x: 0.992, y: 0.075, neighbors: ['chest_inspect'], tags: ['path', 'landmark'], anchorType: 'transit', depth: 0.87, sceneRegion: 'upper_east_exit', facingHint: 1 },
    { id: 'root_alcove', x: 0.245, y: 0.515, neighbors: ['lower_fork', 'astrolabe_steps'], tags: ['quiet', 'clearing'], anchorType: 'interaction', depth: 0.98, sceneRegion: 'tree_roots', facingHint: -1 },
    { id: 'astrolabe_steps', x: 0.272, y: 0.445, neighbors: ['root_alcove', 'astrolabe_observe'], tags: ['path'], anchorType: 'transit', depth: 0.965, sceneRegion: 'astrolabe_steps' },
    { id: 'astrolabe_observe', x: 0.31, y: 0.418, neighbors: ['astrolabe_steps', 'astrolabe_east_arc'], tags: ['landmark', 'ruin'], anchorType: 'milestone', depth: 0.956, sceneRegion: 'astrolabe_platform', facingHint: -1 },
    { id: 'astrolabe_east_arc', x: 0.39, y: 0.43, neighbors: ['astrolabe_observe', 'center_crossing'], tags: ['path', 'ruin'], anchorType: 'transit', depth: 0.958, sceneRegion: 'astrolabe_exit' },
    { id: 'ruin_overlook', x: 0.722, y: 0.51, neighbors: ['bridge_pause', 'east_bridge_entry'], tags: ['quiet', 'clearing'], anchorType: 'scenic', depth: 0.98, sceneRegion: 'ruin_overlook', facingHint: 1 },
    { id: 'bridge_pause', x: 0.645, y: 0.515, neighbors: ['ruin_overlook', 'broken_rail'], tags: ['bridge', 'quiet'], anchorType: 'scenic', depth: 0.975, sceneRegion: 'broken_bridge', facingHint: 1 },
    { id: 'broken_rail', x: 0.57, y: 0.525, neighbors: ['bridge_pause', 'center_crossing'], tags: ['bridge', 'path'], anchorType: 'interaction', depth: 0.98, sceneRegion: 'broken_rail', facingHint: 1 },
    { id: 'east_bridge_entry', x: 0.758, y: 0.555, neighbors: ['ruin_overlook', 'east_bridge_mid'], tags: ['bridge', 'path'], anchorType: 'transit', depth: 0.99, sceneRegion: 'east_bridge' },
    { id: 'east_bridge_mid', x: 0.81, y: 0.61, neighbors: ['east_bridge_entry', 'east_bridge_lower'], tags: ['bridge', 'path'], anchorType: 'transit', depth: 1, sceneRegion: 'east_bridge' },
    { id: 'east_bridge_lower', x: 0.895, y: 0.745, neighbors: ['east_bridge_mid', 'lower_east_exit'], tags: ['bridge', 'path'], anchorType: 'transit', depth: 1.025, sceneRegion: 'east_bridge_lower' },
    { id: 'lower_east_exit', x: 0.995, y: 0.865, neighbors: ['east_bridge_lower'], tags: ['bridge', 'path', 'landmark'], anchorType: 'transit', depth: 1.05, sceneRegion: 'lower_east_exit', facingHint: 1 }
  ],
  objects: [
    { id: 'lamp_departure', type: 'lamp', waypointId: 'departure_desk', state: 'available', progressCritical: true, milestoneIndex: 0, priorityTags: ['route'], animationKey: 'lightLamp', activity: '在出發桌旁點燈', facingHint: -1 },
    { id: 'lamp_astrolabe', type: 'lamp', waypointId: 'astrolabe_observe', state: 'available', progressCritical: true, milestoneIndex: 1, priorityTags: ['route'], animationKey: 'lightLamp', activity: '在星盤圓台點燈', facingHint: -1 },
    { id: 'lamp_index_stone', type: 'lamp', waypointId: 'tablet_read', state: 'available', progressCritical: true, milestoneIndex: 2, priorityTags: ['route'], animationKey: 'lightLamp', activity: '在石碑旁點燈', facingHint: -1 },
    { id: 'lamp_archive_arch', type: 'lamp', waypointId: 'archive_arch', state: 'available', progressCritical: true, milestoneIndex: 3, priorityTags: ['route'], animationKey: 'lightLamp', activity: '在遺跡入口點燈', facingHint: 1 },
    { id: 'lamp_high_platform', type: 'lamp', waypointId: 'high_platform_lamp', state: 'available', progressCritical: true, milestoneIndex: 4, priorityTags: ['route', 'final'], animationKey: 'lightLamp', activity: '在高台點亮最後一盞燈', facingHint: 1 },

    { id: 'treasure_high_chest', type: 'treasure', waypointId: 'chest_inspect', state: 'available', progressCritical: false, priorityTags: ['discovery', 'chest'], animationKey: 'pickup', activity: '正在查看高台寶箱', facingHint: 1 },
    { id: 'treasure_root_box', type: 'treasure', waypointId: 'root_alcove', state: 'available', progressCritical: false, priorityTags: ['discovery', 'nearby'], animationKey: 'pickup', activity: '正在翻找樹根旁的木盒', facingHint: -1 },
    { id: 'treasure_loose_pages', type: 'treasure', waypointId: 'broken_rail', state: 'available', progressCritical: false, priorityTags: ['discovery', 'paper'], animationKey: 'pickup', activity: '正在拾起欄杆旁的紙頁', facingHint: 1 },

    { id: 'inspect_tablet', type: 'inspect', waypointId: 'tablet_read', state: 'available', progressCritical: false, priorityTags: ['history', 'stone'], animationKey: 'inspect', activity: '正在查看石碑', facingHint: -1 },
    { id: 'inspect_roots', type: 'inspect', waypointId: 'root_alcove', state: 'available', progressCritical: false, priorityTags: ['nature', 'nearby'], animationKey: 'inspect', activity: '在樹根旁停了一會', facingHint: -1 },
    { id: 'landmark_astrolabe', type: 'landmark', waypointId: 'astrolabe_observe', state: 'available', progressCritical: false, priorityTags: ['quiet', 'landmark'], animationKey: 'lookAround', activity: '正在觀察舊星盤', facingHint: -1 },

    { id: 'rest_bridge', type: 'rest', waypointId: 'bridge_pause', state: 'available', progressCritical: false, priorityTags: ['quiet', 'view'], animationKey: 'rest', activity: '在石橋邊看霧' },
    { id: 'rest_overlook', type: 'rest', waypointId: 'ruin_overlook', state: 'available', progressCritical: false, priorityTags: ['quiet', 'view'], animationKey: 'lookAround', activity: '在平台邊眺望遺跡', facingHint: 1 }
  ]
}

export function waypointById(map: ExplorationMapDefinition, id: string): WaypointDefinition {
  const waypoint = map.waypoints.find((candidate) => candidate.id === id)
  if (!waypoint) throw new Error(`Unknown exploration waypoint: ${id}`)
  return waypoint
}

export function progressLamps(map: ExplorationMapDefinition): InteractiveObjectDefinition[] {
  return map.objects
    .filter((object) => object.progressCritical && object.type === 'lamp')
    .sort((a, b) => (a.milestoneIndex ?? 0) - (b.milestoneIndex ?? 0))
}
